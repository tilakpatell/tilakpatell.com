// Repulsor Range: the rules, apart from the drawing, so they can be tested.
//
// Iron Man hovers over the test field at the compound, between three lanes,
// and holds it against nine waves: Ultron's drones (they home in, then commit
// to your lane a second out), sentries (they hang back, glow, and fire a bolt
// at where you are), missiles (shoot them down), practice discs (points), and
// last, Ultron Prime, whose armour plates come off before its core will take
// a hit. Repulsors cost reactor energy; kills charge the unibeam.
//
// World units are metres: x across the field, y up, z towards you (enemies
// come from negative z). You are at z = 0, EYE metres up, in lane `lane`.

import { rng } from '../hq/rng';

export const EYE = 3.2;
export const LANES = [-3.5, 0, 3.5];

export const RANGE = {
  armor: 5,
  energy: 100,
  shotCost: 10,
  shotGap: 0.15,
  regen: 30,
  regenDelay: 0.35,
  assist: 0.35, // a little extra around every target
  r: { drone: 0.75, sentry: 0.6, head: 0.42, missile: 0.55, disc: 0.75 },
  hp: { drone: 1, sentry: 4, missile: 1, disc: 1 },
  charge: { drone: 12, sentry: 22, missile: 8, disc: 10, plate: 14 },
  points: { drone: 100, sentry: 250, missile: 75, disc: 150, plate: 300, prime: 2500 },
  ramHit: 1.7, // how near a drone or missile must pass to hit
  boltHit: 1.3,
  boltSpeed: 28,
  volleySpeed: 34,
  invuln: 0.8,
  comboWindow: 2.5,
  beam: { dur: 1.1, radius: 2.4, reach: 130, dps: 12 },
  breakTime: 2.6,
  laneRate: 16,
  commitAt: -14, // drones stop steering this far out
  far: -88,
};

// Each wave: [seconds in, kind, how many, seconds apart]
export const WAVES = [
  { title: 'Drones', spawns: [[0, 'drone', 3, 1.2], [5, 'drone', 3, 1], [10, 'drone', 4, 0.8]] },
  { title: 'Target practice', spawns: [[0, 'disc', 3, 0.6], [2, 'drone', 3, 1], [5, 'disc', 3, 0.5], [8, 'drone', 4, 0.8], [12, 'disc', 2, 0.4]] },
  { title: 'Sentry', spawns: [[0, 'sentry', 1, 0], [3, 'drone', 4, 1], [8, 'drone', 3, 0.8], [12, 'sentry', 1, 0]] },
  { title: 'Missiles', spawns: [[0, 'missile', 3, 1.2], [4, 'drone', 4, 0.8], [8, 'missile', 4, 0.9]] },
  { title: 'Crossfire', spawns: [[0, 'sentry', 2, 2], [2, 'drone', 5, 0.7], [7, 'missile', 3, 0.9], [11, 'disc', 3, 0.4]] },
  { title: 'Flanked', spawns: [[0, 'sentry', 3, 2], [4, 'drone', 6, 0.6], [10, 'missile', 3, 0.7]] },
  { title: 'Heavy', spawns: [[0, 'sentry', 3, 1.4], [3, 'missile', 4, 0.8], [7, 'drone', 6, 0.55], [14, 'sentry', 2, 1]] },
  { title: 'Swarm', spawns: [[0, 'drone', 8, 0.4], [4, 'drone', 7, 0.4], [7, 'missile', 4, 0.7], [10, 'drone', 6, 0.35]] },
  { title: 'Ultron Prime', spawns: [[0, 'prime', 1, 0]] },
];

const PRIME_PARTS = [
  { name: 'shoulderL', dx: 0.82, dy: 0.4, r: 0.66, hp: 7 },
  { name: 'shoulderR', dx: -0.82, dy: 0.4, r: 0.66, hp: 7 },
  { name: 'chestL', dx: 0.33, dy: 0.15, r: 0.5, hp: 7 },
  { name: 'chestR', dx: -0.33, dy: 0.15, r: 0.5, hp: 7 },
  { name: 'core', dx: 0, dy: 0.1, r: 0.6, hp: 26, core: true },
];
const PRIME_PATTERN = ['volley', 'summon', 'volley', 'missiles'];
const PRIME_Z = -30;
export const PRIME_SCALE = 3.2;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

// The direction from the eye to a point.
export const aimAt = (eye, p) => norm({ x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z });

