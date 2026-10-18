import { useCallback, useRef, useState } from 'react';
import { CREW_KEY, setStyle } from '../../lib/crew/crewStyle';
import { local } from '../../lib/hooks';
import { localSaves } from '../../runtime/local';
import { HERO_KEY, readCrewStyle } from '../galaxy/shared/arms';

// The crew's style (lib/crew/crewStyle.js's tp-crew), kept the moment it
// changes: → [crew, set(who, patch)]. Read as the galaxy reads it (seeded
// once from the hero picked there, so the Crew and Arms show what its
// worlds dress them in); its worlds read the same save when they're next
// opened.
export function useCrewStyle() {
  const [crew, setCrew] = useState(() => readCrewStyle(localSaves(), local.get(HERO_KEY)));
  const now = useRef(crew);
  now.current = crew;
  const set = useCallback((who, patch) => {
    const next = setStyle(now.current, who, patch);
    localSaves().set(CREW_KEY, next);
    setCrew(next);
  }, []);
  return [crew, set];
}
