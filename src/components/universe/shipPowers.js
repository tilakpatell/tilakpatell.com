// What each crew's ship can do besides shoot: a power on G, on a cooldown,
// and a big one on X, charged by what you shoot down (and a little by
// flying). Each is a card of numbers; the state machine says which is on,
// cooling or charging, and what the scene should change while it's on. Pure
// (no three.js), so it's tested in Node; the galaxy's scene plays them
// (powers.js), powerFx.js draws them and PowerBar.jsx shows them.
//
// - Luke and Artoo (the X-wing): Force Focus, time slowed for everyone but
//   you and the guns finding their mark; and a torpedo salvo, four locked at
//   once.
// - Han and Chewie (the Falcon): Never tell me the odds, a corkscrew no
//   gunner can follow (nothing hits you, and whoever was on you overshoots);
//   and Chewie on the quad guns, shooting at anything near, all the way round.
// - Rick and Morty (the cruiser): the portal gun, out on your target's tail
//   (or a long hop ahead); and Wubba lubba dub dub, the cruiser's big laser.
// - Walt and Jesse (the RV): Magnets, every fighter near dragged into a ball
//   ahead of you with its guns jammed; and Say my name, a crystal of
//   fulminated mercury thrown ahead (magnets, then the bang, is the idea).
// Powers are for the fights with the game's own ships (the hunters, the
// war's battles): they never touch another pilot online.
//
//   POWERS                 by id: { crew, slot, name, short, about, cool? (s), dur (s), …its own numbers }
//   CREW_POWERS / powersOf(crew)   { primary, ultimate } ids, or null
//   CHARGE                 what fills the big one (0…1)
//   createPowers(crew, { charge, cool, picks, fx }) → state, or null for no crew
//   press(st, slot)        → { ok, id } or { ok: false, why }
//   step(st, dt, { flying }) → events ({ type: 'end' | 'ready', slot, id })
//   gain(st, what, n, key) the big one charged (never while it's on); → true the moment it fills
//   hasten(st, seconds)    the primary's cooldown cut (a power cell); → true when that made it ready
//   chargeFor(hit, { war, ace })  what a hit charges it with, or null (a shield, a hull)
//   finish(st, slot)       one power stops early, its work done (the last torpedo home)
//   cancel(st)             whatever's on stops (shot down, crashed, jumping)
//   mods(st)               what the scene changes this frame
//   aimHelp(m, own, gameShip)  the guns' help onto the lead and the lock's tracking, a power's only onto the game's ships
//   view(st)               the HUD's
//   readKept / readCooling / writeKept   the big one's charge and the power's cooldown, kept in the session across a landing
//   pickTargets, portalExit, clearOfSolids, solidAhead, beamOf, blastPunch,
//   pullStep, jinkStep, turretPick, shotAt, crossesShell, isObjective,
//   firstAlong: the geometry, pure

import { aimAngles, bearing, nose, sweptHit } from './targeting';
import { inTrench } from './ship';

export const POWER_KEYS = { primary: 'g', ultimate: 'x' };
export const KEPT_KEY = 'tp:ship-powers'; // (the session's: the big one's charge, so a landing doesn't lose it)

// What fills the big one: five kills, or two minutes and a half of flying
// (an ace counts for more, a battle's objective more than a fighter), and a
// little for a hit, but no more than `hitCap` from hits on any one thing (a
// 120-hp objective takes thirty, and they'd have been most of a fill)
export const CHARGE = { kill: 0.2, ace: 0.5, objective: 0.3, hit: 0.02, hitCap: 0.1, second: 1 / 150, pickup: 0.25 };
const HITS_KEPT = 64; // (the things hit lately whose share is counted: older ones forgotten)

