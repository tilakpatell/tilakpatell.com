import { describe, expect, it } from 'vitest';
import { SECTOR, sectorAt, sectorCentre, sectorKey, parseSectorKey, parseSpaceId, spaceId, sameSpaceId } from './address.js';

describe('address', () => {
  it('sectors are 120,000 cubes, rounded to the nearest centre, never -0', () => {
    expect(SECTOR).toBe(120000);
    expect(sectorAt(0, 0, 0)).toEqual([0, 0, 0]);
    expect(Object.is(sectorAt(-1, -1, -1)[0], 0)).toBe(true);
    expect(sectorAt(59999, 60001, -60001)).toEqual([0, 1, -1]);
    expect(sectorCentre(2, -1, 3)).toEqual([240000, -120000, 360000]);
  });
  it('keys keep the old two-number form on the middle layer', () => {
    expect(sectorKey(1, 0, -2)).toBe('E:1,-2');
    expect(sectorKey(1, 3, -2)).toBe('E:1,-2,3');
    expect(parseSectorKey('E:1,-2')).toEqual([1, 0, -2]);
    expect(parseSectorKey('e:1,-2,3')).toEqual([1, 3, -2]);
    expect(parseSectorKey('E:1')).toBeNull();
    expect(parseSectorKey('X:1,2')).toBeNull();
  });
  it('parses every id form, either case', () => {
    expect(parseSpaceId('E:1,0:3')).toEqual({ sx: 1, sy: 0, sz: 0, key: 'E:1,0', system: 3 });
    expect(parseSpaceId('e:1,0:3:2')).toMatchObject({ system: 3, planet: 2 });
    expect(parseSpaceId('e:1,0,4:3:2:1')).toMatchObject({ sy: 4, key: 'E:1,0,4', system: 3, planet: 2, moon: 1 });
    expect(parseSpaceId('E:-2,5:w7')).toMatchObject({ sx: -2, sz: 5, wonder: 7 });
    expect(parseSpaceId('E:1,0:x')).toBeNull();
    expect(parseSpaceId('beacon:E:1,0:n')).toBeNull();
  });
  it('writes ids in the generator’s form and reads its own back', () => {
    expect(spaceId([1, 0, 0], 3, 2)).toBe('E:1,0:3:2');
    expect(spaceId([1, 4, 0], { wonder: 7 })).toBe('E:1,0,4:w7');
    for (const id of ['E:1,0:3', 'E:1,0,4:3:2:1', 'E:-2,5:w7']) {
      const p = parseSpaceId(id);
      const parts = p.wonder !== undefined ? [{ wonder: p.wonder }] : [p.system, p.planet, p.moon].filter((v) => v !== undefined);
      expect(spaceId([p.sx, p.sy, p.sz], ...parts)).toBe(id);
    }
  });
  it('one place, several spellings', () => {
    expect(sameSpaceId('E:1,0:3:2', 'e:1,0,0:3:2')).toBe(true);
    expect(sameSpaceId('E:1,0:3:2', 'E:1,0,1:3:2')).toBe(false);
    expect(sameSpaceId('E:1,0:3:2', 'nonsense')).toBe(false);
  });
});
