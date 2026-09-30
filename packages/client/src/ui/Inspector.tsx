// Bottom left: the workers view and whatever is selected (a building, villager, Stockpile, forage
// patch or Hunting ground), one inspector panel each.
import { content } from '@candlemarch/content';
import { STOCKPILE_PRIORITIES, type StockpilePriority } from '@candlemarch/sim';
import type { ReactNode } from 'react';
import type {
  BuildingInfo,
  Game,
  GroundInfo,
  HudState,
  PatchInfo,
  VillagerInfo,
  WorkersView,
} from '../game/Game';
import { TOOL_ICONS } from './buildCategories';
import { Icon } from './icons';
import {
  Avatar,
  Callout,
  Chip,
  CloseButton,
  employsText,
  IconButton,
  Medallion,
  RESOURCE_ICONS,
  SectionHead,
  STOCKPILE_RESOURCES,
} from './kit';

const PRIORITY_LABELS: Record<StockpilePriority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
/** Above this many slots a buffer shows as a line rather than pips. */
const MAX_PIPS = 12;

/** Icon, name, a line under it and a close button: the top of every inspector. */
function Head({
  lead,
  name,
  sub,
  game,
}: {
  lead: ReactNode;
  name: string;
  sub?: string | undefined;
  game: Game;
}) {
  return (
    <div className="inspector-head">
      {lead}
      <div className="names">
        <div className="name">{name}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <CloseButton onClick={() => game.cancelTool()} />
    </div>
  );
}

function Fill({ amount, capacity }: { amount: number; capacity: number }) {
  if (capacity > MAX_PIPS) {
    return (
      <div className="meter">
        <span style={{ width: `${(100 * amount) / capacity}%` }} />
      </div>
    );
  }
  return (
    <div className="pips">
      {Array.from({ length: capacity }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pips are interchangeable slots
        <span key={i} className={i < amount ? 'full' : undefined} />
      ))}
    </div>
  );
}

function GroundRows({ ground }: { ground: GroundInfo }) {
  return (
    <div>
      <div className="fact">
        <span>{ground.name}</span>
        <span className={`health-${ground.health}`}>{ground.word}</span>
      </div>
      <div className="muted small">{ground.summary}</div>
      {ground.regrowth && <div className="muted small">{ground.regrowth}</div>}
    </div>
  );
}

/** "Employs 1 Woodcutter", or nothing for a building without workers. */
function employsLine(building: BuildingInfo): string | undefined {
  const jobs = employsText(content.buildings[building.type]);
  return jobs ? `Employs ${jobs}` : undefined;
}

