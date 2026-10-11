import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { writeInstances } from '../../../../lib/level/instances';
import { createSolids, groundAt, walk, walker } from '../walker';
import { createColliders } from './colliders';

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
});

describe('the level’s colliders from the game’s shapes', () => {
  const PACK = new URL('../../../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
  const shaped = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
  const loadBin = async (file) => {
    const b = readFileSync(new URL(file, PACK));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };

  it('a cell’s hulls are its walls, and a cell dropped while they are read comes in off', async () => {
    const bin = await loadBin('cells/0_0.bin');
    const walk = { heightAt: () => 0, solids: createSolids(), floors: [] };
    const c = createColliders(walk, 'high', { loadBin });
    await c.add('0,0', shaped, bin);
    expect(walk.solids.all).toHaveLength(3); // (the three piles’ hulls, not their bounds)
    expect(walk.solids.all.every((s) => s.tag === 'level:0,0' && !s.off)).toBe(true);
    const late = { heightAt: () => 0, solids: createSolids(), floors: [] };
    const d = createColliders(late, 'high', { loadBin });
    const pending = d.add('0,0', shaped, bin);
    d.drop('0,0');
    await pending;
    expect(late.solids.all.length).toBeGreaterThan(0);
    expect(late.solids.all.every((s) => s.off)).toBe(true);
  });
});
