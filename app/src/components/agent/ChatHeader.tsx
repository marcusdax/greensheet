import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, X, Trash2 } from 'lucide-react';
import { useAi } from '../../stores/ai-store';

interface ChatHeaderProps {
  onToggleSettings: () => void;
  onClose: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onToggleSettings, onClose }) => {
  const { t } = useTranslation('agent');
  const ai = useAi();

  return (
    <div className="h-12 px-3 bg-navy text-parchment-50 flex items-center justify-between rounded-t-lg">
      <span className="text-sm font-semibold">{t('agent:widgetTitle')}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => ai.clearSession()}
          className="p-1.5 hover:bg-white/10 rounded-md"
          aria-label={t('agent:clearChat')}
          title={t('agent:clearChat')}
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={onToggleSettings}
          className="p-1.5 hover:bg-white/10 rounded-md"
          aria-label={t('agent:settings')}
          title={t('agent:settings')}
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-md"
          aria-label={t('agent:closeChat')}
          title={t('agent:closeChat')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
