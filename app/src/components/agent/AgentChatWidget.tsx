import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { AiSettingsPanel } from './AiSettingsPanel';

export const AgentChatWidget: React.FC = () => {
  const { t } = useTranslation('agent');
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('agent:widgetTitle')}
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
        className="w-14 h-14 rounded-full bg-teal text-white shadow-e2 flex items-center justify-center hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal"
        aria-label={open ? t('agent:closeChat') : t('agent:openChat')}
      >
        <Bot size={24} />
      </button>
    </div>
  );
};
