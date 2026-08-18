import { Router } from 'express';
import { z } from 'zod';
import { getAdapter } from '../providers';
import { buildSystemPrompt } from '../system-prompt';
import type { ChatMessage } from '../providers/adapter';

const chatBodySchema = z.object({
  provider: z.enum(['deepseek', 'claude', 'kimi', 'gemini']),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    }),
  ),
  stream: z.boolean().default(true),
});

export const chatRouter = Router();

chatRouter.post('/completions', async (req, res) => {
  const parseResult = chatBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request body', issues: parseResult.error.issues });
    return;
  }

  const { provider, model, messages, stream } = parseResult.data;
  const apiKey = req.headers['x-provider-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Missing provider API key' });
    return;
  }

  const adapter = getAdapter(provider);
  if (!adapter) {
    res.status(400).json({ error: `Unknown provider: ${provider}` });
    return;
  }

  const systemMessage: ChatMessage = { role: 'system', content: buildSystemPrompt() };
  const fullMessages: ChatMessage[] = [systemMessage, ...messages];

  if (!stream) {
    res.status(400).json({ error: 'Only streaming completions are supported' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const generator = adapter.streamChat(fullMessages, model, apiKey);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected proxy error';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});
