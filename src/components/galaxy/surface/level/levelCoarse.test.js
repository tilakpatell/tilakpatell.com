import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCoarse } from './levelCoarse.js';

// a cell's GLB as the loader gives it: a scene of one mesh
const cellScene = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene };
};
const index = {
  cell: 512,
  cells: {
    '0,0': { meshes: [1, 2], impostors: { 7: [[1, 2, 3, 0, 4]] } },
    '1,0': { meshes: [3], impostors: { 7: [[600, 0, 3, 0, 4], [610, 0, 3, 0, 4]] } },
  },
};
// (the impostor maker the node renderer's would be: a stand-in here)
const makeImpostors = ({ records }) => {
  const mesh = new THREE.Object3D();
  mesh.count = records.length;
  return {
    mesh,
    setRecords(list) {
      mesh.count = list.length;
    },
    get count() {
      return mesh.count;
    },
    dispose() {},
  };
};

describe('createCoarse', () => {
  it('puts each cell’s proxy under the level, behind the fine path’s surfaces', () => {
    const parent = new THREE.Group();
    const c = createCoarse({ parent, index });
    c.addCell('0,0', cellScene());
    expect(parent.children).toHaveLength(1);
    const mesh = parent.children[0].children[0];
    expect(mesh.material.polygonOffset).toBe(true);
    expect(mesh.material.polygonOffsetFactor).toBeGreaterThan(0);
    expect(c.stats()).toMatchObject({ cells: 1, shown: 1 });
  });

  it('hides a cell once the fine path has every mesh it stands in for, and shows it again if one goes', () => {
    const parent = new THREE.Group();
    const c = createCoarse({ parent, index });
    c.addCell('0,0', cellScene());
    c.addCell('1,0', cellScene());
    const loaded = new Set([1, 2]);
    c.update({ loaded: (m) => loaded.has(m), drawn: () => true });
    expect(c.stats()).toMatchObject({ cells: 2, shown: 1 });
    expect(c.stats().waiting).toBe(1);
    loaded.delete(2);
    c.update({ loaded: (m) => loaded.has(m), drawn: () => true });
    expect(c.stats().shown).toBe(2);
    expect(c.stats().waiting).toBe(2);
  });

  it('draws one impostor mesh an atlas, its cards those of the cells shown', () => {
    const parent = new THREE.Group();
    const c = createCoarse({ parent, index, makeImpostors });
    c.addCell('0,0', cellScene());
    c.addCell('1,0', cellScene());
    c.setAtlas(7, { albedo: new THREE.Texture(), normal: null });
    expect(c.stats().cards).toBe(3);
    const loaded = new Set([3]);
    c.update({ loaded: (m) => loaded.has(m), drawn: () => true });
    expect(c.stats().cards).toBe(1);
  });

  it('draws no impostors without a maker (the classic renderer): the proxies alone', () => {
    const parent = new THREE.Group();
    const c = createCoarse({ parent, index });
    c.addCell('0,0', cellScene());
    c.setAtlas(7, { albedo: new THREE.Texture() });
    expect(c.stats().cards).toBe(0);
  });

  it('lets go of everything it made', () => {
    const parent = new THREE.Group();
    const c = createCoarse({ parent, index, makeImpostors });
    const s = cellScene();
    let freed = 0;
    s.scene.children[0].geometry.addEventListener('dispose', () => freed++);
    c.addCell('0,0', s);
    c.setAtlas(7, { albedo: new THREE.Texture() });
    c.dispose();
    expect(parent.children).toHaveLength(0);
    expect(freed).toBe(1);
  });
});
