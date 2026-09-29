// The HUD over the world, in the Vellum look (docs/agents/design-system.md): the Almanac top left,
// the Ledger along the top, views and saves top right, Tidings down the right, the inspector bottom
// left and the build menu along the bottom; dialogs over everything.
import { useSyncExternalStore } from 'react';
import type { Game } from '../game/Game';
import { Almanac } from './Almanac';
import { BuildMenu } from './BuildMenu';
import { GameOver, LoadMenu } from './Dialogs';
import { LeftDock } from './Inspector';
import { IconButton } from './kit';
import { Ledger } from './Ledger';
import { Tidings } from './Tidings';

export function Hud({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);

  return (
    <div className="hud">
      <Almanac hud={hud} game={game} />
      <Ledger hud={hud} game={game} />

      <nav className="nav" aria-label="Views and saves">
        <IconButton
          icon="people"
          label="Workers (V)"
          on={hud.workers !== null}
          disabled={!hud.ready}
          onClick={() => game.toggleWorkers()}
        />
        <IconButton
          icon="steps"
          label="Road traffic: Carrier steps on each Road tile over the last day (T)"
          on={hud.heatMap}
          disabled={!hud.ready}
          onClick={() => game.toggleHeatMap()}
        />
        <IconButton icon="quill" label="Save" disabled={!hud.ready} onClick={() => game.save()} />
        <IconButton
          icon="book"
          label="Load"
          on={hud.loadMenu !== null}
          disabled={!hud.ready}
          onClick={() => game.toggleLoadMenu()}
        />
      </nav>

      <Tidings hud={hud} game={game} />
      <LeftDock hud={hud} game={game} />
      <BuildMenu hud={hud} game={game} />

      {hud.gameOver && <GameOver text={hud.gameOver} deaths={hud.deathLog} game={game} />}
      {hud.loadMenu && <LoadMenu slots={hud.loadMenu} game={game} />}
    </div>
  );
}
