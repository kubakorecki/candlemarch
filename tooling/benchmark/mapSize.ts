// Map-size benchmark: how the sim's tick, `step`'s per-tick deep copy, the save and the worker's
// split snapshot (moving part every frame, static layers when they change) scale with the map.
// Numbers for the map-size gate and ADR-0004's budget; it makes no decision itself.
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { gzipSync } from 'node:zlib';
import type { Content } from '@candlemarch/content';
import {
  cloneState,
  createInitialState,
  type GameState,
  generateValley,
  idsOf,
  joinSnapshot,
  type MapDef,
  movingPart,
  sentStaticLayers,
  serialize,
  staticLayers,
  staticPatch,
  step,
  stepInPlace,
} from '@candlemarch/sim';
import { syntheticMap } from './syntheticMap';

export interface BenchOptions {
  /** Ticks run before measuring, so villagers are at work. */
  warmupTicks: number;
  /**
   * Ticks timed one by one with `stepInPlace`, as the worker runs them; a day takes in Dusk,
   * night and Dawn.
   */
  measuredTicks: number;
  /** Ticks run both with `step` and with `stepInPlace`, from the same state, to price the copy. */
  pairedTicks: number;
  /** Repeats for the copy and the snapshot. */
  reps: number;
  /** Plays the map with Fog on. */
  fog: boolean;
}

export interface Timing {
  mean: number;
  p95: number;
  max: number;
}

export interface MapSizeResult {
  /** The map's row label: `128²` for a synthetic map, `valley 1 (128²)` for a generated one. */
  label: string;
  entities: number;
  trees: number;
  /** Berry bushes and mushroom patches. */
  patches: number;
  villagers: number;
  buildings: number;
  roadTiles: number;
  /** `createInitialState`, ms. */
  createMs: number;
  /** One tick with `stepInPlace`, as the worker runs it, over `measuredTicks`, ms. */
  tickMs: Timing;
  measuredTicks: number;
  /** Of `measuredTicks`, how many changed a static layer (`staticVersion` moved). */
  staticTicks: number;
  /** Snapshots that carried a static patch, of those a worker would post at 3× (3 ticks each). */
  layerSnapshots: { sent: number; of: number };
  /** Those patches' JSON size, bytes (mean, max), and `staticPatch` in the worker, mean ms. */
  patchBytes: { mean: number; max: number };
  patchMs: number;
  /** Mean ms a tick over `pairedTicks` ticks run with `step` (the copy plus the tick)... */
  stepMs: number;
  /** ...and over the same ticks run with `stepInPlace`. */
  inPlaceMs: number;
  /** `cloneState`, the JSON deep copy `step` makes, timed on its own, ms. */
  copyMs: number;
  /** `serialize(state)`: the save, and what a whole snapshot would carry, in bytes. */
  stateBytes: number;
  gzipBytes: number;
  /** The whole state posted as one snapshot, as before the split. */
  whole: PostCost;
  /** The snapshot's moving part, posted every frame. */
  moving: PostCost;
  /** The static layers, posted only when they changed. */
  layers: PostCost;
  /** `movingPart(state)` in the worker, ms. */
  splitMs: number;
  /** `joinSnapshot` on the main thread, ms. */
  joinMs: number;
}

/** What posting one message from the worker to the main thread costs. */
export interface PostCost {
  /** Its JSON, bytes: roughly what the structured clone carries. */
  bytes: number;
  /** A worker posting it to the main thread until it's received, ms. */
  transferMs: Timing;
  /** `structuredClone` of it on one thread, ms: the copying part of a post. */
  structuredCloneMs: number;
}

function timing(samples: number[]): Timing {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, s) => sum + s, 0) / samples.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  return { mean, p95, max: sorted[sorted.length - 1] ?? 0 };
}

/** Mean ms of `reps` calls to `run`. */
function meanMs(reps: number, run: () => void): number {
  const start = performance.now();
  for (let i = 0; i < reps; i++) run();
  return (performance.now() - start) / reps;
}

/**
 * Receives a snapshot once, then posts it back each time it's asked, stamped with the wall-clock
 * time (`timeOrigin + now`, comparable across threads) it was posted at.
 */
