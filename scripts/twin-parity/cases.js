// The cases twin-parity.mjs compares: each a scene built once with a GLSL
// original (classic) and once with its lane T twin (node), the same in
// every other way. Kept small (256 × 256, a few objects), so a case shows
// its shader and nothing else.
import * as THREE from 'three';
import * as GO from '../../src/lib/three/grounding.js';
import * as GN from '../../src/lib/three/groundingNodes.js';
import * as LO from '../../src/lib/three/groundLook.js';
import * as LN from '../../src/lib/three/groundLookNodes.js';
import * as MO from '../../src/lib/three/groundmap.js';
import * as MN from '../../src/lib/three/groundmapNodes.js';
import * as FO from '../../src/lib/three/foliage.js';
import * as FN from '../../src/lib/three/foliageNodes.js';
import * as CO from '../../src/lib/three/core.js';
import * as CN from '../../src/lib/three/coreNodes.js';
import * as PO from '../../src/lib/three/puffs.js';
import * as PN from '../../src/lib/three/puffsNodes.js';
import * as WO from '../../src/lib/three/wind.js';
import * as WN from '../../src/lib/three/windNodes.js';
import * as HO from '../../src/lib/three/house.js';
import * as HN from '../../src/lib/three/houseNodes.js';
import * as IO from '../../src/lib/three/ink.js';
import * as IN from '../../src/lib/three/inkNodes.js';
import * as RO from '../../src/lib/three/grass.js';
import * as RN from '../../src/lib/three/grassNodes.js';
import * as DO from '../../src/lib/three/dust.js';
import * as DN from '../../src/lib/three/dustNodes.js';
import * as KO from '../../src/lib/three/recolour.js';
import * as KN from '../../src/lib/three/recolourNodes.js';
import * as XO from '../../src/lib/three/matcap.js';
import * as XN from '../../src/lib/three/matcapNodes.js';
import * as BO from '../../src/lib/three/grounding-bake.js';
import * as BN from '../../src/lib/three/groundingBakeNodes.js';
import { createSky } from '../../src/components/galaxy/surface/sky.js';
import { createSkyFog } from '../../src/components/galaxy/surface/skyfog.js';
import { createWater } from '../../src/components/galaxy/surface/water.js';
import * as WEO from '../../src/components/galaxy/surface/weather.js';
import { litWindows as windowsO } from '../../src/components/galaxy/surface/props/windows.js';
import { seaFor, wavesFor } from '../../src/components/galaxy/surface/ocean.js';
import { skyMaterial } from '../../src/components/galaxy/surface/nodes/sky.js';
import { createSkyFog as nodeSkyFog } from '../../src/components/galaxy/surface/nodes/skyfog.js';
import { planeMaterial, seaMaterial } from '../../src/components/galaxy/surface/nodes/water.js';
import * as WEN from '../../src/components/galaxy/surface/nodes/weather.js';
import { litWindows as windowsN } from '../../src/components/galaxy/surface/nodes/props.js';
import * as POSTO from '../../src/components/universe/post.js';
import * as POSTN from '../../src/components/galaxy/surface/nodes/post.js';
import { SITES as DESERT } from '../../src/components/galaxy/surface/sites/desert.js';
import { SITES as EDGE } from '../../src/components/galaxy/surface/sites/edge.js';
import { SITES as FOREST } from '../../src/components/galaxy/surface/sites/forest.js';
import { SITE as BESPIN } from '../../src/components/galaxy/surface/sites/bespin.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const first = (S) => Object.values(S)[0];
const pair = (make, O, N) => ({ node: make(N), classic: make(O) });

// ── lib/three ──

