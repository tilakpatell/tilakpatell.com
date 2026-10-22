// Hogsmeade’s insides as data (the design’s §4.9): where each one’s front
// door lets you out into the village’s street, the Shack’s way out once its
// door is open, the passage under the Willow’s line and floor, what Every
// Flavour Beans taste of and the lines each place says. Pure, so the rooms
// (../honeydukes.js, ../broomsticks.js, ../hogshead.js, ../shack.js,
// ../tunnel.js) and their tests read the same numbers.
//
// The village’s set is built in the Map’s own frame with the street’s middle
// at its origin (rules/paths.js’s ROOM_FRAMES.hogsmeade), so a place in the
// village is its Map place less VILLAGE.at. The walk’s yaw looks along
// (−sin yaw, −cos yaw), as a camera’s does.
//
//   walkYaw([dx, dz]) → the walk’s yaw that looks along a direction
//   lookOf(yaw) → [dx, dz] the direction a walk’s yaw looks
//   streetSide(id, { out }) → { at: [x, z], yaw }: out of a building’s door into the village (its set’s frame), facing the street
//   shackFront({ out }) → { at, yaw }: down from the Shack toward the street, facing it
//   BEANS: [flavours]; beanFor(n) → one of them
//   LINES: what the places say (toasts, one sentence each)
//   TUNNEL: { points: [[x, z]], heights: [y], wide, crown }: the passage’s middle, Willow end first
//   tunnelSamples(step) → [{ at: [x, z], y, dir: [dx, dz], s }] along it
//   onTunnel(x, z) → { s (m from the Willow end), off (m from the middle line), y (the floor there) }
//   tunnelFoot() → { at, yaw }: at the ladder’s foot, coming down from the Shack
//   SHACK_ROOM: { trap, up: { at, yaw } } the Shack’s trapdoor, and where you come up beside it

import { SHACK, VILLAGE, buildingAt } from '../../rules/hogsmeade';

export const walkYaw = ([dx, dz]) => Math.atan2(-dx, -dz);
export const lookOf = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];

const local = ([x, z]) => [x - VILLAGE.at[0], z - VILLAGE.at[1]];

// out of a door: `faces` is the way out as a heading from +z (rules/hogsmeade.js)
export function streetSide(id, { out = 1.6 } = {}) {
  const b = buildingAt(id);
  if (!b) return null;
  const dir = [Math.sin(b.faces), Math.cos(b.faces)];
  const [x, z] = local(b.door);
  return { at: [x + dir[0] * out, z + dir[1] * out], yaw: walkYaw(dir) };
}

// (the nearest point of the street’s line to the Shack, and `out` metres from the Shack toward it)
export function shackFront({ out = 6 } = {}) {
  const [ux, uz] = VILLAGE.axis;
  const [sx, sz] = SHACK.at;
  const along = (sx - VILLAGE.at[0]) * ux + (sz - VILLAGE.at[1]) * uz;
  const near = [VILLAGE.at[0] + ux * along, VILLAGE.at[1] + uz * along];
  const d = Math.hypot(near[0] - sx, near[1] - sz) || 1;
  const dir = [(near[0] - sx) / d, (near[1] - sz) / d];
  const [x, z] = local([sx + dir[0] * out, sz + dir[1] * out]);
  return { at: [x, z], yaw: walkYaw(dir) };
}

// Every Flavour Beans: they mean it (the site’s own list)
export const BEANS = ['toffee', 'cut grass', 'marmalade', 'pencil shavings', 'buttered toast', 'wet dog', 'strawberry jam', 'pond water', 'treacle tart', 'earwax', 'peppermint', 'old sock', 'bonfire night', 'custard', 'mud pie', 'sherbet lemon'];
export const beanFor = (n) => BEANS[((Math.floor(Math.abs(n)) % BEANS.length) + BEANS.length) % BEANS.length];