function BuildingPanel({
  building,
  hud,
  game,
}: {
  building: BuildingInfo;
  hud: HudState;
  game: Game;
}) {
  return (
    <section className="inspector panel" aria-label="Selected building">
      <Head
        lead={<Medallion icon={TOOL_ICONS[building.type]} />}
        name={building.name}
        sub={employsLine(building)}
        game={game}
      />
      {building.status && <Callout tone="warn" title={building.status} />}
      {building.holds.map((hold) => (
        <div key={hold.resource} className="stack">
          <div className="fact">
            <span>Holds</span>
            <span>
              {hold.amount} / {hold.capacity} {content.resources[hold.resource].name.toLowerCase()}
            </span>
          </div>
          <Fill amount={hold.amount} capacity={hold.capacity} />
        </div>
      ))}
      {building.bell && hud.bell && (
        <div className="fact">
          <span>{hud.bell.ringing ? 'The militia is out' : 'Quiet'}</span>
          <button type="button" className="btn-small" onClick={() => game.ringBell()}>
            {hud.bell.ringing ? 'Stand down' : 'Ring'}
          </button>
        </div>
      )}
      {building.grounds.length > 0 && <SectionHead title="Hunting grounds" />}
      {building.grounds.map((ground) => (
        <GroundRows key={ground.id} ground={ground} />
      ))}
      {building.maxWorkers > 0 && (
        <>
          <div className="section-head">
            <span className="caps">Workers</span>
            <span className="rule" />
            <span className="muted">
              {building.workerLimit} of {building.maxWorkers} wanted
            </span>
            <IconButton
              icon="minus"
              label="Fewer workers"
              size="small"
              disabled={building.workerLimit <= 0}
              onClick={() => game.changeWorkerLimit(-1)}
            />
            <IconButton
              icon="plus"
              label="More workers"
              size="small"
              disabled={building.workerLimit >= building.maxWorkers}
              onClick={() => game.changeWorkerLimit(1)}
            />
          </div>
          {building.workers.map((worker) => (
            <div key={worker.id} className="person">
              <Avatar name={worker.name} job={worker.jobId} />
              <div className="who">
                <button
                  type="button"
                  className="link"
                  onClick={() => game.focusVillager(worker.id)}
                >
                  {worker.name}
                </button>
                <span className="muted">{worker.job}</span>
              </div>
              <button
                type="button"
                className="btn-small"
                onClick={() => game.unassignWorker(worker.id)}
              >
                Unassign
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function VillagerPanel({ villager, game }: { villager: VillagerInfo; game: Game }) {
  const homeless = villager.home === null;
  const needs = homeless || villager.hunger || villager.cold || villager.tired;
  return (
    <section className="inspector panel" aria-label="Selected villager">
      <Head
        lead={<Avatar name={villager.name} job={villager.jobId} big />}
        name={villager.name}
        sub={`${villager.job} · ${villager.workplace ?? 'no Workplace'}`}
        game={game}
      />
      {needs && (
        <div className="chips">
          {homeless && (
            <Chip tone="dire" icon="hut">
              Homeless
            </Chip>
          )}
          {villager.hunger && (
            <Chip tone="warn" icon="food">
              Hungry
            </Chip>
          )}
          {villager.cold && (
            <Chip tone="warn" icon="snow">
              Cold
            </Chip>
          )}
          {villager.tired && (
            <Chip tone="warn" icon="zzz">
              Tired
            </Chip>
          )}
        </div>
      )}
      <div className="facts">
        <span>Home</span>
        <span className={homeless ? 'tone-dire' : undefined}>
          {villager.home ?? 'None: sleeps in the open'}
        </span>
        {villager.hunger && (
          <>
            <span>Hunger</span>
            <span>{villager.hunger}</span>
          </>
        )}
        {villager.cold && (
          <>
            <span>Cold</span>
            <span>{villager.cold}</span>
          </>
        )}
        {villager.tired && (
          <>
            <span>Tired</span>
            <span>Half speed until Dusk</span>
          </>
        )}
      </div>
    </section>
  );
}

function PilePanel({ pile, game }: { pile: NonNullable<HudState['pile']>; game: Game }) {
  return (
    <section className="inspector panel" aria-label="Selected Stockpile">
      <Head lead={<Medallion icon="stockpile" />} name="Stockpile" game={game} />
      <div className="fact priority">
        <span>Priority</span>
        <fieldset className="seg joined" aria-label="Priority">
          {STOCKPILE_PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              aria-pressed={pile.priority === priority}
              onClick={() => game.setPilePriority(priority)}
            >
              {PRIORITY_LABELS[priority]}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="chips">
        {STOCKPILE_RESOURCES.map((resource) => (
          <label key={resource} className="toggle-chip">
            <input
              type="checkbox"
              checked={!pile.refuses.includes(resource)}
              onChange={(e) => game.setPileAccepts(resource, e.target.checked)}
            />
            <Icon name={RESOURCE_ICONS[resource]} size={18} />
            {content.resources[resource].name}
          </label>
        ))}
      </div>
    </section>
  );
}

function PatchPanel({ patch, game }: { patch: PatchInfo; game: Game }) {
  return (
    <section className="inspector panel" aria-label="Selected patch">
      <Head
        lead={<Medallion icon={RESOURCE_ICONS[patch.resource]} />}
        name={patch.name}
        game={game}
      />
      <div className="fact">
        <span>Holds</span>
        <span>{patch.stock}</span>
      </div>
      {patch.noShade && <Callout tone="warn" title={patch.noShade} />}
    </section>
  );
}

function GroundPanel({ ground, game }: { ground: GroundInfo; game: Game }) {
  return (
    <section className="inspector panel" aria-label="Selected Hunting ground">
      <Head lead={<Medallion icon="bow" />} name="Hunting ground" game={game} />
      <GroundRows ground={ground} />
    </section>
  );
}

function WorkersPanel({ workers, game }: { workers: WorkersView; game: Game }) {
  return (
    <section className="inspector panel" aria-label="Workers">
      <div className="inspector-head">
        <div className="names">
          <SectionHead
            title="Workers"
            big
            aside={`${workers.carriers} ${workers.carriers === 1 ? 'Carrier' : 'Carriers'}, ${workers.workers} ${workers.workers === 1 ? 'worker' : 'workers'}`}
          />
        </div>
        <CloseButton onClick={() => game.toggleWorkers()} />
      </div>
      <div className="workers-list">
        {workers.rows.map((row) => (
          <div key={row.id} className="person">
            <Avatar name={row.name} job={row.jobId} />
            <div className="who">
              <button type="button" className="link" onClick={() => game.focusVillager(row.id)}>
                {row.name}
              </button>
              <span className="muted">
                {row.workplace === null ? 'Carrier' : `${row.job}, ${row.workplace}`}
              </span>
            </div>
            <div className="actions">
              {row.workplace !== null && (
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => game.unassignWorker(row.id)}
                >
                  Unassign
                </button>
              )}
              <select
                value=""
                aria-label={`Reassign ${row.name}`}
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
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LeftDock({ hud, game }: { hud: HudState; game: Game }) {
  return (
    <div className="left-dock">
      {hud.workers && <WorkersPanel workers={hud.workers} game={game} />}
      {hud.building && <BuildingPanel building={hud.building} hud={hud} game={game} />}
      {hud.villager && <VillagerPanel villager={hud.villager} game={game} />}
      {hud.pile && <PilePanel pile={hud.pile} game={game} />}
      {hud.patch && <PatchPanel patch={hud.patch} game={game} />}
      {hud.ground && <GroundPanel ground={hud.ground} game={game} />}
    </div>
  );
}
