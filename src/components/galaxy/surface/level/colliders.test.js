import { describe, expect, it } from 'vitest';
import { writeInstances } from '../../../../lib/level/instances';
import { createSolids, groundAt, walk, walker } from '../walker';
import { createColliders } from './colliders';
import { packShapes } from '../../../../lib/physics/shapesBin';

const pack = {
  meshes: [{ bounds: [-4, -0.3, -4, 4, 0, 4] }, { bounds: [-3, 0, -0.25, 3, 4, 0.25] }],
  cells: { '0,0': { draws: [{ mesh: 0, offset: 0, count: 1 }, { mesh: 1, offset: 1, count: 1 }] } },
};
const bin = writeInstances({ count: 2, position: new Float32Array([0, 1, 0, 10, 0, 0]), quaternion: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]), scale: new Float32Array([1, 1, 1, 1, 1, 1]) });

describe('the level’s colliders', () => {
  it('a cell’s floor and wall go into the walk world, off when it goes, on again when it comes back', () => {
    const walk = { heightAt: () => 0, solids: createSolids(), floors: [] };
    const c = createColliders(walk);
    c.add('0,0', pack, bin);
    expect(walk.floors.length).toBe(1);
    expect(walk.solids.all.length).toBe(1);
    expect(groundAt(walk, 1, 1, 2)).toBe(1);
    c.drop('0,0');
    expect(groundAt(walk, 1, 1, 2)).toBe(0);
    expect(walk.solids.all[0].off).toBe(true);
    c.add('0,0', pack, bin);
    expect(walk.floors.length).toBe(1);
    expect(groundAt(walk, 1, 1, 2)).toBe(1);
  });

  it('walking into a wall stops you', () => {
    const walk_ = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: createSolids(), floors: [], reach: 1000 };
    // (the wall turned a quarter: it runs along z, across your way)
    const S = Math.SQRT1_2;
    const turned = writeInstances({ count: 2, position: new Float32Array([0, 1, 0, 10, 0, 0]), quaternion: new Float32Array([0, 0, 0, 1, 0, S, 0, S]), scale: new Float32Array([1, 1, 1, 1, 1, 1]) });
    createColliders(walk_).add('0,0', pack, turned);
    // east from x 7 toward the wall at x 10 (its face at 9.75; the stick's -x is east, looking along +z)
    const s = walker(7, 0, 0, 0);
    s.grounded = true;
    for (let i = 0; i < 120; i++) walk(s, { x: -1, y: 0, heading: 0 }, 1 / 60, walk_);
    expect(s.x).toBeLessThan(9.75);
    expect(s.x).toBeGreaterThan(8);
  });

  it('a mesh the tier dropped leaves no wall behind', () => {
    const walk = { heightAt: () => 0, solids: createSolids(), floors: [] };
    createColliders(walk, 'low').add('0,0', { ...pack, cull: { low: { K: 20, dropped: [1] } } }, bin);
    expect(walk.solids.all.length).toBe(0);
    expect(walk.floors.length).toBe(1);
  });

  it('a mesh with the game’s shapes stands as its hull, not its bounds; a collision mesh’s hull the same', async () => {
    const walk = { heightAt: () => 0, solids: createSolids(), floors: [] };
    // (the wall's own hull: a metre narrower than its drawn bounds each side, from web/collision/)
    const hull = [];
    for (const x of [-2, 2]) for (const y of [0, 4]) for (const z of [-0.25, 0.25]) hull.push(x, y, z);
    const bins = { 'physics/wall.bin': packShapes([{ kind: 'hull', points: hull, part: 0, material: 0, root: 0 }]) };
    const withShapes = { ...pack, physics: { meshes: { 1: { file: 'physics/wall.bin', collision: true } } } };
    const c = createColliders(walk, 'high', { loadBin: async (f) => bins[f] });
    await c.add('0,0', withShapes, bin);
    // (the floor from the plate's bounds, as ever; the wall from its hull)
    expect(walk.floors.length).toBe(1);
    expect(walk.solids.all.length).toBe(1);
    const box = walk.solids.all[0];
    expect(box.hw ?? box.w / 2).toBeCloseTo(2, 3);
  });
});
