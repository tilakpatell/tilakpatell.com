import { describe, expect, it } from 'vitest';
import { fbm3, noiseVolume } from './volume';

describe('the noise', () => {
  it('repeats exactly over its period', () => {
    for (const [x, y, z] of [[0.3, 1.7, 2.2], [3.9, 0.1, 0.5]]) expect(fbm3(x + 4, y, z)).toBeCloseTo(fbm3(x, y, z), 12); // (x + 4 rounds its fraction in the last bit)
    for (const [x, y, z] of [[0.3, 1.7, 2.2], [-0.6, 0.1, 5.5]]) {
      expect(fbm3(x, y - 2, z + 4, { period: 2 })).toBeCloseTo(fbm3(x, y, z, { period: 2 }), 12);
    }
  });
  it('is the same for a seed and different for another', () => {
    expect(fbm3(1.2, 2.3, 0.4, { seed: 3 })).toBe(fbm3(1.2, 2.3, 0.4, { seed: 3 }));
    expect(fbm3(1.2, 2.3, 0.4, { seed: 3 })).not.toBe(fbm3(1.2, 2.3, 0.4, { seed: 4 }));
  });
  it('stays within 0…1 and moves smoothly', () => {
    for (let i = 0; i < 200; i++) {
      const p = [i * 0.37, i * 0.11 - 3, i * 0.053];
      const v = fbm3(...p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(fbm3(p[0] + 1e-4, p[1], p[2]) - v)).toBeLessThan(1e-2);
    }
  });
});

describe('the noise volume', () => {
  it('fills size³ two-channel voxels with contrast, and is made once', () => {
    const v = noiseVolume(32, 1);
    expect(v).toBeInstanceOf(Uint8Array);
    expect(v).toHaveLength(32 ** 3 * 2);
    for (const c of [0, 1]) {
      let lo = 255, hi = 0;
      for (let i = c; i < v.length; i += 2) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
      expect(lo).toBeLessThan(40);
      expect(hi).toBeGreaterThan(215);
    }
    expect(noiseVolume(32, 1)).toBe(v);
    expect(noiseVolume(32, 2)).not.toBe(v);
  });
  it('has no seam where it wraps', () => {
    const v = noiseVolume(32, 1);
    const at = (i, j, k) => v[((k * 32 + j) * 32 + i) * 2];
    let seam = 0, step = 0;
    for (let j = 0; j < 32; j++) for (let k = 0; k < 32; k++) { seam += Math.abs(at(31, j, k) - at(0, j, k)); step += Math.abs(at(15, j, k) - at(16, j, k)); }
    expect(seam).toBeLessThan(step * 2);
  });
  it('samples the gas at its seed and the mix at the next, each over its own range', () => {
    const n = 8, seed = 5, v = noiseVolume(n, seed);
    for (const [c, s] of [[0, seed], [1, seed + 1]]) {
      const raw = [];
      for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) raw.push(fbm3((i / n) * 4, (j / n) * 4, (k / n) * 4, { seed: s }));
      const lo = Math.min(...raw), hi = Math.max(...raw);
      raw.forEach((x, i) => expect(v[i * 2 + c]).toBe(Math.round(((x - lo) / (hi - lo)) * 255)));
    }
  });
  it('refuses a side it can’t make', () => {
    for (const bad of [0, -4, 2.5, NaN, '32']) expect(() => noiseVolume(bad)).toThrow(TypeError);
  });
});
