// The build and demolish tools, in toolbar order, with their keyboard shortcuts and hints; the
// tree tools of the woodcutter's hut panel (`TREE_TOOLS`) and the farm panel's Field tools
// (`FIELD_TOOLS`).
import type { BuildingId } from '@candlemarch/content';

export type ToolId =
  | BuildingId
  | 'path'
  | 'removePath'
  | 'fellTrees'
  | 'reserve'
  | 'digStumps'
  | 'eraseMarks'
  | 'paintFields'
  | 'eraseFields'
  | 'stockpile'
  | 'demolish';

/**
 * HUD tools in toolbar order, with their keyboard shortcut (null for none: every letter is
 * taken). `drag` tools act on press-drag-release.
 */
export const TOOLS: readonly {
  id: ToolId;
  label: string;
  key: string | null;
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
    id: 'charcoal_kiln',
    label: 'Charcoal kiln',
    key: null,
    drag: false,
    hint: 'Click to place. Its charcoal burner burns logs into charcoal, fuel for the bloomery. Shift-click places more.',
  },
  {
    id: 'sawpit',
    label: 'Sawpit',
    key: null,
    drag: false,
    hint: 'Click to place. Saws logs into planks once a Carpenter has settled. Shift-click places more.',
  },
  {
    id: 'stonecutter',
    label: 'Stonecutter',
    key: null,
    drag: false,
    hint: 'Click to place. Cuts stone once a Mason has settled. Shift-click places more.',
  },
  {
    id: 'brick_kiln',
    label: 'Brick kiln',
    key: null,
    drag: false,
    hint: 'Click to place. Fires clay with firewood into bricks once a Mason has settled. Shift-click places more.',
  },
  {
    id: 'smokehouse',
    label: 'Smokehouse',
    key: null,
    drag: false,
    hint: 'Click to place. Smokes fish and meat with firewood into Food that keeps, once a Butcher has settled. Shift-click places more.',
  },
  {
    id: 'bloomery',
    label: 'Bloomery',
    key: null,
    drag: false,
    hint: 'Click to place. Smelts iron ore with charcoal into iron bars once a Smith has settled. Shift-click places more.',
  },
  {
    id: 'brewery',
    label: 'Brewery',
    key: null,
    drag: false,
    hint: "Click to place. Brews grain from the farms' yards with firewood into ale once a Brewer has settled. Shift-click places more.",
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
    id: 'foresters_lodge',
    label: "Forester's lodge",
    key: 'i',
    drag: false,
    hint: 'Click to place. Its forester plants Saplings on open meadow nearby, which grow into trees in about a year. Shift-click places more.',
  },
  {
    id: 'quarry',
    label: 'Quarry',
    key: null,
    drag: false,
    hint: 'Click to place near stone Deposits; it may stand on Rock. Stone never comes back. Shift-click places more.',
  },
  {
    id: 'clay_pit',
    label: 'Clay pit',
    key: null,
    drag: false,
    hint: 'Click to place near clay Deposits on the riverbank. Dug-out clay comes back a little each spring. Shift-click places more.',
  },
  {
    id: 'mine',
    label: 'Mine',
    key: null,
    drag: false,
    hint: 'Click to place near iron Deposits on a Mountain face. Beside the Abandoned mine it costs only logs. Ore never comes back. Shift-click places more.',
  },
  {
    id: 'bog_iron_digger',
    label: 'Bog-iron digger',
    key: null,
    drag: false,
    hint: 'Click to place near Swamp. Its worker slowly digs the bog iron every Swamp tile holds, which comes back each spring. Shift-click places more.',
  },
  {
    id: 'farm',
    label: 'Farm',
    key: null,
    drag: false,
    hint: 'Click to place on open meadow, then paint its Fields from its panel. Fields are sown in spring and harvested from late summer through autumn. Shift-click places more.',
  },
  {
    id: 'village_hall',
    label: 'Village hall',
    key: null,
    drag: false,
    hint: 'Click to place once the village has its residents. Finishing it makes the village a Hamlet.',
  },
  {
    id: 'notice_board',
    label: 'Notice board',
    key: null,
    drag: false,
    hint: 'Click to place. Charters and Delivery orders are posted on it; click it to read them.',
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
  {
    id: 'drain',
    label: 'Drain',
    key: 'u',
    drag: true,
    hint: 'Drag over Swamp. Each tile, once built, turns into Meadow you can build on.',
  },
  {
    id: 'pass_road',
    label: 'Pass road',
    key: 'j',
    drag: true,
    hint: 'Drag through the Pass snow. Each tile, once built, is open to everyone all year.',
  },
  { id: 'removePath', label: 'Remove path', key: 'x', drag: true, hint: 'Drag to remove path.' },
  { id: 'stockpile', label: 'Stockpile', key: 's', drag: true, hint: 'Drag a rectangle.' },
  // The tree tools, in the woodcutter's hut panel rather than the build menu.
  {
    id: 'fellTrees',
    label: 'Fell',
    key: null,
    drag: true,
    hint: 'Drag a rectangle over trees to mark them. Woodcutters fell marked trees in reach before any other.',
  },
  {
    id: 'reserve',
    label: 'Keep',
    key: 'm',
    drag: true,
    hint: 'Drag a rectangle over forest to keep it as a Reserve. Woodcutters never fell trees there; foragers, hunters and foresters still work there. Free, and it blocks no building.',
  },
  {
    id: 'digStumps',
    label: 'Dig stumps',
    key: null,
    drag: true,
    hint: 'Drag a rectangle over Stumps to mark them. A woodcutter in reach digs each out for a log, leaving bare ground where nothing grows back.',
  },
  {
    id: 'eraseMarks',
    label: 'Erase',
    key: 'a',
    drag: true,
    hint: 'Drag a rectangle to take Fell and Dig marks and the Reserve off it.',
  },
  // The Field tools, in the farm panel.
  {
    id: 'paintFields',
    label: 'Fields',
    key: null,
    drag: true,
    hint: "Drag a rectangle over open meadow in the farm's reach to make it Fields. Free; its farmers sow them each spring.",
  },
  {
    id: 'eraseFields',
    label: 'Erase',
    key: null,
    drag: true,
    hint: 'Drag a rectangle to take Fields away, with whatever grows on them.',
  },
  {
    id: 'demolish',
    label: 'Demolish',
    key: 'd',
    drag: false,
    hint: 'Click a building, stockpile or construction site to remove it. Its goods are lost.',
  },
];

/** The woodcutter's hut panel's tools, in order. The build menu leaves them out. */
export const TREE_TOOLS: readonly ToolId[] = ['fellTrees', 'reserve', 'digStumps', 'eraseMarks'];

/** The farm panel's tools, in order. The build menu leaves them out. */
export const FIELD_TOOLS: readonly ToolId[] = ['paintFields', 'eraseFields'];

/** Tool `id`'s definition. */
export function toolDef(id: ToolId): (typeof TOOLS)[number] | undefined {
  return TOOLS.find((t) => t.id === id);
}
