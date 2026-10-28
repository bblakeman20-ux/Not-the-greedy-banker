// Gerg AI routes, shared by the dev/production server (server.ts) and the
// Vercel function (api/index.ts). Type-only imports are marked `import type`
// so this file also runs under Node's built-in TypeScript stripping.
import type { Express, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

// Stable aliases that Google keeps pointed at current models.
const DEFAULT_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
];
const MODEL_NAME = /^gemini-[\w.-]{1,60}$/;
const KEY_SHAPE = /^[\w.-]{15,250}$/;

const serverKey = (): string => {
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey !== 'MY_GEMINI_API_KEY' && envKey.trim().length > 10) {
    return envKey.trim();
  }
  const defaultKey = process.env.VITE_DEFAULT_GEMINI_KEY;
  if (defaultKey && defaultKey !== 'MY_GEMINI_API_KEY' && defaultKey.trim().length > 10) {
    return defaultKey.trim();
  }
  return '';
};

const configuredModels = (): string[] => {
  const fromEnv = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => MODEL_NAME.test(m));
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
};

const clients = new Map<string, GoogleGenAI>();
const clientFor = (key: string): GoogleGenAI => {
  let c = clients.get(key);
  if (!c) {
    c = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    clients.set(key, c);
  }
  return c;
};

function candidateModels(requested?: unknown): string[] {
  const list = [
    ...(typeof requested === 'string' && MODEL_NAME.test(requested) ? [requested] : []),
    ...configuredModels(),
    ...DEFAULT_MODELS,
  ];
  return list.filter((m, i, a) => a.indexOf(m) === i);
}

// The server exclusively uses its trusted server-side environment key.
const keyFor = (_req: Request): string => {
  return serverKey();
};

const IDEA_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      kind: { type: Type.STRING, enum: ['spot', 'event', 'combo'] },
      loc: { type: Type.STRING },
      when: { type: Type.STRING },
      cost: { type: Type.STRING },
      desc: { type: Type.STRING },
      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
      url: { type: Type.STRING },
    },
    required: ['name', 'kind', 'loc', 'desc'],
  },
};

const DATE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING },
      label: { type: Type.STRING },
      time: { type: Type.STRING },
      matchedMemberId: { type: Type.STRING },
    },
    required: ['date', 'label'],
  },
};

const NO_KEY = 'GEMINI_API_KEY is not configured on the server';

// Gemini errors arrive as JSON nested inside strings; dig out the innermost message.
const cleanError = (err: any): string => {
  let msg = String(err?.message || err || 'Unknown error');
  for (let i = 0; i < 4; i++) {
    try {
      const parsed = JSON.parse(msg);
      const inner = parsed?.error?.message ?? parsed?.message;
      if (typeof inner !== 'string') break;
      msg = inner;
    } catch {
      break;
    }
  }
  return msg.slice(0, 300);
};

export function registerGeminiRoutes(app: Express): void {
  app.get('/api/gemini/status', (_req: Request, res: Response) => {
    res.json({ available: Boolean(serverKey()), models: configuredModels() });
  });

  // Streams ideas back as server-sent events: {text, grounding, model} chunks, then [DONE]
  app.post('/api/gemini/ideas', async (req: Request, res: Response) => {
    const { prompt, model, search = false } = req.body || {};

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const send = (data: unknown) => res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);

    const key = keyFor(req);
    if (!key) {
      send({ error: NO_KEY });
      res.end();
      return;
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      send({ error: 'Missing prompt' });
      res.end();
      return;
    }

    const ai = clientFor(key);
    const models = candidateModels(model);
    let lastError: any = null;

    // Config priority:
    // If search is requested, try Google Search tool first (paid tier).
    // If search is unsupported (free tier), automatically fall back to structured JSON generation.
    const configsToTry: any[] = [];
    if (search) {
      configsToTry.push({ tools: [{ googleSearch: {} }] });
    }
    configsToTry.push({ responseMimeType: 'application/json', responseSchema: IDEA_SCHEMA });
    configsToTry.push({ responseMimeType: 'application/json' });

    for (const m of models) {
      for (const config of configsToTry) {
        try {
          const stream = await ai.models.generateContentStream({ model: m, contents: prompt, config });

          let emittedAny = false;
          for await (const chunk of stream) {
            send({ text: chunk.text || '', grounding: chunk.candidates?.[0]?.groundingMetadata || null, model: m });
            emittedAny = true;
          }
          if (emittedAny) {
            send('[DONE]');
            res.end();
            return;
          }
        } catch (err: any) {
          const cleaned = cleanError(err);
          // If search tool fails because this key is on the free tier (grounding is paid only),
          // immediately continue to the non-search config.
          if (config.tools && /search|grounding|permission|unsupported|not allowed|403/i.test(cleaned)) {
            console.info(`Model ${m} Google Search grounding unsupported on this tier – falling back to direct JSON generation`);
            continue;
          }
          if (/depleted|prepayment|billing|credit/i.test(cleaned)) {
            console.info(`Model ${m} stream skipped: project prepayment credits depleted`);
          } else {
            console.info(`Model ${m} stream issue:`, cleaned);
          }
          lastError = err;
        }
      }
    }

    send({ error: lastError ? cleanError(lastError) : 'Gerg AI returned nothing' });
    res.end();
  });

  app.post('/api/gemini/dates', async (req: Request, res: Response) => {
    const { prompt, model } = req.body || {};
    const key = keyFor(req);
    if (!key) {
      res.status(500).json({ error: NO_KEY });
      return;
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }

    const ai = clientFor(key);
    let lastError: any = null;
    const configsToTry = [
      { responseMimeType: 'application/json', responseSchema: DATE_SCHEMA },
      { responseMimeType: 'application/json' },
    ];

    for (const m of candidateModels(model)) {
      for (const config of configsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: m,
            contents: prompt,
            config,
          });
          res.json({ text: response.text });
          return;
        } catch (err: any) {
          const cleaned = cleanError(err);
          if (/depleted|prepayment|billing|credit/i.test(cleaned)) {
            console.info(`Date extraction skipped on model ${m}: project prepayment credits depleted`);
          } else {
            console.info(`Date extraction issue on model ${m}:`, cleaned);
          }
          lastError = err;
        }
      }
    }
    res.status(500).json({ error: lastError ? cleanError(lastError) : 'Date extraction failed' });
  });
}