export function newRange({ seed = 1 } = {}) {
  return {
    seed,
    rand: rng(seed),
    phase: 'ready',
    t: 0,
    wave: 0,
    waveT: 0,
    breakT: 0,
    spawns: [],
    lane: 1,
    x: LANES[1],
    armor: RANGE.armor,
    energy: RANGE.energy,
    charge: 0,
    beam: null,
    cooldown: 0,
    lastShot: -1,
    dryAt: -1,
    invuln: 0,
    combo: 0,
    lastKill: -10,
    score: 0,
    shots: 0,
    hits: 0,
    kills: 0,
    hand: 0,
    nextId: 1,
    enemies: [],
    bolts: [],
    queue: [],
    input: { firing: false, aim: { x: 0, y: 0, z: -1 } },
  };
}

function scheduleWave(s) {
  const w = WAVES[s.wave];
  s.waveT = 0;
  s.spawns = [];
  for (const [at, kind, n, gap] of w.spawns) for (let i = 0; i < n; i++) s.spawns.push({ at: at + i * gap, kind });
  s.spawns.sort((a, b) => a.at - b.at);
}

// Start (or start again): the first wave, everything else fresh.
export function startRange(s) {
  const fresh = newRange({ seed: s.seed });
  Object.assign(s, fresh, { input: s.input });
  s.phase = 'wave';
  scheduleWave(s);
  return [{ type: 'wave', n: 1, title: WAVES[0].title }];
}

// Move one lane left (-1) or right (+1).
export function strafe(s, dir) {
  if (s.phase !== 'wave' && s.phase !== 'break') return false;
  const next = clamp(s.lane + dir, 0, LANES.length - 1);
  if (next === s.lane) return false;
  s.lane = next;
  s.queue.push({ type: 'strafe', lane: next });
  return true;
}

// The unibeam, once the reactor has charged it.
export function unibeam(s) {
  if (s.phase !== 'wave' || s.beam || s.charge < 100) return false;
  s.charge = 0;
  s.beam = { t: 0 };
  s.queue.push({ type: 'unibeam' });
  return true;
}

function spawn(s, kind, ev) {
  const r = s.rand;
  const id = s.nextId++;
  const speedUp = 1 + s.wave * 0.06;
  let e;
  if (kind === 'drone') {
    const x = (r() * 2 - 1) * 14;
    e = { id, kind, x, y: 4 + r() * 5, z: RANGE.far + r() * 10, vx: 0, vy: 0, vz: (12 + r() * 3) * speedUp, hp: RANGE.hp.drone, r: RANGE.r.drone, t: 0, seed: r() * 10 };
  } else if (kind === 'sentry') {
    const side = r() < 0.5 ? -1 : 1;
    e = { id, kind, x: side * (6 + r() * 8), y: 6, z: RANGE.far, vx: 0, vy: 0, vz: 0, hp: RANGE.hp.sentry, r: RANGE.r.sentry, t: 0, seed: r() * 10, hold: -26 - r() * 12, cx: side * (2 + r() * 6), cool: 2 + r() * 1.5, charging: 0 };
  } else if (kind === 'missile') {
    const side = r() < 0.5 ? -1 : 1;
    const p = { x: side * (8 + r() * 8), y: 9 + r() * 3, z: RANGE.far + 2 };
    const d = aimAt(p, { x: s.x, y: EYE, z: 0 });
    const sp = 25 * speedUp;
    e = { id, kind, ...p, vx: d.x * sp, vy: d.y * sp, vz: d.z * sp, speed: sp, hp: RANGE.hp.missile, r: RANGE.r.missile, t: 0, seed: 0 };
  } else if (kind === 'disc') {
    const side = r() < 0.5 ? -1 : 1;
    e = { id, kind, x: side * 20, y: 1, z: -28 - r() * 16, vx: -side * (10 + r() * 3), vy: 7.5 + r() * 1.8, vz: 0, hp: RANGE.hp.disc, r: RANGE.r.disc, t: 0, seed: r() * 10 };
  } else if (kind === 'prime') {
    e = { id, kind, x: 0, y: 7.5, z: -110, vx: 0, vy: 0, vz: 0, hp: 1, r: 1.6, t: 0, seed: 0, arrived: false, attack: 4, step: 0, volley: null, parts: PRIME_PARTS.map((p) => ({ ...p })) };
  }
  s.enemies.push(e);
  ev.push({ type: 'spawn', kind, id });
  return e;
}

function hurt(s, by, ev) {
  if (s.invuln > 0 || s.phase !== 'wave') return;
  s.armor -= 1;
  s.invuln = RANGE.invuln;
  s.combo = 0;
  ev.push({ type: 'damage', armor: s.armor, by });
  if (s.armor <= 0) {
    s.phase = 'lost';
    s.input.firing = false;
    ev.push({ type: 'lost', score: s.score, wave: s.wave + 1 });
  }
}

