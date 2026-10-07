// The registry the AI inspector reads: whichever world is on screen puts
// its trace, schedule and actors here, beside its `window.__X__` hook (DEV
// only, as those are), and the overlay draws from `current()`. One world
// at a time; a second `register` replaces the first. `flags()` reads the
// address once: `?ai=1` (or localStorage 'tp-ai') turns the overlay on,
// `?seed=N` pins the visit's streams. No three.js, no React, and nothing
// here touches `window` unless it's there, so it imports in Node.
//
//   register(worldId, { trace, schedule, actors = new Map(), agents = () => [] })
//     agents() → [{ id, kind, at, mode }]
//   unregister(worldId)            only if that world is still the current one
//   current() → { worldId, trace, schedule, actors, agents } | null
//   onChange(fn) → off             fn(current() | null) on every change
//   flags({ search, storage } = {}) → { ai: bool, seed: number | null }

let now = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    // a broken overlay mustn't take the world's mount down with it
    try {
      fn(now);
    } catch {
      /* ignore */
    }
  }
}

// cheap enough for a scene's dispose/mount pair to call every remount
export function register(worldId, { trace, schedule, actors = new Map(), agents = () => [] } = {}) {
  now = { worldId, trace, schedule, actors, agents };
  notify();
}

export function unregister(worldId) {
  // a scene's dispose can run after the next world's mount; it mustn't
  // clear the world that replaced it
  if (!now || now.worldId !== worldId) return;
  now = null;
  notify();
}

export function current() {
  return now;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function read(search, storage) {
  const params = new URLSearchParams(search || '');
  let stored = null;
  try {
    stored = storage ? storage.getItem('tp-ai') : null;
  } catch {
    // private windows and blocked site data throw on access
  }
  const ai = params.get('ai') === '1' || (stored !== null && stored !== '' && stored !== '0' && stored !== 'off');
  const raw = params.get('seed');
  const seed = raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
  return { ai, seed };
}

let cached = null;

export function flags({ search, storage } = {}) {
  // an injected value (a test) is read fresh; the page's own address is
  // read once, since a visit's flags don't change under it
  if (search !== undefined || storage !== undefined) return read(search, storage);
  if (cached) return cached;
  const win = typeof window !== 'undefined' ? window : null;
  let store = null;
  try {
    store = win ? win.localStorage : null;
  } catch {
    /* blocked */
  }
  cached = read(win && win.location ? win.location.search : '', store);
  return cached;
}
