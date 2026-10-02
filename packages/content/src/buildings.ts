import type { BuildingDef, BuildingId } from './types';

export const buildings: Record<BuildingId, BuildingDef> = {
  woodcutters_hut: {
    id: 'woodcutters_hut',
    name: "Woodcutter's hut",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'woodcutter', count: 1 }],
    gathers: ['tree'],
    digs: ['stump'], // once marked with the Dig stumps tool
    // A radius so the placement preview can warn when it reaches into a Hunting ground.
    workRadius: 8,
    outputBuffer: { resources: ['logs'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  fishers_hut: {
    id: 'fishers_hut',
    name: "Fisher's hut",
    // 1×1 with the door straight ahead, so either bank of a north-south river fits it.
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    doorOnRiverbank: true,
    employs: [{ job: 'fisher', count: 1 }],
    fishes: { catchTicks: 400, yieldPerCatch: 1 }, // 20 s a fish
    outputBuffer: { resources: ['fish'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  foragers_hut: {
    id: 'foragers_hut',
    name: "Forager's hut",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'forager', count: 1 }],
    gathers: ['berry_bush', 'mushroom_patch'],
    workRadius: 8,
    outputBuffer: { resources: ['berries', 'mushrooms'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  hunters_lodge: {
    id: 'hunters_lodge',
    name: "Hunter's lodge",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'hunter', count: 1 }],
    workRadius: 10,
    hunts: {
      huntTicks: 400, // 20 s a hunt
      catch: [
        { resource: 'meat', amount: 4 },
        { resource: 'hides', amount: 1, needsTool: true }, // skinning takes a tool
      ],
    },
    outputBuffer: { resources: ['meat', 'hides'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 8 }],
      buildTicks: 200, // 10 s
    },
  },
  foresters_lodge: {
    id: 'foresters_lodge',
    name: "Forester's lodge",
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'forester', count: 1 }],
    workRadius: 6,
    plants: { object: 'sapling', on: 'meadow', spacing: 2, plantTicks: 100 }, // 5 s a Sapling
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  hut: {
    id: 'hut',
    name: 'Hut',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    residents: 3,
    construction: {
      cost: [{ resource: 'logs', amount: 10 }],
      buildTicks: 200, // 10 s
    },
  },
  granary: {
    id: 'granary',
    name: 'Granary',
    size: { w: 2, h: 2 },
    door: { x: 1, y: 2 },
    placeable: true,
    employs: [],
    foodCapacity: 100,
    construction: {
      cost: [{ resource: 'logs', amount: 10 }],
      buildTicks: 200, // 10 s
    },
  },
  chopping_block: {
    id: 'chopping_block',
    name: 'Chopping block',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'woodsplitter', count: 1 }],
    recipes: ['split_logs'],
    inputBuffer: [{ resource: 'logs', capacity: 4 }],
    outputBuffer: { resources: ['firewood'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 3 }],
      buildTicks: 100, // 5 s
    },
  },
  // Lights (spec, Nights in v1): Gloamlings never step onto a lit tile (ADR-0003).
  torch: {
    id: 'torch',
    name: 'Torch',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    light: { radiusTiles: 2, fuel: 'firewood', burnPerNight: 1, holds: 3 },
    construction: {
      cost: [{ resource: 'logs', amount: 1 }],
      buildTicks: 60, // 3 s
    },
  },
  brazier: {
    id: 'brazier',
    name: 'Brazier',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    light: { radiusTiles: 4, fuel: 'firewood', burnPerNight: 2, holds: 6 },
    construction: {
      cost: [{ resource: 'logs', amount: 4 }],
      buildTicks: 100, // 5 s
    },
  },
  // Militia bell (spec, Nights in v1): calls every villager to arms.
  bell: {
    id: 'bell',
    name: 'Militia bell',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    bell: { rangeTiles: 10 },
    onePerVillage: true,
    construction: {
      cost: [{ resource: 'logs', amount: 5 }],
      buildTicks: 100, // 5 s
    },
  },
  // Watchtower (spec, Nights in v1): its Watchman stands in it by night and it shoots Gloamlings.
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'watchman', count: 1 }],
    watch: { rangeTiles: 6, damage: 5, cooldownTicks: 30 }, // 4 shots kill a Gloamling
    construction: {
      cost: [{ resource: 'logs', amount: 12 }],
      buildTicks: 200, // 10 s
    },
  },
  // Palisades (spec, Nights in v1): wall segments laid by dragging. The door is the segment's own
  // tile: villagers stand on the site to deliver, and a built wall is never visited.
  palisade: {
    id: 'palisade',
    name: 'Palisade',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    wall: { hp: 100, gate: false },
    construction: {
      cost: [{ resource: 'logs', amount: 2 }],
      buildTicks: 40, // 2 s
    },
  },
  gate: {
    id: 'gate',
    name: 'Gate',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    wall: { hp: 100, gate: true },
    construction: {
      cost: [{ resource: 'logs', amount: 4 }],
      buildTicks: 80, // 4 s
    },
  },
  // Groundwork (M4, spec World and map: Terrain), laid tile by tile like a Road. Numbers Proposed.
  drain: {
    id: 'drain',
    name: 'Drain',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    groundwork: { on: 'swamp', becomes: { terrain: 'meadow' } },
    construction: {
      cost: [{ resource: 'logs', amount: 2 }],
      buildTicks: 200, // 10 s
    },
  },
  pass_road: {
    id: 'pass_road',
    name: 'Pass road',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 0 },
    placeable: true,
    employs: [],
    groundwork: { on: 'pass_snow', becomes: { road: 'pass_road' } },
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 600, // 30 s
    },
  },
  // The Hamlet rank building (spec, Progression). Placed once the village has Hamlet's residents
  // (`ranks.ts`); completing it makes the village a Hamlet. A Knocked-out Hero gets up at its door
  // (spec, Heroes). Numbers Proposed.
  village_hall: {
    id: 'village_hall',
    name: 'Village hall',
    size: { w: 3, h: 2 },
    door: { x: 1, y: 2 },
    placeable: true,
    employs: [],
    onePerVillage: true,
    heroRecovers: true,
    construction: {
      cost: [
        { resource: 'logs', amount: 40 },
        { resource: 'stone', amount: 20 },
      ],
      buildTicks: 1200, // 60 s
    },
  },
  // The notice board (spec, Trades and masters): where Charters and Delivery orders are posted.
  // Cheap, one a village, unlocked at Hamlet. Numbers Proposed.
  notice_board: {
    id: 'notice_board',
    name: 'Notice board',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [],
    noticeBoard: true,
    onePerVillage: true,
    construction: {
      cost: [{ resource: 'logs', amount: 6 }],
      buildTicks: 200, // 10 s
    },
  },
  // Raw gatherers (M5, no master): each worker digs within the radius and piles the yard.
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    alsoBuildsOn: ['rock'], // the one building that stands on Rock, by its stone
    employs: [{ job: 'quarryman', count: 1 }],
    gathers: ['stone_deposit'],
    workRadius: 8,
    outputBuffer: { resources: ['stone'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 8 }],
      buildTicks: 200, // 10 s
    },
  },
  clay_pit: {
    id: 'clay_pit',
    name: 'Clay pit',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'clay_digger', count: 1 }],
    gathers: ['clay_deposit'],
    workRadius: 8,
    outputBuffer: { resources: ['clay'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 8 }],
      buildTicks: 200, // 10 s
    },
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'miner', count: 1 }],
    gathers: ['iron_deposit'],
    workRadius: 8,
    outputBuffer: { resources: ['iron_ore'], yard: { x: 1, y: 0 } },
    // Beside the Abandoned mine the old workings are already there (numbers Proposed).
    cheaperAt: { poi: 'abandoned_mine', cost: [{ resource: 'logs', amount: 6 }] },
    construction: {
      cost: [
        { resource: 'logs', amount: 12 },
        { resource: 'stone', amount: 8 },
      ],
      buildTicks: 300, // 15 s
    },
  },
  bog_iron_digger: {
    id: 'bog_iron_digger',
    name: 'Bog-iron digger',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'bog_digger', count: 1 }],
    digsOre: 'swamp',
    workRadius: 6,
    outputBuffer: { resources: ['iron_ore'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 8 }],
      buildTicks: 200, // 10 s
    },
  },
  // The farm (M5, no master): its farmers work the Fields the player paints in its radius
  // (`content.farming`). Fieldstones leave through its yard as stone. Numbers Proposed.
  farm: {
    id: 'farm',
    name: 'Farm',
    size: { w: 2, h: 2 },
    door: { x: 0, y: 2 },
    placeable: true,
    employs: [{ job: 'farmer', count: 2 }],
    farm: true,
    workRadius: 5,
    outputBuffer: { resources: ['grain', 'stone'], yard: { x: 1, y: 2 } },
    construction: {
      cost: [{ resource: 'logs', amount: 12 }],
      buildTicks: 300, // 15 s
    },
  },
  // The charcoal kiln (M5, no master): a workshop burning logs into charcoal for the bloomery.
  // Numbers Proposed.
  charcoal_kiln: {
    id: 'charcoal_kiln',
    name: 'Charcoal kiln',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'charcoal_burner', count: 1 }],
    recipes: ['burn_charcoal'],
    inputBuffer: [{ resource: 'logs', capacity: 6 }],
    outputBuffer: { resources: ['charcoal'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [
        { resource: 'logs', amount: 6 },
        { resource: 'stone', amount: 4 },
      ],
      buildTicks: 200, // 10 s
    },
  },
  // The tier-1 master workshops (M5): built from Hamlet, idle until their trade's Master settles
  // (`trade`). Numbers Proposed.
  sawpit: {
    id: 'sawpit',
    name: 'Sawpit',
    size: { w: 2, h: 1 },
    door: { x: 1, y: 1 },
    placeable: true,
    employs: [{ job: 'sawyer', count: 1 }],
    trade: 'carpenter',
    recipes: ['saw_planks'],
    inputBuffer: [{ resource: 'logs', capacity: 4 }],
    outputBuffer: { resources: ['planks'], yard: { x: 2, y: 0 } },
    construction: {
      cost: [{ resource: 'logs', amount: 8 }],
      buildTicks: 200, // 10 s
    },
  },
  stonecutter: {
    id: 'stonecutter',
    name: 'Stonecutter',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'stonecutter', count: 1 }],
    trade: 'mason',
    recipes: ['dress_stone'],
    inputBuffer: [{ resource: 'stone', capacity: 4 }],
    outputBuffer: { resources: ['cut_stone'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [
        { resource: 'logs', amount: 6 },
        { resource: 'stone', amount: 4 },
      ],
      buildTicks: 200, // 10 s
    },
  },
  brick_kiln: {
    id: 'brick_kiln',
    name: 'Brick kiln',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'brickmaker', count: 1 }],
    trade: 'mason',
    recipes: ['fire_bricks'],
    inputBuffer: [
      { resource: 'clay', capacity: 6 },
      { resource: 'firewood', capacity: 3 },
    ],
    outputBuffer: { resources: ['bricks'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [
        { resource: 'logs', amount: 4 },
        { resource: 'stone', amount: 8 },
      ],
      buildTicks: 300, // 15 s
    },
  },
  // Smokes fish or meat, whichever it has, with firewood; follows smoked fish for its standing order.
  smokehouse: {
    id: 'smokehouse',
    name: 'Smokehouse',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'smoker', count: 1 }],
    trade: 'butcher',
    recipes: ['smoke_fish', 'smoke_meat'],
    inputBuffer: [
      { resource: 'fish', capacity: 6 },
      { resource: 'meat', capacity: 6 },
      { resource: 'firewood', capacity: 3 },
    ],
    outputBuffer: { resources: ['smoked_fish', 'smoked_meat'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [
        { resource: 'logs', amount: 10 },
        { resource: 'stone', amount: 2 },
      ],
      buildTicks: 300, // 15 s
    },
  },
  // The tier-2 workshops the Tavern needs (M5): built from Hamlet, idle until their trade's Master
  // settles. The brewery's grain comes from farms' yards (a Granary isn't a supply). Numbers
  // Proposed.
  bloomery: {
    id: 'bloomery',
    name: 'Bloomery',
    size: { w: 1, h: 1 },
    door: { x: 0, y: 1 },
    placeable: true,
    employs: [{ job: 'smelter', count: 1 }],
    trade: 'smith',
    recipes: ['smelt_iron'],
    inputBuffer: [
      { resource: 'iron_ore', capacity: 6 },
      { resource: 'charcoal', capacity: 3 },
    ],
    outputBuffer: { resources: ['iron_bars'], yard: { x: 1, y: 0 } },
    construction: {
      cost: [
        { resource: 'logs', amount: 4 },
        { resource: 'stone', amount: 10 },
      ],
      buildTicks: 300, // 15 s
    },
  },
  brewery: {
    id: 'brewery',
    name: 'Brewery',
    size: { w: 2, h: 1 },
    door: { x: 1, y: 1 },
    placeable: true,
    employs: [{ job: 'brewer', count: 1 }],
    trade: 'brewer',
    recipes: ['brew_ale'],
    inputBuffer: [
      { resource: 'grain', capacity: 6 },
      { resource: 'firewood', capacity: 3 },
    ],
    outputBuffer: { resources: ['ale'], yard: { x: 2, y: 0 } },
    construction: {
      cost: [
        { resource: 'logs', amount: 10 },
        { resource: 'stone', amount: 4 },
      ],
      buildTicks: 300, // 15 s
    },
  },
  // The trade post (spec, Economy: The trade post in M5): Carriers bring the surplus its sell rules
  // name into its Storage, and Merchants buy it. One a village, unlocked at Hamlet, nobody works
  // there. Numbers Proposed.
  trade_post: {
    id: 'trade_post',
    name: 'Trade post',
    size: { w: 2, h: 2 },
    door: { x: 1, y: 2 },
    placeable: true,
    employs: [],
    onePerVillage: true,
    tradePost: { capacity: 100 },
    construction: {
      cost: [
        { resource: 'logs', amount: 16 },
        { resource: 'stone', amount: 6 },
      ],
      buildTicks: 400, // 20 s
    },
  },
};
