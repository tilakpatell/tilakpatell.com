import { beforeAll, describe, expect, it } from 'vitest';
import { GROUPS, createPhysics } from './world';
import { addHeightfield, addHoledGround } from './heightfield';
import { CELL, heightAt, makeCell } from '../land/cell';
import { landSpec } from '../land/spec';
import { seeded } from '../seeded';

let physics;
beforeAll(async () => {
  physics = await createPhysics();
});

describe('addHeightfield', () => {
  it('is the cell’s ground exactly: 200 rays down hit heightAt', () => {
    const cx = 2;
    const cz = -1;
    const cell = makeCell(landSpec('seven'), cx, cz);
    const hf = addHeightfield(physics, { heights: cell.heights, x: cx * CELL, z: cz * CELL });
    physics.world.step();
    const { Ray } = physics.RAPIER;
    const rand = seeded(42);
    for (let i = 0; i < 200; i++) {
      const lx = rand() * CELL;
      const lz = rand() * CELL;
      const hit = physics.world.castRay(new Ray({ x: cx * CELL + lx, y: 100, z: cz * CELL + lz }, { x: 0, y: -1, z: 0 }), 1000, true);
      expect(hit).toBeTruthy();
      expect(Math.abs(100 - hit.timeOfImpact - heightAt(cell, lx, lz))).toBeLessThan(1e-3);
    }
    physics.remove(hf);
  });

  it('is a floor: a bumper falls through it', () => {
    const hf = addHeightfield(physics, { heights: new Float32Array(65 * 65), x: 0, z: 0 });
    expect(hf.colliders[0].collisionGroups()).toBe(GROUPS.floor); // (the floor's groups: groups.js)
    expect(hf.body.isFixed()).toBe(true);
    physics.remove(hf);
  });
});

describe('addHoledGround', () => {
  // (a flat 64 m ground at 5 m with a hole 10 m square at x 20…30, z 20…30)
  const hole = (x, z) => x > 20 && x < 30 && z > 20 && z < 30;
  const down = (x, z) => physics.world.castRay(new physics.RAPIER.Ray({ x, y: 50, z }, { x: 0, y: -1, z: 0 }), 100, true);

  it('is the ground where there is no hole, and nothing over one', () => {
    const g = addHoledGround(physics, { heights: new Float32Array(65 * 65).fill(5), x: 0, z: 0, hole });
    physics.world.step();
    expect(50 - down(10, 10).timeOfImpact).toBeCloseTo(5, 3);
    expect(50 - down(40, 25).timeOfImpact).toBeCloseTo(5, 3);
    expect(down(25, 25)).toBeNull();
    expect(g.colliders[0].collisionGroups()).toBe(GROUPS.floor);
    physics.remove(g);
  });

  it('is nothing when all of it is a hole', () => {
    expect(addHoledGround(physics, { heights: new Float32Array(65 * 65), hole: () => true })).toBeNull();
  });
});
