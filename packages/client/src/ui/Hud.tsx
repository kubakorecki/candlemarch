import { content, type ResourceId } from '@candlemarch/content';
import {
  DEFAULT_MAP,
  isStockpileGood,
  STOCKPILE_PRIORITIES,
  type StockpilePriority,
} from '@candlemarch/sim';
import { useSyncExternalStore } from 'react';
import { SPEEDS, type Speed } from '../game/clock';
import { type Game, type GroundInfo, TOOLS } from '../game/Game';

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

/** One Hunting ground's lines: its health word in its colour, then its Game. */
function GroundRows({ ground }: { ground: GroundInfo }) {
  return (
    <>
      <div className="row">
        <span>{ground.name}</span>
        <span className={`health-${ground.health}`}>{ground.word}</span>
      </div>
      <div className="row muted">{ground.summary}</div>
    </>
  );
}

export function Hud({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);

  return (
    <div className="hud">
      {(hud.message || hud.placementWarning) && (
        <div className="panel message">
          {hud.message}
          {hud.placementWarning && <div className="warn">{hud.placementWarning}</div>}
        </div>
      )}

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
          {hud.winter && (
            <div className="row">
              <span className="warn-amber">{hud.winter}</span>
            </div>
          )}
          <div className="row">
            <span className="muted">Homeless</span>
            <span className={hud.homeless > 0 ? 'warn' : ''}>{hud.homeless}</span>
          </div>
          <div className="row">
            <span className="muted">Hungry</span>
            <span className={hud.hungry > 0 ? 'warn' : ''}>{hud.hungry}</span>
          </div>
          <div className="row">
            <span className="muted">Cold</span>
            <span className={hud.cold > 0 ? 'warn' : ''}>{hud.cold}</span>
          </div>
          <div className="row">
            <span className="muted">Food in Granaries</span>
            <span>{hud.food}</span>
          </div>
          <div className="row" title="Share of Carriers holding a Haul over the last day">
            <span className="muted">Carriers busy</span>
            <span>{hud.carriersBusy}</span>
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
          {hud.heroKnockout && (
            <div className="row">
              <span className="muted">Hero</span>
              <span>{hud.heroKnockout}</span>
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
            {hud.building.status && (
              <div className="row">
                <span className="warn-amber">{hud.building.status}</span>
              </div>
            )}
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
            {hud.building.grounds.map((ground) => (
              <GroundRows key={ground.id} ground={ground} />
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

        {hud.patch && (
          <div className="panel patch">
            <div className="title">{hud.patch.name}</div>
            <div className="row">
              <span className="muted">Holds</span>
              <span>{hud.patch.stock}</span>
            </div>
            {hud.patch.noShade && (
              <div className="row">
                <span className="warn">{hud.patch.noShade}</span>
              </div>
            )}
          </div>
        )}

        {hud.ground && (
          <div className="panel ground">
            <div className="title">Hunting ground</div>
            <GroundRows ground={hud.ground} />
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
            <div className="row">
              <span className="muted">Home</span>
              <span className={hud.villager.home === null ? 'warn' : ''}>
                {hud.villager.home ?? 'Homeless'}
              </span>
            </div>
            {hud.villager.tired && (
              <div className="row">
                <span className="muted">Tired</span>
                <span className="warn">Half speed until Dusk</span>
              </div>
            )}
            {hud.villager.hunger && (
              <div className="row">
                <span className="muted">Hungry</span>
                <span className="warn">{hud.villager.hunger}</span>
              </div>
            )}
            {hud.villager.cold && (
              <div className="row">
                <span className="muted">Cold</span>
                <span className="warn">{hud.villager.cold}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {(hud.alerts.length > 0 || hud.deathLog.length > 0) && (
        <div className="side-right">
          {hud.alerts.length > 0 && (
            <div className="panel alerts">
              <div className="title">Alerts</div>
              {hud.alerts.map((alert, i) => (
                <button
                  // Texts can repeat (villagers can share a name); the list is only replaced whole.
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above
                  key={i}
                  type="button"
                  className={`link alert-${alert.severity}`}
                  disabled={alert.target === null}
                  onClick={() => alert.target && game.focusAlert(alert.target)}
                >
                  {alert.text}
                </button>
              ))}
            </div>
          )}
          {hud.deathLog.length > 0 && (
            <div className="panel death-log">
              <div className="title">Deaths</div>
              {hud.deathLog.map((line, i) => (
                // Lines can repeat (villagers can share a name); the list is only replaced whole.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                <div key={i} className="row muted">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {hud.gameOver && (
        <>
          <div className="game-over-backdrop" />
          <div className="panel game-over">
            <div className="title">The village has died</div>
            <div className="row">{hud.gameOver}</div>
            <div className="choices">
              <button type="button" onClick={() => game.toggleLoadMenu()}>
                Load a save
              </button>
              <button type="button" onClick={() => game.newGame(DEFAULT_MAP)}>
                New game
              </button>
            </div>
          </div>
        </>
      )}

      {hud.loadMenu && (
        <div className="panel load-menu">
          <div className="title">Load</div>
          {hud.loadMenu.map((entry) => (
            <div key={entry.slot} className="row">
              <button
                type="button"
                disabled={entry.date === null}
                onClick={() => game.load(entry.slot)}
              >
                {entry.name}
              </button>
              <span className="muted">{entry.date ?? 'Empty'}</span>
            </div>
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
        <button
          type="button"
          className={hud.workers ? 'active' : ''}
          disabled={!hud.ready}
          onClick={() => game.toggleWorkers()}
          title="Workers (V)"
        >
          Workers
        </button>
        <button
          type="button"
          className={hud.heatMap ? 'active' : ''}
          disabled={!hud.ready}
          onClick={() => game.toggleHeatMap()}
          title="Road traffic: Carrier steps on each Road tile over the last day (T)"
        >
          Traffic
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
        <button
          type="button"
          className={hud.loadMenu ? 'active' : ''}
          disabled={!hud.ready}
          onClick={() => game.toggleLoadMenu()}
        >
          Load
        </button>
      </div>
    </div>
  );
}
