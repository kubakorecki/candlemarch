import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { Hud } from './Hud';

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let created: Game | null = null;
    Game.create(host).then((g) => {
      if (disposed) g.destroy();
      else {
        created = g;
        setGame(g);
      }
    });
    return () => {
      disposed = true;
      created?.destroy();
      setGame(null);
    };
  }, []);

  return (
    <div className="app">
      <div ref={hostRef} className="world" />
      {game && <Hud game={game} />}
    </div>
  );
}