// The numbers come from fights flown in Node (hunterRules.js's): in a fight
// a hunter sits a median 7.5 to 9 units off you and a pack is 8 to 10 units
// across, which is where the magnet's reach and the blast's size come from;
// Force Focus cut the hits taken in five seconds from 9 to 1 over twenty
// fights. Damage on a battle's objectives is cut (`sub`) so that one big
// one can't take a shield generator down on its own.
export const POWERS = {
  // Luke and Artoo
  // (it doesn't quicken the guns: the X-wing's own are already as quick as
  // the wire lets in)
  focus: { crew: 'xwing', slot: 'primary', name: 'Force Focus', short: 'Force', about: 'Time slows for everyone but you, and your shots find their mark.', cool: 22, dur: 5, slow: 0.35, assist: 2.5, track: 2 },
  // (on until the last torpedo's home or gone: four launched over the
  // first half second, each living 2.8 s)
  salvo: { crew: 'xwing', slot: 'ultimate', name: 'Torpedo salvo', short: 'Torpedoes', about: 'Four torpedoes away, each locked on a target of its own.', dur: 3.4, count: 4, every: 0.15, punch: 8, sub: 4, speed: 30, life: 2.8, turn: 2.4, cone: 0.6, range: 60, near: 1 },
  // Han and Chewie
  odds: { crew: 'falcon', slot: 'primary', name: 'Never tell me the odds', short: 'Evade', about: 'A corkscrew no gunner can follow: nothing hits you, and whoever was on you overshoots.', cool: 12, dur: 2.2, jink: 3, spins: 2, agility: 1.3 },
  // (his bolts at the guns' own speed: any quicker and they're gone before they're seen)
  quad: { crew: 'falcon', slot: 'ultimate', name: 'Chewie on the quad guns', short: 'Chewie', about: 'Chewie takes the turrets and shoots at anything near, all the way round.', dur: 12, every: 0.22, range: 35, punch: 1, chance: 0.7, speed: 60, miss: 1.5 },
  // Rick and Morty
  // (out at cruise at least, `out`, with `room` ahead of it clear of
  // anything solid, or `lead` seconds of it at that speed if that's more:
  // flown from the exit with the real ship, that's time to pull up off a
  // planet at any speed. Short of that a hop stops early, no shorter than
  // `least`, and an exit on a tail goes up to `back` further behind)
  portal: { crew: 'cruiser', slot: 'primary', name: 'Portal gun', short: 'Portal', about: 'Through a portal and out on your target’s tail (or a long hop ahead).', cool: 10, dur: 0.35, behind: 5, hop: 40, swallow: 6, range: 60, mouth: 2, out: 3.3, room: 6, lead: 1.5, least: 10, back: 20 },
  wubba: { crew: 'cruiser', slot: 'ultimate', name: 'Wubba lubba dub dub', short: 'Death ray', about: 'The cruiser’s big laser, straight ahead, into whatever’s first in its way.', dur: 3.5, length: 45, tick: 0.1, punch: 0.6, sub: 0.3, turn: 0.6 },
  // Walt and Jesse
  magnets: { crew: 'rv', slot: 'primary', name: 'Magnets', short: 'Magnets', about: 'Yeah, science: every fighter near is dragged into a ball ahead of you, guns jammed.', cool: 20, dur: 4, radius: 22, ahead: 6, pull: 16, daze: 1 },
  // (on until the crystal goes off: its fuse, and a moment)
  heisenberg: { crew: 'rv', slot: 'ultimate', name: 'Say my name', short: 'Heisenberg', about: 'A crystal of fulminated mercury, thrown ahead: a big blue bang.', dur: 1.6, fuse: 1.4, speed: 26, near: 2, radius: 10, punch: 10, edge: 3, sub: 0.5 },
};
export const CREW_POWERS = { xwing: { primary: 'focus', ultimate: 'salvo' }, falcon: { primary: 'odds', ultimate: 'quad' }, cruiser: { primary: 'portal', ultimate: 'wubba' }, rv: { primary: 'magnets', ultimate: 'heisenberg' } };
export const powersOf = (crew) => CREW_POWERS[crew] ?? null;
// The pair a crew carries: its own, or another crew's card in the same slot
// where the skill tree lets it (`carry`: the crews whose powers any ship may
// carry, hangar/skills's borrowed pairs). `picks` is what's been chosen, by
// crew ({ [crew]: { primary, ultimate } }); anything not allowed is the own.
export function picksFor(crew, picks, carry) {
  const own = powersOf(crew);
  if (!own) return null;
  const asked = picks?.[crew] ?? {};
  const ok = (slot) => {
    const p = POWERS[asked[slot]];
    return Boolean(p) && p.slot === slot && (p.crew === crew || (Array.isArray(carry) && carry.includes(p.crew)));
  };
  return { primary: ok('primary') ? asked.primary : own.primary, ultimate: ok('ultimate') ? asked.ultimate : own.ultimate };
}