const mask = (b) => {
  const d = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const s = Math.hypot((i % 64) - 32, ((i / 64) | 0) - 32) < 14 ? 30 : 255;
    d.set([s, 255 - s / 2, s, b], i * 4);
  }
  const t = new THREE.DataTexture(d, 64, 64);
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
const bakeOf = () => ({ areas: [{ texture: mask(120), x0: -6, z0: -6, w: 12, d: 12 }], times: [{ tod: 0.3, channel: 0 }, { tod: 0.6, channel: 1 }], shade: 0x5a3420, range: [0, 2] });
const floor = (L) => ({ scene }) => {
  const bake = bakeOf();
  const m = L.floorShadow(new THREE.MeshStandardMaterial({ color: 0x88aa66, roughness: 0.9 }), bake);
  L.setFloorTime(bake, 0.4, 0.8);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), m));
};
const movers = (L) => ({ scene }) => {
  let m = L.standIn(new THREE.MeshStandardMaterial({ color: 0xffffff }), bakeOf());
  m = L.bounce(m, { color: 0xff4400, floor: 'instance', strength: 1 });
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8), m, 3);
  for (let i = 0; i < 3; i++) im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 2 - 2, 0.3 * i, 0));
  scene.add(im);
  const box = new THREE.Mesh(new THREE.BoxGeometry(), L.bounce(new THREE.MeshLambertMaterial(), { color: 0x0044ff, floor: -0.5, strength: 1 }));
  box.position.set(0, 0, 2);
  scene.add(box);
};
const blobs = (L) => ({ scene }) => {
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xddccbb })));
  const b = L.createBlobShadows({ max: 8 });
  b.set(0, { x: 0, z: 0 }, 1, 0, [2, 2], 0.3);
  b.set(1, { x: 2, z: 1 }, 0, 0.2, [1, 3], 0.9);
  scene.add(b.mesh);
};
const terrain = () => {
  const g = new THREE.PlaneGeometry(40, 40, 80, 80).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 0.4) * 1.5 + Math.max(0, 8 - Math.hypot(p.getX(i) - 8, p.getZ(i) + 4)) * 1.2);
  g.computeVertexNormals();
  return g;
};
const ground = (opts) => ([L, M]) => async ({ scene, camera }) => {
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 0, 0);
  const map = opts.map ? M.createGroundMap({ area: { x0: -20, z0: -20, w: 40, d: 40 }, size: 64, paint: (x, z, out) => ((out[0] = 0.5 + 0.5 * Math.sin(x * 0.3)), (out[1] = 0.4), (out[2] = 0.2), 1) }) : null;
  const { material } = L.groundMaterial(first(DESERT), { half: 30, map, splat: opts.splat });
  scene.add(new THREE.Mesh(terrain(), material));
  await wait(2500); // (the scans load)
};
const foliage = (F) => ({ scene }) => {
  const m = F.wind(F.faceless(F.wrapLighting(new THREE.MeshStandardMaterial({ color: 0x3a7a30, side: THREE.DoubleSide }))), { kind: 'shrub', time: { value: 1.3 }, strength: 0.4 });
  const im = new THREE.InstancedMesh(FO.spherifyNormals(new THREE.IcosahedronGeometry(1, 1).translate(0, 1, 0), { keep: 0.2 }), m, 4);
  for (let i = 0; i < 4; i++) im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(i * 2.2 - 3.3, -1, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(1, 1 + i * 0.2, 1)));
  scene.add(im);
};
const core = (C) => async ({ scene }) => {
  const scan = await C.loadCore('rock');
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1.2, 0.4, 100, 16), C.wear(new THREE.MeshStandardMaterial({ color: 0xbb9977 }), scan, { metres: 1.5 })));
};
const puffs = ([P, W, H]) => ({ scene, camera }) => {
  camera.position.set(0, 6, 16);
  camera.lookAt(0, 4, 0);
  const wind = W.createWind({ strength: 0.6 });
  wind.update(3);
  const p = P.createPuffs({ species: { a: '#2f5a26', b: '#9bc25a', bark: '#4a3424' }, count: 4, wind, facing: [0.3, 0.4, 1] });
  for (let i = 0; i < 3; i++) p.set(p.take(), i * 5 - 5, -2, 0, 0.8 + i * 0.1, i);
  scene.add(p.crowns, p.trunks);
  const f = P.puffFor([[0.1, 0.3, 0.1], [0.5, 0.7, 0.3]], { radius: 1.5, height: 4, trunk: 0.2, wind, seed: 3, house: H.createHouse({ fog: false }) });
  const m = new THREE.Mesh(f.geometry, f.material);
  m.position.set(0, -2, 4);
  scene.add(m);
};
const house = ([H, M]) => ({ scene, sun }) => {
  const map = M.createGroundMap({ area: { x0: -10, z0: -10, w: 20, d: 20 }, size: 32, paint: (x, z, out) => ((out[0] = 0.8), (out[1] = 0.2 + 0.03 * x), (out[2] = 0.1), 1) });
  const h = H.createHouse({ shadow: 0x5544aa, edge: [0.2, 0.8] });
  scene.fog = new THREE.FogExp2(0x99aacc, 0.05);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2).translate(0, -1, 0), new THREE.MeshStandardMaterial({ color: 0x998877 })));
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 80, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.6 })));
  h.light({ sun, hemi: scene.children.find((o) => o.isHemisphereLight) });
  h.sky({ low: 0xffddaa, high: 0x3366cc, sunDir: new THREE.Vector3(1, 0.4, 0) });
  h.ground(map, { height: 1.5, strength: 0.8 });
  h.adopt(scene);
};
const ink = (I) => ({ scene }) => {
  const g = new THREE.Group();
  scene.add(g);
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5, 2, 2, 2), new THREE.MeshToonMaterial({ color: 0x66aa44 }));
  g.add(m);
  I.inkHull(g, 0.06, { clipY: 0.5 });
  m.material = I.rimToon(m.material, { color: 0xffeecc, strength: 0.8 });
};
const grass = ([G, M, W]) => ({ scene, camera }) => {
  camera.position.set(0, 1.6, 5);
  camera.lookAt(0, 0.2, 0);
  const groundMap = M.createGroundMap({ area: { x0: -20, z0: -20, w: 40, d: 40 }, size: 64, paint: (x, z, out) => ((out[0] = 0.2), (out[1] = 0.45 + 0.01 * x), (out[2] = 0.1), z > 3 ? 0 : 1), height: (x) => 0.05 * x });
  const wind = W.createWind({ strength: 0.6 });
  wind.update(2);
  const g = G.createGrass({ ground: groundMap, wind, side: 120, size: 12, height: 0.5, width: 0.06, root: 0.35 });
  g.update({ x: 0.3, z: 0.1 });
  scene.add(g.mesh);
};
const dust = (D) => ({ scene }) => {
  const r = Math.random;
  let k = 0;
  Math.random = () => (k = (k * 9301 + 49297) % 233280) / 233280;
  const d = D.createDust({ count: 16, size: 1.2 });
  d.burst([0, 1.5, 0], 1);
  d.burst([1.5, 1.2, 1], 1);
  Math.random = r;
  d.update(0.25);
  scene.add(d.mesh);
};
const recolour = (R) => ({ scene }) => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 64, 64);
  gr.addColorStop(0, '#c03020');
  gr.addColorStop(1, '#f0d040');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.4, 80, 12), R.recolour(new THREE.MeshLambertMaterial({ map }), '#3a8a30', { ref: 0.3 })));
};
const matcap = (X) => ({ scene, renderer, sun }) => {
  const m = X.matcapFor(new THREE.MeshStandardMaterial({ color: 0xcc8866, roughness: 0.5 }), renderer, { sun, hemi: scene.children.find((o) => o.isHemisphereLight) });
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.4, 80, 12), m));
};
const bakeWorld = () => {
  const scene = new THREE.Scene();
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 20, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial());
  const p = floorMesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, 0.05 * p.getX(i));
  scene.add(floorMesh);
  for (const [x, z, h] of [[0, 0, 6], [8, -5, 3], [-10, 6, 10]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3, h, 3), new THREE.MeshStandardMaterial());
    b.position.set(x, h / 2, z);
    scene.add(b);
  }
  return { scene, floorMesh };
};
const bakeOpts = (w) => ({ area: { x0: -20, z0: -20, w: 40, d: 40 }, floor: [w.floorMesh], casters: [w.scene], sun: new THREE.Vector3(0.5, 0.7, 0.3), size: 128, sunSamples: 8, skySamples: 8, shadowSize: 1024 });

