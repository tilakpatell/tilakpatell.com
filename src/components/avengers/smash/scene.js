// Smash Run in 3D: an avenue in Midtown at sunset, the portal open over Stark
// Tower, seen from behind Hulk as he charges down it. Hulk stays at z = 0 and
// the city comes at him: a course position `at` is drawn at z = d - at. It
// draws the rules' state (./rules.js) and turns their events into smashes,
// flying cars, dust and fire; the HUD is drawn by the page on top.

import * as THREE from 'three';
import { createStage, hot } from '../hq/stage';
import { loadModel, pbr, preload } from '../hq/assets';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { instanced } from '../hq/kit/instanced';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { buildChariot, buildPortal } from '../lawn/models';
import { CHARIOT, KINDS, LANE, RUN } from './rules';
import { aim, fitted, loadMeshy, meshyFigure, meshyParts } from './meshy';
import { createChitauri, flail } from './chitauri';
import { CAR_COLOURS, CAR_KINDS, STREET, blockMaterials, buildBlock, lampGeometries, buildStarkTower, carGeometries, carMaterials, craterMaps, craterRim, facadeAtlas, laneWarning, roadMarkings, wallField, wallGeometries } from './models';

const FOV = 56;
const SOLDIERS = 16;
const GREEN = 0x63ff6a;
const VIOLET = 0xa070ff;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => k * k * (3 - 2 * k);
const approach = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
// a steady random number for an id
const hash = (n, k = 0) => {
  const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Float copies of a geometry's attributes: compressed models store positions
// as normalised integers, which can't hold a transform baked into them.
function floatGeometry(src) {
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(src.index.clone());
  for (const [name, a] of Object.entries(src.attributes)) {
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}

// A GLB's meshes as parts for an instanced pool (each part's own transform
// baked in): { geos, mats }.
async function modelParts(name, scale = 1) {
  const src = await loadModel(name);
  src.updateMatrixWorld(true);
  const geos = {};
  const mats = {};
  let i = 0;
  const s = new THREE.Matrix4().makeScale(scale, scale, scale);
  src.traverse((o) => {
    if (!o.isMesh) return;
    const k = `p${i++}`;
    geos[k] = floatGeometry(o.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(s, o.matrixWorld));
    mats[k] = o.material;
  });
  return { geos, mats, empty: i === 0 };
}

export async function create(rt, { onSlow, meshy } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.0, fov: FOV, near: 0.1, far: 1600, bloom: { strength: 0.6, radius: 0.5, threshold: 0.92 }, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  const FAR = small ? 260 : 400; // how far ahead the city is built
  // blocks per side, reused down the avenue: more than are ever in view at once
  const VARIANTS = small ? 6 : 8;

  // the Meshy models, where they've been made (./meshy.js); the rest is built here
  const M = await loadMeshy({ manifest: meshy });
  const sets = ['asphalt', 'sidewalk', 'brick', 'concrete-wall', 'concrete-worn', 'painted-metal', 'planks', 'leather', 'carbon'];
  await preload({ sets, skies: ['midtown'], models: ['lamp', 'barrier'], small });

  // sunset behind him and to the right: his back and the fronts of what's
  // coming are lit, and the shadows run ahead; the sky's fire is over the
  // tower in front
  await engine.setSky('midtown', { rotate: Math.PI * 0.92, bgIntensity: 0.95, envIntensity: 0.85, sunDir: [0.5, 0.42, 0.75], sunIntensity: 2.6, sunColor: [1, 0.74, 0.5], fill: 0.22, fog: { density: small ? 0.0028 : 0.002, color: 0x7a666e } });
  engine.setShadowBox(new THREE.Vector3(0, 0, -12), 24, 90);

  // ── the avenue ──
  const asphalt = await pbr('asphalt', { repeat: [55, 175], small, roughness: 0.92, metalness: 0, color: 0x8e8c8a });
  const ROAD_L = 700;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(220, ROAD_L).rotateX(-Math.PI / 2), asphalt);
  road.position.z = 40 - ROAD_L / 2;
  road.receiveShadow = true;
  scene.add(road);
  const scrollTex = [asphalt.map, asphalt.normalMap, asphalt.aoMap].filter(Boolean);
  // the paint: u across the road, v in metres along it over a block
  const markings = roadMarkings({ small });
  markings.wrapT = THREE.RepeatWrapping;
  const decoGeo = new THREE.PlaneGeometry(STREET.half * 2, ROAD_L, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, 40 - ROAD_L / 2);
  {
    const p = decoGeo.attributes.position;
    const uv = decoGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + STREET.half) / (STREET.half * 2), -p.getZ(i) / STREET.block);
  }
  const deco = new THREE.Mesh(decoGeo, new THREE.MeshStandardMaterial({ map: markings, transparent: true, roughness: 0.8, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  deco.position.y = 0.012;
  deco.receiveShadow = true;
  scene.add(deco);

  // the blocks: built once, each placed wherever its turn comes round
  const atlas = facadeAtlas({ size: small ? 512 : 1024 });
  const bmats = await blockMaterials({ small, atlas });
  const left = Array.from({ length: VARIANTS }, (_, i) => buildBlock(101 + i * 7, bmats, { size: atlas.size, lite: small }));
  const right = Array.from({ length: VARIANTS }, (_, i) => buildBlock(503 + i * 11, bmats, { size: atlas.size, lite: small }));
  for (const b of right) b.rotation.y = Math.PI;
  for (const b of [...left, ...right]) {
    b.name = 'block';
    b.visible = false;
    scene.add(b);
  }
  // block j starts at course position 80 j - 40
  const blockStart = (j) => j * STREET.block - 40;

  // street lamps along both kerbs, every 30 m: the scanned one, or on a phone a plain one
  const lampParts = small ? { geos: lampGeometries(), mats: { iron: bmats.iron } } : await modelParts('lamp', 2);
  const lamps = lampParts.empty ? null : instanced(lampParts.geos, lampParts.mats, 40, { shadows: false });
  if (lamps) {
    lamps.group.name = 'lamps';
    scene.add(lamps.group);
  }
  const bulbMat = new THREE.MeshBasicMaterial({ color: hot(0xffd9a0, 2.4), toneMapped: false });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 8), bulbMat, 40);
  bulbs.frustumCulled = false;
  scene.add(bulbs);

  // ── the background: Stark Tower, the portal, chariots round it, haze ──
  const back = new THREE.Group();
  back.name = 'background';
  scene.add(back);
  // at the end of the avenue, where the street's slot of sky is
  const PORTAL_Y = 300;
  const stark = buildStarkTower({ beamLength: PORTAL_Y - 262 });
  stark.group.position.set(6, -6, -900);
  stark.group.rotation.y = -0.35;
  stark.group.traverse((o) => {
    if (o.material) o.material.fog = false;
  });
  back.add(stark.group);
  const portal = buildPortal(105);
  stark.group.updateMatrixWorld(true);
  const beamTop = stark.group.localToWorld(stark.top.clone());
  const portalAt = new THREE.Vector3(beamTop.x, PORTAL_Y, beamTop.z - 25);
  portal.mesh.position.copy(portalAt);
  back.add(portal.mesh);
  const skyMats = { armour: new THREE.MeshStandardMaterial({ color: 0x4d4237, metalness: 0.75, roughness: 0.42 }), dark: new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.7, roughness: 0.45 }), glow: new THREE.MeshBasicMaterial({ color: hot(0x6fd8ff, 2.6), toneMapped: false }) };
  const chariotModel = (mats) => (M.chariot ? fitted(M.chariot, { h: 3.6, along: 'z' }) : buildChariot(mats));
  const circling = Array.from({ length: small ? 1 : 4 }, (_, i) => {
    const c = chariotModel(skyMats);
    c.scale.setScalar(3.2);
    back.add(c);
    return { c, a: (i / 4) * Math.PI * 2, r: 90 + i * 26, y: 170 + (i % 3) * 40, sp: 0.18 + (i % 2) * 0.07 };
  });
  // haze down the far end of the avenue, so it never just stops
  const hazeColor = 0x7a666e;
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uColor: { value: new THREE.Color(hazeColor) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; varying vec2 vUv; void main() { float a = (1.0 - smoothstep(0.05, 0.7, vUv.y)) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x); gl_FragColor = vec4(uColor, a * 0.92); }`,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(320, 160), hazeMat);
  haze.position.set(0, 70, -FAR - 30);
  haze.renderOrder = -1;
  back.add(haze);

  // ── Hulk ──
  const hulkMats = {
    skin: await pbr('leather', { repeat: [4, 4], small, roughness: 0.6, metalness: 0, color: 0x6f9e44, normalScale: 0.45 }),
    pants: await pbr('carbon', { repeat: [3, 3], small, roughness: 0.85, metalness: 0, color: 0x5a2f80 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a0f0c, roughness: 0.6 }),
  };
  // the textures' own colour would darken him: keep their relief only
  hulkMats.skin.map = null;
  hulkMats.pants.map = null;
  const skinBase = hulkMats.skin.color.clone();
  const HURT = new THREE.Color(0xff3020);
  hulkMats.skin.emissive = new THREE.Color(GREEN);
  hulkMats.skin.emissiveIntensity = 0;
  const hulk = buildHumanoid({ style: 'hulk', materials: hulkMats, scale: 1.35 });
  hulk.root.rotation.y = Math.PI; // he runs toward -z
  // Meshy's Hulk, if he's been made: his own run, with the rest laid over it
  const mh = M.hulk ? meshyFigure(M.hulk, { h: 2.6 }) : null;
  (mh ? mh.root : hulk.root).name = 'hulk';
  scene.add(mh ? mh.root : hulk.root);
  const mhBase = mh?.materials.map((m) => m.color?.clone() ?? new THREE.Color(1, 1, 1));
  if (mh)
    for (const m of mh.materials) {
      if (!m.emissive) continue;
      m.emissive.set(GREEN);
      m.emissiveIntensity = 0;
    }

  // ── what's in his way ──
  const chitMats = {
    armour: new THREE.MeshStandardMaterial({ color: 0x4d4237, metalness: 0.75, roughness: 0.42 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 0.75, metalness: 0.05 }),
    glow: new THREE.MeshBasicMaterial({ color: hot(0x6fd8ff, 2.2), toneMapped: false }),
  };
  const soldiers = Array.from({ length: SOLDIERS }, (_, i) => {
    const h = M.chitauri ? meshyFigure(M.chitauri, { h: 1.95 }) : buildHumanoid({ style: 'chitauri', materials: chitMats, scale: 1 });
    if (h.meshy) h.phase(i * 0.37);
    h.root.visible = false;
    h.root.name = 'soldier';
    if (small) h.root.traverse((o) => (o.castShadow = false));
    h.id = null;
    scene.add(h.root);
    return h;
  });
  const carMats = carMaterials();
  const cars = Object.fromEntries(
    CAR_KINDS.map((k) => {
      const parts = M[k] ? meshyParts(M[k], { h: 4.6, along: 'z' }) : null;
      // on a phone the cars cast no shadows: half their cost
      return [k, parts ? instanced(parts.geos, parts.mats, 14, { shadows: !small }) : instanced(carGeometries(k), carMats, 14, { shadows: !small })];
    }),
  );
  for (const [k, p] of Object.entries(cars)) {
    p.group.name = `cars-${k}`;
    scene.add(p.group);
  }
  const barrierParts = await modelParts('barrier');
  const barriers = barrierParts.empty ? null : instanced(barrierParts.geos, barrierParts.mats, 36);
  if (barriers) {
    barriers.group.name = 'barriers';
    scene.add(barriers.group);
  }
  const wallMats = { armour: chitMats.armour, dark: skyMats.dark, glow: new THREE.MeshBasicMaterial({ color: hot(VIOLET, 3), toneMapped: false }) };
  // Meshy's pylon, two to a wall, or the built pair
  const pylon = M.pylon ? meshyParts(M.pylon, { h: 4.4 }) : null;
  const walls = pylon ? instanced(pylon.geos, pylon.mats, 12) : instanced(wallGeometries(KINDS.barrier.w), wallMats, 6);
  walls.group.name = 'walls';
  scene.add(walls.group);
  const field = wallField(KINDS.barrier.w, 3.9);
  const fields = new THREE.InstancedMesh(field.geo, field.mat, 6);
  fields.frustumCulled = false;
  fields.renderOrder = 4;
  scene.add(fields);
  // craters: a scorched decal, slabs tipped up round it, embers
  const cm = craterMaps({ seed: 5 });
  const cmWide = craterMaps({ w: 1024, h: 384, seed: 8 });
  const craterMat = (m) => new THREE.MeshStandardMaterial({ map: m.map, emissiveMap: m.emissiveMap, emissive: 0xff7030, emissiveIntensity: 2.2, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const craterGeo = new THREE.PlaneGeometry(KINDS.crater.w * 1.45, KINDS.crater.len * 1.45).rotateX(-Math.PI / 2);
  const craterWideGeo = new THREE.PlaneGeometry(LANE * 3 * 1.2, KINDS.crater.len * 1.45).rotateX(-Math.PI / 2);
  const craters = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(i < 4 ? craterGeo : craterWideGeo, craterMat(i < 4 ? cm : cmWide));
    m.visible = false;
    m.receiveShadow = true;
    m.renderOrder = 1;
    scene.add(m);
    return { m, wide: i >= 4, used: false };
  });
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 0.8), asphalt, 120);
  slabs.castShadow = true;
  slabs.receiveShadow = true;
  slabs.frustumCulled = false;
  scene.add(slabs);
  const rims = new Map(); // crater id → its slabs
  // chariot runs: the lane warning, and the chariot itself coming down it
  const warnings = Array.from({ length: 3 }, () => {
    const w = laneWarning(LANE * 0.88, 110);
    w.mesh.visible = false;
    scene.add(w.mesh);
    return w;
  });
  const riders = Array.from({ length: 2 }, () => {
    const group = new THREE.Group();
    group.add(chariotModel({ armour: chitMats.armour, dark: skyMats.dark, glow: new THREE.MeshBasicMaterial({ color: hot(0x6fd8ff, 2.6), toneMapped: false }) }));
    const rider = buildHumanoid({ style: 'chitauri', materials: chitMats, scale: 0.95 });
    rider.root.position.set(0, 0.24, -0.5);
    group.add(rider.root);
    group.scale.setScalar(1.6);
    group.visible = false;
    scene.add(group);
    return { group, rider, id: null };
  });

  const vfx = createVfx(scene, { calm, ground: 0.02, maxSparks: 1400, maxPuffs: 320, debrisMaterial: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.2 }) });
  const feel = createFeel({ seed: 5, calm, baseFov: FOV, offset: 0.14 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'smash');

  // ── per frame ──
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const sc = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let clock = 0;
  let fov = FOV;
  let lastD = 0;
  let smashT = 9; // since a swing began
  let landT = 9;
  let roarT = 9;
  let hitT = 9;
  let lostT = 0;
  let leanX = 0;
  const camPos = new THREE.Vector3(0, 4.6, 7.4);
  const camLook = new THREE.Vector3(0, 1.8, -16);
  const flying = []; // smashed things in the air: { kind, at, x, y, vAt, vx, vy, rx, ry, rz, sx, sy, sz, t, life, … }
  const soldierFor = new Map(); // obstacle id → figure
  // the Chitauri's fire: one at a time on a phone, two otherwise
  const chit = createChitauri({ shooters: small ? 1 : 2 });
  const muzzle = new THREE.Vector3();
  const boltTo = new THREE.Vector3();
  // a bolt from the staff rifle's muzzle at him (most strike him and glance
  // off in sparks, the rest go past into the road)
  function fireBolt(h, g) {
    h.root.updateMatrixWorld(true);
    h.bones.handR.localToWorld(muzzle.set(0, -0.67 * h.scale, 0.03 * h.scale));
    const hit = Math.random() < 0.65;
    const hy = g.hulk.y ?? 0;
    if (hit) boltTo.set(g.hulk.x + (Math.random() - 0.5) * 1.2, hy + 1.3 + Math.random() * 1.5, 0.4);
    else boltTo.set(g.hulk.x + (Math.random() - 0.5) * 5, 0.05, -2 + Math.random() * 5);
    vfx.beam(muzzle, boltTo, { color: 0x6fd8ff, width: 0.07, life: 0.09 });
    vfx.sparks(boltTo, { count: hit ? 8 : 5, speed: 4, color: 0xdff0ff, to: 0x6fd8ff, life: 0.25, size: 0.07, gravity: 3 });
  }

  const tall = () => camera.aspect < 1.2;
  const zAt = (g, at) => g.d - at;

  // ── Hulk's body ──
  function poseHulk(g, dt) {
    const H = g.hulk;
    const b = hulk.bones;
    const S = hulk.scale;
    const running = g.phase === 'run';
    const lost = g.phase === 'lost';
    leanX = approach(leanX, clamp((H.lane * LANE - H.x) * 0.25, -0.5, 0.5), 10, dt);
    hulk.root.position.set(H.x, H.y, 0);
    hulk.root.rotation.set(0, Math.PI, 0);
    const pace = 1.1 + g.speed / 26;
    if (running) poseHumanoid(hulk, { t: clock, mode: 'run', speed: pace, lean: 0.5, flinch: H.hurt > RUN.invulnerable - 0.3 ? 1 : 0 });
    else poseHumanoid(hulk, { t: clock, mode: 'idle', speed: 1 });
    // heavy: hunched, the head low between the shoulders, fists swinging wide
    const s = Math.sin(clock * pace * 8);
    b.chest.rotation.x += 0.18;
    b.head.rotation.x -= 0.25;
    b.spine.rotation.z = leanX * 0.6;
    hulk.root.rotation.z = -leanX * 0.25;
    const swing = running ? 0.85 : 0.05;
    b.shoulderL.rotation.set(s * swing - 0.15, 0, 0.32);
    b.shoulderR.rotation.set(-s * swing - 0.15, 0, -0.32);
    b.elbowL.rotation.set(running ? -1.1 - Math.max(0, s) * 0.4 : -0.35, 0, 0);
    b.elbowR.rotation.set(running ? -1.1 - Math.max(0, -s) * 0.4 : -0.35, 0, 0);
    if (!running && !lost) {
      // waiting: breathing hard, shoulders rolling
      const br = Math.sin(clock * 1.8);
      b.chest.rotation.x += br * 0.04;
      b.shoulderL.rotation.z = 0.38 + br * 0.03;
      b.shoulderR.rotation.z = -0.38 - br * 0.03;
      b.hips.position.y = hulk.rest.hips.y - 0.05 * S;
      b.thighL.rotation.set(-0.15, 0, 0.12);
      b.thighR.rotation.set(-0.1, 0, -0.12);
      b.kneeL.rotation.x = 0.3;
      b.kneeR.rotation.x = 0.25;
    }

    // the smash: both fists overhead, then down like a hammer
    if (smashT < RUN.smashTime + 0.22) {
      const k = clamp(smashT / RUN.smashTime, 0, 1);
      const rec = smashT > RUN.smashTime ? 1 - (smashT - RUN.smashTime) / 0.22 : 1;
      const up = k < 0.2 ? ease(k / 0.2) : 1 - ease((k - 0.2) / 0.8);
      const sx = (-2.9 * up - 0.5 * (1 - up)) * rec;
      for (const [sh, el, sd] of [
        [b.shoulderL, b.elbowL, 1],
        [b.shoulderR, b.elbowR, -1],
      ]) {
        sh.rotation.x = sh.rotation.x * (1 - rec) + sx;
        sh.rotation.z = sh.rotation.z * (1 - rec) + sd * 0.12 * rec;
        el.rotation.x = el.rotation.x * (1 - rec) + -0.3 * up * rec;
      }
      b.spine.rotation.x += (k > 0.2 ? 0.55 * (1 - up) : -0.2 * up) * rec;
      b.chest.rotation.x += (k > 0.2 ? 0.25 * (1 - up) : -0.15) * rec;
      b.hips.position.y -= (k > 0.4 ? 0.12 : 0) * S * rec;
    }
    // the leap: crouch, tuck, reach
    if (H.air > 0 || landT < 0.3) {
      const k = H.air > 0 ? 1 - H.air / RUN.leapTime : 1;
      const tuck = H.air > 0 ? Math.sin(k * Math.PI) : 0;
      const land = landT < 0.3 ? 1 - landT / 0.3 : 0;
      b.thighL.rotation.x = -1.1 * tuck - 0.7 * land;
      b.thighR.rotation.x = -0.6 * tuck - 0.8 * land;
      b.kneeL.rotation.x = 1.7 * tuck + 1.2 * land;
      b.kneeR.rotation.x = 1.2 * tuck + 1.3 * land;
      b.hips.position.y = hulk.rest.hips.y - 0.25 * land * S;
      if (smashT > RUN.smashTime) {
        b.shoulderL.rotation.x = -1.6 * tuck - 0.4 * land;
        b.shoulderR.rotation.x = -1.6 * tuck - 0.4 * land;
        b.shoulderL.rotation.z = 0.5 * tuck + 0.6 * land;
        b.shoulderR.rotation.z = -0.5 * tuck - 0.6 * land;
      }
      b.spine.rotation.x += 0.35 * land;
    }
    // the roar when the rage comes
    if (roarT < 1.1) {
      const k = Math.sin(clamp(roarT / 1.1, 0, 1) * Math.PI);
      b.shoulderL.rotation.set(-0.3 * k + b.shoulderL.rotation.x * (1 - k), 0, 1.2 * k + b.shoulderL.rotation.z * (1 - k));
      b.shoulderR.rotation.set(-0.3 * k + b.shoulderR.rotation.x * (1 - k), 0, -1.2 * k + b.shoulderR.rotation.z * (1 - k));
      b.elbowL.rotation.x = -1.6 * k + b.elbowL.rotation.x * (1 - k);
      b.elbowR.rotation.x = -1.6 * k + b.elbowR.rotation.x * (1 - k);
      b.chest.rotation.x -= 0.35 * k;
      b.head.rotation.x -= 0.4 * k;
    }
    // down: on his knees, Banner coming back
    if (lost) {
      const k = ease(clamp(lostT / 0.9, 0, 1));
      b.hips.position.y = hulk.rest.hips.y - 0.55 * k * S;
      b.thighL.rotation.set(-0.3 * k, 0, 0.1);
      b.thighR.rotation.set(-1.2 * k, 0, -0.1);
      b.kneeL.rotation.x = 1.9 * k;
      b.kneeR.rotation.x = 1.5 * k;
      b.spine.rotation.x = 0.5 * k;
      b.chest.rotation.x = 0.3 * k;
      b.head.rotation.x = 0.3 * k;
      b.shoulderL.rotation.set(-0.2, 0, 0.2);
      b.shoulderR.rotation.set(-0.9 * k, 0, -0.2);
      b.elbowR.rotation.x = -0.5;
    }
    // the rage glows through his skin; a hit flashes red
    const rage = H.raging > 0 ? 0.35 + 0.25 * Math.sin(clock * 9) + (H.raging < 2 ? 0.2 * Math.sin(clock * 30) : 0) : 0;
    hulkMats.skin.emissiveIntensity = approach(hulkMats.skin.emissiveIntensity, rage, 8, dt);
    const hurt = hitT < 0.35 ? 1 - hitT / 0.35 : 0;
    hulkMats.skin.color.copy(skinBase).lerp(HURT, hurt * 0.6);
    // he blinks while he can't be hurt
    hulk.root.visible = !(H.hurt > 0 && H.hurt < RUN.invulnerable - 0.2 && Math.sin(clock * 40) > 0.6 && !calm);
  }

  // Meshy's Hulk: his run clip, with the smash, the leap and the roar laid
  // over it by pointing his limbs (world directions; he faces -z, his left
  // toward -x)
  const dirA = new THREE.Vector3();
  const dirB = new THREE.Vector3();
  function poseMeshyHulk(g, dt) {
    const H = g.hulk;
    const B = mh.bones;
    const running = g.phase === 'run';
    const lost = g.phase === 'lost';
    leanX = approach(leanX, clamp((H.lane * LANE - H.x) * 0.25, -0.5, 0.5), 10, dt);
    const land = landT < 0.3 ? 1 - landT / 0.3 : 0;
    const down = lost ? ease(clamp(lostT / 0.9, 0, 1)) : 0;
    mh.root.position.set(H.x, H.y - land * 0.25 - down * 0.7, 0);
    mh.root.rotation.set(-down * 0.5, Math.PI, -leanX * 0.25);
    mh.set(running ? 'run' : 'idle', 0.75 + g.speed / 32);
    mh.update(dt);
    const arms = [
      [B.LeftArm, B.LeftForeArm, B.LeftHand, -1],
      [B.RightArm, B.RightForeArm, B.RightHand, 1],
    ];
    if (smashT < RUN.smashTime + 0.22) {
      const k = clamp(smashT / RUN.smashTime, 0, 1);
      const rec = smashT > RUN.smashTime ? 1 - (smashT - RUN.smashTime) / 0.22 : 1;
      const up = k < 0.2 ? ease(k / 0.2) : 1 - ease((k - 0.2) / 0.8);
      for (const [arm, fore, hand, sd] of arms) {
        dirA.set(sd * 0.15, -0.35, -1).lerp(dirB.set(sd * 0.2, 1, 0.1), up);
        aim(arm, fore, dirA, rec);
        aim(fore, hand, dirA, rec);
      }
      aim(B.Spine01, B.neck, dirA.set(0, 1, -0.6 * (1 - up)), rec * 0.6);
    }
    if (H.air > 0) {
      const tuck = Math.sin((1 - H.air / RUN.leapTime) * Math.PI);
      for (const [thigh, shin, foot] of [
        [B.LeftUpLeg, B.LeftLeg, B.LeftFoot],
        [B.RightUpLeg, B.RightLeg, B.RightFoot],
      ]) {
        aim(thigh, shin, dirA.set(0, -0.3, -1), tuck);
        aim(shin, foot, dirA.set(0, -1, 0.6), tuck);
      }
      if (smashT > RUN.smashTime) for (const [arm, fore, , sd] of arms) aim(arm, fore, dirA.set(sd * 0.7, 0.6, -0.3), tuck * 0.8);
    }
    if (roarT < 1.1) {
      const k = Math.sin(clamp(roarT / 1.1, 0, 1) * Math.PI);
      for (const [arm, fore, hand, sd] of arms) {
        aim(arm, fore, dirA.set(sd, 0.2, 0), k);
        aim(fore, hand, dirA.set(sd * 0.25, 1, 0), k);
      }
      aim(B.neck, B.Head, dirA.set(0, 1, 0.5), k);
    }
    // the rage glows through his skin; a hit flashes red; he blinks after one
    // (a textured model glows less, or it turns to neon)
    const rage = H.raging > 0 ? 0.1 + 0.07 * Math.sin(clock * 9) : 0;
    const hurt = hitT < 0.35 ? 1 - hitT / 0.35 : 0;
    mh.materials.forEach((m, i) => {
      if (m.emissive) m.emissiveIntensity = approach(m.emissiveIntensity ?? 0, rage, 8, dt);
      m.color?.copy(mhBase[i]).lerp(HURT, hurt * 0.5);
    });
    mh.root.visible = !(H.hurt > 0 && H.hurt < RUN.invulnerable - 0.2 && Math.sin(clock * 40) > 0.6 && !calm);
  }

  // ── the city scrolling past ──
  function placeCity(g) {
    const d = g.d;
    for (const t of scrollTex) t.offset.y = d / 4;
    markings.offset.y = (d + 40) / STREET.block;
    for (const b of [...left, ...right]) b.visible = false;
    // from the block 40 m behind him to the last one in reach
    const j0 = Math.floor((d - 80) / STREET.block) + 1;
    const j1 = Math.floor((d + FAR + 40) / STREET.block);
    for (let j = j0; j <= j1; j++) {
      const z = zAt(g, blockStart(j));
      const L = left[((j % VARIANTS) + VARIANTS) % VARIANTS];
      L.visible = true;
      L.position.set(-STREET.half, 0, z);
      const R = right[(((j + 3) % VARIANTS) + VARIANTS) % VARIANTS];
      R.visible = true;
      R.position.set(STREET.half, 0, z - STREET.corner);
    }
    // lamps every 30 m, not in the cross streets
    if (lamps) lamps.begin();
    let nb = 0;
    const k0 = Math.floor((d - 30) / 30);
    for (let k = k0; k < k0 + Math.ceil((FAR * (small ? 0.7 : 1)) / 30) + 2 && nb < 40; k++) {
      const s = k * 30 + 15;
      const inBlock = (((s + 40) % 80) + 80) % 80;
      if (inBlock > STREET.corner - 2) continue;
      for (const sd of [-1, 1]) {
        if (nb >= 40) break;
        const x = sd * (STREET.half + 0.7);
        const z = zAt(g, s);
        m4.compose(v3.set(x, STREET.kerb, z), q.setFromEuler(e3.set(0, sd < 0 ? Math.PI / 2 : -Math.PI / 2, 0)), one);
        lamps?.set(m4);
        bulbs.setMatrixAt(nb, m4.makeTranslation(x - sd * 0.72, STREET.kerb + 7.36, z));
        nb++;
      }
    }
    lamps?.end();
    for (let i = nb; i < 40; i++) bulbs.setMatrixAt(i, zero);
    bulbs.instanceMatrix.needsUpdate = true;
  }

  // ── the obstacles ──
  const carLook = (id) => {
    const kind = CAR_KINDS[Math.floor(hash(id, 1) * CAR_KINDS.length)];
    const list = CAR_COLOURS[kind];
    const c = new THREE.Color(list[Math.floor(hash(id, 2) * list.length)]);
    if (hash(id, 3) < 0.35) c.multiplyScalar(0.55); // scorched
    return { kind, c };
  };
  const placeCar = (kind, c, x, y, z, rx, ry, rz) => {
    m4.compose(v3.set(x, y, z), q.setFromEuler(e3.set(rx, ry, rz, 'YXZ')), one);
    cars[kind].set(m4, { paint: c });
  };

  function placeObstacles(g, dt) {
    for (const p of Object.values(cars)) p.begin();
    barriers?.begin();
    walls.begin();
    let nf = 0;
    let ns = 0;
    const seen = new Set();
    for (const c of craters) c.used = false;
    for (const o of g.obstacles) {
      const ahead = o.at - g.d;
      if (ahead > FAR * 0.55 || ahead + o.len < -12) continue;
      const z = zAt(g, o.at) - o.len / 2;
      if (o.kind === 'crater') {
        // craters stay, broken or not
        const c = craters.find((k) => !k.used && k.wide === !!o.wide);
        if (!c) continue;
        c.used = true;
        c.m.visible = true;
        c.m.position.set(o.x, 0.02, z);
        if (!rims.has(o.id)) rims.set(o.id, craterRim(o.wide ? LANE * 1.6 : 1.55, 1.85, o.id, o.wide ? 22 : 14));
        for (const [x, rz, yaw, tilt, s] of rims.get(o.id)) {
          if (ns >= 120) break;
          m4.compose(v3.set(o.x + x, 0.06 + tilt * 0.12, z + rz), q.setFromEuler(e3.set(tilt * 0.8, yaw, 0, 'YXZ')), sc.set(s, s * 1.4, s));
          slabs.setMatrixAt(ns++, m4);
        }
        if (!calm && Math.random() < dt * 3 && ahead < 120) vfx.smoke(v3.set(o.x + (Math.random() - 0.5) * 2, 0.3, z), { size: 1.6, count: 1, life: 2.2, rise: 1.2, opacity: 0.35, color: 0x2a2624, to: 0x6a625e });
        continue;
      }
      if (o.broken) continue;
      if (o.kind === 'soldier') {
        let h = soldierFor.get(o.id);
        if (!h) {
          h = soldiers.find((s) => s.id == null && !s.flying);
          if (!h) continue;
          h.id = o.id;
          soldierFor.set(o.id, h);
        }
        seen.add(h);
        h.root.visible = true;
        // where the rules have it (it walks; it doesn't drift sideways on the spot)
        h.root.position.set(o.x, 0, z);
        h.root.rotation.set(0, 0, 0); // they face him (+z)
        if (h.meshy) {
          h.set('walk', 1.1);
          h.update(dt);
        } else {
          // its legs by the ground it covers, its rifle up as he comes, and
          // a couple of them at a time shooting (./chitauri.js)
          const firing = chit.claim(o, ahead, g.phase === 'run' && !o.passed);
          if (chit.pose(h, o, { dt, ahead, firing, walk: o.passed ? 0 : KINDS.soldier.walk, calm })) fireBolt(h, g);
        }
      } else if (o.kind === 'car') {
        const { kind, c } = carLook(o.id);
        const yaw = (hash(o.id, 4) - 0.5) * 0.5 + (hash(o.id, 5) < 0.5 ? Math.PI : 0);
        placeCar(kind, c, o.x, 0, z, 0, yaw, (hash(o.id, 6) - 0.5) * 0.08);
      } else if (o.kind === 'barricade' && barriers) {
        for (const sd of [-0.78, 0.78]) {
          m4.compose(v3.set(o.x + sd, 0, z), q.setFromEuler(e3.set(0, (hash(o.id, sd > 0 ? 7 : 8) - 0.5) * 0.25, 0)), one);
          barriers.set(m4);
        }
      } else if (o.kind === 'barrier') {
        if (pylon) {
          for (const sd of [-1, 1]) walls.set(m4.makeTranslation(o.x + sd * (KINDS.barrier.w / 2 + 0.12), 0, z));
        } else walls.set(m4.makeTranslation(o.x, 0, z));
        if (nf < 6) fields.setMatrixAt(nf++, m4.makeTranslation(o.x, 0, z));
      }
    }
    for (let i = ns; i < 120; i++) slabs.setMatrixAt(i, zero);
    slabs.instanceMatrix.needsUpdate = true;
    slabs.visible = ns > 0;
    for (const c of craters) if (!c.used) c.m.visible = false;
    fields.count = nf;
    fields.instanceMatrix.needsUpdate = true;
    // (a shooter gone from the road gives its turn up)
    chit.audit(dt, (id) => soldierFor.has(id));
    // soldiers no longer in the rules: back to the pool (unless flying)
    for (const h of soldiers) {
      if (h.id != null && !seen.has(h) && !h.flying) {
        soldierFor.delete(h.id);
        h.id = null;
        h.root.visible = false;
      }
    }

    // parked wrecks in the parking lanes, some burning
    for (let k = Math.floor((g.d - 20) / 23); k < Math.floor((g.d + FAR * 0.6) / 23); k++) {
      if (hash(k, 9) > 0.5) continue;
      const s = k * 23 + 7;
      const inBlock = (((s + 40) % 80) + 80) % 80;
      if (inBlock > STREET.corner - 5) continue;
      const sd = hash(k, 10) < 0.5 ? -1 : 1;
      const { kind, c } = carLook(k * 7 + 3);
      const z = zAt(g, s);
      const tipped = hash(k, 11) < 0.15;
      placeCar(kind, c, sd * 5.9, tipped ? 0.9 : 0, z, 0, (hash(k, 12) - 0.5) * 0.6 + (hash(k, 13) < 0.5 ? Math.PI : 0), tipped ? sd * 1.4 : 0);
      if (hash(k, 14) < 0.22 && !calm && Math.random() < dt * 6) vfx.fire(v3.set(sd * 5.9, 1.2, z), { size: 1.6, count: 1, life: 0.7, rise: 2.2 });
      if (hash(k, 14) < 0.22 && !calm && Math.random() < dt * 3) vfx.smoke(v3.set(sd * 5.9, 2.4, z), { size: 2.2, count: 1, life: 2.6, rise: 2.4, opacity: 0.5, color: 0x1e1c1c, to: 0x4a4646 });
    }

    // what's flying after a smash
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt;
      f.at += f.vAt * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy -= 22 * dt;
      f.rx += f.sx * dt;
      f.ry += f.sy * dt;
      f.rz += f.sz * dt;
      if (f.y < f.floor && f.vy < 0) {
        f.y = f.floor;
        f.vy *= -0.3;
        f.vAt *= 0.5;
        f.vx *= 0.5;
        f.sx *= 0.4;
        f.sz *= 0.4;
        if (!f.bounced && f.kind === 'car') vfx.explode(v3.set(f.x, 0.8, zAt(g, f.at)), { scale: 1.1 });
        f.bounced = true;
      }
      const z = zAt(g, f.at);
      if (f.t > f.life || z > 30) {
        if (f.fig) {
          f.fig.flying = false;
          f.fig.root.visible = false;
          if (f.fig.id != null) soldierFor.delete(f.fig.id);
          f.fig.id = null;
        }
        flying.splice(i, 1);
        continue;
      }
      if (f.kind === 'car') placeCar(f.car, f.c, f.x, f.y, z, f.rx, f.ry, f.rz);
      else if (f.kind === 'barricade' && barriers) {
        m4.compose(v3.set(f.x, f.y, z), q.setFromEuler(e3.set(f.rx, f.ry, f.rz)), one);
        barriers.set(m4);
      } else if (f.kind === 'soldier' && f.fig) {
        f.fig.root.visible = true;
        f.fig.root.position.set(f.x, f.y, z);
        f.fig.root.rotation.set(f.rx, f.ry, f.rz);
        // flung: flailing, then sprawled once it's hit the road
        if (!f.fig.meshy) flail(f.fig, f.t, Boolean(f.bounced));
      }
    }
    // an empty pool still draws one hidden copy: hide it instead
    for (const p of [...Object.values(cars), walls, barriers].filter(Boolean)) {
      p.end();
      p.group.visible = p.count > 0;
    }
    fields.visible = nf > 0;
  }

  // ── chariot runs ──
  function placeChariots(g) {
    let nw = 0;
    let nr = 0;
    for (const w of warnings) w.mesh.visible = false;
    for (const r of riders) r.group.visible = false;
    for (const c of g.chariots) {
      if (c.state !== 'warn' && c.state !== 'burn') continue;
      const x = c.lane * LANE;
      if (nw < warnings.length) {
        const w = warnings[nw++];
        w.mesh.visible = true;
        w.mesh.position.set(x, 0.03, 0);
        w.mat.uniforms.uTime.value = clock;
        w.mat.uniforms.uWarn.value = c.state === 'warn' ? clamp(c.t / CHARIOT.warn, 0, 1) : 1;
        w.mat.uniforms.uBurn.value = c.state === 'burn' ? Math.sin(clamp(c.t / CHARIOT.burn, 0, 1) * Math.PI * 0.5 + 0.3) : 0;
      }
      if (nr < riders.length) {
        const r = riders[nr++];
        r.group.visible = true;
        let z;
        let y;
        if (c.state === 'warn') {
          const k = c.t / CHARIOT.warn;
          z = -180 + 110 * ease(k);
          y = 34 - 26 * ease(k);
        } else {
          const k = c.t / CHARIOT.burn;
          z = -70 + 110 * k;
          y = 8 - 2 * Math.sin(k * Math.PI) + Math.max(0, k - 0.7) * 30;
        }
        r.group.position.set(x + Math.sin(clock * 2 + c.id) * 0.4, y, z);
        // its nose (+z) toward him, banking a little
        r.group.rotation.set(c.state === 'warn' ? 0.25 : 0.05, 0, Math.sin(clock * 1.7 + c.id) * 0.12);
        poseHumanoid(r.rider, { t: clock, mode: 'idle', aim: 0.9, phase: c.id });
        if (!calm && c.state === 'burn') {
          // fire raining down the lane under it
          if (Math.random() < 0.7) vfx.beam(v3.set(x, y - 0.5, z), new THREE.Vector3(x + (Math.random() - 0.5) * 2, 0, z - 6 - Math.random() * 6), { color: 0x6fd8ff, width: 0.12, life: 0.08 });
          if (Math.random() < 0.5) vfx.fire(new THREE.Vector3(x + (Math.random() - 0.5) * 2, 0.4, z - 8 - Math.random() * 10), { size: 1.8, count: 2, life: 0.5 });
        }
      }
    }
  }

  // the sky: chariots circling the tower, the portal turning
  function placeSky(dt) {
    for (const s of circling) {
      s.a += s.sp * dt;
      const x = portalAt.x + Math.cos(s.a) * s.r;
      const z = portalAt.z + 120 + Math.sin(s.a) * s.r * 0.5;
      s.c.position.set(x, s.y + Math.sin(s.a * 3) * 8, z);
      s.c.rotation.set(0, -s.a, Math.sin(s.a) * 0.3);
    }
    portal.mat.uniforms.uTime.value = clock;
    stark.update(clock);
  }

  // ── render ──
  let snap = false;
  function render(g, dt) {
    const realDt = Math.min(0.05, dt);
    clock += realDt;
    smashT += realDt;
    landT += realDt;
    roarT += realDt;
    hitT += realDt;
    if (g.phase === 'lost') lostT += realDt;
    else lostT = 0;
    if (g.hulk.smash >= 0) smashT = g.hulk.smash;
    if (g.d < lastD - 1) {
      // a new run: nothing left over
      flying.length = 0;
      vfx.clear();
      for (const h of soldiers) {
        h.flying = false;
        h.id = null;
        h.root.visible = false;
      }
      soldierFor.clear();
      rims.clear();
    }
    lastD = g.d;

    placeCity(g);
    if (mh) poseMeshyHulk(g, realDt);
    else poseHulk(g, realDt);
    placeObstacles(g, realDt);
    placeChariots(g);
    placeSky(realDt);
    field.mat.uniforms.uTime.value = clock;

    // dust kicked up by his feet, and sparks off him in a rage
    if (!calm && g.phase === 'run' && g.hulk.air <= 0 && Math.random() < realDt * 10) vfx.smoke(v3.set(g.hulk.x + (Math.random() - 0.5) * 0.8, 0.2, 0.6), { size: 0.9, count: 1, life: 0.8, rise: 0.4, opacity: 0.25, color: 0x5a5450, to: 0x8a8480 });
    if (!calm && g.hulk.raging > 0) {
      (mh?.bones.LeftHand ?? hulk.bones.handL).getWorldPosition(v3);
      vfx.sparks(v3, { count: 1, speed: 2, color: 0xc8ffb0, to: GREEN, life: 0.3, size: 0.08, gravity: -2 });
      (mh?.bones.RightHand ?? hulk.bones.handR).getWorldPosition(v3);
      vfx.sparks(v3, { count: 1, speed: 2, color: 0xc8ffb0, to: GREEN, life: 0.3, size: 0.08, gravity: -2 });
    }

    // ── the camera: behind and above, wider as he speeds up ──
    const H = g.hulk;
    const t = tall();
    const want = v3.set(H.x * 0.55, (t ? 6.2 : 4.4) + H.y * 0.45, t ? 10.2 : 7.4);
    if (snap) camPos.copy(want);
    else camPos.lerp(want, 1 - Math.exp(-realDt * 6));
    const look = new THREE.Vector3(H.x * 0.3, 1.8 + H.y * 0.5, t ? -18 : -16);
    if (snap) camLook.copy(look);
    else camLook.lerp(look, 1 - Math.exp(-realDt * 8));
    snap = false;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const speedFov = (g.phase === 'run' ? (g.speed - RUN.speed[0]) * 0.45 : 0) + (H.raging > 0 ? 4 : 0);
    feel.setBaseFov(fov + speedFov);
    feel.update(realDt, camera);
    vfx.update(realDt, camera, engine.size.h);
    engine.render();
  }

  // ── the rules' events, as effects ──
  function fx(events, g) {
    for (const e of events) {
      switch (e.type) {
        case 'start':
          snap = true;
          break;
        case 'leap':
          vfx.smoke(v3.set(g.hulk.x, 0.2, 0.3), { size: 1.6, count: 6, life: 1, rise: 0.6, opacity: 0.4, color: 0x5a5450, to: 0x8a8480 });
          feel.punch(2);
          break;
        case 'land':
          landT = 0;
          vfx.smoke(v3.set(e.x, 0.2, 0), { size: 2, count: 8, life: 1.3, rise: 0.5, opacity: 0.45, color: 0x5a5450, to: 0x8a8480, spread: 1.6 });
          vfx.debris(v3.set(e.x, 0.1, -0.5), { count: 8, speed: 5, size: 0.12, color: 0x3a3836 });
          feel.trauma(0.35);
          break;
        case 'swing':
          smashT = 0;
          break;
        case 'whiff':
          vfx.smoke(v3.set(g.hulk.x, 0.2, -1.5), { size: 1.2, count: 4, life: 0.9, rise: 0.3, opacity: 0.35, color: 0x5a5450, to: 0x8a8480 });
          feel.trauma(0.12);
          break;
        case 'smash': {
          const z = zAt(g, e.at) - (KINDS[e.kind]?.len ?? 1) / 2;
          const at = new THREE.Vector3(e.x, 1, z);
          const up = 7 + Math.random() * 3;
          const fwd = g.speed + 8 + Math.random() * 6;
          const side = (e.x - g.hulk.x) * 1.5 + (Math.random() - 0.5) * 6;
          if (e.kind === 'soldier') {
            const fig = soldierFor.get(e.id);
            if (fig) {
              fig.flying = true;
              flying.push({ kind: 'soldier', fig, at: e.at, x: e.x, y: 0.2, vAt: fwd + 6, vx: side, vy: up + 3, rx: 0, ry: 0, rz: 0, sx: -9, sy: (Math.random() - 0.5) * 8, sz: (Math.random() - 0.5) * 8, t: 0, life: 1.6, floor: -3 });
            }
            vfx.sparks(at, { count: 22, speed: 8, color: 0xdff0ff, to: 0x6fd8ff, life: 0.4, size: 0.1 });
            vfx.debris(at, { count: 6, speed: 7, size: 0.1, color: 0x4d4237 });
          } else if (e.kind === 'barricade') {
            for (const sd of [-0.78, 0.78]) flying.push({ kind: 'barricade', at: e.at, x: e.x + sd, y: 0, vAt: fwd, vx: sd * 8 + side * 0.5, vy: up, rx: 0, ry: 0, rz: 0, sx: -5 - Math.random() * 6, sy: (Math.random() - 0.5) * 6, sz: sd * 6, t: 0, life: 1.4, floor: -2 });
            vfx.debris(at, { count: 18, speed: 9, size: 0.18, color: 0x9a9894 });
            vfx.smoke(at, { size: 2, count: 6, life: 1.4, rise: 0.8, opacity: 0.45, color: 0x8a8682, to: 0xb0aca8 });
          } else if (e.kind === 'car') {
            const { kind, c } = carLook(e.id);
            flying.push({ kind: 'car', car: kind, c, at: e.at + 2.2, x: e.x, y: 0, vAt: fwd + 4, vx: side, vy: up + 2, rx: 0, ry: (hash(e.id, 4) - 0.5) * 0.5, rz: 0, sx: -4 - Math.random() * 3, sy: (Math.random() - 0.5) * 3, sz: (Math.random() - 0.5) * 6, t: 0, life: 2.4, floor: 0 });
            vfx.sparks(at, { count: 40, speed: 10, color: 0xfff0c0, to: 0xff8030, life: 0.5, size: 0.12 });
            vfx.debris(at, { count: 14, speed: 9, size: 0.14, color: 0x8a9099 });
            vfx.flash(at, { color: 0xffb070, intensity: 50, distance: 16, life: 0.25 });
          } else if (e.kind === 'barrier') {
            vfx.sparks(at.setY(2), { count: 60, speed: 12, color: 0xe0d0ff, to: VIOLET, life: 0.6, size: 0.12 });
            vfx.ring(new THREE.Vector3(e.x, 2, z), { color: VIOLET, from: 0.5, to: 6, life: 0.4, normal: new THREE.Vector3(0, 0, 1), opacity: 0.7 });
            vfx.flash(at, { color: VIOLET, intensity: 60, distance: 18, life: 0.3 });
          }
          // the punch itself: a ring off his fists, a shake, a stop
          if (e.rage) vfx.ring(new THREE.Vector3(g.hulk.x, 0.06, -2.2), { color: GREEN, from: 0.4, to: 2.4, life: 0.2, opacity: 0.18 });
          feel.trauma(e.kind === 'car' ? 0.4 : e.perfect ? 0.28 : 0.18);
          feel.hitstop(e.kind === 'car' ? 70 : e.perfect ? 55 : 25);
          feel.punch(e.perfect ? 3 : 1.5);
          break;
        }
        case 'hit':
          hitT = 0;
          feel.trauma(0.6);
          feel.punch(4);
          vfx.sparks(v3.set(g.hulk.x, 1.4, -0.6), { count: 24, speed: 6, color: 0xffd0a0, to: 0xff4020, life: 0.4, size: 0.1 });
          vfx.smoke(v3.set(g.hulk.x, 0.4, -0.8), { size: 1.6, count: 5, life: 1, rise: 0.6, opacity: 0.4 });
          break;
        case 'rage':
          roarT = 0;
          vfx.ring(v3.set(g.hulk.x, 0.08, 0), { color: GREEN, from: 0.8, to: 14, life: 0.7, opacity: 0.7 });
          vfx.flash(v3.set(g.hulk.x, 2, 0), { color: GREEN, intensity: 90, distance: 24, life: 0.6 });
          vfx.sparks(v3.set(g.hulk.x, 1.8, 0), { count: 70, speed: 9, color: 0xd8ffc8, to: GREEN, life: 0.7, size: 0.12 });
          feel.trauma(0.7);
          feel.punch(6);
          break;
        case 'burn':
          feel.trauma(0.25);
          break;
        case 'lost':
          feel.trauma(0.5);
          break;
        case 'stone':
          vfx.ring(v3.set(g.hulk.x, 1.5, -3), { color: 0x3aff8a, from: 1, to: 10, life: 1, normal: new THREE.Vector3(0, 0, 1), opacity: 0.8 });
          vfx.flash(v3.set(g.hulk.x, 3, -3), { color: 0x3aff8a, intensity: 120, distance: 30, life: 1 });
          vfx.sparks(v3.set(g.hulk.x, 2, -3), { count: 90, speed: 7, color: 0xd8ffe0, to: 0x2adf6a, life: 1, size: 0.12, gravity: 0 });
          break;
        default:
      }
    }
  }

  const project = (x, y, z) => engine.project(v3.set(x, y, z));
  const resize = (w, h) => {
    engine.resize(w, h);
    const aspect = w / Math.max(1, h);
    fov = aspect < 1.2 ? FOV + (1.2 - aspect) * 34 : FOV;
    feel.setBaseFov(fov);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    snap = true;
  };

  return {
    engine,
    render,
    fx,
    project,
    resize,
    // where a course position (and lane x) is on screen, for popups
    projectAt: (g, at, x, y = 1) => engine.project(v3.set(x, y, zAt(g, at))),
    timeScale: (dt) => feel.scale(dt),
    snap() {
      snap = true;
    },
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
  };
}
