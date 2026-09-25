// Dev-only: start a new game on any map with either logistics model, for the playtest.
import {
  DEFAULT_LOGISTICS_MODEL,
  DEFAULT_MAP,
  type LogisticsModelId,
  type MapName,
  maps,
} from '@candlemarch/sim';
import { useState } from 'react';
import type { Game } from '../game/Game';
import { MODEL_LABELS } from './modelLabels';

const MAP_NAMES = Object.keys(maps) as MapName[];
const MODEL_IDS = Object.keys(MODEL_LABELS) as LogisticsModelId[];

export function NewGamePanel({ game }: { game: Game }) {
  const [map, setMap] = useState<MapName>(DEFAULT_MAP);
  const [model, setModel] = useState<LogisticsModelId>(DEFAULT_LOGISTICS_MODEL);

  return (
    <div className="panel new-game">
      <div className="title">New game</div>
      <label className="row">
        <span className="muted">Map</span>
        <select value={map} onChange={(e) => setMap(e.target.value as MapName)}>
          {MAP_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="row">
        <span className="muted">Logistics</span>
        <select value={model} onChange={(e) => setModel(e.target.value as LogisticsModelId)}>
          {MODEL_IDS.map((id) => (
            <option key={id} value={id}>
              {MODEL_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => game.newGame(map, model)}>
        Start
      </button>
    </div>
  );
}
