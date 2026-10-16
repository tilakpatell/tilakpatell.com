// Tesseract Run: the rules, apart from the drawing, so they can be tested.
//
// The Quinjet carries the Tesseract's containment case slung beneath it on a
// steel cable, from the compound's airfield out over the trees, across the
// fields, under a gantry, over a ridge and, in a storm, into the hangar. Seen
// side-on: x along the ground (metres, the way to go is +x), y up. The jet
// leans to go sideways and thrusts to climb; gravity, the wind, its gusts and
// a tank of fuel are against it. The case hangs on the cable and swings. Set
// it down on the pad slowly enough and the leg is done; hit the ground, a
// tree or a girder too hard with the jet or the case and it's a crash, and
// the leg starts again. The sixth leg, into the hangar, gives up the Space
// Stone.
//
// One step is 1/120 s. The jet and the case are point masses joined by the
// cable (a rope: it pulls when it's taut and goes slack when it isn't), moved
// by position-based dynamics, so contacts and the cable are exact and stable.

import { rng } from '../hq/rng';

export const STEP = 1 / 120;
export const G = 9.8;

export const JET = {
  mass: 1,
  thrust: 1.85, // full thrust, in multiples of the jet and case's weight
  spoolUp: 0.26, // seconds (a time constant) for the fans to answer the throttle
  spoolDown: 0.2,
  maxTilt: 0.42, // radians the thrust leans at full stick (the fans tilt)…
  pitch: 0.5, // …and the share of that the body pitches
  tiltRate: 4.5, // how quickly it leans (per second)
  drag: 0.3, // per second, against the air
  crash: 4.2, // m/s into anything on the wheels
  scrape: 2.4, // m/s into anything with the body
  hook: 1.5, // the winch, below the middle
  gearDown: 15, // metres above the ground: the wheels come down below this…
  gearUp: 20, // …and go up above this
  gearTime: 1.1, // seconds to go up or down
  hold: 2.6, // seconds F.R.I.D.A.Y. holds the hover at the start of a leg
};

// The case: w × h, its position the middle of its base. The sling's ring is
// `sling` above its lid; the cable runs from the jet's hook to the ring.
export const CASE = { mass: 0.42, w: 2.2, h: 2.0, sling: 0.9, drag: 0.55, crash: 3.6, soft: 1.0, still: 0.3, settle: 1.0 };
export const CABLE = 9;
export const CEILING = 78;
export const BOUNDS = [-70, 900];

// The jet's outline (facing +x, metres from its middle): where it can touch
// things. The wheels' points move with the landing gear.
export const BODY = [
  [8.6, -0.1], // nose
  [6.6, -0.85], // chin
  [3.2, -1.2], // belly, front
  [-3.4, -1.15], // belly, back
  [-7.7, 0.2], // tail
  [-6.9, 3.3], // fin tips
  [-4.2, 1.25], // spine, back
  [0, 1.45], // spine
  [3.6, 1.25], // canopy
];
export const WHEELS = [
  [5.0, -1.2],
  [-2.6, -1.15],
];
export const WHEEL_DROP = 1.2; // how far below the belly the wheels are when down

// The ground along the way (cosine-smoothed between these points): the
// airfield, a wood on gentle rises, a meadow with a hummock, the gantry's
// apron, the ridge, the valley and the hangar.
export const GROUND = [
  [-400, 0],
  [100, 0],
  [118, 0.5],
  [136, 1.5],
  [154, 1.1],
  [172, 1.8],
  [192, 0.4],
  [208, 0],
  [262, 0],
  [280, 1.6],
  [292, 2.6],
  [304, 1.4],
  [322, 0],
  [480, 0],
  [494, 2.5],
  [508, 9],
  [520, 19],
  [531, 27],
  [540, 31],
  [549, 29],
  [558, 22],
  [570, 12],
  [584, 4],
  [598, 0.4],
  [612, 0],
  [1400, 0],
];

// The pads, start to finish: leg n flies from pad n to pad n + 1.
export const PADS = [
  { x: 12, half: 7 },
  { x: 78, half: 7 },
  { x: 228, half: 7 },
  { x: 352, half: 6.5 },
  { x: 466, half: 6.5 },
  { x: 628, half: 6.5 },
  { x: 782, half: 7 },
];

