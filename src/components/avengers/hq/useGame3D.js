// A building's game with a 3D switch of its own (spec 2026-10-18-avengers-hq-
// fix-and-hub-design, §5): the site's use3D(), with this game's own on, mode
// and set, kept in tp-hq-3d-<game>. Never the site's switch, which stays in
// Settings, so a game can draw in 3D while the compound keeps its cards.
import { useCallback, useState } from 'react';
import { use3D } from '../../../lib/gpu';
import { readLocal3D, resolveLocal3D, writeLocal3D } from './gameScreen';

export function useGame3D(game) {
  const site = use3D();
  const [local, setLocal] = useState(() => readLocal3D(game));
  const { held, hold } = site;
  const set = useCallback(
    (m) => {
      writeLocal3D(game, m);
      setLocal(m === 'on' || m === 'off' ? m : 'auto');
      // (a world holding its 3D until asked: asking for it here loads it)
      if (m !== 'off' && held) hold?.load();
    },
    [game, held, hold],
  );
  return { ...site, local, on: resolveLocal3D(local, site), mode: local === 'auto' ? site.mode : local, set };
}
