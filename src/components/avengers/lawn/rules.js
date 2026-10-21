// Hold the Lawn: the rules, apart from the drawing, so they can be tested.
//
// Thor on the terrace in front of the compound, at night, in a storm. First he
// lifts Mjolnir: hold, and keep a needle that wants to fall over (an inverted
// pendulum) in the green until the hammer comes up. Then the Chitauri cross the
// lawn. Throw the hammer at a point: it flies through everything in its way.
// Recall it: it comes back to his hand, through everything in its way again.
// Armoured brutes and Cull Obsidian turn a throw aside with their shields, so
// they can only be hit from behind, by a recall; Thor walks along the terrace
// to line one up. While the hammer is in his hand he swats bolts away; while
// it's out, they hurt. Kills charge lightning, which strikes the hammer (or the
// aim, if he's holding it) and chains from one Chitauri to the next.
// Seven waves, then Cull Obsidian, for the Reality Stone.
//
// Metres: x right, y up, z toward the terrace; Thor stands at z = 0.

import { rng } from '../hq/rng';

export const LINE = -1.8; // the terrace's edge: a Chitauri past it gets through
const SPAWN_Z = -58; // the tree line
export const LAWN = {
  hearts: 5,
  thorSpeed: 7,
  thorX: 10, // how far along the terrace he can walk
  hand: { dx: 0.45, y: 1.3 },
  throwSpeed: 32,
  recallSpeed: 36,
  range: 44,
  hammerR: 0.45,
  aimY: 1.2, // a throw flies at chest height
  boltSpeed: 11,
  boltHit: 0.75,
  strike: 4.5, // lightning's reach where it lands
  chain: 9, // how far it jumps
  chains: 6,
  iframes: 0.8, // seconds a bolt that hurts him leaves him safe from the next
};
const KINDS = {
  soldier: { hp: 1, r: 0.55, speed: [1.7, 2.5], score: 100, charge: 10, breach: 1 },
  brute: { hp: 2, r: 0.9, speed: [1.05, 1.25], score: 300, charge: 20, breach: 2, armour: true },
  chariot: { hp: 2, r: 1.6, speed: [6.5, 7.5], score: 250, charge: 20, breach: 0 },
  cull: { hp: 9, r: 1.5, speed: [0.75, 0.75], score: 2500, charge: 0, breach: 99, armour: true },
};

// The waves: groups of Chitauri, each `n` of a kind, one every `every`
// seconds, starting `at` seconds in; `shooters` of the soldiers stop to fire.
export const WAVES = [
  { title: 'Scouts', groups: [{ kind: 'soldier', n: 7, every: 1.6 }] },
  { title: 'Shooters', groups: [{ kind: 'soldier', n: 9, every: 1.5, shooters: 4 }] },
  { title: 'Brutes', groups: [{ kind: 'soldier', n: 6, every: 1.8 }, { kind: 'brute', n: 2, every: 6, at: 2 }] },
  { title: 'Chariots', groups: [{ kind: 'soldier', n: 8, every: 1.6, shooters: 2 }, { kind: 'chariot', n: 2, every: 7, at: 3 }] },
  { title: 'The push', groups: [{ kind: 'soldier', n: 12, every: 1.3, shooters: 4 }, { kind: 'brute', n: 2, every: 9, at: 4 }] },
  { title: 'Swarm', groups: [{ kind: 'soldier', n: 18, every: 0.9, shooters: 3 }] },
  { title: 'Siege', groups: [{ kind: 'soldier', n: 10, every: 1.6, shooters: 4 }, { kind: 'brute', n: 3, every: 7, at: 2 }, { kind: 'chariot', n: 2, every: 10, at: 6 }] },
  { title: 'Cull Obsidian', boss: true, groups: [{ kind: 'cull', n: 1, every: 1 }, { kind: 'soldier', n: 4, every: 2, at: 3 }, { kind: 'chariot', n: 1, every: 1, at: 12 }] },
];
// the boss's wave, where the checkpoint starts
export const BOSS_WAVE = WAVES.findIndex((w) => w.boss);

