import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { local } from '../../lib/hooks';
import { skillTaken } from './skillsTaken';

// The wallet for the whole site (economy.js), held above the pages beside
// OnlineProvider, so the hangar, the record card and every world that pays
// into it share one. It's made on the runtime's saves (runtime/saves.js:
// `tp-pilot`, versioned) the first time something asks for it, not when
// the site opens: the wallet brings the crews, the galaxy's war and the
// runtime with it, and a portfolio page needs none of them. Made the first
// time ever, it grants whatever is fitted on every crew (economy.js does
// that when there's no save), so nobody loses a part to the shop.
//
// It reads what you've earned elsewhere as it goes: the achievements (the
// provider above), your standing with each universe's law, ordinary ships
// and pirates, your oath and rank in the galaxy's wars (pilotMarks.js), and
// the skill tree's nodes taken (its provider, below this one, tells
// skillsTaken.js).
//
// useEconomy() → { economy (null until it's loaded), version (bumps on
// every change, for a render), marks() → { standing: { side: levels },
// oath: { war, side, rank } } or null }

const SIDES = ['starwars', 'rickmorty', 'breakingbad'];
const EconomyContext = createContext({ economy: null, version: 0, want: () => {}, marks: () => null });

// One for the page visit, whoever asks first (and StrictMode's second mount
// finds it made, rather than a second wallet writing over the first).
let made = null;
let unlockedNow = [];

function load() {
  made ??= Promise.all([import('../../runtime'), import('./economy'), import('./pilotMarks'), import('../galaxy/warState'), import('../galaxy/allegiance')]).then(([rt, eco, pm, war, oath]) => {
    const allegiance = () => local.get(oath.SIDE_KEY, null);
    const points = (w) => war.mine(w).points;
    const economy = eco.createEconomy({
      saves: rt.runtime().saves,
      achievements: () => unlockedNow,
      standingOf: (side) => pm.standingLevels(local, side),
      rankOf: (side) => pm.warRank(allegiance(), side, points),
      skillOf: skillTaken,
    });
    // (a buy just before the tab closes is kept, not lost to the debounce)
    window.addEventListener('pagehide', () => economy.flush());
    const marks = () => ({ standing: Object.fromEntries(SIDES.map((s) => [s, pm.standingLevels(local, s)])), oath: pm.oathAndRank(allegiance(), points) });
    return { economy, marks };
  });
  return made;
}

export default function EconomyProvider({ children }) {
  const { unlocked } = useAchievements();
  // (each ask while nothing's loaded is another try: a chunk that failed
  // to load is tried again by the next page that wants the wallet)
  const [asks, setAsks] = useState(0);
  const [held, setHeld] = useState(null);
  const loaded = useRef(false);
  const [version, setVersion] = useState(0);
  const want = useCallback(() => {
    if (!loaded.current) setAsks((n) => n + 1);
  }, []);
  useEffect(() => {
    unlockedNow = unlocked;
  }, [unlocked]);

  useEffect(() => {
    if (!asks) return undefined;
    let gone = false;
    let off = null;
    load().then(
      (h) => {
        if (gone) return;
        loaded.current = true;
        setHeld(h);
        off = h.economy.on(() => setVersion((v) => v + 1));
      },
      () => {
        made = null; // (so the next ask, want()'s, imports it afresh)
      },
    );
    return () => {
      gone = true;
      off?.();
    };
  }, [asks]);

  // (an achievement can open a lock: what the shop shows changes with it)
  const value = useMemo(
    () => ({ economy: held?.economy ?? null, version: version + unlocked.length, want, marks: () => held?.marks() ?? null }),
    [held, version, unlocked.length, want],
  );
  return <EconomyContext.Provider value={value}>{children}</EconomyContext.Provider>;
}

// useEconomy() asks for the wallet (loading it if no page has yet);
// useEconomy({ ask: false }) only reads it if a page has already asked: the
// link to the other pilots is up on every page, and a portfolio page
// shouldn't fetch the wallet just to say your level (it's 1 in the hello
// till the universe or the galaxy has opened it)
// eslint-disable-next-line react-refresh/only-export-components
export function useEconomy({ ask = true } = {}) {
  const ctx = useContext(EconomyContext);
  const { want } = ctx;
  useEffect(() => {
    if (ask) want();
  }, [ask, want]);
  return ctx;
}
