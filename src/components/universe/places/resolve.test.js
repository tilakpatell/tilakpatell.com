import { describe, expect, it } from 'vitest';
import { UNIVERSE, fullSector, moonAt, orbitAt, thingRow, universeOf } from '../../expanse/shared/gen';
import { atTime, canonicalPlace, isPlaceId } from './ids';
import { parkPlace } from './park';
import { lookupOf, resolvePlace } from './resolve';

const s = fullSector(UNIVERSE, 1, 0, 0);
const sys = s.systems[0];
const p = sys.planets[0];
const withMoons = s.systems.flatMap((x) => x.planets).find((q) => q.moonList.length);

describe('the resolver', () => {
  it('reads every spelling of a generated id as one place, in the generator’s form', () => {
    expect(canonicalPlace('e:1,0:3:2')).toBe('E:1,0:3:2');
    expect(canonicalPlace('E:1,0,0:3:2')).toBe('E:1,0:3:2');
    expect(canonicalPlace('e:1,0,2:w64')).toBe('E:1,0,2:w64');
    expect(canonicalPlace('e:1,0,0:0:1')).toBe('E:1,0:0:1'); // (a link, /universe/e:1,0,0:0:1)
    for (const bad of ['marvel', 'beacon:E:1,0:n', 'E:1,0:x', '', null, 42, '__proto__']) {
      expect(canonicalPlace(bad), String(bad)).toBeNull();
      expect(isPlaceId(bad), String(bad)).toBe(false);
    }
  });
  it('makes a system, a planet on its orbit, a moon, a station and a thing into destinations', () => {
    expect(resolvePlace('e:1,0:0', { t: 0 })).toMatchObject({ id: sys.id, generated: true, place: 'system', kind: 'star', name: sys.name, at: sys.at, moving: false, sector: 'main', key: 'E:1,0', cube: [1, 0, 0], to: null });
    expect(resolvePlace(p.id, { t: 1000 })).toMatchObject({ place: 'planet', kind: 'world', at: orbitAt(p, 1000), t: 1000, moving: true, system: sys.id });
    expect(resolvePlace('e:1,0,0:0:1', { t: 0 })).toMatchObject({ id: 'E:1,0:0:1', place: 'planet', name: sys.planets[1].name });
    const m = withMoons.moonList[0];
    expect(resolvePlace(m.id, { t: 50 }).at).toEqual(moonAt(m, withMoons, 50));
    expect(resolvePlace(s.stations[0].id, { t: 0 })).toMatchObject({ place: 'station', kind: 'station', dock: true, at: s.stations[0].at });
    const thing = thingRow(s, 0);
    expect(resolvePlace(thing.id, { t: 0 })).toMatchObject({ place: 'thing', name: thing.name, at: thing.at });
  });
  it('is nothing for what isn’t there, and never throws', () => {
    expect(s.stations.some((st) => st.i === 3)).toBe(false); // (so w10003 is a system with no station)
    for (const id of [`E:1,0:${s.systems.length}`, `${sys.id}:${sys.planets.length}`, `${p.id}:${p.moonList.length}`, 'E:1,0:0:99', 'E:1,0:w60', 'E:1,0:w9999', 'E:1,0:w10003', 'nonsense', undefined]) {
      expect(resolvePlace(id, { t: 0 }), String(id)).toBeNull();
    }
  });
  it('looks in the sectors it is given before making one, and makes none when told not to', () => {
    const doctored = { ...s, systems: s.systems.map((x, i) => (i === 0 ? { ...x, name: 'Testing' } : x)) };
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['E:1,0', doctored]]) }).name).toBe('Testing');
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map(), build: false })).toBeNull();
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['E:1,0', doctored]]), build: false }).name).toBe('Testing');
    // (by the sector's own id, whatever the Map calls it: lane 2's chunk grid keys its cells 'cx,cy,cz')
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: new Map([['1,0,0', doctored]]), build: false }).name).toBe('Testing');
    expect(resolvePlace('E:1,0:0', { t: 0, sectors: [doctored], build: false }).name).toBe('Testing');
    expect(lookupOf({ t: 0 }).place('e:1,0:0')).toMatchObject({ id: sys.id, name: sys.name });
    expect(lookupOf({ t: 0, sectors: new Map(), build: false }).place('E:1,0:0')).toBeNull();
  });
  it('lends a lookup that parks too, in the shape nav.js takes', () => {
    expect(lookupOf({ t: 0 }).park('e:1,0:0', [0, 0])).toEqual(parkPlace(resolvePlace(sys.id, { t: 0 }), [0, 0], 0));
    expect(lookupOf({ t: 0, sectors: new Map(), build: false }).park('E:1,0:0', [0, 0])).toBeNull();
    expect(lookupOf({ t: 0 }).park('nonsense', [0, 0])).toBeNull();
  });
  it('resolves in the universe it’s given', () => {
    expect(resolvePlace('E:1,0:0', { t: 0, universe: universeOf('marble') }).name).not.toBe(sys.name);
  });
  it('says where a place is at any time, and reads the shared clock by default', () => {
    const d = resolvePlace(p.id, { t: 0 });
    expect(atTime(d, 9e8)).toEqual(orbitAt(p, 9e8));
    expect(atTime(resolvePlace(sys.id, { t: 0 }), 9e8)).toEqual(sys.at);
    expect(Math.abs(resolvePlace(sys.id).t - Date.now() / 1000)).toBeLessThan(5);
  });
  it('moves a thing by the mover it carries, and a thing with none stays put', () => {
    const thing = resolvePlace(thingRow(s, 0).id, { t: 0 });
    expect([thing.move, thing.moving]).toEqual([null, false]);
    const comet = { ...thing, move: (row, t) => [row.at[0] + t, row.at[1], row.at[2]] }; // (as a lane 4a card's would ride)
    expect(atTime(comet, 10)).toEqual([thing.src.row.at[0] + 10, thing.src.row.at[1], thing.src.row.at[2]]);
    expect(atTime(thing, 10)).toEqual(thing.src.row.at);
  });
});
