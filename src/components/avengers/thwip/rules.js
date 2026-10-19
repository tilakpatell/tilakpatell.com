// Thwip!: the rules, with no drawing in them (scene.js draws them; the
// tests play them). Peter is late again: school is two kilometres down the
// avenue, and the quickest way there is between the buildings. Hold to shoot
// a web at the wall ahead and swing on it; let go to fly. Let go on the
// upswing, past the web's anchor, for a perfect release: faster, and a flip.
// The cross streets have nothing to swing from, so carry your speed over
// them. Peter's backpacks are webbed up along the way (he keeps losing them).
// Touch the street and the traffic gets a word in: three times and that's
// the day. Steer across the avenue; reel the web in to climb. The bell at
// BELL seconds ends the run: late for school.
//
// The avenue runs along -z from z = 0; x is across it (the walls at
// ±WALL), y up. A web is a rope, not a spring: it only ever pulls. It's
// drawn to the wall, but he swings about a point a few metres in from it
// (`pivot`), as Spider-Man does in every game: anchored at the wall itself, a
// swing would carry him into it.
// Everything is plain numbers, stepped at a fixed rate.

export const AVENUE = {
  wall: 13, // the building faces, either side of the middle
  pivot: 3, // how far from the middle a swing turns about
  road: 8.5, // the kerbs
  block: 80, // a block and its cross street
  cross: 18, // the cross street's width
  length: 2100, // the course, to the school
};
export const SCHOOL = 2000; // metres to the school
export const BELL = 100; // seconds until the bell
export const RUN = {
  gravity: 21,
  maxSpeed: 58,
  ceiling: 125,
  hearts: 3,
  reach: 46, // the furthest a web can catch
  reel: 9, // how fast a held web reels in (m/s), with the reel held
  perfect: { from: 0.2, to: 0.9 }, // the release window: the web's angle past the vertical, forward (radians)
  boost: 1.12, // a perfect release's kick
  pump: 9, // a swing's own push along its arc (m/s², forward): Spider-Man swings, he doesn't just hang
  centre: 1.6, // how hard the swing keeps him toward the middle of the avenue
  clear: 4, // the lowest a swing goes, over the street
  takeUp: 22, // how fast a web takes up its slack to keep there (m/s)
  grace: 1.2, // seconds safe after the street
};
export const PACK = { r: 2.6, every: 70, points: 150 };

// a seeded random number in [0, 1)
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The buildings along both sides: { side, z0, z1, h, kind, tone } with z0 > z1
// (the avenue runs toward -z). Each block is cut into buildings of 14 to 34
// metres; Queens is low at the start, and it rises toward Midtown.
export function buildAvenue(seed = 12) {
  const r = rng(seed);
  const out = [];
  for (const side of [-1, 1]) {
    for (let b = 0; b * AVENUE.block < AVENUE.length; b++) {
      const start = -b * AVENUE.block - (b === 0 ? 0 : AVENUE.cross / 2);
      const end = -(b + 1) * AVENUE.block + AVENUE.cross / 2;
      let z = start;
      while (z - 10 > end) {
        const len = Math.min(z - end, 14 + r() * 20);
        const along = (b * AVENUE.block) / AVENUE.length;
        const h = Math.round(22 + along * 40 + r() * (30 + along * 50));
        out.push({ side, z0: z, z1: z - len, h, kind: h > 70 ? (r() < 0.7 ? 0 : 1) : r() < 0.55 ? 2 : 1, tone: r() });
        z -= len;
      }
    }
  }
  return out;
}

// The building on a side at a point along the avenue, or null (a cross street).
export function buildingAt(avenue, side, z) {
  for (const b of avenue) if (b.side === side && z <= b.z0 && z >= b.z1) return b;
  return null;
}

// Peter's backpacks: one every so often, somewhere he can reach mid-swing.
function buildPacks(seed = 5) {
  const r = rng(seed);
  const out = [];
  for (let d = 110; d < SCHOOL - 40; d += PACK.every * (0.8 + r() * 0.5)) out.push({ id: out.length, p: [(r() - 0.5) * 12, 9 + r() * 16, -d], got: false });
  return out;
}

