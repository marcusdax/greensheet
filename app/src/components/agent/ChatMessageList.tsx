import React from 'react';
import { useAi } from '../../stores/ai-store';

export const ChatMessageList: React.FC = () => {
  const ai = useAi();
  const session = ai.sessions.find((s) => s.id === ai.activeSessionId);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [session?.messages.length, session?.messages.at(-1)?.content]);

  if (!session || session.messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center text-xs text-muted">
        Ask the agent about Vietnam coffee, sourcing, roasting, trade, or compliance.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite">
      {session.messages.map((m, idx) => (
        <div
          key={idx}
          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-teal text-white'
                : 'bg-recessed text-ink border border-border'
            }`}
          >
            {m.content}
            {m.role === 'assistant' && ai.isStreaming && idx === session.messages.length - 1 && (
              <span className="inline-block w-1.5 h-1.5 ml-1 bg-muted rounded-full animate-pulse" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
