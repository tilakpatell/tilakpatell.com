// The explorer's record (tp-explore): every generated sector you've been in,
// which of its systems and things you've scanned, whether it's Surveyed (all
// its systems scanned), the data not yet paid at a station, and the counts.
// Sector keys and small sets only, never a generated thing. Pure.
//
// createRecord({ saves, now, later, cancel }) → { chart(sector, worth) → worth
//   paid in (0 if charted before), isCharted(sector), scanSystem(sector, i,
//   worth), scanThing(sector, id, worth) → worth paid in (0 if scanned
//   before), isScanned(sector, i), scannedIn(sector) → systems scanned,
//   survey(sector, systems, bonus) → bonus paid in once every system is
//   scanned (0 otherwise or again), data, payOut() → the data, the bank then
//   empty, record() → { sectors, systems, surveyed, furthest, data },
//   charted() → [sector keys], on(fn) → off, flush() }
// EXPLORE_KEY, KEEP

export const EXPLORE_KEY = 'tp-explore';
export const KEEP = 4000; // (charted sectors kept with their scans; the counts go on past it)
const THINGS_KEPT = 64; // (a sector's things scanned, kept by id)
const SAVE_AFTER = 500;

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const keyOf = (s) => (Array.isArray(s) ? s.slice(0, 3).map((v) => Math.round(Number(v) || 0)).join(',') : '0,0,0');
const gap = (s) => Math.max(...(Array.isArray(s) ? s.slice(0, 3) : [0]).map((v) => Math.abs(Number(v) || 0)));

export function createRecord({ saves = null, now = () => Date.now(), later = (fn, ms) => setTimeout(fn, ms), cancel = (h) => clearTimeout(h) } = {}) {
  saves?.register({ key: EXPLORE_KEY, version: 1 });
  const raw = isObject(saves?.get(EXPLORE_KEY, null)) ? saves.get(EXPLORE_KEY, null) : {};
  const charted = {};
  for (const [k, e] of Object.entries(isObject(raw.charted) ? raw.charted : {}))
    if (/^-?\d+,-?\d+,-?\d+$/.test(k) && isObject(e)) charted[k] = { t: Number.isFinite(e.t) ? e.t : 0, s: whole(e.s) >>> 0, done: e.done === true, ids: Array.isArray(e.ids) ? e.ids.filter((v) => typeof v === 'string').slice(-THINGS_KEPT) : [] };
  const counts = { sectors: 0, systems: 0, surveyed: 0, furthest: 0 };
  for (const k of Object.keys(counts)) counts[k] = whole(raw.counts?.[k]);
  let data = whole(raw.data);
  const listeners = new Set();
  let pending = null;

  const write = () => {
    pending = null;
    const keys = Object.keys(charted).sort((a, b) => charted[a].t - charted[b].t).slice(-KEEP);
    saves?.set(EXPLORE_KEY, { charted: Object.fromEntries(keys.map((k) => [k, { ...charted[k], ids: [...charted[k].ids] }])), data, counts: { ...counts } });
  };
  const changed = () => {
    if (saves && pending === null) {
      let ran = false;
      const h = later(() => ((ran = true), write()), SAVE_AFTER);
      if (!ran) pending = h;
    }
    for (const fn of listeners) fn();
  };
  const bank = (worth) => {
    const n = whole(worth);
    data += n;
    return n;
  };
  const entry = (sector) => charted[keyOf(sector)];
  const ensure = (sector) => (charted[keyOf(sector)] ??= { t: now(), s: 0, done: false, ids: [] });
  const bitCount = (s) => {
    let n = 0;
    for (let v = s >>> 0; v; v >>>= 1) n += v & 1;
    return n;
  };

  return {
    chart(sector, worth = 0) {
      if (entry(sector)) return 0;
      ensure(sector);
      counts.sectors++;
      counts.furthest = Math.max(counts.furthest, gap(sector));
      const n = bank(worth);
      changed();
      return n;
    },
    isCharted: (sector) => Boolean(entry(sector)),
    scanSystem(sector, i, worth = 0) {
      if (!Number.isInteger(i) || i < 0 || i > 31) return 0;
      const e = ensure(sector);
      if (e.s & (1 << i)) return 0;
      e.s = (e.s | (1 << i)) >>> 0;
      counts.systems++;
      const n = bank(worth);
      changed();
      return n;
    },
    scanThing(sector, id, worth = 0) {
      if (typeof id !== 'string' || !id) return 0;
      const e = ensure(sector);
      if (e.ids.includes(id)) return 0;
      e.ids.push(id);
      if (e.ids.length > THINGS_KEPT) e.ids.shift();
      const n = bank(worth);
      changed();
      return n;
    },
    isScanned: (sector, i) => Boolean((entry(sector)?.s ?? 0) & (1 << i)),
    scannedIn: (sector) => bitCount(entry(sector)?.s ?? 0),
    survey(sector, systems, bonus = 0) {
      const e = entry(sector);
      if (!e || e.done || !(systems > 0) || bitCount(e.s) < systems) return 0;
      e.done = true;
      counts.surveyed++;
      const n = bank(bonus);
      changed();
      return n;
    },
    get data() {
      return data;
    },
    payOut() {
      const n = data;
      if (!n) return 0;
      data = 0;
      changed();
      return n;
    },
    record: () => ({ ...counts, data }),
    charted: () => Object.keys(charted),
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
