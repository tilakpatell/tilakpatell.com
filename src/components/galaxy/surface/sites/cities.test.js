import { describe, expect, it } from 'vitest';
import { siteOf } from '.';

// a world's cities (sites/city.js) laid into the world by siteFrom
const corellia = siteOf('corellia');
const coronet = corellia.places.find((p) => p.id === 'coronet');
const from = (at) => Math.hypot(at[0] - coronet.at[0], at[1] - coronet.at[1]);
const cityRows = corellia.scatter.filter((r) => r.city);

describe('a world’s cities, in the world', () => {
  it('stands Coronet City’s buildings round its place, a few rows of them, each solid', () => {
    const buildings = cityRows.filter((r) => r.kind.startsWith('coronet')).flatMap((r) => r.items);
    expect(buildings.length).toBeGreaterThan(30);
    expect(buildings.every((it) => from(it.at) < coronet.city.r && it.box)).toBe(true);
    expect(cityRows.every((r) => r.solid)).toBe(true);
  });

  it('keeps them off the place’s own landmarks', () => {
    const spire = coronet.things.find((t) => t.kind === 'coronetspire');
    for (const it of cityRows.flatMap((r) => r.items)) expect(Math.hypot(it.at[0] - spire.at[0], it.at[1] - spire.at[1])).toBeGreaterThan(6);
  });

  it('flattens the ground under the whole city and walks and flies its streets', () => {
    expect(coronet.flat.r).toBeGreaterThanOrEqual(coronet.city.r);
    const life = corellia.life.filter((a) => a.city);
    expect(life.filter((a) => a.kind === 'villager')).toHaveLength(coronet.city.crowd.n);
    expect(life.filter((a) => a.kind === 'airspeeder')).toHaveLength(coronet.city.traffic.n);
    expect(life.every((a) => a.path.every((q) => from(q) < coronet.city.r + 10))).toBe(true);
  });

  it('paves its streets and plaza into the ground, in the world', () => {
    const paving = corellia.paving;
    expect(paving.filter((s) => s.a).length).toBeGreaterThan(8);
    expect(paving.find((s) => !s.a && !s.w)).toEqual({ at: coronet.at, r: coronet.city.plaza });
    for (const s of paving.filter((q) => q.a)) for (const q of [s.a, s.b]) expect(from(q)).toBeCloseTo(coronet.city.r, 6);
  });
});
