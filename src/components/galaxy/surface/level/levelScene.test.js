import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { writeInstances } from '../../../../lib/level/instances';
import { createLevelScene } from './levelScene';

// a rock (r 1, three LODs), a crate mirrored (r 0.5), a hangar piece (r 20);
// the instance table holds two rocks, the crate and the hangar
const pack = {
  meshes: [
    { radius: 1, lods: [1000, 400, 100], glb: ['r0.glb', 'r1.glb', 'r2.glb'] },
    { radius: 0.5, lods: [50, 10], glb: ['c0.glb', 'c1.glb'] },
    { radius: 20, lods: [30000, 9000, 2000], glb: [null, 'h1.glb', 'h2.glb'] },
  ],
  cull: { high: { K: 40, dropped: [] }, low: { K: 20, dropped: [1] } },
  far: {
    draws: [
      { mesh: 0, offset: 0, count: 2, mirrored: false },
      { mesh: 1, offset: 2, count: 1, mirrored: true },
      { mesh: 2, offset: 3, count: 1, mirrored: false },
    ],
  },
  horizon: { draws: [] },
};
const recs = (list) => writeInstances({ count: list.length, position: new Float32Array(list.flatMap((r) => r[0])), quaternion: new Float32Array(list.flatMap(() => [0, 0, 0, 1])), scale: new Float32Array(list.flatMap((r) => r[1] ?? [1, 1, 1])) });
const table = recs([[[1, 0, 1]], [[30, 0, 0]], [[3, 0, 3], [-1, 1, 1]], [[100, 0, 0]]]);

const loadGltf = async () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial()));
  return { scene };
};
const drawn = (scene) => {
  const out = [];
  scene.traverse((o) => o.isInstancedMesh && o.count && out.push(o));
  return out;
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('createLevelScene', () => {
  it('draws each instance at its LOD by size and distance, one InstancedMesh a mesh, LOD and side', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.setTable(table);
    level.update([0, 0]);
    await settle();
    const by = Object.fromEntries(drawn(scene).map((m) => [m.userData.glb, m.count]));
    // the rock at 1.4 m: LOD0; the rock at 30 m: its last; the crate at 4 m (r 0.5): its last;
    // the hangar at 100 m (r 20): LOD1 is its first shipped, 100 / 20 = 5, past two doublings: LOD2
    expect(by).toEqual({ 'r0.glb': 1, 'r2.glb': 1, 'c1.glb': 1, 'h2.glb': 1 });
    expect(level.stats()).toEqual({ tris: 8, calls: 4, instances: 4 });
    level.dispose();
  });

  it('leaves out what is past K radii, and the meshes the tier dropped', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'low' });
    level.setTable(table);
    level.update([0, 0]);
    await settle();
    // low: K 20, so the rock at 30 m (r 1) is gone; the crate's mesh is dropped
    expect(drawn(scene).map((m) => m.userData.glb).sort()).toEqual(['h2.glb', 'r1.glb']);
    level.dispose();
  });

  it('gives a mirrored instance its own mesh, wound the other way, the material’s side kept', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.setTable(table);
    level.update([0, 0]);
    await settle();
    const m = drawn(scene).find((x) => x.userData.mirrored);
    const plain = drawn(scene).find((x) => !x.userData.mirrored);
    expect(Array.from(plain.geometry.index.array.slice(0, 3))).toEqual([0, 1, 2]);
    expect(Array.from(m.geometry.index.array.slice(0, 3))).toEqual([0, 2, 1]);
    expect(m.material.side).toBe(THREE.FrontSide);
    const mat = new THREE.Matrix4();
    m.getMatrixAt(0, mat);
    expect(mat.determinant()).toBeLessThan(0);
    level.dispose();
  });

  it('walking changes the LODs, only once you have gone a few metres', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf, tier: 'high' });
    level.setTable(table);
    level.update([0, 0]);
    await settle();
    level.update([29, 0]); // beside the second rock
    await settle();
    const by = Object.fromEntries(drawn(scene).map((m) => [m.userData.glb, m.count]));
    expect(by['r0.glb']).toBe(1);
    const sorts = level.rebuilds();
    level.update([29.5, 0]); // (half a metre: nothing to do)
    expect(level.rebuilds()).toBe(sorts);
    level.dispose();
    expect(drawn(scene).length).toBe(0);
  });

  it('a thing changing LOD stays drawn at the old one until the new one has loaded', async () => {
    const scene = new THREE.Scene();
    let release = null;
    const gate = new Promise((r) => (release = r));
    // (the rock's last LOD is slow to come)
    const slow = (glb) => (glb === 'r2.glb' ? gate.then(loadGltf) : loadGltf());
    const level = createLevelScene({ scene, pack, loadGltf: slow, tier: 'high' });
    level.setTable(table);
    level.update([0, 0]); // the first rock at LOD0 (loaded); the second wants r2, slow
    await settle();
    expect(drawn(scene).find((m) => m.userData.glb === 'r0.glb').count).toBe(1);
    level.update([29, 0]); // beside the second: the first now wants r2, still not loaded
    await settle();
    // (both drawn at LOD0: the first kept at its old one, the second at its new)
    expect(drawn(scene).find((m) => m.userData.glb === 'r0.glb').count).toBe(2);
    release();
    await settle();
    await settle();
    const by = Object.fromEntries(drawn(scene).map((m) => [m.userData.glb, m.count]));
    expect(by['r0.glb']).toBe(1);
    expect(by['r2.glb']).toBe(1);
    level.dispose();
  });

  it('a mesh that fails to load draws nothing and breaks nothing', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack, loadGltf: async () => null, tier: 'high' });
    level.setTable(table);
    level.update([0, 0]);
    await settle();
    expect(drawn(scene).length).toBe(0);
    level.dispose();
  });
});

