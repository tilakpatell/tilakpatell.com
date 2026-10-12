// Three's camera put where camera.js's pose says, with the weapon's recoil
// on top: a damped spring on the yaw and the pitch whose target is the
// gun's recoil amplitude (`CameraRecoilData`: `SpringConstant 3000`,
// `SpringDamping 0.84`, the weapon row's `recoil`; bf2-re finding 34 §1),
// so the view climbs as the shots pile their kick up and comes back as the
// amplitude decays (`weapons.js`'s `recoilOf`). The damping is read as the
// spring's damping ratio (0.84 of critical on a 3000 N/m spring: it settles
// in about 0.1 s with no overshoot to speak of).
//
//   createCameraRig(camera, { recoil }) → { set(pose), aim([yaw, pitch]), kick(radians), update(dt), offset() → { yaw, pitch } }

export const RECOIL = { spring: 3000, damping: 0.84 }; // the rifles' CameraRecoilData, where a weapon row has none
const MAX_H = 1 / 240; // s: the spring's substep (3000 N/m is stiff: a whole frame at 60 Hz would overshoot)

export function createCameraRig(camera, { recoil = RECOIL } = {}) {
  let k = recoil?.spring ?? RECOIL.spring;
  let zeta = recoil?.damping ?? RECOIL.damping;
  const off = [0, 0]; // radians the recoil adds: yaw (the sim's frame, + toward +X at yaw 0), pitch (up positive)
  const vel = [0, 0];
  const target = [0, 0];
  let pose = null;
  return {
    setRecoil(r) {
      k = r?.spring ?? RECOIL.spring;
      zeta = r?.damping ?? RECOIL.damping;
    },
    set(p) {
      pose = p;
    },
    // the gun's recoil amplitude this frame: where the spring pulls to
    aim([yaw, pitch]) {
      target[0] = yaw;
      target[1] = pitch;
    },
    // a one-off impulse (a check, or a weapon with no amplitude of its own)
    kick(radians) {
      vel[1] += radians * Math.sqrt(k);
    },
    offset: () => ({ yaw: off[0], pitch: off[1] }),
    update(dt) {
      let left = Math.min(dt, 1 / 30);
      const c = 2 * zeta * Math.sqrt(k);
      while (left > 0) {
        const h = Math.min(left, MAX_H);
        left -= h;
        for (let i = 0; i < 2; i++) {
          vel[i] += (-k * (off[i] - target[i]) - c * vel[i]) * h;
          off[i] += vel[i] * h;
        }
      }
      if (!pose) return;
      camera.position.set(pose.at[0], pose.at[1], pose.at[2]);
      const dx = pose.lookAt[0] - pose.at[0];
      const dz = pose.lookAt[2] - pose.at[2];
      const flat = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz) + off[0];
      const dy = Math.tan(off[1]) * flat;
      camera.lookAt(pose.at[0] + Math.sin(yaw) * flat, pose.lookAt[1] + dy, pose.at[2] + Math.cos(yaw) * flat);
      if (Math.abs(camera.fov - pose.fov) > 1e-3) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
