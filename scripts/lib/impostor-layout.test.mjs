import { describe, expect, it } from 'vitest';
import { VIEWS, atlasUv, impostorBlend, impostorTile, impostorViews, octDecode, octEncode, viewBasis } from './impostor-layout.mjs';

describe('the hemi-octahedral map', () => {
  it('folds straight up to the middle and the horizon to the edge', () => {
    expect(octEncode([0, 1, 0])).toEqual([0, 0]);
    const [u, v] = octEncode([1, 0, 0]);
    expect(Math.max(Math.abs(u), Math.abs(v))).toBeCloseTo(1);
  });

  it('decodes what it encodes, over the hemisphere', () => {
    for (const d of [
      [0.3, 0.9, 0.1],
      [-0.7, 0.2, 0.68],
      [0.1, 0.05, -0.99],
    ]) {
      const l = Math.hypot(...d);
      const unit = d.map((c) => c / l);
      octDecode(octEncode(unit)).forEach((c, k) => expect(c).toBeCloseTo(unit[k], 6));
    }
  });
});

describe('impostorViews and impostorTile', () => {
  it('makes n² unit views on the upper hemisphere', () => {
    const views = impostorViews(16);
    expect(views).toHaveLength(256);
    for (const v of views) {
      expect(Math.hypot(...v)).toBeCloseTo(1, 6);
      expect(v[1]).toBeGreaterThanOrEqual(0);
    }
  });

  it('finds each view’s own tile, at full weight', () => {
    const n = VIEWS;
    const views = impostorViews(n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) expect(impostorTile(views[j * n + i], n)).toEqual([i, j, expect.closeTo(1, 6)]);
  });

  it('blends three tiles whose weights sum to one, the nearest heaviest', () => {
    const between = octDecode([0.031, -0.4]);
    const three = impostorBlend(between, 16);
    expect(three).toHaveLength(3);
    expect(three.reduce((s, t) => s + t[2], 0)).toBeCloseTo(1, 9);
    for (const [i, j, w] of three) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(16);
      expect(w).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(impostorTile(between, 16)[2]).toBe(Math.max(...three.map((t) => t[2])));
  });

  it('reads a view from below the horizon as the horizon’s', () => {
    const below = impostorTile([0.6, -0.5, 0.2], 16);
    const level = impostorTile([0.6, 0, 0.2], 16);
    expect(below).toEqual(level);
  });
});

describe('viewBasis and atlasUv', () => {
  it('gives a camera on +z looking back its right as +x and its up as +y', () => {
    const { right, up } = viewBasis([0, 0, 1]);
    right.forEach((c, k) => expect(c).toBeCloseTo([1, 0, 0][k], 9));
    up.forEach((c, k) => expect(c).toBeCloseTo([0, 1, 0][k], 9));
  });

  it('keeps a straight-down view whole: right +x, up −z', () => {
    const { right, up } = viewBasis([0, 1, 0]);
    expect(right).toEqual([1, 0, 0]);
    up.forEach((c, k) => expect(c).toBeCloseTo([0, 0, -1][k], 9));
  });

  it('puts a card’s top in its tile’s top row, nearer v = 0', () => {
    expect(atlasUv(0, 0, [0, 1], 16)).toEqual([0, 0]);
    expect(atlasUv(15, 15, [1, 0], 16)).toEqual([1, 1]);
    expect(atlasUv(2, 3, [0.5, 0.5], 16)).toEqual([2.5 / 16, 3.5 / 16]);
  });
});
