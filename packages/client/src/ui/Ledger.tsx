// Top: the village's stores, its people (with who is Homeless, Hungry or Cold), how busy the
// Carriers are and what the Hero carries.
import { content } from '@candlemarch/content';
import { Fragment } from 'react';
import type { AlertKind, Game, HudState } from '../game/Game';
import { Icon, type IconName } from './icons';
import { RESOURCE_ICONS, STOCKPILE_RESOURCES, type Tone } from './kit';

/** Needs shown under the villager count, each linked to its alert (which finds a villager). */
export const STATUSES: {
  kind: AlertKind & keyof HudState;
  word: string;
  icon: IconName;
  tone: Tone;
}[] = [
  { kind: 'homeless', word: 'Homeless', icon: 'hut', tone: 'dire' },
  { kind: 'hungry', word: 'Hungry', icon: 'food', tone: 'warn' },
  { kind: 'cold', word: 'Cold', icon: 'snow', tone: 'warn' },
];

function Store({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <div className="ledger-cell">
      <Icon name={icon} size={22} className="tone-gilt" />
      <div>
        <div className="figure">{value}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
}

export function Ledger({ hud, game }: { hud: HudState; game: Game }) {
  const statuses = STATUSES.filter((s) => hud[s.kind] > 0);
  return (
    <section className="ledger panel" aria-label="Village ledger">
      <Store icon="food" value={hud.food} label="Food" />
      {STOCKPILE_RESOURCES.map((resource) => (
        <Fragment key={resource}>
          <span className="ledger-divider" />
          <Store
            icon={RESOURCE_ICONS[resource]}
            value={hud.goods[resource] ?? 0}
            label={content.resources[resource].name}
          />
        </Fragment>
      ))}

      <span className="ledger-divider strong" />
      <div className="ledger-cell">
        <Icon name="people" size={22} className="tone-gilt" />
        <div>
          <div className="figure">{hud.villagers}</div>
          <div className="label">Villagers</div>
        </div>
        {statuses.length > 0 && (
          <div className="ledger-status">
            {statuses.map((s) => {
              const target = hud.alerts.find((a) => a.kind === s.kind)?.target ?? null;
              return (
                <button
                  key={s.kind}
                  type="button"
                  className={`status-link tone-${s.tone}`}
                  disabled={target === null}
                  onClick={() => target && game.focusAlert(target)}
                  title={target ? `Show a ${s.word} villager` : undefined}
                >
                  <Icon name={s.icon} size={13} />
                  {hud[s.kind]} {s.word}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <span className="ledger-divider" />
      <div className="ledger-cell" title="Share of Carriers holding a Haul over the last day">
        <Icon name="cart" size={22} className="tone-gilt" />
        <div className="ledger-carriers">
          <div>
            <span className="figure">{hud.carriersBusy}</span>{' '}
            <span className="label">Carriers busy</span>
          </div>
          <div className="meter">
            <span style={{ width: `${hud.carriersBusyPercent ?? 0}%` }} />
          </div>
        </div>
      </div>

      {hud.heroLoad !== null && (
        <>
          <span className="ledger-divider" />
          <div className="ledger-cell">
            <Icon name="sword" size={22} className="tone-gilt" />
            <div>
              <div className="figure">{hud.heroLoad}</div>
              <div className={hud.heroKnockout ? 'label tone-dire' : 'label'}>
                {hud.heroKnockout ?? 'Hero carries'}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
