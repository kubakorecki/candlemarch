// Dev-only: start a new game on any map, and turn monsters or Fog on or off, for playtests.
import { DEFAULT_MAP, DEFAULT_MONSTER_RATE, type MapName, maps } from '@candlemarch/sim';
import { useState, useSyncExternalStore } from 'react';
import type { Game } from '../game/Game';
import { SectionHead } from './kit';

const MAP_NAMES = Object.keys(maps) as MapName[];

export function NewGamePanel({ game }: { game: Game }) {
  const [map, setMap] = useState<MapName>(DEFAULT_MAP);
  const [monsters, setMonsters] = useState(true);
  const hud = useSyncExternalStore(game.subscribe, game.getHud);
  const monstersNow = hud.monsterRate > 0;

  return (
    <div className="hud">
      <section className="panel new-game" aria-label="New game (dev)">
        <SectionHead title="New game" aside="dev" />
        <label className="fact">
          <span>Map</span>
          <select value={map} onChange={(e) => setMap(e.target.value as MapName)}>
            {MAP_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="fact">
          <span>Monsters</span>
          <input
            type="checkbox"
            checked={monsters}
            onChange={(e) => setMonsters(e.target.checked)}
          />
        </label>
        <button
          type="button"
          className="btn primary"
          onClick={() => game.newGame(map, monsters ? DEFAULT_MONSTER_RATE : 0)}
        >
          Start
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => game.setMonsterRate(monstersNow ? 0 : DEFAULT_MONSTER_RATE)}
        >
          {monstersNow ? 'Monsters off now' : 'Monsters on now'}
        </button>
        <button type="button" className="btn" onClick={() => game.setFog(!hud.fog)}>
          {hud.fog ? 'Fog off now' : 'Fog on now'}
        </button>
      </section>
    </div>
  );
}
