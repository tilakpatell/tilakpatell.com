// A vehicle on a rail of waypoints, as the game drives its AT-AT (bf2-re
// finding 45, section 4.1): the route is a polyline (`AIWaypointsShapeData`,
// a `FollowWaypointsEntityData` of `RouteStop` with no path finding), and a
// `SimpleDriverComponentData` steers toward the next waypoint with a PI
// controller on the heading error (`PValue`, `IValue`), going on to the one
// after once inside `ReachWaypointRadius`, forward only. Its output is not
// a force: it asks the walk clip to turn, and the clip's root motion is the
// speed. So here the body goes forward at the walk's own pace (the clip's
// travel over its length) and turns no faster than the turning cycle turns
// (its trajectory's yaw over its length), so the drawn feet never slide.
// Pure.
//
//   createRail(points, { reach, p, i, speed, turn }) → rail
//     points: [[x, y, z]…]; speed m/s; turn rad/s (the most it turns)
//   stepRail(rail, body, dt, { go }) → { moved, yawRate }   body: { at, yaw }
//     (go false: it stands; at the last waypoint it stops, rail.done)
//   railLength(points) → metres on the ground     along(points, d) → { at, yaw }
//   progressOf(rail, body) → metres along the route (the escort's meter)

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function railLength(points) {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]);
  return n;
}

// the point `dist` metres along the polyline, and its heading there
export function along(points, dist) {
  let left = dist;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (left <= L || i === points.length - 1) {
      const t = L > 0 ? Math.min(1, left / L) : 1;
      return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    left -= L;
  }
  return { at: [...points[0]], yaw: 0 };
}

export function createRail(points, { reach = 15, p = 10, i = 1, speed = 1, turn = Math.PI / 8 } = {}) {
  if (!points?.length) throw new Error('a rail needs its waypoints');
  // (the cumulative length at each waypoint, for the meter)
  const at = [0];
  for (let k = 1; k < points.length; k++) at.push(at[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][2] - points[k - 1][2]));
  return { points, cumulative: at, length: at[at.length - 1], next: Math.min(1, points.length - 1), integral: 0, reach, p, i, speed, turn, done: points.length < 2 };
}

export function stepRail(rail, body, dt, { go = true } = {}) {
  if (rail.done || !go || dt <= 0) return { moved: 0, yawRate: 0 };
  // (inside the reach of the next waypoint: on to the one after; the last one is the stop)
  let target = rail.points[rail.next];
  while (Math.hypot(target[0] - body.at[0], target[2] - body.at[2]) <= rail.reach) {
    if (rail.next >= rail.points.length - 1) {
      rail.done = true;
      return { moved: 0, yawRate: 0 };
    }
    rail.next++;
    target = rail.points[rail.next];
  }
  const err = wrap(Math.atan2(target[0] - body.at[0], target[2] - body.at[2]) - body.yaw);
  // (the PI's sum, held so its share alone can never ask more than the turn)
  const cap = rail.i > 0 ? rail.turn / rail.i : 0;
  rail.integral = Math.max(-cap, Math.min(cap, rail.integral + err * dt));
  const yawRate = Math.max(-rail.turn, Math.min(rail.turn, rail.p * err + rail.i * rail.integral));
  body.yaw = wrap(body.yaw + yawRate * dt);
  const d = rail.speed * dt;
  body.at[0] += Math.sin(body.yaw) * d;
  body.at[2] += Math.cos(body.yaw) * d;
  return { moved: d, yawRate };
}

// how far along the route the body is: the waypoint behind it plus its
// shadow on the leg it walks (never back past where it was)
export function progressOf(rail, body) {
  if (rail.done) return rail.length;
  const k = Math.max(1, rail.next);
  const a = rail.points[k - 1];
  const b = rail.points[k];
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const L = Math.hypot(dx, dz) || 1;
  const t = Math.max(0, Math.min(1, ((body.at[0] - a[0]) * dx + (body.at[2] - a[2]) * dz) / (L * L)));
  return Math.min(rail.length, rail.cumulative[k - 1] + t * L);
}