function award(s, kind, base, at, ev) {
  s.combo = s.t - s.lastKill <= RANGE.comboWindow ? s.combo + 1 : 1;
  s.lastKill = s.t;
  const mult = 1 + 0.5 * Math.min(6, s.combo - 1);
  const pts = Math.round(base * mult);
  s.score += pts;
  s.kills++;
  ev.push({ type: 'kill', kind, x: at.x, y: at.y, z: at.z, score: pts, combo: s.combo });
}

function kill(s, e, ev) {
  e.hp = 0;
  e.dead = true;
  // the unibeam's own kills don't charge it again
  if (!s.beam) s.charge = Math.min(100, s.charge + (RANGE.charge[e.kind] ?? 0));
  award(s, e.kind, RANGE.points[e.kind], e, ev);
}

const primeArmed = (e) => e.parts.some((p) => !p.core && p.hp > 0);

// Damage one part of Ultron Prime.
function hitPrime(s, e, part, dmg, ev) {
  if (part.core && primeArmed(e)) {
    ev.push({ type: 'deflect', id: e.id, x: e.x + part.dx, y: e.y + part.dy, z: e.z });
    return;
  }
  part.hp -= dmg;
  ev.push({ type: 'hit', id: e.id, kind: 'prime', part: part.name, x: e.x + part.dx, y: e.y + part.dy, z: e.z });
  if (part.hp > 0) return;
  if (!part.core) {
    if (!s.beam) s.charge = Math.min(100, s.charge + RANGE.charge.plate);
    award(s, 'plate', RANGE.points.plate, { x: e.x + part.dx, y: e.y + part.dy, z: e.z }, ev);
    ev.push({ type: 'plate', id: e.id, part: part.name, left: e.parts.filter((p) => !p.core && p.hp > 0).length });
    if (!primeArmed(e)) ev.push({ type: 'exposed', id: e.id });
  } else {
    e.dead = true;
    award(s, 'prime', RANGE.points.prime, e, ev);
  }
}

// The spheres you can hit on an enemy: [x, y, z, r, part, crit]
function spheres(e) {
  if (e.kind === 'sentry') return [[e.x, e.y + 0.42, e.z, RANGE.r.head, null, true], [e.x, e.y - 0.1, e.z, e.r, null, false], [e.x, e.y - 0.75, e.z, e.r * 0.8, null, false]];
  // on its way in, Prime can't be hit: shots fly past it to whatever is behind,
  // and the crosshair (RepulsorRange.jsx, which reads rayHit) doesn't light
  if (e.kind === 'prime') return e.arrived ? e.parts.filter((p) => p.hp > 0).map((p) => [e.x + p.dx, e.y + p.dy, e.z, p.r, p, false]) : [];
  return [[e.x, e.y, e.z, e.r, null, false]];
}

// What a ray from the eye hits first: { e, part, crit, t } or null.
export function rayHit(s, dir) {
  const o = { x: s.x, y: EYE, z: 0 };
  let best = null;
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.dead) continue;
    for (const [x, y, z, r, part, crit] of spheres(e)) {
      const cx = x - o.x;
      const cy = y - o.y;
      const cz = z - o.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0) continue;
      const d2 = cx * cx + cy * cy + cz * cz - t * t;
      const rr = r + RANGE.assist;
      if (d2 < rr * rr && (!best || t < best.t)) best = { e, part, crit, t };
    }
  }
  return best;
}

function fire(s, ev) {
  if (s.energy < RANGE.shotCost) {
    if (s.t - s.dryAt > 0.4) {
      s.dryAt = s.t;
      ev.push({ type: 'dry' });
    }
    return;
  }
  s.energy -= RANGE.shotCost;
  s.cooldown = RANGE.shotGap;
  s.lastShot = s.t;
  s.shots++;
  s.hand ^= 1;
  const dir = norm(s.input.aim);
  const hit = rayHit(s, dir);
  const reach = hit ? hit.t : 90;
  const at = { x: s.x + dir.x * reach, y: EYE + dir.y * reach, z: dir.z * reach };
  ev.push({ type: 'shot', hand: s.hand, hit: !!hit, ...at });
  if (!hit) return;
  s.hits++;
  const { e, part, crit } = hit;
  if (e.kind === 'prime') hitPrime(s, e, part, 1, ev);
  else {
    e.hp -= crit ? 2 : 1;
    ev.push({ type: 'hit', id: e.id, kind: e.kind, crit, ...at });
    if (e.hp <= 0) kill(s, e, ev);
  }
}