// The traffic: lanes in both directions, the cars in each spaced out.
function buildCars(seed = 3) {
  const r = rng(seed);
  const out = [];
  const lanes = [-6.2, -2.2, 2.2, 6.2];
  lanes.forEach((x, lane) => {
    for (let z = -20 - r() * 30; z > -AVENUE.length; z -= 26 + r() * 40) out.push({ id: out.length, x, z, lane, v: x < 0 ? -9 - r() * 4 : 8 + r() * 4, kind: Math.floor(r() * 4) });
  });
  return out;
}

const AVE = buildAvenue();

export function newRun({ seed = 1 } = {}) {
  return {
    seed,
    phase: 'ready', // ready | run | won | lost
    t: 0,
    p: [0, 22, 0],
    v: [0, 0, -22],
    mode: 'air', // air | swing | street
    web: null, // { a: anchor [x, y, z], len, side }
    hold: false,
    reel: false,
    side: 1, // the side the next web goes to
    steer: 0, // across the avenue: -1 (left) to 1 (right)
    hearts: RUN.hearts,
    grace: 0,
    streetT: 0,
    score: 0,
    perfects: 0,
    combo: 0,
    swings: 0,
    flip: 0, // a perfect release's flip, 1 → 0
    best: 0,
    packs: buildPacks(seed + 4),
    cars: buildCars(seed + 2),
    avenue: AVE,
    got: 0,
  };
}

export function startRun(g) {
  Object.assign(g, newRun({ seed: g.seed }), { phase: 'run' });
  return [{ type: 'start' }];
}

export const distance = (g) => -g.p[2];

// ── input ──
export const press = (g) => (g.hold = true);
export const release = (g) => (g.hold = false);
// across the avenue: -1 (left) to 1 (right); the next web goes to that side
export const steer = (g, s) => (g.steer = Math.max(-1, Math.min(1, s)));
export const reel = (g, on) => (g.reel = on);

// Where a web shot now would catch: on the wall ahead, on the side asked
// for (or the other side from the last web), a little above him; failing
// that, the other side; failing that, further on.
export function aimWeb(g) {
  const want = Math.abs(g.steer) > 0.3 ? Math.sign(g.steer) : 0;
  const sides = want ? [want, -want] : [g.side, -g.side];
  const speed = Math.hypot(...g.v);
  const ahead = Math.max(16, Math.min(32, 14 + speed * 0.4));
  for (const extra of [0, 10, 20])
    for (const side of sides) {
      const z = g.p[2] - ahead - extra;
      const b = buildingAt(g.avenue, side, z);
      if (!b) continue;
      const y = Math.min(b.h - 1.5, Math.max(18, g.p[1] + 16));
      if (y < g.p[1] + 4) continue; // nothing above him to hang from
      const a = [side * AVENUE.pivot, y, z];
      const len = Math.hypot(a[0] - g.p[0], a[1] - g.p[1], a[2] - g.p[2]);
      if (len > RUN.reach) continue;
      return { a, wall: [side * AVENUE.wall, y, z], len, side };
    }
  return null;
}

