// Where a place's crowd is (./crowd.js draws them, as instances): pure, no
// three.js.
//
// loopLengths(loop) → { lengths, total }   a closed loop's sides, last back to first
// walkerAt(loop, lengths, total, speed, t, phase, out) → out { x, z, yaw, bob, sway }
//   on its loop at time t, `phase` (0…1) of the way round at t = 0; facing
//   along its side as rules.js measures it (east 0, north π/2); bobbing and
//   swaying in its step, a step every STEP seconds
// gatherAt(at, r, i, n, face, seed) → { x, z, yaw }
//   the i-th of a gathering of n in a disc of radius r round `at`, turned to
//   `face` (a point it watches), each looking a little off it
// hopOf(t, since, i) → metres   a hop on the beat at `since`, rippling out by i

export const STEP = 0.55; // seconds a step: two to a stride
const BOB = 0.035; // metres up and down
const SWAY = 0.05; // radians side to side
const HOP = { len: 0.6, high: 0.11, spread: 0.012 };

export function loopLengths(loop) {
  const lengths = loop.map(([ax, az], i) => {
    const [bx, bz] = loop[(i + 1) % loop.length];
    return Math.hypot(bx - ax, bz - az);
  });
  return { lengths, total: lengths.reduce((a, b) => a + b, 0) };
}

export function walkerAt(loop, lengths, total, speed, t, phase, out) {
  let s = (((phase * total + speed * t) % total) + total) % total;
  let i = 0;
  while (i < lengths.length - 1 && s > lengths[i]) s -= lengths[i++];
  const [ax, az] = loop[i];
  const [bx, bz] = loop[(i + 1) % loop.length];
  const k = lengths[i] > 0 ? s / lengths[i] : 0;
  out.x = ax + (bx - ax) * k;
  out.z = az + (bz - az) * k;
  out.yaw = Math.atan2(-(bz - az), bx - ax);
  const step = (t / STEP) * Math.PI;
  out.bob = Math.abs(Math.sin(step)) * BOB;
  out.sway = Math.sin(step) * SWAY;
  return out;
}

// (a sunflower's spiral: evenly spread in the disc, none on top of another)
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const hash = (i, k) => (((Math.sin(i * 91.345 + k * 47.853) * 43758.5453) % 1) + 1) % 1;
export function gatherAt(at, r, i, n, face, seed) {
  const d = r * Math.sqrt((i + 0.5) / Math.max(1, n));
  const a = i * GOLDEN + seed;
  const x = at[0] + Math.cos(a) * d;
  const z = at[1] + Math.sin(a) * d;
  const yaw = Math.atan2(-(face[1] - z), face[0] - x) + (hash(i, seed) - 0.5) * 0.5;
  return { x, z, yaw };
}

export function hopOf(t, since, i) {
  if (since == null) return 0;
  const k = (t - since - i * HOP.spread) / HOP.len;
  if (k <= 0 || k >= 1) return 0;
  return Math.sin(k * Math.PI) * HOP.high;
}
