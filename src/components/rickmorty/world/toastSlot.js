// C-137's one toast (./useRmToast.js puts it over RmWorld.jsx): a line said,
// a thing done, a note. What someone's saying stays up till it's been read:
// what follows it (the thing done when a talk ticks, the story's closing
// line, a count) waits till then, where what Morty does himself (another
// talk, a catch, a door) covers it at once. Pure: no React.
//
//   TOAST_MS — how long each stays up: a line said (at least, at most), a
//     bad one, the rest.
//   readMs(text) → the ms a line takes to read: ./living.js's lineHold rate
//     (0.8 s and 55 ms a character, 1.6 s at least), without its 6 s cap.
//   toastLife(t) → how long `t` stays up (ms): a line said, long enough that
//     its fade (from 88% of it: world.css's rm-toast) starts once it's read.
//   readFor(t, now) → ms till `t` has been read: a line said, its readMs, at
//     most as long as it's up; one held (`hold`, ms), that long; anything
//     else, nought.
//   createToastSlot({ show, now, later, cancel }) → { put(t, { after, onShow }), due(), pending(), reading(), clear() }
//     `show(t)` puts `t` (stamped `at`) up; `after`: wait till what's up has
//     been read; `onShow()`: run as `t` goes up. One waits at a time: a later
//     one takes its place (and the onShow of what it put behind runs as it
//     goes up), and it waits on behind a line said meanwhile, or behind a
//     note put up meanwhile for that note's read (`hold`). `due()`: ms till
//     what waits goes up (nought with nothing waiting). `pending()`: what
//     waits (null with nothing waiting: a planet's page that leaves keeps
//     the story's line for the next). `reading()`: whether a line (or a note
//     held) that's up is still being read (a passer-by's bark waits for it).
//     `clear()` drops what waits.

export const TOAST_MS = { say: 5600, sayMost: 14000, bad: 3400, other: 4400 };
const FADE_AT = 0.88;

export const readMs = (text) => Math.round(Math.max(1.6, 0.8 + (typeof text === 'string' ? text.length : 0) * 0.055) * 1000);

export const toastLife = (t) => (t.kind === 'say' ? Math.min(TOAST_MS.sayMost, Math.max(TOAST_MS.say, Math.ceil(readMs(t.text) / FADE_AT))) : t.bad ? TOAST_MS.bad : TOAST_MS.other);

export function readFor(t, now) {
  if (t?.hold != null) return Math.max(0, t.at + t.hold - now);
  if (t?.kind !== 'say') return 0;
  return Math.max(0, t.at + Math.min(readMs(t.text), toastLife(t)) - now);
}

export function createToastSlot({ show, now = () => performance.now(), later = setTimeout, cancel = clearTimeout }) {
  let up = null;
  let waiting = null;
  let told = [];
  let timer = null;
  const put = (t, onShow) => {
    up = { ...t, at: now() };
    show(up);
    onShow.forEach((f) => f());
  };
  const left = () => (up && now() < up.at + toastLife(up) ? readFor(up, now()) : 0);
  const next = () => {
    timer = null;
    const wait = left();
    if (wait > 0) timer = later(next, wait);
    else {
      const [t, f] = [waiting, told];
      waiting = null;
      told = [];
      put(t, f);
    }
  };
  return {
    put(t, { after = false, onShow } = {}) {
      // (what Morty does himself while something waits: a note gets its read before that goes up over it)
      if (!after) return put(waiting && t.kind !== 'say' ? { ...t, hold: Math.min(readMs(t.text), toastLife(t)) } : t, onShow ? [onShow] : []);
      waiting = t;
      if (onShow) told.push(onShow);
      if (timer == null) next();
    },
    due: () => (waiting ? left() : 0),
    pending: () => waiting,
    reading: () => left() > 0,
    clear() {
      if (timer != null) cancel(timer);
      timer = null;
      waiting = null;
      told = [];
    },
  };
}
