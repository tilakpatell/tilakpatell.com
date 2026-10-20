// The camera’s places in the study, pure (the design’s §1, §8): the room
// on arrival, the book (from a phone held upright, nearer above it and
// wider, so the book fills the screen), back in the chair to look round the
// room, at the round window looking out, and the stone when it is taken up.
// And how far a drag turns the head in each, and whether it settles back.
//
//   poseFor(mode, aspect, { stone, window }) → { at, look, fov }
//   LOOK_LIMITS[mode] → { yaw, pitch, settles }
//   damp(from, to, dt, rate, reduced) → the way there after dt

export function poseFor(mode, aspect = 1.6, { stone = [0.44, 0.13, -0.04], window = [0.32, 0.43, -0.75] } = {}) {
  const tall = aspect < 0.9;
  if (mode === 'room') return tall ? { at: [0.05, 0.75, 1.65], look: [0, 0.22, -0.4], fov: 62 } : { at: [0.12, 0.52, 1.42], look: [0.04, 0.24, -0.5], fov: 50 };
  if (mode === 'look') return tall ? { at: [0, 0.38, 1.15], look: [0, 0.28, -0.5], fov: 72 } : { at: [0, 0.4, 1.0], look: [0, 0.28, -0.6], fov: 58 };
  if (mode === 'window') {
    const [x, y, z] = window;
    return { at: [x, y + 0.01, z + (tall ? 0.62 : 0.52)], look: [x, y + 0.14, z - 1.4], fov: tall ? 64 : 50 };
  }
  if (mode === 'stone') {
    const [x, y, z] = stone;
    return { at: [x - 0.02, y + 0.06, z + (tall ? 0.3 : 0.2)], look: [x, y, z], fov: tall ? 50 : 38 };
  }
  return tall ? { at: [0, 0.6, 0.48], look: [0, 0.04, -0.04], fov: 50 } : { at: [0, 0.4, 0.54], look: [0, 0.075, -0.06], fov: 37 };
}

export const LOOK_LIMITS = {
  book: { yaw: 0.12, pitch: 0.12, settles: true },
  room: { yaw: 0.12, pitch: 0.12, settles: true },
  look: { yaw: 1.25, pitch: 0.4, settles: false },
  window: { yaw: 0.3, pitch: 0.2, settles: true },
  stone: { yaw: 0, pitch: 0, settles: true },
};

export function damp(from, to, dt, rate = 2, reduced = false) {
  if (reduced) return [...to];
  const k = 1 - Math.exp(-rate * dt);
  return from.map((v, i) => v + (to[i] - v) * k);
}
