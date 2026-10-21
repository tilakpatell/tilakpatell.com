import { describe, expect, it } from 'vitest';
import { SPAN, housesFor, townOf } from './town';
import { seeded } from '../../../lib/seeded.js';
import FOOT from './sites/footprints.json';
import { PROPS } from './props';
import { SURFACE_MODELS } from './catalog';
import { siteOf } from './sites';

const sand = { ground: { detail: 'sand' } };
const green = { ground: { detail: 'grass' } };
const grey = { ground: { detail: 'gravel' } };
const houses = (site, seed = 1) => {
  const kit = housesFor(site);
  return townOf(seeded(seed), site).filter(([k, , , more]) => more?.seat && kit.houses.includes(k) && Math.abs(more.yaw) === Math.PI / 2);
};

describe('a small town in the wilds', () => {
  it('builds of what its ground builds, or of the world’s own city where it has one', () => {
    expect(housesFor(sand).houses).toContain('tathouse');
    expect(housesFor(sand).end).toBe('cantina');
    expect(housesFor(green).houses).toContain('kestrohouse');
    expect(housesFor(grey).houses).toContain('nevarrohouse');
    expect(housesFor({ ...grey, places: [{ city: { kit: [{ kind: 'kafreneshack' }, 'lothalblock'] } }] }).houses).toEqual(['kafreneshack']);
    expect(housesFor(siteOf('corellia')).houses).toEqual(['coronetshop', 'coronetblock']);
  });

  it('lines its street both sides with houses facing in, none standing in another or in the street', () => {
    for (let seed = 1; seed < 30; seed++) {
      const got = houses(sand, seed);
      expect(got.length).toBeGreaterThanOrEqual(4);
      for (const side of [-1, 1]) {
        const row = got.filter(([, x]) => Math.sign(x) === side).sort((a, b) => a[2] - b[2]);
        for (const [k, x, , more] of row) {
          // (its front, its own +z, turned to the street's middle)
          expect(Math.sin(more.yaw)).toBeCloseTo(-side, 6);
          expect(Math.abs(x) - (FOOT[k][1] * more.scale) / 2).toBeGreaterThanOrEqual(4.5);
        }
        for (let i = 1; i < row.length; i++) {
          const [ka, , za, a] = row[i - 1];
          const [kb, , zb, b] = row[i];
          expect(zb - za).toBeGreaterThan((FOOT[ka][0] * a.scale + FOOT[kb][0] * b.scale) / 2);
        }
      }
    }
  });

  it('keeps everything within its span, and stands only what the scene can place', () => {
    for (const site of [sand, green, grey, siteOf('corellia')])
      for (const [k, x, z] of townOf(seeded(5), site)) {
        expect(Math.hypot(x, z) + (FOOT[k] ? Math.hypot(FOOT[k][0], FOOT[k][1]) / 2 : 0)).toBeLessThan(SPAN + 12);
        expect(Boolean(PROPS[k] || SURFACE_MODELS[k]), k).toBe(true);
      }
  });

  it('lights a settled street, not a desert one', () => {
    expect(townOf(seeded(2), green).some(([k]) => k === 'lamp')).toBe(true);
    expect(townOf(seeded(2), sand).some(([k]) => k === 'lamp')).toBe(false);
    expect(townOf(seeded(2), sand).some(([k]) => k === 'vaporator')).toBe(true);
  });
});
