import { describe, expect, it } from 'vitest';
import { ARM_SECONDS, CAPTURE_SECONDS, DEFUSE_SECONDS, FUSE_SECONDS, WALKER_SPEED, arm, capture, escort, hold, insidePolygon, uplink } from './objectives.js';

const square = { points: [[0, 0], [10, 0], [10, 10], [0, 10]] };
const run = (kind, o, seconds, ctx, dt = 0.05) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) kind.tick(o, dt, ctx);
};

describe('the objectives', () => {
  it('knows inside a volume from outside', () => {
    expect(insidePolygon(square.points, 5, 5)).toBe(true);
    expect(insidePolygon(square.points, 11, 5)).toBe(false);
  });

  it('takes a point from neutral in 60 s over the advantage', () => {
    const o = capture.create({ volume: square, meter: 0 });
    run(capture, o, CAPTURE_SECONDS / 2 - 0.5, { inside: { attack: 2, defend: 0 } });
    expect(o.done).toBe(false);
    run(capture, o, 0.5, { inside: { attack: 2, defend: 0 } });
    expect(o.meter).toBeCloseTo(1, 6);
    expect(o.done).toBe(true);
    expect(o.owner).toBe('attack');
  });

  it('caps the crowd at four', () => {
    const o = capture.create({ volume: square, meter: 0 });
    run(capture, o, CAPTURE_SECONDS / 4, { inside: { attack: 9, defend: 0 } });
    expect(o.meter).toBeCloseTo(1, 6);
  });

  it('contested holds', () => {
    const o = capture.create({ volume: square, meter: 0.2 });
    run(capture, o, 10, { inside: { attack: 1, defend: 1 } });
    expect(o.meter).toBeCloseTo(0.2, 9);
    expect(o.contested).toBe(true);
    expect(o.overtime).toBe(true);
    run(capture, o, 6, { inside: { attack: 1, defend: 0 } });
    expect(o.meter).toBeCloseTo(0.3, 6);
    expect(o.contested).toBe(false);
  });

  it('drops a retaken point back toward the defenders at the same rate, and nothing when empty', () => {
    const o = capture.create({ volume: square, meter: 1 });
    run(capture, o, 12, { inside: { attack: 0, defend: 1 } });
    expect(o.meter).toBeCloseTo(0.8, 6);
    expect(o.done).toBe(false);
    run(capture, o, 30, { inside: { attack: 0, defend: 0 } });
    expect(o.meter).toBeCloseTo(0.8, 6);
  });

  it('arms after 6 s held, is defused in 6 s, else goes off 30 s after arming', () => {
    const a = arm.create({ at: [0, 0] });
    const held = (side) => ({ interactions: [{ side, id: 'x', held: true }] });
    run(arm, a, ARM_SECONDS - 0.1, held('attack'));
    expect(a.armed).toBe(false);
    run(arm, a, 0.1, held('attack'));
    expect(a.armed).toBe(true);
    expect(a.fuse).toBe(FUSE_SECONDS);
    run(arm, a, DEFUSE_SECONDS, held('defend'));
    expect(a.armed).toBe(false);
    run(arm, a, ARM_SECONDS, held('attack'));
    run(arm, a, FUSE_SECONDS - 0.1, { interactions: [] });
    expect(a.done).toBe(false);
    run(arm, a, 0.1, { interactions: [] });
    expect(a.done).toBe(true);
  });

  it('starts arming over when the hold is let go', () => {
    const a = arm.create({ at: [0, 0] });
    run(arm, a, 4, { interactions: [{ side: 'attack', id: 'x', held: true }] });
    arm.tick(a, 0.05, { interactions: [] });
    run(arm, a, 4, { interactions: [{ side: 'attack', id: 'x', held: true }] });
    expect(a.armed).toBe(false);
  });

  it('walks the walker only with an attacker near, and fails it at 0 hp', () => {
    const o = escort.create({ path: [[0, 0, 0], [0, 0, 100]], health: 1000 });
    run(escort, o, 10, { near: 0 });
    expect(o.walker.dist).toBe(0);
    run(escort, o, 10, { near: 1 });
    expect(o.walker.dist).toBeCloseTo(10 * WALKER_SPEED, 6);
    expect(o.walker.at[2]).toBeCloseTo(25, 6);
    o.walker.hp = 0;
    escort.tick(o, 0.05, { near: 1 });
    expect(o.failed).toBe(true);
    expect(o.done).toBe(false);
  });

  it('is done when the walker reaches the last point', () => {
    const o = escort.create({ path: [[0, 0, 0], [0, 0, 10]], health: 1000 });
    run(escort, o, 10 / WALKER_SPEED + 0.1, { near: 2 });
    expect(o.done).toBe(true);
  });

  it('holds when attackers alone stand in it long enough', () => {
    const o = hold.create({ volume: square, seconds: 20 });
    run(hold, o, 10, { inside: { attack: 1, defend: 1 } });
    expect(o.held).toBe(0);
    run(hold, o, 20, { inside: { attack: 1, defend: 0 } });
    expect(o.done).toBe(true);
  });

  it('calls a bombing run from an uplink held by a defender, then rests', () => {
    const o = uplink.create({ at: [0, 0] });
    let fired = 0;
    for (let t = 0; t < 30; t += 0.05) {
      uplink.tick(o, 0.05, { interactions: [{ side: 'defend', id: 'r', held: true }] });
      if (o.fired) fired++;
    }
    expect(fired).toBe(1);
    expect(o.rest).toBeGreaterThan(0);
  });
});
