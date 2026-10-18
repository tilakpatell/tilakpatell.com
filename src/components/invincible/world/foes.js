// The villains, as plain numbers (./villains.js draws them).
//
// - The Flaxans come through a portal over the river, a few at a time, fly
//   at Mark and circle him, firing slow purple bolts. Elites among them take
//   two blows and fire three bolts at once.
// - The Mauler twins are on the street: they run at him when he's on the
//   ground or low, swing at him when they're close, and when he's up out of
//   reach they pull a car out of the traffic and throw it at him (a punch
//   sends it back). Given something to wreck (`world.hangar`, the last-but-
//   one episode's), they go for it instead while he's away from them or
//   high over them, and swing at it.
// - Doc Seismic hovers over the school's quad in a slow circle, sending a
//   quake ring along the ground every few seconds (it knocks Mark over if
//   he's standing on it) and blasting him when he comes near.
//
// A punch (with a lunge at whoever's a little way off in front of him) or
// flying into one fast hits it; enough hits knock it out. Their blows knock
// him about, and enough of them put him down on the street for a moment.
// His brawl (./brawl.js) does more, and this does it to them: one grabbed
// rides in his hands; thrown, it flies and lands for a blow; slammed, two;
// dived on, the dive's; a counter punch is two; his block halves what
// lands and staggers a Mauler whose swing meets it; his ground pound's ring
// floors the Flaxans and staggers the Maulers it passes.
// Nothing happens until something starts it (Cecil, a mission, or the
// city's clock for the Flaxans).
//
// stepFoes(state, hero, { punch, power, look, eveHit, brawl, block }, dt, { cars, hangar }) →
// { foes: state, ev, push, stun }: `push` a velocity to give him (a lunge,
// a knock), `stun` a moment without control. `cars`: where the traffic's
// cars are, for a Mauler to take one (`throw`'s `car` is its index there);
// `hangar`: a point on the street the Maulers wreck when he's not about.
// A step is never longer than a twentieth of a second, whatever `dt` says
// (a tab hidden for a minute comes back as one step).

import { BRAWL } from './brawl';
import { FLY } from './flight';
import { WATER_Y, groundAt, rng } from './map';

export const PORTAL = { p: [1150, 150, -420], r: 22, n: [-1, 0, 0] }; // over the river, facing downtown
export const FIGHT = {
  count: 12, // the Flaxans in an invasion
  every: 1.2, // seconds between each coming through
  speed: 24,
  orbit: 22, // how far off they circle him
  range: 75, // how near before they fire
  bolt: 45, // m/s
  hurt: 12, // of his 100
  reach: 4.5, // a punch
  lunge: 18, // a punch at someone this far off carries him to them
  lungeSpeed: 70,
  ram: 45, // flying into one faster than this hits it
  hp: 100,
};

// A knock that carries him `m` metres before he's stopped (./flight.js
// slows him to a hover at FLY.stop m/s²).
export const knock = (m) => Math.sqrt(2 * FLY.stop * m);

// hits: blows to knock one out. The rest per kind, in metres, seconds, m/s
// and points of his 100.
export const KINDS = {
  flaxan: { hits: 1, volley: 1, hurt: FIGHT.hurt },
  flaxanElite: { hits: 2, volley: 3, hurt: 16 },
  // low: he's under this (m over the ground), they run at him; above it and
  // within `far`, they throw a car (one within `grab` of them, if there is)
  // (and with something to wreck: they go for it while he's over `away` m
  // off or `up` m over the ground)
  mauler: { h: 2.6, hits: 3, run: 8, reach: 3, every: 1.4, windup: 0.4, swing: 18, knock: 10, low: 6, far: 60, grab: 30, car: 35, carHurt: 22, throwEvery: 4, hold: 0.6, stagger: 0.8, away: 60, up: 30 },
  seismic: { h: 1.8, hits: 5, over: 20, circle: 30, quake: 6, ring: 30, ringTo: 160, blast: 40, blastHurt: 14, knock: 15, blastEvery: 3, stagger: 0.8 },
};
const FLAXANS = new Set(['flaxan', 'flaxanElite']);
const kindOf = (e) => e.kind ?? 'flaxan';
const live = (e) => e.state !== 'waiting' && e.state !== 'ko' && e.state !== 'down';
// standing and his to hit: not in his hands, nor flying from them
const free = (e) => live(e) && e.state !== 'held' && e.state !== 'thrown';
// how high over the ground his pound's ring still reaches (the Flaxans hang low round him)
const POUND_UP = 14;
// where one he carries is: its middle a little ahead of his chest, the way he looks
const carried = (chest, look) => [chest[0] + look[0] * 1.6, chest[1] + look[1] * 1.6 + 0.4, chest[2] + look[2] * 1.6];

