import { useRootStore } from '../../../root-store';

export function resetAiState() {
  useRootStore.getState().ai.resetAi();
}
