// The GPU scene's cull on a real device beside its CPU twin (GPU-first lane
// N1): src/lib/three/gpuScene/cullPass.js's three dispatches run on a seeded
// scene of 3,000 rows (three meshes, a mirrored share, some freed), read
// back, and every key's list, the shadow lists and the files drawn compared
// with cull.js's cullCpu. Four frames: no pyramid; the camera moved (the
// LOD fades listed twice); a wall's depth through the pyramid; a file not
// loaded (the rows held at the old one). Compute only: no canvas is drawn,
// so it runs where a WebGPU device comes up, SwiftShader's included.
// scripts/gpu-scene-parity.mjs opens it and prints window.__parity.

import { createGpuScene } from '../../src/lib/three/gpuScene/scene.js';
import { ROW_U32, packInstances } from '../../src/lib/three/gpuScene/pack.js';
import { cameraOf, cullCpu, meshTable, NONE, sphereRect } from '../../src/lib/three/gpuScene/cull.js';
import { createCull } from '../../src/lib/three/gpuScene/cullPass.js';
import { createHzb, reduceDepth } from '../../src/lib/three/gpuScene/hzb.js';
import { loadGpuThree } from '../../src/lib/three/gpuScene/three.js';

const W = 256;
const H = 144;
const N = 3000;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const PACK = {
  meshes: [
    { radius: 1, bounds: [-1, -1, -1, 1, 1, 1], lods: [4000, 1200, 300], glb: ['a0', 'a1', 'a2'] },
    { radius: 4, bounds: [-4, 0, -4, 4, 8, 4], lods: [9000, 2000], glb: [null, 'b1'] },
    { radius: 0.3, bounds: [0, 0, 0, 0.6, 0.2, 0.4], lods: [800, 400, 200, 100], glb: ['c0', 'c1', 'c2', 'c3'] },
  ],
  cull: { ultra: { K: 900, dropped: [] } },
};

