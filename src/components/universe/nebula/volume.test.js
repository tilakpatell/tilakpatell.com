import { describe, expect, it } from 'vitest';
import { fbm3, noiseVolume } from './volume';

describe('the noise volume', () => {
  it('repeats exactly over its period', () => {
    for (const [x, y, z] of [[0.3, 1.7, 2.2], [3.9, 0.1, 0.5]]) expect(fbm3(x + 4, y, z)).toBeCloseTo(fbm3(x, y, z), 12); // (x + 4 rounds its fraction in the last bit)
  });
  it('is the same for a seed and different for another', () => {
    expect(fbm3(1.2, 2.3, 0.4, { seed: 3 })).toBe(fbm3(1.2, 2.3, 0.4, { seed: 3 }));
    expect(fbm3(1.2, 2.3, 0.4, { seed: 3 })).not.toBe(fbm3(1.2, 2.3, 0.4, { seed: 4 }));
  });
  it('fills size³ two-channel voxels with contrast, and is made once', () => {
    const v = noiseVolume(32, 1);
    expect(v).toHaveLength(32 ** 3 * 2);
    for (const c of [0, 1]) {
      let lo = 255, hi = 0;
      for (let i = c; i < v.length; i += 2) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
      expect(lo).toBeLessThan(40);
      expect(hi).toBeGreaterThan(215);
    }
    expect(noiseVolume(32, 1)).toBe(v);
  });
  it('has no seam where it wraps', () => {
    const v = noiseVolume(32, 1);
    const at = (i, j, k) => v[((k * 32 + j) * 32 + i) * 2];
    let seam = 0, step = 0;
    for (let j = 0; j < 32; j++) for (let k = 0; k < 32; k++) { seam += Math.abs(at(31, j, k) - at(0, j, k)); step += Math.abs(at(15, j, k) - at(16, j, k)); }
    expect(seam).toBeLessThan(step * 2);
  });
});

it('is fbm3 at each voxel, before the stretch', () => {
  const v = noiseVolume(16, 2);
  // the stretch is monotonic, so the brightest voxel is fbm3's highest
  let best = 0;
  for (let i = 0; i < 16 ** 3; i++) if (v[i * 2] > v[best * 2]) best = i;
  const h = best % 16, j = Math.floor(best / 16) % 16, k = Math.floor(best / 256);
  const at = (a, b, c) => fbm3((a / 16) * 4, (b / 16) * 4, (c / 16) * 4, { seed: 2 });
  for (const [a, b, c] of [[(h + 1) % 16, j, k], [h, (j + 1) % 16, k], [h, j, (k + 15) % 16]]) expect(at(h, j, k)).toBeGreaterThanOrEqual(at(a, b, c));
});
