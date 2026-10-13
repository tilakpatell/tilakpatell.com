import { useEffect, useState } from 'react';

import { crosshairKind } from './hud/widgets.js';

// The game's own screens (./screens/) and the HUD's crosshairs, loaded once
// and apart from the world: `loadScreens` resolves to them, or to false when
// the import fails (the hook's null is not yet), and then lane 5's deploy
// screen and end of round stand in. `crosshair(cls)` is the class's gun's crosshair as the
// game's crosshair screens build it (shapes.js crosshairFor, one shape a
// kind, made once); `reticle` the blaster rifle's, as before.
const LOAD = () => Promise.all([import('./screens/index.js'), import('../../lib/bf2017/ui/shapes.js')]);

export const loadScreens = (load = LOAD) =>
  load()
    .then(([m, shapes]) => {
      const made = new Map();
      const crosshair = (cls) => {
        const kind = crosshairKind(cls);
        if (!made.has(kind)) made.set(kind, shapes.crosshairFor(kind));
        return made.get(kind);
      };
      return { ...m, reticle: crosshair('assault'), crosshair };
    })
    .catch(() => false);

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

