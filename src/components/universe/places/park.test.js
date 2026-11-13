import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, PARK_GAP, SOLIDS, autopilot, clearOf, forward, spawn, step } from '../ship';
import { UNIVERSE, extentOf, fullSector, thingRow } from '../../expanse/shared/gen';
import { atTime } from './ids';
import { resolvePlace } from './resolve';
import { followPark, gapRadius, moonGap, parkDistance, parkPlace, placeSpace } from './park';

const s = fullSector(UNIVERSE, 1, 0, 0);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const at = (k) => [k.x, k.y, k.z];
const faces = (park, c) => {
  const [fx, fz] = forward(park.heading);
  const dx = c[0] - park.x;
  const dz = c[2] - park.z;
  return (fx * dx + fz * dz) / Math.hypot(dx, dz);
};
// a moon's circle round its planet, as moonAt draws it
const circle = (m, a) => {
  const x = m.orbit * Math.cos(a);
  const z = m.orbit * Math.sin(a);
  return [x, -z * Math.sin(m.tilt), z * Math.cos(m.tilt)];
};

describe('parking at a generated place', () => {
  it('parks off a planet facing it, mostly on its day side, and never where a moon goes by', () => {
    const planets = s.systems.slice(0, 40).flatMap((x) => x.planets);
    let day = 0;
    for (const p of planets) {
      const d = resolvePlace(p.id, { t: 0 });
      const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
      expect(len(at(park), d.at)).toBeGreaterThanOrEqual(d.reach + PARK_GAP.near - 1e-6);
      expect(Math.hypot(park.offset[0], park.offset[2])).toBeCloseTo(parkDistance(d), 6);
      expect(faces(park, d.at)).toBeGreaterThan(0.99);
      expect(park.offset).toEqual([park.x - d.at[0], park.y - d.at[1], park.z - d.at[2]]);
      for (const m of p.moonList) {
        expect(moonGap(park.offset, m)).toBeGreaterThanOrEqual(clearOf(m.radius) - 1e-9);
        for (let i = 0; i < 64; i++) expect(len(park.offset, circle(m, (i / 64) * 2 * Math.PI))).toBeGreaterThanOrEqual(moonGap(park.offset, m) - 1e-9);
      }
      const star = d.src.system.at;
      if ((park.x - d.at[0]) * (star[0] - d.at[0]) + (park.z - d.at[2]) * (star[2] - d.at[2]) >= 0) day++;
    }
    expect(day / planets.length).toBeGreaterThan(0.8);
  });
  it('parks a planet just past its furthest moon when no way in is clear, about one in thirty', () => {
    const mooned = s.systems.flatMap((x) => x.planets).filter((p) => p.moonList.length);
    const past = mooned.filter((p) => {
      const d = resolvePlace(p.id, { t: 0 });
      return parkDistance(d) > d.reach + PARK_GAP.near + 1e-9;
    });
    expect(past.length).toBeGreaterThan(0);
    expect(past.length / mooned.length).toBeLessThan(0.08);
    for (const p of past) {
      const d = resolvePlace(p.id, { t: 0 });
      expect(parkDistance(d)).toBeCloseTo(Math.max(d.reach + PARK_GAP.near, ...p.moonList.map((m) => m.orbit + clearOf(m.radius))), 9);
    }
  });
  it('parks off a system’s star in a gap between its planets’ orbits', () => {
    for (const sys of s.systems.slice(0, 60)) {
      const d = resolvePlace(sys.id, { t: 0 });
      const park = parkPlace(d, [0, 0], 0);
      const r = Math.hypot(park.x - sys.at[0], park.z - sys.at[2]);
      expect(r).toBeCloseTo(gapRadius(sys, d.reach + PARK_GAP.deep, PARK_GAP.deep + 40), 6);
      expect(r).toBeCloseTo(parkDistance(d), 6);
      expect(park.y).toBe(sys.at[1]);
      for (const p of sys.planets) expect(Math.abs(r - p.orbit)).toBeGreaterThanOrEqual(extentOf(p) + PARK_GAP.deep + 40 - 1e-6);
    }
  });
  it('keeps its offset as the place goes round', () => {
    const d = resolvePlace(s.systems[1].planets[0].id, { t: 0 });
    const park = parkPlace(d, [0, 0], 0);
    const later = followPark(d, park, 30000);
    expect(len(at(later), atTime(d, 30000))).toBeCloseTo(len(at(park), d.at), 9);
    expect([later.heading, later.offset]).toEqual([park.heading, park.offset]);
  });
  it('puts the place in a trip’s own space, leaving every other goal as it was', () => {
    const d = resolvePlace(s.stations[0].id, { t: 0 });
    const space = placeSpace(OPEN_SPACE, d);
    expect(space.goals[d.id]).toEqual({ id: d.id, at: d.at, r: d.r, reach: d.reach });
    expect(space.goals[d.id].at).not.toBe(d.at);
    expect(OPEN_SPACE.goals[d.id]).toBeUndefined();
    expect(Object.keys(space.goals).length).toBe(Object.keys(OPEN_SPACE.goals).length + 1);
  });
  it('flies there on the autopilot and stops, out in the open on the pulse drive', () => {
    const row = thingRow(s, 0);
    const d = resolvePlace(row.id, { t: 0 });
    let ship = { ...spawn(null), x: d.at[0] + 3000, y: d.at[1], z: d.at[2] };
    const park = parkPlace(d, [ship.x, ship.z], 0);
    const space = placeSpace(OPEN_SPACE, d);
    let done = false;
    for (let t = 0; t < 60 && !done; t += 1 / 30) {
      const a = autopilot(ship, d.id, park, space, 1);
      done = a.done;
      ship = step(ship, a.input, 1 / 30, SOLIDS, space).ship;
    }
    expect(done).toBe(true);
    expect(len(at(ship), at(park))).toBeLessThan(0.6);
  });
});
