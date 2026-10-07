import { describe, expect, it } from 'vitest';
import { WALK, createSolids, groundAt, pushOut, ride, rider, walk, walker } from './walker';

const flat = (h = 0, extra = {}) => ({ heightAt: () => h, normalAt: () => [0, 1, 0], reach: 500, ...extra });
const run = (s, input, secs, world, fn = walk) => {
  const out = [];
  for (let t = 0; t < secs; t += 1 / 60) out.push(fn(s, input, 1 / 60, world));
  return out;
};

describe('on foot', () => {
  it('walks the way the stick points, from the camera, and turns to face it', () => {
    const s = walker();
    run(s, { x: 0, y: 1, heading: 0 }, 2, flat());
    expect(s.z).toBeGreaterThan(WALK.walk * 1.6);
    expect(Math.abs(s.x)).toBeLessThan(0.01);
    expect(s.yaw).toBeCloseTo(0, 3);
    // the camera turned a quarter round (looking along +x): forward is +x
    const t = walker();
    run(t, { x: 0, y: 1, heading: Math.PI / 2 }, 2, flat());
    expect(t.x).toBeGreaterThan(5);
    expect(t.yaw).toBeCloseTo(Math.PI / 2, 2);
    // and right is the camera's right
    const u = walker();
    run(u, { x: 1, y: 0, heading: 0 }, 1, flat());
    expect(u.x).toBeLessThan(-2);
  });

  it('runs faster than it walks', () => {
    const a = walker();
    const b = walker();
    run(a, { x: 0, y: 1, heading: 0 }, 3, flat());
    run(b, { x: 0, y: 1, heading: 0, run: true }, 3, flat());
    expect(b.z).toBeGreaterThan(a.z * 1.8);
  });

  it('jumps, and comes down where it took off', () => {
    const s = walker(0, 0, 2);
    s.y = 2;
    const outs = run(s, { x: 0, y: 0, jump: true }, 0.05, flat(2));
    expect(outs.some((o) => o.jumped)).toBe(true);
    let top = 0;
    for (let i = 0; i < 120; i++) {
      walk(s, { x: 0, y: 0 }, 1 / 60, flat(2));
      top = Math.max(top, s.y);
    }
    expect(top).toBeGreaterThan(2.7);
    expect(s.y).toBe(2);
    expect(s.grounded).toBe(true);
  });

  it('follows the ground up and down a gentle slope without leaving it', () => {
    const world = { heightAt: (x, z) => z * 0.2, normalAt: () => [0, 0.98, -0.196], reach: 500 };
    const s = walker();
    for (let i = 0; i < 300; i++) {
      walk(s, { x: 0, y: 1, heading: 0, run: true }, 1 / 60, world);
      expect(s.grounded).toBe(true);
    }
    expect(s.y).toBeCloseTo(s.z * 0.2, 5);
    for (let i = 0; i < 300; i++) walk(s, { x: 0, y: 1, heading: Math.PI, run: true }, 1 / 60, world);
    expect(s.y).toBeCloseTo(s.z * 0.2, 5);
  });

  it('won’t climb a cliff', () => {
    // a wall of rock from z = 5 on
    const world = { heightAt: (x, z) => (z > 5 ? (z - 5) * 4 : 0), normalAt: (x, z) => (z > 5 ? [0, 0.24, -0.97] : [0, 1, 0]), reach: 500 };
    const s = walker();
    run(s, { x: 0, y: 1, heading: 0 }, 5, world);
    expect(s.z).toBeLessThan(5.6);
    expect(s.y).toBeLessThan(2.5);
  });

  it('stops against trees and walls, and slides round them', () => {
    const solids = createSolids();
    solids.circle(0, 5, 1);
    solids.box(10, 5, 3, 0.5);
    const s = walker();
    run(s, { x: 0, y: 1, heading: 0 }, 3, flat(0, { solids }));
    expect(Math.hypot(s.x, s.z - 5)).toBeGreaterThanOrEqual(1 + WALK.radius - 1e-6);
    const b = walker(10, 0);
    run(b, { x: 0, y: 1, heading: 0 }, 3, flat(0, { solids }));
    expect(b.z).toBeLessThanOrEqual(4.5 - WALK.radius + 1e-6);
  });

  it('pushes out of a box turned any way, through its nearest side', () => {
    const solids = createSolids();
    const box = solids.box(0, 0, 2, 1, Math.PI / 4);
    // just inside one long side
    const p = pushOut(box, 0.6, -0.6, 0.3);
    expect(p).not.toBeNull();
    expect(pushOut(box, 10, 10, 0.3)).toBeNull();
    expect(solids.near(0, 0, 1)).toContain(box);
    expect(solids.near(100, 100, 1)).not.toContain(box);
  });

  it('stands on a floor over the land, and falls off its edge', () => {
    const world = flat(-50, { floors: [{ x: 0, z: 0, r: 10, y: 3 }] });
    expect(groundAt(world, 0, 0, 3)).toBe(3);
    expect(groundAt(world, 0, 20, 3)).toBe(-50);
    // (a floor high over your head isn't under you)
    expect(groundAt(world, 0, 0, -50)).toBe(-50);
    const s = walker(0, 0, 3);
    s.y = 3;
    run(s, { x: 0, y: 1, heading: 0 }, 1, world);
    expect(s.y).toBe(3);
    run(s, { x: 0, y: 1, heading: 0, run: true }, 3, world);
    expect(s.grounded).toBe(false);
    expect(s.y).toBeLessThan(0);
  });

  it('keeps inside the world', () => {
    const s = walker(0, 0);
    run(s, { x: 0, y: 1, heading: 0, run: true }, 100, flat(0, { reach: 50 }));
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(50 + 1e-6);
  });

  it('wades in water whose level is a function of where you are (a pool here, dry there)', () => {
    const pool = (x) => (x < 0 ? 0 : null);
    const s = walker();
    s.x = -5;
    run(s, { x: 0, y: 0, heading: 0 }, 1, flat(-3, { water: pool }));
    expect(s.y).toBeCloseTo(-WALK.wade, 5);
    const t = walker();
    t.x = 5;
    run(t, { x: 0, y: 0, heading: 0 }, 1, flat(-3, { water: pool }));
    expect(t.y).toBeCloseTo(-3, 5);
    expect(t.wading).toBe(0);
  });

  it('wades, slower, and no deeper than its knees', () => {
    const world = flat(-3, { water: 0 });
    const s = walker(0, 0, -3);
    s.y = -3;
    run(s, { x: 0, y: 1, heading: 0 }, 2, world);
    expect(s.y).toBeCloseTo(-WALK.wade, 5);
    expect(s.wading).toBe(1);
    expect(s.z).toBeLessThan(WALK.walk * 2 * 0.6);
  });
});

