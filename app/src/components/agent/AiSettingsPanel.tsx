import React from 'react';
import { useAi } from '../../stores/ai-store';
import type { ProviderKey } from '../../stores/slices/ai-slice';

const PROVIDERS: { key: ProviderKey; label: string; models: string[]; wired: boolean }[] = [
  { key: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], wired: true },
  { key: 'claude', label: 'Claude', models: ['claude-3-5-sonnet-20241022'], wired: false },
  { key: 'kimi', label: 'Kimi', models: ['moonshot-v1-8k'], wired: false },
  { key: 'gemini', label: 'Gemini', models: ['gemini-1.5-flash'], wired: false },
];

export const AiSettingsPanel: React.FC = () => {
  const ai = useAi();
  const [active, setActive] = React.useState<ProviderKey>('deepseek');
  const provider = PROVIDERS.find((p) => p.key === active)!;
  const config = ai.providers[active];

  return (
    <div className="absolute inset-0 bg-surface z-10 flex flex-col">
      <div className="px-3 py-2 border-b border-border font-semibold text-sm">Agent Settings</div>
      <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActive(p.key)}
            className={`px-2 py-1 text-xs rounded-full border ${
              active === p.key ? 'bg-teal text-white border-teal' : 'bg-recessed text-ink border-border'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div>
          <label className="label block mb-1">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => ai.setProviderConfig(active, { apiKey: e.target.value })}
            placeholder={`${provider.label} API key`}
            className="w-full mock-input text-xs"
          />
        </div>
        <div>
          <label className="label block mb-1">Model</label>
          <select
            value={config.model}
            onChange={(e) => ai.setProviderConfig(active, { model: e.target.value })}
            className="w-full mock-input text-xs"
          >
            {provider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => ai.setProviderConfig(active, { enabled: e.target.checked })}
          />
          Enabled
        </label>
        {!provider.wired && (
          <div className="p-3 bg-warning-bg text-warning text-xs rounded-md">
            {provider.label} support is coming soon. Enable DeepSeek to use the agent now.
          </div>
        )}
      </div>
    </div>
  );
};
