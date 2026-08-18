import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAi } from '../../stores/ai-store';
import { streamCompletion } from '../../api/ai-client';

export const ChatInput: React.FC = () => {
  const ai = useAi();
  const [text, setText] = useState('');

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || ai.isStreaming) return;

    const enabledProvider = (Object.entries(ai.providers).find(([, cfg]) => cfg.enabled) ?? [
      'deepseek',
      ai.providers.deepseek,
    ]) as [keyof typeof ai.providers, typeof ai.providers.deepseek];
    const [providerKey, config] = enabledProvider;

    if (!config.apiKey) {
      ai.appendAssistantChunk('Please add an API key in the agent settings.');
      return;
    }

    ai.sendMessage(trimmed);
    setText('');
    ai.setStreaming(true);

    try {
      const session = ai.sessions.find((s) => s.id === ai.activeSessionId);
      const messages = session?.messages ?? [];

      for await (const event of streamCompletion({
        provider: providerKey,
        model: config.model,
        apiKey: config.apiKey,
        messages,
      })) {
        if (event.chunk) {
          ai.appendAssistantChunk(event.chunk);
        }
        if (event.error) {
          ai.appendAssistantChunk(`\n\nError: ${event.error}`);
          break;
        }
        if (event.done) break;
      }
    } finally {
      ai.finalizeAssistantMessage();
      ai.setStreaming(false);
    }
  };

  return (
    <div className="p-3 border-t border-border bg-surface flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        placeholder="Ask the agent..."
        rows={1}
        className="flex-1 resize-none bg-recessed/20 border border-border rounded-md px-3 py-2 text-xs focus:border-teal focus:outline-none"
      />
      <button
        onClick={() => void handleSend()}
        disabled={ai.isStreaming || !text.trim()}
        className="p-2 bg-teal text-white rounded-md disabled:opacity-50"
        aria-label="Send message"
      >
        {ai.isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
      </button>
    </div>
  );
};
