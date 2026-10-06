// The siege of the Citadel, as plain rules: what's left of it, shared by
// every pilot online, and when it comes back. Pure (no three.js, no
// network): scene.js strikes it, client.js carries its messages,
// citadelSiege.js draws it, tested here.
//
// A shield covers the Citadel while any of its four generators (out on its
// arms' domes) still runs. Any gun knocks a generator out; with all four
// down the shield drops, and then only heavy ordnance (weapons.js) hurts
// the core. Enough of that and it goes up. It's rebuilt (by the Ricks,
// through a portal) RESPAWN_MS later; a siege nobody finishes is patched
// up REPAIR_MS after the last hit.
//
// Shared without a server: every pilot keeps how much each part has taken
// from each pilot they've heard from (their own share, `mine`, and the
// others', each pilot speaking only for themselves), plus the largest
// total anyone's told them (`floor`, so someone arriving late learns what
// was done before they came). A part's damage is the larger of the two.
// Shares only grow, so hits from two pilots at once both count, and every
// pilot ends up agreeing. Each life of the Citadel is an epoch: when it's
// rebuilt (or repaired) the epoch goes up and everything starts over; a
// message from an older epoch is ignored, one from a newer starts this
// pilot's over too.
//
// createSiege() → { state(now), strike(part, punch, heavy, now) → event or
//   null, receive(peer, msg, now) → [events], tick(now) → event or null,
//   message() → the wire form, active, forget(peer) }
// readSiege(data, now) → a message, or null if it's not one.
// citadelGeometry(w) → where its parts are, in map units.
// blastShape(age, core) → how big each part of the blast is `age` seconds
//   in, in map units, and how bright: kept to the Citadel's own scale.

import { CITADEL_PARTS } from './deep';

export const GENS = 4;
export const CORE = GENS; // the core's index, after the generators
export const PARTS = GENS + 1;
export const GEN_HP = 14; // punches (weapons.js): fourteen blaster hits, or two heavy rounds
export const CORE_HP = 48; // heavy rounds' punches only: six of them
export const RESPAWN_MS = 5 * 60 * 1000;
export const REPAIR_MS = 4 * 60 * 1000;
const HP = [...Array(GENS).fill(GEN_HP), CORE_HP];
const EPOCH_JUMP = 1000; // an epoch further ahead than this is nonsense
const SKEW = 60 * 1000; // ms either way a pilot's clock may be from this one's

const zero = () => Array(PARTS).fill(0);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

// a message as it came in: { e, m: [shares], t: [totals], x: when it went up (ms) or 0, l: the last hit (ms) or 0 }
export function readSiege(data, now = Date.now()) {
  if (!data || typeof data !== 'object') return null;
  const e = num(data.e, 0, Number.MAX_SAFE_INTEGER);
  if (e === null || !Number.isInteger(e)) return null;
  const parts = (a) => (Array.isArray(a) && a.length === PARTS ? a.map((v, i) => num(v, 0, HP[i])) : null);
  const m = parts(data.m);
  const t = parts(data.t);
  if (!m || !t || m.some((v) => v === null) || t.some((v) => v === null)) return null;
  const time = (v) => {
    if (!v) return 0;
    const ms = num(v, 0, Number.MAX_SAFE_INTEGER);
    // (a time from the future, or long before anything here could matter, isn't believed)
    return ms !== null && ms <= now + SKEW && ms >= now - RESPAWN_MS - REPAIR_MS - SKEW ? ms : 0;
  };
  return { e, m, t, x: time(data.x), l: time(data.l) };
}

