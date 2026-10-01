import { describe, expect, it } from 'vitest';
import { idsOf } from '../src/entities';
import { blockedGrid, heroBlockedGrid, isRiverbank, objectSpeedGrid, tileAt } from '../src/grid';
import { groundTiles, standingTrees } from '../src/huntingGrounds';
import { createInitialState } from '../src/map';
import { regions } from '../src/pathfinding';
import type { Tile } from '../src/state';
import { generateValley, type Valley } from '../src/valley/generate';
import { woodTreePercent } from '../src/valley/layout';
import { content } from './helpers';

const { valley } = content;
const g = valley.guarantees;

/** Chebyshev distance. */
function distance(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Each Valley's tiles by map character, worked out once. */
const byChar = new WeakMap<Valley, Map<string, Tile[]>>();

/** Every tile whose map character is one of `chars`. */
function tilesOf(v: Valley, chars: string): Tile[] {
  let index = byChar.get(v);
  if (!index) {
    const built = new Map<string, Tile[]>();
    v.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = row[x] as string;
        const list = built.get(c) ?? [];
        list.push({ x, y });
        built.set(c, list);
      }
    });
    byChar.set(v, built);
    index = built;
  }
  const found = index;
  return [...chars].flatMap((c) => found.get(c) ?? []);
}

function charAt(v: Valley, t: Tile): string {
  return v.rows[t.y]?.[t.x] ?? '';
}

function sides(t: Tile): Tile[] {
  return [
    { x: t.x, y: t.y - 1 },
    { x: t.x + 1, y: t.y },
    { x: t.x, y: t.y + 1 },
    { x: t.x - 1, y: t.y },
  ];
}

/** How many 4-connected groups `tiles` make. */
function groups(tiles: Tile[]): number {
  const left = new Set(tiles.map((t) => `${t.x},${t.y}`));
  let count = 0;
  for (const t of tiles) {
    if (!left.delete(`${t.x},${t.y}`)) continue;
    count += 1;
    const stack = [t];
    while (stack.length > 0) {
      for (const s of sides(stack.pop() as Tile)) {
        if (left.delete(`${s.x},${s.y}`)) stack.push(s);
      }
    }
  }
  return count;
}

/**
 * Characters of tiles nobody walks: Mountain, River, Pass snow, and trees and Deposits (the
 * Abandoned mine stands over an iron Deposit).
 */
const BLOCKED = '^~*bmsciM'; // trees are walked through
/** Characters of walkable terrain, whatever stands on it. */
const WALKABLE_TERRAIN = '.:,_TbmscDRS';

/**
 * 4-connected reach from the entry over tiles not in `blocked` and off the Granary (2×2 at the
 * Camp), row-major bits.
 */
function reach(v: Valley, blocked: string): boolean[] {
  const n = v.rows.length;
  const granary = (t: Tile) =>
    t.x >= v.camp.x && t.x < v.camp.x + 2 && t.y >= v.camp.y && t.y < v.camp.y + 2;
  const open = (t: Tile) =>
    t.x >= 0 && t.y >= 0 && t.x < n && t.y < n && !blocked.includes(charAt(v, t)) && !granary(t);
  const reached = new Array<boolean>(n * n).fill(false);
  const entry = v.entry as Tile;
  const stack = [entry];
  reached[entry.y * n + entry.x] = true;
  while (stack.length > 0) {
    const t = stack.pop() as Tile;
    for (const s of sides(t)) {
      if (!open(s) || reached[s.y * n + s.x]) continue;
      reached[s.y * n + s.x] = true;
      stack.push(s);
    }
  }
  return reached;
}

/**
 * Some `size`×`size` square holding the Granary that is all buildable Meadow once its trees are
 * felled ('.' or 'T'), with the fewest trees on it of any such square; null when there's none.
 */
