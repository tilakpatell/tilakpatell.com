import { describe, expect, it } from 'vitest';
import { REGION, regionsAround, waysideAt } from './wayside';
import { PROPS } from './props';
import { SURFACE_MODELS } from './catalog';

const green = { reach: 590, ground: { seed: 92 }, flora: { biome: 'temperate' } };
const bare = { reach: 590, ground: { seed: 71 }, flora: { biome: 'dry' } };
const regions = (site) => {
  const out = [];
  for (let i = -12; i < 12; i++) for (let j = -12; j < 12; j++) out.push(waysideAt(site, i, j));
  return out;
};

describe('waysideAt', () => {
  it('is the same place every visit, and another region another', () => {
    expect(waysideAt(green, 4, -3)).toEqual(waysideAt(green, 4, -3));
    const some = regions(green).filter(Boolean);
    expect(new Set(some.map((w) => w.id)).size).toBe(some.length);
  });

  it('holds a place in about half the regions, none in or by the core', () => {
    const all = regions(green);
    const some = all.filter(Boolean);
    expect(some.length / all.length).toBeGreaterThan(0.4);
    expect(some.length / all.length).toBeLessThan(0.65);
    expect(some.every((w) => Math.hypot(...w.at) >= 590 + 300)).toBe(true);
    expect(waysideAt(green, 0, 0)).toBeNull();
  });

  it('stands each place inside its region, its things about it on the ground’s plan', () => {
    for (let i = -6; i < 6; i++)
      for (let j = -6; j < 6; j++) {
        const w = waysideAt(green, i, j);
        if (!w) continue;
        expect(w.at[0]).toBeGreaterThanOrEqual(i * REGION);
        expect(w.at[0]).toBeLessThanOrEqual((i + 1) * REGION);
        expect(w.things.length).toBeGreaterThanOrEqual(3);
        for (const t of w.things) expect(Math.hypot(t.at[0] - w.at[0], t.at[1] - w.at[1])).toBeLessThan(15);
      }
  });

  it('turns up camps, ruins and downed fighters on a green world, outposts and wrecks on a bare one', () => {
    const kinds = (site) => new Set(regions(site).filter(Boolean).map((w) => w.kind));
    expect([...kinds(green)].sort()).toEqual(['camp', 'ruin', 'wreck']);
    expect([...kinds(bare)].sort()).toEqual(['camp', 'outpost', 'wreck']);
    const wreck = regions(bare).find((w) => w?.kind === 'wreck');
    expect(['xwing', 'ywing', 'tiefighter']).toContain(wreck.things[0].kind);
    expect(wreck.things[0].roll).toBeGreaterThan(0);
  });

  it('stands only things the scene can place', () => {
    const kinds = new Set([...regions(green), ...regions(bare)].filter(Boolean).flatMap((w) => w.things.map((t) => t.kind)));
    expect(kinds.size).toBeGreaterThan(8);
    for (const k of kinds) expect(Boolean(PROPS[k] || SURFACE_MODELS[k]), k).toBe(true);
  });
});

describe('regionsAround', () => {
  it('lists the regions whose middles are within reach', () => {
    const near = regionsAround(5200, -3100, 1600);
    expect(near).toContainEqual([5, -4]);
    expect(near.every(([i, j]) => Math.hypot((i + 0.5) * REGION - 5200, (j + 0.5) * REGION + 3100) <= 1600)).toBe(true);
    expect(near.length).toBeGreaterThan(4);
  });
});
