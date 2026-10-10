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