function clearSquare(v: Valley, size: number): { x: number; y: number; trees: number } | null {
  const n = v.rows.length;
  // Prefix sums over the map of `count(char)`.
  const sums = (count: (c: string) => number) => {
    const table = new Int32Array((n + 1) * (n + 1));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        table[(y + 1) * (n + 1) + x + 1] =
          count(charAt(v, { x, y })) +
          (table[y * (n + 1) + x + 1] as number) +
          (table[(y + 1) * (n + 1) + x] as number) -
          (table[y * (n + 1) + x] as number);
      }
    }
    return (x: number, y: number) =>
      (table[(y + size) * (n + 1) + x + size] as number) -
      (table[y * (n + 1) + x + size] as number) -
      (table[(y + size) * (n + 1) + x] as number) +
      (table[y * (n + 1) + x] as number);
  };
  const bad = sums((c) => (c === '.' || c === 'T' ? 0 : 1));
  const trees = sums((c) => (c === 'T' ? 1 : 0));
  let best: { x: number; y: number; trees: number } | null = null;
  for (let y = v.camp.y + 2 - size; y <= v.camp.y; y++) {
    for (let x = v.camp.x + 2 - size; x <= v.camp.x; x++) {
      if (x < 0 || y < 0 || x + size > n || y + size > n || bad(x, y) !== 0) continue;
      if (!best || trees(x, y) < best.trees) best = { x, y, trees: trees(x, y) };
    }
  }
  return best;
}

