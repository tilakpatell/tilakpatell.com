// One rig: the one place a pose (soldier.js, aim.js, vehicle.js,
// overview.js) goes onto a three.js PerspectiveCamera, with the recoil, the
// shake and the audio listener on top. It calls only the camera's own
// methods, so it imports nothing of three itself.
//
//   createCameraRig(camera, { recoil = RECOIL_SPRING, shake = { factor, decay },
//     listener = { radius, fov } }) → {
//     set(pose)             the pose to show ({ at, lookAt, fov, roll })
//     kick(radians)         a shot's recoil: the view thrown up, sprung back
//     shake(amount, at)     a blast's or a walker's step's knock, from `at`
//                           (none: on the camera), scaled by `factor` (the
//                           record's ShakeFactor) and fallen off with distance
//     update(dt)            the camera placed: the pose, the recoil, the shake
//     listener()            the audio bus's listener: { position, forward, fov, radius }
//     state()               { recoil, trauma } for a check
//   }
//
// The recoil is a damped spring on the pitch (lib/spring.js), kicked and
// pulled back to nothing. The shake is trauma: each knock adds to it, it
// decays at SHAKE_DECAY per second, and its square drives a smooth noise
// on the position and the roll (the square: small knocks barely show, a
// blast rattles), so it settles without a step.

import { createSpring } from '../../spring';

// (hand: the recoil spring's stiffness and damping; the weapons' kick
// curves are not in the export. Near critical: it returns in about 0.25 s)
export const RECOIL_SPRING = { k: 220, c: 26 };
// (hand: the trauma lost per second)
export const SHAKE_DECAY = 1.6;
// (hand: at full trauma, the most the shake moves the camera (m) and rolls it (rad))
export const SHAKE_MOVE = 0.08;
export const SHAKE_ROLL = 0.035;
// (hand: a knock's reach: its trauma halves at this distance, m)
export const SHAKE_FALLOFF = 25;

const fin = (v) => Number.isFinite(v);

// a smooth noise in −1…1 out of three incommensurate sines, one per channel
export function shakeNoise(t, channel) {
  const c = channel * 1.618;
  return (Math.sin(t * 23.1 + c * 7.3) + Math.sin(t * 37.7 + c * 3.1) * 0.6 + Math.sin(t * 13.3 + c * 11.9) * 0.4) / 2;
}

// the trauma left after dt
export const shakeDecay = (trauma, dt) => Math.max(0, trauma - SHAKE_DECAY * Math.max(0, dt));

// a knock of `amount` at distance d, scaled by the record's ShakeFactor
export const knock = (amount, d, factor = 1) => (amount * factor) / (1 + (Math.max(0, d) / SHAKE_FALLOFF) ** 2);

export function createCameraRig(camera, { recoil = RECOIL_SPRING, shake = {}, listener = {} } = {}) {
  const spring = createSpring({ k: recoil.k, c: recoil.c });
  const factor = fin(shake.factor) ? shake.factor : 1;
  let pose = null;
  let trauma = 0;
  let t = 0;
  const off = [0, 0, 0];
  return {
    set(next) {
      pose = next;
    },
    kick(radians) {
      // (a velocity: the view is thrown and springs back, its peak near
      // `radians` on a spring near critical, whose peak is about v / (e √k))
      if (fin(radians)) spring.kick(radians * Math.sqrt(recoil.k) * Math.E);
    },
    shake(amount, at = null) {
      const p = camera.position;
      const d = at ? Math.hypot(at[0] - p.x, at[1] - p.y, at[2] - p.z) : 0;
      trauma = Math.min(1, trauma + knock(amount, d, factor));
    },
    update(dt) {
      const h = fin(dt) && dt > 0 ? dt : 0;
      t += h;
      spring.step(h);
      trauma = shakeDecay(trauma, h);
      if (!pose) return;
      const s = trauma * trauma;
      for (let i = 0; i < 3; i++) off[i] = shakeNoise(t, i) * s * SHAKE_MOVE;
      camera.position.set(pose.at[0] + off[0], pose.at[1] + off[1], pose.at[2] + off[2]);
      camera.up.set(0, 1, 0);
      camera.lookAt(pose.lookAt[0] + off[0], pose.lookAt[1] + off[1], pose.lookAt[2] + off[2]);
      if (spring.x) camera.rotateX(spring.x);
      const roll = (pose.roll ?? 0) + shakeNoise(t, 3) * s * SHAKE_ROLL;
      if (roll) camera.rotateZ(roll);
      if (fin(pose.fov) && Math.abs(camera.fov - pose.fov) > 1e-3) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }
    },
    listener() {
      const p = camera.position;
      const f = pose ? [pose.lookAt[0] - pose.at[0], pose.lookAt[1] - pose.at[1], pose.lookAt[2] - pose.at[2]] : [0, 0, -1];
      const l = Math.hypot(...f) || 1;
      return { position: [p.x, p.y, p.z], forward: f.map((v) => v / l), fov: listener.fov ?? null, radius: listener.radius ?? null };
    },
    state: () => ({ recoil: spring.x, trauma }),
  };
}
