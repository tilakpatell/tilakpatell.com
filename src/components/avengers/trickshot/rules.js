// Trick Shot: the rules, apart from the drawing, so they can be tested.
//
// Clint's range in the woods. Draw (hold), aim, loose: the arrow flies with
// gravity, the speed the draw gave it, and the wind. Hold a full draw too long
// and the bow starts to shake. Boards score by ring, more the farther they
// are; movers slide and swing, clay pigeons arc across, little drones dodge.
// Three hits in a row earn a trick arrow: explosive (everything near the hit),
// EMP (stops everything moving for a few seconds) or split (three at once).
// A half draw (the lob) holds the string partway, for arcing over a wall.
// Three rounds against the clock (the quiver holds more than the quickest hand
// can loose in one).
//
// Metres: x right, y up, z towards you; you stand at the origin, EYE up.

import { rng } from '../hq/rng';

export const EYE = 1.62;
export const BOW = {
  drawTime: 0.65, // seconds to full draw
  minSpeed: 16,
  maxSpeed: 68, // m/s at full draw
  lobSpeed: 28, // a half draw, held there: for arcing one over a wall
  weak: 0.22, // less draw than this and the arrow just falls off the string
  shakeAfter: 2.4, // seconds at full draw before the aim shakes
  gravity: 9.81,
};
const TRICKS = ['explosive', 'emp', 'split'];
// across the three rounds, for Clint's half of the Soul Stone: a fair archer (the
// tests' at noise 0.0125) scores 518 to 704 over seeds 1 to 40 (median 616) and
// passes 625 on 16 of them, so about one try in two or three
export const STONE_SCORE = 625;

// ring colours from the outside in, two rings each: white, black, blue, red, gold
export const RINGS = ['#f2efe6', '#f2efe6', '#24272b', '#24272b', '#2f6fd0', '#2f6fd0', '#d03a2c', '#d03a2c', '#f2c12e', '#f2c12e'];

// The quiver holds more than the quickest hand looses in a round (the tests'
// archer looses at most 40 in 45 s over 40 seeds at noise 0 to 0.03), so a
// round lasts its clock.
const QUIVER = 44;

// The rounds: targets, clays, drones, wind, time and arrows.
export const ROUNDS = [
  {
    title: 'Warm-up',
    time: 45,
    arrows: QUIVER,
    wind: [0, 0.5],
    targets: [
      { kind: 'board', x: -4, z: -18, r: 0.4 },
      { kind: 'board', x: 3, z: -30, r: 0.5 },
      { kind: 'board', x: -1, z: -45, r: 0.61 },
    ],
    clays: 0,
    drones: 0,
  },
  {
    title: 'Movers',
    time: 50,
    arrows: QUIVER,
    wind: [0.6, 1.2],
    targets: [
      { kind: 'mover', x: -7, z: -26, r: 0.45, to: 7, speed: 3.2 },
      { kind: 'swing', x: 6, z: -36, r: 0.5, len: 2.6, amp: 0.55 },
      { kind: 'board', x: -8, z: -52, r: 0.61 },
    ],
    clays: 5,
    drones: 0,
  },
  {
    title: 'Trick shots',
    time: 55,
    arrows: QUIVER,
    wind: [1, 1.6],
    targets: [
      { kind: 'board', x: 0, z: -40, r: 0.5, behind: { x0: -3, x1: 3, h: 2.6, z: -32 } },
      { kind: 'mover', x: 8, z: -48, r: 0.5, to: -8, speed: 4.2 },
      { kind: 'board', x: 10, z: -60, r: 0.61 },
    ],
    clays: 6,
    drones: 3,
  },
];

export const ringScore = (dist, r) => {
  // 10 rings, each a tenth of the radius; the X is the inner half of the 10
  if (dist > r) return 0;
  const k = dist / r;
  return { score: Math.max(1, 10 - Math.floor(k * 10)), x: k < 0.05 };
};

