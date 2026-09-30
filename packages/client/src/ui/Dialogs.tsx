// Centred dialogs over the world: the game-over screen and the Load menu.
import type { SaveSlot } from '../game/autosave';
import type { Game, HudState } from '../game/Game';
import { Icon, type IconName } from './icons';
import { CloseButton, Corners, SectionHead } from './kit';

const SLOT_ICONS: Record<SaveSlot, IconName> = { manual: 'quill', autosave: 'sun' };

export function GameOver({ text, deaths, game }: { text: string; deaths: string[]; game: Game }) {
  return (
    <>
      <div className="backdrop" />
      <div className="dialog panel game-over" role="dialog" aria-labelledby="game-over-title">
        <Corners all />
        <span className="tone-dire">
          <Icon name="skull" size={34} />
        </span>
        <h1 id="game-over-title" className="caps">
          The village has died
        </h1>
        <div className="epitaph">{text}</div>
        {deaths.length > 0 && (
          <>
            <SectionHead title="Chronicle" tone="muted" className="wide" />
            <div className="deaths">
              {/* Oldest first, as a chronicle reads. */}
              {[...deaths].reverse().map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat; replaced whole
                <span key={i}>{line}</span>
              ))}
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => game.toggleLoadMenu()}>
            Load a save
          </button>
          <button type="button" className="btn primary" onClick={() => game.newGame()}>
            New game
          </button>
        </div>
      </div>
    </>
  );
}

export function LoadMenu({
  slots,
  game,
}: {
  slots: NonNullable<HudState['loadMenu']>;
  game: Game;
}) {
  return (
    <div className="dialog panel load-menu" role="dialog" aria-labelledby="load-title">
      <Corners all />
      <div className="head">
        <Icon name="book" size={20} />
        <span id="load-title" className="caps">
          Load
        </span>
        <CloseButton onClick={() => game.toggleLoadMenu()} />
      </div>
      {slots.map((entry) => (
        <button
          key={entry.slot}
          type="button"
          className="slot"
          disabled={entry.date === null}
          onClick={() => game.load(entry.slot)}
        >
          <Icon name={SLOT_ICONS[entry.slot]} size={20} className="tone-gilt" />
          <span className="names">
            <span className="name">{entry.name}</span>
            <span className="date">{entry.date ?? 'Empty'}</span>
          </span>
          {entry.date !== null && <Icon name="chev" size={18} />}
        </button>
      ))}
      <div className="footnote">The autosave is written at every Dawn.</div>
    </div>
  );
}
