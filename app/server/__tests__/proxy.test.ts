// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import request from 'supertest';
import { createApp } from '../index.js';

describe('POST /api/v1/chat/completions', () => {
  let server: Server;

  beforeAll(() => {
    const app = createApp();
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  it('rejects missing api key', async () => {
    const res = await request(server)
      .post('/api/v1/chat/completions')
      .send({ provider: 'deepseek', model: 'deepseek-chat', messages: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing provider API key');
  });

  it('rejects unsupported non-streaming request', async () => {
    const res = await request(server)
      .post('/api/v1/chat/completions')
      .set('x-provider-api-key', 'test')
      .send({ provider: 'deepseek', model: 'deepseek-chat', messages: [], stream: false });
    expect(res.status).toBe(400);
  });

  it('returns SSE for stub providers', async () => {
    const res = await request(server)
      .post('/api/v1/chat/completions')
      .set('x-provider-api-key', 'test')
      .send({ provider: 'claude', model: 'claude-3-opus', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});