/** The ways `v` misses the Valley's rules, checked from its rows alone. */
function problems(v: Valley): string[] {
  const n = valley.size;
  const found: string[] = [];
  const expectThat = (ok: boolean, what: string) => {
    if (!ok) found.push(what);
  };
  const camp = v.camp;
  const near = (tiles: Tile[], within: number) => tiles.filter((t) => distance(t, camp) <= within);
  const side = new Set(v.sideValley);
  const inSide = (t: Tile) => side.has(t.y * n + t.x);

  expectThat(v.rows.length === n && v.rows.every((r) => r.length === n), 'size');
  const entry = v.entry as Tile;
  expectThat(
    entry.x === 0 || entry.y === 0 || entry.x === n - 1 || entry.y === n - 1,
    'entry on the edge',
  );
  expectThat(distance(entry, camp) <= valley.camp.entryTiles, 'Camp near the entry');

  // The shape: a rim, a river edge to edge, Fords, a Pass, Swamp and Rock.
  const edge = (t: Tile) => t.x === 0 || t.y === 0 || t.x === n - 1 || t.y === n - 1;
  const rimGaps = tilesOf(v, '.:,TbmscDRS_').filter(edge);
  expectThat(
    rimGaps.every((t) => distance(t, entry) <= 1),
    'the rim is open only at the entry',
  );
  const river = tilesOf(v, '~');
  const touches = (side: (t: Tile) => boolean) => river.some(side);
  expectThat(
    (touches((t) => t.x === 0) && touches((t) => t.x === n - 1)) ||
      (touches((t) => t.y === 0) && touches((t) => t.y === n - 1)),
    'the river runs edge to edge',
  );
  const fords = tilesOf(v, '_');
  const fordGroups = groups(fords);
  expectThat(
    fordGroups >= valley.river.fords.min && fordGroups <= valley.river.fords.max,
    `${fordGroups} Fords`,
  );
  expectThat(tilesOf(v, '*').length > 0 && v.pass.length > 0, 'a Pass');
  expectThat(tilesOf(v, ',').length > 0, 'Swamp');
  expectThat(tilesOf(v, ':s').length > 0, 'Rock');

  // Counts.
  expectThat(tilesOf(v, 's').length === valley.deposits.stone, 'stone Deposits');
  expectThat(tilesOf(v, 'c').length === valley.deposits.clay, 'clay Deposits');
  const iron = tilesOf(v, 'iM');
  expectThat(iron.length === valley.deposits.iron, 'iron Deposits');
  expectThat(
    iron.every((t) => sides(t).some(inSide)),
    'both iron Deposits in the Side valley',
  );
  const dens = tilesOf(v, 'D');
  expectThat(dens.length === valley.dens.count, 'Dens');
  expectThat(dens.filter(inSide).length >= valley.dens.sideValley, 'a Den in the Side valley');

  // Guarantees near the Camp.
  // The start area: buildable Meadow with trees scattered sparsely on it, round a bare yard.
  const square = clearSquare(v, g.clearTiles);
  expectThat(square !== null, 'a clear square at the Camp');
  const scattered = square?.trees ?? 0;
  expectThat(scattered > 0, 'no trees scattered on the clear square');
  expectThat(scattered * 100 <= g.clearTiles ** 2 * 10, `${scattered} trees on the clear square`);
  const yard = valley.camp.yardTiles;
  for (let y = camp.y - yard; y <= camp.y + yard; y++) {
    for (let x = camp.x - yard; x <= camp.x + yard; x++) {
      const c = charAt(v, { x, y });
      if ('TbmD'.includes(c)) found.push(`${c} in the Camp's yard at ${x},${y}`);
    }
  }
  const trees = near(tilesOf(v, 'T'), g.trees.withinTiles).length;
  expectThat(trees >= g.trees.count, `${trees} trees near the Camp`);
  const grounds = (v.huntingGrounds ?? []).map((ground) => ('tiles' in ground ? ground.tiles : []));
  expectThat(
    grounds.some((tiles) => near(tiles, g.trees.withinTiles).length > 0),
    'a Hunting ground near the Camp',
  );
  const forage = near(tilesOf(v, 'bm'), g.forage.withinTiles).length;
  expectThat(forage >= g.forage.count, `${forage} Forage patches near the Camp`);
  const riverbank = tilesOf(v, WALKABLE_TERRAIN).filter((t) =>
    sides(t).some((s) => charAt(v, s) === '~'),
  );
  expectThat(near(riverbank, g.riverbankTiles).length > 0, 'a Riverbank near the Camp');
  expectThat(near(fords, g.fordTiles).length > 0, 'a Ford near the Camp');
  expectThat(near(tilesOf(v, 's'), g.depositTiles).length > 0, 'stone near the Camp');
  expectThat(near(tilesOf(v, 'c'), g.depositTiles).length > 0, 'clay near the Camp');
  expectThat(near(dens, g.denTiles).length === 0, 'no Den near the Camp');

  // Reach: the main valley from the entry with the Pass shut; the Side valley only over it.
  const shut = reach(v, BLOCKED);
  const opened = reach(v, BLOCKED.replace('*', ''));
  const open = tilesOf(v, '.:,_DRS').filter(
    (t) => !(t.x >= camp.x && t.x < camp.x + 2 && t.y >= camp.y && t.y < camp.y + 2),
  );
  const main = open.filter((t) => !inSide(t));
  const sideOpen = open.filter(inSide);
  const cutOff = main.filter((t) => !shut[t.y * n + t.x]).length;
  expectThat(cutOff === 0, `${cutOff} main-valley tiles cut off`);
  expectThat(sideOpen.length > 0, 'a Side valley');
  expectThat(
    sideOpen.every((t) => opened[t.y * n + t.x] && !shut[t.y * n + t.x]),
    'the Side valley opens with the Pass',
  );
  // Forage patches and Deposits can be worked from an open tile beside them.
  const workable = tilesOf(v, 'bmsciM').filter((t) =>
    sides(t).some((s) => opened[s.y * n + s.x] === true),
  ).length;
  expectThat(workable === tilesOf(v, 'bmsciM').length, 'every patch and Deposit reachable');

  // Points of interest: counts, stamps apart and off the Camp, each where it belongs.
  const { pois } = valley;
  const ruins = tilesOf(v, 'R');
  const mines = tilesOf(v, 'M');
  const shrines = tilesOf(v, 'S');
  expectThat(ruins.length === pois.ruins, `${ruins.length} Ruins`);
  expectThat(mines.length === 1, `${mines.length} Abandoned mines`);
  expectThat(shrines.length === 1, `${shrines.length} Shrines`);
  const all = [...ruins, ...mines, ...shrines];
  for (const a of all) {
    expectThat(distance(a, camp) >= g.clearTiles + pois.clearTiles, 'a POI on the Camp');
    for (const b of all) {
      if (a !== b) expectThat(distance(a, b) >= pois.spacingTiles, 'POIs too close');
    }
  }
  for (const t of [...ruins, ...shrines]) {
    expectThat(!inSide(t) && shut[t.y * n + t.x] === true, 'a Ruins or Shrine out of reach');
    for (let dy = -pois.clearTiles; dy <= pois.clearTiles; dy++) {
      for (let dx = -pois.clearTiles; dx <= pois.clearTiles; dx++) {
        if (dx === 0 && dy === 0) continue;
        expectThat(charAt(v, { x: t.x + dx, y: t.y + dy }) === '.', 'a stamp not cleared');
      }
    }
  }
  for (const t of [...ruins, ...shrines]) {
    expectThat(distance(t, camp) >= pois.campTiles, 'a Ruins or Shrine near the Camp');
  }
  for (const t of mines) {
    expectThat(
      sides(t).some((s) => inSide(s) && charAt(v, s) === 'D'),
      'no Den at the mouth of the Abandoned mine',
    );
  }
  const ward = content.pois.shrine.wardTiles as number;
  const passIndex = v.pass[Math.floor(v.pass.length / 2)] as number;
  const passMiddle = { x: passIndex % n, y: Math.floor(passIndex / n) };
  for (const t of shrines) {
    expectThat(
      dens.every((d) => distance(d, t) > ward),
      'a Den by the Shrine',
    );
    expectThat(distance(t, passMiddle) < distance(entry, passMiddle), 'the Shrine off the way');
  }

  // Lone trees out in the open, away from the start area: outliers of the woods.
  const lone = tilesOf(v, 'T').filter(
    (t) =>
      distance(t, camp) > g.clearTiles &&
      [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) => (!dx && !dy) || charAt(v, { x: t.x + dx, y: t.y + dy }) !== 'T'),
      ),
  ).length;
  expectThat(lone >= 10, `${lone} lone trees`);

  // Hunting grounds: at most `maxTiles` each, apart, 1 Game per `treesPerGame` trees.
  const seen = new Set<number>();
  for (const ground of v.huntingGrounds ?? []) {
    if (!('tiles' in ground)) continue;
    expectThat(ground.tiles.length <= valley.huntingGrounds.maxTiles, `${ground.name} too big`);
    const treeCount = ground.tiles.filter((t) => charAt(v, t) === 'T').length;
    expectThat(
      ground.maxGame === Math.floor(treeCount / valley.huntingGrounds.treesPerGame),
      `${ground.name} max Game`,
    );
    expectThat(
      valley.huntingGrounds.names.some((name) => ground.name.startsWith(name)),
      `${ground.name} named from the list`,
    );
    for (const t of ground.tiles) {
      expectThat(!seen.has(t.y * n + t.x), 'grounds overlap');
      seen.add(t.y * n + t.x);
    }
  }
  const names = (v.huntingGrounds ?? []).map((ground) => ground.name);
  expectThat(new Set(names).size === names.length, 'ground names are unique');
  return found;
}

