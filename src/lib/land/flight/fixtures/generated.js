// Fixtures for the generated planets' tests: directions spread evenly over
// the sphere, drawn from a seed.
import { seeded } from '../../../seeded.js';

// uniform on the sphere: z = 2r − 1 and an angle round it (in y-up terms, y)
export function randomDirs(n, seed) {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => {
    const y = 2 * rnd() - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - y * y);
    return [Math.cos(a) * s, y, Math.sin(a) * s];
  });
}
