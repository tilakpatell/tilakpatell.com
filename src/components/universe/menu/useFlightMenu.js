import { useCallback, useEffect, useState } from 'react';
import { local } from '../../../lib/hooks';
import { MENU_TAB_KEY, readMenuTab } from './dress';

// The flight menu's state, the page's (pages/Universe.jsx, pages/Galaxy.jsx):
// open or shut, and the tab it's on, kept between visits. `enabled` false
// (no ship, a jump, the Hangar or the nav map over it) shuts it.
//   useFlightMenu({ enabled }) → { open, tab, setTab, openMenu(tab?), closeMenu() }
export function useFlightMenu({ enabled = true } = {}) {
  const [open, setOpen] = useState(false);
  const [tab, setTabState] = useState(() => readMenuTab(local.get(MENU_TAB_KEY)));
  const setTab = useCallback((t) => {
    const next = readMenuTab(t);
    setTabState(next);
    local.set(MENU_TAB_KEY, next);
  }, []);
  const openMenu = useCallback(
    (t) => {
      if (t) setTab(t);
      setOpen(true);
    },
    [setTab],
  );
  const closeMenu = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);
  return { open: open && enabled, tab, setTab, openMenu, closeMenu };
}

// While a ship flies on the map: the site's nav goes (menu.css, by
// html[data-flight]), and the menu's Site tab has its pages instead.
export function useFlightMode(on) {
  useEffect(() => {
    if (!on) return undefined;
    const html = document.documentElement;
    html.dataset.flight = '';
    return () => {
      delete html.dataset.flight;
    };
  }, [on]);
}
