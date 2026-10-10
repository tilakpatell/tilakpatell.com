// Three's camera put where camera.js's pose says, with the weapon's recoil
// on top as a damped spring on the pitch (the weapon row's `recoil`:
// { spring, damping }, kicked by a shot).
//
//   createCameraRig(camera, { recoil }) → { set(pose), kick(radians), update(dt), offset() }

export const RECOIL = { spring: 120, damping: 14 }; // a stiff, quickly settled kick where a weapon row has none

export function createCameraRig(camera, { recoil = RECOIL } = {}) {
  let k = recoil?.spring ?? RECOIL.spring;
  let c = recoil?.damping ?? RECOIL.damping;
  let off = 0; // radians of pitch the kick adds
  let vel = 0;
  let pose = null;
  return {
    setRecoil(r) {
      k = r?.spring ?? RECOIL.spring;
      c = r?.damping ?? RECOIL.damping;
    },
    set(p) {
      pose = p;
    },
    kick(radians) {
      vel += radians * k * 0.1;
    },
    offset: () => off,
    update(dt) {
      const h = Math.min(dt, 1 / 30);
      vel += (-k * off - c * vel) * h;
      off += vel * h;
      if (!pose) return;
      camera.position.set(pose.at[0], pose.at[1], pose.at[2]);
      const dy = Math.tan(off) * Math.hypot(pose.lookAt[0] - pose.at[0], pose.lookAt[2] - pose.at[2]);
      camera.lookAt(pose.lookAt[0], pose.lookAt[1] + dy, pose.lookAt[2]);
      if (Math.abs(camera.fov - pose.fov) > 1e-3) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
