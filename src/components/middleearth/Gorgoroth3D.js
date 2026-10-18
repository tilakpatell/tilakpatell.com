// The plain of Gorgoroth in WebGL: ash and broken rock under a burning sky,
// the road to Mount Doom, Barad-dûr to the north-east with the Eye on top
// and its light sweeping the plain, Frodo and Sam on the road and the orcs
// marching down it. It draws what ./walk.js says is happening (the host
// hands it the walk's state every frame) and decides nothing.
//
// Loaded only when the plain is on screen and WebGL works.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, createStage, hot } from './stage';
import { createModels } from '../../lib/models';
import { houseOn } from '../../lib/three/house';
import { fbm, makeCanvas, makeNoise, ridge, smooth, tiled } from '../../lib/paint';
import { rng } from '../../lib/texture';
import { WALK } from './walk';
import { EMBER, FIRE, SMOKE, createParticles, lavaMaterial, makeHobbit, makeOrc, skyDome, stoneTextures } from './kit';
import { castDo, releaseCast, tickCast, upgrade } from './cast3d';
import { createShake } from './feel';
import { BLOOMS } from './look';
import { houseGroups } from '../../lib/three/houseTuning';
import { beamMaterial, eyeMaterial, poolMaterial } from './gorgorothShaders';

// the drawing's x (see walk.js) to the scene's: the road runs along x
const X = (svg) => (svg - 265) / 10;
const END = X(WALK.x1);
const DOOM = { x: 41, z: -7, r: 21, h: 31 };
const TOWER = { x: 68, z: -192, scale: 0.66 };
const LANE = { hobbits: 0.8, orcs: -0.7 };
const R = (a) => (Math.random() - 0.5) * 2 * a;
const ASH = [
  [0, 0.42, 0.38, 0.36, 0],
  [0.15, 0.42, 0.38, 0.36, 0.55],
  [0.8, 0.3, 0.27, 0.26, 0.4],
  [1, 0.3, 0.27, 0.26, 0],
];

// The plain's height at (x, z): flat along the road, rough beside it, hills
// to the north, and fissures cut down to the fire underneath.
function makeHeight() {
  const n = makeNoise(31);
  const n2 = makeNoise(57);
  return (x, z) => {
    const off = smooth(2.4, 10, Math.abs(z));
    const side = z > 0 ? 0.28 : 0.25 + 0.75 * smooth(-6, -60, z);
    let h = (fbm(n, x * 0.045, z * 0.045, { octaves: 4 }) - 0.42) * 14 * off * side;
    h += (fbm(n, x * 0.35 + 9, z * 0.35, { octaves: 2 }) - 0.5) * 0.7 * (0.12 + off);
    const f = ridge(n2, x * 0.04, z * 0.04, { octaves: 2 });
    h -= smooth(0.9, 0.985, f) * 3.4 * smooth(5, 14, Math.abs(z));
    return h;
  };
}

