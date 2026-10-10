// Lane Q2's proof page: Hoth's own heightmap (the level pack's near map)
// on the node renderer, lit by the game's record through applyGameLight,
// its ground drawn either as a node world would draw it without Q2 (one
// flat material in the record's TerrainColor, `mat=flat`) or in the game's
// layers (`mat=layered`, attachLayeredGround with the pack's ground.json).
// The galaxy's surface is still the classic renderer until lane T's flip,
// so this page is where the layered ground is seen before it is wired.
// Served by the dev server: /docs/superpowers/evidence/bf2017-surfaces/Q2/ground.html
//
//   ?gpu=webgl|webgpu  &mat=flat|layered  &tier=ultra|high|mid|low
//   &view=field2|field50|trench|ridge
//
// window.__q2 → { ready, samples, frameMs, info } once drawn.

import * as THREE from 'three/webgpu';
import hoth from '../../../../../src/lib/three/light/fixtures/hoth.ve.json';
import { applyGameLight } from '../../../../../src/lib/three/light/apply.js';
import { readEntry } from '../../../../../src/lib/three/light/entry.js';
import { attachLayeredGround } from '../../../../../src/lib/three/ground/layeredGround.js';
import { decodeHeights } from '../../../../../src/lib/land/layers.js';
import { decodePng16 } from '../../../../../src/lib/level/png16.js';
import { tierTexture } from '../../../../../src/components/galaxy/surface/level/levelPack.js';

const q = new URLSearchParams(location.search);
const gpu = q.get('gpu') ?? 'webgl';
const mat = q.get('mat') ?? 'layered';
const tier = q.get('tier') ?? 'ultra';
const view = q.get('view') ?? 'field2';
const PACK = '/models/galaxy/bf2017/levels/hoth/';
// the views: where the camera stands, what it looks at (the site's frame;
// the field and the trench from the masks' purest pixels near the mouth)
const VIEWS = {
  field2: { at: [8, -56], from: [8, -53], eye: 1.7 },
  field50: { at: [8, -56], from: [8, -6], eye: 1.7 },
  trench: { at: [-224, -48], from: [-184, -48], eye: 1.7 },
  ridge: { at: [470, -570], from: [470, -520], eye: 1.7 },
};
// metres: the patch of ground drawn round the view, and its spacing
const SPAN = 1024;
const STEP = 2;

const bytes = (path) =>
  fetch(PACK + path).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.arrayBuffer();
  });

async function main() {
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: gpu === 'webgl' });
  renderer.setSize(1280, 720);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  const pack = JSON.parse(new TextDecoder().decode(await bytes('level.json')));
  const t = pack.terrain;
  const png = await decodePng16(new Uint8Array(await bytes(t.near.png)));
  const heights = decodeHeights(png.data, t.scale, t.offset, { hole: t.hole });
  const mpp = t.near.metresPerPixel;
  const heightAt = (x, z) => {
    const gx = Math.min(png.w - 1.001, Math.max(0, (x - t.near.min[0]) / mpp));
    const gz = Math.min(png.h - 1.001, Math.max(0, (z - t.near.min[1]) / mpp));
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const h = (a, b) => {
      const v = heights[b * png.w + a];
      return Number.isNaN(v) ? 0 : v;
    };
    return h(i, j) * (1 - fx) * (1 - fz) + h(i + 1, j) * fx * (1 - fz) + h(i, j + 1) * (1 - fx) * fz + h(i + 1, j + 1) * fx * fz;
  };

  const v = VIEWS[view];
  const n = SPAN / STEP;
  const geo = new THREE.PlaneGeometry(SPAN, SPAN, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + v.at[0];
    const z = pos.getZ(i) + v.at[1];
    pos.setXYZ(i, x, heightAt(x, z), z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const light = readEntry(hoth.sunny);
  const flat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0.547, 0.594, 0.644), roughness: 0.58, metalness: 0 });
  const mesh = new THREE.Mesh(geo, flat);
  mesh.receiveShadow = true;
  const scene = new THREE.Scene();
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(55, 1280 / 720, 0.1, 4000);
  const fy = heightAt(...v.from) + v.eye;
  camera.position.set(v.from[0], fy, v.from[1]);
  camera.lookAt(v.at[0], heightAt(...v.at), v.at[1]);

  const lit = await applyGameLight(scene, renderer, hoth.sunny, { tier, camera, sky: true, post: false });
  lit.update(0, camera);
  renderer.toneMappingExposure = light.exposure ?? 1;

  let samples = null;
  if (mat === 'layered') {
    const urlOf = (path, tr) => PACK + tierTexture(path, tr, pack.tex);
    const layered = attachLayeredGround({ mesh, renderer, pack, tier, entry: hoth.sunny, fetchBytes: bytes, urlOf });
    const g = await layered.ready;
    g?.setSun(light.sun.dir, light.sun.color);
    samples = g?.samples ?? null;
  }

  await renderer.compileAsync(scene, camera);
  for (let i = 0; i < 3; i++) renderer.render(scene, camera);
  // the frame time over a few frames (the GPU waited on each)
  const N = 10;
  const px = new Uint8Array(4);
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    renderer.render(scene, camera);
    // (the GPU's work done before the clock reads: a pixel read back on
    // WebGL 2, which waits for the frame; the queue on WebGPU)
    const gl = renderer.backend.gl;
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    else await renderer.backend.device?.queue.onSubmittedWorkDone();
  }
  const frameMs = (performance.now() - t0) / N;
  window.__q2 = { ready: true, gpu, mat, tier, view, samples, frameMs: +frameMs.toFixed(1), info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures } };
}

main().catch((e) => {
  console.error(e);
  window.__q2 = { ready: true, error: String(e?.stack ?? e) };
});
