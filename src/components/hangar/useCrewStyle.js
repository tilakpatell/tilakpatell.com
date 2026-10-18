import { useCallback, useState } from 'react';
import { CREW_KEY, readCrew, registerCrew, setStyle } from '../../lib/crew/crewStyle';
import { localSaves } from '../../runtime/local';

// The crew's style (lib/crew/crewStyle.js's tp-crew), kept the moment it
// changes: → [crew, set(who, patch)]. The galaxy's worlds read the same save
// when they're next opened (galaxy/heroStyle.js).
export function useCrewStyle() {
  const [crew, setCrew] = useState(() => {
    const saves = localSaves();
    registerCrew(saves);
    return readCrew(saves.get(CREW_KEY, null));
  });
  const set = useCallback((who, patch) => {
    setCrew((was) => {
      const next = setStyle(was, who, patch);
      localSaves().set(CREW_KEY, next);
      return next;
    });
  }, []);
  return [crew, set];
}