function beamStep(s, dt, ev) {
  const b = s.beam;
  b.t += dt;
  const dir = norm(s.input.aim);
  const o = { x: s.x, y: EYE, z: 0 };
  const inBeam = (x, y, z, r) => {
    const cx = x - o.x;
    const cy = y - o.y;
    const cz = z - o.z;
    const t = cx * dir.x + cy * dir.y + cz * dir.z;
    if (t < 0 || t > RANGE.beam.reach) return false;
    const rr = RANGE.beam.radius + r;
    return cx * cx + cy * cy + cz * cz - t * t < rr * rr;
  };
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (e.kind === 'prime') {
      if (e.arrived) for (const p of e.parts) if (p.hp > 0 && inBeam(e.x + p.dx, e.y + p.dy, e.z, p.r)) hitPrime(s, e, p, RANGE.beam.dps * dt, ev);
    } else if (inBeam(e.x, e.y, e.z, e.r)) kill(s, e, ev);
  }
  s.bolts = s.bolts.filter((q) => !inBeam(q.x, q.y, q.z, 0.3));
  if (b.t >= RANGE.beam.dur) {
    s.beam = null;
    ev.push({ type: 'beamEnd' });
  }
}

function boltAt(s, from, to, speed) {
  const d = aimAt(from, to);
  s.bolts.push({ x: from.x, y: from.y, z: from.z, vx: d.x * speed, vy: d.y * speed, vz: d.z * speed });
}

function updateEnemy(s, e, dt, ev) {
  e.t += dt;
  if (e.kind === 'drone') {
    if (!e.committed && e.z > RANGE.commitAt) {
      e.committed = true;
      ev.push({ type: 'commit', id: e.id });
    }
    if (!e.committed && !e.hold) {
      const target = s.x + Math.sin(e.t * 2.1 + e.seed) * 2.4;
      e.x += (target - e.x) * Math.min(1, dt * 0.9);
      e.y += (EYE + Math.sin(e.t * 1.7 + e.seed) * 0.7 - e.y) * Math.min(1, dt * 1.1);
    }
    if (!e.hold) e.z += e.vz * dt;
    if (e.z > -0.8) {
      if (Math.abs(e.x - s.x) < RANGE.ramHit && Math.abs(e.y - EYE) < 1.8) hurt(s, 'drone', ev);
      e.gone = true;
    }
  } else if (e.kind === 'missile') {
    if (e.z < -15) {
      // steer gently at you until it's close
      const d = aimAt(e, { x: s.x, y: EYE, z: 0 });
      const k = Math.min(1, dt * 0.55);
      const v = norm({ x: e.vx / e.speed + (d.x - e.vx / e.speed) * k, y: e.vy / e.speed + (d.y - e.vy / e.speed) * k, z: e.vz / e.speed + (d.z - e.vz / e.speed) * k });
      e.vx = v.x * e.speed;
      e.vy = v.y * e.speed;
      e.vz = v.z * e.speed;
    }
    e.x += e.vx * dt;
    e.y = Math.max(0.6, e.y + e.vy * dt);
    e.z += e.vz * dt;
    if (e.z > -0.6) {
      if (Math.abs(e.x - s.x) < RANGE.ramHit && Math.abs(e.y - EYE) < 2) hurt(s, 'missile', ev);
      e.gone = true;
    }
  } else if (e.kind === 'disc') {
    e.vy -= 9.8 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.y < 0 || Math.abs(e.x) > 24) e.gone = true;
  } else if (e.kind === 'sentry') {
    if (e.z < e.hold) {
      e.z = Math.min(e.hold, e.z + 11 * dt);
      e.x += (e.cx - e.x) * Math.min(1, dt * 0.6);
    } else {
      e.x = e.cx + Math.sin(e.t * 0.45 + e.seed) * 5;
      e.y = 6 + Math.sin(e.t * 0.9 + e.seed) * 0.6;
      if (e.charging > 0) {
        e.charging -= dt;
        if (e.charging <= 0) {
          boltAt(s, { x: e.x + 0.45, y: e.y + 0.2, z: e.z + 0.6 }, { x: s.x, y: EYE, z: 0 }, RANGE.boltSpeed);
          ev.push({ type: 'bolt', id: e.id, x: e.x, y: e.y, z: e.z });
          e.cool = (2.4 + s.rand() * 1.2) / (1 + s.wave * 0.04);
        }
      } else {
        e.cool -= dt;
        if (e.cool <= 0) {
          e.charging = 0.9;
          ev.push({ type: 'charge', id: e.id, x: e.x, y: e.y, z: e.z });
        }
      }
    }
  } else if (e.kind === 'prime') {
    if (!e.arrived) {
      e.z = Math.min(PRIME_Z, e.z + 9 * dt);
      if (e.z >= PRIME_Z) {
        e.arrived = true;
        e.t = 0;
        ev.push({ type: 'boss', id: e.id });
      }
      return;
    }
    e.x = Math.sin(e.t * 0.35) * 6;
    e.y = 7.5 + Math.sin(e.t * 0.8) * 0.6;
    if (e.volley) {
      e.volley.t -= dt;
      if (e.volley.t <= 0) {
        for (const i of e.volley.lanes) boltAt(s, { x: e.x, y: e.y + 0.5, z: e.z + 1 }, { x: LANES[i], y: EYE, z: 0 }, RANGE.volleySpeed);
        ev.push({ type: 'bolt', id: e.id, x: e.x, y: e.y, z: e.z, volley: true });
        e.volley = null;
      }
      return;
    }
    e.attack -= dt;
    if (e.attack > 0) return;
    const kind = PRIME_PATTERN[e.step++ % PRIME_PATTERN.length];
    e.attack = primeArmed(e) ? 2.8 : 2.1;
    if (kind === 'volley') {
      const safe = Math.floor(s.rand() * 3);
      e.volley = { t: 1.25, lanes: [0, 1, 2].filter((i) => i !== safe) };
      ev.push({ type: 'volley', id: e.id, lanes: e.volley.lanes });
    } else if (kind === 'summon') {
      for (let i = 0; i < 4; i++) {
        const d = spawn(s, 'drone', ev);
        d.x = e.x + (i - 1.5) * 2.6;
        d.y = e.y;
        d.z = e.z + 1;
      }
      ev.push({ type: 'summon', id: e.id });
    } else {
      for (let i = 0; i < 2; i++) {
        const m = spawn(s, 'missile', ev);
        m.x = e.x + (i ? 2 : -2);
        m.y = e.y + 1;
        m.z = e.z;
      }
    }
  }
}

