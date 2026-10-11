/* global window */
// The octahedral impostor bake (lane N4): one mesh photographed from n × n
// directions over its upper hemisphere (scripts/lib/impostor-layout.mjs's
// views and axes), each view one tile of a square atlas, twice: its albedo
// (unlit, its alpha the coverage) and its normal and depth (the normal in
// the mesh's own frame in RGB, the depth through its middle in A), so the
// runtime's card (src/lib/three/impostor.js) is lit by the scene's sun as
// the mesh would be. Rendered in headless Chromium with three's classic
// renderer: in software GL in the cloud (the proof), on the owner's
// graphics chip at full quality through lane W's desktop job.
//
//   createBaker({ chrome }) → { bake(glb, { n, size, colour }) → { albedo, normal, radius, centre }, close() }
//     (glb: a mesh's bytes, textures stripped (levelPack.js's splitTextures);
//     colour: its colour map's KTX2 bytes, or null for its material's colour;
//     albedo, normal: PNG buffers size × size, the tiles' empty texels
//     filled from their neighbours so the mips keep the edges' colour)
//   node scripts/impostors.mjs <mesh.glb> <out-dir> [--n 16] [--size 2048]

import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { parseArgs } from './lib/args.mjs';
import { VIEWS, impostorViews, viewBasis } from './lib/impostor-layout.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};

// (the page: three's classic renderer, its GLTF and KTX2 loaders from
// node_modules; the shaders here are the bake's, never shipped)
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const NORMAL_VERT = \`varying vec3 vN; varying float vD; uniform vec3 dir; uniform vec3 centre; uniform float radius;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vD = dot(w.xyz - centre, dir) / radius; gl_Position = projectionMatrix * viewMatrix * w; }\`;
const NORMAL_FRAG = \`varying vec3 vN; varying float vD;
  void main() { vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n * 0.5 + 0.5, clamp(vD * 0.5 + 0.5, 0.0, 1.0)); }\`;
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
window.bake = async ({ glb, colour, views, size, n }) => {
  const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, alpha: true, antialias: true, premultipliedAlpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(true);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(b64(glb), '');
  let map = null;
  if (colour) {
    const k = new KTX2Loader().setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);
    map = await new Promise((ok, no) => k.parse(b64(colour), ok, no));
    map.colorSpace = THREE.SRGBColorSpace;
  }
  const scene = new THREE.Scene();
  scene.add(gltf.scene);
  scene.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());
  const R = sphere.radius || 1;
  const meshes = [];
  gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
  const albedo = meshes.map((o) => new THREE.MeshBasicMaterial({ color: o.material.color ?? 0xffffff, map, side: THREE.DoubleSide }));
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.01, R * 4);
  const tile = size / n;
  const pass = (materials, clear) => {
    meshes.forEach((o, k) => (o.material = materials(k)));
    renderer.setScissor(0, 0, size, size);
    renderer.setViewport(0, 0, size, size);
    renderer.setClearColor(clear, 0);
    renderer.clear();
    views.forEach(({ dir, up }, v) => {
      const i = v % n;
      const j = Math.floor(v / n);
      // (tile j counted from the picture's top; the viewport's y from its bottom)
      const y = size - (j + 1) * tile;
      renderer.setScissor(i * tile, y, tile, tile);
      renderer.setViewport(i * tile, y, tile, tile);
      cam.position.set(sphere.center.x + dir[0] * R * 2, sphere.center.y + dir[1] * R * 2, sphere.center.z + dir[2] * R * 2);
      cam.up.set(up[0], up[1], up[2]);
      cam.lookAt(sphere.center);
      cam.updateMatrixWorld(true);
      for (const o of meshes) if (o.material.uniforms) o.material.uniforms.dir.value.set(dir[0], dir[1], dir[2]);
      renderer.render(scene, cam);
    });
    return renderer.domElement.toDataURL('image/png').split(',')[1];
  };
  const a = pass((k) => albedo[k], 0x000000);
  const normal = pass(() => new THREE.ShaderMaterial({ vertexShader: NORMAL_VERT, fragmentShader: NORMAL_FRAG, side: THREE.DoubleSide, uniforms: { dir: { value: new THREE.Vector3() }, centre: { value: sphere.center }, radius: { value: R } } }), 0x8080ff);
  renderer.dispose();
  return { albedo: a, normal, radius: R, centre: sphere.center.toArray() };
};
window.ready = true;
</script>`;

// spread a tile's colour into its empty texels (eight passes), so the mips
// down to the tile's 16 texels keep the edge's colour, not black
export function bleed(rgba, w, h, passes = 8) {
  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) known[i] = rgba[i * 4 + 3] > 8 ? 1 : 0;
  for (let p = 0; p < passes; p++) {
    const next = known.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let k = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!known[j]) continue;
          r += rgba[j * 4];
          g += rgba[j * 4 + 1];
          b += rgba[j * 4 + 2];
          k++;
        }
        if (k) {
          rgba[i * 4] = r / k;
          rgba[i * 4 + 1] = g / k;
          rgba[i * 4 + 2] = b / k;
          next[i] = 1;
        }
      }
    known.set(next);
  }
  return rgba;
}

export async function createBaker({ chrome = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', angle = process.env.ANGLE ?? 'swiftshader' } = {}) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/bake.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
      return;
    }
    const file = join(ROOT, path);
    if (!file.startsWith(join(ROOT, 'node_modules')) || !existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: chrome,
    args: ['--use-gl=angle', `--use-angle=${angle}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'],
  });
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('bake page:', m.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/bake.html`);
  await page.waitForFunction(() => window.ready);
  return {
    async bake(glb, { n = VIEWS, size = 2048, colour = null } = {}) {
      const views = impostorViews(n).map((dir) => ({
        dir,
        up: viewBasis(dir).up,
      }));
      const r = await page.evaluate((a) => window.bake(a), {
        glb: Buffer.from(glb).toString('base64'),
        colour: colour ? Buffer.from(colour).toString('base64') : null,
        views,
        size,
        n,
      });
      const raw = async (b64) => sharp(Buffer.from(b64, 'base64')).ensureAlpha().raw().toBuffer();
      const albedo = bleed(await raw(r.albedo), size, size);
      const normal = await raw(r.normal);
      const png = (buf) =>
        sharp(buf, { raw: { width: size, height: size, channels: 4 } })
          .png({ compressionLevel: 9 })
          .toBuffer();
      return {
        albedo: await png(albedo),
        normal: await png(normal),
        radius: r.radius,
        centre: r.centre,
      };
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [glbPath, out] = args._;
  if (!glbPath || !out) {
    console.error('node scripts/impostors.mjs <mesh.glb> <out-dir> [--n 16] [--size 2048]');
    process.exit(1);
  }
  const { splitTextures } = await import('../src/components/galaxy/surface/level/levelPack.js');
  const glb = splitTextures(new Uint8Array(await readFile(glbPath)).buffer).buffer;
  const baker = await createBaker();
  const t0 = Date.now();
  const r = await baker.bake(glb, {
    n: Number(args.n ?? VIEWS),
    size: Number(args.size ?? 2048),
  });
  await baker.close();
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'albedo.png'), r.albedo);
  await writeFile(join(out, 'normal.png'), r.normal);
  console.log(`baked in ${((Date.now() - t0) / 1000).toFixed(1)} s: radius ${r.radius.toFixed(2)} m → ${out}`);
}
