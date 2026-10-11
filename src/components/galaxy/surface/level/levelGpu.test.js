import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { writeInstances } from '../../../../lib/level/instances.js';
import { lodAt } from '../../../../lib/level/lod.js';
import { createLevelGpu } from './levelGpu.js';
import { createLevelScene } from './levelScene.js';

// a pack of three meshes over two cells: a crate (two LOD files), a hut, and a
// lamp the tier drops; the far table's bin and a horizon of one hut
function fixture() {
  const rows = [
    [0, 0, -10, 0],
    [3, 0, -12, 0],
    [200, 0, -40, 0], // (cell 1,−1)
    [5, 0, -30, 1],
    [6, 0, -6, 2],
  ];
  const bin = writeInstances({
    count: rows.length,
    position: new Float32Array(rows.flatMap((r) => r.slice(0, 3))),
    quaternion: new Float32Array(rows.flatMap(() => [0, 0, 0, 1])),
    scale: new Float32Array(rows.flatMap((r, i) => (i === 1 ? [-1, 1, 1] : [1, 1, 1]))),
  });
  const horizon = writeInstances({ count: 1, position: new Float32Array([0, 0, -900]), quaternion: new Float32Array([0, 0, 0, 1]), scale: new Float32Array([1, 1, 1]) });
  const pack = {
    cell: 128,
    meshes: [
      { radius: 1, bounds: [-1, 0, -1, 1, 2, 1], lods: [4000, 1000], glb: ['crate.glb', 'crate.lod1.glb'] },
      { radius: 4, bounds: [-4, 0, -4, 4, 8, 4], lods: [9000], glb: ['hut.glb'] },
      { radius: 0.3, bounds: [0, 0, 0, 0.3, 0.3, 0.3], lods: [100], glb: ['lamp.glb'] },
    ],
    far: {
      bin: 'far.bin',
      draws: [
        { mesh: 0, offset: 0, count: 1, mirrored: false, cells: { '0,-1': [0, 1] } },
        { mesh: 0, offset: 1, count: 1, mirrored: true, cells: { '0,-1': [0, 1] } },
        { mesh: 0, offset: 2, count: 1, mirrored: false, cells: { '1,-1': [0, 1] } },
        { mesh: 1, offset: 3, count: 1, mirrored: false, cells: { '0,-1': [0, 1] } },
        { mesh: 2, offset: 4, count: 1, mirrored: false, cells: { '0,-1': [0, 1] } },
      ],
    },
    horizon: { bin: 'horizon.bin', draws: [{ mesh: 1, offset: 0, count: 1, mirrored: false }] },
    cull: { high: { K: 1000, dropped: [2] } },
  };
  const red = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const asked = [];
  const loadGltf = (glb) => {
    asked.push(glb);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), glb.startsWith('hut') ? grey : red));
    if (glb.startsWith('crate')) scene.add(new THREE.Mesh(new THREE.ConeGeometry(), grey));
    return Promise.resolve({ scene });
  };
  return { pack, bin, horizon, loadGltf, asked };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('createLevelGpu (counted on the CPU twin, no renderer)', () => {
  it('appends the far table by cell, leaves the dropped meshes out, and the horizon beside it', () => {
    const f = fixture();
    const scene = new THREE.Scene();
    const level = createLevelGpu({ scene, pack: f.pack, loadGltf: f.loadGltf, tier: 'high' });
    level.setTable(f.bin);
    level.setHorizon(f.horizon);
    expect(level.cells()).toEqual(['0,-1', '1,-1', 'horizon']);
    expect(level.stats().instances).toBe(5); // (the lamp dropped on high)
    // a new table frees the old one's rows and appends its own (the slots reused)
    level.setTable(f.bin);
    expect(level.stats().instances).toBe(5);
    expect(level.stats().dead).toBe(0);
    level.dispose();
  });

  it('asks for the LOD files lodAt wants round you, once each', async () => {
    const f = fixture();
    const level = createLevelGpu({ scene: new THREE.Scene(), pack: f.pack, loadGltf: f.loadGltf, tier: 'high' });
    level.setTable(f.bin);
    level.setHorizon(f.horizon);
    level.update([0, 0]);
    await settle();
    const want = new Set(['hut.glb']);
    for (const [x, z] of [
      [0, -10],
      [3, -12],
      [200, -40],
    ])
      want.add(f.pack.meshes[0].glb[lodAt(f.pack.meshes[0].lods, Math.hypot(x, z), 1, 'high')]);
    expect(new Set(f.asked)).toEqual(want);
    level.update([1, 0]);
    level.update([0, 0]);
    await settle();
    expect(f.asked.length).toBe(want.size);
    level.dispose();
  });

  it('counts one draw a material group, a sub-draw a part and key, and the rows drawn', async () => {
    const f = fixture();
    const level = createLevelGpu({ scene: new THREE.Scene(), pack: f.pack, loadGltf: f.loadGltf, tier: 'high' });
    level.setTable(f.bin);
    level.setHorizon(f.horizon);
    level.update([0, 0]);
    await settle();
    await settle();
    const s = level.stats();
    // red and grey: two groups, whatever the files and the mirrored crate
    expect(s.calls).toBe(2);
    expect(s.drawn).toBe(5);
    expect(s.indirect).toBeGreaterThanOrEqual(s.calls);
    expect(s.tris).toBeGreaterThan(0);
    level.dispose();
  });
});

describe('levelScene.js’s third path', () => {
  const f = fixture();
  const args = { pack: f.pack, loadGltf: f.loadGltf, tier: 'high', gpuScene: true };
  it('is taken on a renderer that draws indirect', () => {
    const scene = new THREE.Scene();
    const level = createLevelScene({ ...args, scene, renderer: { isWebGPURenderer: true, backend: { hasFeature: () => true } } });
    expect(level.root.name).toBe('level:gpuScene');
    expect(typeof level.beforeRender).toBe('function');
    level.dispose();
  });

  it('is not on the node renderer over WebGL 2, the classic renderer or none: lane L’s path draws', () => {
    for (const renderer of [{ isWebGPURenderer: true, backend: { isWebGLBackend: true } }, { isWebGLRenderer: true }, null]) {
      const level = createLevelScene({ ...args, scene: new THREE.Scene(), renderer });
      expect(level.root.name).toBe('level');
      level.dispose();
    }
  });
});
