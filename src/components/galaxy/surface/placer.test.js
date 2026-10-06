import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { applyBuilt, lodDistance, usesModel, withLod } from './placer';

const fakeWorld = () => ({ solids: { box: vi.fn(), circle: vi.fn() }, floors: [] });
const made = () => ({ object: new THREE.Group(), solids: [{ box: [0, 0, 4, 2] }], floors: [{ x: 3, z: 0, y: 1, hw: 2, hd: 2 }], update: () => {}, signal: () => {} });

describe('a built thing under a model', () => {
  it("keeps a built thing's floors and walls without its meshes", () => {
    const world = fakeWorld();
    const sinks = { updates: [], signals: [], object: false };
    applyBuilt(made(), { yaw: Math.PI / 2, scale: 2 }, [10, 0, 0], world, sinks);
    expect(world.solids.box).toHaveBeenCalledWith(10, 0, 8, 4, Math.PI / 2, expect.anything());
    expect(world.floors[0]).toMatchObject({ x: 10, y: 2, hw: 4, hd: 4 });
    expect(world.floors[0].z).toBeCloseTo(-6);
    // (its moving parts went with its meshes)
    expect(sinks.updates).toHaveLength(0);
    expect(sinks.signals).toHaveLength(0);
  });

  it('keeps the floors of one you can walk through', () => {
    const world = fakeWorld();
    applyBuilt(made(), { solid: false }, [0, 0, 0], world, { updates: [], signals: [], object: false });
    expect(world.solids.box).not.toHaveBeenCalled();
    expect(world.floors).toHaveLength(1);
  });

  it('keeps the moving parts of one drawn as built', () => {
    const sinks = { updates: [], signals: [], object: true };
    applyBuilt(made(), {}, [0, 0, 0], fakeWorld(), sinks);
    expect(sinks.updates).toHaveLength(1);
    expect(sinks.signals).toHaveLength(1);
  });
});

describe('far away, the light model', () => {
  it('switches far enough out', () => {
    expect(lodDistance(10)).toBe(60);
    expect(lodDistance(50)).toBe(150);
  });

  it('swaps in place', () => {
    const full = new THREE.Group();
    const low = new THREE.Group();
    full.position.set(3, 0, 0);
    const lod = withLod(full, low, 50);
    expect(lod.levels.map((l) => l.distance)).toEqual([0, 150]);
    expect(lod.levels.every((l) => l.object.position.lengthSq() === 0 && l.object.rotation.y === 0 && l.object.scale.x === 1)).toBe(true);
  });

  it('has one level till the light one comes', () => {
    const lod = withLod(new THREE.Group(), null, 20);
    expect(lod.levels).toHaveLength(1);
  });
});

describe('which things are their model', () => {
  it('draws a styled kind as its model only in the styles it is of', () => {
    // (theed's model is a domed hall: its towers stay built)
    expect(usesModel({ kind: 'theed', opts: { style: 'hall' } })).toBe(true);
    expect(usesModel({ kind: 'theed', opts: { style: 'tower' } })).toBe(false);
    expect(usesModel({ kind: 'theed', opts: { style: 'hall' }, model: false })).toBe(false);
    expect(usesModel({ kind: 'nothingatall' })).toBe(false);
  });
});
