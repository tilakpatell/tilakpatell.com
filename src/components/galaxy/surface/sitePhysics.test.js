import { describe, expect, it } from 'vitest';
import { BURY, CELL, SLAB, TALL, cellsAround, createSitePhysics, floorBody, solidBody } from './sitePhysics';
import { createSolids } from './walker';

const flat = () => 2;

// a stand-in for lib/physics/world.js: what was added and removed
function fakePhysics() {
  const live = new Set();
  return {
    live,
    RAPIER: { HeightFieldFlags: { FIX_INTERNAL_EDGES: 1 } },
    add(desc) {
      const body = { desc, on: true, enable(v) { this.on = v; } };
      live.add(body);
      return body;
    },
    remove(body) {
      live.delete(body);
    },
  };
}
const kinds = (p) => [...p.live].map((b) => b.desc.colliders[0].shape).sort();

describe('a solid as a Rapier body', () => {
  it('a circle as a cylinder from its base to its top, a box turned by its yaw', () => {
    const solids = createSolids();
    const c = solidBody(solids.circle(5, 6, 0.7, { base: 2, top: 5 }), flat);
    expect(c).toMatchObject({ type: 'fixed', position: [5, 3.5, 6], colliders: [{ shape: 'cylinder', args: [1.5, 0.7] }] });
    const b = solidBody(solids.box(1, 1, 2, 3, Math.PI / 2), flat);
    expect(b.colliders[0]).toMatchObject({ shape: 'cuboid', args: [2, (TALL + BURY) / 2, 3] });
    expect(b.position[1]).toBeCloseTo(2 - BURY + (TALL + BURY) / 2);
    expect(b.rotation[1]).toBeCloseTo(Math.sin(Math.PI / 4));
    expect(b.rotation[3]).toBeCloseTo(Math.cos(Math.PI / 4));
  });

  it('nothing for a solid with no height or no size', () => {
    const solids = createSolids();
    expect(solidBody(solids.circle(0, 0, 1, { base: 3, top: 3 }), flat)).toBe(null);
    expect(solidBody(solids.circle(0, 0, 0), flat)).toBe(null);
  });

  it('a floor as a slab under its top; one that moves, kinematic', () => {
    expect(floorBody({ x: 0, z: 0, y: 4, hw: 2, hd: 1 })).toMatchObject({ type: 'fixed', position: [0, 4 - SLAB / 2, 0], colliders: [{ shape: 'cuboid', args: [2, SLAB / 2, 1] }] });
    expect(floorBody({ x: 0, z: 0, y: 1, r: 3, moves: true })).toMatchObject({ type: 'kinematicPositionBased', colliders: [{ shape: 'cylinder', args: [SLAB / 2, 3] }] });
  });
});

describe('the site’s physics', () => {
  it('a ring of cells round you, each a heightfield, with the solids and floors in them', () => {
    expect(cellsAround([10, 10]).size).toBe(9);
    const p = fakePhysics();
    const solids = createSolids();
    solids.circle(5, 5, 1);
    solids.box(500, 500, 1, 1); // (far off: not in the ring)
    const world = { heightAt: flat, solids, floors: [{ x: 10, z: -10, y: 3, hw: 1, hd: 1 }] };
    const site = createSitePhysics({ physics: p, world });
    site.update([0, 0]);
    expect(site.stats()).toEqual({ cells: 9, heightfields: 9, solids: 1, floors: 1 });
    expect(kinds(p).filter((k) => k === 'heightfield')).toHaveLength(9);
    // what the placer puts down later joins at the next update
    solids.box(20, 20, 1, 1);
    site.update([0, 0]);
    expect(site.stats().solids).toBe(2);
    // walked away: the old cells and their solids go, the new ones come
    site.update([CELL * 6, 0]);
    expect(site.stats()).toMatchObject({ cells: 9, solids: 0, floors: 0 });
    site.dispose();
    expect(p.live.size).toBe(0);
  });

  it('a solid that is off is turned off in the engine too', () => {
    const p = fakePhysics();
    const solids = createSolids();
    const gate = solids.box(3, 3, 2, 0.3);
    const site = createSitePhysics({ physics: p, world: { heightAt: flat, solids, floors: [] } });
    site.update([0, 0]);
    const body = [...p.live].find((b) => b.desc.colliders[0].shape === 'cuboid');
    gate.off = true;
    site.update([0, 0]);
    expect(body.on).toBe(false);
    gate.off = false;
    site.update([0, 0]);
    expect(body.on).toBe(true);
  });
});

describe('the site’s physics on the engine', () => {
  it('rays down meet the drawn ground, and a solid’s top stands over it', async () => {
    const { createPhysics } = await import('../../../lib/physics/world');
    const physics = await createPhysics();
    const solids = createSolids();
    solids.box(10, 10, 2, 2, 0, { base: 2, top: 4 });
    const heightAt = (x, z) => 2 + 0.05 * x - 0.02 * z;
    const site = createSitePhysics({ physics, world: { heightAt, solids, floors: [] } });
    site.update([0, 0]);
    physics.world.step();
    const { Ray } = physics.RAPIER;
    const down = (x, z) => 100 - physics.world.castRay(new Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 }), 1000, true).timeOfImpact;
    for (const [x, z] of [[-30, 20], [40, -50], [5, 5]]) expect(down(x, z)).toBeCloseTo(heightAt(x, z), 2);
    expect(down(10, 10)).toBeCloseTo(4, 2);
    site.dispose();
    physics.dispose();
  });
});

describe('the site’s physics in the game’s materials', () => {
  it('each collider carries the material index the site names, with the grid’s friction and bounce', async () => {
    const { frictionOf, loadMaterials } = await import('../../../lib/physics/materials');
    const book = await loadMaterials('hoth_01');
    const materials = { level: 'hoth_01', ground: 28, box: 14, circle: 91 };
    const p = fakePhysics();
    const solids = createSolids();
    solids.box(3, 3, 1, 1);
    solids.circle(-3, 3, 1);
    const site = createSitePhysics({ physics: p, world: { heightAt: flat, solids, floors: [] }, materials, book });
    site.update([0, 0]);
    const by = (shape) => [...p.live].find((b) => b.desc.colliders[0].shape === shape);
    expect(by('cuboid').desc.colliders[0].tag).toBe(14);
    expect(by('cylinder').desc.colliders[0].tag).toBe(91);
    expect(by('heightfield').desc.colliders[0].tag).toBe(28);
    expect(by('cuboid').desc).toMatchObject(frictionOf(book, 14));
    expect(by('heightfield').desc).toMatchObject(frictionOf(book, 28));
  });

  it('the engine’s own where the world has no grid', () => {
    const p = fakePhysics();
    const solids = createSolids();
    solids.box(3, 3, 1, 1);
    createSitePhysics({ physics: p, world: { heightAt: flat, solids, floors: [] } }).update([0, 0]);
    const box = [...p.live].find((b) => b.desc.colliders[0].shape === 'cuboid');
    expect(box.desc.friction).toBeUndefined();
    expect(box.desc.colliders[0].tag).toBe(null);
  });
});
