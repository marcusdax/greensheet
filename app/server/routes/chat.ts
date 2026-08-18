import { Router } from 'express';
import { z } from 'zod';
import { getAdapter } from '../providers/index.js';
import { buildSystemPrompt } from '../system-prompt/index.js';
import type { ChatMessage } from '../providers/adapter.js';

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

/**
 * Mask occurrences of `apiKey` in `text` so that leaked provider errors
 * cannot be logged with sensitive material.
 */
function redactApiKey(text: string, apiKey: string): string {
  if (!apiKey) return text;
  const escaped = apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'g'), '***REDACTED***');
}

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

  const generator = adapter.streamChat(fullMessages, model, apiKey);
  let clientClosed = false;

  req.on('close', () => {
    clientClosed = true;
    generator.return?.().catch(() => {
      // ignore cleanup errors
    });
    if (!res.writableEnded) {
      res.end();
    }
  });

  try {
    for await (const event of generator) {
      if (clientClosed || res.writableEnded) {
        break;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    const rawMessage = err instanceof Error ? err.stack ?? err.message : String(err);
    const safeMessage = redactApiKey(rawMessage, apiKey);
    // eslint-disable-next-line no-console
    console.error('Proxy streaming error:', safeMessage);

    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'Proxy error while streaming completions' })}\n\n`);
    }
  } finally {
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  }
});