const WORKER_SOURCE = `
const { parentPort } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
parentPort.once('message', (snapshot) => {
  const send = () =>
    parentPort.postMessage({ sentAt: performance.timeOrigin + performance.now(), snapshot });
  parentPort.on('message', send);
  send();
});
`;

/**
 * Posts `snapshot` from a worker thread to this one `reps` times, one at a time, as the sim
 * worker posts a snapshot each frame. Each sample runs from the worker's post to this thread's
 * message handler, so it includes serializing, handing over and deserializing.
 */
async function transferTimes(snapshot: unknown, reps: number): Promise<number[]> {
  const worker = new Worker(WORKER_SOURCE, { eval: true });
  const samples: number[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', (message: { sentAt: number }) => {
        samples.push(performance.timeOrigin + performance.now() - message.sentAt);
        if (samples.length < reps) worker.postMessage('next');
        else resolve();
      });
      worker.postMessage(snapshot);
    });
  } finally {
    await worker.terminate();
  }
  return samples;
}

/** Builds the synthetic `size` map, runs it, and measures it. */
export function benchMapSize(
  size: number,
  content: Content,
  options: BenchOptions,
): Promise<MapSizeResult> {
  return benchMap(`${size}²`, syntheticMap(size), content, options);
}

/**
 * Generates the Valley for `seed`, runs it as a new game starts (the Starting Camp alone), and
 * measures it.
 */
export function benchValley(
  seed: number,
  content: Content,
  options: BenchOptions,
): Promise<MapSizeResult> {
  const size = content.valley.size;
  return benchMap(`valley ${seed} (${size}²)`, generateValley(seed, content), content, options);
}

/** Runs `map` and measures it, under the row label `label`. */
async function benchMap(
  label: string,
  map: MapDef,
  content: Content,
  options: BenchOptions,
): Promise<MapSizeResult> {
  const createStart = performance.now();
  const state: GameState = createInitialState(1, map, content, 100, options.fog);
  const createMs = performance.now() - createStart;

  for (let i = 0; i < options.warmupTicks; i++) stepInPlace(state, [], content);
  const current = state;
  const ticks: number[] = [];
  let staticTicks = 0;
  const layerSnapshots = { sent: 0, of: 0 };
  const sent = sentStaticLayers(current);
  const patchSizes: number[] = [];
  let patchTotalMs = 0;
  for (let i = 0; i < options.measuredTicks; i++) {
    const before = current.staticVersion;
    const start = performance.now();
    stepInPlace(current, [], content);
    ticks.push(performance.now() - start);
    if (current.staticVersion !== before) staticTicks += 1;
    if (i % 3 === 2) {
      layerSnapshots.of += 1;
      if (current.staticVersion !== sent.version) {
        layerSnapshots.sent += 1;
        const patchStart = performance.now();
        const patch = staticPatch(sent, current);
        patchTotalMs += performance.now() - patchStart;
        patchSizes.push(Buffer.byteLength(JSON.stringify(patch)));
      }
    }
  }

  const { components } = current;
  const copyMs = meanMs(options.reps, () => cloneState(current));
  // The same ticks both ways (the sim is deterministic), so only the copy differs.
  let stepped = cloneState(current);
  const stepMs = meanMs(options.pairedTicks, () => {
    stepped = step(stepped, [], content);
  });
  const inPlace = cloneState(current);
  const inPlaceMs = meanMs(options.pairedTicks, () => stepInPlace(inPlace, [], content));

  const json = serialize(current);
  // What the sim worker posts after each batch of ticks: `prevPositions` is copied before the
  // batch's last tick. The whole state is what it posted before the split.
  const prevPositions = structuredClone(components.position);
  const moving = {
    type: 'snapshot',
    moving: movingPart(current),
    layers: null,
    patch: null,
    prevPositions,
  };
  const layers = staticLayers(current);
  const splitMs = meanMs(options.reps, () => movingPart(current));
  const joinMs = meanMs(options.reps, () => joinSnapshot(moving.moving, layers));
  const post = async (message: unknown): Promise<PostCost> => ({
    bytes: Buffer.byteLength(JSON.stringify(message)),
    transferMs: timing(await transferTimes(message, options.reps)),
    structuredCloneMs: meanMs(options.reps, () => structuredClone(message)),
  });

  return {
    label,
    entities: current.nextId - 1,
    trees: Object.values(components.mapObject).filter((o) => o.type === 'tree').length,
    patches: Object.values(components.mapObject).filter((o) => o.type !== 'tree').length,
    villagers: idsOf(components.villager).length,
    buildings: idsOf(components.building).length,
    roadTiles: Object.keys(current.map.roads).length,
    createMs,
    tickMs: timing(ticks),
    measuredTicks: options.measuredTicks,
    staticTicks,
    layerSnapshots,
    patchBytes: {
      mean: patchSizes.reduce((sum, b) => sum + b, 0) / Math.max(1, patchSizes.length),
      max: Math.max(0, ...patchSizes),
    },
    patchMs: patchTotalMs / Math.max(1, patchSizes.length),
    stepMs,
    inPlaceMs,
    copyMs,
    stateBytes: Buffer.byteLength(json),
    gzipBytes: gzipSync(json).length,
    whole: await post({ type: 'snapshot', state: current, prevPositions }),
    moving: await post(moving),
    layers: await post({
      type: 'snapshot',
      moving: null,
      layers,
      patch: null,
      prevPositions: null,
    }),
    splitMs,
    joinMs,
  };
}

