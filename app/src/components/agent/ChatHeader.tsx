import React from 'react';
import { Settings, X, Trash2 } from 'lucide-react';
import { useAi } from '../../stores/ai-store';

interface ChatHeaderProps {
  onToggleSettings: () => void;
  onClose: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onToggleSettings, onClose }) => {
  const ai = useAi();

  return (
    <div className="h-12 px-3 bg-navy text-parchment-50 flex items-center justify-between rounded-t-lg">
      <span className="text-sm font-semibold">ODASI Coffee Agent</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => ai.clearSession()}
          className="p-1.5 hover:bg-white/10 rounded-md"
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={onToggleSettings}
          className="p-1.5 hover:bg-white/10 rounded-md"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-md"
          aria-label="Close chat"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
