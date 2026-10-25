// C-137's one toast (./useRmToast.js puts it over RmWorld.jsx): a line said,
// a thing done, a note. What someone's saying stays up till it's been read:
// what follows it (the thing done when a talk ticks, the story's closing
// line, a count) waits till then, where what Morty does himself (another
// talk, a catch, a door) covers it at once. Pure: no React.
//
//   TOAST_MS — how long each stays up: a line said, a bad one, the rest.
//   toastLife(t) → how long `t` stays up (ms).
//   readFor(t, now) → ms till `t` has been read: a line said, its lineHold
//     (./living.js), at most as long as it's up; anything else, nought.
//   createToastSlot({ show, now, later, cancel }) → { put(t, { after }), due(), clear() }
//     `show(t)` puts `t` (stamped `at`) up; `after`: wait till what's up has
//     been read. One waits at a time: a later one takes its place, and it
//     waits on behind a line said meanwhile. `due()`: ms till what waits goes
//     up (nought with nothing waiting). `clear()` drops what waits.

import { lineHold } from './living';

export const TOAST_MS = { say: 5600, bad: 3400, other: 4400 };

export const toastLife = (t) => (t.kind === 'say' ? TOAST_MS.say : t.bad ? TOAST_MS.bad : TOAST_MS.other);

export function readFor(t, now) {
  if (t?.kind !== 'say') return 0;
  return Math.max(0, t.at + Math.min(lineHold(t.text) * 1000, TOAST_MS.say) - now);
}

export function createToastSlot({ show, now = () => performance.now(), later = setTimeout, cancel = clearTimeout }) {
  let up = null;
  let waiting = null;
  let timer = null;
  const put = (t) => {
    up = { ...t, at: now() };
    show(up);
  };
  const left = () => (up && now() < up.at + toastLife(up) ? readFor(up, now()) : 0);
  const next = () => {
    timer = null;
    const wait = left();
    if (wait > 0) timer = later(next, wait);
    else {
      const t = waiting;
      waiting = null;
      put(t);
    }
  };
  return {
    put(t, { after = false } = {}) {
      if (!after) return put(t);
      waiting = t;
      if (timer == null) next();
    },
    due: () => (waiting ? left() : 0),
    clear() {
      if (timer != null) cancel(timer);
      timer = null;
      waiting = null;
    },
  };
}