export function newFoes(seed = 77) {
  return { on: false, t: 0, seed, foes: [], next: 0, gate: 0, spawned: 0, bolts: [], cars: [], carN: 0, rings: [], pounds: [], hp: FIGHT.hp, cool: 0, lunge: null, won: 0 };
}

// `n` more of a kind: Flaxans wait at the portal and come through it one at
// a time; Maulers stand round `at` (a point on the street) at once; Doc
// Seismic circles over `at`.
export function spawnFoes(prev, kind, n, at = PORTAL.p) {
  const K = KINDS[kind];
  const r = rng(prev.seed + prev.won * 13 + (prev.next ?? 0) * 7);
  const foes = [...prev.foes];
  let next = prev.next ?? foes.length;
  for (let i = 0; i < n; i++) {
    const e = { id: next++, kind, state: 'waiting', p: [...PORTAL.p], v: [0, 0, 0], cool: 1.5 + r() * 2, phase: r() * Math.PI * 2, lean: 0, hits: 0, t: 0, yaw: 0 };
    if (kind === 'mauler') {
      const a = (i / n) * Math.PI * 2;
      const x = at[0] + (n > 1 ? Math.cos(a) * 4 : 0);
      const z = at[2] + (n > 1 ? Math.sin(a) * 4 : 0);
      Object.assign(e, { state: 'approach', p: [x, groundAt(x, z), z], cool: 1 + r(), throwCool: 1 + r() * 2 });
    } else if (kind === 'seismic') {
      const home = [at[0], groundAt(at[0], at[2]), at[2]];
      Object.assign(e, { state: 'drift', home, p: [home[0] + Math.cos(e.phase) * K.circle, home[1] + K.over, home[2] + Math.sin(e.phase) * K.circle], cool: K.quake, blast: K.blastEvery });
    }
    foes.push(e);
  }
  return { ...prev, on: true, foes, next, gate: prev.on ? prev.gate : 0.6 };
}

// more of a kind until there are `total` of them in all, the ones already
// beaten counted (a mission that wants six beaten can't be left wanting)
export function spawnUpTo(prev, kind, total, at) {
  const have = prev.foes.filter((e) => kindOf(e) === kind).length;
  return have >= total ? prev : spawnFoes(prev, kind, total - have, at);
}

// What a Mauler goes for: him, or, given something to wreck, that while
// he's away from it or high over the street (episode 6's hangar). Plain:
// the Mauler's p, his feet, the point to wreck or null.
export function pickTarget(e, hero, hangar) {
  if (!hangar) return 'mark';
  const K = KINDS.mauler;
  const up = hero.p[1] - Math.max(groundAt(hero.p[0], hero.p[2]), WATER_Y);
  const away = Math.hypot(hero.p[0] - e.p[0], hero.p[2] - e.p[2]);
  return away > K.away || up > K.up ? 'hangar' : 'mark';
}

// the Flaxans' invasion: a dozen through the portal
export function startInvasion(f) {
  return spawnFoes({ ...f, t: 0, foes: [], next: 0, spawned: 0, bolts: [], cars: [], rings: [], pounds: [], hp: FIGHT.hp, cool: 0, lunge: null }, 'flaxan', FIGHT.count);
}

