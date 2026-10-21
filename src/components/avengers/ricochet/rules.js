// Ricochet: the rules, apart from the drawing, so they can be tested.
//
// Cap's training hall from above. Throw the shield; it flies in straight lines
// and bounces off steel, stops dead in a padded mat, breaks through glass
// (once), and bounces off a closed door until a switch opens it. Training
// bots go down when it passes through them; an armoured bot needs two hits in
// one throw; the hostage dummy must not be hit. A shield that comes back past
// Cap after a bounce is caught. Clear the room within par for three stars.
//
// The plane is x (right) and z (towards Cap, who stands near +z). A throw is
// worked out in full the moment it leaves Cap's hand: its path, and when and
// where everything happens along it. Patrolling bots move with the room's
// clock, so where they are depends on when you throw.

export const SHIELD = { r: 0.38, speed: 17, bounces: 5, reach: 130, catch: 1.0 };
// the step both views step a room at, whatever the frame rate
export const STEP = 1 / 120;
const BOT_R = 0.45;

const W = (a, b, kind = 'steel', id) => ({ a, b, kind, id });
// a closed box of walls (a pillar), corners [x0, z0]–[x1, z1]
const box = (x0, z0, x1, z1, kind = 'steel') => [W([x0, z0], [x1, z0], kind), W([x1, z0], [x1, z1], kind), W([x1, z1], [x0, z1], kind), W([x0, z1], [x0, z0], kind)].map((w) => ({ ...w, box: [x0, z0, x1, z1] }));
// the room's outer walls, 16 m by 12 m, with any of them made of something else
const shell = ({ left = 'steel', right = 'steel', back = 'steel', front = 'steel' } = {}) => [W([-8, -6], [8, -6], back), W([8, -6], [8, 6], right), W([8, 6], [-8, 6], front), W([-8, 6], [-8, -6], left)];
const CAP = [0, 4.6];

// The twelve rooms. Each is solvable within par (the tests prove it).
export const ROOMS = [
  {
    name: 'Straight shot',
    tip: 'Aim at the bot and throw. The shield comes back if it passes you.',
    par: 1,
    cap: CAP,
    walls: shell(),
    bots: [{ x: 0.6, z: -3.5 }],
  },
  {
    name: 'Bank shot',
    tip: 'Something’s in the way. Bounce it off the side wall.',
    par: 1,
    cap: CAP,
    walls: [...shell(), ...box(-1.6, -1.2, 1.6, 0.4)],
    bots: [{ x: 0, z: -3.8 }],
  },
  {
    name: 'Two for one',
    tip: 'One throw, two bots. Line them up off the back wall.',
    par: 1,
    cap: CAP,
    walls: shell(),
    bots: [
      { x: -3.4, z: -2 },
      { x: 4.2, z: -4.6 },
    ],
  },
  {
    name: 'Soft walls',
    tip: 'Blue mats stop the shield dead. Only steel bounces.',
    par: 1,
    cap: CAP,
    walls: [...shell({ left: 'mat', right: 'mat' }), ...box(-3.4, 1.6, -2.2, 3)],
    bots: [
      { x: -2, z: -3.2 },
      { x: -5.6, z: 0.2 },
    ],
  },
  {
    name: 'Through the glass',
    tip: 'Glass breaks once and lets the shield through.',
    par: 1,
    cap: CAP,
    walls: [...shell(), W([-8, -1.5], [-1, -1.5], 'steel'), W([-1, -1.5], [3, -1.5], 'glass'), W([3, -1.5], [8, -1.5], 'steel')],
    bots: [
      { x: -4.5, z: -4.2 },
      { x: 5.5, z: -3.6 },
    ],
  },
  {
    name: 'On patrol',
    tip: 'This one moves. Time the throw.',
    par: 1,
    cap: CAP,
    walls: [...shell(), ...box(-8, -2.6, -2.2, -1.8), ...box(2.2, -2.6, 8, -1.8)],
    bots: [{ x: -4, z: -4.4, patrol: { to: [4, -4.4], speed: 2.4 } }],
  },
  {
    name: 'Open sesame',
    tip: 'Hit the switch to open the door, then go through.',
    par: 2,
    cap: CAP,
    walls: [...shell(), W([-8, -2], [-1.2, -2], 'steel'), W([-1.2, -2], [1.2, -2], 'door', 'door'), W([1.2, -2], [8, -2], 'steel')],
    switches: [{ x: -7.6, z: 1.5, opens: 'door' }],
    bots: [
      { x: 0, z: -4.4 },
      { x: -4, z: -4.6 },
    ],
  },
  {
    name: 'Corner pocket',
    tip: 'Two banks into the corner.',
    par: 1,
    cap: CAP,
    walls: [...shell(), W([4, -6], [4, -3], 'steel'), W([4, -3], [6.4, -3], 'steel')],
    bots: [{ x: 6.4, z: -4.8 }],
  },
  {
    name: 'Hostage',
    tip: 'The orange dummy is a hostage. Go around.',
    par: 1,
    cap: CAP,
    walls: shell(),
    bots: [
      { x: 0, z: -4.4 },
      { x: 0, z: -1.2, kind: 'hostage' },
    ],
  },
  {
    name: 'Chain',
    tip: 'Five bots. Do it in two throws for three stars.',
    par: 2,
    cap: CAP,
    walls: [...shell(), ...box(-0.5, -1.5, 0.5, -0.5)],
    bots: [
      { x: -6, z: -4.6 },
      { x: -2.8, z: -3.2 },
      { x: 3, z: -4.4 },
      { x: 6.2, z: -1 },
      { x: -6.4, z: 1.8 },
    ],
  },
  {
    name: 'Armoured',
    tip: 'Dark armour takes two hits in one throw. Bounce back through it.',
    par: 1,
    cap: CAP,
    walls: shell({ left: 'mat', right: 'mat' }),
    bots: [{ x: 1.4, z: -4.6, kind: 'armored' }],
  },
  {
    name: 'The gauntlet',
    tip: 'Everything at once. Three throws for three stars.',
    par: 3,
    cap: CAP,
    walls: [...shell({ left: 'mat' }), W([-8, -2.4], [-2, -2.4], 'steel'), W([-2, -2.4], [1, -2.4], 'glass'), W([1, -2.4], [3.4, -2.4], 'door', 'door'), W([3.4, -2.4], [8, -2.4], 'steel')],
    switches: [{ x: 7.6, z: 2.2, opens: 'door' }],
    bots: [
      { x: -5, z: -4.6, kind: 'armored' },
      { x: 2.2, z: -4.4, patrol: { to: [6.2, -4.4], speed: 1.6 } },
      { x: 0, z: 0.4, kind: 'hostage' },
      { x: -5.6, z: 1.6 },
      { x: 5.8, z: -0.6 },
    ],
  },
];

