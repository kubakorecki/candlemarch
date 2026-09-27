import { content, type ResourceId } from '@candlemarch/content';
import { isStockpileGood, STOCKPILE_PRIORITIES, type StockpilePriority } from '@candlemarch/sim';
import { useSyncExternalStore } from 'react';
import { SPEEDS, type Speed } from '../game/clock';
import { type Game, TOOLS } from '../game/Game';

const PRIORITY_LABELS: Record<StockpilePriority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
/** Resources a stockpile can take or refuse; Food never goes on one. */
const STOCKPILE_RESOURCES = (Object.keys(content.resources) as ResourceId[]).filter((r) =>
  isStockpileGood(content, r),
);

const SPEED_LABELS: Record<Speed, string> = { 0: '⏸', 1: '1×', 2: '2×', 3: '3×' };

export function Hud({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);

  return (
    <div className="hud">
      {hud.message && <div className="panel message">{hud.message}</div>}

      <div className="side">
        <div className="panel readout">
          <div className="title">Candlemarch</div>
          <div className="row">
            <span>{hud.date}</span>
            <span className="muted">Year {hud.year}</span>
          </div>
          <div className="row">
            <span className="muted">Time</span>
            <span>{hud.isNight ? 'Night' : 'Day'}</span>
          </div>
          <div className="row">
            <span className="muted">Woodcutter's hut</span>
            <span>
              {hud.hutLogs}/{hud.hutCapacity} logs
            </span>
          </div>
          {hud.heroLoad && (
            <div className="row">
              <span className="muted">Hero carries</span>
              <span>{hud.heroLoad}</span>
            </div>
          )}
        </div>

        {hud.workers && (
          <div className="panel workers">
            <div className="title">Workers</div>
            <div className="row muted">
              {hud.workers.carriers} {hud.workers.carriers === 1 ? 'Carrier' : 'Carriers'},{' '}
              {hud.workers.workers} {hud.workers.workers === 1 ? 'worker' : 'workers'}
            </div>
            <div className="list">
              {hud.workers.rows.map((row) => (
                <div key={row.id} className="row">
                  <button type="button" className="link" onClick={() => game.focusVillager(row.id)}>
                    {row.name}
                  </button>
                  <span className="muted grow">
                    {row.workplace === null ? 'Carrier' : `${row.job}, ${row.workplace}`}
                  </span>
                  <span className="choices">
                    {row.workplace !== null && (
                      <button type="button" onClick={() => game.unassignWorker(row.id)}>
                        Unassign
                      </button>
                    )}
                    <select
                      value=""
                      disabled={row.targets.length === 0}
                      onChange={(e) => game.reassignWorker(row.id, Number(e.target.value))}
                    >
                      <option value="" disabled>
                        Reassign…
                      </option>
                      {row.targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hud.building && (
          <div className="panel building">
            <div className="title">{hud.building.name}</div>
            {hud.building.workers.map((worker) => (
              <div key={worker.id} className="row">
                <button
                  type="button"
                  className="link"
                  onClick={() => game.focusVillager(worker.id)}
                >
                  {worker.name}
                </button>
                <button type="button" onClick={() => game.unassignWorker(worker.id)}>
                  Unassign
                </button>
              </div>
            ))}
            <div className="row">
              <span className="muted">
                {hud.building.workerLimit} / {hud.building.maxWorkers} workers wanted
              </span>
              <span className="choices">
                <button
                  type="button"
                  disabled={hud.building.workerLimit <= 0}
                  onClick={() => game.changeWorkerLimit(-1)}
                  title="Fewer workers"
                >
                  −
                </button>
                <button
                  type="button"
                  disabled={hud.building.workerLimit >= hud.building.maxWorkers}
                  onClick={() => game.changeWorkerLimit(1)}
                  title="More workers"
                >
                  +
                </button>
              </span>
            </div>
          </div>
        )}

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
            {STOCKPILE_RESOURCES.map((resource) => (
              <label key={resource} className="row">
                <span className="muted">
                  Takes {content.resources[resource].name.toLowerCase()}
                </span>
                <input
                  type="checkbox"
                  checked={!hud.pile?.refuses.includes(resource)}
                  onChange={(e) => game.setPileAccepts(resource, e.target.checked)}
                />
              </label>
            ))}
          </div>
        )}

        {hud.villager && (
          <div className="panel villager">
            <div className="title">{hud.villager.name}</div>
            <div className="row">
              <span className="muted">Job</span>
              <span>{hud.villager.job}</span>
            </div>
            <div className="row">
              <span className="muted">Workplace</span>
              <span>{hud.villager.workplace ?? 'None'}</span>
            </div>
          </div>
        )}
      </div>

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
        <button
          type="button"
          className={hud.workers ? 'active' : ''}
          disabled={!hud.ready}
          onClick={() => game.toggleWorkers()}
          title="Workers (V)"
        >
          Workers
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
