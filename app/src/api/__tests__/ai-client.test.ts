import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamCompletion } from '../ai-client';

describe('streamCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('yields chunks from an SSE stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"chunk":"Hello"}\n\n'));
        controller.enqueue(encoder.encode('data: {"chunk":" world"}\n\n'));
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const chunks: string[] = [];
    for await (const event of streamCompletion({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      if (event.chunk) chunks.push(event.chunk);
      if (event.done) break;
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('yields error when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Bad request',
    });

    const events = [];
    for await (const event of streamCompletion({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({ error: 'Bad request' });
  });
});