// distance pays: a 15 m shot is worth its rings, a 60 m one twice that
const farMult = (z) => 1 + Math.max(0, -z - 15) / 45;

export function newRange({ seed = 1, round = 0 } = {}) {
  return { seed, rand: rng(seed), round, phase: 'ready', total: 0, roundScores: [], s: null, queue: [] };
}

// Start a round (and, from round 0, a whole new game).
export function startRound(g, round = g.round) {
  const R = ROUNDS[round];
  const r = g.rand;
  if (round === 0) {
    g.total = 0;
    g.roundScores = [];
  }
  g.round = round;
  g.phase = 'live';
  g.s = {
    t: 0,
    moveT: 0, // time for things that move; it stands still while an EMP holds
    time: R.time,
    arrows: R.arrows,
    wind: R.wind[0] + r() * (R.wind[1] - R.wind[0]),
    windDir: r() < 0.5 ? -1 : 1,
    score: 0,
    hits: 0,
    shots: 0,
    streak: 0,
    tricks: [],
    nocked: null, // a trick arrow on the string
    lob: false, // a half draw
    drawing: false,
    draw: 0,
    full: 0, // seconds at full draw
    flying: [],
    stuck: [],
    emp: 0,
    targets: R.targets.map((t, i) => ({ ...t, id: i, x0: t.x, y: t.y ?? 1.25, hits: 0, phase: r() * 6, wob: 0 })),
    clays: [],
    clayAt: R.clays ? 2 + r() * 2 : Infinity,
    claysLeft: R.clays,
    drones: Array.from({ length: R.drones }, (_, i) => ({ id: i, x: -10 + i * 10, y: 4 + r() * 3, z: -24 - r() * 18, hp: 1, phase: r() * 6, alive: true })),
    nextId: 1,
  };
  g.queue.push({ type: 'round', n: round + 1, title: R.title, wind: g.s.wind * g.s.windDir });
  return g.queue.splice(0);
}

// where a target is now
export function targetAt(t, s) {
  if (t.kind === 'mover') {
    const len = Math.abs(t.to - t.x0);
    const period = (2 * len) / t.speed;
    const time = s.moveT + t.phase;
    let k = ((time % period) + period) % period;
    k = k < period / 2 ? k / (period / 2) : 2 - k / (period / 2);
    return { x: t.x0 + (t.to - t.x0) * k, y: t.y, z: t.z, nx: 0 };
  }
  if (t.kind === 'swing') {
    const a = Math.sin((s.moveT + t.phase) * Math.sqrt(9.81 / t.len)) * t.amp;
    return { x: t.x0 + Math.sin(a) * t.len, y: t.y + 2.6 - Math.cos(a) * t.len, z: t.z, swing: a };
  }
  return { x: t.x0, y: t.y, z: t.z };
}

// Hold to draw; release to loose. Aim is a unit direction from the eye.
export function draw(g, on) {
  const s = g.s;
  if (!s || g.phase !== 'live') return;
  if (on && !s.drawing && s.arrows > 0) {
    s.drawing = true;
    s.draw = 0;
    s.full = 0;
    g.queue.push({ type: 'draw' });
  } else if (!on && s.drawing) {
    s.drawing = false;
    loose(g);
  }
}

// Switch between a full draw and the half draw that lobs.
export function toggleLob(g) {
  const s = g.s;
  if (!s) return;
  s.lob = !s.lob;
  if (s.drawing) s.draw = Math.min(s.draw, drawCap(s));
  g.queue.push({ type: 'lob', on: s.lob });
}

// how far the string comes back
export const drawCap = (s) => (s.lob ? drawFor(BOW.lobSpeed) : 1);

// Ease the string back down without loosing (the arrow stays nocked).
export function letDown(g) {
  const s = g.s;
  if (!s || !s.drawing) return;
  s.drawing = false;
  s.draw = 0;
  s.full = 0;
  g.queue.push({ type: 'letDown' });
}

