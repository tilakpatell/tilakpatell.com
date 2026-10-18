import { describe, expect, it } from 'vitest';
import { PALETTE } from '../palette';
import { NEBULA_BUDGET } from './budget';
import {
  FORMS, checkDesc, detailAt, envelope, fogLayers, insideOf, placement, seedOf, stepsAt, youngStars,
} from './rules';

const len = (a) => Math.hypot(...a);
describe('where a nebula is drawn', () => {
  const at = [-13380, 505, 28350], r = 700;
  it('keeps it where it is, whatever the camera', () => {
    for (const cam of [[0, 0, 0], [5000, 0, 0], [123456.7, -800, 1e6]]) {
      const p = placement(at, r, cam, 1e12);
      p.centre.forEach((v, i) => expect(cam[i] + v / p.scale).toBeCloseTo(at[i], 6));
    }
  });
  it('draws it at its true angle, 2·atan(r / d), with no floor', () => {
    for (const d of [2000, 9000, 45000, 1e6, 1e7]) {
      const p = placement([d, 0, 0], r, [0, 0, 0], 44100);
      expect(2 * Math.atan(p.radius / len(p.centre))).toBeCloseTo(2 * Math.atan(r / d), 12);
    }
    expect(2 * Math.atan(placement([1e7, 0, 0], r, [0, 0, 0], 44100).radius / 44100)).toBeLessThan(1e-3); // (the old floor was 14°, 0.244)
  });
  it('pulls a far one inside the far plane along its own direction', () => {
    const p = placement([0, 0, -200000], r, [0, 0, 0], 44100);
    expect(len(p.centre)).toBeCloseTo(44100, 6);
    expect(p.centre[2]).toBeLessThan(0);
    expect(p.scale).toBeCloseTo(44100 / 200000, 12);
    expect(p.dist).toBe(200000);
  });
  it('is whole with the camera at its very middle', () => {
    expect(placement(at, r, at, 44100)).toEqual({ centre: [0, 0, 0], radius: r, scale: 1, dist: 0 });
  });
});
describe('its levels', () => {
  it('is near inside four radii, far past them, smooth between', () => {
    expect(detailAt(4 * 700 * 0.79, 700)).toBe(1);
    expect(detailAt(4 * 700 * 1.21, 700)).toBe(0);
    expect(detailAt(4 * 700, 700)).toBeCloseTo(0.5);
    expect(stepsAt(0, NEBULA_BUDGET.high)).toBe(6);
    expect(stepsAt(1, NEBULA_BUDGET.high)).toBe(32);
  });
});
describe('its shape', () => {
  it('fills a cloud from its heart to its edge, flattened toward the map’s plane', () => {
    expect(envelope('cloud', [0, 0, 0])).toBe(1);
    expect(envelope('cloud', [1.01, 0, 0])).toBe(0);
    expect(envelope('cloud', [0, 0.5, 0])).toBeLessThan(envelope('cloud', [0.5, 0, 0]));
  });
  it('leaves a shell hollow and a nursery hot at the heart', () => {
    expect(envelope('shell', [0, 0, 0])).toBe(0);
    expect(envelope('shell', [0.72, 0, 0])).toBe(1);
    expect(FORMS.nursery.core).toBeGreaterThan(1);
    expect(envelope('nebulous?', [0.2, 0, 0])).toBe(envelope('cloud', [0.2, 0, 0]));
  });
});
describe('inside', () => {
  const veil = { id: 'veil', at: [0, 0, 0], r: 700, form: 'cloud' };
  it('says how deep, and nothing outside', () => {
    expect(insideOf([veil], [0, 0, 0])).toEqual({ id: 'veil', depth: 1 });
    expect(insideOf([veil], [707, 0, 0])).toBeNull();
  });
  it('names the deeper of two that overlap', () => {
    const other = { id: 'b', at: [600, 0, 0], r: 700, form: 'cloud' };
    expect(insideOf([veil, other], [550, 0, 0]).id).toBe('b');
  });
  it('is not inside a shell’s hollow middle', () => expect(insideOf([{ ...veil, form: 'shell' }], [0, 0, 0])).toBeNull());
});
describe('the fog’s layers', () => {
  it('starts clear of the ship and grows by one ratio', () => {
    const l = fogLayers(NEBULA_BUDGET.high, 700);
    expect(l).toHaveLength(4);
    expect(l[0]).toBe(8); // (the chase camera is at most 2.5 behind the ship: flight.js's CHASE)
    expect(l.at(-1)).toBeCloseTo(350);
    expect(l[2] / l[1]).toBeCloseTo(l[1] / l[0], 9);
    expect(fogLayers(NEBULA_BUDGET.high, 1e5).at(-1)).toBe(3000);
  });
  it('has none for a cloud too small to fog the ship from inside', () => {
    expect(fogLayers(NEBULA_BUDGET.high, 5)).toEqual([]);
    expect(fogLayers(NEBULA_BUDGET.high, 16)).toEqual([]);
  });
});
describe('a description', () => {
  it('takes the seeds generators make, and keeps them apart', () => {
    for (const s of [7, 7n, 'veil', 2n ** 63n + 5n]) for (const v of seedOf(s)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(seedOf(7n)).toEqual(seedOf(7n));
    expect(seedOf('veil')).not.toEqual(seedOf('cradle'));
  });
  it('fills in colours and form, and refuses what can’t be drawn', () => {
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: ['#123456'], seed: 1 }).colors).toEqual(['#123456', '#123456', '#123456']);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, seed: 1, form: 'blob' })).toMatchObject({ colors: [PALETTE.nebula, PALETTE.nebula, PALETTE.nebula], form: 'cloud' });
    expect(() => checkDesc({ id: 'a', at: [0, NaN, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0, 0], r: 0, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ at: [0, 0, 0], r: 5, seed: 1 })).toThrow(TypeError);
  });
});
describe('young stars', () => {
  it('are the same for a seed, inside the cloud, wider in a shell', () => {
    const d = { id: 'v', at: [0, 0, 0], r: 700, seed: 'v', form: 'shell' };
    expect(youngStars(d, 16)).toEqual(youngStars(d, 16));
    expect(youngStars(d, 16)).toHaveLength(16);
    const spread = (f) => youngStars({ ...d, form: f }, 64).reduce((s, x) => s + Math.hypot(...x.at), 0);
    expect(spread('shell')).toBeGreaterThan(spread('nursery'));
  });
});