// ── the lift ──
// The needle falls away from the middle (it's balancing an upright hammer);
// a random gust pushes it; the player pushes back. Green is |x| < GREEN.
export const LIFT = { green: 0.3, fall: 2.6, gust: 1.2, push: 3.4, damp: 0.6, need: 2.4 };

export function newLawn({ seed = 1 } = {}) {
  const g = { seed, phase: 'ready', score: 0, wave: 0, queue: [] };
  reset(g);
  return g;
}

function reset(g) {
  g.rand = rng(g.seed);
  g.t = 0;
  g.thor = { x: 0, move: 0, hp: LAWN.hearts, hurt: 0, safe: 0 };
  g.hammer = { state: 'held', x: 0, y: LAWN.hand.y, z: 0, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 0, hit: [], kills: 0 };
  g.enemies = [];
  g.bolts = [];
  g.spawns = [];
  g.charge = 0;
  g.nextId = 1;
  g.breakT = 0;
  g.next = 0; // the wave after this break
  g.lift = { x: 0, v: 0, progress: 0, gust: 0, gustT: 0, holding: false, push: 0 };
  placeHammer(g);
}

// Start the lift (a new game).
export function startLawn(g) {
  g.score = 0;
  g.wave = 0;
  reset(g);
  g.phase = 'lift';
  g.lift.x = (g.rand() < 0.5 ? -1 : 1) * 0.04;
  g.queue.push({ type: 'lift' });
  return g.queue.splice(0);
}

// Skip the lift (once it's been done): straight to the first wave.
export function skipLift(g) {
  if (g.phase !== 'lift') return;
  g.phase = 'break';
  g.breakT = 1.2;
  g.queue.push({ type: 'lifted', skipped: true });
}

// Start again at the boss's wave, once it's been reached: the lift is already
// done; five hearts, lightning empty, nothing carried over from the game lost.
export function startAtBoss(g) {
  g.score = 0;
  reset(g);
  g.wave = g.next = BOSS_WAVE;
  g.phase = 'break';
  g.breakT = 1.2;
  g.queue.push({ type: 'checkpoint', n: BOSS_WAVE + 1 });
  return g.queue.splice(0);
}

// Hold (or let go of) the hammer in the lift, pushing the needle -1..1.
export function liftInput(g, holding, push = 0) {
  g.lift.holding = holding;
  g.lift.push = Math.max(-1, Math.min(1, push));
}

function stepLift(g, dt, ev) {
  const L = g.lift;
  if (!L.holding) {
    L.progress = Math.max(0, L.progress - dt * 0.6);
    L.v += (-L.x * 6 - L.v * 4) * dt; // it settles back
    L.x += L.v * dt;
    return;
  }
  L.gustT -= dt;
  if (L.gustT <= 0) {
    L.gustT = 0.5 + g.rand() * 0.5;
    L.gust = (g.rand() * 2 - 1) * LIFT.gust;
  }
  const a = LIFT.fall * L.x + L.gust + L.push * LIFT.push;
  L.v += a * dt;
  L.v *= 1 - LIFT.damp * dt;
  L.x += L.v * dt;
  const ax = Math.abs(L.x);
  if (ax >= 1) {
    ev.push({ type: 'drop' });
    L.x = 0;
    L.v = 0;
    L.progress = 0;
    L.holding = false;
    return;
  }
  if (ax < LIFT.green) L.progress += dt / LIFT.need;
  else L.progress = Math.max(0, L.progress - dt * 0.2);
  if (L.progress >= 1) {
    L.progress = 1;
    g.phase = 'break';
    g.breakT = 1.6;
    ev.push({ type: 'lifted' });
  }
}

// ── Thor and the hammer ──
const hand = (g) => ({ x: g.thor.x + LAWN.hand.dx, y: LAWN.hand.y, z: 0 });
function placeHammer(g) {
  const p = hand(g);
  Object.assign(g.hammer, { x: p.x, y: p.y, z: p.z });
}

// Walk along the terrace: -1 left, 0 stop, 1 right.
export const setMove = (g, dir) => {
  g.thor.move = Math.max(-1, Math.min(1, dir));
};

