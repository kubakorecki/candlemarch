import { content, type ResourceId } from '@candlemarch/content';
import { STOCKPILE_PRIORITIES, type StockpilePriority } from '@candlemarch/sim';
import { useSyncExternalStore } from 'react';
import { SPEEDS, type Speed } from '../game/clock';
import { formatTime, type Game, TOOLS } from '../game/Game';

const PRIORITY_LABELS: Record<StockpilePriority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
const RESOURCE_IDS = Object.keys(content.resources) as ResourceId[];

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
          <span className="muted">Woodcutter's hut</span>
          <span>
            {hud.hutLogs}/{hud.hutCapacity} logs
          </span>
        </div>
      </div>

      {hud.message && <div className="panel message">{hud.message}</div>}

      {hud.pile && (
        <div className="panel pile">
          <div className="title">Stockpile</div>
          <div className="row">
            <span className="muted">Priority</span>
            <span className="choices">
              {STOCKPILE_PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={hud.pile?.priority === priority ? 'active' : ''}
                  onClick={() => game.setPilePriority(priority)}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </span>
          </div>
          {RESOURCE_IDS.map((resource) => (
            <label key={resource} className="row">
              <span className="muted">Takes {content.resources[resource].name.toLowerCase()}</span>
              <input
                type="checkbox"
                checked={!hud.pile?.refuses.includes(resource)}
                onChange={(e) => game.setPileAccepts(resource, e.target.checked)}
              />
            </label>
          ))}
        </div>
      )}

      <div className="panel toolbar">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={hud.tool === tool.id ? 'active' : ''}
            disabled={!hud.ready}
            onClick={() => (hud.tool === tool.id ? game.cancelTool() : game.selectTool(tool.id))}
            title={`${tool.label} (${tool.key.toUpperCase()})`}
          >
            {tool.label}
          </button>
        ))}
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
