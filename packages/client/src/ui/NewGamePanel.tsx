// Dev-only: start a new game on a generated Valley from a seed or on any hand-made map, and turn
// monsters or Fog on or off, for playtests.
import {
  DEFAULT_MONSTER_RATE,
  type MapName,
  maps,
  type NewGameMap,
  type NewGameSetup,
} from '@candlemarch/sim';
import { useState, useSyncExternalStore } from 'react';
import type { Game } from '../game/Game';
import { SectionHead } from './kit';

const MAP_NAMES = Object.keys(maps) as MapName[];

/** Hand-made maps start from this seed, as they always have. */
const HAND_MADE_SEED = 1;

/** Largest seed the field takes (the sim reads a seed as a uint32). */
const MAX_SEED = 0xffffffff;

/** A seed from the wall clock: outside the sim, so the sim stays deterministic. */
function clockSeed(): number {
  return Date.now() % 1_000_000;
}

/** The seed typed into the field, or null when it isn't a whole number from 0 to `MAX_SEED`. */
function parseSeed(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const seed = Number(text);
  return seed <= MAX_SEED ? seed : null;
}

export function NewGamePanel({ game }: { game: Game }) {
  const [map, setMap] = useState<NewGameMap>('valley');
  const [seedText, setSeedText] = useState('1');
  const [monsters, setMonsters] = useState(true);
  const [fog, setFog] = useState(true);
  const hud = useSyncExternalStore(game.subscribe, game.getHud);
  const monstersNow = hud.monsterRate > 0;
  const valley = map === 'valley';
  const seed = valley ? parseSeed(seedText) : HAND_MADE_SEED;

  const pickMap = (next: NewGameMap) => {
    setMap(next);
    setFog(next === 'valley'); // Fog on for a generated Valley, off for a hand-made map
  };

  const start = () => {
    if (seed === null) return;
    const setup: NewGameSetup = {
      map,
      seed,
      monsterRate: monsters ? DEFAULT_MONSTER_RATE : 0,
      fog,
    };
    game.newGame(setup);
  };

  return (
    <div className="hud">
      <section className="panel new-game" aria-label="New game (dev)">
        <SectionHead title="New game" aside="dev" />
        <label className="fact">
          <span>Map</span>
          <select value={map} onChange={(e) => pickMap(e.target.value as NewGameMap)}>
            <option value="valley">Generated valley</option>
            <optgroup label="Hand-made">
              {MAP_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {valley && (
          <div className="fact seed">
            <label htmlFor="new-game-seed">Seed</label>
            <input
              id="new-game-seed"
              type="text"
              inputMode="numeric"
              value={seedText}
              aria-invalid={seed === null}
              onChange={(e) => setSeedText(e.target.value)}
            />
            <button
              type="button"
              className="btn-small"
              onClick={() => setSeedText(String(clockSeed()))}
            >
              Random
            </button>
          </div>
        )}
        <label className="fact">
          <span>Monsters</span>
          <input
            type="checkbox"
            checked={monsters}
            onChange={(e) => setMonsters(e.target.checked)}
          />
        </label>
        <label className="fact">
          <span>Fog</span>
          <input type="checkbox" checked={fog} onChange={(e) => setFog(e.target.checked)} />
        </label>
        <button type="button" className="btn primary" disabled={seed === null} onClick={start}>
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
