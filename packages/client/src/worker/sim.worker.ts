// Hosts the simulation off the main thread. It only steps when told to; the main thread owns the clock.
import { content } from '@candlemarch/content';
import {
  createInitialState,
  deserialize,
  type GameState,
  maps,
  serialize,
  step,
} from '@candlemarch/sim';
import { isAutosaveTick, type SaveSlot } from '../game/autosave';
import type { FromWorker, ToWorker } from '../protocol';

let state: GameState | null = null;

function send(message: FromWorker): void {
  postMessage(message);
}

function sendSnapshot(current: GameState, previous: GameState): void {
  send({ type: 'snapshot', state: current, prevPositions: previous.components.position });
}

function save(current: GameState, slot: SaveSlot): void {
  send({ type: 'saved', slot, tick: current.tick, json: serialize(current) });
}

function handle(message: ToWorker): void {
  switch (message.type) {
    case 'newGame':
      state = createInitialState(message.seed, maps[message.map], content, message.monsterRate);
      sendSnapshot(state, state);
      return;
    case 'load':
      state = deserialize(message.json, content);
      sendSnapshot(state, state);
      return;
    case 'advance': {
      if (!state) return;
      let previous = state;
      for (let i = 0; i < message.ticks; i++) {
        previous = state;
        state = step(state, i === 0 ? message.commands : [], content);
        if (isAutosaveTick(state.tick, content)) save(state, 'autosave');
      }
      sendSnapshot(state, previous);
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
