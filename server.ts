import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerGeminiRoutes } from './server/gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (typeof (process as any).loadEnvFile === 'function') {
  for (const file of ['.env.local', '.env']) {
    try {
      (process as any).loadEnvFile(path.resolve(__dirname, file));
    } catch (_e) {
      // ignore missing files
    }
  }
}

async function startServer() {
  const app = express();
  // Cloud Run / Nginx frontend listens on 8080 and proxies to port 3000.
  // The Node backend must bind to 3000 unless a non-8080 PORT or APP_PORT is given.
  const port = Number(process.env.APP_PORT || (process.env.PORT === '8080' ? 3000 : process.env.PORT) || 3000);

  app.use(express.json());

  // Healthcheck endpoint for Cloud Run and external monitors
  app.get('/healthz', (_req, res) => {
    res.status(200).send('OK');
  });

  registerGeminiRoutes(app);

  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev && hasDist) {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, host: '0.0.0.0', port },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite middleware could not be loaded, falling back to static dist:', err);
      if (hasDist) {
        app.use(express.static(distPath));
        app.use((_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        throw err;
      }
    }
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE' && port !== 3000) {
      console.log('Port in use, falling back to port 3000...');
      app.listen(3000, '0.0.0.0', () => {
        console.log('Server listening on fallback http://0.0.0.0:3000');
      });
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