// A room ready to play: bots up, doors shut, glass whole, the clock at zero.
export function newRoom(index) {
  const def = ROOMS[index];
  return {
    index,
    def,
    t: 0,
    throws: 0,
    catches: 0,
    walls: def.walls.map((w, i) => ({ ...w, key: i, broken: false, open: false })),
    bots: def.bots.map((b, i) => ({ ...b, key: i, kind: b.kind ?? 'bot', down: false, dents: 0 })),
    switches: (def.switches ?? []).map((s, i) => ({ ...s, key: i, on: false })),
    phase: 'aim', // aim | flying | cleared | failed
    flight: null,
    failReason: null,
  };
}

// Where a patrolling bot is at time t (back and forth along its rail).
export function botAt(b, t) {
  if (!b.patrol) return [b.x, b.z];
  const [tx, tz] = b.patrol.to;
  const len = Math.hypot(tx - b.x, tz - b.z);
  const period = (2 * len) / b.patrol.speed;
  let k = ((t % period) + period) % period;
  k = k < period / 2 ? k / (period / 2) : 2 - k / (period / 2);
  return [b.x + (tx - b.x) * k, b.z + (tz - b.z) * k];
}

// The first time a ray (o, d) comes within r of segment a–b: { t, nx, nz }
// with the normal it bounces off. Rays starting inside are ignored.
function rayCapsule(ox, oz, dx, dz, a, b, r) {
  let best = null;
  const ex = b[0] - a[0];
  const ez = b[1] - a[1];
  const len = Math.hypot(ex, ez);
  const ux = ex / len;
  const uz = ez / len;
  // the two sides (the segment pushed out by r along its normal)
  for (const s of [1, -1]) {
    const nx = -uz * s;
    const nz = ux * s;
    const px = a[0] + nx * r;
    const pz = a[1] + nz * r;
    const denom = dx * nx + dz * nz;
    if (denom >= -1e-9) continue; // moving away from (or along) this side
    const t = ((px - ox) * nx + (pz - oz) * nz) / denom;
    if (t < 1e-6) continue;
    const hx = ox + dx * t - a[0];
    const hz = oz + dz * t - a[1];
    const along = hx * ux + hz * uz;
    if (along < 0 || along > len) continue;
    if (!best || t < best.t) best = { t, nx, nz };
  }
  // the rounded ends
  for (const c of [a, b]) {
    const fx = ox - c[0];
    const fz = oz - c[1];
    const B = fx * dx + fz * dz;
    const C = fx * fx + fz * fz - r * r;
    if (C < 0) continue;
    const disc = B * B - C;
    if (disc < 0) continue;
    const t = -B - Math.sqrt(disc);
    if (t < 1e-6) continue;
    if (!best || t < best.t) {
      const hx = ox + dx * t - c[0];
      const hz = oz + dz * t - c[1];
      const l = Math.hypot(hx, hz);
      best = { t, nx: hx / l, nz: hz / l };
    }
  }
  return best;
}

