// Map-size benchmark: how the sim's tick, its per-tick deep copy, the save and the worker's
// snapshot scale with the map. Numbers for the map-size gate; it makes no decision itself.
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { gzipSync } from 'node:zlib';
import type { Content } from '@candlemarch/content';
import {
  cloneState,
  createInitialState,
  type GameState,
  idsOf,
  serialize,
  step,
  stepInPlace,
} from '@candlemarch/sim';
import { syntheticMap } from './syntheticMap';

export interface BenchOptions {
  /** Ticks run before measuring, so villagers are at work. */
  warmupTicks: number;
  /** Ticks timed one by one with `step`, as the worker runs them; a day takes in Dusk, night and Dawn. */
  measuredTicks: number;
  /** Ticks run both with `step` and with `stepInPlace`, from the same state, to price the copy. */
  pairedTicks: number;
  /** Repeats for the copy and the snapshot. */
  reps: number;
}

export interface Timing {
  mean: number;
  p95: number;
  max: number;
}

export interface MapSizeResult {
  size: number;
  entities: number;
  trees: number;
  /** Berry bushes and mushroom patches. */
  patches: number;
  villagers: number;
  buildings: number;
  roadTiles: number;
  /** `createInitialState`, ms. */
  createMs: number;
  /** One tick with `step`, the copy included, over `measuredTicks`, ms. */
  tickMs: Timing;
  /** Mean ms a tick over `pairedTicks` ticks run with `step` (the copy plus the tick)... */
  stepMs: number;
  /** ...and over the same ticks run with `stepInPlace`. */
  inPlaceMs: number;
  /** `cloneState`, the JSON deep copy `step` makes, timed on its own, ms. */
  copyMs: number;
  /** `serialize(state)`: the save, and roughly what a snapshot carries, in bytes. */
  stateBytes: number;
  gzipBytes: number;
  /** A worker posting the snapshot message to the main thread until it's received, ms. */
  transferMs: Timing;
  /** `structuredClone` of the snapshot message on one thread, ms: the copying part of a post. */
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
export async function benchMapSize(
  size: number,
  content: Content,
  options: BenchOptions,
): Promise<MapSizeResult> {
  const map = syntheticMap(size);
  const createStart = performance.now();
  const state: GameState = createInitialState(1, map, content);
  const createMs = performance.now() - createStart;

  for (let i = 0; i < options.warmupTicks; i++) stepInPlace(state, [], content);
  let current = state;
  const ticks: number[] = [];
  for (let i = 0; i < options.measuredTicks; i++) {
    const start = performance.now();
    current = step(current, [], content);
    ticks.push(performance.now() - start);
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
  // What the sim worker posts after each batch of ticks: `prevPositions` comes from the previous
  // tick's state, a separate object that is cloned on its own.
  const snapshot = {
    type: 'snapshot',
    state: current,
    prevPositions: structuredClone(components.position),
  };
  const structuredCloneMs = meanMs(options.reps, () => structuredClone(snapshot));

  return {
    size,
    entities: current.nextId - 1,
    trees: Object.values(components.mapObject).filter((o) => o.type === 'tree').length,
    patches: Object.values(components.mapObject).filter((o) => o.type !== 'tree').length,
    villagers: idsOf(components.villager).length,
    buildings: idsOf(components.building).length,
    roadTiles: Object.keys(current.map.roads).length,
    createMs,
    tickMs: timing(ticks),
    stepMs,
    inPlaceMs,
    copyMs,
    stateBytes: Buffer.byteLength(json),
    gzipBytes: gzipSync(json).length,
    transferMs: timing(await transferTimes(snapshot, options.reps)),
    structuredCloneMs,
  };
}

const ms = (n: number) => n.toFixed(2);
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/** Markdown tables of `results`, one row per size. */
export function formatResults(results: MapSizeResult[]): string {
  const table = (header: string[], rows: string[][]) =>
    [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
  const tiles = (r: MapSizeResult) => `${r.size}²`;
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
        '`step` mean (ms)',
        '`step` p95',
        '`step` max',
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
      [
        'Map',
        'State (JSON)',
        'Gzipped',
        'Snapshot transfer mean (ms)',
        'Transfer p95',
        'Transfer max',
        '`structuredClone` (ms)',
      ],
      results.map((r) => [
        tiles(r),
        kb(r.stateBytes),
        kb(r.gzipBytes),
        ms(r.transferMs.mean),
        ms(r.transferMs.p95),
        ms(r.transferMs.max),
        ms(r.structuredCloneMs),
      ]),
    ),
  ].join('\n\n');
}
