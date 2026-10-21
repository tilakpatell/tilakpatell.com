// A broom, as plain numbers (docs/superpowers/specs/2026-10-21-hogwarts-
// world-design.md §4.6), in the Invincible world’s shape (invincible/world/
// flight.js) but slower and gentler: a broom is a stick with a charm on it,
// not a Viltrumite. W leans you forward and you go, S brakes to a hover,
// A and D bank you round (the turn is the bank’s: tighter slow than fast),
// Space climbs, C sinks, Shift is flat out at 90 km/h. There is a ceiling
// (the Astronomy Tower’s height three times over) that the air thins
// toward, and a floor that lands you if you come down onto it slowly.
// Pure: the scene reads the rider and the events each step leaves in `ev`.
//
// The rider: { p: [x, y, z] (where the broom sits), yaw (forward is
// (sin, cos)), spd (forward, m/s), vy, bank (radians, right down
// positive), lean (forward, radians), mode: 'air' | 'ground', tumble
// (seconds left), roll (the tumble’s spin, for the drawing), ev }.
//
// Input: { fwd (−1…1: W 1, S −1), side (−1…1: A −1, D 1), up, down
// (0…1: Space, C), boost (Shift) }.
//
//   BROOM, mount({ x, y, z, yaw }) → a rider just up off the floor
//   stepBroom(rider, input, dt, { floorAt, solids }) → rider
//   hit(rider, dir) → a rider sent tumbling (a Bludger)
//   velocity(rider) → [x, y, z], forwardOf(yaw)

export const KMH = 1 / 3.6;
export const BROOM = {
  cruise: 50 * KMH, // W held: 50 km/h
  top: 90 * KMH, // Shift with it: flat out, 25 m/s
  accel: 6, // m/s² toward a cruise
  boostAccel: 9, // and toward flat out
  brake: 14, // S held
  drag: 2.2, // nothing held: slowing to a hover
  climb: 6, // m/s up (Space) or down (C)
  vAccel: 9,
  bank: 0.8, // radians at full A or D
  bankRate: 4, // how quickly the bank follows the key (per second)
  slowest: 5, // m/s: under this the turn is a hover’s, not a bank’s
  charm: 1.7, // a broom turns tighter than its bank alone would: the charm in it steers too
  lean: 0.35, // radians forward, flat out
  ceiling: 3 * 60, // the Astronomy Tower is about 60 m from the lawn
  thin: 20, // metres under the ceiling where the climb fades
  land: 4.5, // m/s: onto the floor slower than this and you land
  clear: 0.5, // the broom never flies lower than this over the floor
  hop: 1.2, // the hop up as you mount
  tumble: 2, // seconds of a Bludger’s tumble
  knock: 7, // m/s down it sends you
  r: 0.6, // the rider’s width from the middle, for walls
};
const G = 9.81;
const STEP = 1 / 120;

export const forwardOf = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
export const velocity = (h) => [Math.sin(h.yaw) * h.spd, h.vy, Math.cos(h.yaw) * h.spd];
const toward = (v, target, rate, dt) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mount({ x, y = 0, z, yaw = 0 }) {
  return { p: [x, y + BROOM.hop, z], yaw, spd: 0, vy: 0, bank: 0, lean: 0, mode: 'air', tumble: 0, roll: 0, ev: ['mount'] };
}

export function hit(h, dir = null) {
  const out = { ...h, tumble: BROOM.tumble, vy: -BROOM.knock, spd: h.spd * 0.4, ev: [...h.ev, 'tumble'] };
  // (knocked off the line a little, the way the Bludger was going)
  if (dir) out.yaw = h.yaw + (dir[0] * Math.cos(h.yaw) - dir[2] * Math.sin(h.yaw) > 0 ? 0.6 : -0.6);
  return out;
}

const NONE = { fwd: 0, side: 0, up: 0, down: 0, boost: false };

export function stepBroom(h, input = NONE, dt, { floorAt = () => 0, solids = [] } = {}) {
  let r = { ...h, p: [...h.p], ev: [] };
  let left = dt;
  while (left > 1e-9) {
    const d = Math.min(STEP, left);
    left -= d;
    r = slice(r, input, d, floorAt, solids);
    if (r.mode === 'ground') break;
  }
  return r;
}

