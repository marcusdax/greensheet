import { DeepSeekAdapter } from './deepseek.js';
import { ClaudeAdapter } from './claude.js';
import { KimiAdapter } from './kimi.js';
import { GeminiAdapter } from './gemini.js';
import type { ProviderAdapter } from './adapter.js';

export type { ProviderAdapter };
export { DeepSeekAdapter, ClaudeAdapter, KimiAdapter, GeminiAdapter };

export const adapters = new Map<string, ProviderAdapter>([
  ['deepseek', new DeepSeekAdapter()],
  ['claude', new ClaudeAdapter()],
  ['kimi', new KimiAdapter()],
  ['gemini', new GeminiAdapter()],
]);

export function getAdapter(provider: string): ProviderAdapter | undefined {
  return adapters.get(provider);
}
