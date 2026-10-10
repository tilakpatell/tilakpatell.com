// The soldier's third-person camera, from the game's rows
// (src/data/bf2017/cameras.json's `soldier`: SoldierCameraComponentData and
// SoldierThirdPersonCameraData). Pure: plain vectors in, a pose out; no
// three.js. rig.js puts the pose on a camera.
//
//   soldierPose(state, rows, { yaw, pitch, stance, aiming, weaponId, level,
//     side, height, dt, castArm(from, dir, len) → dist | null, floorAt(x, z) → y | null,
//     memo }) → { at, lookAt, fov, roll, arm, pitch, cull }
//   armFor(row, pitchDeg) → the arm's length before any wall (m)
//   cullFor(row, stance) → how near the camera may come before the player's
//     own body fades (m)
//   createSoldierMemo() → the state soldierPose keeps between frames
//
// state: the soldier, `{ at: [x, y, z] }` (the feet) or `{ x, y, z }`.
// yaw: radians, the way the soldier looks over the ground, forward
//   [sin yaw, 0, cos yaw] (the galaxy's walker's).
// pitch: radians, positive looks up (the game's), clamped to ±maxPitch.
// The arm `arm` long behind the pivot, a shoulder's width to `side` (1 the
// right, −1 the left); looking up past `reducedArm.minPitch` the arm draws in
// toward `reducedArm.length` (all of it at `reducedArm.maxPitch`), as the
// camera nears the ground under the soldier.
// The wall: each frame the arm is cast from the pivot toward where the
// camera wants to be; a hit draws the arm in to the hit less
// `collision.padding`, blended at `collision.blendIn` per second, and back
// out at `collision.blendOut` when the hit goes; whatever the blend, the
// camera is never past the hit less WALL_CLEAR, so nothing clips while it
// blends. The ground's height under the camera is a floor (the padding
// over it).
// No roll: the up is the world's at every yaw (pitch never reaches the pole).

import { aimFov } from './aim';

// (hand: the nearest the camera comes to a wall down its arm while the
// blend catches up with the padding; the wall is behind the camera there,
// out of the near plane's way, and a larger hard limit passes the body's
// flutter against a wall straight to the camera at a grazing angle)
export const WALL_CLEAR = 0.02;
// (hand: the pivot over the feet by stance; the game hangs the arm on the
// skeleton's hips, which the rows don't carry. Stand is the galaxy walker's
// 1.55, so the camera stands where it did)
export const PIVOT = { stand: 1.55, crouch: 1.1, prone: 0.4, dead: 0.3 };
// (hand: the shoulder's offset to the side; the game's
// ThirdPersonCameraOffset is not in the export)
export const SHOULDER = 0.35;

const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v) => Number.isFinite(v);
// (frame-rate free: the share of the gap closed in dt at `rate` per second)
export const blendK = (rate, dt) => 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));

export function armFor(row, pitchDeg) {
  const r = row.reducedArm;
  if (!r) return row.arm;
  const t = r.maxPitch > r.minPitch ? clamp((pitchDeg - r.minPitch) / (r.maxPitch - r.minPitch), 0, 1) : 0;
  // (the record's MaxReducedArmLength is metres: the arm reaches it at ReduceMaxPitch)
  return row.arm + (r.length - row.arm) * t;
}

export function cullFor(row, stance = 'stand') {
  return row.cull?.[stance] ?? row.cull?.stand ?? 0;
}

export function createSoldierMemo() {
  return { len: null, zoom: {} };
}

const feetOf = (s) => (Array.isArray(s?.at) ? s.at : [s?.x ?? 0, s?.y ?? 0, s?.z ?? 0]);

export function soldierPose(state, rows, { yaw = 0, pitch = 0, stance = 'stand', aiming = false, weaponId = null, level = 0, side = 1, height = null, dt = 0, castArm = null, floorAt = null, memo = createSoldierMemo() } = {}) {
  const row = rows.soldier;
  const max = row.maxPitch * RAD;
  const p = clamp(fin(pitch) ? pitch : 0, -max, max);
  const y = fin(yaw) ? yaw : 0;
  const feet = feetOf(state);
  const lift = fin(height) ? height : (PIVOT[stance] ?? PIVOT.stand);
  // the look's way, and the right of it over the ground
  const cp = Math.cos(p);
  const d = [Math.sin(y) * cp, Math.sin(p), Math.cos(y) * cp];
  const right = [-Math.cos(y), 0, Math.sin(y)];
  const s = (side < 0 ? -1 : 1) * SHOULDER;
  const pivot = [feet[0], feet[1] + lift, feet[2]];
  const arm = armFor(row, p / RAD);
  const want = [pivot[0] + right[0] * s - d[0] * arm, pivot[1] - d[1] * arm, pivot[2] + right[2] * s - d[2] * arm];
  const ray = [want[0] - pivot[0], want[1] - pivot[1], want[2] - pivot[2]];
  const full = Math.hypot(ray[0], ray[1], ray[2]) || 1e-6;
  const dir = [ray[0] / full, ray[1] / full, ray[2] / full];
  // the wall: what the cast says this frame (undefined: no answer this
  // frame, so the last hit stands)
  // (cast past the camera by the padding: a wall coming into reach is met
  // at the arm's full length, not snapped to from it)
  const raw = castArm ? castArm(pivot, dir, full + row.collision.padding) : null;
  const hit = raw === undefined ? memo.hit ?? null : fin(raw) ? raw : raw && fin(raw.dist) ? raw.dist : null;
  memo.hit = hit;
  const target = hit == null ? full : clamp(hit - row.collision.padding, 0, full);
  if (!fin(memo.len)) memo.len = target;
  const rate = target < memo.len ? row.collision.blendIn : row.collision.blendOut;
  memo.len += (target - memo.len) * blendK(rate, dt);
  // (never past the wall, whatever the blend)
  const len = hit == null ? memo.len : Math.min(memo.len, Math.max(0, hit - WALL_CLEAR));
  const at = [pivot[0] + dir[0] * len, pivot[1] + dir[1] * len, pivot[2] + dir[2] * len];
  // the ground is a floor for the arm
  const ground = floorAt ? floorAt(at[0], at[2]) : null;
  if (fin(ground)) at[1] = Math.max(at[1], ground + row.collision.padding);
  // (the view is the look's way exactly, wherever the wall put the camera)
  const lookAt = [at[0] + d[0], at[1] + d[1], at[2] + d[2]];
  const fov = aimFov(memo.zoom, rows, dt, { aiming, weaponId, level });
  return { at, lookAt, fov, roll: 0, arm: len, pitch: p, cull: cullFor(row, stance) };
}
