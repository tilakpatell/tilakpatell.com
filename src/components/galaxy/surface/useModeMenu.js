// The landing's mode menu, for the surface page (ModeMenu.jsx draws it):
// shown once the title card is done, unless the way here named a mode or a
// mission (?mode=, ?mission=) or you've said not to ask (kept in the
// browser); opened again from the Menu's Change mode.
//
// useModeMenu({ system, phase, named }) → { open, setOpen, cards, ask, setAsk }

import { useEffect, useMemo, useRef, useState } from 'react';
import { local } from '../../../lib/hooks';
import { MODE_ASK_KEY, modesFor, readAsk } from './modes';

export function useModeMenu({ system, phase, named }) {
  const [ask, setAskKept] = useState(() => readAsk(local.get(MODE_ASK_KEY)));
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || phase === 'landing' || named || ask === 'never') return;
    shown.current = true;
    setOpen(true);
  }, [phase, named, ask]);
  const cards = useMemo(() => modesFor(system), [system]);
  const setAsk = (on) => {
    const v = on ? 'ask' : 'never';
    setAskKept(v);
    local.set(MODE_ASK_KEY, v);
  };
  return { open, setOpen, cards, ask: ask === 'ask', setAsk };
}
