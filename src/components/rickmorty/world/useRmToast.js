import { useCallback, useEffect, useRef, useState } from 'react';
import { preloadVoiced, sayVoiced, stopVoiced } from '../../../lib/voiced';
import { createToastSlot } from './toastSlot';
import { lineSaid } from './voicelines';

// C-137's one toast over RmWorld.jsx (./toastSlot.js's slot, as React state):
// what's said is heard in the speaker's own voice where it's been made
// (./voicelines.js, lib/voiced.js) as it goes up; the next thing said,
// voiced or not, stops it. Each toast comes down when its time's up (the
// slot's own timer: never the next one, put up in the same moment).
//
// useRmToast() → { toast, say(t, { after, onShow }), due(), reading() } —
// `after`: wait till the line that's up has been read (a thing done, the
// story's closing line, a count), `onShow` run as it goes up; `due()`: ms till
// what waits goes up (a page that's leaving holds for it); `reading()`: a line
// up is still being read (a bark waits).
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
    hide: (t) => setToast((cur) => (cur === t ? null : cur)),
  });
  useEffect(() => {
    const s = slot.current;
    preloadVoiced();
    return () => {
      s.clear();
      stopVoiced();
    };
  }, []);
  const say = useCallback((t, opts) => slot.current.put(t, opts), []);
  const due = useCallback(() => slot.current.due(), []);
  const reading = useCallback(() => slot.current.reading(), []);
  return { toast, say, due, reading };
}