// Mount Doom: a concave cone, gullied, with the fire running down it.
function doom(renderer) {
  const n = makeNoise(77);
  const g = new THREE.CylinderGeometry(1, 1, DOOM.h, 72, 22, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = (y + DOOM.h / 2) / DOOM.h;
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const lump = fbm(n, Math.cos(a) * 2.4 + 5, Math.sin(a) * 2.4 + k * 3, { octaves: 4 }) - 0.5;
    const gully = Math.abs(Math.sin(a * 7 + lump * 5)) * 0.12;
    const r = (2.8 + (DOOM.r - 2.8) * (1 - k) ** 1.7) * (1 + lump * 0.42 * (1 - k * 0.6) - gully * (1 - k));
    p.setXYZ(i, Math.cos(a) * r, y + (k > 0.97 ? lump * 2.5 : 0), Math.sin(a) * r);
  }
  g.computeVertexNormals();
  // the streams: brightest at the crater, thinning as they go down
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 512);
  const rand = rng(9);
  ctx.lineCap = 'round';
  for (let s = 0; s < 9; s++) {
    let x = rand() * 512;
    const reach = 150 + rand() * 300;
    for (let y = 0; y < reach; y += 6) {
      const nx = x + (rand() - 0.5) * 16;
      const k = 1 - y / reach;
      const w = 2 + 7 * k;
      tiled(ctx, 512, 512, (cx) => {
        cx.strokeStyle = `rgba(255, ${Math.round(70 + 120 * k)}, ${Math.round(20 * k)}, ${0.25 + 0.75 * k})`;
        cx.lineWidth = w;
        cx.shadowColor = '#ff5a14';
        cx.shadowBlur = 10;
        cx.beginPath();
        cx.moveTo(x, y);
        cx.lineTo(nx, y + 6);
        cx.stroke();
      });
      x = nx;
    }
  }
  const tex = stoneTextures(renderer, { seed: 41, joint: 0.5, repeat: [9, 4], dark: [22, 16, 14], light: [92, 70, 60], relief: 4 });
  const mat = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughness: 1, emissive: new THREE.Color(1, 1, 1), emissiveMap: canvasTexture(c, renderer, { wrap: true }), emissiveIntensity: 2.6 });
  const m = new THREE.Mesh(g, mat);
  m.position.set(DOOM.x, DOOM.h / 2 - 1.5, DOOM.z);
  m.receiveShadow = true;
  return m;
}

// Barad-dûr: tier on tier, spiked, with the two horns the Eye burns between.
function tower() {
  const parts = [];
  const box = (w, h, d, y) => parts.push(new THREE.BoxGeometry(w, h, d).translate(0, y + h / 2, 0));
  let y = -4;
  for (const [w, h] of [
    [19, 20],
    [13.5, 15],
    [9.5, 14],
    [6.5, 12],
    [4.4, 9],
  ]) {
    box(w, h, w, y);
    box(w * 0.3, h * 0.62, w * 1.28, y);
    box(w * 1.28, h * 0.62, w * 0.3, y);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(
          new THREE.ConeGeometry(w * 0.13, h * 0.8, 4)
            .rotateY(Math.PI / 4)
            .translate(sx * w * 0.44, y + h + h * 0.4, sz * w * 0.44),
        );
      }
    }
    y += h;
  }
  for (const s of [-1, 1]) {
    parts.push(
      new THREE.CylinderGeometry(0.15, 1.35, 14, 4)
        .rotateZ(s * 0.16)
        .translate(s * 3.5, y + 6, 0),
    );
  }
  return { geometry: mergeGeometries(parts), top: y };
}

