import { describe, expect, it } from 'vitest';
import { ORBIT, orbitPose } from './orbit.js';

describe('orbitPose', () => {
  it('stands in front of a body facing +Z at yaw 0', () => {
    const p = orbitPose({ at: [1, 2, 3], yaw: 0 }, { yaw: 0, dist: 4 });
    expect(p.at[0]).toBeCloseTo(1);
    expect(p.at[2]).toBeCloseTo(7);
    expect(p.at[1]).toBeCloseTo(2 + ORBIT.height);
    expect(p.lookAt).toEqual([1, 2 + ORBIT.look, 3]);
    expect(p.fov).toBe(ORBIT.fov);
  });
  it('turns with the body unless asked for the world bearing', () => {
    const side = orbitPose({ at: [0, 0, 0], yaw: Math.PI / 2 }, { yaw: Math.PI / 2, dist: 2 });
    expect(side.at[0]).toBeCloseTo(0);
    expect(side.at[2]).toBeCloseTo(-2);
    const world = orbitPose({ at: [0, 0, 0], yaw: Math.PI / 2 }, { yaw: 0, dist: 2, world: true });
    expect(world.at[2]).toBeCloseTo(2);
  });
});
