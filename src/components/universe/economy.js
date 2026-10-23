// The wallet and the flight record: one for the whole site, so whatever you
// do on the universe map, in its sectors, in the galaxy or down on its
// worlds pays into the same credits and experience, and the hangar spends
// them. It's local-first: credits, xp and what you own live in this
// browser's storage (runtime/saves.js, `tp-pilot`, version 2), and only the
// level goes out on the wire, so no other pilot can make you richer or
// poorer.
//
// Each deed earns from EARN (the keys the scenes already note), times its
// side's rate (SIDE_RATES). Killing civilians or patrols is not in EARN, so
// it earns nothing: standing already punishes it, and the wallet mustn't
// make it a wash. xp climbs the LEVELS, eleven of them, Rookie to Legend.
// An item (catalog.js's) is { key, id, price, needs }; canBuy checks it's
// not owned, that each need is met, then the price. What's owned is kept by
// the item's key (kind, slot and id: 'paint:paint:portal'), since an id alone
// can be two things ('portal' is a booster and a paint both); an item with
// no key is kept by its id. checkout buys a list at once or none of it (the
// shipyard's draft, yardRules.js); sell gives back SELL_BACK of the price of
// something owned (the yard says what's fitted nowhere). The log keeps the
// last LOG_MAX credits in and out, { t, kind: 'earn' | 'buy' | 'sell' |
// 'spend', what, n }, for the yard's record of where they went.
//
// The first time the wallet appears, everything fitted on every crew (its
// parts and paint, its hull's modules and its garage's) is granted as
// owned, so nobody loses what they had. Pure (no three.js, no DOM), so it's
// tested in Node.
//
// createEconomy({ saves, achievements, standingOf, rankOf, skillOf, later, cancel })
//   → { credits, xp, level, owned, spent, earned, earn(what, n, { side }),
//   canBuy(item), buy(item), checkout(items), canSell(item), sell(item), log,
//   spend(n), owns(id), grant(ids), record(), on(fn) → off, flush() }
// deedToEarn(deed) → an EARN key or null; earnNote(earned) → { text, level }
// or null; goodStanding(level) → boolean

import { RANKS } from '../galaxy/ranks';
import { CREWS } from './crews';
import { LOADOUT_KEY, SLOTS, STOCK, readLoadouts } from './outfit';
import { BUILD_SLOTS } from './shipyard/parts';
import { GARAGE_KEY, HULL_KEY, readHulls } from './shipyard/build';
import { LEVELS as STANDING_LEVELS } from './standing';

export const PILOT_KEY = 'tp-pilot';
const VERSION = 2; // (1 → 2: the log, empty to start)
export const SELL_BACK = 0.6; // what a part sold back pays, of its price
export const LOG_MAX = 30;
const LOG_KINDS = ['earn', 'buy', 'sell', 'spend'];
// What selling an item pays back: three fifths of its price, in whole credits.
export const refundOf = (item) => Math.floor((Number.isInteger(item?.price) && item.price > 0 ? item.price : 0) * SELL_BACK);
// a v1 save is the same shape, with no log yet (v0 or junk isn't migrated:
// the shape check below makes it a fresh wallet)
const migrate = (old, v) => (v === 1 && old && typeof old === 'object' && !Array.isArray(old) ? { ...old, log: [] } : old);
const SAVE_AFTER = 500; // ms: a burst of kills is one write

// what each deed pays: { credits, xp } (warPoints: per point)
export const EARN = {
  killHunter: { credits: 40, xp: 8 },
  killAce: { credits: 160, xp: 30 },
  killCapital: { credits: 400, xp: 80 },
  killPirate: { credits: 50, xp: 10 },
  killPilot: { credits: 120, xp: 25 },
  rescued: { credits: 90, xp: 20 },
  helped: { credits: 60, xp: 12 },
  hunterHelped: { credits: 45, xp: 10 }, // one shot off someone else
  siegePart: { credits: 150, xp: 30 },
  warPoints: { credits: 8, xp: 2 },
  warWin: { credits: 250, xp: 60 },
  questDone: { credits: 200, xp: 50 },
  jobDone: { credits: 120, xp: 30 }, // free roam's work (galaxy/surface/jobs.js): each time, times the job's pay
  found: { credits: 30, xp: 6 },
  standingUp: { credits: 100, xp: 25 }, // a good standing level reached
  allyMade: { credits: 25, xp: 10 },
};
// What a deed (standing.js's, as the scene notes it) pays, as an EARN key,
// or null. Only the deeds that help pay: hurting the law, the ordinary ships
// or the pirates' pride costs standing and earns nothing, and a capital
// ship's shield part pays nothing of its own (its fall does).
const DEED_EARN = {
  killHunter: 'killHunter',
  killPirate: 'killPirate',
  rescued: 'rescued',
  helped: 'helped',
  capitalKill: 'killCapital',
};
export const deedToEarn = (what) => (typeof what === 'string' && Object.hasOwn(DEED_EARN, what) ? DEED_EARN[what] : null);