export function createSiege() {
  let epoch = 0;
  let mine = zero();
  let others = new Map(); // peer → their shares
  let floor = zero();
  let downAt = 0;
  let lastAt = 0;

  const fresh = (e) => {
    epoch = e;
    mine = zero();
    others = new Map();
    floor = zero();
    downAt = 0;
    lastAt = 0;
  };
  const total = (i) => {
    let sum = mine[i];
    for (const s of others.values()) sum += s[i];
    return Math.min(HP[i], Math.max(floor[i], sum));
  };
  const genDown = (i) => total(i) >= GEN_HP;
  const gensLeft = () => {
    let n = 0;
    for (let i = 0; i < GENS; i++) if (!genDown(i)) n++;
    return n;
  };
  // what's down, to tell what a message changed
  const picture = () => ({ epoch, gens: Array.from({ length: GENS }, (_, i) => genDown(i)), down: Boolean(downAt) });
  const changes = (was, now) => {
    const out = [];
    if (was.epoch !== epoch) out.push({ type: 'rebuilt', epoch });
    was = was.epoch === epoch ? was : { gens: Array(GENS).fill(false), down: false };
    const p = picture();
    p.gens.forEach((d, i) => {
      if (d && !was.gens[i]) out.push({ type: 'gen', part: i, left: gensLeft() });
    });
    if (p.down && !was.down) out.push({ type: 'down', at: downAt, rebuildIn: Math.max(0, downAt + RESPAWN_MS - now) });
    return out;
  };

  return {
    get epoch() {
      return epoch;
    },
    // anything to tell (pristine, there's nothing)
    get active() {
      return Boolean(downAt || lastAt);
    },
    // { gens: [down?], gensLeft, shield, core (0…1 left), down, rebuildIn (ms), repairIn (ms), hp: [0…1 left] }
    state(now = Date.now()) {
      const left = gensLeft();
      return {
        epoch,
        gens: Array.from({ length: GENS }, (_, i) => genDown(i)),
        gensLeft: left,
        shield: left > 0 && !downAt,
        hp: HP.map((h, i) => 1 - total(i) / h),
        core: downAt ? 0 : 1 - total(CORE) / CORE_HP,
        down: Boolean(downAt),
        rebuildIn: downAt ? Math.max(0, downAt + RESPAWN_MS - now) : 0,
        repairIn: !downAt && lastAt ? Math.max(0, lastAt + REPAIR_MS - now) : 0,
      };
    },
    // a hit of yours: part is a generator's index, CORE, or 'shield' (the
    // bubble, while it's up). → { type: 'shielded' | 'deflected' | 'hit' |
    // 'gen' | 'down', part, left } or null (nothing there to hit)
    strike(part, punch, heavy, now = Date.now()) {
      if (downAt) return null;
      if (part === 'shield') return gensLeft() > 0 ? { type: 'shielded' } : null;
      if (part === CORE) {
        if (gensLeft() > 0) return { type: 'shielded' };
        if (!heavy) return { type: 'deflected', part };
      } else if (!(part >= 0 && part < GENS) || genDown(part)) return null;
      lastAt = now;
      mine[part] = Math.min(HP[part], mine[part] + punch);
      if (part === CORE) {
        if (total(CORE) >= CORE_HP) {
          downAt = now;
          return { type: 'down', part, at: now, rebuildIn: RESPAWN_MS };
        }
        return { type: 'hit', part, left: 1 - total(CORE) / CORE_HP };
      }
      if (genDown(part)) return { type: 'gen', part, left: gensLeft() };
      return { type: 'hit', part, left: 1 - total(part) / GEN_HP };
    },
    // a message from another pilot (read with readSiege) → what it changed
    receive(peer, msg, now = Date.now()) {
      if (!msg || msg.e < epoch || msg.e > epoch + EPOCH_JUMP) return [];
      const was = picture();
      if (msg.e > epoch) fresh(msg.e);
      const had = others.get(peer) ?? zero();
      others.set(
        peer,
        had.map((v, i) => Math.max(v, msg.m[i])),
      );
      floor = floor.map((v, i) => Math.max(v, msg.t[i]));
      if (msg.x) downAt = downAt ? Math.min(downAt, msg.x) : msg.x;
      else if (!downAt && total(CORE) >= CORE_HP && gensLeft() === 0) downAt = now;
      if (msg.l) lastAt = Math.max(lastAt, msg.l);
      return changes(was, now);
    },
    // rebuilt once it's been down long enough; patched up once nobody's hit it for a while
    tick(now = Date.now()) {
      if (downAt && now >= downAt + RESPAWN_MS) {
        fresh(epoch + 1);
        return { type: 'rebuilt', epoch };
      }
      if (!downAt && lastAt && now >= lastAt + REPAIR_MS) {
        fresh(epoch + 1);
        return { type: 'repaired', epoch };
      }
      return null;
    },
    message() {
      return { e: epoch, m: [...mine], t: Array.from({ length: PARTS }, (_, i) => total(i)), x: downAt, l: lastAt };
    },
    // a pilot gone: their share stays in the floor (it was in a total)
    forget(peer) {
      const s = others.get(peer);
      if (!s) return;
      for (let i = 0; i < PARTS; i++) floor[i] = Math.max(floor[i], total(i));
      others.delete(peer);
    },
  };
}

// Where the Citadel's parts are (map units), for drawing and hitting them:
// the shield's middle and radius, the core's, and the four generators out
// on the arms' domes (each just past its dome, away from the middle).
export function citadelGeometry(w) {
  const k = w.r / 18; // deepspace.js draws it for a radius of 18
  const [ax, ay, az] = w.at;
  const center = [ax, ay - 2 * k, az];
  const gens = CITADEL_PARTS.slice(0, GENS).map(([x, y, z, r]) => {
    const l = Math.hypot(x, z) || 1;
    const out = r + 1.4;
    return [ax + (x + (x / l) * out) * k, ay + (y + r * 0.35) * k, az + (z + (z / l) * out) * k];
  });
  return { center, shield: 21 * k, core: 18 * k, gens, gen: 1.7 * k };
}

// The blast as it goes up, `age` seconds in, for a core of radius `core`
// (map units): the flash's width (a sprite), the fireball's and the portal
// fluid's radii, the shock ring's radius, and how bright the flash and the
// ring are (0…1). Everything stays within three cores of the middle: the
// Citadel is a station among stations, not a sun, and a blast that swelled
// to ten times its size washed out the whole screen from anywhere nearby.
export const BLAST_S = 4.5; // seconds the blast takes
export function blastShape(age, core) {
  const k = Math.min(1, Math.max(0, age) / BLAST_S);
  const flashAlpha = age < 0.15 ? Math.min(1, age / 0.15) : Math.max(0, 1 - (age - 0.15) / 1.45);
  return {
    flash: core * 1.8 * (0.5 + flashAlpha * 0.5),
    flashAlpha,
    fire: core * (0.3 + Math.min(1, age / 0.9) * 1.1),
    fluid: core * (0.2 + Math.min(1, age / 1.6) * 1.5),
    shock: core * (0.5 + k * 2.5),
    shockAlpha: (1 - k) ** 1.5,
    done: k >= 1,
  };
}

// Where a segment (a shot's step, from → to: [x, y, z]) first meets a
// sphere (c, r): 0…1 along it, or null. From inside, it doesn't (a shot
// leaving the bubble passes out).
export function segmentSphere(from, to, c, r) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const fx = from[0] - c[0];
  const fy = from[1] - c[1];
  const fz = from[2] - c[2];
  const cc = fx * fx + fy * fy + fz * fz - r * r;
  if (cc < 0) return null; // inside
  const a = dx * dx + dy * dy + dz * dz;
  if (a === 0) return null;
  const b = fx * dx + fy * dy + fz * dz;
  const disc = b * b - a * cc;
  if (disc < 0) return null;
  const k = (-b - Math.sqrt(disc)) / a;
  return k >= 0 && k <= 1 ? k : null;
}