const ms = (n: number) => n.toFixed(2);
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/** Markdown tables of `results`, one row per map. */
export function formatResults(results: MapSizeResult[]): string {
  const table = (header: string[], rows: string[][]) =>
    [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
  const tiles = (r: MapSizeResult) => r.label;
  return [
    table(
      [
        'Map',
        'Entities',
        'Trees',
        'Forage patches',
        'Villagers',
        'Buildings',
        'Road tiles',
        'Create (ms)',
      ],
      results.map((r) => [
        tiles(r),
        String(r.entities),
        String(r.trees),
        String(r.patches),
        String(r.villagers),
        String(r.buildings),
        String(r.roadTiles),
        ms(r.createMs),
      ]),
    ),
    table(
      [
        'Map',
        'Tick mean (ms)',
        'Tick p95',
        'Tick max',
        'Copy alone (ms)',
        'Paired `step` (ms)',
        'Paired `stepInPlace` (ms)',
        'Copy share (paired)',
      ],
      results.map((r) => [
        tiles(r),
        ms(r.tickMs.mean),
        ms(r.tickMs.p95),
        ms(r.tickMs.max),
        ms(r.copyMs),
        ms(r.stepMs),
        ms(r.inPlaceMs),
        `${Math.round((100 * (r.stepMs - r.inPlaceMs)) / r.stepMs)}%`,
      ]),
    ),
    table(
      ['Map', 'State (JSON)', 'Gzipped', 'Split (ms)', 'Join (ms)', 'Static-layer changes'],
      results.map((r) => [
        tiles(r),
        kb(r.stateBytes),
        kb(r.gzipBytes),
        ms(r.splitMs),
        ms(r.joinMs),
        `${r.staticTicks} of ${r.measuredTicks} ticks; ` +
          `a patch in ${r.layerSnapshots.sent} of ${r.layerSnapshots.of} snapshots at 3×, ` +
          `${Math.round(r.patchBytes.mean)} B mean, ${r.patchBytes.max} B max, ` +
          `${ms(r.patchMs)} ms to work out`,
      ]),
    ),
    table(
      [
        'Map',
        'Snapshot part',
        'Size (JSON)',
        'Transfer mean (ms)',
        'Transfer p95',
        'Transfer max',
        '`structuredClone` (ms)',
      ],
      results.flatMap((r) =>
        (
          [
            ['whole state (before)', r.whole],
            ['moving part', r.moving],
            ['static layers (first snapshot)', r.layers],
          ] as const
        ).map(([part, cost]) => [
          tiles(r),
          part,
          kb(cost.bytes),
          ms(cost.transferMs.mean),
          ms(cost.transferMs.p95),
          ms(cost.transferMs.max),
          ms(cost.structuredCloneMs),
        ]),
      ),
    ),
  ].join('\n\n');
}
