import { describe, expect, it } from 'vitest';
import { RCAS_NEAR, RCAS_STOPS, SOFTEST, drawnRatio, rcasStops, samplesAt, upscaling } from './finish';

describe('the finish’s numbers', () => {
  it('draws at a share of the most it may, never under the softest, never over the most', () => {
    expect(drawnRatio(1.5, 1)).toBe(1.5);
    expect(drawnRatio(1.5, 0.6)).toBeCloseTo(0.9);
    expect(drawnRatio(1, 0.5)).toBe(SOFTEST);
    expect(drawnRatio(0.5, 1)).toBe(0.5); // (a render resolution picked under the softest)
    expect(drawnRatio(2, 0.5, { softest: 1.2 })).toBe(1.2);
  });

  it('multisamples by the sharpness drawn at: none where a stair is too small to see, more as it grows, under the visitor’s cap', () => {
    expect(samplesAt(2)).toBe(0);
    expect(samplesAt(1.75)).toBe(0);
    expect(samplesAt(1.5)).toBe(2);
    expect(samplesAt(1.25)).toBe(2);
    expect(samplesAt(1.08)).toBe(4);
    expect(samplesAt(0.75)).toBe(4);
    expect(samplesAt(0.75, { small: true })).toBe(2);
    expect(samplesAt(0.75, { cap: 2 })).toBe(2);
    expect(samplesAt(1.5, { cap: 0 })).toBe(0);
  });

  it('brings a scene up only when it is drawn softer than the canvas', () => {
    expect(upscaling(0.9, 1)).toBe(true);
    expect(upscaling(1.5, 1)).toBe(false);
    expect(upscaling(1 - 1e-6, 1)).toBe(false);
  });

  it('sharpens a scene brought up a long way as FidelityFX does, and one brought up a little more gently', () => {
    expect(rcasStops(0.5)).toBe(RCAS_STOPS);
    expect(rcasStops(0.3)).toBe(RCAS_STOPS);
    expect(rcasStops(1)).toBe(RCAS_NEAR);
    expect(rcasStops(0.9)).toBeCloseTo(0.68);
    let last = -1;
    for (let s = 0.3; s <= 1; s += 0.05) {
      expect(rcasStops(s)).toBeGreaterThanOrEqual(last);
      last = rcasStops(s);
    }
  });
});
