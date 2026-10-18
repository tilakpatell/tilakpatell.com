import { useCallback, useMemo } from 'react';
import { useAchievements } from '../Achievements';
import { useShipyardPage } from '../universe/shipyard/useShipyardPage';
import { statsOf } from '../universe/outfit';
import { useHangarTab } from './useHangarTab';
import { useSkills } from './skills/useSkills';

// What a page that brings its own Hangar door needs (Rick and Morty's: the
// street, the Citadel, the planets): the ship's yard as the universe map and
// the galaxy keep it (useShipyardPage, so a fit made here flies there too),
// the tab last used, a way to open it, on a tab or the last one, and what
// the ship does as it's fitted and skilled (outfit.js's statsOf, with the
// skill tree's fx) for a world that flies it. The panel is HangarAboard.jsx's.
//
// useHangarAboard(ship) → { yard (useShipyardPage's), tab, setTab, open(tab?), stats, fx, picks }
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
  const { fx, picks } = useSkills();
  const { loadout, build, tune } = yard;
  const stats = useMemo(() => statsOf(ship, loadout, build, tune, fx), [ship, loadout, build, tune, fx]);
  return { yard, tab, setTab, open, stats, fx, picks };
}
