import { useCallback, useState } from 'react';
import { local } from '../../lib/hooks';
import { CONTROLS_KEY, readControls } from './controls';

// The flight settings (controls.js), kept between visits: the page's, so the
// map's scene and the flight menu's Settings tab read and change the one.
//   useControls() → [controls, setControls]
export function useControls() {
  const [controls, setState] = useState(() => readControls(local.get(CONTROLS_KEY)));
  const setControls = useCallback((c) => {
    const next = readControls(c);
    setState(next);
    local.set(CONTROLS_KEY, next);
  }, []);
  return [controls, setControls];
}
