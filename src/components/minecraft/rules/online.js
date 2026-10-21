// Where you are in a world, to the others online (Minecraft.jsx's
// useTravellers, middleearth/towns/travellers.js). A world is its seed, so
// each seed is an area of its own: only those in the same world are
// listed. The room's link keeps a height from naught to 80 m, and a world
// runs from 40 blocks to 160, so the height sent is over the world's own
// ground (its generator's, the same for everyone on the seed: `ground` is
// game.gen.height), which the scene puts back; a cave puts you on the
// ground over it, and a tower or a jump counts. Pure: the module sends
// what this gives each step you play.
//
//   areaOf(seed) → 'mc-…'
//   stepOf(player, ground(x, z), seed) → [h, flags] for the link's pose(h, flags)

const TICKS = 20; // a second's ticks: the velocities are blocks a tick
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const areaOf = (seed) => `mc-${(Number(seed) >>> 0).toString(36)}`;
// where your feet stand on the ground at (x, z): on top of its highest block
export const ABOVE = (ground, x, z) => ground(Math.floor(x), Math.floor(z)) + 1;

export function stepOf(p, ground, seed) {
  // (naught looks along −z and a yaw turns left; a figure turned by `face` looks along (sin, cos))
  const face = wrap(p.yaw + Math.PI);
  return [{ x: p.x, y: Math.max(0, p.y - ABOVE(ground, p.x, p.z)), z: p.z, face, speed: Math.hypot(p.vx ?? 0, p.vz ?? 0) * TICKS }, { area: areaOf(seed) }];
}
