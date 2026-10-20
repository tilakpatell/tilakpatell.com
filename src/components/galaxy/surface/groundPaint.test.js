import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HALF } from './terrain';
import { groundPainter, mapAreaOf } from './groundPaint';
import { siteOf } from './sites';
import { heightGrid, makeHeight } from './terrain';
import { SCATTER } from './props';

const flat = (h = 5, n = [0, 1, 0]) => ({ heightAt: () => h, normalAt: () => n });
const palette = { low: '#804020', high: '#20a040', rock: '#808080', deep: '#102030', hLow: 0, hHigh: 10, rockAt: 0.42, accentCover: 0, grain: 0 };
const site = (over = {}) => ({ ground: { seed: 3, palette }, land: { at: [0, 0] }, places: [], grass: { cover: 1 }, ...over });
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const paintAt = (p, x, z) => {
  const out = [0, 0, 0];
  const grass = p.paint(x, z, out);
  return { out, grass };
};
const near = (a, b, eps = 0.02) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('the ground painted as one function', () => {
  it('is the low colour under hLow, the high over hHigh, and a mix between', () => {
    expect(near(paintAt(groundPainter(site(), flat(-5)), 300, 300).out, lin(palette.low))).toBe(true);
    expect(near(paintAt(groundPainter(site(), flat(15)), 300, 300).out, lin(palette.high))).toBe(true);
    const mid = paintAt(groundPainter(site(), flat(5)), 300, 300).out;
    const lo = lin(palette.low);
    const hi = lin(palette.high);
    for (let i = 0; i < 3; i++) expect(mid[i]).toBeGreaterThanOrEqual(Math.min(lo[i], hi[i]) - 0.02);
    for (let i = 0; i < 3; i++) expect(mid[i]).toBeLessThanOrEqual(Math.max(lo[i], hi[i]) + 0.02);
    expect(near(mid, lo, 0.05) || near(mid, hi, 0.05)).toBe(false);
  });

  it('is rock on a slope past rockAt', () => {
    const { out } = paintAt(groundPainter(site(), flat(5, [0.75, 0.5, 0.43])), 300, 300);
    expect(near(out, lin(palette.rock), 0.12)).toBe(true);
  });

  it('is the deep colour under the water, with no grass', () => {
    const { out, grass } = paintAt(groundPainter(site({ water: { level: 0 } }), flat(-3)), 300, 300);
    expect(near(out, lin(palette.deep), 0.05)).toBe(true);
    expect(grass).toBe(0);
  });

  it('grows no grass on the landing flat or a place’s flat', () => {
    const p = groundPainter(site({ places: [{ at: [200, -200], flat: { r: 40 } }] }), flat(5));
    expect(paintAt(p, 0, 0).grass).toBe(0);
    expect(paintAt(p, 200, -200).grass).toBe(0);
    let grown = 0;
    for (let z = -500; z <= 500; z += 100) for (let x = -500; x <= 500; x += 100) if (Math.hypot(x, z) > 60 && Math.hypot(x - 200, z + 200) > 60) grown += paintAt(p, x, z).grass > 0.5 ? 1 : 0;
    expect(grown).toBeGreaterThan(60);
  });

  it('darkens the colour and thins the grass under a tree’s crown', () => {
    const open = groundPainter(site(), flat(5));
    const shaded = groundPainter(site(), flat(5), { shade: [{ at: [300, 300], r: 20 }] });
    const a = paintAt(open, 300, 300);
    const b = paintAt(shaded, 300, 300);
    for (let i = 0; i < 3; i++) expect(b.out[i]).toBeCloseTo(a.out[i] * 0.75, 2);
    expect(b.grass).toBeCloseTo(a.grass * 0.4, 2);
    expect(paintAt(shaded, 400, 400).grass).toBeCloseTo(paintAt(open, 400, 400).grass, 5);
  });

  it('paints colour and no grass on a world without grass', () => {
    const p = groundPainter(site({ grass: undefined }), flat(5));
    const { out, grass } = paintAt(p, 300, 300);
    expect(grass).toBe(0);
    expect(out.some((v) => v > 0)).toBe(true);
  });

  it('covers the walkable square, as the terrain grid lies', () => {
    expect(mapAreaOf()).toEqual({ x0: -HALF, z0: -HALF, w: 2 * HALF, d: 2 * HALF });
  });

  it('paves a city’s streets, ring streets and plaza over the colour, with no grass on them, soft at the edge', () => {
    const paving = [{ a: [200, 300], b: [400, 300], w: 9 }, { at: [-300, 300], r: 60, w: 10 }, { at: [300, -300], r: 20 }];
    const open = groundPainter(site(), flat(5));
    const paved = groundPainter(site({ paving }), flat(5));
    const [r, g, b] = lin(palette.low);
    const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 0.5;
    const road = [lum * 1.04, lum, lum * 0.94];
    for (const [x, z] of [[300, 302], [-300, 362], [305, -290]]) {
      const was = paintAt(open, x, z).out;
      const { out, grass } = paintAt(paved, x, z);
      expect(grass).toBe(0);
      for (let i = 0; i < 3; i++) expect(out[i]).toBeCloseTo(was[i] + (road[i] - was[i]) * 0.9, 4);
    }
    for (const [x, z] of [[300, 310], [-300, 368], [300, -330], [-300, 300]]) expect(paintAt(paved, x, z)).toEqual(paintAt(open, x, z));
    // (half paved on its edge, and the palette's own road colour where it has one)
    expect(paintAt(paved, 300, 304.5).grass).toBeCloseTo(paintAt(open, 300, 304.5).grass * 0.5, 4);
    const own = groundPainter(site({ paving, ground: { seed: 3, palette: { ...palette, road: '#202024' } } }), flat(5));
    expect(near(paintAt(own, 300, 300).out, paintAt(open, 300, 300).out.map((v, i) => v + (lin('#202024')[i] - v) * 0.9), 0.005)).toBe(true);
  });

  it('finds a shade among hundreds by its cell, not by looking at them all', () => {
    const shade = Array.from({ length: 600 }, (_, i) => ({ at: [((i * 37) % 800) - 600, ((i * 91) % 1200) - 600], r: 8 }));
    shade.push({ at: [300, 300], r: 20 });
    const p = groundPainter(site(), flat(5), { shade });
    expect(paintAt(p, 300, 300).grass).toBeCloseTo(paintAt(groundPainter(site(), flat(5)), 300, 300).grass * 0.4, 2);
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) paintAt(p, (i % 200) * 6 - 600, Math.floor(i / 200) * 6 - 600);
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('is the grass’s own colour where grass grows (its mid, toward its dry in drifts), the floor’s where none does', () => {
    const grassy = site({ grass: { cover: 1, mid: '#c6ad72', dry: '#c6ad72' } });
    const p = groundPainter(grassy, flat(5));
    const { out, grass } = paintAt(p, 300, 300);
    expect(grass).toBeGreaterThan(0.9);
    expect(near(out, lin('#c6ad72'), 0.03)).toBe(true);
    // (bare on the landing flat: the floor's own colour)
    expect(near(paintAt(p, 0, 0).out, paintAt(groundPainter(site({ grass: undefined }), flat(5)), 0, 0).out, 1e-6)).toBe(true);
  });

  it('reads the height from the grid', () => {
    expect(groundPainter(site(), flat(7)).height(1, 2)).toBe(7);
  });

  it('grows Yavin’s grass thin under the jungle trees and thicker in the clearings', () => {
    const yavin = siteOf('yavin');
    expect(yavin.grass).toBeTruthy();
    const grid = heightGrid(makeHeight(yavin.ground), { n: 64, grow: 1.4 });
    const tree = yavin.scatter.find((s) => s.kind === 'jungletree');
    expect(SCATTER[tree.kind].canopy).toBeGreaterThan(0);
    const at = [300, 300];
    const open = groundPainter(yavin, grid);
    const shaded = groundPainter(yavin, grid, { shade: [{ at, r: SCATTER[tree.kind].canopy }] });
    const out = [0, 0, 0];
    const a = open.paint(at[0], at[1], out);
    const b = shaded.paint(at[0], at[1], out);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(a * 0.5);
  });
});
