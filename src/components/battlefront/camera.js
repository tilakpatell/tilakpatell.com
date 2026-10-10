// The game's cameras (the game design's decision 13), as poses: pure, from
// a body's state, the player's look and the records in cameras.json (the
// trooper's SoldierThirdPersonCameraData and SoldierCameraComponentData, the
// weapons' zoom levels, each vehicle's transformer chain) and the level's
// CameraEntityData in maps/<level>.json. cameraRig.js puts three's camera
// where a pose says.
//
//   soldierPose(body, cam, { yaw, pitch, aiming, weaponId, dt, prev, castArm, shoulder })
//     → { at, lookAt, pivot, fov, arm, pitch }   (prev: the last answer, for the eases)
//   vehiclePose(vehicle, seat, look, dt, prev) → { at, lookAt, fov, yaw, pitch }
//   overviewPose(map, towards, { mode }) → { id, at, lookAt, fov }
//
// Angles in radians, the records' in degrees. The frame is the export's:
// yaw 0 looks down +Z, pitch up is positive.

const RAD = Math.PI / 180;

// What the records do not hold, by hand:
export const FOV_DEFAULT = 70; // degrees: the game's base field-of-view option's default
export const SHOULDER = 0.45; // m: the camera's offset to the shoulder side (the record holds the side, not the offset)
export const PIVOT = { stand: 1.55, crouch: 1.05, prone: 0.35, dead: 0.2 }; // m above the feet the arm turns about (a trooper's shoulder line)
export const AIM_AHEAD = 30; // m ahead the camera looks at
export const VEHICLE_ARM = 14; // m: a walker's or a speeder's camera arm until lane 4 brings their own
// 35 mm on a 36 mm frame (the level's CameraEntityData: FocalLength 35)
export const OVERVIEW_FOV = (2 * Math.atan(18 / 35)) / RAD;

const lookDir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const rightOf = (yaw) => [-Math.cos(yaw), 0, Math.sin(yaw)];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// the arm at a pitch: the full length to the reduced one's lower pitch,
// then down to the reduced length by its upper pitch
export function armAt(s, pitch) {
  const p = Math.abs(pitch) / RAD;
  const { length, minPitch, maxPitch } = s.reducedArm;
  const t = clamp((p - minPitch) / (maxPitch - minPitch), 0, 1);
  return s.arm + (length - s.arm) * t;
}

// toward a target by a share of the gap a second (the record's blend rates)
const blend = (from, to, rate, dt) => from + (to - from) * Math.min(1, rate * dt);
// toward a target at a fixed speed (degrees a second)
const step = (from, to, speed, dt) => (Math.abs(to - from) <= speed * dt ? to : from + Math.sign(to - from) * speed * dt);

export function soldierPose(body, cam, { yaw = 0, pitch = 0, aiming = false, weaponId = null, dt = 0, prev = null, castArm = null, shoulder = 1 } = {}) {
  const s = cam.soldier;
  const p = clamp(pitch, -s.maxPitch * RAD, s.maxPitch * RAD);
  const pivot = add(body.at, [0, PIVOT[body.stance] ?? PIVOT.stand, 0]);
  const side = add(pivot, rightOf(yaw), SHOULDER * shoulder);
  const dir = lookDir(yaw, p);
  const want = armAt(s, p);
  const hit = castArm ? castArm(side, dir.map((v) => -v), want) : null;
  const target = hit == null ? want : Math.max(0, Math.min(want, hit - s.collision.padding));
  const was = prev?.arm ?? target;
  const eased = target < was ? blend(was, target, s.collision.blendIn, dt) : blend(was, target, s.collision.blendOut, dt);
  // (the ease is the record's, but never past what the ray hit: the camera
  // never goes inside the wall while it blends in)
  const arm = hit == null ? eased : Math.min(eased, hit);
  const zoom = (aiming && weaponId && cam.aim?.[weaponId]?.[0]) || null;
  const fovTo = zoom ? zoom.fov : FOV_DEFAULT;
  const fovFrom = prev?.fov ?? fovTo;
  const firstZoom = Object.values(cam.aim ?? {})[0]?.[0];
  const seconds = Math.max(1e-3, (aiming ? (zoom ?? firstZoom)?.zoomIn : (zoom ?? firstZoom)?.zoomOut) ?? 0.25);
  const span = Math.abs(FOV_DEFAULT - (zoom?.fov ?? firstZoom?.fov ?? FOV_DEFAULT)) || 1;
  const fov = prev ? step(fovFrom, fovTo, span / seconds, dt) : fovTo;
  return { at: add(side, dir, -arm), lookAt: add(side, dir, AIM_AHEAD), pivot, fov, arm, pitch: p };
}

// A seat's camera: its pitch held in the seat's limits, the turn carried
// with the seat's inertia (the share kept a frame at 60 Hz, with input
// and without)
export function vehiclePose(vehicle, seat, look, dt, prev) {
  const [lo, hi] = seat.pitch ?? [-35, 35];
  const pitch = clamp(look.pitch ?? 0, lo * RAD, hi * RAD);
  const k = (look.turning ? seat.inertia?.input : seat.inertia?.none) ?? 0;
  const keep = Math.pow(k, dt * 60);
  const yaw = prev ? prev.yaw * keep + (look.yaw ?? 0) * (1 - keep) : (look.yaw ?? 0);
  const dir = lookDir(yaw + (vehicle.yaw ?? 0), pitch);
  const centre = add(vehicle.at, [0, VEHICLE_ARM * 0.3, 0]);
  return { at: add(centre, dir, -VEHICLE_ARM), lookAt: add(centre, dir, AIM_AHEAD), fov: FOV_DEFAULT, yaw, pitch };
}

// The level's own overview cameras for a mode: the one whose forward points
// nearest the place asked about (the live objective's centre)
export function overviewPose(map, towards, { mode = 'galacticAssault' } = {}) {
  let best = null;
  let bestDot = -Infinity;
  for (const c of map.cameras ?? []) {
    if (mode && c.mode && c.mode !== mode) continue;
    const f = lookDir(c.yaw, c.pitch);
    const d = [towards[0] - c.at[0], towards[1] - c.at[1], towards[2] - c.at[2]];
    const n = Math.hypot(...d) || 1;
    const dot = (f[0] * d[0] + f[1] * d[1] + f[2] * d[2]) / n;
    if (dot > bestDot) {
      bestDot = dot;
      best = c;
    }
  }
  if (!best) return null;
  return { id: best.id, at: best.at.slice(), lookAt: add(best.at, lookDir(best.yaw, best.pitch), AIM_AHEAD * 10), fov: best.fov > 0 ? best.fov : OVERVIEW_FOV };
}