// the portal's open while there are Flaxans to come through it or still fighting
export const portalOpen = (f) => Boolean(f.on && f.foes.some((e) => FLAXANS.has(kindOf(e)) && (e.state === 'waiting' || e.state === 'fight')));
// where the ones still standing are (their middles)
export const foeAt = (f) => (f.on ? f.foes.filter(live).map(mid) : []);
// the ones still standing themselves (Eve and the crowd want who, not just where)
export const standing = (f) => (f.on ? f.foes.filter(live) : []);
// what his brawl (./brawl.js) can reach: the ones standing, by their middles
// (Doc Seismic hangs in the air: he can be dived on, not held), and the cars
// loose in the air or in his own hands
export function brawlThings(f) {
  if (!f.on) return [];
  const out = f.foes.filter(live).map((e) => ({ id: e.id, kind: kindOf(e), at: mid(e), grabbable: kindOf(e) !== 'seismic', foe: true }));
  for (const c of f.cars ?? []) if (c.held == null || c.held === 'mark') out.push({ id: `car:${c.id}`, kind: 'car', at: [...c.p], grabbable: true, foe: false });
  return out;
}
// whether a kind is still standing
export const anyOf = (f, kind) => Boolean(f.on && f.foes.some((e) => kindOf(e) === kind && live(e)));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
// the middle of one (a Mauler's and Doc Seismic's `p` is at their feet)
function mid(e) {
  const k = kindOf(e);
  const up = k === 'mauler' ? 1.3 : k === 'seismic' ? 0.9 : 0;
  return [e.p[0], e.p[1] + up, e.p[2]];
}
// how near the move a→b came to c
function nearest(a, b, c) {
  const d = sub(b, a);
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const k = dd ? Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / dd)) : 0;
  return len(sub([a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k], c));
}
// `v` turned `a` radians about the upright
const turnY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

function knockOut(e, from, ev, extra = {}) {
  const d = unit(sub(mid(e), from));
  const k = kindOf(e);
  e.state = 'ko';
  e.ko = 0;
  // the Flaxans go flying; the heavier ones are thrown back and fall
  e.v = FLAXANS.has(k) ? [d[0] * 40, d[1] * 40 + 12, d[2] * 40] : [d[0] * 14, 8, d[2] * 14];
  ev.push({ type: 'ko', id: e.id, kind: k, at: mid(e), dir: d, by: 'mark', ...extra });
}

// a blow: a knock-out once it's had enough, a stagger before
function hitFoe(e, from, ev, extra = {}) {
  const K = KINDS[kindOf(e)];
  e.hits = (e.hits ?? 0) + 1;
  if (e.hits >= K.hits) return knockOut(e, from, ev, extra);
  const d = unit(sub(mid(e), from));
  ev.push({ type: 'hit', id: e.id, kind: kindOf(e), at: mid(e), dir: d, hits: e.hits, ...extra });
  if (K.stagger) Object.assign(e, { state: 'stagger', t: K.stagger });
  else e.v = d.map((c) => c * 12);
}

// knocked flying (or over), then falling, then gone
function fall(e, dt, ev) {
  const k = kindOf(e);
  e.ko += dt;
  e.v[1] -= 9.8 * dt;
  for (const a of [0, 1, 2]) e.p[a] += e.v[a] * dt;
  const floor = Math.max(groundAt(e.p[0], e.p[2]), WATER_Y);
  if (e.ko > 3 || (e.p[1] < floor && (FLAXANS.has(k) || e.v[1] < 0))) {
    if (!FLAXANS.has(k)) e.p[1] = Math.max(e.p[1], floor);
    e.state = 'down';
    ev.push({ type: 'down', id: e.id, kind: k, at: [...e.p] });
  }
}

