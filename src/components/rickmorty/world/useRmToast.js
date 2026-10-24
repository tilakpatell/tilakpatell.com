import { useCallback, useEffect, useRef, useState } from 'react';
import { preloadVoiced, sayVoiced, stopVoiced } from '../../../lib/voiced';
import { createToastSlot, toastLife } from './toastSlot';
import { lineSaid } from './voicelines';

// C-137's one toast over RmWorld.jsx (./toastSlot.js's slot, as React state):
// what's said is heard in the speaker's own voice where it's been made
// (./voicelines.js, lib/voiced.js) as it goes up; the next thing said,
// voiced or not, stops it. Each toast comes down when its time's up.
//
// useRmToast() → { toast, say(t, { after }) } — `after`: wait till the line
// that's up has been read (a thing done, the story's closing line, a count).
export function useRmToast() {
  const [toast, setToast] = useState(null);
  const slot = useRef(null);
  slot.current ??= createToastSlot({
    show: (t) => {
      setToast(t);
      if (t.kind === 'say') {
        const said = lineSaid(t.text);
        sayVoiced(said?.who, said?.text);
      }
    },
  });
  useEffect(() => {
    const s = slot.current;
    preloadVoiced();
    return () => {
      s.clear();
      stopVoiced();
    };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastLife(toast));
    return () => clearTimeout(t);
  }, [toast]);
  const say = useCallback((t, opts) => slot.current.put(t, opts), []);
  return { toast, say };
}