describe('the ground in the game’s layers (lane Q2)', () => {
  const groundJson = new TextEncoder().encode(JSON.stringify({ world: 'hoth', layers: [], rules: [], masks: { png: 'ground/masks.png', w: 2, h: 2, minX: 0, minZ: 0, metresPerPixel: 1 }, fade: { start: 300, end: 450 }, macro: { color: [0.5, 0.6, 0.7] } }));
  const fetchBytes = (calls) => async (path) => {
    calls.push(path);
    if (path === 'ground.json') return groundJson.buffer;
    throw new Error(`404 ${path}`);
  };
  const until = async (fn) => {
    for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 5));
  };

  it('a node renderer and a pack with ground.json: the ground mesh takes the layered material, and gets its own back on dispose', async () => {
    const scene = new THREE.Scene();
    const own = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), own);
    const calls = [];
    const level = createLevelScene({ scene, pack: { ...pack, ground: 'ground.json' }, loadGltf, tier: 'high', ground: { mesh, renderer: { backend: { isWebGLBackend: true } }, fetchBytes: fetchBytes(calls), urlOf: (p) => p } });
    await until(() => mesh.material !== own);
    expect(mesh.material.isNodeMaterial).toBe(true);
    expect(mesh.material.name).toBe('layered-ground:hoth');
    expect(calls).toContain('ground.json');
    level.dispose();
    expect(mesh.material).toBe(own);
  });

  it('the classic renderer, or a pack without ground.json: the ground keeps its own material and nothing is fetched', async () => {
    for (const [renderer, p] of [
      [{ isWebGLRenderer: true }, { ...pack, ground: 'ground.json' }],
      [{ backend: { isWebGLBackend: true } }, pack],
    ]) {
      const own = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), own);
      const calls = [];
      const level = createLevelScene({ scene: new THREE.Scene(), pack: p, loadGltf, tier: 'high', ground: { mesh, renderer, fetchBytes: fetchBytes(calls), urlOf: (x) => x } });
      await settle();
      await settle();
      expect(mesh.material).toBe(own);
      expect(calls).toEqual([]);
      level.dispose();
    }
  });
});

