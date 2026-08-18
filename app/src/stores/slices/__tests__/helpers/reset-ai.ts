import { useAiStore } from '../../../ai-store';

export function resetAiState() {
  useAiStore.getState().resetAi();
}
