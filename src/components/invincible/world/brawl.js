// The brawl: what Mark does to the villains beyond a punch (./foes.js keeps
// the punch, the lunge and the ram), as plain numbers. Grab a foe or a car
// and carry it; throw it; slam it into the street or a tower; dive onto a
// foe from height; block a swing and counter; pound the ground. Pure: the
// scene draws the events, InvWorld.jsx reads `push` and `cap`.
//
// stepBrawl(b, foes, hero, input, dt, world) → { b, foes, ev, push, cap }
//   b: { held: { what: 'foe' | 'car', id } | null, hold (seconds the punch
//      has been held), dive: { id, from } | null, pound (cooldown),
//      blocking }
//   foes: ./foes.js's state, stepped already this step (stepFoes first,
//      then this); a held foe is `held`, a thrown one `thrown`, and
//      ./foes.js leaves both to this module
//   hero: ./flight.js's hero (p at his feet; chest 1 m up)
//   input: { punchHeld, look, dive, block, pound, fists, landed: the hero's
//      `land`, `slam` or `impact` event this step, if any }
//   push: a velocity to give him (a dive); cap: the most he may fly while
//   carrying (null for no cap)
// Each foe hit goes through ./foes.js's hitFoe, so a knock-out is theirs.
// A step is never longer than a twentieth of a second.

import { FLY } from './flight';
import { FIGHT, KINDS, hitFoe, knockOut, live, mid } from './foes';
import { WATER_Y, groundAt } from './map';

export const BRAWL = {
  hold: 0.25, // seconds the punch is held before it's a grab
  reach: FIGHT.reach + 1, // m, a grab's reach (a little past a punch)
  carReach: 7, // m, a car of the traffic's
  carry: 0.7, // his speed, carrying, as a share of flat out
  throwPlus: 30, // m/s over his own speed
  slam: 40, // m/s: a landing or a wall at this speed, carrying, is a slam
  slamHits: 2,
  diveFrom: 30, // m over a foe before Space is a dive
  diveMax: 200, // m: a dive from here or higher is the hardest
  diveSpeed: 90, // m/s, straight at them
  diveCone: 0.7, // cos: how far off straight down a foe may be
  diveHits: [1, 3], // from diveFrom to diveMax
  blockReach: 6, // m: a foe in front, this near, to block
  blockHalf: 0.5, // a blocked blow's share of its hurt
  blockStagger: 0.8, // s: the foe whose swing was blocked
  counter: 0.6, // s: a punch in this window after a block counts double
  pound: { r: 40, speed: 20, cool: 4, low: 3 }, // the ring: how far, how fast, the wait, how near the ground a foe must be
  thrown: { life: 3, g: 9.8 }, // a thrown thing falls for this long at most
};

export const newBrawl = () => ({ held: null, hold: 0, dive: null, pound: 0, blocking: false, counter: 0 });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const floorAt = (x, z) => Math.max(groundAt(x, z), WATER_Y);
const chestOf = (hero) => [hero.p[0], hero.p[1] + 1, hero.p[2]];
// where a held thing is: on his fist, ahead and a little up
const handOf = (hero, look) => [hero.p[0] + look[0] * 1.2, hero.p[1] + 1.4, hero.p[2] + look[2] * 1.2];

// how many blows a dive from `height` metres is: one from BRAWL.diveFrom,
// three from BRAWL.diveMax, whole numbers between (floored)
export function diveDamage(height) {
  const [lo, hi] = BRAWL.diveHits;
  const k = (height - BRAWL.diveFrom) / (BRAWL.diveMax - BRAWL.diveFrom);
  return Math.max(lo, Math.min(hi, Math.floor(lo + (hi - lo) * k)));
}

// what he can take hold of: the nearest live foe within reach that isn't
// Doc Seismic (he's in the air), or null
export function grabbable(foes, hero, look) {
  const chest = chestOf(hero);
  let best = null;
  for (const e of foes.foes) {
    if (!live(e) || e.state === 'held' || e.state === 'thrown') continue;
    if ((e.kind ?? 'flaxan') === 'seismic') continue;
    const d = sub(mid(e), chest);
    const dl = len(d);
    if (dl > BRAWL.reach) continue;
    if (dl > 1.5 && dot(unit(d), look) < 0.5) continue;
    if (!best || dl < best.dl) best = { e, dl };
  }
  return best?.e ?? null;
}