// ── a step ──
export function stepRun(g, dt) {
  const ev = [];
  if (g.phase !== 'run') return ev;
  g.t += dt;
  g.grace = Math.max(0, g.grace - dt);
  g.flip = Math.max(0, g.flip - dt * 1.4);
  // the web: shot as the button goes down, let go as it comes up
  if (g.hold && !g.web) {
    const w = aimWeb(g);
    if (w) {
      g.web = w;
      g.side = -w.side;
      g.swings++;
      if (g.mode === 'street') {
        // off the street: the web pulls him up and on
        w.len *= 0.7;
        g.v[1] = Math.max(g.v[1], 11);
        g.v[2] = Math.min(g.v[2], -14);
      }
      g.mode = 'swing';
      ev.push({ type: 'thwip', a: [...w.wall], side: w.side });
    } else if (!g.missed) {
      g.missed = true;
      ev.push({ type: 'miss' });
    }
  }
  if (!g.hold) g.missed = false;
  if (!g.hold && g.web) letGo(g, ev);

  if (g.mode === 'street') {
    // running along the street: slower, and the traffic is right there
    g.v = [g.v[0] * Math.exp(-4 * dt), 0, g.v[2] + (-9 - g.v[2]) * (1 - Math.exp(-3 * dt))];
    g.p[1] = 0.9;
    g.streetT += dt;
  } else {
    g.v[1] -= RUN.gravity * dt;
    // a little air resistance, more the faster he goes
    const s = Math.hypot(...g.v);
    const drag = Math.exp(-0.004 * s * dt);
    for (let i = 0; i < 3; i++) g.v[i] *= drag;
  }
  // across the avenue, where he's steering (the middle, left alone)
  if (g.mode !== 'street') g.v[0] += ((g.steer * 7 - g.p[0]) * RUN.centre - g.v[0]) * Math.min(1, 1.5 * dt);
  else g.v[0] += (g.steer * 6 - g.v[0]) * Math.min(1, 4 * dt);
  for (let i = 0; i < 3; i++) g.p[i] += g.v[i] * dt;

  // the web is a rope: past its length, it pulls him back onto the circle
  if (g.web) {
    const w = g.web;
    // the swing's own push, along the way he's going while he's going forward
    const sp = Math.hypot(...g.v);
    if (sp > 1 && g.v[2] < 0) for (let i = 0; i < 3; i++) g.v[i] += (g.v[i] / sp) * RUN.pump * dt;
    if (g.reel) w.len = Math.max(6, w.len - RUN.reel * dt);
    // and it takes up its own slack before the bottom of the swing would reach the street
    const lowest = w.a[1] - RUN.clear;
    if (w.len > lowest) w.len = Math.max(lowest, w.len - RUN.takeUp * dt);
    const d = [g.p[0] - w.a[0], g.p[1] - w.a[1], g.p[2] - w.a[2]];
    const l = Math.hypot(...d);
    const n = d.map((x) => x / l);
    // well past the anchor, a web would only pull him back: he lets it go
    if (n[2] < -0.45) letGo(g, ev);
    else if (l > w.len) {
      for (let i = 0; i < 3; i++) g.p[i] = w.a[i] + n[i] * w.len;
      const out = g.v[0] * n[0] + g.v[1] * n[1] + g.v[2] * n[2];
      if (out > 0) for (let i = 0; i < 3; i++) g.v[i] -= n[i] * out;
    }
  }

  // the walls: kick off them
  const lim = AVENUE.wall - 0.7;
  if (Math.abs(g.p[0]) > lim) {
    const side = Math.sign(g.p[0]);
    if (buildingAt(g.avenue, side, g.p[2]) || Math.abs(g.p[0]) > AVENUE.wall + 20) {
      g.p[0] = side * lim;
      if (g.v[0] * side > 0) {
        g.v[0] = -g.v[0] * 0.35;
        if (Math.abs(g.v[0]) > 2) ev.push({ type: 'wall', at: [...g.p] });
      }
    }
  }
  // the speed limit, and the sky
  const s = Math.hypot(...g.v);
  if (s > RUN.maxSpeed) for (let i = 0; i < 3; i++) g.v[i] *= RUN.maxSpeed / s;
  if (g.p[1] > RUN.ceiling) {
    g.p[1] = RUN.ceiling;
    g.v[1] = Math.min(0, g.v[1]);
  }
  // never backwards far: the school is that way
  if (g.v[2] > 6) g.v[2] = 6;

  // the street
  if (g.mode !== 'street' && g.p[1] <= 0.9) {
    g.p[1] = 0.9;
    g.web = null;
    g.mode = 'street';
    g.streetT = 0;
    g.combo = 0;
    if (g.grace <= 0) {
      g.hearts--;
      g.grace = RUN.grace;
      ev.push({ type: 'street', at: [...g.p], hearts: g.hearts });
      if (g.hearts <= 0) {
        g.phase = 'lost';
        ev.push({ type: 'lost', why: 'street', d: distance(g), score: Math.round(g.score) });
        return ev;
      }
    } else ev.push({ type: 'land', at: [...g.p] });
  }
  // the traffic
  for (const c of g.cars) {
    c.z += c.v * dt;
    if (c.z < -AVENUE.length) c.z += AVENUE.length;
    if (c.z > 0) c.z -= AVENUE.length;
    if (g.mode === 'street' && g.grace <= 0 && Math.abs(c.x - g.p[0]) < 1.6 && Math.abs(c.z - g.p[2]) < 2.6) {
      g.grace = RUN.grace;
      g.v[0] += Math.sign(g.p[0] - c.x || 1) * 6;
      ev.push({ type: 'honk', at: [...g.p], id: c.id });
    }
  }
  // the backpacks
  for (const k of g.packs) {
    if (k.got) continue;
    if (Math.hypot(k.p[0] - g.p[0], k.p[1] - g.p[1], k.p[2] - g.p[2]) < PACK.r) {
      k.got = true;
      g.got++;
      g.score += PACK.points;
      ev.push({ type: 'pack', at: [...k.p], n: g.got });
    }
  }
  // the way: points for ground covered in the air
  if (g.mode !== 'street') g.score += Math.max(0, -g.v[2]) * dt * 2;
  g.best = Math.max(g.best, distance(g));
  if (distance(g) >= SCHOOL) {
    g.phase = 'won';
    g.score += g.hearts * 300 + Math.max(0, BELL - g.t) * 40;
    ev.push({ type: 'won', d: SCHOOL, time: g.t, score: Math.round(g.score) });
  } else if (g.t > BELL) {
    g.phase = 'lost';
    ev.push({ type: 'bell' });
    ev.push({ type: 'lost', why: 'bell', d: distance(g), score: Math.round(g.score) });
  }
  return ev;
}