const SLOTS = ['primary', 'ultimate'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// (`cool`: seconds of the power's cooldown still to run, kept from before a
// landing; `picks`: the pair carried, picksFor's; `fx`: the skill tree's,
// hangar/skills's: powerCool and powerDur on every power's lengths, charge on
// what fills the big one, pickup on a pickup's share)
const num = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
export function createPowers(crew, { charge = 0, cool = 0, picks = null, fx = null } = {}) {
  const own = powersOf(crew) && (picks?.primary && picks?.ultimate ? picks : powersOf(crew));
  if (!own) return null;
  const c = clamp(Number.isFinite(charge) ? charge : 0, 0, 1);
  const wait = clamp(Number.isFinite(cool) ? cool : 0, 0, POWERS[own.primary].cool);
  const k = { cool: num(fx?.powerCool), dur: num(fx?.powerDur), charge: num(fx?.charge), pickup: num(fx?.pickup) };
  return { crew, k, primary: { id: own.primary, phase: wait > 0 ? 'cooling' : 'ready', left: wait }, ultimate: { id: own.ultimate, phase: c >= 1 ? 'ready' : 'charging', charge: c, left: 0 } };
}
// a power's lengths with the skills on them (a state with none: the cards')
const durOf = (st, id) => POWERS[id].dur * (st?.k?.dur ?? 1);
const coolOf = (st, id) => POWERS[id].cool * (st?.k?.cool ?? 1);

// a press of G or X: on, if it's ready (the big one's charge spent)
export function press(st, slot) {
  const s = SLOTS.includes(slot) ? st?.[slot] : null;
  if (!s) return { ok: false, why: 'none' };
  if (s.phase !== 'ready') return { ok: false, why: s.phase };
  s.phase = 'active';
  s.left = durOf(st, s.id);
  if (slot === 'ultimate') s.charge = 0;
  return { ok: true, id: s.id };
}

// one that's on goes off: a power onto its cooldown, the big one back to charging
const end = (st, slot, out) => {
  const s = st[slot];
  if (slot === 'primary') {
    s.phase = 'cooling';
    s.left = coolOf(st, s.id);
  } else {
    s.phase = 'charging';
    s.left = 0;
  }
  out.push({ type: 'end', slot, id: s.id });
};

export function step(st, dt, { flying = true } = {}) {
  const out = [];
  if (!st) return out;
  for (const slot of SLOTS) {
    const s = st[slot];
    if (s.phase === 'active') {
      s.left -= dt;
      if (s.left <= 0) end(st, slot, out);
    } else if (s.phase === 'cooling') {
      s.left -= dt;
      if (s.left <= 0) {
        s.left = 0;
        s.phase = 'ready';
        out.push({ type: 'ready', slot, id: s.id });
      }
    }
  }
  if (flying && gain(st, 'second', dt)) out.push({ type: 'ready', slot: 'ultimate', id: st.ultimate.id });
  return out;
}

// (only while it's charging: the big one's own kills never pay for the
// next; a hit's share by what was hit, `key`, up to CHARGE.hitCap each)
export function gain(st, what, n = 1, key = null) {
  const u = st?.ultimate;
  if (!u || u.phase !== 'charging') return false;
  let add = (CHARGE[what] ?? 0) * n * (st.k?.charge ?? 1) * (what === 'pickup' ? (st.k?.pickup ?? 1) : 1);
  if (what === 'hit' && key !== null) {
    st.hits ??= new Map();
    const had = st.hits.get(key) ?? 0;
    add = Math.max(0, Math.min(add, CHARGE.hitCap - had));
    st.hits.delete(key); // (the latest last, so the oldest go first)
    st.hits.set(key, had + add);
    if (st.hits.size > HITS_KEPT) st.hits.delete(st.hits.keys().next().value);
  }
  u.charge = Math.min(1, u.charge + add);
  if (u.charge < 1) return false;
  u.phase = 'ready';
  return true;
}

// A power cell picked up in flight (galaxy/pickups.js): the cooldown on G
// cut by `seconds`; true when that made it ready
export function hasten(st, seconds) {
  const s = st?.primary;
  if (!s || s.phase !== 'cooling') return false;
  s.left = Math.max(0, s.left - seconds);
  if (s.left > 0) return false;
  s.phase = 'ready';
  return true;
}

// What a hit charges the big one with (gain's `what`), or nothing: a kill,
// an ace, a battle's objective (`war`: the war's battle's hit, battle.js's)
// or a hit on something the guns can take down; never a battle's shield or
// a capital ship's hull, which they can't
export function chargeFor(hit, { war = false, ace = false } = {}) {
  if (!hit) return null;
  if (war && (hit.shield || hit.capital)) return null;
  if (!hit.down) return 'hit';
  if (war && (hit.sub || hit.turret)) return 'objective';
  return ace ? 'ace' : 'kill';
}

export function finish(st, slot) {
  const out = [];
  if (st?.[slot]?.phase === 'active') end(st, slot, out);
  return out;
}

export function cancel(st) {
  const out = [];
  if (st) for (const slot of SLOTS) if (st[slot].phase === 'active') end(st, slot, out);
  return out;
}

export const isOn = (st, id) => Boolean(st && SLOTS.some((slot) => st[slot].id === id && st[slot].phase === 'active'));

// What the scene changes while a power's on: the others' clock (slow), the
// guns' help onto the lead (assist, track: the least of each, over the
// visitor's own settings, and only onto the game's own ships: aimHelp),
// whether anything can hit you (ghost), how hard the stick turns the ship
// (turn) and how quick it is to answer (agility)
export function mods(st) {
  const m = { slow: 1, assist: 0, track: 0, ghost: false, turn: 1, agility: 1 };
  if (isOn(st, 'focus')) Object.assign(m, { slow: POWERS.focus.slow, assist: POWERS.focus.assist, track: POWERS.focus.track });
  if (isOn(st, 'odds')) Object.assign(m, { ghost: true, agility: POWERS.odds.agility });
  if (isOn(st, 'portal')) m.ghost = true;
  if (isOn(st, 'wubba')) m.turn = POWERS.wubba.turn;
  return m;
}

// How hard the guns bend onto the lead and the nose follows the lock
// (targeting.js's assist and trackNudge): the visitor's own settings
// (`own`: { assist, track }), turned up by a power only while the lock is
// one of the game's own ships (`gameShip`). Another pilot never meets a
// power, so a dogfight is flown on the settings alone
export function aimHelp(m, own, gameShip) {
  if (!gameShip) return { assist: own.assist, track: own.track };
  return { assist: Math.max(own.assist, m.assist), track: Math.max(own.track, m.track) };
}

// The HUD's: each slot's name and key, its phase, and how far round its ring
// is (k: 0 full, 1 empty: the time left while it's on, the cooldown left,
// the charge still to come), with the seconds left to show
export function view(st) {
  if (!st) return null;
  const one = (slot) => {
    const s = st[slot];
    const p = POWERS[s.id];
    const k = s.phase === 'active' ? 1 - s.left / durOf(st, s.id) : s.phase === 'cooling' ? s.left / coolOf(st, s.id) : s.phase === 'charging' ? 1 - s.charge : 0;
    const left = s.phase === 'active' || s.phase === 'cooling' ? Math.ceil(s.left - 1e-9) : 0;
    return { id: s.id, name: p.name, short: p.short, key: POWER_KEYS[slot].toUpperCase(), phase: s.phase, k: +clamp(k, 0, 1).toFixed(3), left, charge: slot === 'ultimate' ? s.charge : null };
  };
  return { primary: one('primary'), ultimate: one('ultimate') };
}

// The big one's charge and the power's cooldown, kept in the session
// (KEPT_KEY): the scene is made again after a landing, and a charge you'd
// earned shouldn't go with it, nor a cooldown be over for the asking. The
// cooldown's kept as the moment it's over (`now`: the clock's, in ms), so it
// runs on while you're down. Read back only for the same crew; anything
// else (nothing kept, another crew's, something broken) starts from nothing
export function writeKept(st, now = Date.now()) {
  if (!st) return null;
  const cooling = st.primary.phase === 'cooling' && st.primary.left > 0;
  return JSON.stringify({ crew: st.crew, charge: +st.ultimate.charge.toFixed(4), ...(cooling ? { coolUntil: Math.round(now + st.primary.left * 1000) } : {}) });
}
const keptOf = (raw, crew) => {
  if (!raw || !powersOf(crew)) return null;
  let kept;
  try {
    kept = JSON.parse(raw);
  } catch {
    return null;
  }
  return kept && typeof kept === 'object' && kept.crew === crew ? kept : null;
};
export function readKept(raw, crew) {
  const kept = keptOf(raw, crew);
  return kept && Number.isFinite(kept.charge) ? clamp(kept.charge, 0, 1) : 0;
}
// the seconds of the power's cooldown still to run at `now` (0 for none)
export function readCooling(raw, crew, now = Date.now()) {
  const kept = keptOf(raw, crew);
  if (!kept || !Number.isFinite(kept.coolUntil)) return 0;
  return clamp((kept.coolUntil - now) / 1000, 0, POWERS[powersOf(crew).primary].cool);
}

// Up to `count` targets, each its own: in the cone off the nose and in range,
// the ones coming at you first, then nearest the nose; none there, the
// nearest in range (the torpedoes' locks)
export function pickTargets(ship, targets, { count = 4, cone = 0.6, range = 60 } = {}) {
  const seen = [];
  for (const t of targets) {
    const b = bearing(ship, t.at);
    if (b.dist <= range) seen.push({ t, ...b });
  }
  const inCone = seen.filter((e) => e.off <= cone).sort((a, b) => (b.t.threat || 0) - (a.t.threat || 0) || a.off - b.off);
  const pool = inCone.length ? inCone : seen.sort((a, b) => a.dist - b.dist);
  return pool.slice(0, count).map((e) => e.t);
}

// Out of whatever's solid (ship.js's solids), `gap` off its surface: as
// hunterRules.js's clearOf, but a ship down in a trench (the Death Star's)
// is cleared to the trench's floor, as ship.js flies it, not thrown up over
// its rim
const GAP = 1; // (a portal's way out, off anything solid)
const reachHere = (o, p) => (o.band && inTrench(o, p.x, p.y, p.z) ? o.band.floor : o.r);
export function clearOfSolids(p, solids, gap = 0.5) {
  for (let pass = 0, moved = true; moved && pass < 4; pass++) {
    moved = false;
    for (const o of solids) {
      const dx = p.x - o.at[0];
      const dy = p.y - o.at[1];
      const dz = p.z - o.at[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const r = reachHere(o, p) + gap;
      if (d >= r - 1e-9) continue;
      moved = true;
      if (d < 1e-6) {
        p.y = o.at[1] + r;
        continue;
      }
      const k = r / d;
      p.x = o.at[0] + dx * k;
      p.y = o.at[1] + dy * k;
      p.z = o.at[2] + dz * k;
    }
  }
  return p;
}

// Whether `p` is inside anything solid, `gap` off its surface (a trench
// it's down in counted to its floor)
const insideAny = (p, solids, gap) => solids.some((o) => Math.hypot(p.x - o.at[0], p.y - o.at[1], p.z - o.at[2]) < reachHere(o, p) + gap);

// How far along `dir` (a unit vector) from `p` the first solid is, `gap` off
// its surface: Infinity for none. One whose trench `p` is down in doesn't
// count (flying the trench is the pilot's: ship.js keeps it to its floor)
function solidAhead(p, dir, solids, gap = 0) {
  let best = Infinity;
  for (const o of solids) {
    if (o.band && inTrench(o, p.x, p.y, p.z)) continue;
    const ox = p.x - o.at[0];
    const oy = p.y - o.at[1];
    const oz = p.z - o.at[2];
    const r = o.r + gap;
    const b = ox * dir[0] + oy * dir[1] + oz * dir[2];
    const c = ox * ox + oy * oy + oz * oz - r * r;
    if (c <= 0) return 0; // (inside it already)
    const disc = b * b - c;
    if (b >= 0 || disc < 0) continue; // (behind, or wide of it)
    best = Math.min(best, -b - Math.sqrt(disc));
  }
  return best;
}

// Where the portal lets you out: `behind` units behind the target the way
// it's going (or past it, away from you, when it's still), facing it; with
// no target, `hop` units on along the nose. Never past the system's edge
// (`edge`) or its ceiling and floor (`ceiling(x, z)`), never inside anything
// solid (`solids`: ship.js's), and never facing something solid closer than
// its `room` (or `lead` seconds at the speed it comes out at): where it
// would be, the exit comes back toward you along the way it faces until it
// isn't, by up to `back` behind a target or as far as a hop of `least`.
// Null when there's nowhere like that: no portal. It comes out at `out`
// (cruise) at least, unless it was brought back (then at the ship's own
// speed: a stopped ship isn't thrown at what's ahead).
// → { x, y, z, heading, pitch, speed, short } or null
export function portalExit(ship, target, P = POWERS.portal, solids = [], { edge = Infinity, ceiling = null } = {}) {
  let p;
  let face;
  if (target) {
    const v = target.vel ?? { x: 0, y: 0, z: 0 };
    const sp = Math.hypot(v.x, v.y, v.z);
    let d;
    if (sp > 0.5) d = [v.x / sp, v.y / sp, v.z / sp];
    else {
      const a = [target.at.x - ship.x, target.at.y - ship.y, target.at.z - ship.z];
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      d = [a[0] / l, a[1] / l, a[2] / l];
    }
    p = { x: target.at.x - d[0] * P.behind, y: target.at.y - d[1] * P.behind, z: target.at.z - d[2] * P.behind };
    face = d;
  } else {
    face = nose(ship);
    p = { x: ship.x + face[0] * P.hop, y: ship.y + face[1] * P.hop, z: ship.z + face[2] * P.hop };
  }
  const own = Math.max(0, ship.speed ?? 0);
  const fast = Math.max(own, P.out);
  const room = Math.max(P.room, fast * P.lead);
  const most = target ? P.back : Math.max(0, P.hop - P.least);
  const { heading, pitch } = aimAngles(face);
  for (let back = 0; back <= most + 1e-9; back += 0.5) {
    const q = { x: p.x - face[0] * back, y: p.y - face[1] * back, z: p.z - face[2] * back };
    const r = Math.hypot(q.x, q.z);
    if (r > edge - 5) {
      const k = (edge - 5) / r;
      q.x *= k;
      q.z *= k;
    }
    const top = ceiling ? ceiling(q.x, q.z) - 5 : Infinity;
    if (Math.abs(q.y) > top) q.y = Math.sign(q.y) * top;
    if (insideAny(q, solids, GAP) || solidAhead(q, face, solids, GAP) < room) continue;
    return { x: q.x, y: q.y, z: q.z, heading, pitch, speed: back > 0 ? own : fast, short: back > 0 };
  }
  return null;
}

// The death ray this frame: from the nose, `length` on
export function beamOf(ship, length = POWERS.wubba.length) {
  const n = nose(ship);
  return { from: { x: ship.x + n[0] * 0.2, y: ship.y + n[1] * 0.2, z: ship.z + n[2] * 0.2 }, to: { x: ship.x + n[0] * length, y: ship.y + n[1] * length, z: ship.z + n[2] * length } };
}

// A blast's punch `d` from its middle: all of it there, `edge` at its rim, nothing past
export function blastPunch(d, P = POWERS.heisenberg) {
  if (d > P.radius) return 0;
  return P.punch + (P.edge - P.punch) * (d / P.radius);
}

// One fighter's way toward the magnet this frame: `speed` at most, never past it
export function pullStep(pos, at, speed, dt) {
  const dx = at.x - pos.x;
  const dy = at.y - pos.y;
  const dz = at.z - pos.z;
  const d = Math.hypot(dx, dy, dz);
  const k = d < 1e-6 ? 0 : Math.min(1, (speed * dt) / d);
  return { x: pos.x + dx * k, y: pos.y + dy * k, z: pos.z + dz * k };
}

// The corkscrew's sideways step this frame (`side` ±1): `jink` units over the
// whole of it, quickest in the middle; and how far round it has rolled by
// the end of the frame (radians)
export function jinkStep(t, dt, P = POWERS.odds, side = 1) {
  const f = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));
  const a = f(t / P.dur);
  const b = f((t + dt) / P.dur);
  return { step: (b - a) * P.jink * side, roll: b * P.spins * 2 * Math.PI * side };
}