function slice(h, input, dt, floorAt, solids) {
  if (h.mode === 'ground') {
    // landed: Space takes you up again; anything else is the play’s (it
    // gets you off)
    if ((input.up ?? 0) > 0) return { ...h, mode: 'air', vy: BROOM.climb * 0.6, p: [h.p[0], h.p[1] + BROOM.clear, h.p[2]], ev: [...h.ev, 'takeoff'] };
    return h;
  }
  const tumbling = h.tumble > 0;
  const i = tumbling ? NONE : input;
  const fwd = clamp(i.fwd ?? 0, -1, 1);
  const side = clamp(i.side ?? 0, -1, 1);
  const vert = clamp((i.up ?? 0) - (i.down ?? 0), -1, 1);

  // speed along the broom
  let spd = h.spd;
  if (fwd > 0) {
    const want = (i.boost ? BROOM.top : BROOM.cruise) * fwd;
    spd = spd < want ? toward(spd, want, i.boost ? BROOM.boostAccel : BROOM.accel, dt) : toward(spd, want, BROOM.drag, dt);
  } else if (fwd < 0) spd = toward(spd, 0, BROOM.brake * -fwd, dt);
  else spd = toward(spd, 0, BROOM.drag, dt);

  // the bank follows the key, and the turn follows the bank (a
  // coordinated turn: g·tan(bank)/v, which a hover would make infinite,
  // so under `slowest` it is the hover’s)
  const bank = h.bank + (side * BROOM.bank - h.bank) * Math.min(1, BROOM.bankRate * dt);
  const yawRate = (-G * BROOM.charm * Math.tan(bank)) / Math.max(spd, BROOM.slowest);
  const yaw = h.yaw + yawRate * dt;
  const lean = h.lean + ((fwd > 0 ? (i.boost ? 1 : 0.6) : fwd < 0 ? -0.4 : 0) * BROOM.lean - h.lean) * Math.min(1, 3 * dt);

  // up and down, the air thinning toward the ceiling
  let want = vert * BROOM.climb;
  const under = BROOM.ceiling - h.p[1];
  if (want > 0) want *= clamp(under / BROOM.thin, 0, 1);
  if (under < 0) want = Math.min(want, under);
  let vy = tumbling ? h.vy - G * 0.35 * dt : toward(h.vy, want, BROOM.vAccel, dt);

  const p = [h.p[0] + Math.sin(yaw) * spd * dt, h.p[1] + vy * dt, h.p[2] + Math.cos(yaw) * spd * dt];
  const ev = [...h.ev];
  const roll = tumbling ? h.roll + 9 * dt : 0;
  const tumble = Math.max(0, h.tumble - dt);
  if (tumbling && tumble === 0) ev.push('steady');

  // the floor: slow onto it and you land; fast and you skim it
  const floor = floorAt(p[0], p[2]);
  if (p[1] < floor + BROOM.clear) {
    if (vy <= 0 && spd < BROOM.land && !tumbling) {
      return { ...h, p: [p[0], floor, p[2]], yaw, spd: 0, vy: 0, bank: 0, lean: 0, mode: 'ground', tumble: 0, roll: 0, ev: [...ev, 'land'] };
    }
    if (vy < -3) ev.push('scrape');
    p[1] = floor + BROOM.clear;
    vy = Math.max(0, vy);
  }

  // stands, posts, towers: pushed out sideways, the speed lost into them
  for (const s of solids) {
    if (p[1] < (s.y0 ?? -Infinity) || p[1] > (s.y1 ?? Infinity)) continue;
    const out = pushOut(p, s);
    if (!out) continue;
    p[0] += out[0];
    p[2] += out[2];
    if (spd > 6) ev.push('bump');
    spd *= 0.3;
  }
  return { ...h, p, yaw, spd, vy, bank, lean, tumble, roll, ev };
}

// a solid is a cylinder { x, z, r } or a box { x0, x1, z0, z1 } (with
// optional y0 and y1); the push that takes the rider out of it, or null
function pushOut(p, s) {
  const R = BROOM.r;
  if (s.r != null) {
    const dx = p[0] - s.x;
    const dz = p[2] - s.z;
    const d = Math.hypot(dx, dz);
    const min = s.r + R;
    if (d >= min) return null;
    if (d < 1e-6) return [min, 0, 0];
    return [(dx / d) * (min - d), 0, (dz / d) * (min - d)];
  }
  if (p[0] < s.x0 - R || p[0] > s.x1 + R || p[2] < s.z0 - R || p[2] > s.z1 + R) return null;
  const outs = [
    [s.x0 - R - p[0], 0, 0],
    [s.x1 + R - p[0], 0, 0],
    [0, 0, s.z0 - R - p[2]],
    [0, 0, s.z1 + R - p[2]],
  ];
  return outs.reduce((a, b) => (Math.abs(a[0] + a[2]) <= Math.abs(b[0] + b[2]) ? a : b));
}
