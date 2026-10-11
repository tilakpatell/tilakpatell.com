import { useCallback, useEffect, useRef, useState } from 'react';
import { local } from '../../../lib/hooks';
import { LOOK_KEY, readLooks } from './looks';

const EVENT = 'tp:looks';

// The wardrobe's looks, kept between visits (looks.js's LOOK_KEY), and the
// same in every part of the page at once: a change anywhere is told to the
// rest ('tp:looks'), so the world, the Citadel and the hangar dress their
// Rick and Morty (and the RV’s seats, the crews on foot and Albuquerque
// their Walt and Jesse) the moment the wardrobe does.
// → [looks ({ rick, morty, walt, jesse }), setLook(who, look)]
export function useLooks() {
  const [looks, setLooks] = useState(() => readLooks(local.get(LOOK_KEY)));
  const now = useRef(looks);
  now.current = looks;
  useEffect(() => {
    const on = (e) => setLooks(readLooks(e.detail));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const setLook = useCallback((who, look) => {
    const next = readLooks({ ...now.current, [who]: look });
    local.set(LOOK_KEY, next);
    setLooks(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }, []);
  return [looks, setLook];
}
