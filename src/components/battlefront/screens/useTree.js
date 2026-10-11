import { useEffect, useMemo, useState } from 'react';
import { screen } from '../../../lib/bf2017/ui/screens';

// The window's size, kept as it changes (1920 × 1080 where there is no
// window: a test, the server).
export function useViewport() {
  const read = () => (typeof window === 'undefined' ? { width: 1920, height: 1080 } : { width: window.innerWidth || 1920, height: window.innerHeight || 1080 });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

// One of the game's screens resolved at the window's size, `data` giving
// its texts by id.
export function useTree(name, data = null) {
  const viewport = useViewport();
  // (data goes through its JSON: a fresh object each render must not resolve the tree again)
  const key = JSON.stringify(data);
  const { width, height } = viewport;
  return useMemo(() => screen(name, { viewport: { width, height }, data: JSON.parse(key ?? 'null') }), [name, width, height, key]);
}
