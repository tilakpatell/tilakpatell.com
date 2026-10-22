import { describe, expect, it } from 'vitest';
import { siteOf } from '.';

// a world's cities (sites/city.js, cityBlocks.js) laid into the world by siteFrom
const corellia = siteOf('corellia');
const coronet = corellia.places.find((p) => p.id === 'coronet');
const from = (at) => Math.hypot(at[0] - coronet.at[0], at[1] - coronet.at[1]);
const cityRows = corellia.scatter.filter((r) => r.city);
const buildings = cityRows.filter((r) => r.model?.startsWith('kit:city/Building_'));

describe('a world’s cities, in the world', () => {
  it('builds Coronet City’s blocks round from the city kit, each building solid', () => {
    const all = buildings.flatMap((r) => r.items);
    expect(all.length).toBeGreaterThan(150);
    expect(all.every((it) => from(it.at) < coronet.city.r && it.box)).toBe(true);
    expect(buildings.every((r) => r.solid)).toBe(true);
    // (its streets tiled, under foot, not in the way)
    const street = cityRows.find((r) => r.model === 'kit:city/Street_2Lane');
    expect(street.items.length).toBeGreaterThan(300);
    expect(street.solid).toBe(false);
  });

  it('keeps its buildings off the place’s own landmarks: each stands in a square', () => {
    for (const spire of coronet.things.filter((t) => t.kind === 'coronetspire'))
      for (const it of buildings.flatMap((r) => r.items)) expect(Math.hypot(it.at[0] - spire.at[0], it.at[1] - spire.at[1])).toBeGreaterThan(24);
  });

  it('flattens the ground under the whole city and its edge’s streets, and walks and flies them', () => {
    expect(coronet.flat.r).toBeGreaterThan(coronet.city.r + 12);
    const life = corellia.life.filter((a) => a.city);
    expect(life.filter((a) => a.kind === 'villager')).toHaveLength(coronet.city.crowd.n);
    expect(life.filter((a) => a.kind === 'airspeeder')).toHaveLength(coronet.city.traffic.n);
    expect(life.every((a) => a.path.every((q) => from(q) < coronet.city.r + 10))).toBe(true);
  });

  it('paves its streets and squares into the ground, in the world', () => {
    const paving = corellia.paving;
    expect(paving.filter((s) => s.a && s.w === 12).length).toBeGreaterThan(30);
    expect(paving.filter((s) => s.w === 48)).toHaveLength(3);
    for (const s of paving) for (const q of [s.a, s.b]) expect(from(q)).toBeLessThan(coronet.flat.r);
  });

  it('leaves the landing spot clear of the city', () => {
    const tiles = cityRows.flatMap((r) => r.items);
    expect(Math.min(...tiles.map((it) => Math.hypot(it.at[0] - corellia.land.at[0], it.at[1] - corellia.land.at[1])))).toBeGreaterThan(40);
  });
});
