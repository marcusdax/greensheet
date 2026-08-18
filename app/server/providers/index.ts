import { DeepSeekAdapter } from './deepseek';
import { ClaudeAdapter } from './claude';
import { KimiAdapter } from './kimi';
import { GeminiAdapter } from './gemini';
import type { ProviderAdapter } from './adapter';

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