// Put the next trick arrow on the string (or take it off again).
export function nockTrick(g) {
  const s = g.s;
  if (!s || !s.tricks.length) return null;
  if (s.nocked) {
    s.tricks.push(s.nocked);
    s.nocked = null;
  } else s.nocked = s.tricks.shift();
  g.queue.push({ type: 'nock', trick: s.nocked });
  return s.nocked;
}

// the aim's shake after holding a full draw too long
export const shakeOf = (s) => Math.max(0, s.full - BOW.shakeAfter) * 0.004;

function loose(g) {
  const s = g.s;
  if (s.arrows <= 0) return;
  const aim = s.aim ?? { x: 0, y: 0, z: -1 };
  if (s.draw < BOW.weak) {
    // not drawn enough: it falls at your feet (and isn't spent)
    g.queue.push({ type: 'dud' });
    return;
  }
  s.arrows--;
  s.shots++;
  const speed = speedFor(s.draw);
  const shake = shakeOf(s);
  const ax = aim.x + Math.sin(s.t * 23) * shake;
  const ay = aim.y + Math.cos(s.t * 19) * shake;
  const l = Math.hypot(ax, ay, aim.z);
  const dirs = s.nocked === 'split' ? [-0.022, 0, 0.022] : [0];
  for (const off of dirs) {
    const dx = ax / l + off;
    s.flying.push({ id: s.nextId++, x: 0.05, y: EYE - 0.05, z: -0.4, vx: dx * speed, vy: (ay / l) * speed, vz: (aim.z / l) * speed, trick: s.nocked === 'split' ? null : s.nocked, t: 0 });
  }
  g.queue.push({ type: 'loose', speed, trick: s.nocked, draw: s.draw });
  s.nocked = null;
  s.draw = 0;
  s.full = 0;
}

const dirOf = (a) => {
  const l = Math.hypot(a.vx, a.vy, a.vz) || 1;
  return [a.vx / l, a.vy / l, a.vz / l];
};

function launchClay(s, r) {
  const side = r() < 0.5 ? -1 : 1;
  s.clays.push({ id: s.nextId++, x: side * 16, y: 0.8, z: -20 - r() * 18, vx: -side * (9 + r() * 4), vy: 9 + r() * 3, vz: 2 * (r() - 0.5), alive: true });
  s.claysLeft--;
}

// Points for a hit, with the streak that earns trick arrows.
function award(g, base, kind, at, ev) {
  const s = g.s;
  const pts = Math.round(base);
  s.score += pts;
  s.hits++;
  s.streak++;
  ev.push({ type: 'hit', kind, score: pts, ...at, streak: s.streak });
  if (s.streak % 3 === 0) {
    const trick = TRICKS[(s.streak / 3 - 1) % TRICKS.length];
    s.tricks.push(trick);
    ev.push({ type: 'trick', trick });
  }
}

// the explosive arrow's blast: everything within reach of the hit
function blast(g, x, y, z, ev) {
  const s = g.s;
  ev.push({ type: 'blast', x, y, z });
  for (const t of s.targets) {
    const p = targetAt(t, s);
    if (Math.hypot(p.x - x, p.y - y, p.z - z) < 3) award(g, 5 * farMult(p.z), t.kind, p, ev);
  }
  for (const c of s.clays) if (c.alive && Math.hypot(c.x - x, c.y - y, c.z - z) < 3.5) {
    c.alive = false;
    award(g, 15 * farMult(c.z), 'clay', c, ev);
  }
  for (const d of s.drones) if (d.alive && Math.hypot(d.x - x, d.y - y, d.z - z) < 3.5) {
    d.alive = false;
    award(g, 25, 'drone', d, ev);
  }
}