// ── the surface's own ──

const look = (camera, dir) => {
  camera.position.set(0, 2, 0);
  camera.lookAt(dir[0], 2 + dir[1], dir[2]);
  camera.fov = 90;
  camera.updateProjectionMatrix();
};
const skyCase = (site, clouds, dir) => ({
  node: ({ scene, camera }) => {
    look(camera, dir);
    const { material, uniforms } = skyMaterial(site, { clouds });
    uniforms.uTime.value = 37.5;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
    mesh.frustumCulled = false;
    mesh.position.copy(camera.position);
    scene.add(mesh);
    scene.background = null;
  },
  classic: ({ scene, camera }) => {
    look(camera, dir);
    const s = createSky(site, { clouds });
    s.update(camera, 37.5, 0);
    scene.add(s.mesh);
    scene.background = null;
  },
});
const sun = new THREE.Vector3(0.4, 0.5, -0.7).normalize();
const shoreAt = (x, z) => -3 + Math.hypot(x - 30, z + 60) * -0.05 + (Math.hypot(x, z + 40) < 25 ? 6 - Math.hypot(x, z + 40) * 0.3 : 0);
const waterCase = (id, site, fine) => {
  const build = (asNode) => ({ scene, camera }) => {
    camera.position.set(0, site.water.level + 6, 20);
    camera.lookAt(0, site.water.level, -30);
    camera.far = 3000;
    camera.updateProjectionMatrix();
    scene.fog = new THREE.FogExp2(0xaabbcc, 0.004);
    const w = createWater(site, sun, '#fff2dd', { heightAt: shoreAt, id, foam: fine, small: true });
    w.update(12.5, camera);
    if (asNode) {
      const vals = Object.fromEntries(Object.entries(w.mesh.material.uniforms).filter(([k]) => k.startsWith('u')).map(([k, v]) => [k, v.value]));
      const kind = site.water.kind;
      w.mesh.material = (kind === 'sea' || kind === 'swamp' || kind === 'salt' ? seaMaterial(vals, wavesFor(seaFor(id, site.water)), { fine }) : planeMaterial(vals, { fine })).material;
      const f = nodeSkyFog({ uniforms: skyMaterial(site).uniforms });
      f.scene(scene);
    } else createSkyFog(createSky(site), THREE.ShaderChunk).scene(scene);
    scene.add(w.mesh);
  };
  return { node: build(true), classic: build(false) };
};
const weather = (W, kinds) => ({ scene, camera }) => {
  camera.position.set(0, 2, 0);
  camera.lookAt(0, 1.5, -10);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x334455 })));
  const w = W.createWeather({ weather: kinds.map((kind) => ({ kind })) }, { small: true });
  w.update(7.3, camera, () => 0, 256);
  scene.add(w.group);
};
const towers = ([W, H]) => ({ scene, camera }) => {
  camera.position.set(0, 20, 60);
  camera.lookAt(0, 20, 0);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(10, 60, 10).translate(0, 30, 0), W(new THREE.MeshStandardMaterial({ color: 0x556070 }), { seed: 3, density: 0.6 }), 3);
  for (let i = 0; i < 3; i++) im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 18 - 18, -10, -i * 5));
  scene.add(im);
  const h = H.createHouse({ fog: false });
  h.light({ sun: { color: new THREE.Color(0.2, 0.2, 0.3), intensity: 1 } });
  h.adopt(scene);
};
const post = (P) => ({ scene, camera, renderer }) => {
  renderer.toneMapping = THREE.NoToneMapping;
  scene.background = new THREE.Color(0.3, 0.45, 0.7);
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 80, 12), new THREE.MeshStandardMaterial({ color: 0xcc8855 })));
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4, 2) }));
  hot.position.set(1.8, 1.2, 0.5);
  scene.add(hot);
  const p = P.createPost(renderer, scene, camera, {});
  p.exposure(1.2);
  return { render: () => p.render(256, 256) };
};

