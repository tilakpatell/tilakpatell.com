import { describe, expect, it } from 'vitest';
import { SNOW_FULL, variationParams } from './variation.js';
import { accumulation } from './weather.js';

describe('variationParams', () => {
  const base = { detail: { tiling: [6, 3], strength: 2 }, alphaTest: false };

  it('is the recipe’s own params when there is no variation', () => {
    expect(variationParams(base, null)).toBe(base);
    expect(variationParams(base, {})).toEqual(base);
  });

  it("reads a variation's vectors through the recipe's parameter names", () => {
    const p = variationParams(base, { vectors: { PaintColour: [0.5, 0.25, 0.1, 1], DetailTiling: [20, 20, 0, 0], GrungeIntensity: [3, 0, 0, 0] } });
    expect(p.paint).toEqual([0.5, 0.25, 0.1]);
    expect(p.detail).toEqual({ tiling: [20, 20], strength: 2 });
    expect(p.grunge.intensity).toBe(3);
    // (the recipe is not touched)
    expect(base.detail.tiling).toEqual([6, 3]);
  });

  it("takes a colour-typed intensity as the brightest channel and the colour as its share", () => {
    const p = variationParams({}, { vectors: { EmissiveIntensety: [196608, 0, 0, 1] } });
    expect(p.emissive).toEqual({ intensity: 196608, color: [1, 0, 0] });
    const lit = variationParams({ emissive: { mode: 'baseColor', color: [1, 1, 1], intensity: 6 } }, { vectors: { EmissiveIntensety: [3813.773, 4442.85, 6144, 1] } });
    expect(lit.emissive.intensity).toBe(6144);
    expect(lit.emissive.color[2]).toBe(1);
    expect(lit.emissive.color[0]).toBeCloseTo(3813.773 / 6144);
    expect(lit.emissive.mode).toBe('baseColor');
  });

  it('reads the conditionals the recipe reads', () => {
    const p = variationParams({}, { conditionals: { ESB_VehicleIsWreck: 'True', ESB_PanelEnable: 'False' } });
    expect(p.wreck).toBe(true);
  });

  it('lets snow settle on a snow variation', () => {
    expect(variationParams({}, { snow: true }).weather).toEqual({ snow: true });
  });
});

describe('SNOW_FULL', () => {
  it('is snow already settled: the whole amount from the first frame', () => {
    expect(accumulation(0, SNOW_FULL)).toBe(1);
  });
});
