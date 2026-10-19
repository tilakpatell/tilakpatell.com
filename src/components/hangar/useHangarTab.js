import { useCallback, useState } from 'react';
import { local } from '../../lib/hooks';
import { TAB_KEY, readTab } from './hangarRules';

// The Hangar's tab, the one last used (this browser's: hangarRules.js's
// TAB_KEY), for a page that opens the Hangar on one of its own.
//
// useHangarTab() → [tab, setTab]
export function useHangarTab() {
  const [tab, setTabState] = useState(() => readTab(local.get(TAB_KEY)));
  const setTab = useCallback((t) => {
    setTabState(t);
    local.set(TAB_KEY, t);
  }, []);
  return [tab, setTab];
}
