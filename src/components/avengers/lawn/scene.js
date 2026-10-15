// Hold the Lawn in 3D: the compound's front lawn at night in a storm, seen
// over Thor's shoulder. It draws the rules' state (./rules.js) and turns their
// events into lightning, sparks, thunder and falling Chitauri; the HUD is drawn
// by the page on top.

import * as THREE from 'three';
import { createStage, hot } from '../hq/stage';
import { pbr, preload } from '../hq/assets';
import { buildCompound, buildGround, fbm, logoTexture, scatter, trees } from '../hq/kit/world';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { instanced } from '../hq/kit/instanced';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { LAWN, LINE } from './rules';
import { buildCape, buildChariot, buildMjolnir, buildPortal, buildRain, craterTexture, lightningPool } from './models';

const FOV = 50;
const SOLDIERS = 30;
const BRUTES = 5;
const RIDERS = 3;
const CRATER = new THREE.Vector3(0.45, 0, -0.95);
const BOLT = 0x6fd8ff;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const m4tmp = new THREE.Matrix4();
const ease = (k) => k * k * (3 - 2 * k);
const approach = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
const angleTo = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export async function create(rt, { onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.0, fov: FOV, near: 0.1, far: 1200, bloom: { strength: 0.75, radius: 0.55, threshold: 0.9 }, onSlow });
  const { scene, camera, sun, hemi } = engine;
  const small = engine.small;

  const sets = ['grass', 'sidewalk', 'concrete-wall', 'leather', 'carbon', 'brushed-steel', 'rock'];
  await preload({ sets, skies: ['storm'], models: ['lamp', 'rocks', 'shrub', 'grass-clump'], impostors: ['fir-a', 'fir-b', 'fir-c', 'broadleaf'], small, renderer: engine.renderer });

  // night, under a low cloud deck lit by the moon behind it; moonlight from
  // the right and behind, cool; the fog the colour of the night
  const SKY_BG = 0.3;
  await engine.setSky('storm', { rotate: 2.3, bgIntensity: SKY_BG, envIntensity: 0.6, sunDir: [0.45, 0.75, 0.42], sunIntensity: 1.6, sunColor: [0.68, 0.78, 1.0], fill: 0.1, fog: { density: 0.0135, color: 0x353c4a } });
  engine.setShadowBox(new THREE.Vector3(0, 0, -14), 24, 90);
  const moonI = sun.intensity;
  const hemiI = hemi.intensity;
  // a lightning flash lights everything from above, cold and hard
  const flashLight = new THREE.DirectionalLight(0xdfe9ff, 0);
  flashLight.position.set(-20, 60, -40);
  scene.add(flashLight);
  // the portal's glow on the lawn
  const portalLight = new THREE.DirectionalLight(0x6fb6ff, 0.35);
  portalLight.position.set(0, 40, -180);
  scene.add(portalLight);

  // ── the ground: the lawn, flat where the fight is ──
  const flat = (x, z) => {
    const k = Math.max((Math.abs(x) - 40) / 60, (-z - 70) / 60, (z - 30) / 30, 0);
    return Math.min(1, k) ** 2;
  };
  const { mesh: ground, heightAt } = await buildGround({ size: 900, seg: 160, texture: 'grass', tile: 3.2, hill: 16, flat, small, color: 0x9fb08a, stripes: 4, colorVar: 0.18 });
  ground.material.roughness = 0.82; // it's wet
  scene.add(ground);

  // the Avengers "A" mown into the lawn
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1d2a12, alphaMap: logoTexture(1024), transparent: true, opacity: 0.55, roughness: 1, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  logo.position.set(0, 0.02, -26);
  logo.receiveShadow = true;
  scene.add(logo);

  // the terrace in front of the compound, its edge (the line) lit along its length
  const paving = await pbr('sidewalk', { repeat: [16, 10], small, roughness: 0.75, metalness: 0, color: 0xb9bcc2 });
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(36, 0.1, 22), paving);
  terrace.position.set(0, -0.03, LINE + 11);
  terrace.receiveShadow = true;
  scene.add(terrace);
  const edgeMat = new THREE.MeshBasicMaterial({ color: hot(0xffd9a0, 2.2), toneMapped: false });
  const edge = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.04, 0.08), edgeMat, 30);
  for (let i = 0; i < 30; i++) edge.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-17.4 + i * 1.2, 0.03, LINE));
  scene.add(edge);
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(36, 0.14, 0.3), await pbr('concrete-wall', { repeat: [24, 0.2], small, roughness: 0.9, metalness: 0, color: 0xc8c8c8 }));
  kerb.position.set(0, 0.02, LINE - 0.15);
  kerb.receiveShadow = true;
  scene.add(kerb);

  // the crater the hammer waits in
  const crater = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: craterTexture(), transparent: true, roughness: 0.9, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  crater.position.set(CRATER.x, 0.03, CRATER.z);
  scene.add(crater);
  // broken paving round it, slabs tipped up
  const shards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), paving, 11);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    const r = 0.62 + (i % 3) * 0.12;
    const w = 0.22 + (i % 4) * 0.06;
    m4tmp.compose(new THREE.Vector3(CRATER.x + Math.cos(a) * r, 0.04, CRATER.z + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.35, -a, -Math.cos(a) * 0.35)), new THREE.Vector3(w, 0.07, w * 0.8));
    shards.setMatrixAt(i, m4tmp);
  }
  shards.castShadow = true;
  shards.receiveShadow = true;
  scene.add(shards);

  // the compound behind, its windows lit
  const compound = await buildCompound({ small, lights: 0.7 });
  compound.position.set(-8, 0, 30);
  compound.rotation.y = Math.PI;
  scene.add(compound);

  // lamps along the terrace, two of them really lit
  const lampPts = [
    [-12.5, 1.5, 1.2, Math.PI / 2],
    [12.5, 1.5, 1.2, -Math.PI / 2],
    [-12.5, 12, 1.2, Math.PI / 2],
    [12.5, 12, 1.2, -Math.PI / 2],
  ];
  scene.add(await scatter('lamp', lampPts));
  const bulbMat = new THREE.MeshBasicMaterial({ color: hot(0xffd9a0, 2.6), toneMapped: false });
  lampPts.forEach(([x, z, s], i) => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 12, 8), bulbMat);
    const bx = x + (x > 0 ? -0.36 : 0.36) * s;
    bulb.position.set(bx, 3.68 * s, z);
    scene.add(bulb);
    if (i < 2) {
      const l = new THREE.PointLight(0xffc98a, 14, 22, 2);
      l.position.set(bx, 3.5 * s, z);
      scene.add(l);
    }
  });

  // shrubs and grass at the lawn's edges, rocks out by the trees
  const props = [];
  const shrubs = [];
  for (let i = 0; i < (small ? 10 : 18); i++) {
    const sd = i % 2 ? 1 : -1;
    shrubs.push([sd * (19 + ((i * 3.7) % 14)), 8 - ((i * 9.1) % 70), 3 + (i % 3), i]);
  }
  props.push(scatter('shrub', shrubs, { heightAt, shadows: false }));
  const grassPts = [[], [], [], [], []];
  for (let i = 0; i < (small ? 60 : 120); i++) {
    const sd = i % 2 ? 1 : -1;
    grassPts[i % 5].push([sd * (16 + ((i * 7.3) % 26)), 4 - ((i * 13.1) % 70), 1.5 + (i % 3) * 0.4, i]);
  }
  grassPts.forEach((pts, k) => props.push(scatter('grass-clump', pts, { heightAt, node: `grass_medium_02_${'abcde'[k]}`, shadows: false })));
  const rockPts = [[], [], []];
  for (let i = 0; i < 12; i++) {
    const sd = i % 2 ? 1 : -1;
    rockPts[i % 3].push([sd * (22 + ((i * 5.3) % 18)), -20 - ((i * 11.7) % 45), 0.6 + (i % 3) * 0.3, i]);
  }
  rockPts.forEach((pts, k) => props.push(scatter('rocks', pts, { heightAt, node: `rock_moss_set_01_rock0${k + 1}`, sink: 0.15, tilt: 0.3, shadows: false })));
  for (const p of await Promise.all(props)) scene.add(p);

  // the trees: a line beyond the lawn, a few standing on it
  const treePts = [];
  const N = small ? 1500 : 2800;
  for (let i = 0; i < N; i++) {
    const x = ((i * 0.6180339) % 1) * 460 - 230;
    const z = 40 - ((i * 0.7548776) % 1) * 380;
    if (z > -64 - fbm(x * 0.04, 2) * 10 && Math.abs(x) < 34 + fbm(z * 0.04, 5) * 8) continue;
    if (z > 0 && Math.abs(x) < 60) continue; // the compound and its terrace
    if (fbm(x * 0.03 + 2, z * 0.03 - 5) < 0.38) continue;
    const kind = fbm(x * 0.02 + 5, z * 0.02) > 0.6 ? 3 : i % 3;
    treePts.push([x, z, kind === 3 ? 8 + fbm(x, z) * 6 : 15 + fbm(x * 0.07, z * 0.07) * 15, kind, i * 2.3]);
  }
  for (const [x, z] of [
    [-24, -14],
    [27, -22],
    [-30, -40],
    [33, -8],
  ])
    treePts.push([x, z, 9, 3, x]);
  scene.add(await trees(treePts, { heightAt }));

  // the portal over the trees, and rain
  const portal = buildPortal(36);
  portal.mesh.position.set(12, 46, -220);
  scene.add(portal.mesh);
  const rain = buildRain({ count: small ? 1800 : 3600, calm });
  scene.add(rain.lines);

  // ── Thor ──
  const thorMats = {
    armour: await pbr('leather', { repeat: [3, 3], small, roughness: 0.75, metalness: 0.15, color: 0x3a3d44, normalScale: 1.4 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.28 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd9a587, roughness: 0.6, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: 0xb8954f, roughness: 0.7, metalness: 0.05 }),
    beard: new THREE.MeshStandardMaterial({ color: 0x9a7740, roughness: 0.85, metalness: 0 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x1d1c1e, roughness: 0.55, metalness: 0.2 }),
  };
  const thor = buildHumanoid({ style: 'thor', materials: thorMats, scale: 1.05 });
  scene.add(thor.root);
  const capeMat = await pbr('carbon', { repeat: [2, 3], small, roughness: 0.9, metalness: 0, color: 0x8c1414, side: THREE.DoubleSide });
  const cape = buildCape(capeMat);
  cape.mesh.position.set(0, 0.34 * thor.scale, -0.13 * thor.scale);
  thor.bones.chest.add(cape.mesh);

  // Mjolnir
  const hammerMats = {
    uru: new THREE.MeshPhysicalMaterial({ color: 0x8a8f96, metalness: 1, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4, emissive: new THREE.Color(0x5aa8ff), emissiveIntensity: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.9, roughness: 0.5 }),
    grip: await pbr('leather', { repeat: [1, 3], small, roughness: 0.8, metalness: 0, color: 0x6a4228 }),
  };
  hammerMats.ends = hammerMats.uru.clone();
  const mjolnir = buildMjolnir(hammerMats);
  const hammer = mjolnir.group;
  scene.add(hammer);
  const gripAt = new THREE.Object3D(); // where the hammer sits in his hand
  gripAt.position.set(0, -0.085 * thor.scale, 0.01);
  gripAt.rotation.set(Math.PI, 0, 0); // the head hangs below the fist
  thor.bones.handR.add(gripAt);

  // ── the Chitauri ──
  const chitMats = () => ({
    armour: new THREE.MeshStandardMaterial({ color: 0x4d4237, metalness: 0.75, roughness: 0.42 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 0.75, metalness: 0.05 }),
    glow: new THREE.MeshBasicMaterial({ color: hot(BOLT, 2.2), toneMapped: false }),
    shield: new THREE.MeshStandardMaterial({ color: 0x3a332c, metalness: 0.85, roughness: 0.35 }),
  });
  const sharedArmour = chitMats();
  const makeFigure = (style, scale, mats) => {
    const h = buildHumanoid({ style, materials: mats, scale });
    h.root.visible = false;
    h.mats = mats;
    h.id = null;
    h.dying = null;
    scene.add(h.root);
    return h;
  };
  // each soldier its own glow (for its rifle charging) and a hit flash
  const soldiers = Array.from({ length: SOLDIERS }, () => makeFigure('chitauri', 1, { ...sharedArmour, glow: new THREE.MeshBasicMaterial({ color: hot(BOLT, 2.2), toneMapped: false }) }));
  const brutes = Array.from({ length: BRUTES }, () => makeFigure('brute', 1.25, { ...sharedArmour, glow: new THREE.MeshBasicMaterial({ color: hot(BOLT, 2.2), toneMapped: false }) }));
  const cullMats = {
    armour: new THREE.MeshStandardMaterial({ color: 0x1e1c1b, metalness: 0.85, roughness: 0.4 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.55, metalness: 0.25 }),
    glow: new THREE.MeshBasicMaterial({ color: hot(0xff5a1a, 2.6), toneMapped: false }),
    shield: new THREE.MeshStandardMaterial({ color: 0x2a2624, metalness: 0.9, roughness: 0.3, emissive: new THREE.Color(0xff3a10), emissiveIntensity: 0 }),
  };
  const cull = makeFigure('cull', 1.7, cullMats);
  // chariots, each with a rider
  const chariots = Array.from({ length: RIDERS }, () => {
    const group = new THREE.Group();
    group.add(buildChariot({ armour: sharedArmour.armour, dark: new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.7, roughness: 0.45 }), glow: new THREE.MeshBasicMaterial({ color: hot(BOLT, 2.6), toneMapped: false }) }));
    const rider = buildHumanoid({ style: 'chitauri', materials: { ...sharedArmour, glow: new THREE.MeshBasicMaterial({ color: hot(BOLT, 2.2), toneMapped: false }) }, scale: 0.95 });
    rider.root.position.set(0, 0.24, -0.5);
    group.add(rider.root);
    group.visible = false;
    scene.add(group);
    return { group, rider, id: null, dying: null, bank: 0 };
  });

  // bolts
  const boltMat = new THREE.MeshBasicMaterial({ color: hot(BOLT, 3.2), toneMapped: false });
  const bolts = instanced({ bolt: new THREE.CapsuleGeometry(0.09, 0.7, 4, 8).rotateX(Math.PI / 2) }, { bolt: boltMat }, 30, { shadows: false });
  scene.add(bolts.group);

  // ── the aim: a ring on the lawn, the throw's line, the recall's line ──
  const ringMat = new THREE.MeshBasicMaterial({ color: hot(0xbfe0ff, 1.6), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 40).rotateX(-Math.PI / 2), ringMat);
  aimRing.renderOrder = 4;
  scene.add(aimRing);
  const lineMat = (color) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: { uTime: { value: 0 }, uLen: { value: 1 }, uColor: { value: hot(color, 1.4) }, uOpacity: { value: 0.8 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLen, uOpacity; uniform vec3 uColor; varying vec2 vUv;
        void main() {
          float d = fract(vUv.y * uLen / 0.9 - uTime * 2.0);
          float dash = smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.5, 0.6, d));
          float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          gl_FragColor = vec4(uColor * dash * edge * fade * uOpacity, 1.0);
        }`,
    });
  const makeLine = (color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5), lineMat(color));
    m.renderOrder = 4;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const throwLine = makeLine(0xbfe0ff);
  const recallLine = makeLine(0xffd27a);
  const placeLine = (m, ax, az, bx, bz, w) => {
    const len = Math.hypot(bx - ax, bz - az);
    m.position.set(ax, 0.05, az);
    m.rotation.set(0, Math.atan2(-(bx - ax), -(bz - az)), 0);
    m.scale.set(w, 1, Math.max(0.01, len));
    m.material.uniforms.uLen.value = len;
  };

  const vfx = createVfx(scene, { calm, ground: 0.02, maxSparks: 1200, debrisMaterial: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.4 }) });
  const zap = lightningPool(scene, 14);
  const feel = createFeel({ seed: 3, calm, baseFov: FOV, offset: 0.09 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'lawn');
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ── per frame ──
  const v3 = new THREE.Vector3();
  const v4 = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const fwd = new THREE.Vector3(0, 0, 1);
  let clock = 0;
  let fov = FOV;
  let camBlend = 0; // 0 the front view at the lift, 1 over his shoulder
  let thorYaw = Math.PI;
  let thorX = 0;
  let throwT = 9; // seconds since a throw
  let catchT = 9;
  let raiseT = 9; // seconds since he called lightning
  let liftedT = 9;
  let flash = 0;
  let nextStorm = 6;
  let spin = 0;
  const camPos = new THREE.Vector3(2.4, 1.8, -4.8);
  const camLook = new THREE.Vector3(0, 1.2, 0);
  const byId = new Map(); // enemy id → figure
  const flashes = new Map(); // id → hit flash
  const last = new Map(); // id → its last state, for a death or a breach

  const free = (pool) => pool.find((h) => h.id == null && !h.dying);
  const figureFor = (e) => {
    if (byId.has(e.id)) return byId.get(e.id);
    const pool = e.kind === 'soldier' ? soldiers : e.kind === 'brute' ? brutes : e.kind === 'cull' ? [cull] : chariots;
    const h = free(pool);
    if (!h) return null;
    h.id = e.id;
    byId.set(e.id, h);
    return h;
  };

  // a lightning flash: the sky, the lawn and the rain light up
  const lightning = (k = 1) => {
    if (calm) return;
    flash = Math.max(flash, k);
  };

  function poseThor(g, dt) {
    const T = g.thor;
    const phase = g.phase;
    const h = g.hammer;
    const lifting = phase === 'lift' || phase === 'ready';
    const moving = Math.abs(T.move) > 0.05 && !lifting;
    thorX = approach(thorX, T.x, 30, dt);
    thor.root.position.set(thorX, 0.02, 0);
    // face the aim (or the hammer, when it's away)
    let want = Math.PI;
    if (!lifting) {
      const tx = h.state === 'held' ? (g.aimX ?? 0) : h.x;
      const tz = h.state === 'held' ? (g.aimZ ?? -20) : h.z;
      want = Math.atan2(tx - thorX, tz);
    }
    thorYaw += angleTo(thorYaw, want) * (1 - Math.exp(-dt * 10));
    thor.root.rotation.y = thorYaw + (moving ? Math.sign(T.move) * -0.35 : 0);
    poseHumanoid(thor, { t: clock, mode: moving ? 'walk' : 'idle', speed: 1.3, phase: 0.3, flinch: T.hurt * 1.2 });
    const b = thor.bones;
    // breathing, and his weight on his back foot
    b.chest.rotation.x += Math.sin(clock * 1.6) * 0.02;
    b.spine.rotation.y += moving ? Math.sign(T.move) * 0.35 : 0;
    // his left arm: out a little, the fist clenched
    b.shoulderL.rotation.set(0.1 + Math.sin(clock * 1.1) * 0.03, 0, 0.18);
    b.elbowL.rotation.set(-0.3, 0, 0);
    // his right: the hammer
    let sx = 0.08;
    let sz = -0.12;
    let ex = -0.2;
    if (lifting) {
      // bent over the hammer, gripping it; straining as the lift goes on
      const L = g.lift;
      const k = phase === 'lift' && L.holding ? 1 : 0.3;
      const strain = k * (0.4 + L.progress * 0.6);
      b.hips.position.y = thor.rest.hips.y - 0.18 * k * thor.scale;
      b.hips.rotation.x = 0.25 * k;
      b.spine.rotation.x = 0.35 * k;
      b.chest.rotation.x = 0.25 * k - L.progress * 0.2 * k;
      b.thighL.rotation.x = -0.55 * k;
      b.thighR.rotation.x = -0.75 * k;
      b.kneeL.rotation.x = 0.9 * k;
      b.kneeR.rotation.x = 1.1 * k;
      b.footL.rotation.x = -0.25 * k;
      b.footR.rotation.x = -0.3 * k;
      sx = -0.55 * k;
      ex = -0.2 * k;
      sz = -0.05;
      if (!calm && strain > 0) {
        b.chest.rotation.z = Math.sin(clock * 47) * 0.012 * strain;
        b.shoulderR.rotation.y = Math.sin(clock * 53) * 0.03 * strain;
      }
      b.head.rotation.x = -0.25 * k;
    } else if (raiseT < 1.1) {
      // calling lightning: the hammer straight up
      const k = ease(clamp(raiseT / 0.18, 0, 1)) * (raiseT > 0.85 ? 1 - (raiseT - 0.85) / 0.25 : 1);
      sx = 0.08 * (1 - k) - 3.0 * k;
      sz = -0.12 * (1 - k) + 0.1 * k;
      ex = -0.2 * (1 - k);
      b.head.rotation.x = -0.35 * k;
    } else if (liftedT < 1.6) {
      // the hammer raised, just lifted
      const k = ease(clamp(liftedT / 0.25, 0, 1)) * (liftedT > 1.2 ? 1 - (liftedT - 1.2) / 0.4 : 1);
      sx = -3.0 * k + 0.08 * (1 - k);
      ex = -0.2 * (1 - k);
      b.head.rotation.x = -0.4 * k;
    } else if (throwT < 0.45) {
      // the throw: up and back, then through
      const k = throwT / 0.45;
      sx = k < 0.25 ? -2.6 * (k / 0.25) : -2.6 + 1.6 * ease((k - 0.25) / 0.75);
      ex = -0.1;
      b.spine.rotation.y += -0.4 * Math.sin(k * Math.PI);
      b.chest.rotation.x += 0.2 * Math.sin(k * Math.PI);
    } else if (h.state === 'back' || catchT < 0.35) {
      // the hand out for the catch
      const k = h.state === 'back' ? 1 : 1 - catchT / 0.35;
      sx = -1.5 * k + 0.08 * (1 - k);
      ex = -0.15 * k - 0.2 * (1 - k);
      sz = -0.12 + 0.15 * k;
    } else if (h.state !== 'held') {
      // empty-handed: the hand open toward it
      sx = -0.35;
      ex = -0.25;
    }
    b.shoulderR.rotation.x = sx;
    b.shoulderR.rotation.z = sz;
    b.elbowR.rotation.x = ex;
    b.handR.rotation.set(0, 0, 0);
    const lift = liftedT < 1.6 ? 1 : 0;
    cape.update(clock, { wind: 1, run: moving ? 1 : 0, lift });
  }

  function placeHammer(g, dt) {
    const h = g.hammer;
    const lifting = g.phase === 'lift' || g.phase === 'ready';
    if (!lifting && h.state === 'held') {
      if (hammer.parent !== gripAt) {
        gripAt.add(hammer);
        hammer.position.set(0, 0, 0);
        hammer.rotation.set(0, 0, 0);
      }
      return;
    }
    if (hammer.parent !== scene) scene.add(hammer);
    if (lifting) {
      // upright in the crater, the head down, rocking with the needle
      const L = g.lift;
      const rock = g.phase === 'lift' && L.holding ? L.x * 0.35 : 0;
      const rise = g.phase === 'lift' ? L.progress * 0.08 : 0;
      hammer.position.set(CRATER.x, 0.47 + rise, CRATER.z);
      hammer.rotation.set(Math.PI, 0, rock);
      return;
    }
    if (h.state === 'down') {
      // it lands head down and stands there humming
      hammer.position.set(h.x, 0.46, h.z);
      hammer.rotation.set(Math.PI, 0, Math.sin(clock * 3) * 0.03);
      return;
    }
    // in flight: end over end on the way out, handle first on the way back
    hammer.position.set(h.x, h.y, h.z);
    v3.set(h.vx, h.vy, h.vz);
    if (v3.lengthSq() < 1e-6) return;
    v3.normalize();
    if (h.state === 'out') {
      spin += dt * 22;
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3);
      hammer.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spin));
    } else {
      // the handle leads: the head (+y) points back along its path
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3.negate());
      hammer.quaternion.copy(q);
    }
  }

  let snap = false;
  function render(g, dt, { aim } = {}) {
    const realDt = Math.min(0.05, dt);
    if (snap) {
      snap = false;
      camBlend = g.phase === 'lift' || g.phase === 'ready' ? 0 : 1;
      liftedT = 9;
    }
    clock += realDt;
    throwT += realDt;
    catchT += realDt;
    raiseT += realDt;
    liftedT += realDt;
    if (aim) {
      g.aimX = aim.x;
      g.aimZ = aim.z;
    }
    const playing = g.phase === 'wave' || g.phase === 'break';
    const lifting = g.phase === 'lift' || g.phase === 'ready';

    poseThor(g, realDt);
    placeHammer(g, realDt);

    // ── the Chitauri ──
    const seen = new Set();
    for (const e of g.enemies) {
      const fig = figureFor(e);
      if (!fig) continue;
      seen.add(fig);
      last.set(e.id, e);
      const f = flashes.get(e.id) ?? 0;
      if (e.kind === 'chariot') {
        fig.group.visible = true;
        fig.group.position.set(e.x, e.y + Math.sin(clock * 2 + e.seed) * 0.15, e.z);
        fig.bank = approach(fig.bank, 0, 3, realDt);
        fig.group.rotation.set(0, Math.atan2(e.vx, 0), Math.sin(clock * 1.3 + e.seed) * 0.08 - Math.sign(e.vx) * 0.12);
        poseHumanoid(fig.rider, { t: clock, mode: 'idle', aim: 0.8, phase: e.seed });
        continue;
      }
      fig.root.visible = true;
      fig.root.position.set(e.x, heightAt(e.x, e.z), e.z);
      // face where it's going, or Thor when it's shooting
      const shooting = e.shooter && e.shots < 3 && e.z >= e.stopZ;
      const face = shooting ? Math.atan2(g.thor.x - e.x, -e.z) : Math.atan2(e.fx ?? 0, e.fz ?? 1);
      fig.root.rotation.y = approach(fig.root.rotation.y, face, 8, realDt);
      const charge = e.charging > 0 ? 1 - e.charging / 1.1 : 0;
      poseHumanoid(fig, { t: clock, mode: shooting || e.stagger > 0 ? 'idle' : 'walk', speed: e.kind === 'cull' ? 0.5 : e.kind === 'brute' ? 0.65 : 0.85 + (e.speed - 1.7) * 0.4, phase: e.seed, aim: shooting ? 0.6 + charge * 0.4 : 0.3, lean: e.kind === 'soldier' ? 0.35 : 0.15, flinch: f * 1.5 + (e.stagger > 0 ? 0.6 : 0) });
      if (e.kind === 'brute' || e.kind === 'cull') {
        // the shield arm across the body
        fig.bones.shoulderL.rotation.set(-0.5, 0.2, -0.45);
        fig.bones.elbowL.rotation.set(-0.9, 0, 0);
      }
      if (fig.mats.glow !== sharedArmour.glow && e.kind !== 'cull') fig.mats.glow.color.copy(hot(BOLT, 2.2 + charge * 8 + f * 4));
      if (e.kind === 'cull') {
        cullMats.glow.color.copy(hot(0xff5a1a, 2.6 + Math.sin(clock * 3) * 0.6 + f * 6));
        cullMats.shield.emissiveIntensity = f * 2;
      }
      if (charge > 0 && !calm && Math.random() < 0.3) {
        fig.bones.handR.getWorldPosition(v3);
        vfx.sparks(v3, { count: 1, speed: 1.2, color: 0xbff0ff, to: BOLT, life: 0.25, size: 0.06, gravity: 0 });
      }
    }
    for (const [id, f] of flashes) {
      const n = f - realDt * 5;
      if (n <= 0) flashes.delete(id);
      else flashes.set(id, n);
    }
    // the dead and those gone through: fall, sink, and go back to the pool
    for (const pool of [soldiers, brutes, [cull]]) {
      for (const h of pool) {
        if (h.dying) {
          const d = h.dying;
          d.t += realDt;
          const k = Math.min(1, d.t / 0.55);
          h.root.position.x += d.dx * realDt * (1 - k) * 4;
          h.root.position.z += d.dz * realDt * (1 - k) * 4;
          h.root.rotation.x = -ease(k) * 1.45 * d.fall;
          poseHumanoid(h, { t: clock, mode: 'idle', flinch: 1 });
          if (d.t > 1.4) h.root.position.y -= realDt * 0.8;
          if (d.t > 2.4) {
            h.dying = null;
            h.root.visible = false;
            h.root.rotation.x = 0;
          }
        } else if (h.id != null && !seen.has(h)) {
          // its rules are done with it: a death (from fx) or a breach
          byId.delete(h.id);
          h.dying = { t: 0, dx: 0, dz: 0, fall: 0.6 };
          h.id = null;
        }
      }
    }
    for (const c of chariots) {
      if (c.dying) {
        const d = c.dying;
        d.t += realDt;
        c.group.position.y -= realDt * (2 + d.t * 9);
        c.group.position.x += d.vx * realDt;
        c.group.rotation.z += realDt * 2.5;
        c.group.rotation.x += realDt * 1.2;
        if (!calm && Math.random() < 0.6) vfx.smoke(c.group.position, { size: 1, count: 1, life: 1.2, color: 0x2a2a2c, to: 0x55555a, opacity: 0.55 });
        if (c.group.position.y < 0.2) {
          vfx.explode(c.group.position.clone().setY(0.4), { scale: 1.1 });
          c.dying = null;
          c.group.visible = false;
        }
      } else if (c.id != null && !seen.has(c)) {
        byId.delete(c.id);
        c.id = null;
        c.group.visible = false;
      }
    }

    // ── bolts ──
    bolts.begin();
    for (const b of g.bolts) {
      v3.set(b.vx, b.vy, b.vz).normalize();
      q.setFromUnitVectors(fwd, v3);
      m4.compose(v4.set(b.x, b.y, b.z), q, one);
      bolts.set(m4);
      if (!calm && Math.random() < 0.7) vfx.trail(v4, { size: 0.45, life: 0.18, color: BOLT, to: 0x103050, a: 0.7 });
    }
    bolts.end();

    // ── the hammer's glow, sparks on the way ──
    const h = g.hammer;
    const charged = g.charge >= 100 && playing;
    // the uru glows from inside when it's charged or flying
    const glow = (charged ? 0.35 : 0) + (h.state === 'out' || h.state === 'back' ? 0.5 : 0);
    hammerMats.uru.emissiveIntensity = glow * (0.6 + 0.4 * Math.sin(clock * 37) ** 2);
    hammerMats.ends.emissiveIntensity = hammerMats.uru.emissiveIntensity;
    if (!calm && playing) {
      hammer.getWorldPosition(v3);
      if (h.state === 'out' || h.state === 'back') {
        vfx.sparks(v3, { count: 2, speed: 2.5, color: 0xdff0ff, to: 0x5aa8ff, life: 0.25, size: 0.07, gravity: 0 });
        vfx.trail(v3, { size: 0.5, life: 0.22, color: 0xbfe0ff, to: 0x2050a0, a: 0.6 });
        if (Math.random() < 0.08) zap.strike(v3.clone(), v3.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, -v3.y, (Math.random() - 0.5) * 2)), camera, { width: 0.04, jag: 0.25, forks: 0, life: 0.12 });
      } else if (charged && Math.random() < 0.25) vfx.sparks(v3, { count: 1, speed: 1.5, color: 0xdff0ff, to: 0x5aa8ff, life: 0.2, size: 0.05, gravity: 0 });
      if (h.state === 'down' && Math.random() < 0.05) zap.strike(v3.clone().setY(1.1), v3.clone().setY(0), camera, { width: 0.03, jag: 0.4, forks: 0, life: 0.1 });
    }

    // ── the aim: the ring, the throw line, the recall line ──
    const showAim = playing && g.aimX != null;
    aimRing.visible = showAim && h.state === 'held';
    if (aimRing.visible) {
      aimRing.position.set(g.aimX, 0.05, g.aimZ);
      aimRing.position.y = g.aimY && g.aimY > 2 ? g.aimY : 0.05;
      aimRing.rotation.set(g.aimY > 2 ? Math.PI / 2 : 0, 0, 0);
      aimRing.scale.setScalar(1 + Math.sin(clock * 6) * 0.06);
    }
    throwLine.visible = aimRing.visible;
    if (throwLine.visible) {
      const ax = thorX + LAWN.hand.dx;
      const l = Math.hypot(g.aimX - ax, g.aimZ);
      const reach = Math.min(LAWN.range, l);
      placeLine(throwLine, ax, -0.2, ax + ((g.aimX - ax) / l) * reach, ((g.aimZ - 0) / l) * reach, 0.16);
    }
    recallLine.visible = playing && (h.state === 'down' || h.state === 'out');
    if (recallLine.visible) placeLine(recallLine, h.x, h.z, thorX + LAWN.hand.dx, -0.2, 0.2);
    throwLine.material.uniforms.uTime.value = clock;
    recallLine.material.uniforms.uTime.value = -clock;

    // ── the storm ──
    if (!calm) {
      nextStorm -= realDt;
      if (nextStorm <= 0) {
        nextStorm = 6 + Math.random() * 9;
        lightning(0.6 + Math.random() * 0.4);
        // a strike far off, over the trees
        const x = (Math.random() - 0.5) * 300;
        const z = -150 - Math.random() * 150;
        zap.strike(new THREE.Vector3(x, 140, z), new THREE.Vector3(x + (Math.random() - 0.5) * 40, 0, z + 20), camera, { width: 0.6, jag: 0.12, forks: 3, life: 0.5, k: 2.5 });
        stormSound?.();
      }
    }
    flash = Math.max(0, flash - realDt * 3.2);
    const fl = flash > 0 ? flash * (0.55 + 0.45 * Math.sin(clock * 70) ** 2) : 0;
    flashLight.intensity = fl * 7;
    scene.backgroundIntensity = SKY_BG + fl * 1.3;
    sun.intensity = moonI + fl * 0.6;
    hemi.intensity = hemiI + fl * 0.5;
    rain.mat.uniforms.uFlash.value = fl;
    portal.mat.uniforms.uTime.value = clock;
    portal.mat.uniforms.uFlash.value = fl;
    rain.mat.uniforms.uTime.value = clock;

    // ── the camera: in front of him for the lift, then over his shoulder ──
    if (lifting) camBlend = approach(camBlend, 0, 4, realDt);
    else camBlend = Math.min(1, camBlend + realDt / 1.8);
    const k = ease(camBlend);
    const lp = g.phase === 'lift' ? g.lift.progress : 0;
    const tall = camera.aspect < 1.2;
    const front = v3.set(thorX + 2.1 - lp * 0.5, 1.7 - lp * 0.25, -4.6 + lp * 0.9);
    const back = v4.set(thorX * 0.65 + (tall ? 0.6 : 1.7), tall ? 6.4 : 4.7, tall ? 10.5 : 8.4);
    camPos.copy(front).lerp(back, k);
    // a hump in the move, so it swings round him rather than through him
    camPos.x += Math.sin(k * Math.PI) * 4;
    camPos.y += Math.sin(k * Math.PI) * 1.5;
    const lookFront = new THREE.Vector3(thorX, 1.15 - lp * 0.2, -0.4);
    const lookBack = new THREE.Vector3(thorX * 0.45, tall ? 0 : 0.6, tall ? -16 : -19);
    camLook.copy(lookFront).lerp(lookBack, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    feel.update(realDt, camera);
    rain.mat.uniforms.uCenter.value.copy(camera.position);

    zap.update(realDt);
    vfx.update(realDt, camera, engine.size.h);
    engine.render();
  }

  let stormSound = null;

  // the rules' events, as effects
  function fx(events, g) {
    for (const e of events) {
      switch (e.type) {
        case 'lifted': {
          liftedT = 0;
          const top = new THREE.Vector3(CRATER.x, 30, CRATER.z - 6);
          zap.strike(top, new THREE.Vector3(thorX + 0.4, 2.6, 0), camera, { width: 0.14, jag: 0.1, forks: 4, life: 0.7 });
          vfx.sparks(new THREE.Vector3(thorX + 0.4, 2.4, 0), { count: 60, speed: 10, color: 0xdff0ff, to: 0x5aa8ff, life: 0.7, size: 0.12 });
          vfx.ring(new THREE.Vector3(thorX, 0.08, 0), { color: 0x9fd0ff, from: 0.5, to: 6, life: 0.5, opacity: 0.55 });
          vfx.flash(new THREE.Vector3(thorX, 3, 0), { color: 0xbfe0ff, intensity: 120, distance: 30, life: 0.6 });
          lightning(1);
          feel.trauma(0.6);
          feel.punch(4);
          break;
        }
        case 'throw':
          throwT = 0;
          feel.punch(1.5);
          break;
        case 'recall':
          break;
        case 'catch': {
          catchT = 0;
          thor.bones.handR.getWorldPosition(v3);
          vfx.sparks(v3, { count: 18, speed: 5, color: 0xdff0ff, to: 0x5aa8ff, life: 0.35, size: 0.08 });
          feel.trauma(0.12);
          break;
        }
        case 'land': {
          const at = new THREE.Vector3(e.x, 0.1, e.z);
          vfx.smoke(at, { size: 1.2, count: 5, life: 1.2, rise: 0.4, opacity: 0.45, color: 0x3a3a3c, to: 0x6a6a70 });
          vfx.sparks(at, { count: 14, speed: 5, color: 0xdff0ff, to: 0x5aa8ff, life: 0.4, size: 0.08 });
          vfx.debris(at, { count: 8, speed: 4, size: 0.08, color: 0x3a3a2c });
          vfx.ring(at, { color: 0x9fd0ff, from: 0.3, to: 2.2, life: 0.35, opacity: 0.45 });
          break;
        }
        case 'hit':
        case 'kill': {
          const at = new THREE.Vector3(e.x, e.y, e.z);
          flashes.set(e.id, 1);
          vfx.sparks(at, { count: e.type === 'kill' ? 22 : 14, speed: 7, color: 0xdff0ff, to: 0x5aa8ff, life: 0.45, size: 0.1 });
          if (e.type === 'kill') {
            const fig = byId.get(e.id);
            const hm = g.hammer;
            let dx = hm.vx;
            let dz = hm.vz;
            if (e.lightning || Math.hypot(dx, dz) < 1) {
              dx = e.x - (hm.x ?? 0);
              dz = e.z - (hm.z ?? 0);
            }
            const l = Math.hypot(dx, dz) || 1;
            if (fig && e.kind === 'chariot') {
              fig.dying = { t: 0, vx: (last.get(e.id)?.vx ?? 0) * 0.6 };
              fig.id = null;
              byId.delete(e.id);
            } else if (fig) {
              fig.dying = { t: 0, dx: dx / l, dz: dz / l, fall: e.kind === 'cull' ? 1 : 1 };
              fig.id = null;
              byId.delete(e.id);
            }
            vfx.debris(at, { count: e.kind === 'soldier' ? 6 : 12, speed: 6, size: 0.08, color: 0x4d4237 });
            if (e.kind === 'cull') {
              vfx.explode(at, { scale: 1.6, color: 0xffb070 });
              lightning(1);
              feel.trauma(0.7);
            } else feel.trauma(e.multi > 1 ? 0.18 : 0.08);
            feel.hitstop(e.kind === 'cull' ? 160 : e.multi > 2 ? 70 : 30);
          } else if (e.back) {
            feel.trauma(0.25);
            feel.hitstop(60);
          }
          break;
        }
        case 'block': {
          const at = new THREE.Vector3(e.x, e.y, e.z);
          flashes.set(e.id, 1);
          vfx.sparks(at, { count: 40, speed: 9, color: 0xffe0a0, to: 0xff8040, life: 0.5, size: 0.1 });
          vfx.flash(at, { color: 0xffc080, intensity: 40, distance: 10, life: 0.2 });
          feel.trauma(0.2);
          break;
        }
        case 'fire':
          vfx.flash(new THREE.Vector3(e.x, e.y, e.z), { color: BOLT, intensity: 18, distance: 8, life: 0.15 });
          break;
        case 'swat': {
          const at = new THREE.Vector3(e.x, e.y, e.z);
          vfx.sparks(at, { count: 20, speed: 6, color: 0xbff0ff, to: BOLT, life: 0.3, size: 0.08 });
          break;
        }
        case 'deflect':
          vfx.sparks(new THREE.Vector3(e.x, e.y, e.z), { count: 14, speed: 6, color: 0xbff0ff, to: BOLT, life: 0.3, size: 0.08 });
          break;
        case 'hurt':
          feel.trauma(0.45);
          feel.punch(3);
          vfx.sparks(new THREE.Vector3(thorX, 1.3, 0), { count: 18, speed: 5, color: 0xffb0a0, to: 0xff4030, life: 0.35, size: 0.08 });
          break;
        case 'breach': {
          const fig = byId.get(e.id);
          if (fig && !fig.group) {
            fig.dying = { t: 0.3, dx: 0, dz: 0, fall: 0.8 };
            fig.id = null;
            byId.delete(e.id);
          }
          vfx.flash(new THREE.Vector3(e.x, 1, e.z), { color: 0xff4030, intensity: 30, distance: 10, life: 0.3 });
          break;
        }
        case 'lightning': {
          raiseT = 0;
          const at = new THREE.Vector3(e.x, 0.05, e.z);
          zap.strike(new THREE.Vector3(e.x + 6, 80, e.z - 30), at, camera, { width: 0.22, jag: 0.08, forks: 4, life: 0.65 });
          for (const [ax, ay, az, bx, by, bz] of e.arcs) zap.strike(new THREE.Vector3(ax, ay + 0.6, az), new THREE.Vector3(bx, by, bz), camera, { width: 0.07, jag: 0.25, forks: 1, life: 0.5 });
          vfx.ring(at, { color: 0x9fd0ff, from: 0.5, to: LAWN.strike, life: 0.45, opacity: 0.5 });
          vfx.sparks(at, { count: 50, speed: 11, color: 0xdff0ff, to: 0x5aa8ff, life: 0.7, size: 0.12 });
          vfx.smoke(at, { size: 2, count: 6, life: 2, color: 0x2a2a2e, to: 0x55555c, opacity: 0.5 });
          vfx.flash(at.clone().setY(3), { color: 0xbfe0ff, intensity: 140, distance: 40, life: 0.6 });
          // the hammer, raised to the sky, takes a bolt of its own
          if (g.hammer.state === 'held') {
            thor.bones.handR.getWorldPosition(v3);
            zap.strike(new THREE.Vector3(thorX - 4, 70, -30), v3.clone().setY(v3.y + 0.6), camera, { width: 0.1, jag: 0.08, forks: 2, life: 0.45 });
          }
          lightning(1.1);
          feel.trauma(0.55);
          feel.punch(5);
          break;
        }
        case 'roar':
          feel.trauma(0.3);
          break;
        case 'spawn':
          break;
        default:
      }
    }
  }

  // the lawn under a point of the screen, or a chariot near it
  const aimAt = (nx, ny, g) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    for (const e of g?.enemies ?? []) {
      if (e.kind !== 'chariot') continue;
      if (ray.ray.distanceSqToPoint(v3.set(e.x, e.y, e.z)) < 2.6 * 2.6) return { x: e.x, y: e.y, z: e.z, air: true };
    }
    const hit = ray.ray.intersectPlane(plane, v4);
    if (!hit || hit.z > -1) {
      // above the horizon (or behind the line): as far as he can throw, that way
      const d = ray.ray.direction;
      const l = Math.hypot(d.x, d.z) || 1;
      return { x: camera.position.x + (d.x / l) * 44, z: Math.min(-2, camera.position.z + (d.z / l) * 44) };
    }
    return { x: hit.x, z: hit.z };
  };

  const project = (x, y, z) => engine.project(v3.set(x, y, z));

  const resize = (w, h) => {
    engine.resize(w, h);
    const aspect = w / Math.max(1, h);
    fov = aspect < 1.2 ? FOV + (1.2 - aspect) * 30 : FOV;
    feel.setBaseFov(fov);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };

  return {
    engine,
    render,
    fx,
    aimAt,
    project,
    resize,
    timeScale: (dt) => feel.scale(dt),
    snap() {
      snap = true;
    },
    onStorm(fn) {
      stormSound = fn;
    },
    // where Thor's hand is on screen, for the HUD
    thorScreen: () => {
      thor.bones.head.getWorldPosition(v3);
      return engine.project(v3);
    },
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
  };
}
