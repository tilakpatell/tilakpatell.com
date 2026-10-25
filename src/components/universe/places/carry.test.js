import { describe, expect, it } from 'vitest';
import { OPEN_SPACE, PARK_GAP, SHIP, SOLIDS, autopilot, spawn, step } from '../ship';
import { UNIVERSE, fullSector, moonAt, orbitAt } from '../../expanse/shared/gen';
import { atTime } from './ids';
import { resolvePlace } from './resolve';
import { followPark, parkDistance, parkPlace, placeSpace } from './park';
import { CARRY, carry, carryFrames, carryWeight, carryZone, frameOf } from './carry';

const s = fullSector(UNIVERSE, 1, 0, 0, { things: false });
const planets = s.systems.flatMap((x) => x.planets);
const speed = (p) => (2 * Math.PI * p.orbit * p.revs) / 65536;
const fastest = planets.reduce((a, b) => (speed(b) > speed(a) ? b : a));
const mooned = planets.filter((p) => p.moonList.length).reduce((a, b) => (b.moonList[0].revs > a.moonList[0].revs ? b : a));
const dest = (id) => resolvePlace(id, { t: 0 });
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const xyz = (k) => [k.x, k.y, k.z];
const minus = (a, b) => a.map((v, i) => v - b[i]);
const solidsAt = (p, t) => [...SOLIDS, { id: p.id, at: orbitAt(p, t), r: p.radius, reach: p.radius * 1.9 }, ...p.moonList.map((m) => ({ id: m.id, at: moonAt(m, p, t), r: m.radius, reach: m.radius * 1.9 }))];
// parked at a planet, the stick let go, carried by it for `secs`: how far off its park, and what it bumped
const drift = (p, secs, dt = 0.25) => {
  const d = dest(p.id);
  const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
  let ship = { ...spawn(null), ...park };
  const bumps = [];
  for (let t = 0; t < secs - 1e-9; t += dt) {
    ship = carry(ship, [{ body: d, k: 1 }], t, t + dt);
    const r = step(ship, { throttle: 0 }, dt, solidsAt(p, t + dt), OPEN_SPACE);
    bumps.push(...r.events);
    ship = r.ship;
  }
  return { off: len(xyz(ship), xyz(followPark(d, park, secs))), bumps };
};

