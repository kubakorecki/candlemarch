import type { LogisticsModelId } from '@candlemarch/sim';

/** How the HUD and the New game panel name each logistics model. */
export const MODEL_LABELS: Record<LogisticsModelId, string> = {
  jobDispatch: 'A · job dispatch',
  flagRelay: 'B · flag relay',
};
