import OpenAI from 'openai';
import type { ProviderAdapter, ChatMessage } from './adapter.js';

export class DeepSeekAdapter implements ProviderAdapter {
  readonly provider = 'deepseek';

  protected createClient(apiKey: string): OpenAI {
    return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
  }

  async *streamChat(messages: ChatMessage[], model: string, apiKey: string) {
    const client = this.createClient(apiKey);

    try {
      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: false },
      });

      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content;
        if (delta != null) {
          yield { chunk: delta };
        }
      }
      yield { done: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DeepSeek request failed';
      yield { error: message };
    }
  }
}