// a foe he can dive on: live, under him by BRAWL.diveFrom or more, near
// enough to straight down, the nearest such; or null
export function diveTarget(foes, hero) {
  let best = null;
  for (const e of foes.foes) {
    if (!live(e) || e.state === 'held' || e.state === 'thrown') continue;
    const d = sub(mid(e), hero.p);
    const dl = len(d);
    if (-d[1] < BRAWL.diveFrom || dl > BRAWL.diveMax * 1.5) continue;
    if (dot(unit(d), [0, -1, 0]) < BRAWL.diveCone) continue;
    if (!best || dl < best.dl) best = { e, dl };
  }
  return best?.e ?? null;
}

export function stepBrawl(prev, prevFoes, hero, input = {}, rawDt, world = {}) {
  const fists = input.fists ?? 1; // (a hero's blow, ./heroes.js)
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const b = { ...prev };
  const f = { ...prevFoes, foes: prevFoes.foes.map((e) => ({ ...e, p: [...e.p], v: [...e.v] })), cars: (prevFoes.cars ?? []).map((c) => ({ ...c, p: [...c.p], v: [...c.v] })), rings: (prevFoes.rings ?? []).map((q) => ({ ...q })) };
  const ev = [];
  let push = null;
  const look = unit(input.look ?? [0, 0, -1]);
  const chest = chestOf(hero);
  const heroSpeed = len(hero.v);
  const byId = (id) => f.foes.find((q) => q.id === id);
  const grounded = hero.mode === 'ground';
  b.pound = Math.max(0, b.pound - dt);
  b.counter = Math.max(0, b.counter - dt);

  // ── holding: the punch held past BRAWL.hold takes hold of what's in reach ──
  if (input.punchHeld) b.hold += dt;
  const wantsGrab = input.punchHeld && b.hold >= BRAWL.hold && !b.held && !b.dive;
  if (wantsGrab) {
    const e = grabbable(f, hero, look);
    if (e) {
      e.state = 'held';
      e.v = [0, 0, 0];
      b.held = { what: 'foe', id: e.id };
      ev.push({ type: 'grab', what: 'foe', id: e.id, kind: e.kind ?? 'flaxan', at: mid(e) });
    } else {
      // a car of the traffic's within reach (world.cars: where they are)
      let car = null;
      let cd = BRAWL.carReach;
      (world.cars ?? []).forEach((c, i) => {
        const q = len(sub(c, chest));
        if (q < cd) [car, cd] = [i, q];
      });
      if (car != null) {
        const id = f.carN ?? 0;
        f.carN = id + 1;
        f.cars.push({ id, p: handOf(hero, look), v: [0, 0, 0], held: 'mark', t: 0, away: false, life: BRAWL.thrown.life });
        b.held = { what: 'car', id, car };
        ev.push({ type: 'grab', what: 'car', id, car, at: handOf(hero, look) });
      }
    }
    // (a hold that found nothing waits for the next press)
    if (!b.held) b.hold = -1e9;
  }

  // ── carrying: the thing rides his fist; a slam on landing or a wall ──
  if (b.held) {
    const thing = b.held.what === 'foe' ? byId(b.held.id) : f.cars.find((c) => c.id === b.held.id);
    if (!thing || (b.held.what === 'foe' && thing.state !== 'held')) b.held = null;
    else {
      const hand = handOf(hero, look);
      thing.p = b.held.what === 'foe' ? [hand[0], hand[1] - (KINDS[thing.kind ?? 'flaxan'].h ?? 0) / 2, hand[2]] : hand;
      const landed = input.landed;
      if (landed && (landed.speed ?? 0) >= BRAWL.slam) {
        // a slam: the thing takes two blows, the street a crater
        const at = [...thing.p];
        ev.push({ type: 'carrySlam', what: b.held.what, id: thing.id, at, speed: landed.speed });
        ev.push({ type: 'crater', at: [at[0], floorAt(at[0], at[2]), at[2]], speed: landed.speed });
        if (b.held.what === 'foe') {
          for (let i = 0; i < BRAWL.slamHits && live(thing) && thing.state !== 'ko'; i++) {
            thing.state = 'approach';
            hitFoe(thing, chest, ev, { slammed: true }, fists);
          }
          if (live(thing) && thing.state !== 'ko') Object.assign(thing, { state: 'stagger', t: KINDS[thing.kind ?? 'flaxan'].stagger ?? 0.8, p: [at[0], floorAt(at[0], at[2]), at[2]] });
        } else Object.assign(thing, { held: null, away: true, v: [0, -5, 0], life: 0.5 });
        b.held = null;
      } else if (!input.punchHeld) {
        // let go: hurled the way he looks (`hurl`: a Mauler's `throw` is its own), at his speed and then some
        const v = look.map((c) => c * (heroSpeed + BRAWL.throwPlus));
        if (b.held.what === 'foe') Object.assign(thing, { state: 'thrown', v, t: BRAWL.thrown.life });
        else Object.assign(thing, { held: null, away: true, v, life: BRAWL.thrown.life });
        ev.push({ type: 'hurl', what: b.held.what, id: thing.id, at: [...thing.p], v });
        b.held = null;
      }
    }
  }
  if (!input.punchHeld) b.hold = 0;

  // ── a thrown foe: an arc, a blow where it lands ──
  for (const e of f.foes) {
    if (e.state !== 'thrown') continue;
    e.t -= dt;
    e.v[1] -= BRAWL.thrown.g * dt;
    for (const a of [0, 1, 2]) e.p[a] += e.v[a] * dt;
    const floor = floorAt(e.p[0], e.p[2]);
    if (e.p[1] <= floor || e.t <= 0) {
      e.p[1] = Math.max(e.p[1], floor);
      e.state = 'approach';
      const at = [...e.p];
      ev.push({ type: 'thrownLanded', id: e.id, kind: e.kind ?? 'flaxan', at });
      hitFoe(e, [at[0] - e.v[0], at[1], at[2] - e.v[2]], ev, { thrown: true }, fists);
      if (live(e) && e.state !== 'ko') Object.assign(e, { state: 'stagger', t: KINDS[e.kind ?? 'flaxan'].stagger ?? 0.8, v: [0, 0, 0] });
    }
  }

  // ── a dive: Space over a foe from height; straight at them until he lands ──
  if (input.dive && !b.dive && !b.held && hero.mode === 'air') {
    const e = diveTarget(f, hero);
    if (e) {
      b.dive = { id: e.id, from: hero.p[1] - mid(e)[1] };
      ev.push({ type: 'dive', id: e.id, height: b.dive.from });
    }
  }
  if (b.dive) {
    const e = byId(b.dive.id);
    const near = e && len(sub(mid(e), chest)) <= 4;
    if (!e || !live(e) || e.state === 'thrown') b.dive = null;
    else if (near || grounded || input.landed) {
      const hits = diveDamage(b.dive.from);
      const at = mid(e);
      ev.push({ type: 'diveHit', id: e.id, kind: e.kind ?? 'flaxan', hits, at });
      ev.push({ type: 'crater', at: [at[0], floorAt(at[0], at[2]), at[2]], speed: BRAWL.diveSpeed });
      for (let i = 0; i < hits && live(e) && e.state !== 'ko'; i++) {
        if (e.state === 'stagger') e.state = 'approach';
        hitFoe(e, chest, ev, { dived: true }, fists);
      }
      b.dive = null;
    } else push = unit(sub(mid(e), chest)).map((c) => c * BRAWL.diveSpeed);
  }

  // ── a block: Shift on the ground, a foe in front and near ──
  b.blocking = Boolean(input.block && grounded && !b.held && f.foes.some((e) => live(e) && e.state !== 'held' && e.state !== 'thrown' && len(sub(mid(e), chest)) <= BRAWL.blockReach && dot(unit(sub(mid(e), chest)), look) > 0.3));

  // ── the ground pound: C on the ground, a ring out along the street ──
  if (input.pound && grounded && b.pound <= 0 && !b.held) {
    b.pound = BRAWL.pound.cool;
    const at = [hero.p[0], floorAt(hero.p[0], hero.p[2]), hero.p[2]];
    f.rings.push({ at, r: 0, from: 'mark', mine: true, hit: [] });
    ev.push({ type: 'pound', at });
    ev.push({ type: 'shake', at, power: 0.6 });
  }
  // his rings (./foes.js steps the villains' own): out to BRAWL.pound.r,
  // flooring small foes near the ground as they pass and staggering big ones
  const rings = [];
  for (const q of f.rings) {
    if (!q.mine) {
      rings.push(q);
      continue;
    }
    const was = q.r;
    q.r += BRAWL.pound.speed * dt;
    for (const e of f.foes) {
      if (!live(e) || e.state === 'held' || e.state === 'thrown' || q.hit.includes(e.id)) continue;
      const m = mid(e);
      if (m[1] - floorAt(m[0], m[2]) > BRAWL.pound.low) continue;
      const d = Math.hypot(m[0] - q.at[0], m[2] - q.at[2]);
      if (d > was && d <= q.r) {
        q.hit.push(e.id);
        const k = e.kind ?? 'flaxan';
        if (KINDS[k].hits <= 1) knockOut(e, q.at, ev, { pounded: true });
        else {
          Object.assign(e, { state: 'stagger', t: KINDS[k].stagger ?? 0.8 });
          ev.push({ type: 'poundHit', id: e.id, kind: k, at: m });
        }
      }
    }
    if (q.r < BRAWL.pound.r) rings.push(q);
  }
  f.rings = rings;

  return { b, foes: f, ev, push, cap: b.held ? FLY.top * BRAWL.carry : null };
}
