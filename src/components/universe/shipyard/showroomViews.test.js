import { describe, expect, it } from 'vitest';
import { RAIL } from './rail';
import { HOME_VIEW, VIEWS, easeAngle, easeTo, facing, viewFor } from './showroomViews';

describe('the showroom’s views', () => {
  it('has a view for every slot on the rail, and the home view for none', () => {
    for (const slot of RAIL) expect(VIEWS[slot], slot).toBeDefined();
    expect(viewFor(null)).toBe(HOME_VIEW);
    expect(viewFor('nothing')).toBe(HOME_VIEW);
    for (const v of Object.values(VIEWS)) {
      expect(v.lift).toBeGreaterThanOrEqual(0.05);
      expect(v.lift).toBeLessThanOrEqual(1);
      expect(v.near).toBeGreaterThan(0.5);
      expect(v.near).toBeLessThanOrEqual(1);
    }
  });

  it('turns the side a part is on to the camera', () => {
    // (the nose is −z and the camera stands at +z: at yaw 0 the tail faces it, at π the nose)
    expect(facing(viewFor('fins').yaw)).toBe('tail');
    expect(facing(viewFor('engines').yaw)).toBe('tail');
    expect(facing(viewFor('booster').yaw)).toBe('side');
    expect(facing(viewFor('thrusters').yaw)).toBe('side');
    expect(facing(viewFor('guns').yaw)).toBe('nose');
    expect(facing(viewFor('cockpit').yaw)).toBe('nose');
    expect(facing(HOME_VIEW.yaw)).toBe('nose');
  });

  it('looks from above at what sits on top, and low at what hangs underneath', () => {
    expect(viewFor('shields').lift).toBeGreaterThan(HOME_VIEW.lift);
    expect(viewFor('wings').lift).toBeGreaterThan(HOME_VIEW.lift);
    expect(viewFor('guns').lift).toBeLessThan(HOME_VIEW.lift);
    expect(viewFor('ordnance').lift).toBeLessThan(HOME_VIEW.lift);
  });

  it('eases toward a number and never past it', () => {
    expect(easeTo(0, 1, 0)).toBe(0);
    const a = easeTo(0, 1, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(easeTo(0, 1, 10)).toBeCloseTo(1, 5);
  });

  it('eases an angle the short way round', () => {
    // (from just under a full turn to just over none: forwards through 2π, not back through π)
    const from = 2 * Math.PI - 0.1;
    const next = easeAngle(from, 0.1, 0.05);
    expect(next).toBeGreaterThan(from);
    expect(easeAngle(0.1, 2 * Math.PI - 0.1, 0.05)).toBeLessThan(0.1);
    expect(easeAngle(1, 1, 0.5)).toBe(1);
  });
});
