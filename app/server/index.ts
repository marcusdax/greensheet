import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat';

const app = express();
const port = process.env.AI_PROXY_PORT ? parseInt(process.env.AI_PROXY_PORT, 10) : 3001;
const allowedOrigins = (process.env.AI_ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');

app.use(express.json());
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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AI proxy listening on http://localhost:${port}`);
});