export function stepFoes(prev, hero, input = {}, rawDt, world = {}) {
  const ev = [];
  // a twentieth of a second at most (and a step of NaN is no step at all)
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  if (!prev.on) {
    if (!prev.foes.some((e) => e.state === 'ko')) return { foes: prev, ev, push: null, stun: 0 };
    // over, but the last ones knocked out are still falling
    const f = { ...prev, foes: prev.foes.map((e) => (e.state === 'ko' ? { ...e, p: [...e.p], v: [...e.v] } : e)) };
    for (const e of f.foes) if (e.state === 'ko') fall(e, dt, ev);
    return { foes: f, ev, push: null, stun: 0 };
  }
  const f = {
    ...prev,
    foes: prev.foes.map((e) => ({ ...e, p: [...e.p], v: [...e.v] })),
    bolts: prev.bolts.map((b) => ({ ...b, p: [...b.p] })),
    cars: (prev.cars ?? []).map((c) => ({ ...c, p: [...c.p], v: [...c.v] })),
    rings: (prev.rings ?? []).map((q) => ({ ...q })),
    pounds: (prev.pounds ?? []).map((q) => ({ ...q })),
  };
  const r = rng(f.seed + Math.floor(f.t * 10));
  f.t += dt;
  const chest = [hero.p[0], hero.p[1] + 1, hero.p[2]];
  const heroSpeed = len(hero.v);
  // where his chest was a step ago: flat out, a slow frame carries him further than a Flaxan is wide
  const was = [chest[0] - hero.v[0] * dt, chest[1] - hero.v[1] * dt, chest[2] - hero.v[2] * dt];
  const alt = hero.p[1] - Math.max(groundAt(hero.p[0], hero.p[2]), WATER_Y);
  const grounded = hero.mode === 'ground' || alt < 1.5;
  const byId = (id) => f.foes.find((q) => q.id === id);
  let push = null;
  let stun = 0;
  // (his block halves whatever lands)
  const hurt = (n, at, extra = {}) => {
    f.hp -= n * (input.block ? BRAWL.block.cut : 1);
    ev.push({ type: 'hurt', at: [...at], hp: f.hp, ...extra });
  };
  const look = unit(input.look ?? [0, 0, -1]);
  // the foe a brawl's out names (a number), or the car ('car:<id>')
  const carOf = (target) => (typeof target === 'string' && target.startsWith('car:') ? f.cars.find((c) => `car:${c.id}` === target) : null);
  // again and again, while it's standing
  const blows = (e, n, from, extra) => {
    for (let i = 0; i < n && live(e); i++) hitFoe(e, from, ev, extra);
  };
  const upright = (e) => (e.state = FLAXANS.has(kindOf(e)) ? 'fight' : kindOf(e) === 'seismic' ? 'drift' : 'approach');

  // what his brawl did this step (./brawl.js)
  for (const o of input.brawl ?? []) {
    const e = typeof o.target === 'number' ? byId(o.target) : null;
    const car = carOf(o.target);
    if (o.kind === 'grab') {
      if (e && free(e)) Object.assign(e, { state: 'held', v: [0, 0, 0] });
      else if (car) Object.assign(car, { held: 'mark', away: false, life: 1e9 });
    } else if (o.kind === 'throw') {
      if (e?.state === 'held') Object.assign(e, { state: 'thrown', v: [...o.v], t: 0 });
      else if (car?.held === 'mark') Object.assign(car, { held: null, away: true, v: [...o.v], life: 4 });
    } else if (o.kind === 'slam') {
      if (e?.state === 'held') {
        upright(e);
        blows(e, o.hits, [o.at[0], o.at[1] + 3, o.at[2]], { slam: true });
      } else if (car?.held === 'mark') {
        car.life = 0;
        car.held = null;
        car.away = true;
      }
    } else if (o.kind === 'diveHit') {
      if (e && free(e) && len(sub(mid(e), o.at)) < 8) blows(e, o.hits, [o.at[0], o.at[1] + 6, o.at[2]], { dive: true });
    } else if (o.kind === 'pound') f.pounds.push({ at: [...o.at], r: 0, to: o.r, speed: o.speed });
  }

  // through the portal, one at a time
  f.gate = (f.gate ?? 0) - dt;
  const waiting = f.foes.find((e) => e.state === 'waiting');
  if (waiting && dt > 0 && f.gate <= 0) {
    f.gate = FIGHT.every;
    f.spawned++;
    const e = waiting;
    e.state = 'fight';
    e.p = [PORTAL.p[0] + (r() - 0.5) * 8, PORTAL.p[1] + (r() - 0.5) * 8, PORTAL.p[2] + (r() - 0.5) * 8];
    e.v = PORTAL.n.map((c) => c * FIGHT.speed);
    ev.push({ type: 'spawn', id: e.id, kind: kindOf(e), at: [...e.p] });
  }

  // Eve's blow (./companions.js names one by its id): hers, not his. It
  // knocks out a Flaxan or a Mauler; Doc Seismic it only hits.
  if (input.eveHit != null) {
    const e = byId(input.eveHit);
    if (e && live(e)) {
      const from = [e.p[0], e.p[1] - 1, e.p[2] - 1];
      if (kindOf(e) === 'seismic') hitFoe(e, from, ev, { by: 'eve' });
      else knockOut(e, from, ev, { by: 'eve' });
    }
  }

  // his punch: a car coming at him first (back it goes), then whoever's in
  // front of him and near, or a lunge to whoever's a little way off
  f.cool = Math.max(0, f.cool - dt);
  if (input.punch && f.cool <= 0) {
    f.cool = 0.35;
    ev.push({ type: 'punch' });
    const car = f.cars.find((c) => c.held == null && !c.away && len(sub(c.p, chest)) <= FIGHT.reach + 1.5);
    if (car) {
      Object.assign(car, { away: true, v: look.map((c) => c * KINDS.mauler.car * 1.3), life: 3 });
      ev.push({ type: 'carAway', id: car.id, at: [...car.p] });
    } else {
      let best = null;
      for (const e of f.foes) {
        if (!free(e)) continue;
        const d = sub(mid(e), chest);
        const dl = len(d);
        if (dl > FIGHT.lunge) continue;
        const cos = (d[0] * look[0] + d[1] * look[1] + d[2] * look[2]) / (dl || 1);
        if (dl > FIGHT.reach && cos < 0.64) continue;
        if (!best || dl < best.dl) best = { e, dl, d };
      }
      // (a counter is two)
      if (best && best.dl <= FIGHT.reach) blows(best.e, input.power ?? 1, chest, { punched: true });
      else if (best) {
        push = unit(best.d).map((c) => c * FIGHT.lungeSpeed);
        f.lunge = { id: best.e.id, t: 0.4, power: input.power ?? 1 };
        ev.push({ type: 'lunge', id: best.e.id });
      }
    }
  }
  if (f.lunge) {
    f.lunge.t -= dt;
    const e = byId(f.lunge.id);
    if (e && free(e) && len(sub(mid(e), chest)) <= FIGHT.reach) {
      blows(e, f.lunge.power ?? 1, chest, { punched: true });
      f.lunge = null;
    } else if (!e || !free(e) || f.lunge.t <= 0) f.lunge = null;
  }

  const toHero = len(sub(PORTAL.p, chest));
  for (const e of f.foes) {
    const k = kindOf(e);
    if (e.state === 'held') {
      // in his hands, the way he looks; and its feet below that, for the heavy ones
      const at = carried(chest, look);
      const up = mid(e)[1] - e.p[1];
      e.p = [at[0], at[1] - up, at[2]];
      e.v = [...hero.v];
      continue;
    }
    if (e.state === 'thrown') {
      // out of his hands: an arc, and a blow where it comes down
      e.t += dt;
      e.v[1] -= 9.8 * dt;
      for (const a of [0, 1, 2]) e.p[a] += e.v[a] * dt;
      const floor = Math.max(groundAt(e.p[0], e.p[2]), WATER_Y);
      if (e.p[1] <= floor || e.t > 4) {
        e.p[1] = Math.max(e.p[1], floor);
        const from = sub(e.p, e.v);
        e.v = [0, 0, 0];
        upright(e);
        hitFoe(e, from, ev, { thrown: true });
      }
      continue;
    }
    // flying into one fast (a stagger's a moment's grace: one pass, one blow)
    if (free(e) && e.state !== 'stagger' && heroSpeed > FIGHT.ram && nearest(was, chest, mid(e)) < (k === 'mauler' ? 3 : 2.8)) {
      if (k === 'seismic') hitFoe(e, chest, ev, { rammed: true });
      else knockOut(e, chest, ev, { rammed: true });
      continue;
    }
    if (e.state === 'fight') {
      // a Flaxan: round him, or round the portal if he's nowhere near it
      const K = KINDS[k];
      e.phase += dt * 0.6;
      const c = toHero < 700 ? chest : PORTAL.p;
      const want = [c[0] + Math.cos(e.phase) * FIGHT.orbit, c[1] + 6 + Math.sin(e.phase * 1.7) * 6, c[2] + Math.sin(e.phase) * FIGHT.orbit];
      const d = sub(want, e.p);
      const go = unit(d).map((x) => x * Math.min(FIGHT.speed, len(d) * 1.5));
      const kk = 1 - Math.exp(-2.5 * dt);
      for (const a of [0, 1, 2]) e.v[a] += (go[a] - e.v[a]) * kk;
      for (const a of [0, 1, 2]) e.p[a] += e.v[a] * dt;
      // and fire at him when he's in range (an elite three at once, fanned)
      e.cool -= dt;
      const dh = sub(chest, e.p);
      if (e.cool <= 0 && len(dh) < FIGHT.range && toHero < 700) {
        e.cool = 2.4 + r() * 1.8;
        const aim = unit(dh);
        for (let i = 0; i < K.volley; i++) f.bolts.push({ p: [...e.p], v: turnY(aim, (i - (K.volley - 1) / 2) * 0.08).map((x) => x * FIGHT.bolt), life: 3, hurt: K.hurt });
        ev.push({ type: 'bolt', id: e.id, at: [...e.p], n: K.volley });
      }
    } else if (k === 'mauler' && live(e)) {
      const K = KINDS.mauler;
      const flat = [chest[0] - e.p[0], 0, chest[2] - e.p[2]];
      const fd = Math.hypot(flat[0], flat[2]);
      const d = len(sub(chest, mid(e)));
      // what it's after: him, or the thing to wreck while he's not about
      e.target = pickTarget(e, hero, world.hangar ?? null);
      const wreck = e.target === 'hangar';
      const goal = wreck ? [world.hangar[0] - e.p[0], 0, world.hangar[2] - e.p[2]] : flat;
      const gd = Math.hypot(goal[0], goal[2]);
      e.cool -= dt;
      e.throwCool -= dt;
      e.v = [0, 0, 0];
      if (gd > 0.1) e.yaw = Math.atan2(goal[0], goal[2]);
      if (e.state === 'stagger') {
        e.t -= dt;
        if (e.t <= 0) e.state = 'approach';
      } else if (e.state === 'swing') {
        // the blow lands at the end of the wind-up, if he's still there (or on the thing it's wrecking)
        e.t -= dt;
        if (e.t <= 0) {
          if (e.swingAt === 'hangar') ev.push({ type: 'swing', id: e.id, at: mid(e), hit: false, on: 'hangar' });
          else {
            const hit = d <= K.reach + 0.5;
            ev.push({ type: 'swing', id: e.id, at: mid(e), hit });
            if (hit) {
              hurt(K.swing, chest, { by: 'mauler' });
              if (input.block) {
                // met by his block: it's the Mauler that's off balance (./brawl.js opens a counter)
                Object.assign(e, { state: 'stagger', t: BRAWL.block.stagger });
                ev.push({ type: 'blocked', id: e.id, at: mid(e) });
                continue;
              }
              const out = unit([flat[0], 0, flat[2]]);
              push = [out[0] * knock(K.knock), 4, out[2] * knock(K.knock)];
              stun = Math.max(stun, 0.3);
            }
          }
          e.state = 'approach';
        }
      } else if (e.state === 'throw') {
        e.t -= dt;
        if (e.t <= 0) e.state = 'approach';
      } else if (wreck) {
        // at the thing to wreck, along the street, and a swing at it once there
        if (gd <= K.reach && e.cool <= 0) Object.assign(e, { state: 'swing', t: K.windup, cool: K.every, swingAt: 'hangar' });
        else if (gd > 0.1) {
          const go = Math.min(K.run * dt, Math.max(0, gd - 2));
          e.v = [(goal[0] / gd) * K.run, 0, (goal[2] / gd) * K.run];
          e.p[0] += (goal[0] / gd) * go;
          e.p[2] += (goal[2] / gd) * go;
          e.p[1] = groundAt(e.p[0], e.p[2]);
        }
      } else if (d <= K.reach && e.cool <= 0) {
        Object.assign(e, { state: 'swing', t: K.windup, cool: K.every, swingAt: 'mark' });
      } else if (alt >= K.low && fd >= K.low && d <= K.far && e.throwCool <= 0) {
        // he's up out of reach: a car (the nearest of the traffic's, or one off the street)
        let car = null;
        let cd = K.grab;
        (world.cars ?? []).forEach((c, i) => {
          const q = Math.hypot(c[0] - e.p[0], c[2] - e.p[2]);
          if (q < cd) [car, cd] = [i, q];
        });
        Object.assign(e, { state: 'throw', t: K.hold, throwCool: K.throwEvery });
        f.cars.push({ id: f.carN, p: [e.p[0], e.p[1] + K.h + 0.8, e.p[2]], v: [0, 0, 0], held: e.id, t: K.hold, away: false, life: 4 });
        ev.push({ type: 'throw', id: e.id, car, thrown: f.carN, at: mid(e) });
        f.carN = (f.carN ?? 0) + 1;
      } else if (alt < K.low || d > K.far) {
        // at him, along the street, stopping short
        const go = Math.min(K.run * dt, Math.max(0, fd - 2));
        if (fd > 0.1) {
          e.v = [(flat[0] / fd) * K.run, 0, (flat[2] / fd) * K.run];
          e.p[0] += (flat[0] / fd) * go;
          e.p[2] += (flat[2] / fd) * go;
          e.p[1] = groundAt(e.p[0], e.p[2]);
        }
      }
    } else if (k === 'seismic' && live(e)) {
      const K = KINDS.seismic;
      if (e.state === 'stagger') {
        e.t -= dt;
        if (e.t <= 0) e.state = 'drift';
      } else {
        // round the quad, 20 m up
        e.phase += dt * 0.25;
        const want = [e.home[0] + Math.cos(e.phase) * K.circle, e.home[1] + K.over, e.home[2] + Math.sin(e.phase) * K.circle];
        const d = sub(want, e.p);
        const step = Math.min(len(d), 12 * dt);
        const u = unit(d);
        e.v = dt > 0 ? u.map((c) => (c * step) / dt) : [0, 0, 0];
        for (const a of [0, 1, 2]) e.p[a] += u[a] * step;
        const toMark = sub(chest, mid(e));
        e.yaw = Math.atan2(toMark[0], toMark[2]);
        // the quake: a ring out along the ground from under him
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = K.quake;
          const at = [e.p[0], groundAt(e.p[0], e.p[2]), e.p[2]];
          f.rings.push({ at, r: 0, from: e.id });
          ev.push({ type: 'quake', id: e.id, at });
          ev.push({ type: 'shake', at, power: 1 });
        }
        // and a blast at him when he comes near
        e.blast -= dt;
        if (e.blast <= 0 && len(toMark) <= K.blast) {
          e.blast = K.blastEvery;
          const dir = unit(toMark);
          ev.push({ type: 'blast', id: e.id, at: mid(e), dir });
          hurt(K.blastHurt, chest, { by: 'seismic' });
          push = dir.map((c) => c * knock(K.knock));
          stun = Math.max(stun, 0.3);
        }
      }
    } else if (e.state === 'ko') fall(e, dt, ev);
  }

  // the bolts
  const left = [];
  for (const b of f.bolts) {
    b.life -= dt;
    const from = [...b.p];
    for (const a of [0, 1, 2]) b.p[a] += b.v[a] * dt;
    // (along its path this step, so one meeting him head-on flat out can't pass through him)
    if (nearest(from, b.p, chest) < 1.3) {
      hurt(b.hurt ?? FIGHT.hurt, b.p);
      push = unit(b.v).map((x) => x * 14);
      stun = Math.max(stun, 0.25);
      continue;
    }
    if (b.life > 0) left.push(b);
  }
  f.bolts = left;

  // the cars: held up, then thrown straight at him; punched back, they fall
  const flying = [];
  for (const c of f.cars) {
    if (c.held === 'mark') {
      // in his hands, over his head
      c.p = carried(chest, look);
      c.p[1] += 0.8;
      c.v = [...hero.v];
      flying.push(c);
      continue;
    }
    if (c.held != null) {
      const m = byId(c.held);
      if (m && live(m) && m.state !== 'stagger') {
        c.p = [m.p[0], m.p[1] + KINDS.mauler.h + 0.8, m.p[2]];
        c.t -= dt;
        if (c.t <= 0) {
          c.held = null;
          c.v = unit(sub(chest, c.p)).map((x) => x * KINDS.mauler.car);
        }
        flying.push(c);
        continue;
      }
      // dropped (he was hit as he held it)
      c.held = null;
      c.away = true;
    }
    const from = [...c.p];
    c.life -= dt;
    if (c.away) c.v[1] -= 9.8 * dt;
    for (const a of [0, 1, 2]) c.p[a] += c.v[a] * dt;
    if (!c.away && nearest(from, c.p, chest) < 2.2) {
      hurt(KINDS.mauler.carHurt, c.p, { by: 'car' });
      ev.push({ type: 'carHit', id: c.id, at: [...c.p] });
      push = unit(c.v).map((x) => x * knock(8));
      stun = Math.max(stun, 0.5);
      continue;
    }
    // sent back: a Mauler in its way takes the blow
    if (c.away) {
      const m = f.foes.find((q) => kindOf(q) === 'mauler' && live(q) && nearest(from, c.p, mid(q)) < 2.5);
      if (m) {
        hitFoe(m, from, ev, { car: true });
        ev.push({ type: 'carDown', id: c.id, at: [...c.p] });
        continue;
      }
    }
    if (c.life <= 0 || c.p[1] < Math.max(groundAt(c.p[0], c.p[2]), WATER_Y)) {
      ev.push({ type: 'carDown', id: c.id, at: [...c.p] });
      continue;
    }
    flying.push(c);
  }
  f.cars = flying;

  // the quake rings: out along the ground, knocking him over if he's on it
  const rings = [];
  for (const q of f.rings) {
    const was = q.r;
    q.r += KINDS.seismic.ring * dt;
    const d = Math.hypot(hero.p[0] - q.at[0], hero.p[2] - q.at[2]);
    if (grounded && d > was && d <= q.r) {
      stun = Math.max(stun, 1.2);
      push = [0, 6, 0];
      ev.push({ type: 'floored', at: [...hero.p] });
    }
    if (q.r < KINDS.seismic.ringTo) rings.push(q);
  }
  f.rings = rings;

  // his ground pound: a ring out along the ground, flooring the Flaxans it
  // passes and staggering the Maulers (Doc Seismic is over it)
  const pounds = [];
  for (const q of f.pounds) {
    q.r = Math.min(q.to, q.r + q.speed * dt);
    q.hit = [...(q.hit ?? [])];
    for (const e of f.foes) {
      if (!free(e) || kindOf(e) === 'seismic' || q.hit.includes(e.id)) continue;
      // (each once, the moment the ring's past it: the Flaxans fly faster than it spreads)
      const d = Math.hypot(e.p[0] - q.at[0], e.p[2] - q.at[2]);
      if (d > q.r || e.p[1] - q.at[1] > POUND_UP) continue;
      q.hit.push(e.id);
      if (FLAXANS.has(kindOf(e))) knockOut(e, [q.at[0], q.at[1] - 2, q.at[2]], ev, { pounded: true });
      else {
        Object.assign(e, { state: 'stagger', t: BRAWL.block.stagger });
        ev.push({ type: 'pounded', id: e.id, kind: kindOf(e), at: mid(e) });
      }
    }
    if (q.r < q.to) pounds.push(q);
  }
  f.pounds = pounds;

  if (f.hp <= 0) {
    // down on the street for a moment, and back up
    f.hp = FIGHT.hp;
    push = [0, -60, 0];
    stun = 1.2;
    ev.push({ type: 'beaten' });
  }

  // all of them down: it's over (and the portal closes, if it was the Flaxans)
  if (f.foes.length && f.foes.every((e) => e.state === 'ko' || e.state === 'down')) {
    const flax = f.foes.some((e) => FLAXANS.has(kindOf(e)));
    f.on = false;
    f.won++;
    f.bolts = [];
    f.cars = [];
    f.rings = [];
    f.pounds = [];
    ev.push({ type: 'clear', time: f.t });
    if (flax) ev.push({ type: 'won', count: f.won, time: f.t });
  }
  return { foes: f, ev, push, stun };
}
