// Right: alerts by weight (lives at stake first, then warnings) and the chronicle of deaths and
// departures.
// Homeless, Hungry and Cold counts live on the Ledger, so their alerts aren't repeated here.
import type { AlertKind, AlertView, Game, HudState } from '../game/Game';
import { Icon } from './icons';
import { SectionHead } from './kit';
import { STATUSES } from './Ledger';

const ON_THE_LEDGER: readonly AlertKind[] = STATUSES.map((s) => s.kind);

function AlertRow({ alert, game }: { alert: AlertView; game: Game }) {
  const dire = alert.severity === 'red';
  const { target } = alert;
  return (
    <button
      type="button"
      className={`alert ${dire ? 'dire' : 'warn'}`}
      disabled={target === null}
      onClick={() => target && game.focusAlert(target)}
    >
      <Icon name={dire ? 'dire' : 'warn'} size={dire ? 22 : 18} />
      <span className="text">{alert.text}</span>
      {target && (
        <span className="chev">
          <Icon name="chev" size={16} />
        </span>
      )}
    </button>
  );
}

export function Tidings({ hud, game }: { hud: HudState; game: Game }) {
  const listed = hud.alerts.filter((a) => !ON_THE_LEDGER.includes(a.kind));
  const dire = listed.filter((a) => a.severity === 'red');
  const warnings = listed.filter((a) => a.severity !== 'red');
  if (listed.length === 0 && hud.deathLog.length === 0) return null;
  return (
    <section className="tidings panel" aria-label="Alerts">
      <SectionHead title="Tidings" aside={listed.length || undefined} big />
      {dire.length > 0 && <SectionHead title="Lives at stake" tone="dire" />}
      {dire.map((alert, i) => (
        // Texts can repeat (villagers can share a name); the list is only replaced whole.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <AlertRow key={i} alert={alert} game={game} />
      ))}
      {warnings.length > 0 && <SectionHead title="Warnings" tone="warn" />}
      {warnings.map((alert, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as above
        <AlertRow key={i} alert={alert} game={game} />
      ))}
      {hud.deathLog.length > 0 && <SectionHead title="Chronicle" tone="muted" />}
      {hud.deathLog.map((line, i) => (
        // Lines can repeat (villagers can share a name); the list is only replaced whole.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <div key={i} className="chronicle-line">
          <Icon name={line.kind === 'death' ? 'skull' : 'steps'} size={15} />
          {line.text}
        </div>
      ))}
    </section>
  );
}
