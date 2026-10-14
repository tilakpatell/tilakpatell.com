// A check's camera round the player's body (the dev door's 'orbit'), so a
// shot sees the figure side-on or from the front while it walks, which the
// game's own third-person camera, 1.2 m behind the shoulder, never shows.
// Pure: the body's place and yaw in, a camera pose out (cameraRig.js's
// { at, lookAt, fov }).
//
//   orbitPose(body, { yaw, dist, height, look, fov, world }) → { at, lookAt, fov }
//     yaw: the camera's bearing round the body, radians, from the body's
//     facing (0 in front of it looking back, π/2 on its left side), or the
//     world's bearing (yaw 0 = +Z) with `world`; dist m out, height m up,
//     look the height on the body it looks at

export const ORBIT = { dist: 3.6, height: 1.2, look: 0.95, fov: 55 };

export function orbitPose(body, { yaw = Math.PI / 2, dist = ORBIT.dist, height = ORBIT.height, look = ORBIT.look, fov = ORBIT.fov, world = false } = {}) {
  const [x, y, z] = body.at;
  const bearing = world ? yaw : (body.yaw ?? 0) + yaw;
  return {
    at: [x + Math.sin(bearing) * dist, y + height, z + Math.cos(bearing) * dist],
    lookAt: [x, y + look, z],
    fov,
  };
}