describe('riding', () => {
  const BIKE = { top: 30, boost: 45, accel: 18, brake: 30, turn: 1.6, hover: 1, bank: 0.5, radius: 0.8, grip: 0.92 };

  it('speeds up to its top speed, faster boosting, and holds its height', () => {
    const s = rider(0, 0, 0);
    run(s, { x: 0, y: 1 }, 4, flat(0), (st, i, dt, w) => ride(st, i, dt, w, BIKE));
    expect(s.speed).toBeCloseTo(30, 0);
    expect(s.y).toBeGreaterThan(0.7);
    expect(s.y).toBeLessThan(1.3);
    run(s, { x: 0, y: 1, run: true }, 3, flat(0), (st, i, dt, w) => ride(st, i, dt, w, BIKE));
    expect(s.speed).toBeGreaterThan(40);
  });

  it('steers, and banks into the turn', () => {
    const s = rider(0, 0, 0);
    run(s, { x: 0, y: 1 }, 1, flat(0), (st, i, dt, w) => ride(st, i, dt, w, BIKE));
    run(s, { x: 1, y: 1 }, 0.5, flat(0), (st, i, dt, w) => ride(st, i, dt, w, BIKE));
    expect(s.yaw).toBeLessThan(-0.3); // (right, from +z, is toward -x)
    expect(s.bank).toBeGreaterThan(0.1);
  });

  it('flies: climbs while jump is held, holds its ceiling, sinks when let go, and never goes under the floor', () => {
    const CAR = { ...BIKE, hover: 0, fly: { alt: 6, climb: 8, floor: 0 } };
    const s = rider(0, 0, 0);
    run(s, { x: 0, y: 1, jump: true }, 2, flat(0), (st, i, dt, w) => ride(st, i, dt, w, CAR));
    expect(s.y).toBeGreaterThan(5.5);
    expect(s.y).toBeLessThanOrEqual(6.05);
    run(s, { x: 0, y: 1 }, 0.5, flat(0), (st, i, dt, w) => ride(st, i, dt, w, CAR));
    expect(s.y).toBeLessThan(5);
    expect(s.y).toBeGreaterThan(3);
    // (over nothing: the ground far below, the floor holds it up)
    const v = rider(0, 0, 0);
    run(v, { x: 0, y: 1 }, 3, flat(-40), (st, i, dt, w) => ride(st, i, dt, w, CAR));
    expect(v.y).toBeGreaterThanOrEqual(0);
  });

  it('hits a tree: stopped short, slowed, thrown back', () => {
    const solids = createSolids();
    solids.circle(0, 30, 1.5);
    const s = rider(0, 0, 0);
    const outs = run(s, { x: 0, y: 1, run: true }, 4, flat(0, { solids }), (st, i, dt, w) => ride(st, i, dt, w, BIKE));
    expect(outs.some((o) => o.hit > 5)).toBe(true);
    expect(s.z).toBeLessThan(30);
  });
});

describe('a line of sight', () => {
  it('is clear across open ground and blocked by a wall, and clear with no solids at all', async () => {
    const { createSolids, lineClear } = await import('./walker');
    const solids = createSolids();
    solids.box(10, 0, 0.5, 8);
    expect(lineClear(solids, { x: 0, z: 0 }, { x: 20, z: 0 })).toBe(false);
    expect(lineClear(solids, { x: 0, z: 0 }, { x: 20, z: 6 })).toBe(false);
    expect(lineClear(solids, { x: 0, z: 0 }, { x: 20, z: 20 })).toBe(true); // (past the wall's end)
    expect(lineClear(solids, { x: 0, z: 12 }, { x: 20, z: 12 })).toBe(true);
    expect(lineClear(solids, { x: 0, z: 0 }, { x: 5, z: 0 })).toBe(true);
    expect(lineClear(null, { x: 0, z: 0 }, { x: 20, z: 0 })).toBe(true);
  });
});