export function stepRange(s, dt) {
  const ev = s.queue.splice(0);
  if (s.phase !== 'wave' && s.phase !== 'break') return ev;
  s.t += dt;
  s.invuln = Math.max(0, s.invuln - dt);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.x += (LANES[s.lane] - s.x) * Math.min(1, dt * RANGE.laneRate);

  // energy: back up after a pause in firing, fast between waves
  if (s.t - s.lastShot > RANGE.regenDelay) s.energy = Math.min(RANGE.energy, s.energy + RANGE.regen * (s.phase === 'break' ? 3 : 1) * dt);

  if (s.phase === 'break') {
    s.breakT -= dt;
    if (s.breakT <= 0) {
      s.wave++;
      s.phase = 'wave';
      scheduleWave(s);
      ev.push({ type: 'wave', n: s.wave + 1, title: WAVES[s.wave].title });
    }
    return ev;
  }

  s.waveT += dt;
  while (s.spawns.length && s.spawns[0].at <= s.waveT) spawn(s, s.spawns.shift().kind, ev);

  if (s.input.firing && s.cooldown <= 0 && !s.beam) fire(s, ev);
  if (s.beam) beamStep(s, dt, ev);

  for (const e of s.enemies) if (!e.dead) updateEnemy(s, e, dt, ev);
  s.enemies = s.enemies.filter((e) => !e.dead && !e.gone);

  for (const b of s.bolts) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z >= 0) {
      b.gone = true;
      if (Math.abs(b.x - s.x) < RANGE.boltHit && Math.abs(b.y - EYE) < 2) hurt(s, 'bolt', ev);
    }
  }
  s.bolts = s.bolts.filter((b) => !b.gone);
  if (s.phase === 'lost') return ev;

  if (!s.spawns.length && !s.enemies.length && !s.bolts.length && !s.beam) {
    ev.push({ type: 'clear', n: s.wave + 1 });
    if (s.wave === WAVES.length - 1) {
      const accuracy = s.shots ? s.hits / s.shots : 0;
      const bonus = s.armor * 500 + Math.round(accuracy * 2000);
      s.score += bonus;
      s.phase = 'won';
      s.input.firing = false;
      ev.push({ type: 'won', score: s.score, bonus, accuracy, armor: s.armor });
    } else {
      s.phase = 'break';
      s.breakT = RANGE.breakTime;
    }
  }
  return ev;
}
