import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDebris } from './battleDebris';

describe('battleDebris', () => {
  it('flings a part’s meshes off where they were, drifting and turning, and lets them go at the end of their life', () => {
    const parent = new THREE.Group();
    const ship = new THREE.Group();
    ship.position.set(10, 0, 0);
    parent.add(ship);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial());
    dome.position.set(0, 2, 0);
    ship.add(dome);
    parent.updateMatrixWorld(true);
    const debris = createDebris(parent, { count: 8 });
    const g = debris.fling([dome], { at: { x: 10, y: 2, z: 0 }, vel: { x: 0, y: 1, z: 0 }, spin: 0.5, life: 5 });
    expect(dome.parent).toBe(g);
    g.updateMatrixWorld(true);
    expect(new THREE.Vector3().setFromMatrixPosition(dome.matrixWorld).toArray()).toEqual([10, 2, 0]);
    debris.update(1);
    expect(g.position.y).toBeCloseTo(3, 6);
    expect(g.quaternion.w).toBeLessThan(1);
    expect(debris.pieces).toEqual([g]);
    for (let i = 0; i < 5; i++) debris.update(1);
    expect(g.parent).toBeNull();
    expect(debris.pieces).toEqual([]);
    debris.dispose();
  });

  it('throws shrapnel out of a blast in one draw, hot for a moment, gone when it’s cooled and spent', () => {
    const parent = new THREE.Group();
    const debris = createDebris(parent, { count: 16 });
    const mesh = parent.children.find((o) => o.isInstancedMesh);
    debris.burst({ x: 0, y: 0, z: 0 }, { n: 6, speed: 4, size: 0.2 });
    debris.update(0.1);
    expect(mesh.count).toBe(6);
    const sparks = [];
    debris.sparks((p, c, size) => sparks.push({ p, c, size }));
    expect(sparks).toHaveLength(6);
    for (let i = 0; i < 20; i++) debris.update(0.5);
    expect(mesh.count).toBe(0);
    const later = [];
    debris.sparks((p) => later.push(p));
    expect(later).toHaveLength(0);
    debris.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('draws its shards in the material it’s handed (the node twin’s)', () => {
    const parent = new THREE.Group();
    const made = [];
    const debris = createDebris(parent, { count: 4, material: (o) => made.push(o) && new THREE.MeshLambertMaterial() });
    expect(made).toHaveLength(1);
    expect(parent.children.find((o) => o.isInstancedMesh).material.isMeshLambertMaterial).toBe(true);
    debris.dispose();
  });
});
