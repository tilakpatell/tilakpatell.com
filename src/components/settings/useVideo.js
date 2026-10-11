import { useEffect, useState } from 'react';
import { device, quality } from '../../lib/device';
import { read, resolve, subscribe } from '../../lib/video.js';

// The visitor's video settings as this device may draw them, kept current
// while the panel is open (lane V1): lib/video.js's resolve under the
// device's detail as the ceiling and the level in play (the address's pin,
// Auto's pick) as the preset, read again on every write.
export const ceilingOf = () => device().detail;

export function useVideo() {
  const now = () => resolve(read(undefined, quality().level), { ceiling: ceilingOf() });
  const [state, setState] = useState(now);
  useEffect(() => subscribe(() => setState(now())), []);
  return state;
}
