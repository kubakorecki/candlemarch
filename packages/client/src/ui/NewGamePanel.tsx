// Dev-only: start a new game on any map, for playtests.
import { DEFAULT_MAP, type MapName, maps } from '@candlemarch/sim';
import { useState } from 'react';
import type { Game } from '../game/Game';

const MAP_NAMES = Object.keys(maps) as MapName[];

export function NewGamePanel({ game }: { game: Game }) {
  const [map, setMap] = useState<MapName>(DEFAULT_MAP);

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
      <button type="button" onClick={() => game.newGame(map)}>
        Start
      </button>
    </div>
  );
}
