// Top left: the date on a vellum ribbon, the day track, the winter countdown, game speed and the
// Militia bell.
import type { DayPhase } from '../game/almanac';
import { SPEEDS, type Speed } from '../game/clock';
import type { Game, HudState } from '../game/Game';
import { Icon } from './icons';

const PHASES: { phase: DayPhase; label: string }[] = [
  { phase: 'dawn', label: 'Dawn' },
  { phase: 'day', label: 'Day' },
  { phase: 'dusk', label: 'Dusk' },
  { phase: 'night', label: 'Night' },
];

const SPEED_TITLES: Record<Speed, string> = {
  0: 'Pause (Space)',
  1: 'Speed 1× (1)',
  2: 'Speed 2× (2)',
  3: 'Speed 3× (3)',
};

export function Almanac({ hud, game }: { hud: HudState; game: Game }) {
  const { phase, progress, duskAt } = hud.dayTrack;
  const label = PHASES.find((p) => p.phase === phase)?.label;
  return (
    <section className="almanac" aria-label="Almanac">
      <div className="ribbon">
        <div className="year">Year {hud.year}</div>
        <div className="diamond" />
        <div className="season caps">{hud.season}</div>
        <div className="day">{hud.dayOfSeason}</div>
        <div className="phase">{label}</div>
      </div>
      <div className="almanac-body panel">
        <div className="almanac-title">
          <span className="caps almanac-name">Candlemarch</span>
          <span className="muted">Day {hud.day}</span>
        </div>

        <div className="day-track">
          <div className="track">
            <div className="line daylight" style={{ width: `${duskAt * 100}%` }} />
            <div className="line dark" style={{ left: `${duskAt * 100}%` }} />
            <div className="line passed" style={{ width: `${progress * 100}%` }} />
            <div className="marker" style={{ left: `${progress * 100}%` }} />
          </div>
          <div className="labels">
            {PHASES.map((p) => (
              <span key={p.phase} className={p.phase === phase ? 'now' : undefined}>
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {hud.winter && (
          <div className="winter">
            <Icon name="hourglass" size={16} />
            {hud.winter}
          </div>
        )}

        <fieldset className="seg" aria-label="Game speed">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={hud.speed === speed}
              aria-label={SPEED_TITLES[speed]}
              title={SPEED_TITLES[speed]}
              onClick={() => game.setSpeed(speed)}
            >
              {speed === 0 ? <Icon name="pause" size={16} /> : `${speed}×`}
            </button>
          ))}
        </fieldset>

        {hud.bell && (
          <button
            type="button"
            className="btn dire"
            aria-pressed={hud.bell.ringing}
            onClick={() => game.ringBell()}
            title={
              hud.bell.ringing
                ? 'Stand the militia down: back to work, or Home at night'
                : 'Every villager drops their work to fight near the bell'
            }
          >
            <Icon name="bell" size={18} />
            {hud.bell.ringing ? 'Stand the militia down' : 'Ring the Militia bell'}
          </button>
        )}
      </div>
    </section>
  );
}
