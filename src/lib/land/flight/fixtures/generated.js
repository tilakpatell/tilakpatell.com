// The generated planets' fixtures, for the round ground's tests: directions
// spread evenly over the unit sphere, the same every run.
//
//   randomDirs(n, seed) → [x, y, z][]: uniform on the sphere (z = 2r − 1 and
//     an angle round it, Archimedes' rule), each one a unit array
import { seeded } from '../../../seeded.js';
import { unit } from '../sphere.js';

export function randomDirs(n, seed) {
  const r = seeded(seed);
  return Array.from({ length: n }, () => {
    const z = 2 * r() - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    return unit([s * Math.cos(a), s * Math.sin(a), z]);
  });
}