// Throw the shield at `angle` (radians; 0 is straight up the room, positive
// to the right) at the room's current time. Returns the flight: its path, its
// events in time order, and how it ended. Doesn't change the room.
export function simulateThrow(room, angle) {
  const R = SHIELD.r;
  const t0 = room.t;
  let [x, z] = room.def.cap;
  let dx = Math.sin(angle);
  let dz = -Math.cos(angle);
  let t = 0; // seconds since the throw
  let bounces = 0;
  let travelled = 0;
  const path = [{ x, z, t: 0 }];
  const events = [];
  const walls = room.walls.map((w) => ({ ...w }));
  const switches = room.switches.map((s) => ({ ...s }));
  const hits = new Map(); // bot key → hits this throw
  const downs = new Set(room.bots.filter((b) => b.down).map((b) => b.key));
  let end = 'dropped';

  while (travelled < SHIELD.reach) {
    // the next wall
    let hit = null;
    for (const w of walls) {
      if (w.broken || w.open) continue;
      const h = rayCapsule(x, z, dx, dz, w.a, w.b, R);
      if (h && (!hit || h.t < hit.t)) hit = { ...h, w };
    }
    const segLen = Math.min(hit ? hit.t : Infinity, SHIELD.reach - travelled);
    // switches, bots and Cap along this stretch, in order
    const along = [];
    for (const s of switches) {
      if (s.on) continue;
      const fx = x - s.x;
      const fz = z - s.z;
      const B = fx * dx + fz * dz;
      const C = fx * fx + fz * fz - (R + 0.35) ** 2;
      const disc = B * B - C;
      if (disc < 0) continue;
      const tt = -B - Math.sqrt(disc);
      if (tt >= 0 && tt <= segLen) along.push({ d: tt, kind: 'switch', s });
    }
    // bots: sample, since they may be moving
    const step = 0.12;
    for (const b of room.bots) {
      if (downs.has(b.key)) continue;
      for (let d = 0; d <= segLen; d += step) {
        const [bx, bz] = botAt(b, t0 + t + d / SHIELD.speed);
        const px = x + dx * d;
        const pz = z + dz * d;
        if (Math.hypot(px - bx, pz - bz) < R + BOT_R) {
          along.push({ d, kind: 'bot', b, at: [bx, bz] });
          break;
        }
      }
    }
    if (bounces > 0) {
      // back past Cap: caught
      const [cx, cz] = room.def.cap;
      const fx = x - cx;
      const fz = z - cz;
      const B = fx * dx + fz * dz;
      const C = fx * fx + fz * fz - SHIELD.catch ** 2;
      const disc = B * B - C;
      if (disc >= 0) {
        const tt = -B - Math.sqrt(disc);
        if (tt >= 0 && tt <= segLen) along.push({ d: tt, kind: 'catch' });
      }
    }
    along.sort((p, q) => p.d - q.d);
    let stopped = false;
    for (const e of along) {
      const et = t + e.d / SHIELD.speed;
      const ex = x + dx * e.d;
      const ez = z + dz * e.d;
      if (e.kind === 'catch') {
        path.push({ x: ex, z: ez, t: et });
        events.push({ t: et, type: 'catch', x: ex, z: ez });
        end = 'caught';
        stopped = true;
        break;
      }
      if (e.kind === 'switch') {
        e.s.on = true;
        events.push({ t: et, type: 'switch', key: e.s.key, x: e.s.x, z: e.s.z });
        for (const w of walls) if (w.id === e.s.opens) w.open = true;
        events.push({ t: et, type: 'open', id: e.s.opens });
      } else if (e.kind === 'bot') {
        const b = e.b;
        if (b.kind === 'hostage') {
          events.push({ t: et, type: 'hostage', key: b.key, x: e.at[0], z: e.at[1] });
          path.push({ x: ex, z: ez, t: et });
          end = 'hostage';
          stopped = true;
          break;
        }
        const n = (hits.get(b.key) ?? 0) + 1;
        hits.set(b.key, n);
        if (b.kind === 'armored' && n < 2) {
          // the plate comes off; the shield carries on through
          events.push({ t: et, type: 'armor', key: b.key, x: e.at[0], z: e.at[1], dx, dz });
          continue;
        }
        downs.add(b.key);
        events.push({ t: et, type: 'down', key: b.key, x: e.at[0], z: e.at[1], dx, dz });
      }
    }
    if (stopped) break;
    if (!hit) {
      x += dx * segLen;
      z += dz * segLen;
      t += segLen / SHIELD.speed;
      path.push({ x, z, t });
      break;
    }
    // the wall
    x += dx * hit.t;
    z += dz * hit.t;
    t += hit.t / SHIELD.speed;
    travelled += hit.t;
    path.push({ x, z, t });
    const w = hit.w;
    if (w.kind === 'mat') {
      events.push({ t, type: 'mat', x, z });
      end = 'mat';
      break;
    }
    if (w.kind === 'glass') {
      w.broken = true;
      events.push({ t, type: 'glass', key: w.key, x, z });
      // through it, a hair further so it doesn't hit the same pane again
      continue;
    }
    // steel or a closed door: bounce
    bounces++;
    events.push({ t, type: 'bounce', kind: w.kind, key: w.key, x, z, n: bounces });
    if (bounces > SHIELD.bounces) {
      end = 'dropped';
      events.push({ t, type: 'drop', x, z });
      break;
    }
    const dot = dx * hit.nx + dz * hit.nz;
    dx -= 2 * dot * hit.nx;
    dz -= 2 * dot * hit.nz;
  }
  events.sort((p, q) => p.t - q.t);
  return { angle, t0, path, events, end, duration: path[path.length - 1].t, downs: [...downs] };
}

