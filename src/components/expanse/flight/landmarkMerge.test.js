import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMerge } from './landmarkMerge';

const box = () => new THREE.BoxGeometry(1, 1, 1);
const at = (o, x, y, z, yaw = 0) => {
  o.position.set(x, y, z);
  o.rotation.y = yaw;
  return o;
};
const meshes = (root) => {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
};
// every vertex of every mesh under `root`, in the root's frame, sorted
const points = (root, filter = () => true) => {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const out = [];
  for (const m of meshes(root).filter(filter)) {
    const rel = m.matrixWorld.clone().premultiply(inv);
    const p = m.geometry.attributes.position;
    const idx = m.geometry.index;
    const n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(rel);
      out.push(v.toArray().map((x) => Math.round(x * 1e4) / 1e4).join(','));
    }
  }
  return out.sort();
};
const run = (merge, n) => {
  let done = false;
  for (let i = 0; i < n; i++) done = merge.tick() || done;
  return done;
};

describe('a landmark’s still meshes merged a material at a time', () => {
  it('draws one mesh a material where several stood still, the same triangles where they stood', () => {
    const group = at(new THREE.Group(), 100, 0, -40);
    const stone = new THREE.MeshLambertMaterial({ color: '#888' });
    const metal = new THREE.MeshStandardMaterial({ color: '#444' });
    const hut = new THREE.Group();
    hut.add(at(new THREE.Mesh(box(), stone), 0, 0, 0), at(new THREE.Mesh(box(), stone), 3, 0, 1, 0.4), at(new THREE.Mesh(box(), metal), 0, 2, 0));
    group.add(hut, at(new THREE.Mesh(box(), stone), -5, 0, 2, 1.1), at(new THREE.Mesh(box(), metal), 6, 1, -3));
    const before = points(group);
    const merge = createMerge(group, { frames: 3 });
    expect(run(merge, 2)).toBe(false);
    expect(run(merge, 1)).toBe(true);
    const drawn = meshes(group);
    expect(drawn).toHaveLength(2);
    expect(new Set(drawn.map((m) => m.material))).toEqual(new Set([stone, metal]));
    expect(points(group)).toEqual(before);
    expect(merge.stats()).toEqual({ merged: 5, into: 2, kept: 0 });
  });

  it('keeps what moved while it watched, and anything a merge would draw otherwise', () => {
    const group = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial();
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 });
    const swaying = new THREE.MeshLambertMaterial();
    swaying.userData.sway = {}; // (an object-space hook's mark: windNodes')
    const turret = at(new THREE.Mesh(box(), stone), 0, 4, 0);
    const mirrored = at(new THREE.Mesh(box(), stone), 2, 0, 0);
    mirrored.scale.x = -1;
    const kept = [turret, mirrored, new THREE.Mesh(box(), glass), new THREE.Mesh(box(), glass), new THREE.Mesh(box(), swaying), new THREE.Mesh(box(), swaying), new THREE.Mesh(box(), [stone, stone])];
    const still = [at(new THREE.Mesh(box(), stone), 5, 0, 0), at(new THREE.Mesh(box(), stone), 8, 0, 0)];
    group.add(...kept, ...still);
    const merge = createMerge(group, { frames: 2 });
    merge.tick();
    turret.rotation.y += 0.3; // (the ion cannon’s turret turning)
    merge.tick();
    const drawn = meshes(group);
    for (const k of kept) expect(drawn).toContain(k);
    for (const s of still) expect(drawn).not.toContain(s);
    expect(merge.stats()).toEqual({ merged: 2, into: 1, kept: kept.length });
  });

  it('merges nothing that would be one draw anyway, and gives its geometry back on dispose', () => {
    const group = new THREE.Group();
    const a = new THREE.MeshLambertMaterial();
    const b = new THREE.MeshLambertMaterial();
    const lone = new THREE.Mesh(box(), a);
    group.add(lone, new THREE.Mesh(box(), b), new THREE.Mesh(box(), b));
    const merge = createMerge(group, { frames: 1 });
    merge.tick();
    expect(meshes(group)).toContain(lone);
    const made = meshes(group).find((m) => m.material === b);
    let freed = false;
    made.geometry.addEventListener('dispose', () => (freed = true));
    merge.dispose();
    expect(freed).toBe(true);
  });

  it('merges geometries only with their like: indexed with indexed, the same attributes', () => {
    const group = new THREE.Group();
    const m = new THREE.MeshLambertMaterial();
    const coloured = box();
    coloured.setAttribute('color', new THREE.BufferAttribute(new Float32Array(coloured.attributes.position.count * 3), 3));
    group.add(new THREE.Mesh(box(), m), new THREE.Mesh(box(), m), new THREE.Mesh(box().toNonIndexed(), m), new THREE.Mesh(coloured, m));
    const merge = createMerge(group, { frames: 1 });
    merge.tick();
    expect(meshes(group)).toHaveLength(3);
  });
});
