import { describe, expect, it } from 'vitest';
import { parseSpaceId, spaceId } from '../../../lib/space/address.js';
import { fullSector, placeIn, placeOf } from './space';
import { UNIVERSE, universeOf } from './seed';
import { moonAt, orbitAt } from './orbits';
import { THING_BASE, THING_CELLS, thingRow } from './things';
import { extentOf } from './extent';
import { STATION_BASE, STATION_SHARE, poleHeight, stationsOf } from './stations';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CUBES = [[1, 0, 0], [0, 0, 1], [2, 1, -3], [0, 0, 0], [-3, -1, 2]];

describe('stations', () => {
  it('number above the lattice, so no id that resolved before changes', () => {
    expect(STATION_BASE).toBe(10000);
    expect(THING_BASE + THING_CELLS ** 3).toBeLessThan(STATION_BASE);
    expect(STATION_SHARE).toBeCloseTo(1 / 3, 12);
  });
  it('one system in three has one, numbered by its system, held by its faction', () => {
    let systems = 0;
    let stations = 0;
    for (const [sx, sy, sz] of CUBES) {
      const s = fullSector(UNIVERSE, sx, sy, sz, { things: false });
      systems += s.systems.length;
      stations += s.stations.length;
      expect(s.stations.map((st) => st.i)).toEqual(s.stations.map((st) => st.i).sort((a, b) => a - b));
      for (const st of s.stations) {
        const sys = s.systems[st.i];
        expect(st.id).toBe(spaceId([sx, sy, sz], { wonder: STATION_BASE + st.i }));
        expect(parseSpaceId(st.id).wonder).toBe(STATION_BASE + st.i);
        expect([st.kind, st.system, st.faction]).toEqual(['station', sys.id, sys.faction]);
        expect(st.name.startsWith(`${sys.name} `)).toBe(true);
        expect(st.size).toBeGreaterThanOrEqual(18);
        expect(st.size).toBeLessThanOrEqual(36);
      }
    }
    expect(stations / systems).toBeGreaterThan(0.28);
    expect(stations / systems).toBeLessThan(0.38);
  });
  it('keeps clear of its star, planets, rings and moons whenever you look, and inside its system', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0, { things: false });
    for (const st of s.stations) {
      const sys = s.systems[st.i];
      expect(st.at[0]).toBe(sys.at[0]);
      expect(st.at[2]).toBe(sys.at[2]);
      // (over or under by exactly the pole's height: y + h itself, since (y + h) - y needn't be h in floats)
      const h = poleHeight(sys, st.size);
      expect([sys.at[1] + h, sys.at[1] - h]).toContain(st.at[1]);
      expect(len(st.at, sys.at)).toBeGreaterThanOrEqual(sys.star.size + 3 * st.size);
      expect(len(st.at, sys.at)).toBeLessThanOrEqual(sys.reach - st.size + 1e-9);
      for (const t of [0, 1234.5, 40000, 1.7e9]) {
        for (const p of sys.planets) {
          expect(len(st.at, orbitAt(p, t))).toBeGreaterThanOrEqual(extentOf(p) + 3 * st.size - 1e-6);
          for (const m of p.moonList) expect(len(st.at, moonAt(m, p, t)) - m.radius).toBeGreaterThan(2 * st.size);
        }
      }
    }
  });
  it('resolves by its id, and nothing past the lattice or a station that isn’t there does', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0);
    const st = s.stations[0];
    expect(placeOf(UNIVERSE, st.id)).toMatchObject({ kind: 'station', row: st });
    expect(placeOf(UNIVERSE, st.id.toLowerCase()).row).toEqual(st);
    const bare = s.systems.find((sys) => !s.stations.some((x) => x.i === sys.i));
    expect(placeOf(UNIVERSE, `E:1,0:w${STATION_BASE + bare.i}`)).toBeNull();
    for (const id of ['E:1,0:w8064', 'E:1,0:w9999', `E:1,0:w${STATION_BASE + 99999}`]) expect(placeOf(UNIVERSE, id), id).toBeNull();
  });
  it('placeIn finds on a sector in hand what placeOf finds', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0);
    const sys = s.systems[3];
    const moon = s.systems.flatMap((x) => x.planets).find((p) => p.moonList.length).moonList[0];
    const ids = [sys.id, sys.planets[0].id, s.stations[0].id, thingRow(s, 0).id, moon.id];
    for (const id of ids) expect(placeIn(s, parseSpaceId(id))?.row, id).toEqual(placeOf(UNIVERSE, id)?.row);
  });
  it('a pocket universe has stations of its own', () => {
    const a = stationsOf(fullSector(UNIVERSE, 1, 0, 0, { things: false })).map((st) => st.name);
    const b = stationsOf(fullSector(universeOf('marble'), 1, 0, 0, { things: false })).map((st) => st.name);
    expect(b).not.toEqual(a);
  });
  it('measures a planet out to its furthest moon, not its last', () => {
    const moon = (orbit, radius) => ({ orbit, radius });
    expect(extentOf({ radius: 10, ringBand: null, moonList: [moon(40, 9), moon(45, 3)] })).toBe(49);
    expect(extentOf({ radius: 10, ringBand: { inner: 13, outer: 30 }, moonList: [] })).toBe(30);
    expect(extentOf({ radius: 10, ringBand: null, moonList: [] })).toBe(10);
  });
});
