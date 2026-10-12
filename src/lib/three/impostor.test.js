import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createImpostors, impostorAttributes } from './impostor.js';

const records = [
  [1, 2, 3, 0.5, 4],
  [-10, 0, 20, -1, 2.5],
];

describe('impostorAttributes', () => {
  it('packs each card’s middle and radius, and its yaw', () => {
    const { centre, yaw } = impostorAttributes(records);
    expect(Array.from(centre)).toEqual([1, 2, 3, 4, -10, 0, 20, 2.5]);
    expect(Array.from(yaw)).toEqual([0.5, -1]);
  });
});

describe('createImpostors', () => {
  it('is one instanced card a record, on a node material, placed in its shader', () => {
    const albedo = new THREE.Texture();
    const normal = new THREE.Texture();
    const imp = createImpostors({ albedo, normal, views: 16, records });
    expect(imp.mesh.isInstancedMesh).toBe(true);
    expect(imp.mesh.count).toBe(2);
    expect(imp.mesh.material.isNodeMaterial).toBe(true);
    expect(imp.mesh.material.positionNode).toBeTruthy();
    expect(imp.mesh.material.normalNode).toBeTruthy();
    expect(imp.mesh.material.maskNode).toBeTruthy();
    expect(imp.mesh.frustumCulled).toBe(false);
    expect(imp.mesh.geometry.attributes.aImp.count).toBe(2);
    imp.dispose();
  });

  it('draws fewer cards when told, never more than it was made with', () => {
    const imp = createImpostors({ albedo: new THREE.Texture(), records });
    imp.setRecords([records[1]]);
    expect(imp.count).toBe(1);
    expect(Array.from(imp.mesh.geometry.attributes.aImp.array.slice(0, 4))).toEqual([-10, 0, 20, 2.5]);
    imp.setRecords([...records, ...records]);
    expect(imp.count).toBe(2);
    imp.dispose();
  });

  it('takes no normal map, unlit by its bake then', () => {
    const imp = createImpostors({ albedo: new THREE.Texture(), records });
    expect(imp.mesh.material.normalNode).toBeNull();
    imp.dispose();
  });
});
