import { describe, expect, it } from 'vitest';
import { angleBetween, chartOf, dirOfLatLon, dirOfUv, frameAt, latLonOfDir, unit, uvOfDir } from './sphere';

const near = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const R = 20000;
const c = chartOf(dirOfLatLon(10, 20), R);

describe('unit', () => {
  it('gives a vector its length of one, and never NaN', () => {
    expect(near(unit([3, 0, 4]), [0.6, 0, 0.8], 1e-15)).toBe(true);
    expect(near(unit([0, -2, 0]), [0, -1, 0], 1e-15)).toBe(true);
    expect(unit([0, 0, 0]).every(Number.isFinite)).toBe(true);
  });

  it('hands a unit vector back as it is, so normalising twice changes no bit', () => {
    const d = dirOfLatLon(-41.3, 174.8);
    expect(unit(d)).toBe(d);
    const once = unit([1, 2, 3]);
    expect(unit(once)).toBe(once);
  });
});

describe('the map’s layout', () => {
  it('is the landings’ (landings/biomes.js uvOf): u from −x toward +z, v 0 at the north pole', () => {
    expect(near(dirOfUv(0.5, 0.5), [1, 0, 0])).toBe(true);
    expect(near(dirOfUv(0.25, 0.5), [0, 0, 1])).toBe(true);
    expect(near(dirOfUv(0, 0.5), [-1, 0, 0])).toBe(true);
    expect(near(dirOfUv(0.3, 0), [0, 1, 0])).toBe(true);
    expect(near(uvOfDir([0, 0, 1]), [0.25, 0.5])).toBe(true);
    expect(near(dirOfLatLon(0, 0), dirOfUv(0.5, 0.5))).toBe(true);
    expect(near(latLonOfDir(dirOfLatLon(-33, 151)), [-33, 151], 1e-9)).toBe(true);
  });
});

describe('frameAt', () => {
  it('is up, east and north at right angles, each of length one', () => {
    for (const [lat, lon] of [[0, 0], [10, 20], [-60, -135], [89.9, 3], [-89.9, 170]]) {
      const { up, east, north } = frameAt(dirOfLatLon(lat, lon));
      for (const v of [up, east, north]) expect(Math.abs(dot(v, v) - 1)).toBeLessThan(1e-12);
      expect(Math.abs(dot(up, east)) + Math.abs(dot(up, north)) + Math.abs(dot(east, north))).toBeLessThan(1e-12);
    }
  });
});

describe('chartOf', () => {
  it('puts its middle at its spot, east along +x and north along −z', () => {
    expect(near(c.toDir(0, 0), dirOfLatLon(10, 20))).toBe(true);
    expect(latLonOfDir(c.toDir(500, 0))[1]).toBeGreaterThan(20);
    expect(latLonOfDir(c.toDir(0, -500))[0]).toBeGreaterThan(10);
  });

  it('walks hypot(x, z) metres along the great circle', () => {
    for (const [x, z] of [[300, 0], [-1200, 4000], [9000, -9000]]) expect(angleBetween(c.toDir(0, 0), c.toDir(x, z)) * R).toBeCloseTo(Math.hypot(x, z), 6);
  });

  it('reaches the far side at πR and comes round to where it was after 2πR', () => {
    for (const a of [0, 1, 2.5, 4]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      const d = 3700;
      const once = d + 2 * Math.PI * R;
      expect(near(c.toDir(ux * d, uz * d), c.toDir(ux * once, uz * once), 1e-9)).toBe(true);
      expect(near(c.toDir(ux * Math.PI * R, uz * Math.PI * R), c.at.map((v) => -v), 1e-9)).toBe(true);
    }
  });

  it('reads a direction back to the chart inside the first turn', () => {
    for (const [x, z] of [[0, 0], [250, -40], [-30000, 12000], [50000, 20000]]) expect(near(c.toChart(c.toDir(x, z)), [x, z], 1e-6)).toBe(true);
  });

  it('has a frame at the poles too, and never answers NaN', () => {
    for (const at of [[0, 1, 0], [0, -1, 0]]) {
      const f = frameAt(at);
      expect([...f.east, ...f.north].every(Number.isFinite)).toBe(true);
      expect(Math.abs(f.east[0] * f.north[0] + f.east[1] * f.north[1] + f.east[2] * f.north[2])).toBeLessThan(1e-12);
    }
    for (const [x, z] of [[0, 0], [Math.PI * R, 0], [1e7, -3e6]]) expect(c.toDir(x, z).every(Number.isFinite)).toBe(true);
    expect(c.toChart(c.at.map((v) => -v)).every(Number.isFinite)).toBe(true);
  });

  it('reads the far side as [πR, 0]', () => {
    expect(c.toChart(c.at.map((v) => -v))).toEqual([Math.PI * R, 0]);
  });
});
