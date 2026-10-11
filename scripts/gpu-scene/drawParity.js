// The GPU scene's draws beside lane L's InstancedMesh (GPU-first lane N1):
// one seeded field of crates (two LOD files, a mirrored share, some scaled
// unevenly) and huts, drawn into a render target twice: by
// src/lib/three/gpuScene/draws.js from the cull's lists, and by one
// InstancedMesh a (mesh, file, mirrored) key with the same rows at the same
// files (the CPU twin's lists), the mirrored ones from a copy wound the
// other way as levelScene.js draws them. The pixels are read back and
// compared (mean and largest difference, 0…255, and the share of pixels off
// by more than 8). Offscreen, so SwiftShader's WebGPU device serves.

import { createGpuScene } from '../../src/lib/three/gpuScene/scene.js';
import { ROW_U32, packInstances } from '../../src/lib/three/gpuScene/pack.js';
import { cameraOf, cullCpu, meshTable } from '../../src/lib/three/gpuScene/cull.js';
import { createCull } from '../../src/lib/three/gpuScene/cullPass.js';
import { createDraws } from '../../src/lib/three/gpuScene/draws.js';

export async function drawParity(three, renderer, { W = 320, H = 180, seed = 5 } = {}) {
  const { THREE } = three;
  let s = seed >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const PACK = {
    meshes: [
      { radius: 0.9, bounds: [-0.5, 0, -0.5, 0.5, 1, 0.5], lods: [1000, 300], glb: ['crate0', 'crate1'] },
      { radius: 3, bounds: [-2, 0, -1.5, 2, 3, 1.5], lods: [500], glb: ['hut0'] },
    ],
  };
  // the parts: a crate (a wedge on a box, so a mirrored one reads mirrored) and a hut
  const crate = (detail) => {
    const g = new THREE.BoxGeometry(1, 1, 1, detail, detail, detail).translate(0, 0.5, 0);
    const wedge = new THREE.ConeGeometry(0.35, 0.6, detail * 3 + 3).rotateZ(-Math.PI / 2).translate(0.55, 0.5, 0.2);
    return [g, wedge];
  };
  const red = new THREE.MeshStandardNodeMaterial({ color: 0xb04a2a, roughness: 0.6 });
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x8a96a8, roughness: 0.35, metalness: 0.3 });
  const files = {
    crate0: crate(3).map((geometry, k) => ({ geometry, material: k ? steel : red, local: new THREE.Matrix4() })),
    crate1: crate(1).map((geometry, k) => ({ geometry, material: k ? steel : red, local: new THREE.Matrix4() })),
    hut0: [{ geometry: new THREE.BoxGeometry(4, 3, 3).translate(0, 1.5, 0), material: steel, local: new THREE.Matrix4().makeRotationY(0.3) }],
  };

  const rows = [];
  for (let i = 0; i < 400; i++) {
    const mesh = i % 9 === 0 ? 1 : 0;
    const mirrored = mesh === 0 && i % 5 === 0;
    const a = r() * Math.PI * 2;
    const k = 0.6 + r();
    rows.push({ position: [(r() - 0.5) * 60, 0, -r() * 70], quaternion: [0, Math.sin(a / 2), 0, Math.cos(a / 2)], scale: [mirrored ? -k : k, k * (0.7 + r() * 0.6), k], mesh, mirrored });
  }
  const scene = createGpuScene({ capacity: rows.length });
  const packed = new Uint32Array(rows.length * ROW_U32);
  packInstances(rows, packed);
  scene.append(packed, rows.length);
  const counts = new Map();
  for (const row of rows) counts.set(`${row.mesh}|${row.mirrored ? 1 : 0}`, (counts.get(`${row.mesh}|${row.mirrored ? 1 : 0}`) ?? 0) + 1);
  const table = meshTable(PACK, 'ultra', { counts });

  const lit = (sc) => {
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-20, 30, 10);
    sc.add(sun, new THREE.HemisphereLight(0xbcd0ff, 0x403830, 0.9));
    sc.background = new THREE.Color(0x1a2230);
  };
  const gpuWorld = new THREE.Scene();
  lit(gpuWorld);
  const cull = createCull(renderer, { scene, table, three, slots: 64 });
  const draws = createDraws(renderer, { cull, three, parent: gpuWorld, keyOf: (m) => m.uuid });
  for (const [glb, parts] of Object.entries(files)) {
    draws.add(parts, table.keysOf(glb).map((key) => ({ key, ...table.keyInfo(key) })));
    table.load(glb);
  }

  const camera = new THREE.PerspectiveCamera(55, W / H, 0.3, 500);
  camera.position.set(0, 9, 14);
  camera.lookAt(0, 0, -25);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  // (well past every fade: the picture steady)
  cull.run(camera, { now: 100, width: W, height: H, occlude: false });

  // the reference: the CPU twin's lists as InstancedMeshes
  const ref = new THREE.Scene();
  lit(ref);
  const want = cullCpu({ scene, table, camera: cameraOf(camera, W, H), tier: 'ultra', now: 100 });
  const m4 = new THREE.Matrix4();
  for (const [key, list] of want.lists) {
    const info = table.keyInfo(key);
    for (const part of files[info.glb]) {
      let g = part.geometry.clone().applyMatrix4(part.local);
      if (info.mirrored) {
        g = g.index ? g : g.toNonIndexed();
        const ix = g.index ? g.index.array : null;
        if (ix) for (let t = 0; t + 2 < ix.length; t += 3) [ix[t + 1], ix[t + 2]] = [ix[t + 2], ix[t + 1]];
      }
      const im = new THREE.InstancedMesh(g, part.material, list.length);
      list.forEach((i, k) => {
        const row = rows[i];
        im.setMatrixAt(k, m4.compose(new THREE.Vector3(...row.position), new THREE.Quaternion(...row.quaternion), new THREE.Vector3(...row.scale)));
      });
      im.frustumCulled = false;
      ref.add(im);
    }
  }

  const shoot = async (sc) => {
    const rt = new THREE.RenderTarget(W, H, { depthBuffer: true });
    renderer.setRenderTarget(rt);
    renderer.render(sc, camera);
    renderer.setRenderTarget(null);
    const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, W, H);
    rt.dispose();
    return new Uint8Array(px.buffer ?? px);
  };
  const a = await shoot(gpuWorld);
  const b = await shoot(ref);
  let sum = 0;
  let max = 0;
  let off = 0;
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    sum += d;
    max = Math.max(max, d);
    if (d > 8) off++;
  }
  const info = renderer.info.render;
  const out = { size: `${W}x${H}`, rows: rows.length, listed: [...want.lists.values()].reduce((n, l) => n + l.length, 0), mean: sum / (a.length / 4), max, offShare: off / (a.length / 4), groups: draws.stats().groups, slots: draws.stats().slots, referenceDraws: ref.children.filter((o) => o.isInstancedMesh).length, gpuPng: toB64(a, W, H), refPng: toB64(b, W, H), calls: info.drawCalls };
  draws.dispose();
  cull.dispose();
  return out;
}

// the RGBA pixels as read (WebGPU's rows run top-down), base64 for the driver to write
function toB64(px, W, H) {
  let bin = '';
  for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode(...px.subarray(i, i + 0x8000));
  return { w: W, h: H, data: btoa(bin) };
}