export function stepRange(g, dt) {
  const ev = g.queue.splice(0);
  const s = g.s;
  if (g.phase !== 'live') return ev;
  s.t += dt;
  s.time = Math.max(0, s.time - dt);
  if (s.drawing) {
    const cap = drawCap(s);
    s.draw = Math.min(cap, s.draw + dt / BOW.drawTime);
    if (s.draw >= cap) s.full += dt;
  }
  if (s.emp > 0) {
    s.emp -= dt;
    if (s.emp <= 0) ev.push({ type: 'empEnd' });
  }
  const frozen = s.emp > 0;
  if (!frozen) s.moveT += dt;
  // clays and drones
  if (!frozen) {
    if (s.claysLeft > 0 && s.t >= s.clayAt) {
      launchClay(s, g.rand);
      s.clayAt = s.t + 3.2 + g.rand() * 2.4;
      ev.push({ type: 'clay' });
    }
    for (const c of s.clays) {
      if (!c.alive) continue;
      c.vy -= 9.81 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < 0) c.alive = false;
    }
    for (const d of s.drones) {
      if (!d.alive) continue;
      d.phase += dt;
      d.x = Math.sin(d.phase * 0.7 + d.id) * 9;
      d.y = 4 + Math.sin(d.phase * 1.3) * 1.5;
    }
  }
  // arrows in flight
  const wind = s.wind * s.windDir;
  for (const a of s.flying) {
    const sub = 4;
    for (let k = 0; k < sub && !a.done; k++) {
      const h = dt / sub;
      const px = a.x;
      const py = a.y;
      const pz = a.z;
      a.vy -= BOW.gravity * h;
      a.vx += wind * h;
      a.x += a.vx * h;
      a.y += a.vy * h;
      a.z += a.vz * h;
      a.t += h;
      // boards: where the arrow crosses each one's plane
      for (const t of s.targets) {
        const p = targetAt(t, s);
        if ((pz - p.z) * (a.z - p.z) > 0) continue;
        const f = (p.z - pz) / (a.z - pz || 1e-9);
        const hx = px + (a.x - px) * f;
        const hy = py + (a.y - py) * f;
        // the hay wall in front of a board
        const d = Math.hypot(hx - p.x, hy - p.y);
        const ring = ringScore(d, t.r);
        if (ring) {
          a.done = true;
          t.hits++;
          t.wob = 1;
          const base = ring.score * farMult(p.z) * (t.kind === 'board' ? 1 : 1.5) + (ring.x ? 2 : 0);
          s.stuck.push({ target: t.id, dx: hx - p.x, dy: hy - p.y, trick: a.trick, dir: dirOf(a) });
          ev.push({ type: 'ring', ring: ring.score, x: ring.x, target: t.id });
          award(g, base, t.kind, { x: hx, y: hy, z: p.z }, ev);
          if (a.trick === 'explosive') blast(g, hx, hy, p.z, ev);
          if (a.trick === 'emp') {
            s.emp = 4;
            ev.push({ type: 'emp', x: hx, y: hy, z: p.z });
          }
          break;
        }
      }
      if (a.done) break;
      // hay walls
      for (const t of s.targets) {
        const w = t.behind;
        if (!w || (pz - w.z) * (a.z - w.z) > 0) continue;
        const f = (w.z - pz) / (a.z - pz || 1e-9);
        const hx = px + (a.x - px) * f;
        const hy = py + (a.y - py) * f;
        if (hx > w.x0 && hx < w.x1 && hy < w.h) {
          a.done = true;
          s.streak = 0;
          ev.push({ type: 'wall', x: hx, y: hy, z: w.z, dir: dirOf(a) });
          if (a.trick === 'explosive') blast(g, hx, hy, w.z, ev);
          break;
        }
      }
      if (a.done) break;
      // clays and drones: close passes count
      for (const c of s.clays) {
        if (!c.alive) continue;
        if (Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z) < 0.6) {
          c.alive = false;
          a.done = true;
          award(g, 15 * farMult(c.z), 'clay', c, ev);
          if (a.trick === 'explosive') blast(g, c.x, c.y, c.z, ev);
          break;
        }
      }
      for (const dn of s.drones) {
        if (!dn.alive || a.done) continue;
        if (Math.hypot(dn.x - a.x, dn.y - a.y, dn.z - a.z) < 0.6) {
          dn.alive = false;
          a.done = true;
          award(g, 25, 'drone', dn, ev);
          if (a.trick === 'explosive') blast(g, dn.x, dn.y, dn.z, ev);
          break;
        }
      }
      if (a.done) break;
      if (a.y <= 0 || a.z < -120 || Math.abs(a.x) > 80) {
        a.done = true;
        s.streak = 0;
        ev.push({ type: 'miss', x: a.x, y: Math.max(0, a.y), z: a.z, ground: a.y <= 0, dir: dirOf(a) });
        if (a.trick === 'explosive' && a.y <= 0) blast(g, a.x, 0, a.z, ev);
      }
    }
  }
  s.flying = s.flying.filter((a) => !a.done);
  for (const t of s.targets) t.wob = Math.max(0, t.wob - dt * 2);

  // the round's end: out of time, or out of arrows with none in the air
  if ((s.time <= 0 || (s.arrows <= 0 && !s.drawing && !s.flying.length)) && !s.flying.length) {
    g.phase = 'roundEnd';
    s.drawing = false;
    g.roundScores[g.round] = s.score;
    g.total = g.roundScores.reduce((a, b) => a + (b || 0), 0);
    const last = g.round === ROUNDS.length - 1;
    ev.push({ type: 'roundEnd', n: g.round + 1, score: s.score, total: g.total, last, stone: last && g.total >= STONE_SCORE });
    if (last) g.phase = 'done';
  }
  return ev;
}