describe("a wood's tree density", () => {
  const forest = valley.forest;
  const at = (depth: number) => woodTreePercent(depth, forest, false);

  it('is full deep in a wood and thins to its edge', () => {
    expect(at(100)).toBe(forest.treePercent);
    expect(at(forest.rampPercent)).toBe(forest.treePercent);
    expect(at(0)).toBe(forest.edgeTreePercent);
    expect(at(0)).toBeLessThan(forest.treePercent);
  });

  it('falls off past the edge to lone outliers, never to nothing', () => {
    expect(at(-1)).toBeLessThan(at(0));
    expect(at(-100)).toBe(forest.outlierPercent);
    expect(forest.outlierPercent).toBeGreaterThan(0);
  });

  it('never rises as the depth falls', () => {
    for (let depth = -100; depth < 100; depth++) {
      expect(at(depth)).toBeLessThanOrEqual(at(depth + 1));
    }
  });

  it('opens to a clearing wherever the clearing noise says so', () => {
    expect(woodTreePercent(100, forest, true)).toBe(forest.clearing.treePercent);
    expect(forest.clearing.treePercent).toBeLessThan(forest.edgeTreePercent);
  });
});

describe('the generated Valley', () => {
  it('is the same Valley for the same seed, and another for another seed', () => {
    const a = generateValley(7, content);
    expect(JSON.stringify(generateValley(7, content))).toBe(JSON.stringify(a));
    expect(JSON.stringify(generateValley(8, content))).not.toBe(JSON.stringify(a));
  });

  // About 3 s alone, longer while the whole suite runs alongside: past the default 5 s timeout.
  it('keeps its guarantees and counts across 100 seeds', { timeout: 20_000 }, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      const found = problems(generateValley(seed, content));
      if (found.length > 0) failures.push(`seed ${seed}: ${found.join(', ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('starts a new game: the Camp, Hunting grounds, and every walkable tile reachable', () => {
    const v = generateValley(11, content);
    const state = createInitialState(11, v, content, 100, true);
    const { components } = state;
    expect(state.map.width).toBe(valley.size);
    expect(state.map.entry).toEqual(v.entry);
    expect(idsOf(components.villager)).toHaveLength(valley.camp.carriers);
    expect(idsOf(components.hero)).toHaveLength(1);
    expect(Object.values(components.building).map((b) => b.type)).toEqual(['granary']);
    expect(idsOf(components.den)).toHaveLength(valley.dens.count);
    const kinds = Object.values(components.poi).map((p) => p.kind);
    expect(kinds.filter((k) => k === 'ruins')).toHaveLength(valley.pois.ruins);
    expect(kinds.filter((k) => k === 'abandoned_mine')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'shrine')).toHaveLength(1);

    // Every ground stands full of Game, on its trees.
    const grounds = idsOf(components.huntingGround).map((id) => components.huntingGround[id]);
    expect(grounds.length).toBeGreaterThan(0);
    for (const ground of grounds) {
      if (!ground) continue;
      expect(ground.game).toBe(ground.maxGame);
      expect(standingTrees(state, content, ground)).toBe(ground.startTrees);
      expect(groundTiles(state, ground).length).toBeLessThanOrEqual(valley.huntingGrounds.maxTiles);
    }
    // A Riverbank the sim agrees on near the Camp.
    const bank = state.map.terrain.some(
      (_, i) =>
        distance(tileAt(state.map, i), v.camp) <= g.riverbankTiles &&
        isRiverbank(state, content, tileAt(state.map, i)),
    );
    expect(bank).toBe(true);

    // The sim's own regions: the main valley in the entry's, the Side valley only for the Hero.
    const grid = (blocked: Uint8Array) => ({
      width: state.map.width,
      height: state.map.height,
      blocked,
      speedPercent: new Uint16Array(blocked.length).fill(100),
      maxSpeedPercent: 100,
    });
    const blocked = blockedGrid(state, content);
    const walk = regions(grid(blocked));
    const hero = regions(grid(heroBlockedGrid(state, content)));
    const entry = (v.entry as Tile).y * valley.size + (v.entry as Tile).x;
    const side = new Set(v.sideValley);
    // Trees are walked through, but the generator joins only the open ground: a tree hemmed in
    // by the river and Forage patches may stand out of reach, and nobody needs to get to it.
    const trees = objectSpeedGrid(state, content);
    for (let i = 0; i < blocked.length; i++) {
      if (blocked[i] || trees[i]) continue;
      if (side.has(i)) {
        expect(walk[i]).not.toBe(walk[entry]);
        expect(hero[i]).toBe(hero[entry]);
      } else {
        expect(walk[i]).toBe(walk[entry]);
      }
    }
  });
});
