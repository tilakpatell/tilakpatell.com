import { describe, expect, it } from 'vitest';
import { WALK, ahead, look, startWalk, stepWalk } from './walk';

// a flat field with water past z < −10 and a post at [0, −5]
const FIELD = { floorAt: (x, z) => (z < -10 ? -1 : 0.2), level: 0, bounds: { x0: -50, x1: 50, z0: -50, z1: 50 }, solids: [] };
const walkFor = (s, input, seconds, world = FIELD) => {
  for (let t = 0; t < seconds; t += 1 / 60) s = stepWalk(s, input, 1 / 60, world);
  return s;
};

describe('walking on foot', () => {
  it('goes the way you face at a walk, and faster with Shift', () => {
    const walked = walkFor(startWalk([0, 0], 0), { forward: 1 }, 2);
    expect(walked.x).toBeCloseTo(0, 6);
    expect(walked.z).toBeLessThan(-3.5); // (yaw 0 looks down −z)
    expect(walked.speed).toBeCloseTo(WALK.speed, 1);
    const ran = walkFor(startWalk([0, 0], 0), { forward: 1, run: true }, 1.5);
    expect(ran.speed).toBeCloseTo(WALK.run, 1);
  });

  it('steps sideways to the right with D, and is no faster on a diagonal', () => {
    const s = walkFor(startWalk([0, 0], 0), { strafe: 1 }, 1);
    expect(s.x).toBeGreaterThan(1.5);
    const d = walkFor(startWalk([0, 0], 0), { forward: 1, strafe: 1 }, 2);
    expect(d.speed).toBeLessThanOrEqual(WALK.speed + 1e-6);
  });

  it('turns with the yaw: a quarter turn left walks toward −x', () => {
    const s = walkFor(startWalk([0, 0], Math.PI / 2), { forward: 1 }, 1);
    expect(s.x).toBeLessThan(-1.5);
    expect(Math.abs(s.z)).toBeLessThan(1e-6);
    expect(ahead(Math.PI / 2)[0]).toBeCloseTo(-1, 6);
  });

  it('comes to a stop when you let go', () => {
    const moving = walkFor(startWalk([0, 0], 0), { forward: 1 }, 1);
    const stopped = walkFor(moving, {}, 1);
    expect(stopped.speed).toBeLessThan(0.01);
  });

  it('stops at the water’s edge, sliding along it rather than sticking', () => {
    const s = walkFor(startWalk([0, -8], 0.6), { forward: 1 }, 6);
    expect(FIELD.floorAt(s.x, s.z)).toBeGreaterThanOrEqual(-WALK.wade);
    expect(s.z).toBeGreaterThanOrEqual(-10);
    expect(s.x).toBeLessThan(-3); // (it slid along the shore the way it was leaning)
  });

  it('is held back by the world’s pace (the dementors’ cold), never pushed past a walk', () => {
    const free = walkFor(startWalk([0, 20], 0), { forward: 1 }, 2);
    const held = walkFor(startWalk([0, 20], 0), { forward: 1 }, 2, { ...FIELD, pace: 0.4 });
    const over = walkFor(startWalk([0, 20], 0), { forward: 1 }, 2, { ...FIELD, pace: 3 });
    expect(20 - held.z).toBeCloseTo((20 - free.z) * 0.4, 1);
    expect(over.z).toBeCloseTo(free.z, 5);
  });

  it('goes round a post, never into it', () => {
    const world = { ...FIELD, solids: [{ at: [0, -5], r: 0.5 }] };
    let s = startWalk([0.1, 0], 0);
    for (let t = 0; t < 4; t += 1 / 60) {
      s = stepWalk(s, { forward: 1 }, 1 / 60, world);
      expect(Math.hypot(s.x - 0, s.z + 5)).toBeGreaterThanOrEqual(0.5 + WALK.radius - 1e-6);
    }
  });

  it('keeps inside the grounds', () => {
    const s = walkFor(startWalk([45, 0], -Math.PI / 2), { forward: 1, run: true }, 4);
    expect(s.x).toBeLessThanOrEqual(50);
  });

  it('looks round by a drag, never over the top', () => {
    const s = look(startWalk([0, 0], 0), 100, -10000);
    expect(s.yaw).toBeCloseTo(-100 * WALK.turn, 9);
    expect(s.pitch).toBe(WALK.pitch[1]);
    expect(look(s, 0, 10000).pitch).toBe(WALK.pitch[0]);
  });
});