// Where an arrow loosed along `aim` at `speed` crosses the plane at depth z
// (nothing in the way), for the bow sight's pins.
export function pathAt(aim, speed, z, wind = 0) {
  const l = Math.hypot(aim.x, aim.y, aim.z) || 1;
  const vz = (aim.z / l) * speed;
  if (vz >= -1e-6) return null;
  const t = (z + 0.4) / vz;
  if (t <= 0) return null;
  return { x: 0.05 + (aim.x / l) * speed * t + 0.5 * wind * t * t, y: EYE - 0.05 + (aim.y / l) * speed * t - 0.5 * BOW.gravity * t * t, z, t };
}

// How far to draw for an arrow of a given speed.
export const drawFor = (speed) => Math.min(1, Math.max(BOW.weak, ((speed - BOW.minSpeed) / (BOW.maxSpeed - BOW.minSpeed)) ** (1 / 1.2)));
export const speedFor = (d) => BOW.minSpeed + (BOW.maxSpeed - BOW.minSpeed) * d ** 1.2;

// The aim (from the eye) that puts an arrow at full draw on a point, allowing
// for gravity and wind (and, given a velocity, for where it will be).
// `acc` is the target's own acceleration (a falling clay's gravity).
export function aimFor(p, { wind = 0, vel = null, acc = null, speed = BOW.maxSpeed } = {}) {
  let tx = p.x;
  let ty = p.y;
  let tz = p.z;
  let dir = { x: tx, y: ty - EYE, z: tz };
  for (let i = 0; i < 6; i++) {
    const l = Math.hypot(dir.x, dir.y, dir.z);
    const vz = (dir.z / l) * speed;
    const tf = (tz + 0.4) / vz; // flight time to the target's plane
    const drop = 0.5 * BOW.gravity * tf * tf;
    const drift = 0.5 * wind * tf * tf;
    if (vel) {
      tx = p.x + vel.x * tf + 0.5 * (acc?.x ?? 0) * tf * tf;
      ty = p.y + vel.y * tf + 0.5 * (acc?.y ?? 0) * tf * tf;
      tz = p.z + (vel.z ?? 0) * tf;
    }
    dir = { x: tx - 0.05 - drift, y: ty - (EYE - 0.05) + drop, z: tz + 0.4 };
  }
  const l = Math.hypot(dir.x, dir.y, dir.z);
  return { x: dir.x / l, y: dir.y / l, z: dir.z / l };
}