describe('the batched path (lane U)', () => {
  // (the loader's materials are alike, as the pack's shared texture cache makes a mesh's LODs)
  const celled = {
    ...pack,
    far: { draws: pack.far.draws.map((d, i) => ({ ...d, cells: { [i === 3 - 1 ? '2,0' : '0,0']: [0, d.count] } })) },
    horizon: { draws: [{ mesh: 0, offset: 0, count: 1, mirrored: false }] },
  };
  const batchesIn = (scene) => {
    const out = [];
    scene.traverse((o) => o.isBatchedMesh && o.instanceCount && out.push(o));
    return out;
  };

  it('draws the table as one BatchedMesh a material a band, no InstancedMesh, the same instances and triangles', async () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack: celled, loadGltf, tier: 'high', batch: true });
    level.setTable(table);
    level.setHorizon(recs([[[20, 0, 0]]]));
    level.update([0, 0]);
    await settle();
    await settle();
    expect(drawn(scene)).toHaveLength(0);
    expect(batchesIn(scene).map((m) => m.userData.band).sort()).toEqual(['arena', 'horizon']);
    expect(level.stats()).toMatchObject({ tris: 10, calls: 2, instances: 5, batches: 2, bands: { arena: 1, horizon: 1 } });
    // (walking: the LODs change, the batch's geometry is added to, not rebuilt)
    const arena = batchesIn(scene).find((m) => m.userData.band === 'arena');
    const before = arena._geometryInfo.length;
    level.update([30, 0]);
    await settle();
    await settle();
    expect(arena._geometryInfo.length).toBeGreaterThanOrEqual(before);
    // (the crate, 27 m off at r 0.5, is past K radii now)
    expect(level.stats()).toMatchObject({ calls: 2, instances: 4 });
    level.dispose();
    expect(batchesIn(scene)).toHaveLength(0);
  });

  it('puts the bundled bands in a render bundle, flagged again when the table moves', async () => {
    class Bundle extends THREE.Group {
      version = 0;
      set needsUpdate(v) {
        if (v) this.version++;
      }
    }
    const scene = new THREE.Scene();
    const level = createLevelScene({ scene, pack: celled, loadGltf, tier: 'high', batch: true, Bundle });
    level.setTable(table);
    level.setHorizon(recs([[[20, 0, 0]]]));
    level.update([0, 0]);
    await settle();
    await settle();
    const bundle = scene.getObjectByName('bundle:horizon');
    expect(bundle).toBeInstanceOf(Bundle);
    expect(bundle.children.map((m) => m.userData.band)).toEqual(['horizon']);
    const v = bundle.version;
    level.update([30, 0]);
    await settle();
    expect(bundle.version).toBeGreaterThan(v);
    level.dispose();
  });

  it('hides the instances of a cell the walls cover, and shows them when it is seen', async () => {
    const scene = new THREE.Scene();
    const covered = new Set();
    const renderer = { isOccluded: (m) => covered.has(m.name) };
    const level = createLevelScene({ scene, pack: celled, loadGltf, tier: 'high', batch: true, occlude: renderer });
    level.setTable(table);
    level.update([0, 0]);
    await settle();
    await settle();
    const proxies = scene.getObjectByName('occlusion').children;
    expect(proxies.map((m) => m.name).sort()).toEqual(['occluder-proxy:0,0', 'occluder-proxy:1,0']);
    const camera = new THREE.PerspectiveCamera();
    const frame = () => {
      for (const m of proxies) m.onBeforeRender(renderer);
      level.afterRender(camera);
    };
    // the hangar piece's block (its cell 2,0, 100 m off) behind a wall for two frames
    covered.add('occluder-proxy:1,0');
    frame();
    frame();
    expect(level.stats()).toMatchObject({ blocks: 2, hidden: 1 });
    const arena = batchesIn(scene)[0];
    const visible = () => [...Array(arena.instanceCount).keys()].filter((i) => arena.getVisibleAt(i)).length;
    expect(visible()).toBe(3);
    covered.clear();
    frame();
    expect(visible()).toBe(4);
    level.dispose();
  });
});
