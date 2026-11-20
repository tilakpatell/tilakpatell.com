// The market's own saves, beside the wallet's (runtime/saves.js, made with the
// same saves in EconomyProvider.jsx): each crew's hold (tp-ships), and what
// you've sold and bought at each station lately, the fields you've emptied
// and the wrecks you've salvaged (tp-market). Deltas only, never a generated
// thing. Shocks (an event's shortage) are the visit's, not kept. Pure.
//
// createMarket({ saves, now, later, cancel }) → { hold(crew, room) → hold.js's
//   ops on that crew's lots, cargo(crew, room) → { has, take } for the wallet,
//   yours(stationId, good, t) → net units lately, note(stationId, good, n, t)
//   (n sold +, bought −), empty(id, t), isEmpty(id, t), salvage(id),
//   salvaged(id), shock(stationId, good, mul, until), shockOf(stationId, good,
//   t), pod() → the cargo pod or null, setPod(pod | null), changed(), on(fn) → off, flush() }
//   (the pod: signatures/pod.js's, one at a time, kept in tp-market)
// SHIPS_KEY, MARKET_KEY, EMPTY_FOR (ms a field stays empty), KEEP (the most of each kept)

import { holdOps, readHold } from './hold';
import { yoursAt } from './prices';

export const SHIPS_KEY = 'tp-ships';
export const MARKET_KEY = 'tp-market';
export const EMPTY_FOR = 2 * 3600 * 1000;
export const KEEP = 2000;
const SAVE_AFTER = 500;

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const keepLast = (obj, max) => {
  const keys = Object.keys(obj);
  if (keys.length <= max) return obj;
  const keepKeys = keys.sort((a, b) => (obj[a]?.t ?? obj[a]) - (obj[b]?.t ?? obj[b])).slice(-max);
  return Object.fromEntries(keepKeys.map((k) => [k, obj[k]]));
};

export function createMarket({ saves = null, now = () => Date.now(), later = (fn, ms) => setTimeout(fn, ms), cancel = (h) => clearTimeout(h) } = {}) {
  saves?.register({ key: SHIPS_KEY, version: 1 });
  saves?.register({ key: MARKET_KEY, version: 1 });
  const ships = isObject(saves?.get(SHIPS_KEY, null)) ? saves.get(SHIPS_KEY, null) : {};
  const raw = isObject(saves?.get(MARKET_KEY, null)) ? saves.get(MARKET_KEY, null) : {};
  const holds = {};
  for (const [crew, s] of Object.entries(ships)) if (isObject(s)) holds[crew] = readHold(s.hold);
  const yours = {};
  for (const [k, e] of Object.entries(isObject(raw.yours) ? raw.yours : {})) if (isObject(e) && Number.isFinite(e.n) && Number.isFinite(e.t)) yours[k] = { n: e.n, t: e.t };
  const emptied = {};
  for (const [k, t] of Object.entries(isObject(raw.emptied) ? raw.emptied : {})) if (Number.isFinite(t)) emptied[k] = t;
  const salvagedSet = new Set(Array.isArray(raw.salvaged) ? raw.salvaged.filter((v) => typeof v === 'string').slice(-KEEP) : []);
  const readPod = (p) => (isObject(p) && Array.isArray(p.at) && p.at.length === 3 && p.at.every(Number.isFinite) ? { crew: typeof p.crew === 'string' ? p.crew : null, at: [...p.at], sector: Array.isArray(p.sector) ? [...p.sector] : null, t: Number.isFinite(p.t) ? p.t : 0, lots: readHold(p.lots) } : null);
  let pod = readPod(raw.pod);
  if (pod && !pod.lots.length) pod = null;
  const shocks = new Map();
  const listeners = new Set();
  let pending = null;

  const write = () => {
    pending = null;
    saves?.set(SHIPS_KEY, Object.fromEntries(Object.entries(holds).map(([crew, lots]) => [crew, { hold: lots.map((l) => ({ ...l, from: { ...l.from } })) }])));
    saves?.set(MARKET_KEY, { yours: keepLast(yours, KEEP), emptied: keepLast(emptied, KEEP), salvaged: [...salvagedSet].slice(-KEEP), pod });
  };
  const changed = () => {
    if (saves && pending === null) {
      // (a timer that runs at once, as a test's may, has written already: nothing's pending)
      let ran = false;
      const h = later(() => ((ran = true), write()), SAVE_AFTER);
      if (!ran) pending = h;
    }
    for (const fn of listeners) fn();
  };
  const lotsOf = (crew) => (holds[crew] ??= []);
  // a hold's ops that save what they change
  const hold = (crew, room) => {
    const ops = holdOps(lotsOf(crew), room);
    const saving = (fn) => (...a) => {
      const r = fn(...a);
      if (r) changed();
      return r;
    };
    return { ...ops, get used() { return ops.used; }, get free() { return ops.free; }, add: saving(ops.add), remove: (g, n) => { const r = ops.remove(g, n); if (r.length) changed(); return r; }, take: saving(ops.take) };
  };
  const key = (stationId, good) => `${stationId}|${good}`;

  return {
    hold,
    cargo: (crew, room) => {
      const h = () => hold(crew, room);
      return { has: (goods) => h().has(goods), take: (goods) => h().take(goods) };
    },
    yours: (stationId, good, t = now()) => yoursAt(yours[key(stationId, good)], t),
    note(stationId, good, n, t = now()) {
      if (!Number.isFinite(n) || !n) return;
      const k = key(stationId, good);
      yours[k] = { n: yoursAt(yours[k], t) + n, t };
      changed();
    },
    empty(id, t = now()) {
      emptied[id] = t;
      changed();
    },
    isEmpty: (id, t = now()) => Number.isFinite(emptied[id]) && t - emptied[id] < EMPTY_FOR,
    salvage(id) {
      if (salvagedSet.has(id)) return;
      salvagedSet.add(id);
      changed();
    },
    salvaged: (id) => salvagedSet.has(id),
    shock(stationId, good, mul, until) {
      if (Number.isFinite(mul) && mul > 0 && Number.isFinite(until)) shocks.set(key(stationId, good), { mul, until });
      changed();
    },
    shockOf(stationId, good, t = now()) {
      const s = shocks.get(key(stationId, good));
      return s && t < s.until ? s.mul : 1;
    },
    pod: () => pod,
    setPod(next) {
      pod = readPod(next);
      if (pod && !pod.lots.length) pod = null;
      changed();
    },
    changed,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    flush() {
      if (pending === null) return;
      cancel(pending);
      write();
    },
  };
}