// each universe's pay, against the rest (all even, to start)
export const SIDE_RATES = {
  starwars: 1,
  rickmorty: 1,
  breakingbad: 1,
  galaxy: 1,
};

// xp at which each level starts; the last is the cap
export const LEVELS = [0, 50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000];
export const TITLES = [
  'Rookie',
  'Hopeful',
  'Pilot',
  'Wingmate',
  'Hotshot',
  'Ace',
  'Veteran',
  'Star Pilot',
  'Hero',
  'Ace of Aces',
  'Legend',
];

export function levelOf(xp) {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  return level;
}

// What the HUD says of an earning (earn's result): the credits, and the
// level reached with its title when there is one, or null for nothing.
export function earnNote(got) {
  if (!got || !(got.credits > 0 || got.levelUp)) return null;
  const parts = got.credits > 0 ? [`+${got.credits} ¢`] : [];
  if (got.levelUp) parts.push(`Level ${got.levelUp} · ${TITLES[got.levelUp - 1]}`);
  return { text: parts.join(' · '), level: Boolean(got.levelUp) };
}

// A standing level worth paying for: one past a threshold on the good side
// of nought (standing.js's trusted, hero, friend). The bad ones never pay.
export const goodStanding = (level) =>
  typeof level === 'string' && Object.values(STANDING_LEVELS).some((axis) => axis.some(([at, name]) => at > 0 && name === level));

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isId = (v) => typeof v === 'string' && v.length > 0;
const known = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);

// catalog.js's key for an item (its keyOf, kept here too so the wallet
// needn't load the catalogue and the achievements behind it; a test holds
// the two together)
const keyOf = (kind, slot, id) => `${kind}:${slot}:${id}`;

// Everything fitted on every crew, from the raw saves (whatever's in
// storage, junk included): the keys to grant when the wallet first appears.
// Stock is everyone's already, so it isn't listed.
export function migrateOwned({ loadouts = null, hulls = null, garage = null } = {}) {
  const crews = CREWS.map((c) => c.id);
  const out = new Set();
  for (const loadout of Object.values(readLoadouts(loadouts, crews)))
    for (const slot of SLOTS)
      if (loadout[slot] !== STOCK) out.add(slot === 'paint' ? keyOf('paint', 'paint', loadout[slot]) : keyOf('part', slot, loadout[slot]));
  for (const raw of [hulls, garage])
    for (const build of Object.values(readHulls(raw, crews)))
      if (build) for (const slot of BUILD_SLOTS) out.add(keyOf('module', slot, build[slot]));
  return [...out];
}

// A tally from storage: whole counts of known deeds only.
const readTally = (raw) => {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [what, n] of Object.entries(raw)) if (known(EARN, what) && count(n)) out[what] = count(n);
  return out;
};
// A log from storage: whole entries of the kinds there are, the last LOG_MAX.
const readLog = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .filter((e) => isObject(e) && LOG_KINDS.includes(e.kind) && typeof e.what === 'string' && Number.isFinite(e.t) && Number.isInteger(e.n) && e.n >= 0)
    .map(({ t, kind, what, n }) => ({ t, kind, what, n }))
    .slice(-LOG_MAX);
const readBySide = (raw) => {
  const out = {};
  if (!isObject(raw)) return out;
  for (const [side, tally] of Object.entries(raw)) if (known(SIDE_RATES, side) && isObject(tally)) out[side] = readTally(tally);
  return out;
};