export function createGorgoroth3D(canvas, { soft = false, reduced = false, onLost } = {}) {
  const stage = createStage(canvas, { soft, shadows: true, fov: 48, near: 0.4, far: 900, exposure: 1.05, bloom: BLOOMS.gorgoroth, onLost });
  const { scene, camera, renderer } = stage;
  scene.fog = new THREE.FogExp2(0x2a0f08, 0.0085);
  scene.background = new THREE.Color(0x120604);
  stage.grade({ contrast: 0.2, saturation: 1, vignette: 0.42, shadow: [0.012, 0.004, 0], high: [0.03, 0.012, 0] });
  const k = soft ? 0.4 : 1;

  // ── the sky, and what light there is ──
  const sky = skyDome(600, { top: 0x090403, horizon: 0x4a1708, bottom: 0x100604, cloud: 1, glow: [DOOM.x + 8, 26, DOOM.z - 30], glowColor: 0xff5a14 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0x6a2c18, 0x1c100c, 0.85);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x8494b8, 0.45);
  fill.position.set(-20, 30, 30);
  scene.add(fill);
  // the mountain's glow, from ahead: it rims everything on the road
  const glow = new THREE.DirectionalLight(0xff6a2a, 1.5);
  glow.castShadow = true;
  glow.shadow.mapSize.set(2048, 2048);
  Object.assign(glow.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20, near: 2, far: 120 });
  glow.shadow.bias = -0.0005;
  glow.shadow.normalBias = 0.05;
  scene.add(glow, glow.target);

  // ── the plain ──
  const height = makeHeight();
  const land = new THREE.PlaneGeometry(250, 190, soft ? 100 : 170, soft ? 76 : 128).rotateX(-Math.PI / 2).translate(10, 0, -52);
  {
    const p = land.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const h = height(x, z);
      p.setY(i, h);
      // the road, trodden paler; the fissures' lips scorched
      const road = 1 - smooth(1.2, 2.6, Math.abs(z)) * 1;
      const burn = smooth(-0.3, -1.6, h);
      const shade = 0.78 + road * 0.5 * smooth(END + 3, END - 2, x);
      col[i * 3] = shade + burn * 0.9;
      col[i * 3 + 1] = shade * (1 - burn * 0.35);
      col[i * 3 + 2] = shade * (1 - burn * 0.6);
    }
    land.setAttribute('color', new THREE.BufferAttribute(col, 3));
    land.computeVertexNormals();
  }
  const ash = stoneTextures(renderer, { seed: 23, joint: 0.26, repeat: [40, 30], dark: [36, 27, 24], light: [124, 98, 85], relief: 2.6 });
  const ground = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ map: ash.map, normalMap: ash.normalMap, roughness: 1, vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
  const lava = lavaMaterial({ scale: 0.16, heat: 0.8, spot: [DOOM.x, DOOM.z], reach: 0.0006 });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(250, 190).rotateX(-Math.PI / 2), lava);
  under.position.set(10, -1.35, -52);
  scene.add(under);

  // the Ephel Dúath and the Ered Lithui: the walls of Mordor, far off
  const ranges = new THREE.Group();
  for (const [radius, tall, seed, shade] of [
    [200, 46, 3, 0x1a0b07],
    [300, 70, 8, 0x140805],
  ]) {
    const n = makeNoise(seed);
    const g = new THREE.CylinderGeometry(radius, radius, 1, 160, 1, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 0) {
        p.setY(i, -6);
        continue;
      }
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const peak = fbm(n, Math.cos(a) * 5 + 9, Math.sin(a) * 5, { octaves: 4 });
      const jag = fbm(n, Math.cos(a) * 26, Math.sin(a) * 26 + 4, { octaves: 2 });
      p.setY(i, 8 + tall * (0.25 + 0.55 * peak + 0.35 * jag));
    }
    ranges.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: shade, side: THREE.BackSide })));
  }
  ranges.position.set(10, 0, -30);
  scene.add(ranges);

  // ── Mount Doom, and the door in its side ──
  scene.add(doom(renderer));
  const crater = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: hot(0xff7a22, 3.5), fog: false }));
  crater.position.set(DOOM.x, DOOM.h - 3.2, DOOM.z);
  scene.add(crater);
  const rockTex = stoneTextures(renderer, { seed: 61, joint: 0.25, repeat: [2, 2], dark: [28, 21, 19], light: [104, 84, 74], relief: 3 });
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTex.map, normalMap: rockTex.normalMap, roughness: 1, flatShading: true });
  const stone = (geo, x, y, z, sx, sy, sz, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, rockMat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(0, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // the Sammath Naur: two leaning stones and a lintel, in a spur of the mountain
  const DOOR = { x: END + 1.6, z: LANE.hobbits - 0.2 };
  const post = new THREE.CylinderGeometry(0.55, 0.8, 1, 6);
  const lump = new THREE.DodecahedronGeometry(1, 1);
  stone(post, DOOR.x, 1.9, DOOR.z - 1.55, 1, 4.2, 1, 0.3, 0.09);
  stone(post, DOOR.x, 1.9, DOOR.z + 1.55, 1, 4.2, 1, -0.2, -0.07);
  stone(post, DOOR.x, 4.2, DOOR.z, 0.95, 4.8, 0.95, 0, Math.PI / 2 + 0.05).rotation.x = Math.PI / 2;
  const heap = rng(15);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const out = 2.2 + heap() * 4.5;
    const big = 1.6 + heap() * 2.6;
    stone(lump, DOOR.x + 1 + heap() * 6, heap() * 3.4, DOOR.z + side * out, big, big * (0.8 + heap() * 0.7), big, heap() * 6, heap() - 0.5);
  }
  for (let i = 0; i < 6; i++) stone(lump, DOOR.x + 2.4 + heap() * 4, 4.6 + heap() * 3, DOOR.z + (heap() - 0.5) * 4, 2.6, 2.2, 2.8, heap() * 6, heap() - 0.5);
  const fireMat = new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 2.4), fog: false });
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.4).rotateY(-Math.PI / 2), fireMat);
  doorway.position.set(DOOR.x + 0.55, 1.7, DOOR.z);
  scene.add(doorway);
  const doorLight = new THREE.PointLight(0xff6a22, 60, 26, 2);
  doorLight.position.set(DOOR.x - 1.2, 2, DOOR.z);
  scene.add(doorLight);

  // ── Barad-dûr, the Eye, and its light ──
  const dark = tower();
  const barad = new THREE.Mesh(dark.geometry, new THREE.MeshStandardMaterial({ color: 0x0c0706, roughness: 0.9, flatShading: true }));
  barad.position.set(TOWER.x, 0, TOWER.z);
  barad.scale.setScalar(TOWER.scale);
  barad.rotation.y = -0.5;
  scene.add(barad);
  const EYE = new THREE.Vector3(TOWER.x, (dark.top + 6.5) * TOWER.scale, TOWER.z);
  const eyeMat = eyeMaterial();
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), eyeMat);
  eye.position.copy(EYE);
  eye.renderOrder = 5;
  scene.add(eye);

  // the beam: a cone of lit dust from the Eye to the road, and a real light down it
  const beamMat = beamMaterial();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.1, 1, 28, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), beamMat);
  beam.position.copy(EYE);
  beam.frustumCulled = false;
  beam.renderOrder = 4;
  scene.add(beam);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    poolMaterial(beamMat.uniforms),
  );
  const reach = (WALK.beamHalf / 10) * 1.12;
  pool.scale.set(reach * 1.7, 1, reach);
  pool.position.y = 0.12;
  pool.renderOrder = 3;
  scene.add(pool);
  const spot = new THREE.SpotLight(0xffb060, 3.5, 0, 0.05, 0.5, 0);
  spot.position.copy(EYE);
  scene.add(spot, spot.target);

  // ── rocks: scans where they load, blocks where they don't ──
  const models = createModels();
  const rand = rng(4);
  const spots = [];
  while (spots.length < 130) {
    const x = -46 + rand() * 96;
    const z = rand() < 0.2 ? 3.4 + rand() * 6 : -3.6 - rand() * 46;
    if (Math.hypot(x - DOOM.x, z - DOOM.z) < DOOM.r * 0.86 || height(x, z) < -0.5) continue;
    spots.push([x, z, z > 0 ? 0.35 + rand() * 0.5 : 0.5 + rand() * rand() * 3.4, rand() * 6.28]);
  }
  let alive = true;
  Promise.all([models.load('boulder'), models.load('rock'), models.load('boulders')]).then((found) => {
    const kinds = found.filter(Boolean);
    if (!alive || !kinds.length) return;
    const each = Math.ceil(spots.length / kinds.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const size = new THREE.Vector3();
    kinds.forEach((model, j) => {
      for (const part of model.parts) part.material.color?.multiplyScalar(0.55);
      const inst = models.instanced(model, each, { shadow: true, scale: 1 / Math.max(model.size.x, model.size.y, model.size.z) });
      for (let i = 0; i < each; i++) {
        const s = spots[j * each + i];
        if (!s) {
          inst.setMatrixAt(i, m.makeScale(0, 0, 0));
          continue;
        }
        inst.setMatrixAt(i, m.compose(pos.set(s[0], height(s[0], s[1]) - 0.12 * s[2], s[1]), q.setFromAxisAngle(up, s[3]), size.setScalar(s[2] * 1.6)));
      }
      inst.commit();
      inst.addTo(scene);
    });
  });

  // ── Frodo and Sam, and the orcs ──
  const frodo = makeHobbit({ cloak: 0x4b5a3a });
  const sam = makeHobbit({ cloak: 0x5a6a44, pack: true });
  const ringMat = new THREE.MeshBasicMaterial({ color: hot(0xffc84a, 0) });
  const ringGlow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), ringMat);
  ringGlow.position.set(0.14, 0.62, 0);
  frodo.body.add(ringGlow);
  // the Phial of Galadriel: lit while they walk, covered when they hide
  const phialMat = new THREE.MeshBasicMaterial({ color: hot(0xdfeaff, 0) });
  const phial = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), phialMat);
  phial.position.set(0.2, 0.5, 0.12);
  frodo.body.add(phial);
  const phialLight = new THREE.PointLight(0xcfe0ff, 0, 7, 2);
  phialLight.position.set(0.3, 0.7, 0.3);
  frodo.group.add(phialLight);
  scene.add(frodo.group, sam.group);
  // Frodo and Sam on the cast once their models are here (./cast3d.js): the
  // cloaked cones hidden (the Ring's glow and the Phial kept), and shown
  // again as the pair of rocks they make when they hide under the cloaks
  const cloaked = (h) => h.body.children.filter((o) => o.isMesh && o !== ringGlow && o !== phial);
  upgrade(frodo, 'frodo', { role: 'lead', hide: cloaked(frodo), top: 1.0, seed: 1 });
  upgrade(sam, 'sam', { role: 'lead', hide: cloaked(sam), top: 0.98, seed: 2 });
  const green = [new THREE.Color(0x4b5a3a), new THREE.Color(0x5a6a44)];
  const grey = new THREE.Color(0x3b2e29);

  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.7 });
  const hide = new THREE.MeshStandardMaterial({ color: 0x241a15, roughness: 1 });
  const torchMat = new THREE.MeshBasicMaterial({ color: hot(0xffa23a, 3) });
  const patrols = Array.from({ length: 3 }, () => {
    const g = new THREE.Group();
    const orcs = [0, 0.95, 1.9, 2.85].map((dx, i) => {
      const o = makeOrc(iron, hide);
      o.group.position.set(dx, 0, (i % 2 ? 0.22 : -0.22) + LANE.orcs);
      g.add(o.group);
      return o;
    });
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), torchMat);
    torch.position.set(-0.55, 1.85, LANE.orcs + 0.3);
    g.add(torch);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), hide);
    stick.position.set(-0.5, 1.4, LANE.orcs + 0.3);
    g.add(stick);
    const light = new THREE.PointLight(0xff8a3a, 0, 16, 2);
    light.position.copy(torch.position);
    g.add(light);
    g.visible = false;
    scene.add(g);
    return { g, orcs, torch, light };
  });

  // ── fire, smoke, ash ──
  const fire = createParticles(260, { ramp: FIRE, stretch: 1.4, gravity: 2.2, drag: 0.8, swirl: 1.2 });
  const smoke = createParticles(200, { ramp: SMOKE, additive: false, gravity: 0.3, drag: 0.1, swirl: 0.5 });
  const embers = createParticles(320, { ramp: EMBER, gravity: -1.2, drag: 0.12, swirl: 1.4 });
  const flakes = createParticles(260, { ramp: ASH, additive: false, gravity: -0.25, drag: 0.3, swirl: 0.9 });
  scene.add(smoke.mesh, flakes.mesh, fire.mesh, embers.mesh);

  // ── what is going on ──
  const S = { phase: 'ready', x: WALK.x0, spot: 265, burden: 0, patrols: [], carried: false, walking: false };
  // one shake, the site's (./feel.js), with Gorgoroth's own numbers: trauma² × 0.5, fading 1.6 a second
  const shake = createShake({ calm: reduced, offset: 0.5, decay: 1.6 });
  const A = { t: 0, hide: 1, sweep: 265, anger: 0, dim: 1, shake: 0, flash: 0, bolt: 5, door: 0, wide: 1, acc: { plume: 0, ash: 0, ember: 0, torch: 0 } };
  let cam = null;
  const v = new THREE.Vector3();
  const look = new THREE.Vector3();
  const red = new THREE.Color(2.4, 0.22, 0.05);
  const amber = new THREE.Color(1.5, 0.75, 0.3);

  const update = (n) => {
    if (n.phase !== S.phase) {
      if (n.phase === 'seen' || n.phase === 'ring') {
        A.anger = 1;
        A.shake = 0.6;
      } else if (n.phase === 'caught') A.shake = 0.5;
      else if (n.phase === 'there') A.door = 1;
      else if (n.phase === 'walking') A.anger = 0;
    }
    Object.assign(S, n);
  };
  const fx = () => {};

  // the house look (lib/three/house), as in Middle-earth's towns: the house
  // tone mapper, the shade one colour from the ash sky's light, under the mountain's glow; its own fog kept
  const house = houseOn({ renderer, scene, sun: glow, hemi, look: { fog: false } });
  stage.tune([...houseGroups(house), ...shake.groups()]); // ?debug: the bloom, the look and the shake on one panel
  let houseFrames = 0;

  const render = (ms = 16) => {
    const dt = Math.min(0.05, ms / 1000);
    A.t += dt;
    const t = A.t;
    const ease = (cur, to, rate) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
    lava.uniforms.uTime.value = t;
    sky.material.uniforms.uTime.value = t;
    eyeMat.uniforms.uTime.value = t;
    beamMat.uniforms.uTime.value = t;

    const walking = S.phase === 'walking';
    const caughtOut = S.phase === 'seen' || S.phase === 'ring';
    const hx = X(S.x);

    // ── the Eye's light: where the rules put it, on them once they are seen,
    // and wandering by itself before the walk begins ──
    const there = S.phase === 'there';
    const want = caughtOut ? S.x : walking ? S.spot : there ? -160 : 265 + Math.sin(t * 0.45) * 215;
    A.sweep = walking ? want : ease(A.sweep, want, 5);
    const sx = X(A.sweep);
    look.set(sx, 0, 0.2);
    beam.lookAt(look);
    const far = EYE.distanceTo(look);
    beam.scale.set(reach * 1.25, reach * 1.25, far);
    pool.position.x = sx;
    pool.position.z = 0.2;
    spot.target.position.copy(look);
    spot.angle = Math.atan((reach * 1.15) / far);
    A.anger = caughtOut ? 1 : ease(A.anger, 0, 2);
    const closeBy = walking ? 1 - smooth(WALK.beamHalf, WALK.warn, Math.abs(S.spot - S.x)) : 0;
    beamMat.uniforms.uColor.value.copy(amber).lerp(red, A.anger);
    A.dim = ease(A.dim, there ? 0.25 : 1, 2);
    beamMat.uniforms.uPower.value = (1 + closeBy * 0.5 + A.anger * 0.8 + Math.sin(t * 13) * 0.04) * A.dim;
    spot.color.setRGB(1, 0.69 - 0.5 * A.anger, 0.38 - 0.3 * A.anger);
    spot.intensity = (3.5 + A.anger * 6) * A.dim;
    eye.quaternion.copy(camera.quaternion);
    eyeMat.uniforms.uLook.value = THREE.MathUtils.clamp(sx / 60, -0.35, 0.35);
    eyeMat.uniforms.uAnger.value = A.anger;

    // ── Frodo and Sam ──
    A.hide = ease(A.hide, walking && S.walking ? 0 : S.phase === 'there' ? 0 : 1, 9);
    const stepT = t * 9;
    const bob = (1 - A.hide) * Math.abs(Math.sin(stepT)) * 0.05;
    const crouch = 1 - 0.36 * A.hide * (S.phase === 'ready' ? 0.4 : 1);
    const weight = S.carried ? 0 : S.burden;
    if (S.carried) {
      sam.group.position.set(hx, bob, LANE.hobbits);
      frodo.group.position.set(hx - 0.2, 0.42 * crouch + bob, LANE.hobbits);
      frodo.group.rotation.z = -0.75;
      sam.body.rotation.z = -0.3;
    } else {
      frodo.group.position.set(hx + 0.45, bob, LANE.hobbits - 0.15);
      sam.group.position.set(hx - 0.45, Math.abs(Math.cos(stepT)) * 0.05 * (1 - A.hide), LANE.hobbits + 0.2);
      frodo.group.rotation.z = 0;
      sam.body.rotation.z = -0.06 * (1 - A.hide);
    }
    frodo.body.rotation.z = -0.08 * (1 - A.hide) - weight * 0.32;
    frodo.group.scale.set(1, crouch * (S.carried ? 0.9 : 1), 1);
    sam.group.scale.set(1, S.carried ? 1 : crouch, 1);
    // on the cast: crouching by the knees, not squashed; under the cloaks
    // the rocks they were; Frodo bowed by the Ring's weight, carried on
    // Sam's back at the last
    for (const h of [frodo, sam]) {
      if (!h.cast?.ready) continue;
      const rock = A.hide > 0.6 && !S.carried;
      h.cast.showToy(rock);
      if (!rock) h.group.scale.set(1, 1, 1);
    }
    if (frodo.cast?.ready && S.carried) frodo.group.rotation.z = -0.3;
    // (the cast's own steps rise and fall: not bobbed again on top)
    if (frodo.cast?.ready && !S.carried) frodo.group.position.y = 0;
    if (sam.cast?.ready) sam.group.position.y = 0;
    castDo(frodo, { crouch: A.hide > 0.05 && !S.carried, base: S.carried ? 'sit' : null, upper: !S.carried && weight > 0.5 ? 'walk.injured' : null });
    castDo(sam, { crouch: A.hide > 0.05 && !S.carried, upper: S.carried ? 'walk.carry' : null });
    // under the cloaks they are another pair of rocks
    frodo.cloth.color.copy(green[0]).lerp(grey, A.hide * 0.85);
    sam.cloth.color.copy(green[1]).lerp(grey, A.hide * 0.85);
    ringMat.color.copy(hot(0xffc84a, weight * weight * 5 * (0.8 + 0.2 * Math.sin(t * 6))));
    ringGlow.scale.setScalar(0.6 + weight * 1.6);
    const lit = (1 - A.hide) * (S.phase === 'there' ? 0.4 : 1);
    phialMat.color.copy(hot(0xdfeaff, lit * 3.5));
    phialLight.intensity = lit * (7 + Math.sin(t * 5) * 0.6);

    // ── the orcs ──
    patrols.forEach((p, i) => {
      const px = S.patrols[i];
      p.g.visible = px != null;
      if (px == null) {
        p.light.intensity = 0;
        return;
      }
      p.g.position.x = X(px);
      p.orcs.forEach((o, j) => {
        const ph = t * 7 + j * 1.7;
        o.legs[0].rotation.z = Math.sin(ph) * 0.6;
        o.legs[1].rotation.z = -Math.sin(ph) * 0.6;
        o.body.position.y = Math.abs(Math.cos(ph)) * 0.05;
        o.body.rotation.x = Math.sin(ph) * 0.05;
      });
      p.light.intensity = 26 + Math.sin(t * 17 + i) * 5 + Math.sin(t * 31) * 3;
      A.acc.torch += 20 * k * dt;
      while (A.acc.torch >= 1) {
        A.acc.torch -= 1;
        p.torch.getWorldPosition(v);
        fire.emit(v.x + R(0.05), v.y + 0.05, v.z + R(0.05), 0.5 + R(0.2), 0.8 + Math.random() * 0.7, R(0.2), 0.3 + Math.random() * 0.25, 0.42, 0.08, 0.6);
      }
    });

    // ── Mount Doom: the plume, the sparks, and the door at the road's end ──
    A.acc.plume += 9 * k * dt;
    while (A.acc.plume >= 1) {
      A.acc.plume -= 1;
      smoke.emit(DOOM.x + R(2), DOOM.h - 2.5, DOOM.z + R(2), -1.6 + R(0.6), 3.4 + Math.random() * 1.6, -0.5 + R(0.6), 9 + Math.random() * 5, 7, 26);
      fire.emit(DOOM.x + R(1.8), DOOM.h - 3, DOOM.z + R(1.8), R(1), 3 + Math.random() * 3, R(1), 0.9 + Math.random() * 0.8, 4.5, 1.2, 0.8);
    }
    A.acc.ember += 16 * k * dt;
    while (A.acc.ember >= 1) {
      A.acc.ember -= 1;
      embers.emit(DOOM.x + R(2), DOOM.h - 2, DOOM.z + R(2), R(5), 7 + Math.random() * 8, R(5), 2.5 + Math.random() * 2.5, 0.3 + Math.random() * 0.3, 0.06);
    }
    A.acc.ash += 34 * k * dt;
    while (A.acc.ash >= 1) {
      A.acc.ash -= 1;
      flakes.emit(hx + R(18), 6 + Math.random() * 6, R(11), -0.8 + R(0.4), -0.6 - Math.random() * 0.5, R(0.4), 5 + Math.random() * 4, 0.05 + Math.random() * 0.06);
    }
    A.door = Math.max(0, A.door - dt * 0.5);
    const breathe = 2.2 + Math.sin(t * 2.1) * 0.35 + A.door * 4;
    fireMat.color.copy(hot(0xff6a1a, breathe));
    doorLight.intensity = 50 + Math.sin(t * 2.1) * 10 + A.door * 260;
    crater.material.color.copy(hot(0xff7a22, 3.2 + Math.sin(t * 1.3) * 0.5));
    fire.step(dt);
    smoke.step(dt);
    embers.step(dt);
    flakes.step(dt);

    // ── lightning over the mountain, now and then ──
    A.bolt -= dt;
    if (A.bolt <= 0) {
      A.bolt = 6 + Math.random() * 9;
      if (!reduced) A.flash = 1;
    }
    A.flash = Math.max(0, A.flash - dt * 3.2);
    const flick = A.flash > 0 ? A.flash * (0.6 + 0.4 * Math.sin(t * 70)) : 0;
    sky.material.uniforms.uFlash.value = flick;
    hemi.intensity = 0.85 + flick * 1.6;

    // ── the camera: behind them and to one side, the road running on to the mountain ──
    A.wide = ease(A.wide, S.phase === 'ready' ? 1 : 0, 1.2);
    const narrow = Math.max(0, 1.5 - camera.aspect) * 9;
    const wantX = hx - 6.5 - A.wide * 7 - narrow * 0.6;
    if (!cam) cam = { x: wantX };
    cam.x = ease(cam.x, wantX, 3);
    const cz = 8.5 + A.wide * 9 + narrow;
    const cy = Math.max(3.8 + A.wide * 3.2 + narrow * 0.35, height(cam.x, cz) + 2);
    camera.position.set(cam.x, cy, cz);
    if (!reduced) {
      camera.position.x += Math.sin(t * 0.21) * 0.3;
      camera.position.y += Math.sin(t * 0.29) * 0.15;
    }
    shake.update(dt, camera, A.shake);
    A.shake = 0;
    camera.lookAt(cam.x + 13 + A.wide * 6, 2.2 + A.wide * 5.2, -2.2);
    glow.target.position.set(cam.x + 12, 0, 0);
    glow.position.set(cam.x + 12 + 30, 22, -16);

    // (what's come in since, taken on now and then)
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    // the hobbits on the cast (./cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    stage.render(ms);
  };

  return {
    update,
    fx,
    render,
    resize: stage.resize,
    dispose() {
      shake.dispose();
      alive = false;
      models.dispose();
      releaseCast(scene);
      stage.dispose();
    },
    stage,
    get lost() {
      return stage.lost;
    },
  };
}