// Trees in the way: [x, height]. Firs, so a cone on a trunk.
export const TREES = [
  [114, 13],
  [121, 17],
  [128, 20],
  [135, 18],
  [142, 22],
  [150, 19],
  [157, 23],
  [165, 20],
  [172, 21],
  [180, 17],
  [188, 14],
  [195, 10],
  [664, 12],
  [671, 15],
  [678, 13],
  [686, 16],
  [693, 12],
];

// The gantry's boom crosses over the way; the hangar's roof and back wall.
export const GANTRY = { x: 412, w: 4.2, y: 24, h: 3.4 };
export const HANGAR = { x0: 726, x1: 814, roof: 24.5, top: 35, wall: 4 };

export const LEGS = [
  { id: 'hop', title: 'A short hop', from: 0, to: 1, fuel: 28, par: 26, wind: { base: 0, gust: 0, every: [6, 9], bias: 0.5 }, sky: 'airfield' },
  { id: 'trees', title: 'Over the trees', from: 1, to: 2, fuel: 40, par: 40, wind: { base: 1, gust: 2.5, every: [5, 8], bias: 0.6 }, sky: 'airfield' },
  { id: 'crosswind', title: 'Crosswind', from: 2, to: 3, fuel: 40, par: 40, wind: { base: -3.5, gust: 3.5, every: [3.5, 6], bias: 0.3 }, sky: 'airfield' },
  { id: 'gantry', title: 'Under the gantry', from: 3, to: 4, fuel: 38, par: 38, wind: { base: 1.5, gust: 3, every: [4, 7], bias: 0.6 }, sky: 'dusk' },
  { id: 'ridge', title: 'Gusts over the ridge', from: 4, to: 5, fuel: 48, par: 50, wind: { base: -2, gust: 4, every: [3, 5], bias: 0.35, ridge: 540 }, sky: 'dusk' },
  { id: 'storm', title: 'The storm, into the hangar', from: 5, to: 6, fuel: 46, par: 48, wind: { base: 2.5, gust: 5.5, every: [2.5, 4.5], bias: 0.65 }, sky: 'storm' },
];

// ── the world ──
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function groundAt(x) {
  let i = 0;
  while (i < GROUND.length - 2 && GROUND[i + 1][0] < x) i++;
  const [x0, y0] = GROUND[i];
  const [x1, y1] = GROUND[i + 1];
  const k = clamp((x - x0) / (x1 - x0), 0, 1);
  return y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(Math.PI * k));
}
export const slopeAt = (x) => (groundAt(x + 0.25) - groundAt(x - 0.25)) / 0.5;

