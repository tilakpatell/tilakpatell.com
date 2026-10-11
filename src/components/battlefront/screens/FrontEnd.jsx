import { useEffect, useState } from 'react';
import { Toast } from '../../../runtime/hud';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import Start from './Start.jsx';

// The front end, as the game walks it: Start → the main menu → Play (its
// tiles, the multiplayer category, the mode cards, a mode's levels) → the
// battle (`onPlay(level, mode)`, which the page turns into the route). A tab
// or card this world has not got yet says so in a toast.
//
// <FrontEnd playable={(level, mode) => bool} onPlay={(level, mode) => …} />
export default function FrontEnd({ playable, onPlay, start = 'start' }) {
  const [at, setAt] = useState(start);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const coming = (label) => setToast({ key: Date.now(), text: `${label ?? 'That'}: not in this world yet` });
  return (
    <div className="bf-front-end" data-front-end={at}>
      {at === 'start' && <Start onNext={() => setAt('menu')} />}
      {at === 'menu' && <MainMenu onPlay={() => setAt('play')} onStart={() => setAt('start')} onComing={coming} />}
      {at === 'play' && <Play playable={playable} onPlay={onPlay} onBack={() => setAt('menu')} />}
      <Toast toast={toast} />
    </div>
  );
}
