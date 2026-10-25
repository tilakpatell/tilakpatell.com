import { describe, expect, it } from 'vitest';
import { PALETTE } from '../palette';
import { NEBULA_BUDGET } from './budget';
import { FADE, FOG_FAR, FOG_NEAR, FORMS, FORM_INDEX, INSIDE_MIN, LIMIT, NEAR, checkDesc, detailAt, envelope, fogLayers, insideOf, placement, seedOf, stepsAt, youngStars } from './rules';

const len = (a) => Math.hypot(...a);

describe('the numbers', () => {
  it('are the plan’s', () => {
    expect({ NEAR, FADE, LIMIT, INSIDE_MIN, FOG_NEAR, FOG_FAR }).toEqual({ NEAR: 4, FADE: 0.2, LIMIT: 0.98, INSIDE_MIN: 0.02, FOG_NEAR: 8, FOG_FAR: 3000 });
    expect(FORMS).toEqual({
      cloud: { inner: -1, peak: 0.35, outer: 1, flat: 0.55, core: 1 },
      shell: { inner: 0.45, peak: 0.72, outer: 0.98, flat: 0.8, core: 1 },
      nursery: { inner: -1, peak: 0.2, outer: 1, flat: 0.6, core: 2.2 },
    });
    expect(FORM_INDEX).toEqual({ cloud: 0, shell: 1, nursery: 2 });
    expect(Object.keys(FORM_INDEX)).toEqual(Object.keys(FORMS));
  });
});

describe('where a nebula is drawn', () => {
  const at = [-13380, 505, 28350];
  const r = 700;

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

  it('leaves one inside the far plane at its true size', () => {
    expect(placement([0, 0, -9000], r, [0, 0, 0], 44100)).toEqual({ centre: [0, 0, -9000], radius: r, scale: 1, dist: 9000 });
  });

  it('is whole with the camera at its very middle', () => {
    expect(placement(at, r, at, 44100)).toEqual({ centre: [0, 0, 0], radius: r, scale: 1, dist: 0 });
    expect(placement([-0, 0, -0], r, [0, -0, 0], 44100).centre.every((v) => Object.is(v, 0))).toBe(true);
  });

  it('is whole with the camera on its edge, or the cloud bigger than the far plane', () => {
    for (const p of [placement(at, r, [at[0] + r, at[1], at[2]], 44100), placement([0, 0, -50000], 60000, [0, 0, 0], 44100)]) {
      for (const v of [...p.centre, p.radius, p.scale, p.dist]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('its levels', () => {
  it('is near inside four radii, far past them, smooth between', () => {
    expect(detailAt(4 * 700 * 0.79, 700)).toBe(1);
    expect(detailAt(4 * 700 * 1.21, 700)).toBe(0);
    expect(detailAt(4 * 700, 700)).toBeCloseTo(0.5);
    expect(detailAt(0, 700)).toBe(1);
    expect(stepsAt(0, NEBULA_BUDGET.high)).toBe(6);
    expect(stepsAt(1, NEBULA_BUDGET.high)).toBe(32);
  });

  it('only loses detail as it goes', () => {
    let was = 1;
    for (let d = 0; d < 4000; d += 50) {
      const k = detailAt(d, 700);
      expect(k).toBeLessThanOrEqual(was);
      was = k;
    }
  });

  it('takes a whole number of steps between the far and the near, never outside them', () => {
    const row = NEBULA_BUDGET.mid;
    expect(stepsAt(0.5, row)).toBe(Math.round(row.farSteps + (row.nearSteps - row.farSteps) / 2));
    expect(stepsAt(-1, row)).toBe(row.farSteps);
    expect(stepsAt(2, row)).toBe(row.nearSteps);
    for (let k = 0; k <= 1; k += 0.1) expect(Number.isInteger(stepsAt(k, row))).toBe(true);
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

  it('stays between nothing and whole everywhere, with nothing at its edge', () => {
    for (const form of Object.keys(FORMS)) {
      expect(envelope(form, [1, 0, 0])).toBe(0);
      expect(envelope(form, [0, FORMS[form].flat, 0])).toBe(0);
      for (let x = -1.2; x <= 1.2; x += 0.05) {
        for (const p of [[x, 0, 0], [0, x, 0], [x, x, x]]) {
          const e = envelope(form, p);
          expect(e).toBeGreaterThanOrEqual(0);
          expect(e).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('inside', () => {
  const veil = { id: 'veil', at: [0, 0, 0], r: 700, form: 'cloud' };

  it('says how deep, and nothing outside', () => {
    expect(insideOf([veil], [0, 0, 0])).toEqual({ id: 'veil', depth: 1 });
    expect(insideOf([veil], [707, 0, 0])).toBeNull();
    expect(insideOf([veil], [700, 0, 0])).toBeNull();
    expect(insideOf([], [0, 0, 0])).toBeNull();
  });

  it('names the deeper of two that overlap', () => {
    const other = { id: 'b', at: [600, 0, 0], r: 700, form: 'cloud' };
    expect(insideOf([veil, other], [550, 0, 0]).id).toBe('b');
    expect(insideOf([other, veil], [550, 0, 0]).id).toBe('b');
  });

  it('is not inside a shell’s hollow middle', () => expect(insideOf([{ ...veil, form: 'shell' }], [0, 0, 0])).toBeNull());

  it('is not inside where the gas is under the least', () => {
    // (a cloud's envelope falls to INSIDE_MIN a little inside its edge)
    let x = 0;
    while (envelope('cloud', [x / 700, 0, 0]) >= INSIDE_MIN) x += 1;
    expect(insideOf([veil], [x - 1, 0, 0])).toMatchObject({ id: 'veil' });
    expect(insideOf([veil], [x, 0, 0])).toBeNull();
  });
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

  it('has the tier’s count, and never comes in closer than the first for a small cloud', () => {
    for (const t of ['low', 'mid', 'high']) expect(fogLayers(NEBULA_BUDGET[t], 700)).toHaveLength(NEBULA_BUDGET[t].fog);
    const l = fogLayers(NEBULA_BUDGET.mid, 10);
    expect(l.every((v) => v === FOG_NEAR)).toBe(true);
  });
});

describe('a description', () => {
  it('takes the seeds generators make, and keeps them apart', () => {
    for (const s of [7, 7n, 'veil', 2n ** 63n + 5n]) {
      const v = seedOf(s);
      expect(v).toHaveLength(3);
      for (const x of v) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(1);
      }
    }
    expect(seedOf(7n)).toEqual(seedOf(7n));
    expect(seedOf('veil')).not.toEqual(seedOf('cradle'));
    // (as numbers these two are the same; as words they aren't)
    expect(seedOf(2n ** 63n + 5n)).not.toEqual(seedOf(2n ** 63n + 6n));
  });

  it('fills in colours and form, and refuses what can’t be drawn', () => {
    const violet = PALETTE.nebula.hex;
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: ['#123456'], seed: 1 }).colors).toEqual(['#123456', '#123456', '#123456']);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: ['#111111', '#222222'], seed: 1 }).colors).toEqual(['#111111', '#222222', '#111111']);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: ['#111111', '#222222', '#333333', '#444444'], seed: 1 }).colors).toEqual(['#111111', '#222222', '#333333']);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: [], seed: 1 }).colors).toEqual([violet, violet, violet]);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, seed: 1, form: 'blob' })).toMatchObject({ colors: [violet, violet, violet], form: 'cloud' });
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, seed: 1, form: 'shell' }).form).toBe('shell');
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, seed: 1, form: 'constructor' }).form).toBe('cloud');
    expect(() => checkDesc({ id: 'a', at: [0, NaN, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, Infinity, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0, 0], r: 0, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0, 0], r: -3, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0, 0], r: Infinity, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ at: [0, 0, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: '', at: [0, 0, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc(null)).toThrow(TypeError);
  });

  it('keeps its own copy of where it is, and its seed as given (or its id, given none)', () => {
    const at = [1, 2, 3];
    const d = checkDesc({ id: 'a', at, r: 5, seed: 2n ** 63n + 5n });
    at[0] = 99;
    expect(d.at).toEqual([1, 2, 3]);
    expect(d.seed).toBe(2n ** 63n + 5n);
    expect(checkDesc({ id: 'a', at, r: 5 }).seed).toBe('a');
  });
});