export const LINES = {
  frog: 'The frog gets one hop in before you catch it. Its card is Merlin, who looks unimpressed.',
  beans: (flavour) => `You try one from the box. It tastes of ${flavour}.`,
  quill: 'A Sugar Quill: you can suck it in class and look as if you’re thinking.',
  trapdoor: 'The trapdoor to the cellar. Under it a passage runs all the way back to the castle and comes out behind a witch with one eye. Another day.',
  butterbeer: 'Madam Rosmerta slides a butterbeer down the bar. It warms you right through to the ears.',
  again: 'Another butterbeer, foam and all.',
  barman: 'The barman looks at you for a long moment, then goes back to wiping a glass with a cloth that makes it dirtier.',
  goatless: 'Something has been chewing the table leg.',
  open: 'Alohomora: the lock turns over, and the door drags open on the hill.',
};

// The Shack’s room (../shack.js): its trapdoor, and where you stand as you come up through it
export const SHACK_ROOM = { trap: [-2.0, -1.6], up: { at: [-1.1, -0.7], yaw: walkYaw([0.3, 1]) } };

// The passage under the Willow: from the knot at its roots (the Willow end,
// the frame’s origin) to the trapdoor in the Shack’s floor, sixty metres or
// so, bending round old stone, going down under the lawn and up the hill
export const TUNNEL = {
  points: [
    [0, 0],
    [0.8, -9],
    [-1.6, -19],
    [-0.6, -29],
    [2.4, -38],
    [4.6, -47],
    [3.2, -56],
    [2.6, -60.5],
  ],
  heights: [0, -0.9, -1.6, -1.8, -1.5, -0.6, 0.4, 0.6],
  wide: 1.25, // m either side of the middle at the floor
  crown: 2.3, // m from the floor to the roof’s top
};

// (a Catmull-Rom through the points, in two dimensions, its heights along with it)
function point(i) {
  const n = TUNNEL.points.length;
  const k = Math.min(n - 1, Math.max(0, i));
  return [...TUNNEL.points[k], TUNNEL.heights[k]];
}
function spline(t) {
  const n = TUNNEL.points.length - 1;
  const u = Math.min(n, Math.max(0, t));
  const i = Math.min(n - 1, Math.floor(u));
  const f = u - i;
  const p0 = point(i - 1);
  const p1 = point(i);
  const p2 = point(i + 1);
  const p3 = point(i + 2);
  const f2 = f * f;
  const f3 = f2 * f;
  return p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f3));
}

let cached = null;
export function tunnelSamples(step = 0.5) {
  if (cached?.step === step) return cached.list;
  const fine = [];
  const n = TUNNEL.points.length - 1;
  for (let i = 0; i <= n * 256; i++) fine.push(spline(i / 256));
  // (walked at even steps along the curve)
  const list = [];
  let s = 0;
  let next = 0;
  for (let i = 0; i < fine.length; i++) {
    if (i > 0) s += Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]);
    if (s + 1e-9 >= next || i === fine.length - 1) {
      const a = fine[Math.max(0, i - 1)];
      const b = fine[Math.min(fine.length - 1, i + 1)];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      list.push({ at: [fine[i][0], fine[i][1]], y: fine[i][2], dir: [(b[0] - a[0]) / d, (b[1] - a[1]) / d], s });
      next += step;
    }
  }
  cached = { step, list };
  return list;
}

// where the passage’s ladder comes down: a step back from its Shack end, facing back toward the Willow
export function tunnelFoot() {
  const end = tunnelSamples().at(-1);
  return { at: [end.at[0] - end.dir[0] * 1.4, end.at[1] - end.dir[1] * 1.4], yaw: walkYaw([-end.dir[0], -end.dir[1]]) };
}

export function onTunnel(x, z) {
  const list = tunnelSamples();
  let best = null;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    const ex = b.at[0] - a.at[0];
    const ez = b.at[1] - a.at[1];
    const len2 = ex * ex + ez * ez || 1;
    const k = Math.min(1, Math.max(0, ((x - a.at[0]) * ex + (z - a.at[1]) * ez) / len2));
    const px = a.at[0] + ex * k;
    const pz = a.at[1] + ez * k;
    const d = Math.hypot(x - px, z - pz);
    if (!best || d < best.off) best = { s: a.s + (b.s - a.s) * k, off: d, y: a.y + (b.y - a.y) * k };
  }
  return best;
}
