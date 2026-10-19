import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { disposeBuilt, mergeStatics, waterOn } from './parts';
import { landFor } from '../terrain';

const box = (mat, x, uv = true) => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  if (!uv) g.deleteAttribute('uv');
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.x = x;
  return mesh;
};

describe('mergeStatics', () => {
  it('leaves one mesh a material, the vertices where they stood', () => {
    const a = new THREE.MeshBasicMaterial();
    const b = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    const house = new THREE.Group();
    house.position.set(10, 0, 0);
    house.scale.setScalar(2);
    house.add(box(a, 0), box(a, 3), box(b, 6));
    root.add(house, box(a, -5));
    mergeStatics(root);
    const meshes = [];
    root.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes).toHaveLength(2);
    const ma = meshes.find((o) => o.material === a);
    ma.geometry.computeBoundingBox();
    // (−5.5 the lone box’s left face; 10 + 2 × 3.5 the house’s second box’s right)
    expect(ma.geometry.boundingBox.min.x).toBeCloseTo(-5.5);
    expect(ma.geometry.boundingBox.max.x).toBeCloseTo(17);
    expect(ma.geometry.attributes.position.count).toBe(36 * 3);
  });

  it('keeps what it is told to, instanced and skinned meshes, and splits by the attributes a geometry has', () => {
    const a = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    const gate = new THREE.Group();
    gate.add(box(a, 0));
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(), a, 4);
    root.add(gate, inst, box(a, 2), box(a, 4, false), box(a, 6, false));
    mergeStatics(root, { keep: [gate] });
    const meshes = [];
    root.traverse((o) => o.isMesh && meshes.push(o));
    // the gate’s box, the instances, one with uvs, one merged pair without
    expect(meshes).toHaveLength(4);
    expect(gate.children).toHaveLength(1);
    expect(meshes.filter((o) => !o.isInstancedMesh && o.parent === root).map((o) => o.geometry.attributes.position.count).sort((x, y) => x - y)).toEqual([36, 72]);
  });
});

describe('disposeBuilt', () => {
  it('frees the geometry and what a builder made, never the kit’s materials', () => {
    const kitMat = new THREE.MeshBasicMaterial();
    const map = new THREE.Texture();
    const own = new THREE.MeshBasicMaterial({ map });
    const root = new THREE.Group();
    root.add(box(kitMat, 0), box(own, 1), box(own, 2));
    const freed = [];
    for (const x of [kitMat, own, map, ...root.children.map((m) => m.geometry)]) x.addEventListener('dispose', () => freed.push(x));
    disposeBuilt(root, { mats: { stone: kitMat } });
    expect(freed).toContain(own);
    expect(freed).toContain(map);
    expect(freed).not.toContain(kitMat);
    expect(freed.filter((x) => x.isBufferGeometry)).toHaveLength(3);
    expect(freed.filter((x) => x === own)).toHaveLength(1);
  });
});

describe('waterOn', () => {
  it('reads a river’s water where it runs, over its bed, and nothing off it', () => {
    const land = landFor('anduin', { res: 8, wide: 256 });
    const on = waterOn(land, 0);
    const level = on(0, 40);
    expect(level).toBeGreaterThan(land.field(0, 40));
    expect(on(-60, 40)).toBeNull();
    expect(waterOn(land, 7)(0, 40)).toBeNull();
  });
});