// Solid things, as convex polygons (corners anticlockwise) with a kind.
function treeShape(x, h) {
  const b = groundAt(x) - 0.2;
  const half = h * 0.16;
  return [
    { kind: 'tree', pts: [[x - half, b + h * 0.12], [x + half, b + h * 0.12], [x, b + h * 0.97]] },
    { kind: 'tree', pts: [[x - 0.35, b], [x + 0.35, b], [x + 0.35, b + h * 0.13], [x - 0.35, b + h * 0.13]] },
  ];
}
const rect = (kind, x0, y0, x1, y1) => ({ kind, pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
export const OBSTACLES = [
  ...TREES.flatMap(([x, h]) => treeShape(x, h)),
  rect('gantry', GANTRY.x - GANTRY.w / 2, GANTRY.y, GANTRY.x + GANTRY.w / 2, GANTRY.y + GANTRY.h),
  rect('hangar', HANGAR.x0 - 2, HANGAR.roof, HANGAR.x1, HANGAR.top),
  rect('hangar', HANGAR.x1 - HANGAR.wall, -2, HANGAR.x1 + 2, HANGAR.top),
];
for (const o of OBSTACLES) {
  o.x0 = Math.min(...o.pts.map((p) => p[0]));
  o.x1 = Math.max(...o.pts.map((p) => p[0]));
  o.y0 = Math.min(...o.pts.map((p) => p[1]));
  o.y1 = Math.max(...o.pts.map((p) => p[1]));
}
export const inHangar = (x, y) => x > HANGAR.x0 && x < HANGAR.x1 && y < HANGAR.roof;

// how far a point is inside a polygon, and which way is out (or null)
function insidePoly(o, px, py) {
  if (px < o.x0 || px > o.x1 || py < o.y0 || py > o.y1) return null;
  let best = null;
  const n = o.pts.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = o.pts[i];
    const [bx, by] = o.pts[(i + 1) % n];
    const ex = bx - ax;
    const ey = by - ay;
    const len = Math.hypot(ex, ey);
    const nx = ey / len;
    const ny = -ex / len;
    const d = -((px - ax) * nx + (py - ay) * ny); // depth inside this edge
    if (d < 0) return null;
    if (!best || d < best.depth) best = { depth: d, nx, ny };
  }
  return best;
}

// ── the wind ──
// A steady wind, gusts that come and go (announced a second ahead), and a
// little turbulence. It's lighter near the ground, rides up and over the
// ridge, and doesn't blow inside the hangar.
export function windAt(g, x, y) {
  const W = LEGS[g.leg].wind;
  const above = y - groundAt(x);
  let k = clamp(0.4 + above / 26, 0.4, 1.15);
  if (W.ridge != null) k *= 1 + 0.6 * Math.exp(-(((x - W.ridge) / 42) ** 2));
  if (x > HANGAR.x0 - 6 && x < HANGAR.x1 && y < HANGAR.roof + 1) k *= clamp((HANGAR.x0 - x) / 6, 0, 1);
  const t = g.t;
  const turb = W.gust * 0.12 * (Math.sin(t * 1.3 + x * 0.05) + 0.6 * Math.sin(t * 3.1 + 1.7));
  const wx = (W.base + gustNow(g) + turb) * k;
  // up the windward slope, down the lee
  const wy = W.ridge != null ? wx * slopeAt(x) * 0.7 * Math.exp(-Math.max(0, above) / 14) : 0;
  return [wx, wy];
}

function gustNow(g) {
  const s = g.gust;
  if (!s || g.t < s.t0) return 0;
  const k = (g.t - s.t0) / s.dur;
  if (k >= 1) return 0;
  return s.amp * Math.sin(Math.PI * k) ** 2;
}

function planGust(g, from) {
  const W = LEGS[g.leg].wind;
  const r = g.rand;
  const t0 = from + W.every[0] + r() * (W.every[1] - W.every[0]);
  const sign = r() < W.bias ? 1 : -1;
  g.nextGust = { t0, dur: 1.6 + r() * 1.4, amp: sign * W.gust * (0.65 + r() * 0.35), warned: false };
}

// ── the game ──
export function newGame({ seed = 1, leg = 0 } = {}) {
  const g = { seed, leg, phase: 'ready', queue: [] };
  reset(g, leg);
  return g;
}

function reset(g, leg) {
  g.leg = clamp(leg, 0, LEGS.length - 1);
  const L = LEGS[g.leg];
  const from = PADS[L.from];
  g.rand = rng((g.seed * 7919 + g.leg * 104729) >>> 0);
  g.t = 0;
  g.hold = JET.hold;
  g.input = { thrust: 0, tilt: 0 };
  g.fuel = L.fuel;
  const cy = groundAt(from.x);
  // the case on the pad, the jet over it with the cable just slack
  g.case = { x: from.x, y: cy, vx: 0, vy: 0, grounded: true, groundT: 1, airT: 0, touch: null, settle: 0 };
  const ring = cy + CASE.h + CASE.sling;
  g.jet = { x: from.x, y: ring + CABLE * 0.985 + JET.hook, vx: 0, vy: 0, angle: 0, spool: hoverSpool(false), gear: 1, landed: false };
  g.taut = false;
  g.tension = 0;
  g.gust = null;
  g.nextGust = null;
  if (L.wind.gust > 0) planGust(g, 0);
  g.lowFuel = false;
  g.stranded = 0;
  g.result = null;
  g.crash = null;
  g.won = false;
}

// The throttle that holds a hover, with or without the case's weight.
export const hoverSpool = (loaded = true) => (JET.mass + (loaded ? CASE.mass : 0)) / (JET.thrust * (JET.mass + CASE.mass));

export function startLeg(g, leg = g.leg) {
  reset(g, leg);
  g.phase = 'fly';
  g.queue.push({ type: 'start', leg: g.leg, title: LEGS[g.leg].title });
  return g.queue.splice(0);
}

// Controls: thrust 0–1, tilt -1 (lean back, toward -x) to 1 (lean on, +x).
export function setInput(g, { thrust = 0, tilt = 0 } = {}) {
  g.input.thrust = clamp(thrust, 0, 1);
  g.input.tilt = clamp(tilt, -1, 1);
  if (g.phase === 'fly' && g.hold > 0 && (g.input.thrust > 0 || g.input.tilt !== 0)) {
    g.hold = 0;
    g.queue.push({ type: 'controls' });
  }
}

// The body pitches with part of the lean; the fans tilt the rest of the way.
export const pitchOf = (J) => J.angle * JET.pitch;

// Where the jet's points are now: [x, y, isWheel].
function jetPoints(J) {
  const p = pitchOf(J);
  const c = Math.cos(p);
  const s = Math.sin(p);
  const out = [];
  const put = (lx, ly, wheel) => out.push([J.x + lx * c + ly * s, J.y - lx * s + ly * c, wheel]);
  for (const [lx, ly] of BODY) put(lx, ly, false);
  for (const [lx, ly] of WHEELS) put(lx, ly - WHEEL_DROP * J.gear, J.gear > 0.5);
  return out;
}
export const hookAt = (J) => [J.x - JET.hook * Math.sin(pitchOf(J)), J.y - JET.hook * Math.cos(pitchOf(J))];
export const ringAt = (C) => [C.x, C.y + CASE.h + CASE.sling];
const caseBox = (C) => ({ x0: C.x - CASE.w / 2, x1: C.x + CASE.w / 2, y0: C.y, y1: C.y + CASE.h });

// keep the cable no longer than it is, moving each end by its share
function cable(g) {
  const J = g.jet;
  const C = g.case;
  const [hx, hy] = hookAt(J);
  const [rx, ry] = ringAt(C);
  const dx = rx - hx;
  const dy = ry - hy;
  const len = Math.hypot(dx, dy);
  if (len <= CABLE) return false;
  const s = (len - CABLE) / len;
  const wj = 1 / JET.mass;
  const wc = 1 / CASE.mass;
  const kj = wj / (wj + wc);
  J.x += dx * s * kj;
  J.y += dy * s * kj;
  C.x -= dx * s * (1 - kj);
  C.y -= dy * s * (1 - kj);
  return true;
}

// Push the case out of the ground and whatever else it's in. Returns the
// hardest contact: { speed, kind }.
function collideCase(g, vx, vy) {
  const C = g.case;
  let hit = null;
  const note = (nx, ny, kind) => {
    const sp = -(vx * nx + vy * ny);
    if (!hit || sp > hit.speed) hit = { speed: sp, kind };
  };
  // the ground under its base
  let depth = -Infinity;
  let at = C.x;
  for (const dx of [-CASE.w / 2, 0, CASE.w / 2]) {
    const d = groundAt(C.x + dx) - C.y;
    if (d > depth) {
      depth = d;
      at = C.x + dx;
    }
  }
  let grounded = false;
  if (depth > -0.01) {
    grounded = true;
    if (depth > 0) {
      const sl = slopeAt(at);
      const l = Math.hypot(sl, 1);
      note(-sl / l, 1 / l, 'ground');
      C.y += depth;
    } else note(0, 1, 'ground');
  }
  // trees, girders, walls
  for (const o of OBSTACLES) {
    const b = caseBox(C);
    if (b.x1 < o.x0 || b.x0 > o.x1 || b.y1 < o.y0 || b.y0 > o.y1) continue;
    let push = null;
    for (const [px, py] of [
      [b.x0, b.y0],
      [b.x1, b.y0],
      [b.x0, b.y1],
      [b.x1, b.y1],
      [C.x, b.y0],
      [C.x, b.y1],
      [b.x0, (b.y0 + b.y1) / 2],
      [b.x1, (b.y0 + b.y1) / 2],
    ]) {
      const p = insidePoly(o, px, py);
      if (p && (!push || p.depth > push.depth)) push = p;
    }
    // a point of the obstacle (a treetop) inside the case
    for (const [px, py] of o.pts) {
      if (px <= b.x0 || px >= b.x1 || py <= b.y0 || py >= b.y1) continue;
      const opts = [
        { depth: px - b.x0, nx: 1, ny: 0 },
        { depth: b.x1 - px, nx: -1, ny: 0 },
        { depth: py - b.y0, nx: 0, ny: 1 },
        { depth: b.y1 - py, nx: 0, ny: -1 },
      ];
      const p = opts.reduce((a, c) => (c.depth < a.depth ? c : a));
      if (!push || p.depth > push.depth) push = p;
    }
    if (!push) continue;
    note(push.nx, push.ny, o.kind);
    C.x += push.nx * push.depth;
    C.y += push.ny * push.depth;
    if (push.ny > 0.6) grounded = true; // resting on top of something
  }
  return { hit, grounded };
}

// Push the jet out of the ground, obstacles and its own case.
function collideJet(g, vx, vy) {
  const J = g.jet;
  let hit = null;
  let landed = false;
  const note = (nx, ny, kind, wheel) => {
    const sp = -(vx * nx + vy * ny);
    const limit = wheel ? JET.crash : JET.scrape;
    if (!hit || sp / limit > hit.speed / hit.limit) hit = { speed: sp, kind, wheel, limit };
  };
  for (let pass = 0; pass < 2; pass++) {
    let push = null;
    for (const [px, py, wheel] of jetPoints(J)) {
      const d = groundAt(px) - py;
      if (d > 0) {
        const sl = slopeAt(px);
        const l = Math.hypot(sl, 1);
        if (pass === 0) note(-sl / l, 1 / l, 'ground', wheel);
        if (wheel) landed = true;
        if (!push || d > push.depth) push = { depth: d, nx: 0, ny: 1 };
      }
      for (const o of OBSTACLES) {
        const p = insidePoly(o, px, py);
        if (!p) continue;
        if (pass === 0) note(p.nx, p.ny, o.kind, wheel);
        if (wheel && p.ny > 0.7) landed = true;
        if (!push || p.depth > push.depth) push = p;
      }
      // its own case
      const b = caseBox(g.case);
      if (px > b.x0 && px < b.x1 && py > b.y0 && py < b.y1) {
        const top = b.y1 - py;
        const side = Math.min(px - b.x0, b.x1 - px);
        const p = top < side ? { depth: top, nx: 0, ny: 1 } : { depth: side, nx: px < g.case.x ? -1 : 1, ny: 0 };
        if (pass === 0) {
          const sp = -((vx - g.case.vx) * p.nx + (vy - g.case.vy) * p.ny);
          if (!hit || sp / JET.scrape > hit.speed / hit.limit) hit = { speed: sp, kind: 'case', wheel, limit: wheel ? JET.crash : JET.scrape };
        }
        if (!push || p.depth > push.depth) push = p;
      }
    }
    if (!push) break;
    J.x += push.nx * push.depth;
    J.y += push.ny * push.depth;
  }
  return { hit, landed };
}

export function stepGame(g, dt = STEP) {
  const ev = g.queue.splice(0);
  if (g.phase !== 'fly') return ev;
  const J = g.jet;
  const C = g.case;
  const L = LEGS[g.leg];
  const pad = PADS[L.to];

  // F.R.I.D.A.Y. holds the hover until the pilot takes the controls (or a moment passes)
  if (g.hold > 0) {
    g.hold -= dt;
    g.t += dt;
    J.spool = hoverSpool(false);
    if (g.hold <= 0) ev.push({ type: 'controls', idle: true });
    return ev;
  }
  g.t += dt;

  // the fans spool toward the throttle; the jet leans toward the stick
  const want = g.fuel > 0 ? g.input.thrust : 0;
  const tau = want > J.spool ? JET.spoolUp : JET.spoolDown;
  J.spool += (want - J.spool) * (1 - Math.exp(-dt / tau));
  J.angle += (g.input.tilt * JET.maxTilt - J.angle) * (1 - Math.exp(-JET.tiltRate * dt));
  if (g.fuel > 0) {
    g.fuel = Math.max(0, g.fuel - J.spool * dt);
    if (!g.lowFuel && g.fuel < L.fuel * 0.2) {
      g.lowFuel = true;
      ev.push({ type: 'fuel-low' });
    }
    if (g.fuel <= 0) ev.push({ type: 'fuel-out' });
  }
  // the wheels: down near the ground, up in the air
  const clear = J.y - groundAt(J.x);
  const gearTo = clear < JET.gearDown ? 1 : clear > JET.gearUp ? 0 : J.gear >= 0.5 ? 1 : 0;
  if (gearTo !== J.gear) {
    const was = J.gear;
    J.gear = clamp(J.gear + Math.sign(gearTo - J.gear) * (dt / JET.gearTime), 0, 1);
    if ((was === 0 || was === 1) && was !== J.gear) ev.push({ type: 'gear', down: gearTo === 1 });
  }

  // gusts: warned of, then felt
  const ng = g.nextGust;
  if (ng) {
    if (!ng.warned && g.t >= ng.t0 - 1) {
      ng.warned = true;
      ev.push({ type: 'gust-warn', dir: Math.sign(ng.amp), strength: Math.abs(ng.amp) });
    }
    if (g.t >= ng.t0) {
      g.gust = ng;
      ev.push({ type: 'gust', dir: Math.sign(ng.amp), strength: Math.abs(ng.amp) });
      planGust(g, ng.t0 + ng.dur);
    }
  }

  // forces: thrust along the jet's up, gravity, the air
  const [jwx, jwy] = windAt(g, J.x, J.y);
  const thrust = (J.spool * JET.thrust * (JET.mass + CASE.mass) * G) / JET.mass;
  J.vx += (Math.sin(J.angle) * thrust + JET.drag * (jwx - J.vx)) * dt;
  J.vy += (Math.cos(J.angle) * thrust - G + JET.drag * (jwy - J.vy)) * dt;
  const [cwx, cwy] = windAt(g, C.x, C.y + CASE.h / 2);
  C.vx += CASE.drag * (cwx - C.vx) * dt;
  C.vy += (-G + CASE.drag * (cwy - C.vy)) * dt;
  const v0 = { jx: J.vx, jy: J.vy, cx: C.vx, cy: C.vy };

  // move, then the cable, then contacts, then the cable again
  const px = { jx: J.x, jy: J.y, cx: C.x, cy: C.y };
  J.x += J.vx * dt;
  J.y += J.vy * dt;
  C.x += C.vx * dt;
  C.y += C.vy * dt;
  const wasTaut = g.taut;
  let taut = cable(g);
  const cc = collideCase(g, v0.cx, v0.cy);
  const jc = collideJet(g, v0.jx, v0.jy);
  taut = cable(g) || taut;
  {
    // the cable mustn't drag the case into the ground
    let d = 0;
    for (const dx of [-CASE.w / 2, 0, CASE.w / 2]) d = Math.max(d, groundAt(C.x + dx) - C.y);
    if (d > 0) C.y += d;
  }
  // the walls of the world, and the cloud base
  if (J.x < BOUNDS[0] || J.x > BOUNDS[1]) J.x = clamp(J.x, BOUNDS[0], BOUNDS[1]);
  if (J.y > CEILING) J.y = CEILING;
  J.vx = (J.x - px.jx) / dt;
  J.vy = (J.y - px.jy) / dt;
  C.vx = (C.x - px.cx) / dt;
  C.vy = (C.y - px.cy) / dt;

  // the cable snapping taut
  if (taut && !wasTaut) {
    const [hx, hy] = hookAt(J);
    const [rx, ry] = ringAt(C);
    const l = Math.hypot(rx - hx, ry - hy) || 1;
    const sp = -((v0.cx - v0.jx) * (rx - hx) + (v0.cy - v0.jy) * (ry - hy)) / l;
    if (sp > 2) ev.push({ type: 'taut', speed: sp });
  }
  g.taut = taut;

  // what it all ran into
  const crash = (what, h) => {
    g.phase = 'crashed';
    g.crash = { what, into: h.kind, speed: h.speed, x: what === 'jet' ? J.x : C.x, y: what === 'jet' ? J.y : C.y + CASE.h / 2 };
    ev.push({ type: 'crash', ...g.crash, leg: g.leg });
    return ev;
  };
  if (jc.hit && jc.hit.speed > jc.hit.limit) return crash('jet', jc.hit);
  if (cc.hit && cc.hit.speed > CASE.crash) return crash('case', cc.hit);
  if (jc.hit && jc.hit.speed > 0.6) ev.push({ type: 'bump', what: 'jet', speed: jc.hit.speed, into: jc.hit.kind, wheel: jc.hit.wheel });

  // on the wheels: rolling to a stop
  J.landed = jc.landed;
  if (jc.landed) J.vx *= Math.exp(-5 * dt);

  // the case: touching down, lifting off, sliding to a stop
  const onPad = Math.abs(C.x - pad.x) + CASE.w / 2 <= pad.half && Math.abs(C.y - groundAt(pad.x)) < 0.05;
  if (cc.grounded) {
    C.vx *= Math.exp(-7 * dt);
    if (!C.grounded) {
      const speed = Math.max(0, cc.hit?.speed ?? 0);
      C.touch = speed;
      ev.push({ type: 'touch', speed, onPad, x: C.x, kind: cc.hit?.kind ?? 'ground' });
    }
    C.grounded = true;
    C.groundT += dt;
    C.airT = 0;
  } else {
    C.airT += dt;
    if (C.grounded && C.airT > 0.05) {
      C.grounded = false;
      C.groundT = 0;
      ev.push({ type: 'lift', x: C.x });
    }
  }

  // set down on the pad and still: delivered
  const still = Math.hypot(C.vx, C.vy) < CASE.still;
  if (C.grounded && onPad && still) {
    if (C.settle === 0) ev.push({ type: 'settling' });
    C.settle += dt;
    if (C.settle >= CASE.settle) return deliver(g, ev);
  } else C.settle = 0;

  // out of fuel and sitting still somewhere other than the pad
  if (g.fuel <= 0 && J.landed && Math.hypot(J.vx, J.vy) < 0.3) {
    g.stranded += dt;
    if (g.stranded > 1.5) {
      g.phase = 'crashed';
      g.crash = { what: 'fuel', into: 'fuel', speed: 0, x: J.x, y: J.y };
      ev.push({ type: 'crash', ...g.crash, leg: g.leg });
    }
  } else g.stranded = 0;
  return ev;
}

function deliver(g, ev) {
  const L = LEGS[g.leg];
  const pad = PADS[L.to];
  const C = g.case;
  const touch = C.touch ?? 0;
  const parts = {
    fuel: Math.round(1000 * (g.fuel / L.fuel)),
    time: Math.round(1000 * (g.t <= L.par ? 1 : Math.max(0, 1 - (g.t - L.par) / L.par))),
    soft: Math.round(1000 * (1 - clamp((touch - CASE.soft) / (CASE.crash - CASE.soft), 0, 1))),
    aim: Math.round(500 * (1 - clamp(Math.abs(C.x - pad.x) / (pad.half - CASE.w / 2), 0, 1))),
  };
  const score = parts.fuel + parts.time + parts.soft + parts.aim;
  g.phase = 'delivered';
  g.result = { leg: g.leg, score, parts, t: g.t, fuel: g.fuel, touch, offset: C.x - pad.x };
  ev.push({ type: 'delivered', ...g.result });
  if (g.leg === LEGS.length - 1) {
    g.won = true;
    ev.push({ type: 'won', score });
  }
  return ev;
}

// How high the case's base is above the ground, and how fast it's coming down.
export const caseHeight = (g) => g.case.y - groundAt(g.case.x);
