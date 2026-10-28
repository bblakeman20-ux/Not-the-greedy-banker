import express from 'express';
import { registerGeminiRoutes } from '../server/gemini';

// Vercel serverless entry: same Gerg AI routes as server.ts
const app = express();
app.use(express.json());
registerGeminiRoutes(app);

export default app;
