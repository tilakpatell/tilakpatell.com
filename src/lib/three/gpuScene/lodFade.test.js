import { describe, expect, it } from 'vitest';
import { FADE } from './cull.js';
import { fadeAlpha, ign, keeps } from './lodFade.js';

describe('the LOD crossfade’s CPU twin', () => {
  it('is 0 at age 0 and 1 at 0.3 s', () => {
    expect(fadeAlpha(0)).toBe(0);
    expect(fadeAlpha(FADE)).toBe(1);
    expect(fadeAlpha(FADE / 2)).toBeCloseTo(0.5);
    expect(fadeAlpha(-1)).toBe(0);
    expect(fadeAlpha(9)).toBe(1);
  });

  it('the incoming and outgoing files keep complementary pixels: no hole, no pixel drawn twice', () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
      let both = 0;
      let neither = 0;
      let kept = 0;
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const n = ign(x, y);
          const a = keeps(n, t, true);
          const b = keeps(n, t, false);
          if (a && b) both++;
          if (!a && !b) neither++;
          if (a) kept++;
        }
      }
      expect(both).toBe(0);
      expect(neither).toBe(0);
      // (the noise is even: the incoming share follows t)
      expect(Math.abs(kept / 1024 - t)).toBeLessThan(0.05);
    }
  });

  it('interleaved gradient noise stays in 0…1', () => {
    for (let i = 0; i < 1000; i++) {
      const n = ign(i * 7.3, i * 1.9);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
