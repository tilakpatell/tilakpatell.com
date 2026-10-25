import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { C, ROLE, disposeBuilt, inReach, lampPools, merged, mergeStatics, part, roleOf, waterOn } from './parts';
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

describe('mergeStatics, by band', () => {
  it('a material’s statics merged a band of the stage along z at a time, so a band out of view is left out', () => {
    const a = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    for (const z of [0, 10, 70, 75, 200]) {
      const b = box(a, 0);
      b.position.z = z;
      root.add(b);
    }
    mergeStatics(root, { band: 60 });
    const meshes = [];
    root.traverse((o) => o.isMesh && meshes.push(o));
    // (0 and 10 in the first band, 70 and 75 the second, 200 the fourth)
    expect(meshes.map((o) => o.geometry.attributes.position.count).sort((x, y) => x - y)).toEqual([36, 72, 72]);
    // (no band: one mesh, as before)
    const whole = new THREE.Group();
    for (const z of [0, 100]) {
      const b = box(a, 0);
      b.position.z = z;
      whole.add(b);
    }
    mergeStatics(whole, { band: 0 });
    expect(whole.children).toHaveLength(1);
  });
});

describe('inReach', () => {
  it('a stretch of the stage is in reach while the ride is within that many metres of either end, or on it', () => {
    expect(inReach([198, 226], 210, 90)).toBe(true);
    expect(inReach([198, 226], 108, 90)).toBe(true);
    expect(inReach([198, 226], 107, 90)).toBe(false);
    expect(inReach([198, 226], 316, 90)).toBe(true);
    expect(inReach([198, 226], 317, 90)).toBe(false);
    expect(inReach([198, 226], -12, 90)).toBe(false);
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

describe('lampPools', () => {
  it('a warm disc on the ground under each lamp, off its wall toward the lane, in one draw', () => {
    const lamps = [new THREE.Vector3(6, 3, 10), new THREE.Vector3(-7, 3, 20), new THREE.Vector3(0.5, 3, 30)];
    const pools = lampPools(lamps, () => 2, { radius: 3, toward: 1.4 });
    expect(pools.mesh.isInstancedMesh).toBe(true);
    expect(pools.mesh.count).toBe(3);
    const m = new THREE.Matrix4();
    const at = new THREE.Vector3();
    const xs = [4.6, -5.6, 0];
    for (let i = 0; i < 3; i++) {
      pools.mesh.getMatrixAt(i, m);
      at.setFromMatrixPosition(m);
      expect(at.x).toBeCloseTo(xs[i], 6);
      expect(at.y).toBeCloseTo(2.06, 6);
      expect(at.z).toBe(lamps[i].z);
    }
    pools.set(0);
    expect(pools.mesh.visible).toBe(false);
    pools.set(1);
    expect(pools.mesh.visible).toBe(true);
    pools.dispose();
  });

  it('says what each part is made of, for the scans: grey built work stone, brown wood, a rough stone rock, a bright thing nothing', () => {
    const boxGeo = () => new THREE.BoxGeometry(1, 1, 1);
    expect(roleOf(boxGeo(), C(0x8c8880))).toBe(ROLE.stone);
    expect(roleOf(boxGeo(), C(0x45403a))).toBe(ROLE.stone);
    expect(roleOf(boxGeo(), C(0x6e5a46))).toBe(ROLE.wood);
    expect(roleOf(boxGeo(), C(0xc9bba0))).toBe(ROLE.wood);
    expect(roleOf(new THREE.DodecahedronGeometry(0.5, 0), C(0x8c8880))).toBe(ROLE.rock);
    expect(roleOf(boxGeo(), C(0xffd884))).toBe(ROLE.none);
    expect(roleOf(boxGeo(), C(0xf4f6fa))).toBe(ROLE.none);
    // (each vertex carries it, and a part may say its own)
    const g = part(boxGeo(), C(0x8c8880), { role: 'wood' });
    expect(new Set(g.getAttribute('aRole').array)).toEqual(new Set([ROLE.wood]));
  });

  it('merges a part made some other way with the rest, wearing nothing', () => {
    const plain = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    plain.deleteAttribute('uv');
    plain.setAttribute('color', new THREE.BufferAttribute(new Float32Array(plain.attributes.position.count * 3), 3));
    const mesh = merged([part(new THREE.BoxGeometry(1, 1, 1), C(0x8c8880)), plain], new THREE.MeshBasicMaterial(), 'mixed');
    const roles = mesh.geometry.getAttribute('aRole').array;
    expect(roles.length).toBe(mesh.geometry.getAttribute('position').count);
    expect(new Set(roles)).toEqual(new Set([ROLE.stone, ROLE.none]));
    // (and on its own, all of it none)
    expect(new Set(merged([plain.clone()], new THREE.MeshBasicMaterial(), 'alone').geometry.getAttribute('aRole').array)).toEqual(new Set([ROLE.none]));
  });

  it('keeps a part’s role through the statics’ merge', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial();
    root.add(merged([part(new THREE.BoxGeometry(1, 1, 1), C(0x6e5a46))], mat, 'a'));
    mergeStatics(root);
    expect(root.children[0].geometry.getAttribute('aRole')).toBeTruthy();
  });
});
