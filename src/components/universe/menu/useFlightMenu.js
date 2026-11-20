import { useCallback, useEffect, useState } from 'react';
import { local } from '../../../lib/hooks';
import { MENU_TAB_KEY, readMenuTab } from './dress';

// The flight menu's state, the page's (pages/Universe.jsx, pages/Galaxy.jsx):
// open or shut, the tab it's on (kept between visits), and the Ship tab's
// page: its overview, or one of the Hangar's (the Hangar's own last tab is
// the page's, hangarRules.js's TAB_KEY). `enabled` false (no ship, a jump,
// the nav map over it) shuts it.
//   useFlightMenu({ enabled }) → { open, tab, setTab, openMenu(tab?), closeMenu(), page, setPage, openShip(page) }
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
  const [page, setPage] = useState('overview');
  // (the Ship tab on a page of its own: the shipyard a dock opens, a Hangar page asked for by name)
  const openShip = useCallback(
    (p) => {
      setTab('ship');
      setPage(p ?? 'overview');
      setOpen(true);
    },
    [setTab],
  );
  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);
  return { open: open && enabled, tab, setTab, openMenu, closeMenu, page, setPage, openShip };
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
