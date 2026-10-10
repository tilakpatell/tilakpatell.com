import { useEffect, useState } from 'react';

// The game's own screens (./screens/) and the HUD's crosshair, loaded once
// and apart from the world: `loadScreens` resolves to them, or to null when
// the import fails, and then lane 5's deploy screen, loading line and end
// of round stand in.
const LOAD = () => Promise.all([import('./screens/index.js'), import('../../lib/bf2017/ui/shapes.js')]);

export const loadScreens = (load = LOAD) =>
  load()
    .then(([m, shapes]) => ({ ...m, reticle: shapes.blasterCrosshair() }))
    .catch(() => null);

export function useGameScreens(load = LOAD) {
  const [screens, setScreens] = useState(null);
  useEffect(() => {
    let live = true;
    loadScreens(load).then((s) => live && setScreens(s));
    return () => {
      live = false;
    };
  }, [load]);
  return screens;
}

// Whether an event opens the pause menu: Escape (unless something already
// took it), or the pointer let go, since while the look holds the pointer
// the browser spends the first Escape on ending the lock and the page never
// hears the key. `locked` is document.pointerLockElement.
export const wantsMenu = (e, locked) => (e.type === 'keydown' ? e.key === 'Escape' && !e.defaultPrevented : e.type === 'pointerlockchange' && !locked);

