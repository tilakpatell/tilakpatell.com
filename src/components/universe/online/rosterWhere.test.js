import { describe, expect, it } from 'vitest';
import { rosterWhere } from './rosterWhere';
import { UNIVERSE } from './where';
import { makeSector } from '../../expanse/gen/sector';
import { fullSector } from '../../expanse/gen/space';
import { UNIVERSE as SHARED } from '../../expanse/gen/seed';

import { POSITIONS } from '../layout';

describe('rosterWhere', () => {
  it('names the region a pilot in the universe is in, after its place', () => {
    const [x, y, z] = POSITIONS.middleearth;
    expect(rosterWhere(UNIVERSE, { x: x + 300, y, z })).toBe('Universe · Near Middle-earth');
  });
  it('says so when they are out in the void between the regions', () => {
    expect(rosterWhere(UNIVERSE, { x: 40000, y: 0, z: 40000 })).toBe('Universe · the void');
  });
  it('names the home system and the Rick and Morty sector', () => {
    expect(rosterWhere(UNIVERSE, { x: 0, y: 0, z: 200 })).toBe('Universe · the home system');
    expect(rosterWhere(UNIVERSE, { x: 0, y: 0, z: -66000 })).toBe('Universe · the Central Finite Curve');
  });
  it('names the place alone without a pose, or anywhere off the map', () => {
    expect(rosterWhere(UNIVERSE, null)).toBe('the universe');
    expect(rosterWhere('/galaxy/hoth', { x: 0, y: 0, z: 0 })).toBe('Hoth');
    expect(rosterWhere('/deathstar', null)).toBe('the Death Star');
  });
  it('says the Expanse sector of a pose with one, and the system nearby', () => {
    const sec = makeSector(SHARED, 1, 0);
    const [x, y, z] = sec.systems[0].at;
    expect(rosterWhere(UNIVERSE, { x: x + 50, y, z, sec: 'E:1,0' })).toBe(`Universe · E:1,0 · ${sec.systems[0].name}`);
    expect(rosterWhere(UNIVERSE, { x: 120000 + 59000, y: 0, z: 59000, sec: 'E:1,0' })).toMatch(/^Universe · E:1,0/);
  });
  it('names the nearest system of a sector above the middle layer', () => {
    const sec = fullSector(SHARED, 1, 1, 0, { things: false });
    const [x, y, z] = sec.systems[0].at;
    expect(rosterWhere(UNIVERSE, { x: x + 50, y, z, sec: 'E:1,0,1' })).toBe(`Universe · E:1,0,1 · ${sec.systems[0].name}`);
  });
});