// Who Chewie shoots at: the one he's on while it's in range, else the
// nearest coming at you (one coming at you counts as nearer), else the nearest
export function turretPick(ship, targets, range = POWERS.quad.range, prevId = null) {
  let best = null;
  let score = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.at.x - ship.x, t.at.y - ship.y, t.at.z - ship.z);
    if (d > range) continue;
    if (t.id === prevId) return t;
    const s = d * (t.threat ? 0.4 : 1);
    if (s < score) {
      score = s;
      best = t;
    }
  }
  return best;
}

// A power's shot at one target (Chewie's bolt landing, a blast reaching
// it): a short way in from just off it, on the side it comes from (`from`),
// to where it is now, so the guns' own hit() meets it, or whatever's in the
// way (a hull before an objective in it)
export function shotAt(t, from, reach = (t.size ?? 0.5) + 0.6) {
  let ux = from.x - t.at.x;
  let uy = from.y - t.at.y;
  let uz = from.z - t.at.z;
  const l = Math.hypot(ux, uy, uz);
  if (l < 1e-6) [ux, uy, uz] = [0, 1, 0];
  else [ux, uy, uz] = [ux / l, uy / l, uz / l];
  return { from: { x: t.at.x + ux * reach, y: t.at.y + uy * reach, z: t.at.z + uz * reach }, to: { x: t.at.x, y: t.at.y, z: t.at.z } };
}