const live = (g) => g.phase === 'wave' || g.phase === 'break';

// Throw the hammer at a point (it flies at chest height unless the point is
// in the air, at a chariot).
export function throwHammer(g, aim) {
  const h = g.hammer;
  if (!live(g) || h.state !== 'held') return false;
  const p = hand(g);
  const ty = aim.y ?? LAWN.aimY;
  let dx = aim.x - p.x;
  let dy = ty - p.y;
  let dz = aim.z - p.z;
  let d = Math.hypot(dx, dy, dz);
  if (dz > -1 || d < 0.5) return false; // only out over the lawn
  const reach = Math.min(LAWN.range, Math.max(3, d));
  dx /= d;
  dy /= d;
  dz /= d;
  d = reach;
  Object.assign(h, { state: 'out', tx: p.x + dx * d, ty: p.y + dy * d, tz: p.z + dz * d, vx: dx * LAWN.throwSpeed, vy: dy * LAWN.throwSpeed, vz: dz * LAWN.throwSpeed, hit: [], kills: 0 });
  g.queue.push({ type: 'throw', x: h.tx, y: h.ty, z: h.tz });
  return true;
}

// Call the hammer back.
export function recallHammer(g) {
  const h = g.hammer;
  if (!live(g) || (h.state !== 'out' && h.state !== 'down')) return false;
  h.state = 'back';
  h.hit = [];
  h.kills = 0;
  g.queue.push({ type: 'recall', x: h.x, y: h.y, z: h.z });
  return true;
}

