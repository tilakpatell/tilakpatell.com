// A level's fetches in one queue (the GPU-first design's lane N4): every file
// the stream, the loader and the coarse grid want goes through here, so the
// order is one order and the bytes one count. Each ask has a class, asked in
// this order:
//
//   coarse    the horizon grid (its index, its cells, the impostors' first rows)
//   boot      the far list, the near cells and everything the boot slice wears
//   cell      a fine cell's collision as you walk (never held: walkable first)
//   detail    the finer LODs and the tier's texture rows
//   prefetch  what lies two cells ahead on the heading
//
// and within a class by `rank()`, read when a slot frees (so a ranking by
// where you are is current), the highest first. A path is asked once: a
// second ask shares the first's answer, and moves a waiting ask up to its
// class. `hold(classes)` keeps those classes waiting (the data budget);
// `abandon(test)` drops waiting asks (a heading that flips) and ends them as
// null, never one in flight: that one lands and is kept, so a later ask for
// it is the kept bytes, not another download.
//
// An ask that has not answered in `timeout()` (the site's pool's: 20 s, a
// second more a megabyte, lib/net/assetFetch.js) fails and frees its slot,
// so one stalled request (the bucket's HTTP/2 resets, seen on Hoth) does
// not hold the whole level back; its late answer is dropped.
//
//   createFetchQueue({ fetch, parallel, signal, timeout }) → { get(path, { cls, rank, tag }) → Promise<ArrayBuffer | null>,
//     hold(classes), abandon(test) → n, pending(cls?), bytes(), dispose() }
//   fetch(path, { signal }) → Promise<ArrayBuffer>

import { TIMEOUT } from '../../../../lib/net/assetFetch.js';

export const CLASSES = ['coarse', 'boot', 'cell', 'detail', 'prefetch'];
const ORDER = Object.fromEntries(CLASSES.map((c, i) => [c, i]));

export function createFetchQueue({ fetch, parallel = 4, signal = null, timeout = TIMEOUT, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const ctl = new AbortController();
  signal?.addEventListener('abort', () => dispose());
  const waiting = new Map(); // path → item
  const flying = new Map(); // path → item
  const kept = new Map(); // path → ArrayBuffer (landed with no one waiting for it any more)
  let held = new Set();
  let total = 0;
  let gone = false;

  function next() {
    let best = null;
    let bestRank = -Infinity;
    for (const item of waiting.values()) {
      if (held.has(item.cls)) continue;
      if (best && ORDER[item.cls] > ORDER[best.cls]) continue;
      const r = item.rank?.() ?? 0;
      if (!best || ORDER[item.cls] < ORDER[best.cls] || r > bestRank) {
        best = item;
        bestRank = r;
      }
    }
    return best;
  }

  function pump() {
    while (!gone && flying.size < parallel) {
      const item = next();
      if (!item) return;
      waiting.delete(item.path);
      flying.set(item.path, item);
      let late = false;
      const timer = setTimer(() => {
        late = true;
        flying.delete(item.path);
        item.fail(new Error(`${item.path} did not answer`));
        pump();
      }, timeout(0));
      fetch(item.path, { signal: ctl.signal }).then(
        (buf) => {
          clearTimer(timer);
          if (late) return;
          flying.delete(item.path);
          if (gone) return item.done(null);
          total += buf?.byteLength ?? 0;
          if (item.abandoned) kept.set(item.path, buf);
          item.done(buf);
          pump();
        },
        (e) => {
          clearTimer(timer);
          if (late) return;
          flying.delete(item.path);
          if (gone) item.done(null);
          else item.fail(e);
          pump();
        },
      );
    }
  }

  function get(path, { cls = 'detail', rank = null, tag = null } = {}) {
    if (gone) return Promise.resolve(null);
    if (kept.has(path)) {
      const buf = kept.get(path);
      kept.delete(path);
      return Promise.resolve(buf);
    }
    const had = waiting.get(path) ?? flying.get(path);
    if (had) {
      had.abandoned = false;
      if (ORDER[cls] < ORDER[had.cls]) {
        had.cls = cls;
        had.rank = rank ?? had.rank;
        had.tag = tag;
      }
      pump();
      return had.promise;
    }
    const item = { path, cls, rank, tag, abandoned: false };
    item.promise = new Promise((resolve, reject) => {
      item.done = resolve;
      item.fail = reject;
    });
    waiting.set(path, item);
    pump();
    return item.promise;
  }

  function dispose() {
    if (gone) return;
    gone = true;
    ctl.abort();
    for (const item of waiting.values()) item.done(null);
    waiting.clear();
    kept.clear();
  }

  return {
    get,
    hold(classes) {
      held = new Set(classes);
      pump();
    },
    abandon(test) {
      let n = 0;
      for (const item of [...waiting.values()]) {
        if (!test(item)) continue;
        waiting.delete(item.path);
        item.done(null);
        n++;
      }
      // (in flight: let land, and kept for whoever asks next)
      for (const item of flying.values()) if (test(item)) item.abandoned = true;
      return n;
    },
    pending(cls = null) {
      let n = 0;
      for (const m of [waiting, flying]) for (const item of m.values()) if (!cls || item.cls === cls) n++;
      return n;
    },
    bytes: () => total,
    dispose,
  };
}
