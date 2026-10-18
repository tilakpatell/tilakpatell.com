// The camera kept out of the walls behind him (split out of ./scene.js as a
// repair): how far it can go back before a tower, and the ways round him it
// swings when one's right behind him.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a ray against a box: how far along (0…1) it first goes in, or 1
export function rayBox(o, d, b) {
  let t0 = 0;
  let t1 = 1;
  const lo = [b.x0, b.y0, b.z0];
  const hi = [b.x1, b.y1, b.z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return 1;
      continue;
    }
    let ta = (lo[a] - o[a]) / d[a];
    let tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return 1;
  }
  return t0;
}

// how far (0…1) along `back` from `anchor` the camera can go before a wall
// (`list`: the buildings round him, each kept 0.4 m off). One he's hugging
// is kept off only as far as leaves 0.15 m round the anchor: he hovers as
// near as FLY.R (0.45 m) to a face (./flight.js's collide), and from
// there, with a whole 0.4 m kept off, every way out but straight along
// the wall would end a few centimetres from him. So the camera can still
// go along a wall or away from it, and never nearer its face than 0.3 m.
export function clearOf(list, anchor, back) {
  let t = 1;
  for (const b of list) {
    const out = Math.hypot(Math.max(b.x0 - anchor[0], 0, anchor[0] - b.x1), Math.max(b.y0 - anchor[1], 0, anchor[1] - b.y1), Math.max(b.z0 - anchor[2], 0, anchor[2] - b.z1));
    const m = clamp(out - 0.15, 0, 0.4);
    t = Math.min(t, rayBox(anchor, back, { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m, z0: b.z0 - m, z1: b.z1 + m }));
  }
  return t;
}

// Where it goes when a wall's right behind him (hovering against a tower,
// or by one on a roof): round him to one side or the other, or up over
// him, whichever gets furthest from him for the least turn, rather than
// closing in until it's inside his head. The last two go square to his
// back, along the wall: with his back flat to it, every other way runs
// into its face within a few centimetres. [turn about the up axis, rise, cost in metres]
export const SWINGS = [
  [0.5, 0, 0.8],
  [-0.5, 0, 0.8],
  [1, 0, 1.6],
  [-1, 0, 1.6],
  [0, 0.85, 1.4],
  [1.5, 0, 2.6],
  [-1.5, 0, 2.6],
  [0, 1.4, 2.4],
  [Math.PI / 2, 0, 3],
  [-Math.PI / 2, 0, 3],
];
export const TIGHT = 2.6; // (metres: closer than this, the camera swings; it comes back once the line behind him is clear to 3.6)
const swung = [0, 0, 0];
export function swing(back, [turn, rise], up) {
  // (round the up axis, then lifted toward it, kept the same length)
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const l = Math.hypot(...back);
  let x = back[0] * c + back[2] * s;
  let y = back[1];
  let z = -back[0] * s + back[2] * c;
  if (rise) {
    x = x * (1 - rise * 0.6) + up.x * l * rise;
    y = y * (1 - rise * 0.6) + up.y * l * rise;
    z = z * (1 - rise * 0.6) + up.z * l * rise;
  }
  const k = l / (Math.hypot(x, y, z) || 1);
  swung[0] = x * k;
  swung[1] = y * k;
  swung[2] = z * k;
  return swung;
}
