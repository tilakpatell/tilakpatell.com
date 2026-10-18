import { describe, expect, it } from 'vitest';
import { ORBIT_CYCLE, REV_K, bodiesAt, moonAt, orbitAt, revsFor, spaceTime } from './orbits';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const planet = { id: 'E:1,0:0:0', at: [241000, 30, 5000], centre: [240000, 0, 5000], orbit: 1000, revs: revsFor(1000), radius: 40 };
const moon = { id: 'E:1,0:0:0:0', orbit: 120, phase: 1.1, revs: revsFor(120), tilt: 0.2, radius: 6 };

describe('orbitAt', () => {
  it('is where the generator put it at t = 0, and keeps its distance', () => {
    expect(len(orbitAt(planet, 0), planet.at)).toBeLessThan(1e-9);
    for (const t of [1, 1e3, 1e6, 1.7e9]) expect(len(orbitAt(planet, t), planet.centre)).toBeCloseTo(len(planet.at, planet.centre), 6);
  });
  it('goes round a whole number of times a cycle, so the end of one meets the start of the next', () => {
    expect([ORBIT_CYCLE, REV_K, revsFor(1000), revsFor(250), revsFor(2600)]).toEqual([65536, 4, 4, 32, 1]);
    expect(len(orbitAt(planet, ORBIT_CYCLE), orbitAt(planet, 0))).toBeLessThan(1e-6);
    for (const k of [1, 7, 26855]) expect(len(orbitAt(planet, k * ORBIT_CYCLE - 1e-3), orbitAt(planet, k * ORBIT_CYCLE + 1e-3))).toBeLessThan(1e-3);
  });
  it('stays smooth with the clock days or years from its epoch', () => {
    const most = (2 * Math.PI * len(planet.at, planet.centre) * planet.revs) / ORBIT_CYCLE / 60;
    for (const t0 of [1.7e9, 1e10]) {
      const step = len(orbitAt(planet, t0 + 1 / 60), orbitAt(planet, t0));
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(most + 1e-6);
    }
  });
  it('carries a moon round its planet, and lists a system’s bodies where they are', () => {
    for (const t of [0, 500, 1e9]) expect(len(moonAt(moon, planet, t), orbitAt(planet, t))).toBeCloseTo(120, 6);
    const sys = { id: 'E:1,0:0', at: planet.centre, star: { size: 150 }, planets: [{ ...planet, moonList: [moon] }] };
    expect(bodiesAt(sys, 0).map((b) => [b.id, b.kind])).toEqual([['E:1,0:0', 'star'], [planet.id, 'planet'], [moon.id, 'moon']]);
  });
  it('starts a moon at its phase in the x-z plane, tilted about x, and lets a tilted one leave that plane', () => {
    const base = orbitAt(planet, 0);
    const off = moonAt(moon, planet, 0).map((v, a) => v - base[a]);
    const { orbit: o, phase: f, tilt: k } = moon;
    const want = [o * Math.cos(f), -o * Math.sin(f) * Math.sin(k), o * Math.sin(f) * Math.cos(k)];
    off.forEach((v, a) => expect(v).toBeCloseTo(want[a], 9));
    let off_plane = 0;
    for (const t of [0, 3000, 9000, 20000, 40000]) off_plane = Math.max(off_plane, Math.abs(moonAt(moon, planet, t)[1] - orbitAt(planet, t)[1]));
    expect(off_plane).toBeGreaterThan(1);
    const flat = { ...moon, tilt: 0 };
    for (const t of [0, 3000, 9000]) expect(moonAt(flat, planet, t)[1] - orbitAt(planet, t)[1]).toBeCloseTo(0, 9);
  });
  it('reads the shared clock in seconds', () => expect(spaceTime(1.5e12)).toBe(1.5e9));
});