function rows(r) {
  return Array.from({ length: N }, (_, i) => {
    const mesh = i % 3;
    const mirrored = mesh === 0 && i % 7 === 0;
    const a = r() * Math.PI * 2;
    const q = [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
    const s = 0.5 + r() * 2;
    return { position: [(r() - 0.5) * 600, r() * 4, (r() - 0.5) * 600], quaternion: q, scale: [mirrored ? -s : s, s, s * (0.8 + r() * 0.4)], mesh, mirrored };
  });
}

const sorted = (a) => Array.from(a).sort((x, y) => x - y);

async function main() {
  const three = await loadGpuThree();
  const { THREE } = three;
  const renderer = new THREE.WebGPURenderer({ antialias: false });
  await renderer.init();
  if (renderer.backend.isWebGLBackend) throw new Error('no WebGPU device: the node renderer fell back to WebGL 2');

  const r = rng(11);
  const all = rows(r);
  const scene = createGpuScene({ capacity: N });
  const packed = new Uint32Array(N * ROW_U32);
  packInstances(all, packed);
  scene.append(packed, N);
  // (some cells dropped: their rows dead in place)
  for (let i = 0; i < N; i += 97) scene.free({ start: i, count: 5 });
  const counts = new Map();
  for (const row of all) counts.set(`${row.mesh}|${row.mirrored ? 1 : 0}`, (counts.get(`${row.mesh}|${row.mirrored ? 1 : 0}`) ?? 0) + 1);
  const table = meshTable(PACK, 'ultra', { counts });
  for (const glb of ['a0', 'a2', 'b1', 'c0', 'c1', 'c2', 'c3']) table.load(glb);

  const hzb = createHzb(renderer, { width: W, height: H, three });
  const cull = createCull(renderer, { scene, table, hzb, three, slots: 64 });
  table.keys.forEach((k, s) => cull.setSlot(s, { key: s, indexCount: 3, firstIndex: 0, baseVertex: 0 }));

  const camera = new THREE.PerspectiveCamera(60, W / H, 0.5, 2000);
  const place = (pos, at) => {
    camera.position.set(...pos);
    camera.lookAt(...at);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
  };

  const out = { frames: [] };
  let state = null;
  async function frame(name, now, { mips = null } = {}) {
    cull.run(camera, { now, width: W, height: H });
    const got = await cull.read();
    const cam = cameraOf(camera, W, H);
    const want = cullCpu({ scene, table, camera: cam, tier: 'ultra', hzb: mips, state, now });
    state = want.state;
    const f = { name, keys: 0, rowsDiffer: 0, shadowDiffer: 0, lodsDiffer: 0, drawn: 0, shadow: 0, args: 0, fading: 0 };
    const stats = got.counters.subarray(got.keys * 2);
    f.stats = { gpu: Array.from(stats), cpu: [want.stats.tested, want.stats.culled, want.stats.occluded, want.stats.drawn] };
    for (const [key, k] of table.keys.entries()) {
      const n = got.counters[key];
      const sn = got.counters[got.keys + key];
      const gpu = sorted(got.visible.subarray(k.base, k.base + n));
      const gpuShadow = sorted(got.visible.subarray(got.room + k.base, got.room + k.base + sn));
      const cpu = sorted(want.lists.get(key) ?? []);
      const cpuShadow = sorted(want.shadow.get(key) ?? []);
      if (gpu.join() !== cpu.join()) f.rowsDiffer += Math.max(1, Math.abs(gpu.length - cpu.length));
      if (gpuShadow.join() !== cpuShadow.join()) f.shadowDiffer += Math.max(1, Math.abs(gpuShadow.length - cpuShadow.length));
      f.drawn += n;
      f.shadow += sn;
      f.keys++;
      // (the slot's arguments: the count and the base as firstInstance)
      if (got.indirect[key * 5 + 1] !== n || got.indirect[key * 5 + 4] !== k.base) f.args++;
    }
    for (let i = 0; i < scene.count; i++) {
      const g = got.state[i * 2] & 15;
      const c = want.lods[i];
      if (scene.isLive(i) && g !== c && !(c === NONE && g === NONE)) f.lodsDiffer++;
    }
    f.fading = f.drawn - want.stats.drawn;
    out.frames.push(f);
  }

  place([0, 20, 260], [0, 0, 0]);
  await frame('no pyramid', 0);
  // (beside a live mirrored crate, row 21: it comes in to a finer file and is listed in both while it fades)
  const [x0, , z0] = all[21].position;
  place([x0 + 2, 1.5, z0 + 3], [x0, 0, z0]);
  await frame('moved: the fades', 1);
  // the crate's middle file arrives: rows held elsewhere move to it
  table.load('a1');
  await frame('a file arrives', 1.1);
  // the wall: a fronto-parallel plane's depth over the whole screen at 30 m
  const depthOf = sphereRect([0, 0, -31].map((v, j) => v + camera.position.toArray()[j]), 1, cameraOf(camera, W, H))?.near;
  const wall = new THREE.Scene();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshBasicNodeMaterial());
  plane.position.copy(camera.position).add(new THREE.Vector3(0, 0, -30));
  wall.add(plane);
  const rt = new THREE.RenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H, THREE.FloatType) });
  rt.depthTexture.format = THREE.DepthFormat;
  const ahead = new THREE.PerspectiveCamera().copy(camera);
  ahead.lookAt(camera.position.clone().add(new THREE.Vector3(0, 0, -1)));
  ahead.updateMatrixWorld();
  camera.copy(ahead);
  renderer.setRenderTarget(rt);
  renderer.render(wall, camera);
  renderer.setRenderTarget(null);
  hzb.update(rt.depthTexture);
  const plane30 = cameraOf(camera, W, H);
  const v = new THREE.Vector3(0, 0, -30).applyMatrix4(camera.matrixWorld);
  const z = sphereRect(v.toArray(), 1e-6, plane30)?.near ?? depthOf;
  out.wallDepth = z;
  await frame('a wall at 30 m', 3, { mips: reduceDepth(new Float32Array(W * H).fill(z), W, H) });
  window.__parity = out;
}

main().catch((e) => {
  window.__parity = { error: String(e?.stack ?? e) };
});
