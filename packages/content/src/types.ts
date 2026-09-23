// ID unions and definition shapes. IDs are string literal unions so a typo is a type error.

export type ResourceId = 'logs';
export type TerrainId = 'grass';
export type MapObjectId = 'tree';
export type BuildingId = 'woodcutters_hut' | 'hut';
export type VillagerRoleId = 'woodcutter' | 'carrier';

/** A number of units of one resource. */
export interface ResourceAmount {
  resource: ResourceId;
  amount: number;
}

export interface ResourceDef {
  id: ResourceId;
  name: string;
}

export interface TerrainDef {
  id: TerrainId;
  name: string;
  /** Villagers may walk across it. */
  walkable: boolean;
  /** Buildings may be placed on it. */
  buildable: boolean;
}

/** Something standing on a tile that blocks it, such as a tree. */
export interface MapObjectDef {
  id: MapObjectId;
  name: string;
  /** What gathering it yields. */
  resource: ResourceId;
  /** How many units it holds when the map starts. It is removed once empty. */
  amount: number;
  /** Ticks of work for one gather. */
  gatherTicks: number;
  /** Units taken per gather. */
  yieldPerGather: number;
}

export interface VillagerRoleDef {
  id: VillagerRoleId;
  name: string;
  /** Walking speed in milli-tiles per tick (1000 = one tile per tick). */
  walkSpeed: number;
  /** Units carried per trip. */
  carryCapacity: number;
  /** Ticks to wait before looking for work again when none was found. */
  idleRetryTicks: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** Footprint in tiles, anchored at the building's origin tile (its smallest x and y). */
  size: { w: number; h: number };
  /** Tile villagers walk to when they visit the building, as an offset from the origin. Lies outside the footprint. */
  door: { x: number; y: number };
  /** The player can place it. Buildings that aren't placeable only come with the map. */
  placeable: boolean;
  /** Villagers the building employs when it exists. */
  employs: { role: VillagerRoleId; count: number }[];
  /** Map object its workers gather from, if any. */
  gathers?: MapObjectId;
  /** Where its workers drop what they produce, if anything. */
  outputBuffer?: { resource: ResourceId; capacity: number };
  /** Cost and time to build it from a construction site. Absent for buildings that can't be built. */
  construction?: { cost: ResourceAmount[]; buildTicks: number };
}

export interface Content {
  resources: Record<ResourceId, ResourceDef>;
  terrain: Record<TerrainId, TerrainDef>;
  mapObjects: Record<MapObjectId, MapObjectDef>;
  villagerRoles: Record<VillagerRoleId, VillagerRoleDef>;
  buildings: Record<BuildingId, BuildingDef>;
}
