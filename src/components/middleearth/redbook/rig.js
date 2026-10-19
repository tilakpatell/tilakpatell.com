// The camera’s places in the study, pure (the design’s §1, §8): the room
// on arrival, the book (from a phone held upright, nearer above it and
// wider, so the book fills the screen), the stone when it is picked up.
//
//   poseFor(mode, aspect, { stone }) → { at, look, fov }
//   damp(from, to, dt, rate, reduced) → the way there after dt

export function poseFor(mode, aspect = 1.6, { stone = [0.44, 0.13, -0.04] } = {}) {
  const tall = aspect < 0.9;
  if (mode === 'room') return tall ? { at: [0.05, 0.9, 1.6], look: [0, 0.2, -0.4], fov: 56 } : { at: [0.12, 0.56, 1.28], look: [-0.06, 0.24, -0.5], fov: 40 };
  if (mode === 'stone') {
    const [x, y, z] = stone;
    return { at: [x - 0.03, y + 0.09, z + (tall ? 0.36 : 0.24)], look: [x, y, z], fov: tall ? 50 : 38 };
  }
  return tall ? { at: [0, 0.64, 0.44], look: [0, 0.02, -0.03], fov: 50 } : { at: [0, 0.46, 0.5], look: [0, 0.035, -0.045], fov: 38 };
}

export function damp(from, to, dt, rate = 2, reduced = false) {
  if (reduced) return [...to];
  const k = 1 - Math.exp(-rate * dt);
  return from.map((v, i) => v + (to[i] - v) * k);
}