const pick = (sites, kind) => Object.entries(sites).find(([, s]) => s.water?.kind === kind);
const waters = { ...EDGE, ...FOREST, bespin: BESPIN };
const cases = {
  'grounding:floor': pair(floor, GO, GN),
  'grounding:movers': pair(movers, GO, GN),
  'grounding:blobs': pair(blobs, GO, GN),
  'groundLook': pair(ground({}), [LO, MO], [LN, MN]),
  'groundLook:map': pair(ground({ map: true }), [LO, MO], [LN, MN]),
  'groundLook:splat': pair(ground({ splat: true }), [LO, MO], [LN, MN]),
  'foliage': pair(foliage, FO, FN),
  'core': pair(core, CO, CN),
  'puffs': pair(puffs, [PO, WO, HO], [PN, WN, HN]),
  'house': pair(house, [HO, MO], [HN, MN]),
  'ink': pair(ink, IO, IN),
  'grass': pair(grass, [RO, MO, WO], [RN, MN, WN]),
  'dust': pair(dust, DO, DN),
  'recolour': pair(recolour, KO, KN),
  'matcap': pair(matcap, XO, XN),
  'grounding-bake': {
    async compare({ node, classic }) {
      const a = bakeWorld();
      const b = bakeWorld();
      const ra = await BO.bakeFloorTexture(classic, a.scene, bakeOpts(a));
      const rb = await BN.bakeFloorTexture(node, b.scene, bakeOpts(b));
      if (!ra || !rb) return { classic: Boolean(ra), node: Boolean(rb) };
      // the mean difference a channel (R the sun, G and B the height, A the sky), of 255
      return Object.fromEntries(['sun', 'heightHi', 'heightLo', 'sky'].map((name, c) => {
        let s = 0;
        for (let i = c; i < ra.pixels.length; i += 4) s += Math.abs(ra.pixels[i] - rb.pixels[i]);
        return [name, +(s / (ra.pixels.length / 4)).toFixed(2)];
      }));
    },
  },
  'surface:sky:bespin': skyCase(BESPIN, 1, [-0.6, 0.6, -0.8]),
  'surface:sky:desert': skyCase({ ...first(DESERT), sky: { ...first(DESERT).sky, stars: 0.8 } }, 1, [0, 0.3, 1]),
  'surface:weather:snow': { node: weather(WEN, ['snow']), classic: weather(WEO, ['snow']) },
  'surface:weather:rain': { node: weather(WEN, ['rain']), classic: weather(WEO, ['rain']) },
  'surface:weather:sand': { node: weather(WEN, ['sand']), classic: weather(WEO, ['sand']) },
  'surface:windows': pair(towers, [windowsO, HO], [windowsN, HN]),
  'surface:post': pair(post, POSTO, POSTN),
};
// (each twin's own cases, in ./cases/<topic>.js: a default export of { name: case })
for (const mod of Object.values(import.meta.glob('./cases/*.js', { eager: true }))) Object.assign(cases, mod.default);
for (const kind of ['sea', 'swamp', 'lava', 'clouds']) {
  const [id, site] = pick(waters, kind);
  cases[`surface:water:${kind}`] = waterCase(id, site, true);
}
export default cases;
