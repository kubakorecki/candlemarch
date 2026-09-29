// Hosts the simulation off the main thread. It only steps when told to; the main thread owns the
// clock. It owns its state and steps it in place (`stepInPlace`), with no copy per tick.
import { content } from '@candlemarch/content';
import {
  createInitialState,
  deserialize,
  type EntityId,
  type GameState,
  maps,
  movingPart,
  type Point,
  serialize,
  staticLayers,
  stepInPlace,
} from '@candlemarch/sim';
import { isAutosaveTick, type SaveSlot } from '../game/autosave';
import type { FromWorker, ToWorker } from '../protocol';

let state: GameState | null = null;
/** The `staticVersion` of the static layers last sent, or null when the game's first is due. */
let sentStaticVersion: number | null = null;

function send(message: FromWorker): void {
  postMessage(message);
}

/** Posts `current` split: the static layers go along only when they changed since last sent. */
function sendSnapshot(current: GameState, prevPositions: Record<EntityId, Point>): void {
  const changed = current.staticVersion !== sentStaticVersion;
  sentStaticVersion = current.staticVersion;
  send({
    type: 'snapshot',
    moving: movingPart(current),
    layers: changed ? staticLayers(current) : null,
    prevPositions,
  });
}

/** A copy of every position, taken before a tick moves them in place. */
function copyPositions(positions: Record<EntityId, Point>): Record<EntityId, Point> {
  const copy: Record<EntityId, Point> = {};
  for (const key in positions) {
    const p = positions[key] as Point;
    copy[key] = { x: p.x, y: p.y };
  }
  return copy;
}

function save(current: GameState, slot: SaveSlot): void {
  send({ type: 'saved', slot, tick: current.tick, json: serialize(current) });
}

function start(next: GameState): void {
  state = next;
  sentStaticVersion = null;
  sendSnapshot(state, state.components.position);
}

function handle(message: ToWorker): void {
  switch (message.type) {
    case 'newGame':
      start(createInitialState(message.seed, maps[message.map], content, message.monsterRate));
      return;
    case 'load':
      start(deserialize(message.json, content));
      return;
    case 'advance': {
      if (!state) return;
      let prevPositions = state.components.position;
      for (let i = 0; i < message.ticks; i++) {
        if (i === message.ticks - 1) prevPositions = copyPositions(state.components.position);
        stepInPlace(state, i === 0 ? message.commands : [], content);
        if (isAutosaveTick(state.tick, content)) save(state, 'autosave');
      }
      sendSnapshot(state, prevPositions);
      return;
    }
    case 'save':
      if (state) save(state, 'manual');
      return;
  }
}

addEventListener('message', (event: MessageEvent<ToWorker>) => {
  try {
    handle(event.data);
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
