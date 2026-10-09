// The rush's wire: what the host and the guests say to each other, written
// small and read with suspicion (anyone with a room's code can join, with a
// client of their own). Pure, so it's tested; ./online.js carries it.
//
// Host → everyone: 'lob' (who's in which slot, and the phase), 'st' (the
// round, ten times a second: the clock, coins, orders, every station and
// every hobbit), 'ev' (what just happened, for the sounds). Guest → host:
// 'hi' (I'd like a slot), 'pose' (where my hobbit is, ten times a second),
// 'grab' (I grabbed, standing here).

import { KINDS, RADIUS, newPlayer, pushOut, recipesOf, solid } from './rules';
// (no vowels, so no words, and nothing that reads as another letter: the squads' alphabet too)
import { ALPHABET } from '../../universe/online/squad/invite';

export const APP_ID = 'tilakpatel-portfolio-rush';
export const POSE_MS = 100;
export const STATE_MS = 100;
export const LOBBY_MS = 2000; // the lobby, again, this often
export const QUIET_MS = 10000; // a guest not heard from this long is gone
export const RATES = { pose: [20, 30], grab: [10, 14], hi: [1, 4] };
export const PHASES = ['lobby', 'count', 'play', 'over'];

// ── room codes ──

export const makeCode = (rand = Math.random) => Array.from({ length: 4 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('');
export function cleanCode(raw) {
  const c = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return c.length === 4 && [...c].every((x) => ALPHABET.includes(x)) ? c : null;
}

// ── small helpers for reading ──

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const r2 = (v) => Math.round(v * 100) / 100;
const KIND_LIST = Object.keys(KINDS);
const dishList = (level) => Object.keys(recipesOf(level).dishes);
const POT_STATES = ['empty', 'part', 'cooking', 'done', 'burnt'];

// a thing as two small numbers, and back
export const writeItem = (it) => (it ? [KIND_LIST.indexOf(it.k), KINDS[it.k].indexOf(it.s)] : 0);
export function readItem(data) {
  if (!Array.isArray(data)) return null;
  const k = KIND_LIST[data[0]];
  const s = k && KINDS[k][data[1]];
  return s ? { k, s } : null;
}

// ── the lobby ──

// { phase, seed, slots: [peerId | 'host' | null] × 4, names }
export const writeLobby = (lob) => [PHASES.indexOf(lob.phase), lob.seed | 0, lob.slots.map((x) => x ?? 0)];
export function readLobby(data) {
  if (!Array.isArray(data)) return null;
  const phase = PHASES[data[0]];
  const seed = int(data[1], -(2 ** 31), 2 ** 31);
  if (!phase || seed == null || !Array.isArray(data[2]) || data[2].length !== 4) return null;
  const slots = data[2].map((x) => (typeof x === 'string' && x.length <= 64 ? x : null));
  return { phase, seed, slots };
}

// the host gives a new guest the first free slot (or the one they have)
export function seat(slots, peerId) {
  const had = slots.indexOf(peerId);
  if (had >= 0) return { slots, slot: had };
  const free = slots.indexOf(null);
  if (free < 0) return { slots, slot: null };
  const next = slots.slice();
  next[free] = peerId;
  return { slots: next, slot: free };
}

// ── a guest's hobbit ──

export const writePose = (p) => [r2(p.x), r2(p.z), r2(p.face), p.work ? 1 : 0, r2(p.vx), r2(p.vz)];
// read against the room: inside it, and out of the counters
export function readPose(data, s) {
  if (!Array.isArray(data) || data.length < 4) return null;
  const x = num(data[0], RADIUS, s.W - RADIUS);
  const z = num(data[1], RADIUS, s.D - RADIUS);
  const face = num(data[2], -10, 10);
  if (x == null || z == null || face == null) return null;
  const [px, pz] = pushOut(s, x, z);
  if (solid(s, Math.floor(px), Math.floor(pz))) return null; // (deep inside a counter)
  return { x: px, z: pz, face, work: data[3] === 1, vx: num(data[4], -12, 12) ?? 0, vz: num(data[5], -12, 12) ?? 0 };
}

// a grab, with where the hobbit stood when they pressed it
export const writeGrab = (p) => writePose(p);
export const readGrab = readPose;

// ── the round ──

// (a fire's fuel, or a carving table's parts so far, ride on the end)
const writeSpot = (c, sp) => {
  if ('item' in sp) return [writeItem(sp.item), r2(sp.prog), ...('fuel' in sp ? [r2(sp.fuel)] : 'parts' in sp ? [sp.parts.map(writeItem)] : [])];
  if (c === 'P') return [sp.n, POT_STATES.indexOf(sp.s), r2(sp.cook), r2(sp.prog), ...('fuel' in sp ? [r2(sp.fuel)] : [])];
  if (c === 'W') return [sp.dirty.map((k) => KIND_LIST.indexOf(k)), sp.clean.map((k) => KIND_LIST.indexOf(k)), r2(sp.prog)];
  if ('n' in sp) return [sp.n];
  if (c === 'R') return Object.values(sp);
  return null;
};
const containerOf = (i) => (KINDS[KIND_LIST[i]]?.includes('dirty') ? KIND_LIST[i] : null);
function readSpot(c, data, sp) {
  if (!Array.isArray(data)) return;
  if ('item' in sp) {
    sp.item = readItem(data[0]);
    sp.prog = num(data[1], 0, 999) ?? 0;
    if ('fuel' in sp) sp.fuel = num(data[2], 0, 1) ?? sp.fuel;
    if ('parts' in sp) sp.parts = Array.isArray(data[2]) ? data[2].slice(0, 4).map(readItem).filter(Boolean) : [];
  } else if (c === 'P') {
    sp.n = int(data[0], 0, 3) ?? 0;
    sp.s = POT_STATES[data[1]] ?? 'empty';
    sp.cook = num(data[2], 0, 999) ?? 0;
    sp.prog = num(data[3], 0, 1) ?? 0;
    if ('fuel' in sp) sp.fuel = num(data[4], 0, 1) ?? sp.fuel;
  } else if (c === 'W') {
    sp.dirty = Array.isArray(data[0]) ? data[0].slice(0, 32).map(containerOf).filter(Boolean) : [];
    sp.clean = Array.isArray(data[1]) ? data[1].slice(0, 32).map(containerOf).filter(Boolean) : [];
    sp.prog = num(data[2], 0, 1) ?? 0;
  } else if ('n' in sp) sp.n = int(data[0], 0, 99) ?? 0;
  else if (c === 'R') Object.keys(sp).forEach((k, n) => (sp[k] = int(data[n], 0, 99) ?? 0));
}

// The whole round, as the host sends it. Stations go in the order of their
// keys, which both ends make the same way from the same level.
export function writeState(s) {
  const spots = Object.keys(s.spots).map((k) => {
    const [i, j] = k.split(',').map(Number);
    return writeSpot(s.level.tiles[j][i], s.spots[k]);
  });
  return {
    t: r2(s.t),
    l: r2(s.left),
    c: s.coins,
    sv: s.served,
    lp: s.lapsed,
    o: s.over ? 1 : 0,
    p: s.players.map((p) => [p.slot, r2(p.x), r2(p.z), r2(p.face), writeItem(p.held), p.work ? 1 : 0, r2(p.vx), r2(p.vz)]),
    sp: spots,
    od: s.orders.map((o) => [o.id, dishList(s.level).indexOf(o.dish), r2(o.t), o.of]),
    oi: s.orderId,
  };
}

// A guest takes the host's round into its own copy (`s`, made from the same
// level). Its own hobbit's place (`me`) stays its own; what it holds is the
// host's to say. Returns false if it doesn't make sense.
export function readState(s, d, me = null) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.p) || !Array.isArray(d.sp) || !Array.isArray(d.od)) return false;
  const keys = Object.keys(s.spots);
  if (d.sp.length !== keys.length || d.p.length > 4 || d.od.length > 12) return false;
  s.t = num(d.t, 0, 1e6) ?? s.t;
  s.left = num(d.l, 0, 3600) ?? s.left;
  s.coins = int(d.c, 0, 1e6) ?? s.coins;
  s.served = int(d.sv, 0, 1e5) ?? s.served;
  s.lapsed = int(d.lp, 0, 1e5) ?? s.lapsed;
  s.over = d.o === 1;
  s.orderId = int(d.oi, 0, 1e6) ?? s.orderId;
  keys.forEach((k, n) => {
    const [i, j] = k.split(',').map(Number);
    readSpot(s.level.tiles[j][i], d.sp[n], s.spots[k]);
  });
  const dishes = dishList(s.level);
  s.orders = d.od
    .map((o) => (Array.isArray(o) ? { id: int(o[0], 0, 1e6), dish: dishes[o[1]], t: num(o[2], -10, 999), of: num(o[3], 1, 999) } : null))
    .filter((o) => o && o.id != null && o.dish && o.t != null && o.of != null);
  const players = [];
  for (const row of d.p) {
    if (!Array.isArray(row)) continue;
    const slot = int(row[0], 0, 3);
    if (slot == null || players.some((p) => p.slot === slot)) continue;
    const p = s.players.find((q) => q.slot === slot) ?? newPlayer(s.level, slot);
    if (slot !== me) {
      p.x = num(row[1], 0, s.W) ?? p.x;
      p.z = num(row[2], 0, s.D) ?? p.z;
      p.face = num(row[3], -10, 10) ?? p.face;
      p.vx = num(row[6], -12, 12) ?? 0;
      p.vz = num(row[7], -12, 12) ?? 0;
    }
    p.held = readItem(row[4]);
    p.work = row[5] === 1;
    players.push(p);
  }
  players.sort((a, b) => a.slot - b.slot);
  s.players = players;
  return true;
}

