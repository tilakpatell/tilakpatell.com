import { afterEach, describe, expect, it } from 'vitest';
import { AREAS, PURE_FROM, RARE_FROM, REGION_KINDS, areaOf, distanceOf, raresAt, setRegions } from './areas';
import { GOODS } from './goods';
import { STATION_TYPES, stationTypeOf, tradesOf } from './stations';

afterEach(() => setRegions(null));

describe('where a sector is', () => {
  it('names only goods there are', () => {
    for (const a of Object.values(AREAS)) for (const id of [...a.specialties, ...a.wants, ...a.rares]) expect(GOODS[id], id).toBeTruthy();
    for (const t of Object.values(STATION_TYPES)) for (const id of [...t.makes, ...t.needs]) expect(GOODS[id], id).toBeTruthy();
  });

  it('measures from the Core, and calls sector 0 the Core', () => {
    expect(distanceOf([3, -7, 2])).toBe(7);
    expect(areaOf([0, 0, 0])).toMatchObject({ id: 'core', danger: 0, richness: 0, d: 0 });
  });

  it('gives each block past it a region kind, the same every time', () => {
    const a = areaOf([12, 0, -5]);
    expect(REGION_KINDS).toContain(a.id);
    expect(areaOf([12, 0, -5])).toEqual(a);
    expect(a.danger).toBeGreaterThan(0);
  });

  it('takes the layout session’s regions once handed them', () => {
    setRegions(([sx]) => (sx === 2 ? { kind: 'neighbourhood', id: 'heroes', name: 'Hero Reach', danger: 0.2, richness: 0.4 } : null));
    expect(areaOf([2, 0, 0])).toMatchObject({ id: 'heroes', kind: 'neighbourhood', danger: 0.2, richness: 0.4 });
    expect(areaOf([5, 0, 0]).id).toBe('core');
    setRegions(() => ({ kind: 'forge', id: 'forge-17', danger: 9 }));
    expect(areaOf([5, 0, 0])).toMatchObject({ id: 'forge', danger: 1 });
  });

  it('finds rares only far out, and the pure grade further', () => {
    expect(raresAt({ id: 'grave' }, RARE_FROM - 1)).toEqual([]);
    expect(raresAt({ id: 'grave' }, RARE_FROM)).toEqual(['relics']);
    expect(raresAt({ id: 'deep' }, PURE_FROM)).toEqual(['voidcrystal', 'exotic', 'voidcrystal-pure', 'exotic-pure']);
  });
});

describe('a station’s trade', () => {
  it('gives the same seed the same type, and a forge mostly industry', () => {
    expect(stationTypeOf(42n, { id: 'forge' })).toBe(stationTypeOf(42n, { id: 'forge' }));
    const n = Array.from({ length: 200 }, (_, i) => stationTypeOf(i, { id: 'forge', kind: 'region' })).filter((t) => t === 'industry').length;
    expect(n).toBeGreaterThan(80);
  });

  it('sells what it makes, its area’s specialties and the basics, and buys everything', () => {
    const t = tradesOf('mining', { id: 'heroes' });
    expect(t.sells).toEqual(expect.arrayContaining(['iron', 'vibranium', 'energon', 'food']));
    expect(t.buys).toHaveLength(Object.keys(GOODS).length);
    expect(t.sells.some((id) => GOODS[id].rare)).toBe(false);
  });
});
