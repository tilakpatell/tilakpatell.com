import { useEffect, useMemo, useState } from 'react';
import { screen } from '../../../lib/bf2017/ui/screens';
import { crumbItems, menuHeader } from './menuHeader';

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

// One of the game's screens resolved at its own 1920 × 1080, for the
// canvas (the kit's ScreenCanvas fits that frame to the window): `data`
// its texts by id, `items` the lists the game's code fills, `drop` the parts
// it leaves out by the box they are in.
export function useFrameTree(name, { data = null, items = null, drop = null } = {}) {
  const key = JSON.stringify({ data, items, drop });
  return useMemo(() => {
    const o = JSON.parse(key);
    return screen(name, { viewport: { width: 1920, height: 1080 }, data: o.data, items: o.items, drop: o.drop });
  }, [name, key]);
}

// The main menu's header for a page (./menuHeader.js): its tree, what fills
// it and the open tab.
export function useMenuHeader({ tab, crumbs = null }) {
  const tree = useFrameTree('MainMenuScreen', { items: crumbItems(crumbs) });
  const words = (crumbs ?? []).join('|');
  return useMemo(() => ({ tree, ...menuHeader({ tree, tab, crumbs: words ? words.split('|') : null }) }), [tree, tab, words]);
}
