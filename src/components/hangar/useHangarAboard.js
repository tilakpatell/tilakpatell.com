import { useCallback } from 'react';
import { useAchievements } from '../Achievements';
import { useShipyardPage } from '../universe/shipyard/useShipyardPage';
import { useHangarTab } from './useHangarTab';

// What a page that brings its own Hangar door needs (Rick and Morty's: the
// street, the Citadel, the planets): the ship's yard as the universe map and
// the galaxy keep it (useShipyardPage, so a fit made here flies there too),
// the tab last used, and a way to open it, on a tab or the last one. The
// panel is HangarAboard.jsx's.
//
// useHangarAboard(ship) → { yard (useShipyardPage's), tab, setTab, open(tab?) }
export function useHangarAboard(ship = 'cruiser') {
  const { unlocked } = useAchievements();
  const yard = useShipyardPage({ ship, unlocked });
  const [tab, setTab] = useHangarTab();
  const { setYard } = yard;
  const open = useCallback(
    (t) => {
      if (t) setTab(t);
      setYard(true);
    },
    [setTab, setYard],
  );
  return { yard, tab, setTab, open };
}
