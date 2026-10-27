// Gerg AI routes, shared by the dev/production server (server.ts) and the
// Vercel function (api/index.ts). Type-only imports are marked `import type`
// so this file also runs under Node's built-in TypeScript stripping.
import type { Express, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

// Stable aliases that Google keeps pointed at current models. Override with
// GEMINI_MODELS="model-a,model-b" if you want to pin specific versions.
const DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const MODEL_NAME = /^gemini-[\w.-]{1,60}$/;
const KEY_SHAPE = /^[\w-]{20,200}$/;
const MODEL_LIST_TTL = 60 * 60 * 1000;

const serverKey = (): string => {
  const raw = process.env.GEMINI_API_KEY || '';
  return raw && raw !== 'MY_GEMINI_API_KEY' ? raw : '';
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

// Ask Google which models this key can actually use, so a retired model name
// is skipped instead of failing every request. Cached per key for an hour.
const modelCache = new Map<string, { at: number; names: Set<string> }>();
async function availableModels(ai: GoogleGenAI, key: string): Promise<Set<string> | null> {
  const hit = modelCache.get(key);
  if (hit && Date.now() - hit.at < MODEL_LIST_TTL) return hit.names;
  try {
    const names = new Set<string>();
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.name) names.add(m.name.replace(/^models\//, ''));
    }
    modelCache.set(key, { at: Date.now(), names });
    return names;
  } catch (err: any) {
    console.warn('Could not list Gemini models:', cleanError(err));
    return null;
  }
}

async function candidateModels(ai: GoogleGenAI, key: string, requested?: unknown): Promise<string[]> {
  const wanted = [
    ...(typeof requested === 'string' && MODEL_NAME.test(requested) ? [requested] : []),
    ...configuredModels(),
  ].filter((m, i, a) => a.indexOf(m) === i);
  const live = await availableModels(ai, key);
  if (!live) return wanted;
  const usable = wanted.filter((m) => live.has(m));
  return usable.length ? usable : wanted;
}

// A squad member can bring their own key (Setup → Builder Admin); otherwise the server key is used.
const keyFor = (req: Request): string => {
  const own = req.get('x-gemini-key') || '';
  return KEY_SHAPE.test(own) ? own : serverKey();
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
    const models = await candidateModels(ai, key, model);
    let lastError: any = null;

    for (const m of models) {
      try {
        const config: any = search
          ? { tools: [{ googleSearch: {} }] }
          : { responseMimeType: 'application/json', responseSchema: IDEA_SCHEMA };
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
        console.warn(`Model ${m} failed in stream:`, cleanError(err));
        lastError = err;
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
    for (const m of await candidateModels(ai, key, model)) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: DATE_SCHEMA },
        });
        res.json({ text: response.text });
        return;
      } catch (err: any) {
        console.warn(`Date extraction failed on model ${m}:`, cleanError(err));
        lastError = err;
      }
    }
    res.status(500).json({ error: lastError ? cleanError(lastError) : 'Date extraction failed' });
  });
}
