// How the build menu groups the tools: one tab per category, each tool in exactly one. Demolish sits
// apart at the end of the tab row; the tree tools (`TREE_TOOLS`) are in the woodcutter's hut panel.
import type { ToolId } from '../game/tools';
import type { IconName } from './icons';

export type BuildCategoryId =
  | 'homes'
  | 'gathering'
  | 'workshops'
  | 'village'
  | 'night'
  | 'walls'
  | 'roads';

export interface BuildCategory {
  id: BuildCategoryId;
  label: string;
  icon: IconName;
  tools: readonly ToolId[];
}

export const BUILD_CATEGORIES: readonly BuildCategory[] = [
  { id: 'homes', label: 'Homes & Food', icon: 'hut', tools: ['hut', 'granary'] },
  {
    id: 'gathering',
    label: 'Gathering',
    icon: 'axe',
    tools: [
      'woodcutters_hut',
      'foragers_hut',
      'hunters_lodge',
      'fishers_hut',
      'foresters_lodge',
      'quarry',
      'clay_pit',
      'mine',
    ],
  },
  { id: 'workshops', label: 'Workshops', icon: 'block', tools: ['chopping_block'] },
  { id: 'village', label: 'Village', icon: 'hall', tools: ['village_hall'] },
  {
    id: 'night',
    label: 'Light & Watch',
    icon: 'torch',
    tools: ['torch', 'brazier', 'watchtower', 'bell'],
  },
  { id: 'walls', label: 'Walls', icon: 'palisade', tools: ['palisade', 'gate'] },
  {
    id: 'roads',
    label: 'Roads & Storage',
    icon: 'path',
    tools: ['path', 'stockpile', 'removePath', 'drain', 'pass_road'],
  },
];

/** Each tool's icon on its card (and Demolish's on its button). */
export const TOOL_ICONS: Record<ToolId, IconName> = {
  hut: 'hut',
  granary: 'granary',
  woodcutters_hut: 'axe',
  foragers_hut: 'basket',
  hunters_lodge: 'bow',
  fishers_hut: 'fish',
  foresters_lodge: 'sapling',
  quarry: 'stone',
  clay_pit: 'clay',
  mine: 'ore',
  chopping_block: 'block',
  village_hall: 'hall',
  torch: 'torch',
  brazier: 'brazier',
  watchtower: 'tower',
  bell: 'bell',
  palisade: 'palisade',
  gate: 'gate',
  path: 'path',
  stockpile: 'stockpile',
  removePath: 'unpath',
  fellTrees: 'fell',
  reserve: 'reserve',
  digStumps: 'spade',
  eraseMarks: 'unreserve',
  drain: 'drain',
  pass_road: 'pass',
  demolish: 'pick',
};

/** The category `tool` is listed in, or null for Demolish and the tree tools. */
export function categoryOf(tool: ToolId): BuildCategoryId | null {
  return BUILD_CATEGORIES.find((c) => c.tools.includes(tool))?.id ?? null;
}
