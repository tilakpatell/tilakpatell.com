import { useEffect, useState } from 'react';
import { device } from '../../lib/device';
import { read, resolve, subscribe } from '../../lib/video.js';

// The visitor's video settings as this device may draw them, kept current
// while the panel is open (lane V1): lib/video.js's resolve under the
// device's detail as the ceiling, read again on every write.
export const ceilingOf = () => device().detail;

export function useVideo() {
  const [state, setState] = useState(() => resolve(read(), { ceiling: ceilingOf() }));
  useEffect(() => subscribe(() => setState(resolve(read(), { ceiling: ceilingOf() }))), []);
  return state;
}
