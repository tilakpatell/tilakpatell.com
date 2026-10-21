// Where he is to the other players online, and where they are, back again:
// the room's numbers (middleearth/towns/travellers) for a flyer who leaves
// the city for the Moon and Mars. Moved from InvWorld.jsx as it was.
import { BODIES, SPACE } from './orbit';
import { WATER_Y, WORLD, groundAt } from './map';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));


// Where he is to the other players online (middleearth/towns/travellers),
// and where they are, back again. The room carries x and z to ±3200 m (the
// city's edge), how fast to 45 m/s (flat out, past that) and how high to
// 80 m; he flies to 9 km, and on out to the Moon and Mars. So in the city
// it's x and z, and his height over the land or the water as a log (to a
// couple of centimetres on the ground, metres up where the air runs out);
// in space, round whichever of the Earth, the Moon and Mars he's nearest
// (an area each: each is its own ground), the way to him from its middle as
// two angles (×1000: π fits in 3200; to a few centimetres on the Moon) and
// his height over it, as a log again. ./scene.js draws them where this puts them.
export const ROOM = { bound: WORLD.half, motion: true };
const ROUND = [{ id: 'earth', c: [0, 0, 0], r: SPACE.RE }, ...BODIES];
const DEEP = SPACE.bound * 2; // (as far over any of them as he gets)
const upY = (y, top) => (80 * Math.log1p(Math.max(0, y) / 20)) / Math.log1p(top / 20);
const downY = (v, top) => 20 * Math.expm1((v * Math.log1p(top / 20)) / 80);
export const over = (p, b) => Math.hypot(p[0] - b.c[0], p[1] - b.c[1], p[2] - b.c[2]) - b.r;
export const nearest = (p) => ROUND.reduce((a, q) => (over(p, q) < over(p, a) ? q : a));
export function seenAs(h, speed) {
  const face = wrap(h.face);
  if (h.zone !== 'space') return [{ x: h.p[0], z: h.p[2], face, speed, y: upY(h.p[1] - Math.max(groundAt(h.p[0], h.p[2]), WATER_Y), WORLD.ceiling) }, 'city'];
  const b = nearest(h.p);
  const d = h.p.map((v, i) => v - b.c[i]);
  const r = Math.hypot(...d) || 1;
  return [{ x: Math.atan2(d[0], d[2]) * 1000, z: Math.asin(clamp(d[1] / r, -1, 1)) * 1000, face, speed, y: upY(r - b.r, DEEP) }, `space-${b.id}`];
}
export function placeOf(p) {
  const b = ROUND.find((q) => p.area === `space-${q.id}`);
  if (!b) return { ...p, y: downY(p.y ?? 0, WORLD.ceiling) };
  // (in space: where they are, which way's up there, and how high over it they are)
  const lon = p.x / 1000;
  const lat = p.z / 1000;
  const up = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  const high = downY(p.y ?? 0, DEEP);
  return { ...p, x: b.c[0] + up[0] * (b.r + high), y: b.c[1] + up[1] * (b.r + high), z: b.c[2] + up[2] * (b.r + high), up, over: high };
}

// What was kept from last time, read so that nothing kept can break the
// world (an old version's shape, a hand-edited value, a half-written one):
// a time of day that isn't one is noon, and quests that can't be read are
