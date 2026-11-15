import { describe, expect, it } from 'vitest';
import { extentOf } from '../extent';
import { orbitAt } from '../orbits';
import { UNIVERSE } from '../seed';
import { fullSector, placeOf } from '../space';
import { poleHeight } from '../stations';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sectors = [[1, 0, 0], [2, 0, 0], [1, 1, 0]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z, { lattice: false }));
const stations = sectors.flatMap((s) => s.stations);
const all = (list) => sectors.flatMap((s) => s.extras[list]);

describe('fleets and shipyards at the stations', () => {
  it('anchors a fleet at one station in two and a shipyard at one in four', () => {
    const f = all('fleet').length / stations.length;
    const y = all('shipyard').length / stations.length;
    expect(f).toBeGreaterThanOrEqual(0.38);
    expect(f).toBeLessThanOrEqual(0.62);
    expect(y).toBeGreaterThanOrEqual(0.12);
    expect(y).toBeLessThanOrEqual(0.35);
  });
  it('sits a fleet on its station’s pole, further out, flying its system’s colours', () => {
    for (const s of sectors)
      for (const f of s.extras.fleet) {
        const st = s.stations.find((x) => x.id === f.station);
        const sys = s.systems[st.i];
        expect(f.at[0]).toBe(st.at[0]);
        expect(f.at[2]).toBe(st.at[2]);
        expect(Math.abs(f.at[1] - sys.at[1])).toBeCloseTo(Math.abs(st.at[1] - sys.at[1]) + 3 * st.size + f.size, 6);
        expect(Math.sign(f.at[1] - sys.at[1])).toBe(Math.sign(st.at[1] - sys.at[1]));
        expect(f.faction).toEqual(sys.faction);
      }
  });
  it('builds a shipyard over the other pole, clear of every planet at every time', () => {
    for (const s of sectors)
      for (const y of s.extras.shipyard) {
        const st = s.stations.find((x) => x.id === y.station);
        const sys = s.systems[st.i];
        expect(Math.abs(y.at[1] - sys.at[1])).toBeCloseTo(poleHeight(sys, y.size), 6);
        expect(Math.sign(y.at[1] - sys.at[1])).toBe(-Math.sign(st.at[1] - sys.at[1]));
        for (const t of [0, 1e4, 1.7e9]) for (const p of sys.planets) expect(len(y.at, orbitAt(p, t))).toBeGreaterThanOrEqual(extentOf(p) + y.size);
      }
  });
  it('makes neither in the core', () => {
    const core = fullSector(UNIVERSE, 0, 0, 0, { lattice: false });
    expect(core.extras.fleet).toEqual([]);
    expect(core.extras.shipyard).toEqual([]);
  });
  it('resolves both by their ids, as plain data', () => {
    const s = sectors[0];
    expect(placeOf(UNIVERSE, 'E:1,0:w50000').row).toEqual(s.extras.fleet[0]);
    expect(placeOf(UNIVERSE, 'E:1,0:w60000').row).toEqual(s.extras.shipyard[0]);
    expect(structuredClone(s.extras.fleet)).toEqual(s.extras.fleet);
    expect(structuredClone(s.extras.shipyard)).toEqual(s.extras.shipyard);
  });
});