// Bring down lightning: on the hammer if it's out, else on `at`.
export function callLightning(g, at) {
  if (!live(g) || g.charge < 100) return false;
  const h = g.hammer;
  const p = h.state === 'held' ? at : h;
  if (!p) return false;
  g.charge = 0;
  const ev = g.queue;
  const arcs = [];
  const struck = new Set();
  // where it lands
  for (const e of g.enemies) {
    if (e.hp <= 0 || !e.onLawn) continue;
    if (Math.hypot(e.x - p.x, e.z - p.z) < LAWN.strike + e.r) {
      struck.add(e);
      arcs.push([p.x, 0, p.z, e.x, e.y + e.h * 0.6, e.z]);
    }
  }
  // then from Chitauri to Chitauri
  let from = [...struck].sort((a, b) => b.z - a.z)[0] ?? { x: p.x, y: 0, z: p.z, h: 0 };
  for (let i = 0; i < LAWN.chains; i++) {
    let best = null;
    let bd = LAWN.chain;
    for (const e of g.enemies) {
      if (e.hp <= 0 || !e.onLawn || struck.has(e)) continue;
      const d = Math.hypot(e.x - from.x, e.z - from.z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) break;
    struck.add(best);
    arcs.push([from.x, (from.y ?? 0) + (from.h ?? 0) * 0.6, from.z, best.x, best.y + best.h * 0.6, best.z]);
    from = best;
  }
  ev.push({ type: 'lightning', x: p.x, z: p.z, arcs });
  for (const e of struck) damage(g, e, 1, { lightning: true }, ev);
  // and it burns every bolt nearby out of the air
  g.bolts = g.bolts.filter((b) => Math.hypot(b.x - p.x, b.z - p.z) > LAWN.strike);
  return true;
}

// ── the Chitauri ──
function spawn(g, kind, opts = {}) {
  const K = KINDS[kind];
  const r = g.rand;
  const speed = K.speed[0] + r() * (K.speed[1] - K.speed[0]);
  const e = { id: g.nextId++, kind, hp: K.hp, r: K.r, speed, t: 0, seed: r() * 10, stagger: 0, onLawn: true, h: kind === 'cull' ? 3.2 : kind === 'brute' ? 2.4 : 1.9 };
  if (kind === 'chariot') {
    const side = r() < 0.5 ? -1 : 1;
    Object.assign(e, { x: side * 36, y: 5 + r() * 1.5, z: -20 - r() * 14, vx: -side * speed, vz: 0, passes: 2, cool: 1.5 + r(), h: 0.8 });
  } else {
    const x = opts.x ?? (r() * 2 - 1) * 14;
    const goal = Math.max(-9, Math.min(9, x * 0.5 + (r() * 2 - 1) * 5));
    Object.assign(e, { x, y: 0, z: opts.z ?? SPAWN_Z - r() * 3, goal, fx: 0, fz: 1 });
    if (opts.shooter) Object.assign(e, { shooter: true, stopZ: -30 + r() * 8, shots: 0, cool: 0.6 + r(), charging: 0 });
    if (kind === 'cull') Object.assign(e, { goal: 0, x: 0, roar: 7 });
  }
  g.enemies.push(e);
  g.queue.push({ type: 'spawn', kind, id: e.id });
  return e;
}

function startWave(g, n) {
  g.wave = n;
  g.phase = 'wave';
  const W = WAVES[n];
  g.spawns = [];
  for (const grp of W.groups) {
    const shooters = new Set();
    while (shooters.size < Math.min(grp.n, grp.shooters ?? 0)) shooters.add(Math.floor(g.rand() * grp.n));
    for (let i = 0; i < grp.n; i++) g.spawns.push({ at: g.t + (grp.at ?? 0) + i * grp.every, kind: grp.kind, shooter: shooters.has(i) });
  }
  g.spawns.sort((a, b) => a.at - b.at);
  g.queue.push({ type: 'wave', n: n + 1, title: W.title, boss: !!W.boss });
}

function award(g, e, ev, how) {
  const K = KINDS[e.kind];
  const h = g.hammer;
  let score = K.score;
  if (how.hammer) {
    h.kills++;
    score += 50 * (h.kills - 1); // more for each in one flight
  }
  g.score += score;
  g.charge = Math.min(100, g.charge + K.charge);
  ev.push({ type: 'kill', id: e.id, kind: e.kind, x: e.x, y: e.y + e.h * 0.5, z: e.z, score, multi: how.hammer ? h.kills : 0, lightning: !!how.lightning });
  if (e.kind === 'cull') win(g, ev);
}

function damage(g, e, dmg, how, ev) {
  if (e.hp <= 0) return;
  const was = g.charge;
  e.hp -= dmg;
  if (e.hp <= 0) award(g, e, ev, how);
  else {
    g.charge = Math.min(100, g.charge + 4);
    ev.push({ type: 'hit', id: e.id, kind: e.kind, x: e.x, y: e.y + e.h * 0.5, z: e.z, hp: e.hp, back: !!how.back });
  }
  if (was < 100 && g.charge >= 100) ev.push({ type: 'ready' });
}

function win(g, ev) {
  const bonus = g.thor.hp * 500;
  g.score += bonus;
  g.phase = 'won';
  ev.push({ type: 'won', score: g.score, bonus, stone: true });
}

function hurt(g, n, by, ev) {
  g.thor.hp = Math.max(0, g.thor.hp - n);
  g.thor.hurt = 0.5;
  ev.push({ type: 'hurt', hp: g.thor.hp, by });
  if (g.thor.hp <= 0 && g.phase !== 'lost') {
    g.phase = 'lost';
    ev.push({ type: 'lost', score: g.score, wave: g.wave + 1 });
  }
}

// distance from a point to a segment, in x–z (or in 3D with `y`)
function segDist(px, py, pz, ax, ay, az, bx, by, bz, flat) {
  const dx = bx - ax;
  const dy = flat ? 0 : by - ay;
  const dz = bz - az;
  const l2 = dx * dx + dy * dy + dz * dz || 1e-9;
  let t = ((px - ax) * dx + (flat ? 0 : (py - ay) * dy) + (pz - az) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + dx * t - px, flat ? 0 : ay + dy * t - py, az + dz * t - pz);
}

// The hammer's path this step, through the Chitauri and their bolts.
function sweep(g, ax, ay, az, ev) {
  const h = g.hammer;
  for (const e of g.enemies) {
    if (e.hp <= 0 || !e.onLawn || h.hit.includes(e.id)) continue;
    const air = e.kind === 'chariot';
    const d = air ? segDist(e.x, e.y, e.z, ax, ay, az, h.x, h.y, h.z, false) : segDist(e.x, 0, e.z, ax, 0, az, h.x, 0, h.z, true);
    if (d > e.r + LAWN.hammerR || (!air && h.y > e.h + 0.5)) continue;
    h.hit.push(e.id);
    if (KINDS[e.kind].armour) {
      // from the front (against the way it faces) the shield turns it aside
      const back = h.vx * e.fx + h.vz * e.fz > 0;
      if (!back) {
        h.state = 'down';
        h.y = 0.3;
        h.vx = h.vy = h.vz = 0;
        // it drops just in front of the shield
        const l = Math.hypot(ax - e.x, az - e.z) || 1;
        h.x = e.x + ((ax - e.x) / l) * (e.r + 0.6);
        h.z = e.z + ((az - e.z) / l) * (e.r + 0.6);
        ev.push({ type: 'block', id: e.id, kind: e.kind, x: h.x, y: 1.2, z: h.z });
        return;
      }
      if (e.kind === 'cull') e.stagger = 1.4;
      damage(g, e, e.kind === 'cull' ? 3 : 2, { hammer: true, back: true }, ev);
    } else damage(g, e, 1, { hammer: true }, ev);
  }
  // bolts it passes through are gone
  const before = g.bolts.length;
  g.bolts = g.bolts.filter((b) => {
    if (segDist(b.x, b.y, b.z, ax, ay, az, h.x, h.y, h.z, false) > 0.9) return true;
    ev.push({ type: 'deflect', x: b.x, y: b.y, z: b.z });
    return false;
  });
  if (g.bolts.length !== before) g.charge = Math.min(100, g.charge + 2);
}

export function stepLawn(g, dt) {
  const ev = g.queue.splice(0);
  if (g.phase === 'lift') {
    g.t += dt;
    stepLift(g, dt, ev);
    return ev;
  }
  if (!live(g)) return ev;
  g.t += dt;
  const T = g.thor;
  T.hurt = Math.max(0, T.hurt - dt);
  T.safe = Math.max(0, T.safe - dt);
  T.x = Math.max(-LAWN.thorX, Math.min(LAWN.thorX, T.x + T.move * LAWN.thorSpeed * dt));

  // between waves
  if (g.phase === 'break') {
    g.breakT -= dt;
    if (g.breakT <= 0) startWave(g, g.next);
  }

  // the hammer
  const h = g.hammer;
  if (h.state === 'held') placeHammer(g);
  else if (h.state === 'out') {
    const ax = h.x;
    const ay = h.y;
    const az = h.z;
    const left = Math.hypot(h.tx - h.x, h.ty - h.y, h.tz - h.z);
    const step = LAWN.throwSpeed * dt;
    if (step >= left) {
      h.x = h.tx;
      h.y = h.ty;
      h.z = h.tz;
    } else {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.z += h.vz * dt;
    }
    sweep(g, ax, ay, az, ev);
    if (h.state === 'out' && step >= left) {
      h.state = 'down';
      h.y = 0.3;
      ev.push({ type: 'land', x: h.x, z: h.z });
    }
  } else if (h.state === 'back') {
    const p = hand(g);
    const ax = h.x;
    const ay = h.y;
    const az = h.z;
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const dz = p.z - h.z;
    const d = Math.hypot(dx, dy, dz);
    const step = LAWN.recallSpeed * dt;
    h.vx = (dx / d) * LAWN.recallSpeed;
    h.vy = (dy / d) * LAWN.recallSpeed;
    h.vz = (dz / d) * LAWN.recallSpeed;
    if (step >= d) placeHammer(g);
    else {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.z += h.vz * dt;
    }
    sweep(g, ax, ay, az, ev);
    if (step >= d) {
      h.state = 'held';
      ev.push({ type: 'catch', kills: h.kills });
    }
  }

  // new Chitauri
  while (g.spawns.length && g.spawns[0].at <= g.t) {
    const s = g.spawns.shift();
    spawn(g, s.kind, { shooter: s.shooter });
  }

  // the Chitauri
  for (const e of g.enemies) {
    if (e.hp <= 0 || !e.onLawn) continue;
    e.t += dt;
    if (e.kind === 'chariot') {
      e.x += e.vx * dt;
      e.cool -= dt;
      if (e.cool <= 0 && Math.abs(e.x) < 18) {
        e.cool = 3.2;
        fire(g, e, ev);
      }
      if (Math.abs(e.x) > 38) {
        e.passes--;
        if (e.passes <= 0) e.onLawn = false;
        else {
          e.vx = -e.vx;
          e.z = Math.max(-36, Math.min(-16, e.z + (g.rand() * 2 - 1) * 6));
        }
      }
      continue;
    }
    if (e.stagger > 0) {
      e.stagger -= dt;
      continue;
    }
    let walk = true;
    if (e.shooter && e.shots < 3 && e.z >= e.stopZ) {
      walk = false;
      if (e.charging > 0) {
        e.charging -= dt;
        if (e.charging <= 0) {
          fire(g, e, ev);
          e.shots++;
          e.cool = 2.6 + g.rand();
        }
      } else {
        e.cool -= dt;
        if (e.cool <= 0) {
          e.charging = 1.1;
          ev.push({ type: 'charge', id: e.id });
        }
      }
    }
    if (e.kind === 'cull') {
      e.roar -= dt;
      if (e.roar <= 0 && e.z < -10) {
        e.roar = 8;
        ev.push({ type: 'roar', id: e.id });
        for (let i = 0; i < 3; i++) spawn(g, 'soldier', { x: e.x + (i - 1) * 2.5, z: e.z - 2 });
      }
    }
    if (walk) {
      const dx = e.goal - e.x;
      const dz = LINE + 0.5 - e.z;
      const l = Math.hypot(dx, dz) || 1;
      e.fx = dx / l;
      e.fz = dz / l;
      // a little weave, so they don't come in on rails
      const weave = e.kind === 'soldier' ? Math.sin(e.t * 1.3 + e.seed) * 0.35 : 0;
      e.x += (e.fx + weave * e.fz) * e.speed * dt;
      e.z += e.fz * e.speed * dt;
    }
    if (e.z >= LINE) {
      e.onLawn = false;
      ev.push({ type: 'breach', id: e.id, kind: e.kind, x: e.x, z: e.z });
      hurt(g, KINDS[e.kind].breach, e.kind, ev);
      if (!live(g)) return ev;
    }
  }

  // bolts: swatted by the hammer in his hand, otherwise they hurt
  const p = { x: T.x, y: 1.3, z: 0 };
  g.bolts = g.bolts.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.t += dt;
    if (Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) < LAWN.boltHit) {
      if (h.state === 'held') ev.push({ type: 'swat', x: b.x, y: b.y, z: b.z });
      // (a volley a hair apart is one hit, not a heart each: his i-frames)
      else if (T.safe <= 0) {
        T.safe = LAWN.iframes;
        hurt(g, 1, 'bolt', ev);
      }
      return false;
    }
    return b.z < 3 && b.t < 6 && b.y > -0.5;
  });
  if (!live(g)) return ev;

  g.enemies = g.enemies.filter((e) => e.hp > 0 && e.onLawn);

  // the wave's end
  if (g.phase === 'wave' && !g.spawns.length && !g.enemies.length) {
    ev.push({ type: 'clear', n: g.wave + 1 });
    if (g.wave < WAVES.length - 1) {
      g.phase = 'break';
      g.breakT = 3;
      g.next = g.wave + 1;
    }
  }
  return ev;
}

// a bolt from a Chitauri rifle, at where Thor is now
function fire(g, e, ev) {
  const from = { x: e.x + (e.kind === 'chariot' ? 0 : 0.3), y: e.kind === 'chariot' ? e.y : 1.4, z: e.z };
  const to = { x: g.thor.x, y: 1.3, z: 0 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const l = Math.hypot(dx, dy, dz);
  g.bolts.push({ ...from, vx: (dx / l) * LAWN.boltSpeed, vy: (dy / l) * LAWN.boltSpeed, vz: (dz / l) * LAWN.boltSpeed, t: 0, from: e.id });
  ev.push({ type: 'fire', id: e.id, ...from });
}
