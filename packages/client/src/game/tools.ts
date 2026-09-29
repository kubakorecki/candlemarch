// The build and demolish tools, in toolbar order, with their keyboard shortcuts and hints.
import type { BuildingId } from '@candlemarch/content';

export type ToolId = BuildingId | 'path' | 'removePath' | 'stockpile' | 'demolish';

/** HUD tools in toolbar order, with their keyboard shortcut. `drag` tools act on press-drag-release. */
export const TOOLS: readonly {
  id: ToolId;
  label: string;
  key: string;
  drag: boolean;
  hint: string;
}[] = [
  {
    id: 'hut',
    label: 'Hut',
    key: 'b',
    drag: false,
    hint: 'Click to place. Shift-click places more.',
  },
  {
    id: 'woodcutters_hut',
    label: "Woodcutter's hut",
    key: 'w',
    drag: false,
    hint: 'Click to place. Shift-click places more.',
  },
  {
    id: 'granary',
    label: 'Granary',
    key: 'g',
    drag: false,
    hint: 'Click to place. Villagers eat here at Dusk. Shift-click places more.',
  },
  {
    id: 'chopping_block',
    label: 'Chopping block',
    key: 'c',
    drag: false,
    hint: 'Click to place. Shift-click places more.',
  },
  {
    id: 'foragers_hut',
    label: "Forager's hut",
    key: 'o',
    drag: false,
    hint: 'Click to place near berry bushes and mushroom patches. Shift-click places more.',
  },
  {
    id: 'hunters_lodge',
    label: "Hunter's lodge",
    key: 'h',
    drag: false,
    hint: 'Click to place near a Hunting ground. Shift-click places more.',
  },
  {
    id: 'fishers_hut',
    label: "Fisher's hut",
    key: 'f',
    drag: false,
    hint: 'Click to place with its door on the riverbank. Shift-click places more.',
  },
  {
    id: 'torch',
    label: 'Torch',
    key: 'l',
    drag: false,
    hint: 'Click to place. Burns firewood each night; Gloamlings never step into its Light.',
  },
  {
    id: 'brazier',
    label: 'Brazier',
    key: 'z',
    drag: false,
    hint: 'Click to place. More Light than a torch, for more firewood each night.',
  },
  {
    id: 'bell',
    label: 'Militia bell',
    key: 'k',
    drag: false,
    hint: 'Click to place. One per village; ring it to call every villager to arms.',
  },
  {
    id: 'watchtower',
    label: 'Watchtower',
    key: 'y',
    drag: false,
    hint: 'Click to place. Its Watchman stands in it all night and shoots Gloamlings in range.',
  },
  {
    id: 'palisade',
    label: 'Palisade',
    key: 'p',
    drag: true,
    hint: 'Drag to lay an L-shaped palisade. It blocks villagers and Gloamlings alike.',
  },
  {
    id: 'gate',
    label: 'Gate',
    key: 'n',
    drag: true,
    hint: "Drag to lay Gates, or click for one. Villagers and the hero walk through; Gloamlings don't.",
  },
  { id: 'path', label: 'Path', key: 'r', drag: true, hint: 'Drag to lay an L-shaped path.' },
  { id: 'removePath', label: 'Remove path', key: 'x', drag: true, hint: 'Drag to remove path.' },
  { id: 'stockpile', label: 'Stockpile', key: 's', drag: true, hint: 'Drag a rectangle.' },
  {
    id: 'demolish',
    label: 'Demolish',
    key: 'd',
    drag: false,
    hint: 'Click a building, stockpile or construction site to remove it. Its goods are lost.',
  },
];

/** Tool `id`'s definition. */
export function toolDef(id: ToolId): (typeof TOOLS)[number] | undefined {
  return TOOLS.find((t) => t.id === id);
}
