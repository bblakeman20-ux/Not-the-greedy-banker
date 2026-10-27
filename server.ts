import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  const getApiKey = () => {
    const raw = process.env.GEMINI_API_KEY;
    if (raw && raw !== 'MY_GEMINI_API_KEY' && raw.length > 20) {
      return raw;
    }
    return process.env.VITE_DEFAULT_GEMINI_KEY || raw || '';
  };

  const apiKey = getApiKey();
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health / status endpoint
  app.get('/api/gemini/status', (_req, res) => {
    res.json({
      available: Boolean(apiKey),
      keyLength: apiKey.length,
      defaultModel: 'gemini-flash-latest',
    });
  });

  // Streaming Gerg AI Ideas endpoint
  app.post('/api/gemini/ideas', async (req, res) => {
    const { prompt, model = 'gemini-flash-latest', search = false } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server' })}\n\n`);
      res.end();
      return;
    }

    const candidateModels = [model || 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const tried = new Set<string>();

    for (const m of candidateModels) {
      if (tried.has(m)) continue;
      tried.add(m);

      try {
        const config: any = {};
        if (search) {
          config.tools = [{ googleSearch: {} }];
        } else {
          config.responseMimeType = 'application/json';
          config.responseSchema = {
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
        }

        const stream = await ai.models.generateContentStream({
          model: m,
          contents: prompt,
          config,
        });

        let emittedAny = false;
        for await (const chunk of stream) {
          const text = chunk.text || '';
          const grounding = chunk.candidates?.[0]?.groundingMetadata || null;
          res.write(`data: ${JSON.stringify({ text, grounding, model: m })}\n\n`);
          emittedAny = true;
        }

        if (emittedAny) {
          res.write(`data: [DONE]\n\n`);
          res.end();
          return;
        }
      } catch (err: any) {
        console.warn(`Model ${m} failed in stream:`, err?.message || err);
        // If it was the last candidate model, write the error
        if (m === candidateModels[candidateModels.length - 1]) {
          res.write(`data: ${JSON.stringify({ error: err?.message || 'AI generation failed' })}\n\n`);
          res.end();
          return;
        }
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  });

  // Calendar dates extraction endpoint
  app.post('/api/gemini/dates', async (req, res) => {
    const { prompt, model = 'gemini-flash-latest' } = req.body;

    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
      return;
    }

    const candidateModels = [model || 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const m of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
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
            },
          },
        });

        res.json({ text: response.text });
        return;
      } catch (err: any) {
        console.warn(`Date extraction failed on model ${m}:`, err?.message || err);
        lastError = err;
      }
    }

    res.status(500).json({ error: lastError?.message || 'Date extraction failed' });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
