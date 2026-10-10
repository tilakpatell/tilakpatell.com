// The deploy and outro cameras: a level's placed CameraEntityData
// (src/data/bf2017/maps/<map>.json's `cameras`: at, yaw, pitch, focalLength,
// aperture, by mode), the one facing the objective. Pure: no three.js.
//
//   cameraForward(row) → [x, y, z] (unit)
//   overviewPose(cameras, objective, { mode }) → { at, lookAt, fov, roll, id, dof } | null
//     objective: [x, y, z] or { at: [x, y, z] }
//
// The lens: the row's own fov when it has one, else its focal length on a
// 36 mm frame (35 mm: 2 atan(18 / 35), 54.4°). The pick: of the mode's
// cameras (all of them when the mode has none), the one whose forward points
// nearest the objective's centre. The depth of field rides along for the
// deploy screen (cinematic.js's `dofFor`).

import { lensToDof, lensToFov } from './cinematic';

// (hand: a row with neither a field nor a lens: the game's default)
const FOV_FALLBACK = 70;

// (the record's yaw from +z toward +x and its pitch down from level: the
// placed cameras sit over the ground looking down at the field)
export function cameraForward(row) {
  const yaw = row.yaw ?? 0;
  const pitch = row.pitch ?? 0;
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp];
}

export function overviewPose(cameras, objective, { mode = null } = {}) {
  const goal = Array.isArray(objective) ? objective : objective?.at;
  const ofMode = (cameras ?? []).filter((c) => !mode || c.mode === mode);
  const list = ofMode.length ? ofMode : (cameras ?? []);
  if (!list.length) return null;
  let best = list[0];
  let bestDot = -Infinity;
  if (goal) {
    for (const c of list) {
      const f = cameraForward(c);
      const to = [goal[0] - c.at[0], goal[1] - c.at[1], goal[2] - c.at[2]];
      const l = Math.hypot(...to) || 1;
      const dot = (f[0] * to[0] + f[1] * to[1] + f[2] * to[2]) / l;
      if (dot > bestDot) {
        bestDot = dot;
        best = c;
      }
    }
  }
  const f = cameraForward(best);
  const at = [...best.at];
  const fov = best.fov > 0 ? best.fov : (lensToFov(best.focalLength) ?? FOV_FALLBACK);
  return { at, lookAt: [at[0] + f[0], at[1] + f[1], at[2] + f[2]], fov, roll: 0, id: best.id, dof: lensToDof(best) };
}