describe('young stars', () => {
  it('are the same for a seed, inside the cloud, wider in a shell', () => {
    const d = { id: 'v', at: [0, 0, 0], r: 700, seed: 'v', form: 'shell' };
    expect(youngStars(d, 16)).toEqual(youngStars(d, 16));
    expect(youngStars(d, 16)).toHaveLength(16);
    const spread = (f) => youngStars({ ...d, form: f }, 64).reduce((s, x) => s + Math.hypot(...x.at), 0);
    expect(spread('shell')).toBeGreaterThan(spread('cloud'));
    expect(spread('cloud')).toBeGreaterThan(spread('nursery'));
    for (const f of [...Object.keys(FORMS), 'blob']) for (const s of youngStars({ ...d, form: f }, 64)) expect(Math.hypot(...s.at)).toBeLessThan(d.r);
  });

  it('lie flatter than they are wide, as the cloud does', () => {
    const stars = youngStars({ id: 'c', at: [0, 0, 0], r: 700, seed: 3n, form: 'cloud' }, 256);
    const mean = (k) => stars.reduce((s, x) => s + Math.abs(x.at[k]), 0) / stars.length;
    expect(mean(1)).toBeLessThan(mean(0) * 0.6);
    expect(mean(1)).toBeLessThan(mean(2) * 0.6);
  });

  it('are as big and bright as deep space’s were, each in one of the three colours', () => {
    const stars = youngStars({ id: 'c', at: [0, 0, 0], r: 700, seed: 'c' }, 256);
    for (const s of stars) {
      expect(s.size).toBeGreaterThanOrEqual(0.8);
      expect(s.size).toBeLessThanOrEqual(3.3);
      expect(s.bright).toBeGreaterThanOrEqual(0.5);
      expect(s.bright).toBeLessThanOrEqual(5.5);
      expect([0, 1, 2]).toContain(s.pal);
    }
    expect(new Set(stars.map((s) => s.pal)).size).toBe(3);
  });

  it('differ from seed to seed, and are none when none are asked for', () => {
    const d = { id: 'v', at: [0, 0, 0], r: 700, seed: 1, form: 'cloud' };
    expect(youngStars(d, 8)).not.toEqual(youngStars({ ...d, seed: 2 }, 8));
    expect(youngStars(d, 0)).toEqual([]);
  });
});
