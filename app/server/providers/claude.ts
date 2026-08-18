import type { ProviderAdapter, ChatMessage } from './adapter.js';

export class ClaudeAdapter implements ProviderAdapter {
  readonly provider = 'claude';

  async *streamChat(_messages: ChatMessage[], _model: string, _apiKey: string) {
    yield { error: 'Claude provider is not yet implemented. Enable DeepSeek to chat.' };
  }
}
