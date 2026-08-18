import React, { useState, useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { AiSettingsPanel } from './AiSettingsPanel';

export const AgentChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setShowSettings(false);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowSettings(false);
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-floating flex flex-col items-end">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Coffee agent chat"
          className="mb-3 w-[340px] h-[420px] bg-surface border border-border rounded-lg shadow-e3 flex flex-col overflow-hidden"
        >
          <ChatHeader
            onToggleSettings={() => setShowSettings((s) => !s)}
            onClose={() => setOpen(false)}
          />
          {showSettings ? (
            <AiSettingsPanel />
          ) : (
            <>
              <ChatMessageList />
              <ChatInput />
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full bg-teal text-white shadow-e2 flex items-center justify-center hover:bg-teal-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal"
        aria-label={open ? 'Close coffee agent chat' : 'Open coffee agent chat'}
      >
        <Bot size={24} />
      </button>
    </div>
  );
};
