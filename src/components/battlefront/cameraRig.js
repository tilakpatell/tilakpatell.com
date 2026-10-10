// The game's camera stack under the game's world (fidelity lane C,
// src/lib/three/camera/; the sixth design's picture lane): the soldier's
// pose from cameras.json as C reads it (the arm and its pitch limits, the
// wall blend over the cast the world hands it, the ground a floor under the
// camera, the shoulder side, the aim's field from the weapon's zoom rows),
// put on three's camera by C's one rig (the recoil spring, the shake by the
// record's ShakeFactor, the audio listener). Lane 5's own soldier pose
// (camera.js) is retired from the world; its overview pose stays.
//
//   createCameraRig(camera, rows) → {
//     soldier(body, { yaw, pitch }, { aiming, weaponId, dt, castArm, floorAt }) → pose
//     set(pose), update(dt), kick(radians), shake(amount, at), listener(), state(),
//     side() → 1 | −1, swapShoulder() → the new side }
//   (rows: cameras.json's rows, the rulebook's camerasOf)

import { createCameraRig as createRig } from '../../lib/three/camera/rig.js';
import { createSoldierMemo, soldierPose } from '../../lib/three/camera/soldier.js';

export function createCameraRig(camera, rows) {
  const rig = createRig(camera, { listener: rows.soldier.listener, shake: { factor: rows.soldier.shake } });
  const memo = createSoldierMemo();
  let side = 1;
  return {
    soldier: (body, { yaw = 0, pitch = 0 } = {}, { aiming = false, weaponId = null, dt = 0, castArm = null, floorAt = null } = {}) =>
      soldierPose(body, rows, { yaw, pitch, stance: body.stance ?? 'stand', aiming, weaponId, side, dt, castArm, floorAt, memo }),
    set: (pose) => rig.set(pose),
    update: (dt) => rig.update(dt),
    kick: (radians) => rig.kick(radians),
    shake: (amount, at) => rig.shake(amount, at),
    listener: () => rig.listener(),
    state: () => rig.state(),
    side: () => side,
    swapShoulder: () => (side = -side),
  };
}
