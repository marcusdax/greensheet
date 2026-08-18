export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderAdapter {
  readonly provider: string;
  streamChat(messages: ChatMessage[], model: string, apiKey: string): AsyncGenerator<
    { chunk?: string; done?: boolean; error?: string },
    void,
    unknown
  >;
}