function letGo(g, ev) {
  const w = g.web;
  g.web = null;
  g.mode = 'air';
  // how far past straight down the web is, forward: the upswing
  const d = [g.p[0] - w.a[0], g.p[1] - w.a[1], g.p[2] - w.a[2]];
  const past = Math.atan2(w.a[2] - g.p[2], -d[1]); // > 0 once he's swung past under it
  if (past > RUN.perfect.from && past < RUN.perfect.to && g.v[1] > 0 && -g.v[2] > 12) {
    for (let i = 0; i < 3; i++) g.v[i] *= RUN.boost;
    g.v[1] += 5;
    g.perfects++;
    g.combo++;
    g.flip = 1;
    g.score += 60 * Math.min(g.combo, 8);
    ev.push({ type: 'perfect', at: [...g.p], combo: g.combo });
  } else ev.push({ type: 'release' });
}

// ── an autopilot (the tests play with it; the title screen shows it off) ──
// Swing when falling and low enough; let go on the upswing, in the window.
export function pilot(g) {
  if (g.web) {
    const w = g.web;
    const past = Math.atan2(w.a[2] - g.p[2], w.a[1] - g.p[1]);
    if (past > 0.45 && g.v[1] > 0) release(g);
    // a cross street coming: hold on longer and climb
    reel(g, g.p[1] < 10);
  } else {
    reel(g, false);
    if (g.mode === 'street' || (g.v[1] < -1 && g.p[1] < 24) || g.p[1] < 14) press(g);
    else release(g);
  }
  // after the next backpack, if it's near and in reach
  const k = g.packs.find((x) => !x.got && x.p[2] < g.p[2] && x.p[2] > g.p[2] - 60);
  steer(g, k ? Math.max(-1, Math.min(1, k.p[0] / 7)) : 0);
}
