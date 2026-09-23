// Hosts the simulation off the main thread. It only steps when told to; the main thread owns the clock.
import { content } from '@candlemarch/content';
import {
  createInitialState,
  deserialize,
  type GameState,
  meadowMap,
  serialize,
  step,
} from '@candlemarch/sim';
import type { FromWorker, ToWorker } from '../protocol';

let state: GameState | null = null;

function send(message: FromWorker): void {
  postMessage(message);
}

function sendSnapshot(current: GameState, previous: GameState): void {
  send({ type: 'snapshot', state: current, prevPositions: previous.components.position });
}

function handle(message: ToWorker): void {
  switch (message.type) {
    case 'newGame':
      state = createInitialState(message.seed, meadowMap, content);
      sendSnapshot(state, state);
      return;
    case 'load':
      state = deserialize(message.json);
      sendSnapshot(state, state);
      return;
    case 'advance': {
      if (!state) return;
      let previous = state;
      for (let i = 0; i < message.ticks; i++) {
        previous = state;
        state = step(state, i === 0 ? message.commands : [], content);
      }
      sendSnapshot(state, previous);
      return;
    }
    case 'save':
      if (state) send({ type: 'saved', json: serialize(state) });
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
