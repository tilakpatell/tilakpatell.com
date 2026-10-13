import { useEffect, useState } from 'react';
import { Toast } from '../../../runtime/hud';
import { frontEndWays } from './cards';
import Collection from './Collection.jsx';
import MainMenu from './MainMenu.jsx';
import Play from './Play.jsx';
import Start from './Start.jsx';

// The front end, as the game walks it: Start → the main menu → Play (its
// tiles, the multiplayer category, the mode cards, a mode's levels) → the
// battle (`onPlay(level, mode)`, which the page turns into the route), or
// the main menu's COLLECTION (the characters' skins, star cards, emotes,
// poses and voice lines, kept for the battle's deploy). A tab or card this
// world has not got yet says so in a toast.
//
// Over a level's world (BattlefrontWorld.jsx: the player has landed, the
// level loads behind) it opens on the main menu (`start="menu"`), and the
// main menu's back is the way out of the world (`onExit`) and not the Start
// screen.
//
// <FrontEnd playable={(level, mode) => bool} onPlay={(level, mode) => …} start="start" | "menu" onExit={() => …} />
export default function FrontEnd({ playable, onPlay, start = 'start', onExit = null }) {
  const [at, setAt] = useState(start);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const ways = frontEndWays({ toStart: () => setAt('start'), onExit });
  const coming = (label) => setToast({ key: Date.now(), text: `${label ?? 'That'}: not in this world yet` });
  return (
    <div className="bf-front-end" data-front-end={at}>
      {at === 'start' && <Start onNext={() => setAt('menu')} />}
      {at === 'menu' && <MainMenu onPlay={() => setAt('play')} onStart={ways.home} onBack={ways.back} first={ways.first} onCollection={() => setAt('collection')} onComing={coming} />}
      {at === 'play' && <Play playable={playable} onPlay={onPlay} onBack={() => setAt('menu')} />}
      {at === 'collection' && <Collection onBack={() => setAt('menu')} />}
      <Toast toast={toast} />
    </div>
  );
}
