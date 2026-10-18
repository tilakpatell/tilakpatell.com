// Generated planets as their tests are given them: points on the sphere,
// scattered the same way every run. z = 2r − 1 and an angle round it is
// uniform on the unit sphere (Archimedes: equal heights of a sphere's band
// hold equal areas).
//
//   randomDirs(n, seed) → n unit [x, y, z] arrays

import { seeded } from '../../../seeded.js';

export function randomDirs(n, seed) {
  const r = seeded(seed);
  return Array.from({ length: n }, () => {
    const z = 2 * r() - 1;
    const a = 2 * Math.PI * r();
    const s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a), z];
  });
}
