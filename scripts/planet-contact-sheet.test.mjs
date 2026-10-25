import { describe, expect, it } from 'vitest';
import { seeded } from '../src/lib/seeded.js';
import { KEEP, SUN, argsOf, drawPlanets, lightOf, systemPlanets } from './planet-contact-sheet.mjs';

// a sector as makeSector lays it, every type a few times in every system
const TYPES = ['rock', 'ice', 'gas', 'lava', 'ocean', 'desert', 'forest', 'ringed'];
const sectorOf = (sx, sz) => ({
  systems: [0, 1, 2].map((i) => ({ planets: TYPES.map((type, j) => ({ id: `E:${sx},${sz}:${i}:${j}`, type })) })),
});
const typeOf = (id) => TYPES[Number(id.split(':').pop())];

describe('the contact sheet’s draw', () => {
  it('stops at count, with kept types only, none twice and none of the roster', () => {
    const roster = new Set(['e:2,3:0:0', 'e:-4,1:1:1']);
    const ids = drawPlanets({ count: 40, random: seeded(1), sectorOf, roster });
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    for (const id of ids) {
      expect(id).toBe(id.toLowerCase());
      expect(KEEP).toContain(typeOf(id));
      expect(roster.has(id)).toBe(false);
    }
  });

  it('never asks for home or the seeded sector, nor past ±30', () => {
    const asked = [];
    const spy = (sx, sz) => (asked.push([sx, sz]), sectorOf(sx, sz));
    drawPlanets({ count: 200, random: seeded(7), sectorOf: spy });
    expect(asked.length).toBeGreaterThanOrEqual(200);
    for (const [sx, sz] of asked) {
      expect(Math.abs(sx)).toBeLessThanOrEqual(30);
      expect(Math.abs(sz)).toBeLessThanOrEqual(30);
      expect(['0,0', '1,0']).not.toContain(`${sx},${sz}`);
    }
    // (both ends of the range are reached)
    expect(Math.min(...asked.map(([x]) => x))).toBeLessThan(-20);
    expect(Math.max(...asked.map(([, z]) => z))).toBeGreaterThan(20);
  });

  it('draws the same planets from the same seed', () => {
    const a = drawPlanets({ count: 12, random: seeded(3), sectorOf });
    expect(drawPlanets({ count: 12, random: seeded(3), sectorOf })).toEqual(a);
    expect(drawPlanets({ count: 12, random: seeded(4), sectorOf })).not.toEqual(a);
  });

  it('gives back fewer, and ends, when the universe hasn’t enough', () => {
    const gas = () => ({ systems: [{ planets: [{ id: 'E:5,5:0:0', type: 'gas' }] }, { planets: [] }] });
    expect(drawPlanets({ count: 24, random: seeded(1), sectorOf: gas })).toEqual([]);
    const empty = () => ({ systems: [] });
    expect(drawPlanets({ count: 24, random: seeded(1), sectorOf: empty })).toEqual([]);
  });
});

describe('a system’s sheet', () => {
  it('lays a system’s kept planets in its order, lower case, the roster’s left out', () => {
    const system = sectorOf(4, -2).systems[1];
    expect(systemPlanets(system)).toEqual(['e:4,-2:1:0', 'e:4,-2:1:1', 'e:4,-2:1:3', 'e:4,-2:1:4', 'e:4,-2:1:5', 'e:4,-2:1:6']);
    expect(systemPlanets(system, new Set(['e:4,-2:1:1']))).not.toContain('e:4,-2:1:1');
  });

  it('is empty for a system that isn’t there', () => {
    expect(systemPlanets(undefined)).toEqual([]);
  });
});

describe('the ground’s light', () => {
  it('comes from the north-west, 40° up', () => {
    // chart +x is east and −z north
    const s = Math.cos((40 * Math.PI) / 180) / Math.SQRT2;
    expect(SUN[0]).toBeCloseTo(-s, 12);
    expect(SUN[1]).toBeCloseTo(Math.sin((40 * Math.PI) / 180), 12);
    expect(SUN[2]).toBeCloseTo(-s, 12);
  });

  it('is 0.55 + 0.45 × the sun’s height on the flat, more on a slope that faces it, and never under 0.55', () => {
    expect(lightOf(0, 0)).toBeCloseTo(0.55 + 0.45 * Math.sin((40 * Math.PI) / 180), 12);
    // a slope rising to the south-east faces the north-west
    expect(lightOf(0.5, 0.5)).toBeGreaterThan(lightOf(0, 0));
    expect(lightOf(-0.5, -0.5)).toBeLessThan(lightOf(0, 0));
    expect(lightOf(-50, -50)).toBe(0.55);
    expect(lightOf(0.5, 0.5)).toBeLessThanOrEqual(1);
  });
});

describe('the contact sheet’s arguments', () => {
  it('has 24 planets, seed 1 and lab/planets/contact by default', () => {
    expect(argsOf([])).toEqual({ count: 24, seed: 1, out: 'lab/planets/contact', system: null });
  });

  it('reads --count, --seed and --out', () => {
    expect(argsOf(['--count', '6', '--seed', '-9', '--out', 'lab/planets/six'])).toEqual({ count: 6, seed: -9, out: 'lab/planets/six', system: null });
  });

  it('reads --system as a system of the middle layer, in either case', () => {
    expect(argsOf(['--system', 'E:12,-7:3']).system).toEqual({ id: 'e:12,-7:3', sx: 12, sz: -7, i: 3 });
    expect(argsOf(['--system', 'e:-1,0:0']).system).toEqual({ id: 'e:-1,0:0', sx: -1, sz: 0, i: 0 });
    for (const id of ['E:12,-7', 'E:12,-7:3:1', 'E:12,-7,2:3', 'E:12,-7:w1', 'nowhere']) expect(() => argsOf(['--system', id]), id).toThrow(/system/);
  });

  it('refuses a count or a seed that isn’t a whole number, and a flag it doesn’t know', () => {
    expect(() => argsOf(['--count', '0'])).toThrow(/count/);
    expect(() => argsOf(['--count', 'many'])).toThrow(/count/);
    expect(() => argsOf(['--seed', '1.5'])).toThrow(/seed/);
    expect(() => argsOf(['--out'])).toThrow(/out/);
    expect(() => argsOf(['--size', '3'])).toThrow(/--size/);
  });
});
