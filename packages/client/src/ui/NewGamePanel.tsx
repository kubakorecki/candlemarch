// Dev-only: start a new game on any map, and turn monsters on or off, for playtests.
import { DEFAULT_MAP, DEFAULT_MONSTER_RATE, type MapName, maps } from '@candlemarch/sim';
import { useState, useSyncExternalStore } from 'react';
import type { Game } from '../game/Game';

const MAP_NAMES = Object.keys(maps) as MapName[];

export function NewGamePanel({ game }: { game: Game }) {
  const [map, setMap] = useState<MapName>(DEFAULT_MAP);
  const [monsters, setMonsters] = useState(true);
  const hud = useSyncExternalStore(game.subscribe, game.getHud);
  const monstersNow = hud.monsterRate > 0;

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
        <span className="muted">Monsters</span>
        <input type="checkbox" checked={monsters} onChange={(e) => setMonsters(e.target.checked)} />
      </label>
      <button type="button" onClick={() => game.newGame(map, monsters ? DEFAULT_MONSTER_RATE : 0)}>
        Start
      </button>
      <button
        type="button"
        onClick={() => game.setMonsterRate(monstersNow ? 0 : DEFAULT_MONSTER_RATE)}
      >
        {monstersNow ? 'Monsters off now' : 'Monsters on now'}
      </button>
    </div>
  );
}
