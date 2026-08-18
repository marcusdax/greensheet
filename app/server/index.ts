import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chatRouter } from './routes/chat.js';

function getValidatedPort(): number {
  const rawPort = process.env.AI_PROXY_PORT;
  if (!rawPort) return 3001;
  const parsed = parseInt(rawPort, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3001;
}

export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '256kb' }));

  const allowedOrigins = (process.env.AI_ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-provider-api-key'],
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/chat', chatRouter);

  return app;
}

const thisFile = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFile)) {
  const app = createApp();
  const port = getValidatedPort();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`AI proxy listening on http://localhost:${port}`);
  });
}
