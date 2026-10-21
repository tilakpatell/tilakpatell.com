// The heist record (spec 2026-10-18-avengers-hq-fix-and-hub-design, §7):
// tp-hq-heist holds { stones: { [stone]: firstWonAt | null }, tries: {
// [placeId]: n } }, kept through runtime/saves at version 1. A stone held
// before the record began has no time (null). Pure: it imports nothing, not
// even ./stones, so stones.js → heist.js is the only edge between them, which
// is why HEIST_STONES copies STONE_IDS (a test holds them equal).

export const HEIST_KEY = 'tp-hq-heist';
export const HEIST_VERSION = 1;
export const BEFORE = 'Before records began';

export const HEIST_STONES = ['space', 'mind', 'reality', 'power', 'time', 'soul'];
export const HEIST_GAMES = ['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'spidey', 'vault'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// what was stored, with the junk dropped: a stone's time is null or a finite
// number ≥ 0, a game's tries a whole number ≥ 1
export function cleanHeist(raw) {
  const out = { stones: {}, tries: {} };
  if (!isObj(raw)) return out;
  if (isObj(raw.stones)) {
    for (const id of HEIST_STONES) {
      if (!(id in raw.stones)) continue;
      const t = raw.stones[id];
      if (t === null || (typeof t === 'number' && Number.isFinite(t) && t >= 0)) out.stones[id] = t;
    }
  }
  if (isObj(raw.tries)) {
    for (const id of HEIST_GAMES) {
      const n = raw.tries[id];
      if (typeof n === 'number' && Number.isFinite(n) && Math.floor(n) >= 1) out.tries[id] = Math.floor(n);
    }
  }
  return out;
}

// the record, with every stone already held but never timed as won before records began
export function migrateHeist(raw, held = []) {
  const rec = cleanHeist(raw);
  for (const id of held) if (HEIST_STONES.includes(id) && !(id in rec.stones)) rec.stones[id] = null;
  return rec;
}

// the first time a whole stone is won; never a later one
export function withStone(rec, id, at) {
  if (!HEIST_STONES.includes(id) || id in rec.stones) return rec;
  return { ...rec, stones: { ...rec.stones, [id]: at } };
}

// one more start of a game
export function withTry(rec, game) {
  if (!HEIST_GAMES.includes(game)) return rec;
  return { ...rec, tries: { ...rec.tries, [game]: (rec.tries[game] ?? 0) + 1 } };
}

// (the registered migration only cleans an unversioned value; loadHeist cleans
// a wrapped one too, and adds the stones held. Reading never writes a missing key.)
export function registerHeist(saves) {
  saves.register({ key: HEIST_KEY, version: HEIST_VERSION, migrate: cleanHeist });
}

export const loadHeist = (saves, held = []) => migrateHeist(saves.get(HEIST_KEY, null), held);

// a span as at most two units, the larger first, each floored
export function spanWords(ms) {
  const m = Number.isFinite(ms) ? Math.floor(ms / 60e3) : 0;
  if (m < 1) return 'Under a minute';
  const units = [
    [Math.floor(m / 1440), 'day'],
    [Math.floor((m % 1440) / 60), 'hour'],
    [m % 60, 'minute'],
  ];
  const first = units.findIndex(([n]) => n > 0);
  return units
    .slice(first, first + 2)
    .filter(([n]) => n > 0)
    .map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`)
    .join(' ');
}

// the summary's words: the first stone to the sixth, and each game's tries and best
export function heistSummary(rec, { games, bests = {} }) {
  const times = HEIST_STONES.map((id) => rec.stones[id]);
  const timed = times.every((t) => typeof t === 'number' && Number.isFinite(t));
  const span = timed ? spanWords(Math.max(...times) - Math.min(...times)) : BEFORE;
  // (a game never tried while a stone came from before the record: its tries were before it too)
  const before = HEIST_STONES.some((id) => rec.stones[id] === null);
  return {
    span,
    rows: games.map(({ id, name }) => {
      const n = rec.tries[id] ?? 0;
      return { id, name, tries: n ? `${n} ${n === 1 ? 'try' : 'tries'}` : before ? BEFORE : 'No tries yet', best: bests[id] ?? 'No best kept' };
    }),
  };
}