// Whether a hop from `a` to `b` crosses a shell of radius `r` round the middle (Scarif's shield)
export const crossesShell = (a, b, r) => (Math.hypot(a.x, a.y, a.z) - r) * (Math.hypot(b.x, b.y, b.z) - r) < 0;

// A battle's objective (a battery, a subsystem) rather than a fighter: it
// takes a power's cut damage (`sub`), and Chewie leaves it alone
// (the war's set pieces' targets among them: galaxy/warpieces/'s generator,
// reactor and ion cannon, whose own target carries no `sub`, only its hit)
const OBJECTIVES = new Set(['turret', 'subsystem', 'shieldgen', 'reactor', 'cannon']);
export const isObjective = (t) => OBJECTIVES.has(t.kind) || Boolean(t.sub);

// Which of `targets` ({ at, vel, size }) a shot from `from` to `to` this
// frame meets first, each having moved at its `vel` over `dt`; or null (the
// guns' own test, sweptHit, so what it says is what the hit will be)
export function firstAlong(from, to, targets, dt) {
  let best = null;
  let first = Infinity;
  const was = { x: 0, y: 0, z: 0 };
  for (const t of targets) {
    const v = t.vel ?? { x: 0, y: 0, z: 0 };
    was.x = t.at.x - v.x * dt;
    was.y = t.at.y - v.y * dt;
    was.z = t.at.z - v.z * dt;
    const k = sweptHit(from, to, was, t.at, Math.max(0.35, (t.size ?? 0.5) * 0.9));
    if (k !== null && k < first) {
      first = k;
      best = t;
    }
  }
  return best;
}
