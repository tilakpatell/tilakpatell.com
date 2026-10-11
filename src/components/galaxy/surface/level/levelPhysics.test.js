import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPhysics } from '../../../../lib/physics/world';
import { createLevelPhysics, imageHeight, instancesOf, wantsEngine } from './levelPhysics';

const PACK = new URL('../../../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const at = (mesh, x, z, scale = [1, 1, 1]) => ({ mesh, position: [x, 0, z], quaternion: [0, 0, 0, 1], scale });

let physics;
beforeEach(async () => {
  physics = await createPhysics();
});

const bodies = () => physics.world.bodies.len();

function down(x, z) {
  physics.world.step();
  const { Ray } = physics.RAPIER;
  const hit = physics.world.castRay(new Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 }), 1000, true);
  return hit ? 100 - hit.timeOfImpact : null;
}

describe('createLevelPhysics', () => {
  it('adds a cell’s bodies and takes them away again', async () => {
    const lp = createLevelPhysics({ physics, pack, loadBin });
    await lp.addCell('0,0', [at(0, 10, 10), at(0, 20, 10), at(1, 30, 10), at(4, 40, 10)]);
    expect(lp.stats().queued).toBe(3);
    lp.update(Infinity);
    const s = lp.stats();
    expect(s).toMatchObject({ cells: 1, bodies: 3, colliders: 1 + 1 + 3, triangles: 8, queued: 0 });
    // (the two snow piles share one hull)
    expect(s.uniqueShapes).toBe(1 + 3);
    expect(bodies()).toBe(3);
    expect(down(10, 10)).toBeGreaterThan(0.5);
    lp.removeCell('0,0');
    expect(lp.stats().cells).toBe(0);
    expect(bodies()).toBe(0);
  });

  it('puts bodies in a slice at a time', async () => {
    const lp = createLevelPhysics({ physics, pack, loadBin });
    await lp.addCell('0,0', [at(0, 0, 0), at(0, 5, 0), at(0, 10, 0)]);
    expect(lp.update(-1)).toBe(1);
    expect(lp.stats().queued).toBe(2);
    lp.update(Infinity);
    expect(lp.stats().bodies).toBe(3);
  });

  it('drops the lightest over the budget, and says which', async () => {
    const lp = createLevelPhysics({ physics, pack, loadBin, budget: { colliders: 3, triangles: Infinity } });
    // (the decal plane's detail mesh goes first: it has hulls over the same thing)
    await lp.addCell('0,0', [at(0, 0, 0), at(1, 10, 0)]);
    lp.update(Infinity);
    const s = lp.stats();
    expect(s.colliders).toBe(3);
    expect(s.dropped).toEqual([{ cell: '0,0', mesh: 1, hulls: 0, triangles: 8 }]);
  });

  it('reads a cell’s own bin (lane L’s 32-byte records) with its draws', async () => {
    const list = instancesOf(pack.cells['0,0'].draws, await loadBin('cells/0_0.bin'));
    expect(list.map((i) => i.mesh)).toEqual([0, 0, 0]);
    expect(list[1].position).toEqual([20, 0, 10]);
    expect(list[1].quaternion[1]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(list[2].scale).toEqual([-1, 1, 1]);
    const lp = createLevelPhysics({ physics, pack, loadBin });
    await lp.add('0,0', await loadBin('cells/0_0.bin'));
    lp.update(Infinity);
    expect(lp.stats().bodies).toBe(3);
    expect(down(10, 10)).toBeGreaterThan(0.5);
    lp.drop('0,0');
    expect(bodies()).toBe(0);
  });

  it('stops no one with a mesh the tier culls', async () => {
    const lp = createLevelPhysics({ physics, pack, loadBin, tier: 'low', budget: { colliders: 100, triangles: 1000 } });
    await lp.add('1,0', await loadBin('cells/1_0.bin'));
    lp.update(Infinity);
    expect(lp.stats().bodies).toBe(0);
    const hi = createLevelPhysics({ physics, pack, loadBin, tier: 'high' });
    await hi.add('1,0', await loadBin('cells/1_0.bin'));
    hi.update(Infinity);
    expect(hi.stats().bodies).toBe(1);
  });

  it('wants the engine only off phones, above low, on a pack with shapes', () => {
    expect(wantsEngine({ pack, tier: 'high' })).toBe(true);
    // (Rapier by default: a phone and the low tier too)
    expect(wantsEngine({ pack, tier: 'high', small: true })).toBe(true);
    expect(wantsEngine({ pack, tier: 'low' })).toBe(true);
    expect(wantsEngine({ pack: { physics: {} }, tier: 'ultra' })).toBe(false);
  });

  it('lays the ground under a cell from the heights, the far map under a hole', async () => {
    // a 9 × 9 near map at 1 m over (0, 0)…(8, 8), 2 m up, a hole at (4, 4);
    // a far map at 4 m a pixel, 5 m up
    const near = { data: new Float32Array(81).fill(2), w: 9, h: 9, minX: 0, minZ: 0, metresPerPixel: 1 };
    near.data[4 * 9 + 4] = NaN;
    const far = { data: new Float32Array(25).fill(5), w: 5, h: 5, minX: -4, minZ: -4, metresPerPixel: 4 };
    const height = imageHeight({ near, far });
    expect(height(1, 1)).toBe(2);
    expect(height(4, 4)).toBe(5);
    expect(height(12, 12)).toBe(5);
    expect(height(100, 100)).toBe(0);
    const lp = createLevelPhysics({ physics, pack, loadBin, cellSize: 8, terrainCell: 4 });
    lp.setTerrain({ near, far });
    await lp.addCell('0,0', []);
    expect(lp.stats().heightfields).toBe(4);
    expect(down(1.5, 1.5)).toBeCloseTo(2, 4);
    expect(down(4, 4)).toBeCloseTo(5, 4);
    // (never a floor at 0 under the hole)
    expect(down(4, 4)).not.toBeCloseTo(0, 1);
    lp.removeCell('0,0');
    expect(bodies()).toBe(0);
  });

  it('adds nothing for a cell that arrives after dispose', async () => {
    const lp = createLevelPhysics({ physics, pack, loadBin });
    const late = lp.addCell('0,0', [at(0, 0, 0)]);
    lp.dispose();
    await late;
    lp.update(Infinity);
    await lp.addCell('1,0', [at(0, 0, 0)]);
    expect(lp.stats().cells).toBe(0);
    expect(bodies()).toBe(0);
  });

  it('takes a cell away from inside a step without a throw, and leaves nothing', async () => {
    const lp = createLevelPhysics({ physics, pack, loadBin });
    lp.setTerrain(() => 1);
    await lp.addCell('0,0', [at(0, 10, 10), at(3, 40, 40)]);
    lp.update(Infinity);
    expect(bodies()).toBeGreaterThan(2);
    const errors = [];
    const off = physics.onSubstep(() => {
      try {
        lp.removeCell('0,0');
      } catch (e) {
        errors.push(e);
      }
    });
    expect(() => physics.step(1 / 60)).not.toThrow();
    off();
    expect(errors).toEqual([]);
    expect(bodies()).toBe(0);
  });
});
