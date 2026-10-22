import { describe, expect, it } from 'vitest';
import { HEIGHT, LEAN, RAGS, createDementorFigure, leanOf, stir } from './dementorFigure';

describe('a dementor’s figure', () => {
  it('stirs its rags most at the hem and not at all above its skirts', () => {
    expect(stir(0)).toBe(1);
    expect(stir(RAGS / 2)).toBeCloseTo(0.25);
    expect(stir(RAGS)).toBe(0);
    expect(stir(0.9)).toBe(0);
    // (never more the higher it hangs)
    for (let k = 0; k < 1; k += 0.05) expect(stir(k + 0.05)).toBeLessThanOrEqual(stir(k));
  });

  it('leans in from the chest up, the hood most', () => {
    expect(leanOf(0.2)).toBe(0);
    expect(leanOf(LEAN.from)).toBe(0);
    expect(leanOf(1)).toBe(1);
    expect(leanOf(0.8)).toBeGreaterThan(leanOf(0.6));
  });

  it('stands in until its model comes, and says so when it can’t', async () => {
    const f = createDementorFigure({ rt: { assets: { gltf: () => Promise.reject(new Error('offline')) } } });
    expect(f.group.children).toHaveLength(1);
    expect(await f.ready).toBe(false);
    f.set({ t: 1, fade: 0, reach: 1 });
    expect(f.group.visible).toBe(false);
    f.set({ fade: 1 });
    expect(f.group.visible).toBe(true);
    f.dispose();
    expect(HEIGHT).toBe(2.9);
  });
});