describe('the carry', () => {
  it('is all of a body’s motion out to its park and past, none far off, and smooth between', () => {
    expect(CARRY).toEqual({ inner: 2, outer: 4, fade: 2 });
    const z = { inner: 100, outer: 200 };
    expect([carryWeight(0, z), carryWeight(100, z), carryWeight(200, z), carryWeight(1e6, z)]).toEqual([1, 1, 0, 0]);
    for (let d = 100; d < 200; d += 1) expect(Math.abs(carryWeight(d + 1, z) - carryWeight(d, z))).toBeLessThan(0.03);
    for (const p of planets) {
      const d = dest(p.id);
      const zone = carryZone(d);
      expect(zone.inner).toBe(Math.max(2 * d.reach, parkDistance(d) + PARK_GAP.out));
      expect(zone.outer - zone.inner).toBeCloseTo(2 * d.reach, 9);
      expect(carryWeight(parkDistance(d), zone), p.id).toBe(1); // (every park carried in full, a park past the moons too)
    }
  });
  it('moves a ship by its frame’s motion, and by nothing else', () => {
    const d = dest(fastest.id);
    const ship = { ...spawn(null), x: d.at[0] + d.reach + 4, y: d.at[1], z: d.at[2] };
    const dp = minus(atTime(d, 1), atTime(d, 0));
    expect(minus(minus(xyz(carry(ship, [{ body: d, k: 1 }], 0, 1)), xyz(ship)), dp).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    expect(carry(ship, [{ body: d, k: 1 }], 0, 0)).toBe(ship);
    expect(carry(ship, [], 0, 1)).toBe(ship);
    const far = { ...ship, x: d.at[0] + carryZone(d).outer + 1 };
    expect(carry(far, [{ body: d, k: 1 }], 0, 1)).toBe(far);
    expect(carry(ship, [{ body: d, k: 0.5 }], 0, 1).x - ship.x).toBeCloseTo(dp[0] / 2, 9);
  });
  it('takes the trip’s goal for its frame, else where it’s at, and only a planet or a moon', () => {
    const m = mooned.moonList[0];
    const rows = [dest(mooned.id), dest(m.id), dest(s.systems[0].id)];
    expect(frameOf(rows, { here: mooned.id, going: null })?.id).toBe(mooned.id);
    expect(frameOf(rows, { here: mooned.id, going: m.id })?.id).toBe(m.id);
    expect(frameOf(rows, { here: mooned.id, going: 'marvel' })?.id).toBe(mooned.id);
    expect(frameOf(rows, { here: s.systems[0].id, going: null })).toBeNull();
    expect(frameOf(rows, { here: null, going: null })).toBeNull();
  });
  it('fades one frame out as the next comes in', () => {
    const a = dest(mooned.id);
    const b = dest(mooned.moonList[0].id);
    let f = carryFrames([], a, 0);
    expect(f).toEqual([{ body: a, k: 1 }]);
    f = carryFrames(f, b, 0.5);
    expect(f.map((x) => [x.body.id, x.k])).toEqual([
      [a.id, 0.75],
      [b.id, 0.25],
    ]);
    f = carryFrames(f, b, 2);
    expect(f).toEqual([{ body: b, k: 1 }]);
    expect(carryFrames(f, null, 2)).toEqual([]);
  });
  it('hands over from a planet to its moon with no jolt', () => {
    // (flown in by hand at cruise from the planet's park to the moon's, here changing as the moon's zone takes it)
    const p = dest(mooned.id);
    const m = dest(mooned.moonList[0].id);
    const pPark = parkPlace(p, [p.at[0] + 5000, p.at[2]], 0);
    const mPark = parkPlace(m, [pPark.x, pPark.z], 0);
    const dt = 1 / 30;
    let ship = { ...spawn(null), ...pPark };
    let frames = [{ body: p, k: 1 }];
    let atMoon = false;
    let last = null;
    for (let t = 0; t < 400; t += dt) {
      const goal = xyz(followPark(m, mPark, t));
      if (len(xyz(ship), goal) < 1) break;
      atMoon ||= len(xyz(ship), atTime(m, t)) < parkDistance(m) + PARK_GAP.in;
      frames = carryFrames(frames, atMoon ? m : p, dt);
      const carried = carry(ship, frames, t, t + dt);
      const v = minus(xyz(carried), xyz(ship)).map((x) => x / dt);
      if (last) expect(len(v, last), `t ${t.toFixed(2)}`).toBeLessThan(0.05);
      last = v;
      const way = minus(goal, xyz(carried));
      const k = (SHIP.cruise * dt) / Math.hypot(...way);
      ship = { ...carried, x: carried.x + way[0] * k, y: carried.y + way[1] * k, z: carried.z + way[2] * k };
    }
    expect(atMoon).toBe(true);
  });
  it('keeps a ship parked where it parked, stick let go, at the fastest planet and every one that parks past its moons', () => {
    const past = planets.filter((p) => parkDistance(dest(p.id)) > dest(p.id).reach + PARK_GAP.near + 1e-9);
    expect(past.length).toBeGreaterThan(0);
    for (const p of [fastest, ...past]) {
      const { off, bumps } = drift(p, p === fastest ? 300 : 60);
      expect(off, p.id).toBeLessThan(1);
      expect(bumps, p.id).toEqual([]);
    }
  });
  it('brings the autopilot to rest at a fast moon, carried by its goal from the start', () => {
    const m = dest(mooned.moonList[0].id);
    let ship = { ...spawn(null), x: m.at[0] + 900, y: m.at[1], z: m.at[2] };
    const park = parkPlace(m, [ship.x, ship.z], 0);
    const space = placeSpace(OPEN_SPACE, m);
    const dt = 1 / 30;
    let frames = [];
    let done = false;
    for (let t = 0; t < 150 && !done; t += dt) {
      space.goals[m.id].at.splice(0, 3, ...atTime(m, t)); // (as trips.js's followPlace moves it)
      frames = carryFrames(frames, m, dt);
      const a = autopilot(ship, m.id, followPark(m, park, t), space, 1, null, solidsAt(mooned, t).slice(SOLIDS.length));
      done = a.done;
      ship = step(carry(ship, frames, t, t + dt), a.input, dt, solidsAt(mooned, t + dt), space).ship;
    }
    expect(done).toBe(true);
  });
});