// What just happened, for a guest's sounds and lines: only the kinds that
// make a sound, and only what they need.
const EV_TYPES = ['pick', 'put', 'add', 'ladle', 'bin', 'nope', 'chopped', 'washed', 'scraped', 'cooked', 'burnt', 'baked', 'filled', 'spilt', 'served', 'lapsed', 'order', 'back', 'end', 'caught', 'grown', 'stoked', 'out', 'sneak', 'shooed', 'stolen', 'plated'];
export const writeEvents = (list, level) =>
  list
    .filter((e) => EV_TYPES.includes(e.type))
    .slice(0, 24)
    .map((e) => [EV_TYPES.indexOf(e.type), e.at ?? 0, e.p ?? -1, e.dish ? dishList(level).indexOf(e.dish) : -1, e.coins ?? 0, e.order ?? 0]);
export function readEvents(data, level) {
  const dishes = dishList(level);
  if (!Array.isArray(data)) return [];
  return data
    .slice(0, 24)
    .map((e) => {
      if (!Array.isArray(e)) return null;
      const type = EV_TYPES[e[0]];
      if (!type) return null;
      const at = Array.isArray(e[1]) && e[1].length === 2 && e[1].every((v) => int(v, 0, 64) != null) ? e[1] : null;
      return { type, ...(at ? { at } : {}), p: int(e[2], 0, 3) ?? undefined, dish: dishes[e[3]], coins: int(e[4], 0, 999) ?? 0, order: int(e[5], 0, 1e6) ?? 0 };
    })
    .filter(Boolean);
}
