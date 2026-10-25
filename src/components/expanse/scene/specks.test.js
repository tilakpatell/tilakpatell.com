import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import * as sectors from './sectors';
import { WONDER, WONDER_SPECK, slotOf, starsOf } from './specks';

// a hex colour's bytes
const bytes = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('a sector’s specks', () => {
  const sector = addBodies(makeSector(UNIVERSE, 2, -1)); // (three wonders)

  it('has a speck for each star, then each wonder, from the sector’s middle', () => {
    const s = starsOf(sector);
    const n = sector.systems.length + sector.wonders.length;
    expect(sector.wonders.length).toBeGreaterThan(0);
    expect(s.count).toBe(n);
    expect([s.at.length, s.color.length, s.r.length]).toEqual([3 * n, 3 * n, n]);
    const each = [
      ...sector.systems.map((sys) => [sys.at, sys.star.color, sys.star.size]),
      ...sector.wonders.map((w) => [w.at, WONDER[w.kind].color, w.size * WONDER_SPECK]),
    ];
    each.forEach(([at, color, r], i) => {
      for (let k = 0; k < 3; k++) expect(s.at[i * 3 + k]).toBeCloseTo(at[k] - sector.origin[k], 2);
      expect([...s.color.subarray(i * 3, i * 3 + 3)]).toEqual(bytes(color));
      expect(s.r[i]).toBe(Math.fround(r));
    });
  });

  it('leaves the wonders out when asked', () => {
    const all = starsOf(sector);
    const s = starsOf(sector, { wonders: false });
    const n = sector.systems.length;
    expect(s.count).toBe(n);
    expect([...s.at]).toEqual([...all.at.subarray(0, 3 * n)]);
    expect([...s.color]).toEqual([...all.color.subarray(0, 3 * n)]);
    expect([...s.r]).toEqual([...all.r.subarray(0, n)]);
  });

  it('is the far layer’s slot with the sector’s middle and key', () => {
    const slot = slotOf(sector);
    expect(slot).toEqual({ centre: sector.origin, key: sector.id, ...starsOf(sector) });
    expect(slot.centre).not.toBe(sector.origin);
  });

  it('is what sectors.js lends, by the same names', () => {
    expect(sectors.slotOf).toBe(slotOf);
    expect(sectors.WONDER).toBe(WONDER);
    expect(sectors.WONDER_SPECK).toBe(WONDER_SPECK);
  });

  it('imports no three.js, React or page, so a worker runs it', () => {
    const src = readFileSync(new URL('./specks.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"](three|react)/);
    expect(src).not.toMatch(/\b(window|document)\./);
  });
});