// Throw for real: the room starts the flight.
export function throwShield(room, angle) {
  if (room.phase !== 'aim') return null;
  const flight = simulateThrow(room, angle);
  room.flight = { ...flight, elapsed: 0, done: 0 };
  room.throws++;
  room.phase = 'flying';
  return flight;
}

// Advance the room's clock (and a flight in progress). Returns the flight's
// events that happened in this step.
export function stepRoom(room, dt) {
  room.t += dt;
  const out = [];
  const f = room.flight;
  if (!f) return out;
  f.elapsed += dt;
  while (f.done < f.events.length && f.events[f.done].t <= f.elapsed) {
    const e = f.events[f.done++];
    apply(room, e);
    out.push(e);
  }
  if (f.elapsed >= f.duration) {
    room.flight = null;
    if (f.end === 'caught') room.catches++;
    out.push({ type: 'land', end: f.end });
    settle(room, f, out);
  }
  return out;
}

function apply(room, e) {
  if (e.type === 'down') room.bots[e.key].down = true;
  else if (e.type === 'glass') room.walls[e.key].broken = true;
  else if (e.type === 'switch') room.switches[e.key].on = true;
  else if (e.type === 'open') for (const w of room.walls) if (w.id === e.id) w.open = true;
  else if (e.type === 'armor') room.bots[e.key].dents = 1;
  else if (e.type === 'hostage') room.bots[e.key].hit = true;
}

// After a throw: cleared, failed, or another go.
function settle(room, f, out) {
  // an armoured bot hit once recovers its footing
  for (const b of room.bots) if (b.kind === 'armored' && !b.down) b.dents = 0;
  if (f.end === 'hostage') {
    room.phase = 'failed';
    room.failReason = 'hostage';
    out.push({ type: 'failed', reason: 'hostage' });
    return;
  }
  const left = room.bots.filter((b) => b.kind !== 'hostage' && !b.down).length;
  if (!left) {
    room.phase = 'cleared';
    const stars = starsFor(room);
    out.push({ type: 'cleared', throws: room.throws, stars, catches: room.catches });
    return;
  }
  if (room.throws >= limitFor(room.def)) {
    room.phase = 'failed';
    room.failReason = 'throws';
    out.push({ type: 'failed', reason: 'throws' });
    return;
  }
  room.phase = 'aim';
}

export const limitFor = (def) => def.par + 3;
export const starsFor = (room) => (room.throws <= room.def.par ? 3 : room.throws === room.def.par + 1 ? 2 : 1);
export const botsLeft = (room) => room.bots.filter((b) => b.kind !== 'hostage' && !b.down).length;
