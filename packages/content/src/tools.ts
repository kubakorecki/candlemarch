import type { ToolsDef } from './types';

// Tools (spec, Economy: Tools: used and sold). Proposed: ticket 22 revisits the wear after the M5
// playtest.
export const tools: ToolsDef = {
  resource: 'tools',
  speedPercent: 150, // 50% faster
  wearDays: 20, // about a year of days worked (4 seasons × 5 days)
};
