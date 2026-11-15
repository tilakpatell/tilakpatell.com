import { describe, expect, it } from 'vitest';
import { ChainBloomPass, bloomLevels, bloomWeights } from './bloomChain';

describe('bloomLevels', () => {
  it('goes down to a few texels, whatever the size', () => {
    expect(bloomLevels(360)).toBe(7); // 360 … 6
    expect(bloomLevels(180)).toBe(6);
    expect(bloomLevels(64)).toBe(5);
  });
  it('keeps to its least and most', () => {
    expect(bloomLevels(4)).toBe(3);
    expect(bloomLevels(1e5)).toBe(8);
    expect(bloomLevels(0)).toBe(3);
  });
});

describe('bloomWeights', () => {
  it('sums to one, so the chain only moves light about', () => {
    for (const n of [3, 5, 7, 8]) for (const s of [0, 0.3, 0.5, 0.8, 1]) expect(bloomWeights(n, s).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it('leans to the core as it sharpens, to the reach as it softens', () => {
    const soft = bloomWeights(7, 0.3);
    const sharp = bloomWeights(7, 0.8);
    expect(sharp[0]).toBeGreaterThan(soft[0]);
    expect(sharp[6]).toBeLessThan(soft[6]);
    // (sharp: the finest levels carry the most)
    expect(sharp[0] + sharp[1] + sharp[2]).toBeGreaterThan(0.5);
  });
  it('is all positive and finite', () => {
    for (const w of bloomWeights(8, 0.5)) {
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThan(0);
    }
  });
});

describe('ChainBloomPass', () => {
  it('sizes its levels by halves and its weights by their count', () => {
    const pass = new ChainBloomPass(undefined, { sharpness: 0.6 });
    pass.setSize(640, 360);
    expect(pass.downs.length).toBe(7);
    // (levels 1 to 5 brought up into their own; the first straight onto the scene)
    expect(pass.ups.filter(Boolean).length).toBe(5);
    expect(pass.downs.map((t) => t.height)).toEqual([360, 180, 90, 45, 23, 12, 6]);
    expect(pass.weights.length).toBe(7);
    pass.setSize(320, 180);
    expect(pass.downs.length).toBe(6);
    expect(pass.needsSwap).toBe(false);
    pass.dispose();
  });
  it('takes its numbers live', () => {
    const pass = new ChainBloomPass(undefined, { threshold: 2, knee: 0.5, veil: 0.03 });
    pass.threshold = 1.4;
    pass.knee = 0.7;
    pass.veil = 0.05;
    pass.radius = 0.25;
    expect(pass.first.uniforms.uThreshold.value).toBe(1.4);
    expect(pass.first.uniforms.uKnee.value).toBe(0.7);
    expect(pass.first.uniforms.uVeil.value).toBe(0.05);
    expect(pass.sharpness).toBeCloseTo(0.75, 9);
    pass.dispose();
  });
});