// How far a standing level is along its axis: its threshold, nought for none.
const standingAt = (axis, level) => STANDING_LEVELS[axis]?.find(([, name]) => name === level)?.[0] ?? 0;
// at least the level needed: as far as it, or further, on its side of nought
// (a level the axis doesn't have is never met)
const standingMet = (have, axis, need) => {
  const want = standingAt(axis, need);
  if (!want) return false;
  const got = standingAt(axis, have);
  return want > 0 ? got >= want : got <= want;
};
// at least the rank needed, on the same side's ladder
const rankMet = (side, have, need) => {
  const ladder = RANKS[side];
  if (!ladder) return false;
  const want = ladder.findIndex((r) => r.id === need);
  const got = ladder.findIndex((r) => r.id === have);
  return want >= 0 && got >= want;
};

export function createEconomy({
  saves = null,
  achievements = () => [],
  standingOf = () => null,
  rankOf = () => null,
  skillOf = () => false,
  later = (fn, ms) => setTimeout(fn, ms),
  cancel = (h) => clearTimeout(h),
  now = () => Date.now(),
} = {}) {
  saves?.register({ key: PILOT_KEY, version: VERSION, migrate });
  const saved = saves?.get(PILOT_KEY, null);
  const good = isObject(saved);
  let credits = good ? count(saved.credits) : 0;
  let xp = good ? count(saved.xp) : 0;
  let spent = good ? count(saved.spent) : 0;
  let earned = good ? count(saved.earned) : 0;
  const owned = new Set(good && Array.isArray(saved.owned) ? saved.owned.filter(isId) : []);
  const tally = good ? readTally(saved.tally) : {};
  const bySide = good ? readBySide(saved.bySide) : {};
  const log = good ? readLog(saved.log) : [];
  const note = (kind, what, n) => {
    log.push({ t: now(), kind, what, n });
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  };
  const listeners = new Set();
  let pending = null;

  const write = () => {
    pending = null;
    saves?.set(PILOT_KEY, {
      credits,
      xp,
      spent,
      earned,
      owned: [...owned],
      tally: { ...tally },
      bySide: readBySide(bySide),
      log: log.map((e) => ({ ...e })),
    });
  };
  const flush = () => {
    if (pending === null) return;
    cancel(pending);
    write();
  };
  const changed = () => {
    if (saves && pending === null) pending = later(write, SAVE_AFTER);
    const r = record();
    for (const fn of listeners) fn(r);
  };
  const sum = (pick) => Object.entries(tally).reduce((n, [what, k]) => n + (pick(what) ? k : 0), 0);
  function record() {
    const level = levelOf(xp);
    return {
      credits,
      xp,
      level,
      title: TITLES[level - 1],
      spent,
      earned,
      kills: sum((what) => what.startsWith('kill')),
      rescues: tally.rescued ?? 0,
      wins: tally.warWin ?? 0,
      quests: tally.questDone ?? 0,
      bySide: readBySide(bySide),
      log: log.map((e) => ({ ...e })),
    };
  }
  const owns = (id) => id === STOCK || owned.has(id);
  const isItem = (item) => isObject(item) && isId(item.id) && Number.isInteger(item.price) && item.price >= 0;
  // what an item is owned as: its key, or its id when it has none
  const idOf = (item) => (isId(item.key) ? item.key : item.id);
  // the first need not met, or null
  const lock = (needs) => {
    if (!isObject(needs)) return null;
    if (needs.achievement != null) {
      const have = achievements();
      if (!Array.isArray(have) || !have.includes(needs.achievement)) return 'achievement';
    }
    if (needs.level != null && !(levelOf(xp) >= needs.level)) return 'level';
    if (needs.standing != null) {
      const { side, axis, level } = needs.standing;
      const have = standingOf(side);
      if (!isObject(have) || !standingMet(have[axis] ?? null, axis, level)) return 'standing';
    }
    if (needs.rank != null) {
      const { side, id } = needs.rank;
      if (!rankMet(side, rankOf(side), id)) return 'rank';
    }
    if (needs.skill != null && skillOf(needs.skill) !== true) return 'skill';
    return null;
  };

  // A lock comes before the price: there's no saving up for what you
  // can't have yet, so the hangar says what it needs first. (A plain
  // function, not a method, so buy works handed about on its own.)
  const canBuy = (item) => {
    if (!isItem(item)) return { ok: false, why: 'invalid' };
    if (item.stock === true || owns(idOf(item))) return { ok: false, why: 'owned' };
    const locked = lock(item.needs);
    if (locked) return { ok: false, why: `locked:${locked}` };
    if (credits < item.price) return { ok: false, why: 'credits' };
    return { ok: true, why: null };
  };

  // A list bought at once, or none of it: every item checked first (the
  // first that can't be bought names itself and why, and nothing changes),
  // then all bought, one save and one change. Two of the same in the list
  // is the second already owned; their prices together must be affordable.
  const checkout = (items) => {
    if (!Array.isArray(items)) return { ok: false, why: 'invalid', item: null, total: 0 };
    const total = items.reduce((n, item) => n + (isItem(item) ? item.price : 0), 0);
    const seen = new Set();
    let running = 0;
    for (const item of items) {
      const can = canBuy(item);
      if (!can.ok) return { ok: false, why: can.why, item, total };
      if (seen.has(idOf(item))) return { ok: false, why: 'owned', item, total };
      seen.add(idOf(item));
      running += item.price;
      if (running > credits) return { ok: false, why: 'credits', item, total };
    }
    if (!items.length) return { ok: true, why: null, item: null, total: 0 };
    for (const item of items) {
      credits -= item.price;
      spent += item.price;
      owned.add(idOf(item));
      note('buy', idOf(item), item.price);
    }
    changed();
    return { ok: true, why: null, item: null, total };
  };

  // Selling back: only what's owned and isn't stock (the yard checks it's
  // fitted nowhere). The refund isn't earned (it was spent once already).
  const canSell = (item) => {
    if (!isItem(item)) return { ok: false, why: 'invalid' };
    if (item.stock === true || idOf(item) === STOCK) return { ok: false, why: 'stock' };
    if (!owned.has(idOf(item))) return { ok: false, why: 'notOwned' };
    return { ok: true, why: null };
  };

  // Not created when the save was missing or junk: grant what's fitted, so
  // nothing anyone had is taken away. (Credits stay nought: none spent.)
  if (!good && saves) {
    for (const id of migrateOwned({
      loadouts: saves.get(LOADOUT_KEY),
      hulls: saves.get(HULL_KEY),
      garage: saves.get(GARAGE_KEY),
    }))
      owned.add(id);
    if (owned.size) changed();
  }

  return {
    get credits() {
      return credits;
    },
    get xp() {
      return xp;
    },
    get level() {
      return levelOf(xp);
    },
    // (a copy: what's owned changes only through buy and grant)
    get owned() {
      return new Set(owned);
    },
    get spent() {
      return spent;
    },
    get earned() {
      return earned;
    },
    earn(what, n = 1, opts = {}) {
      const side = opts?.side ?? null;
      const k = count(n);
      if (!known(EARN, what) || !k) return { credits: 0, xp: 0, levelUp: null };
      const rate = known(SIDE_RATES, side) ? SIDE_RATES[side] : 1;
      const was = levelOf(xp);
      const got = {
        credits: Math.round(EARN[what].credits * k * rate),
        xp: Math.round(EARN[what].xp * k * rate),
      };
      credits += got.credits;
      earned += got.credits;
      xp += got.xp;
      tally[what] = (tally[what] ?? 0) + k;
      note('earn', what, got.credits);
      if (known(SIDE_RATES, side)) {
        bySide[side] ??= {};
        bySide[side][what] = (bySide[side][what] ?? 0) + k;
      }
      const now = levelOf(xp);
      changed();
      return { ...got, levelUp: now > was ? now : null };
    },
    canBuy,
    buy: (item) => checkout([item]).ok,
    checkout,
    canSell,
    sell(item) {
      if (!canSell(item).ok) return false;
      const back = refundOf(item);
      owned.delete(idOf(item));
      credits += back;
      note('sell', idOf(item), back);
      changed();
      return back;
    },
    // (a copy, newest last)
    get log() {
      return log.map((e) => ({ ...e }));
    },
    // credits spent on something that isn't kept (a bounty paid off,
    // wanted.js): whole credits, and only what you have
    spend(n) {
      if (!Number.isInteger(n) || n <= 0 || n > credits) return false;
      credits -= n;
      spent += n;
      note('spend', 'credits', n);
      changed();
      return true;
    },
    owns,
    grant(ids) {
      if (!Array.isArray(ids)) return;
      const before = owned.size;
      for (const id of ids) if (isId(id)) owned.add(id);
      if (owned.size !== before) changed();
    },
    record,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    flush,
  };
}
