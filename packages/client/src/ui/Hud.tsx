import { useSyncExternalStore } from 'react';
import { SPEEDS, type Speed } from '../game/clock';
import { formatTime, type Game } from '../game/Game';
import { MODEL_LABELS } from './modelLabels';

const SPEED_LABELS: Record<Speed, string> = { 0: '⏸', 1: '1×', 2: '2×', 3: '3×' };

export function Hud({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);

  return (
    <div className="hud">
      <div className="panel readout">
        <div className="title">Candlemarch</div>
        <div className="row">
          <span className="muted">Time</span>
          <span>{formatTime(hud.seconds)}</span>
        </div>
        <div className="row">
          <span className="muted">Logistics</span>
          <span>{hud.model ? MODEL_LABELS[hud.model] : '—'}</span>
        </div>
        <div className="row">
          <span className="muted">Woodcutter's hut</span>
          <span>
            {hud.hutLogs}/{hud.hutCapacity} logs
          </span>
        </div>
      </div>

      {hud.message && <div className="panel message">{hud.message}</div>}

      <div className="panel toolbar">
        <button
          type="button"
          className={hud.buildMode === 'hut' ? 'active' : ''}
          disabled={!hud.ready}
          onClick={() => (hud.buildMode === 'hut' ? game.cancelBuild() : game.startBuild('hut'))}
          title="Build a hut (B)"
        >
          Build hut
        </button>
        <span className="divider" />
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={hud.speed === speed ? 'active' : ''}
            onClick={() => game.setSpeed(speed)}
            title={speed === 0 ? 'Pause (Space)' : `Speed ${speed}× (${speed})`}
          >
            {SPEED_LABELS[speed]}
          </button>
        ))}
        <span className="divider" />
        <button type="button" disabled={!hud.ready} onClick={() => game.save()}>
          Save
        </button>
        <button type="button" disabled={!hud.ready} onClick={() => game.load()}>
          Load
        </button>
      </div>
    </div>
  );
}
