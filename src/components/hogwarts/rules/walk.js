// Walking on foot: a first-year's pace, a run, the look a drag turns, and a
// capsule that goes round what stands in its way, stops at the water's edge
// (a paddle, never a swim) and keeps inside the grounds. Pure: the world's
// play/walk.js reads the keys and the stick into `input` and draws the
// camera where this says. Yaw 0 looks down −z, as three's camera does;
// yaw grows turning left.
//
//   WALK → the numbers
//   startWalk([x, z], yaw) → state { x, z, yaw, pitch, vx, vz, speed }
//   look(state, dx, dy) → state, turned by a drag of dx, dy pixels
//   stepWalk(state, input, dt, world) → state
//     input  { forward (−1…1), strafe (−1…1, + right), run }
//     world  { floorAt(x, z), level, bounds: { x0, x1, z0, z1 }, solids: [{ at: [x, z], r }], pace? (0…1 of the stride) }
//   ahead(yaw) → [x, z]: the way you face, along the ground

export const WALK = {
  speed: 2.4, // m/s, a walk
  run: 5.2, // m/s with Shift, or the stick pushed all the way
  accel: 9, // how quickly the pace comes and goes (1/s)
  radius: 0.35, // m: the capsule's
  eye: 1.45, // m over the floor: an eleven-year-old's
  wade: 0.3, // m: the deepest water you walk into
  turn: 0.0032, // radians a pixel of drag
  pitch: [-1.15, 1.05], // the look's limits, down and up
};

export const ahead = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const right = (yaw) => [Math.cos(yaw), -Math.sin(yaw)];

export const startWalk = ([x, z], yaw = 0) => ({ x, z, yaw, pitch: 0, vx: 0, vz: 0, speed: 0 });

export function look(s, dx = 0, dy = 0) {
  const pitch = Math.min(WALK.pitch[1], Math.max(WALK.pitch[0], s.pitch - dy * WALK.turn));
  return { ...s, yaw: s.yaw - dx * WALK.turn, pitch };
}

// out of every circle it's in, along the line from the circle's middle
function pushOut(x, z, solids, r) {
  for (let round = 0; round < 3; round++) {
    let moved = false;
    for (const s of solids) {
      const dx = x - s.at[0];
      const dz = z - s.at[1];
      const d = Math.hypot(dx, dz);
      const min = s.r + r;
      if (d >= min) continue;
      const k = d > 1e-6 ? min / d : 0;
      x = d > 1e-6 ? s.at[0] + dx * k : s.at[0] + min;
      z = d > 1e-6 ? s.at[1] + dz * k : z;
      moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}

const dry = (world, x, z) => world.floorAt(x, z) >= (world.level ?? 0) - WALK.wade;
const inside = (b, x, z) => !b || (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);

export function stepWalk(s, input = {}, dt = 0, world) {
  const f = Math.max(-1, Math.min(1, input.forward ?? 0));
  const st = Math.max(-1, Math.min(1, input.strafe ?? 0));
  const len = Math.hypot(f, st);
  // (a diagonal is no faster than straight on)
  const n = len > 1 ? 1 / len : 1;
  // (the world can hold you back: the dementors’ cold, world.pace a share of your stride)
  const pace = (input.run ? WALK.run : WALK.speed) * Math.max(0, Math.min(1, world?.pace ?? 1));
  const [ax, az] = ahead(s.yaw);
  const [rx, rz] = right(s.yaw);
  const wx = (ax * f + rx * st) * n * pace;
  const wz = (az * f + rz * st) * n * pace;
  const k = Math.min(1, WALK.accel * dt);
  let vx = s.vx + (wx - s.vx) * k;
  let vz = s.vz + (wz - s.vz) * k;
  let x = s.x;
  let z = s.z;
  // each way on its own, so a wall of water or the grounds' edge is slid
  // along rather than stuck to
  const tryMove = (nx, nz) => {
    const [px, pz] = pushOut(nx, nz, world.solids ?? [], WALK.radius);
    if (!inside(world.bounds, px, pz) || !dry(world, px, pz)) return false;
    x = px;
    z = pz;
    return true;
  };
  if (!tryMove(x + vx * dt, z + vz * dt)) {
    const slidX = tryMove(x + vx * dt, z);
    const slidZ = tryMove(x, z + vz * dt);
    if (!slidX) vx = 0;
    if (!slidZ) vz = 0;
  }
  return { ...s, x, z, vx, vz, speed: Math.hypot(vx, vz) };
}
