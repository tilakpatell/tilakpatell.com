// Repulsor Range in 3D: the test field behind the compound at dusk, seen from
// inside the helmet. It draws the rules' state (./rules.js) and turns their
// events into light, sparks and smoke; the HUD is drawn by the page on top.

import * as THREE from 'three';
import { createEngine, hot } from '../hq/engine';
import { pbr, preload } from '../hq/assets';
import { buildCompound, buildGround, fbm, scatter, trees } from '../hq/kit/world';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { canvasTexture, rbox } from '../hq/kit/shapes';
import { createVfx } from '../hq/vfx';
import { createFeel } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { EYE, LANES, PRIME_SCALE } from './rules';
import { boltGeometry, buildGauntlet, discGeometries, droneGeometries, instanced, missileGeometries, plateGeometry, repulsorMaterials } from './models';

const SENTRIES = 6;

// the pad's paint: lane circles, numbers, hazard edges
function padPaint() {
  return canvasTexture(1024, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    // hazard stripes along the front edge
    x.save();
    x.beginPath();
    x.rect(0, 0, w, 34);
    x.clip();
    for (let i = -40; i < w + 40; i += 40) {
      x.fillStyle = '#e8b623';
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 20, 0);
      x.lineTo(i + 54, 34);
      x.lineTo(i + 34, 34);
      x.fill();
    }
    x.restore();
    // a hover circle per lane (the pad is 30 m wide; lanes at -3.5, 0, 3.5)
    LANES.forEach((lx, i) => {
      const cx = w / 2 + (lx / 30) * w;
      const cy = 150;
      x.strokeStyle = 'rgba(240,240,232,0.85)';
      x.lineWidth = 6;
      x.beginPath();
      x.arc(cx, cy, 44, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = 3;
      x.beginPath();
      x.arc(cx, cy, 30, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = 'rgba(240,240,232,0.85)';
      x.font = 'bold 34px Archivo, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(String(i + 1), cx, cy + 1);
    });
    // a centre line and a stencil
    x.fillStyle = 'rgba(232,182,35,0.85)';
    x.fillRect(w / 2 - 3, 220, 6, 260);
    x.fillStyle = 'rgba(240,240,232,0.55)';
    x.font = 'bold 40px Archivo, sans-serif';
    x.textAlign = 'center';
    x.fillText('STARK INDUSTRIES · TEST PAD 3', w / 2, 330);
  });
}

// a range board: "25 M" on painted plywood
function boardTexture(text) {
  return canvasTexture(256, 128, (x, w, h) => {
    x.fillStyle = '#cfcabd';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#b4231b';
    x.fillRect(0, 0, w, 16);
    x.fillRect(0, h - 16, w, 16);
    x.fillStyle = '#1d1f22';
    x.font = 'bold 64px Archivo, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 2);
  });
}

export async function create(canvas, { onLost, onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createEngine(canvas, { exposure: 1.05, fov: 62, near: 0.05, far: 900, bloom: { strength: 0.65, radius: 0.45, threshold: 0.95 }, onLost, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;

  // start every download at once
  const sets = ['grass', 'concrete-worn', 'brushed-steel', 'sci-panels', 'plywood', 'concrete-wall', 'corrugated'];
  await preload({ sets, skies: ['dusk'], models: ['barrier', 'barrel', 'lamp', 'rocks', 'grass-clump', 'shrub'], impostors: ['fir-a', 'fir-b', 'fir-c', 'broadleaf'], small });

  // the sun swung round to the right, so the field is lit from the side
  await engine.setSky('dusk', { rotate: 0.66, sunIntensity: 3.4, envIntensity: 0.85, bgIntensity: 1, fill: 0.08, fog: { near: 90, far: 520, tint: 0.92 } });
  engine.setShadowBox(new THREE.Vector3(0, 0, -32), 46, 140);
  // a soft light from behind you, so what comes at you reads against the sky
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
  fill.position.set(0, 8, 30);
  scene.add(fill);

  // ── the ground ──
  const flat = (x, z) => {
    const k = Math.max((Math.abs(x) - 48) / 50, (-z - 150) / 70, (z - 40) / 40, 0);
    return Math.min(1, k) ** 2;
  };
  const { mesh: ground, heightAt } = await buildGround({ texture: 'grass', tile: 3.2, hill: 22, flat, small, color: 0xc9e3a8, stripes: 6 });
  scene.add(ground);

  // the test pad under you
  const padMat = await pbr('concrete-worn', { repeat: [6, 3], small, roughness: 1, metalness: 0, color: 0xd8d6d0 });
  const pad = new THREE.Mesh(rbox(30, 0.4, 15, 0.12), padMat);
  pad.position.set(0, 0.2, 3.5);
  pad.receiveShadow = true;
  pad.castShadow = true;
  scene.add(pad);
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshStandardMaterial({ map: padPaint(), transparent: true, roughness: 0.75, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  paint.rotation.x = -Math.PI / 2;
  paint.position.set(0, 0.405, 3.5);
  paint.receiveShadow = true;
  scene.add(paint);

  // three concrete test lanes running out from the pad, one per hover position
  const laneMatC = await pbr('concrete-wall', { repeat: [1, 36], small, roughness: 1, metalness: 0, color: 0xd9d6ce });
  for (const x of LANES) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 92), laneMatC);
    strip.position.set(x, 0.03, -50);
    strip.receiveShadow = true;
    scene.add(strip);
  }

  // range lines and boards at 25, 50 and 75 m
  const plywood = await pbr('plywood', { repeat: [1, 1], small, metalness: 0 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.9, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const d of [25, 50, 75]) {
    for (let i = -14; i <= 14; i += 2) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.18), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(i, 0.02, -d);
      scene.add(dash);
    }
    for (const side of [-1, 1]) {
      const board = new THREE.Group();
      const face = new THREE.Mesh(rbox(2.2, 1.1, 0.06, 0.02), [plywood, plywood, plywood, plywood, new THREE.MeshStandardMaterial({ map: boardTexture(`${d} M`), roughness: 0.9, metalness: 0 }), plywood]);
      face.position.y = 2.3;
      const postMat = new THREE.MeshStandardMaterial({ color: 0x3b3f44, metalness: 0.7, roughness: 0.5 });
      for (const px of [-0.8, 0.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 10), postMat);
        post.position.set(px, 1.2, -0.06);
        board.add(post);
      }
      board.add(face);
      board.position.set(side * 15.5, heightAt(side * 15.5, -d), -d);
      board.rotation.y = side * -0.35;
      board.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(board);
    }
  }

  // barriers, barrels and lamps along the sides; rocks, grass and shrubs
  const props = [];
  const barrierPts = [];
  for (const side of [-1, 1])
    for (const z of [-12, -30, -48, -66, -84]) for (let i = 0; i < 3; i++) barrierPts.push([side * (19 + (i % 2) * 0.3), z - i * 1.6, 1, side * (Math.PI / 2) + (i - 1) * 0.04]);
  props.push(scatter('barrier', barrierPts, { heightAt }));
  const barrelPts = [];
  for (const [x, z] of [
    [-21, -20],
    [22, -38],
    [-23, -57],
    [21.5, -76],
    [-17, 9],
    [17, 11],
  ])
    for (let i = 0; i < 3; i++) barrelPts.push([x + (i % 2) * 0.62, z + Math.floor(i / 2) * 0.62, 1, i * 1.3]);
  props.push(scatter('barrel', barrelPts, { heightAt }));
  const lampPts = [];
  for (const side of [-1, 1]) for (const z of [6, -22, -52, -86]) lampPts.push([side * 21.5, z, 1.25, side > 0 ? Math.PI : 0]);
  props.push(scatter('lamp', lampPts, { heightAt }));
  // the lamps' bulbs, lit for dusk
  const bulbMat = new THREE.MeshBasicMaterial({ color: hot(0xffd9a0, 2.2), toneMapped: false });
  for (const [x, z, s] of lampPts) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 12, 8), bulbMat);
    bulb.position.set(x + (x > 0 ? -0.36 : 0.36) * s, heightAt(x, z) + 3.68 * s, z);
    scene.add(bulb);
  }
  const rockNames = ['rock_moss_set_01_rock01', 'rock_moss_set_01_rock02', 'rock_moss_set_01_rock03', 'rock_moss_set_01_rock04', 'rock_moss_set_01_rock05', 'rock_moss_set_01_rock06'];
  const rockSpots = [[], [], [], [], [], []];
  const farRocks = [[], [], [], [], [], []];
  for (let i = 0; i < 36; i++) {
    const a = fbm(i * 3.1, 7.7) * 2 - 1;
    const side = i % 2 ? 1 : -1;
    const x = side * (26 + Math.abs(a) * 40 + (i % 5) * 4);
    const z = 20 - (i / 36) * 170;
    (Math.hypot(x, z + 20) < 60 ? rockSpots : farRocks)[i % 6].push([x, z, 0.8 + (i % 4) * 0.45, i * 1.7]);
  }
  rockNames.forEach((node, k) => {
    if (rockSpots[k].length) props.push(scatter('rocks', rockSpots[k], { heightAt, node, sink: 0.15, tilt: 0.3 }));
    if (farRocks[k].length) props.push(scatter('rocks', farRocks[k], { heightAt, node, sink: 0.15, tilt: 0.3, shadows: false }));
  });
  const grassSpots = [[], [], [], [], []];
  const grassCount = small ? 80 : 200;
  for (let i = 0; i < grassCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (2 + ((i * 7.31) % 36));
    const z = 16 - ((i * 13.7) % 95) * (i % 3 ? 1 : 0.4);
    if (Math.abs(x) < 16 && z > -4.5 && z < 11.5) continue; // not on the pad
    if (LANES.some((lx) => Math.abs(x - lx) < 1.6) && z < -3) continue; // nor on the lanes
    grassSpots[i % 5].push([x, z, 1.5 + (i % 4) * 0.35, i * 2.1]);
  }
  grassSpots.forEach((pts, k) => pts.length && props.push(scatter('grass-clump', pts, { heightAt, node: `grass_medium_02_${'abcde'[k]}`, shadows: false })));
  const shrubPts = [];
  for (let i = 0; i < (small ? 8 : 14); i++) {
    const side = i % 2 ? 1 : -1;
    shrubPts.push([side * (23 + ((i * 5.7) % 18)), 10 - ((i * 11.3) % 120), 3 + (i % 3), i]);
  }
  props.push(scatter('shrub', shrubPts, { heightAt, shadows: false }));
  for (const p of await Promise.all(props)) scene.add(p);

  // the tree line: an arc beyond the range, and along both sides
  // a forest over the hills: clumps and clearings from noise, thickest far
  // out, clear round the compound and the hangar, a few trees nearer in
  const treePts = [];
  const N = small ? 1400 : 2600;
  for (let i = 0; i < N; i++) {
    const a = -1.6 + ((i * 0.6180339) % 1) * 3.2;
    const r = 105 + ((i * 0.7548776) % 1) ** 0.8 * 330;
    const x = Math.sin(a) * r * 1.2 + (fbm(i, 1) - 0.5) * 12;
    const z = -Math.cos(a) * r + 50 + (fbm(1, i) - 0.5) * 12;
    if (z > 30 || (Math.abs(x) < 46 && z > -150)) continue;
    const dense = fbm(x * 0.012 + 3, z * 0.012 - 1);
    const edge = Math.min(1, (r - 105) / 90);
    if (dense * (0.6 + edge * 0.6) < 0.5) continue;
    if (Math.hypot(x + 70, z + 205) < 58 || Math.hypot(x - 95, z + 170) < 42) continue;
    const kind = fbm(x * 0.02 + 5, z * 0.02) > 0.58 ? 3 : i % 3;
    const h = kind === 3 ? 9 + fbm(x, z) * 7 : 14 + fbm(x * 0.07, z * 0.07) * 14;
    treePts.push([x, z, h, kind, i * 2.3]);
  }
  for (const [x, z, k] of [
    [-34, -6, 3],
    [-39, -11, 0],
    [36, -14, 0],
    [41, -9, 2],
    [-40, -34, 1],
    [31, 4, 3],
    [-31, 12, 1],
  ])
    treePts.push([x, z, k === 3 ? 8 : 16, k, x]);
  scene.add(await trees(treePts, { heightAt }));

  // the compound across the field, and a hangar
  const compound = await buildCompound({ small, lights: 0.5 });
  compound.position.set(-70, heightAt(-70, -205), -205);
  compound.rotation.y = 0.32;
  scene.add(compound);
  const corrugated = await pbr('corrugated', { repeat: [10, 3], small, color: 0xc9ccd0 });
  const hangar = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 40, 40, 1, true, Math.PI / 2, Math.PI), corrugated);
  shell.rotation.x = Math.PI / 2;
  shell.material.side = THREE.DoubleSide;
  hangar.add(shell);
  const back = new THREE.Mesh(new THREE.CircleGeometry(14, 40, 0, Math.PI), corrugated);
  back.position.z = -20;
  back.rotation.y = Math.PI;
  hangar.add(back);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.6, roughness: 0.5 });
  const door = new THREE.Mesh(new THREE.CircleGeometry(14, 40, 0, Math.PI), doorMat);
  door.position.z = 20;
  hangar.add(door);
  // the door's frame and the light over it
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5b6168, metalness: 0.8, roughness: 0.4 });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 0.6), frameMat);
  lintel.position.set(0, 9, 20.2);
  hangar.add(lintel);
  for (const x of [-10, 10]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), frameMat);
    post.position.set(x, 4.5, 20.2);
    hangar.add(post);
  }
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: hot(0xffe2b0, 2.5), toneMapped: false }));
  lamp.position.set(0, 9.6, 20.5);
  hangar.add(lamp);
  hangar.position.set(95, heightAt(95, -170), -170);
  hangar.rotation.y = -0.7;
  hangar.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(hangar);

  // ── the enemies ──
  const steel = await pbr('brushed-steel', { repeat: [1, 1], small, metalness: 1, roughness: 0.55, color: 0xdfe3e8, envMapIntensity: 1.2 });
  const gun = await pbr('sci-panels', { repeat: [1, 1], small, metalness: 1, roughness: 0.8, color: 0x3a3f46 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0x6e0a10, metalness: 0.6, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd2a54c, metalness: 1, roughness: 0.28 });
  const mats = repulsorMaterials({ steel, gun, red, gold });

  const drones = instanced(droneGeometries(), mats, 36);
  const missiles = instanced(missileGeometries(), mats, 14);
  const discs = instanced(discGeometries(), mats, 12);
  const bolts = instanced({ bolt: boltGeometry() }, mats, 36, { shadows: false });
  scene.add(drones.group, missiles.group, discs.group, bolts.group);
  // drones flash white when hit
  const droneBody = drones.meshes.find((m) => m.name === 'body');
  for (let i = 0; i < 36; i++) droneBody.setColorAt(i, new THREE.Color(1, 1, 1));

  // sentries: a pool of figures, each with its own glow so it can charge alone
  const sentries = Array.from({ length: SENTRIES }, () => {
    const glow = new THREE.MeshBasicMaterial({ color: hot(0xff2a1a, 2.4), toneMapped: false });
    const body = steel.clone();
    body.emissive = new THREE.Color(0xffffff);
    body.emissiveIntensity = 0;
    const h = buildHumanoid({ style: 'ultron', materials: { body, dark: gun, glow }, scale: 1.05 });
    h.root.visible = false;
    h.glow = glow;
    h.body = body;
    h.id = null;
    scene.add(h.root);
    return h;
  });
  // Ultron Prime: a giant sentry with armour plates on its bones
  const primeGlow = new THREE.MeshBasicMaterial({ color: hot(0xff2a1a, 2.8), toneMapped: false });
  const primeBody = steel.clone();
  primeBody.emissive = new THREE.Color(0xffffff);
  primeBody.emissiveIntensity = 0;
  const prime = buildHumanoid({ style: 'ultron', materials: { body: primeBody, dark: gun, glow: primeGlow }, scale: PRIME_SCALE });
  prime.root.visible = false;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.9, roughness: 0.4, emissive: new THREE.Color(0xff2a1a), emissiveIntensity: 0 });
  // plates sit on the bones, which carry no scale: size and place them by hand
  const plate = (kind, bone, x, y, z) => {
    const m = new THREE.Mesh(plateGeometry(kind), plateMat);
    m.scale.setScalar(prime.scale);
    m.position.set(x * prime.scale, y * prime.scale, z * prime.scale);
    m.castShadow = true;
    prime.bones[bone].add(m);
    return m;
  };
  const plates = {
    shoulderL: plate('shoulder', 'shoulderL', 0.03, 0.07, 0),
    shoulderR: plate('shoulder', 'shoulderR', -0.03, 0.07, 0),
    chestL: plate('chest', 'chest', 0.1, 0.18, 0.14),
    chestR: plate('chest', 'chest', -0.1, 0.18, 0.14),
  };
  scene.add(prime.root);

  // the boss's lane warnings: three strips on the ground
  const laneMat = LANES.map(() => new THREE.MeshBasicMaterial({ color: hot(0xff3020, 1.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const laneStrips = LANES.map((x, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 34), laneMat[i]);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.43, -17);
    scene.add(m);
    return m;
  });

  // ── Iron Man's gauntlets, held in front of the camera ──
  const palmMat = new THREE.MeshBasicMaterial({ color: hot(0xbff4ff, 2.4), toneMapped: false });
  const hands = [buildGauntlet(-1, { red, gold, dark: gun, palm: palmMat }), buildGauntlet(1, { red, gold, dark: gun, palm: palmMat })];
  const handRest = [new THREE.Vector3(-0.34, -0.3, -0.7), new THREE.Vector3(0.34, -0.3, -0.7)];
  hands.forEach((h, i) => {
    h.position.copy(handRest[i]);
    camera.add(h);
  });
  scene.add(camera);
  // the unibeam
  const beamMat = new THREE.MeshBasicMaterial({ color: hot(0xbff4ff, 4), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2), beamMat);
  beamCore.visible = false;
  scene.add(beamCore);

  const vfx = createVfx(scene, { calm, debrisMaterial: steel, ground: 0 });
  // Delayed effects die with the scene, so none fire into a disposed vfx.
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const feel = createFeel({ seed: 5, calm, baseFov: 62 });

  // ── per frame ──
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const flashes = new Map(); // enemy id → seconds of hit flash left
  let clock = 0;
  let camX = 0;
  let lastX = 0;
  const handKick = [0, 0];
  const aimV = new THREE.Vector3(0, 0, -1);
  const ray = new THREE.Raycaster();
  let idleT = 0;

  // the demo the field shows before a run: a few drones on patrol far off
  const demo = Array.from({ length: 5 }, (_, i) => ({ id: -1 - i, kind: i === 4 ? 'sentry' : 'drone', x: 0, y: 6, z: -60, vx: 0, vy: 0, vz: 0, hp: 1, t: 0, seed: i * 1.7 }));
  const demoState = (t) => {
    demo.forEach((d, i) => {
      const a = t * 0.25 + i * 1.3;
      d.x = Math.sin(a) * (18 + i * 3);
      d.z = -55 - i * 9 + Math.cos(a * 0.7) * 10;
      d.y = 6 + Math.sin(a * 1.7) * 1.5 + (d.kind === 'sentry' ? 0 : 2);
      d.vx = Math.cos(a) * 4;
    });
    return demo;
  };

  // sentry ids → figures
  const sentryFor = new Map();
  const figureFor = (id) => {
    if (sentryFor.has(id)) return sentryFor.get(id);
    const free = sentries.find((h) => h.id == null);
    if (!free) return null;
    free.id = id;
    sentryFor.set(id, free);
    return free;
  };

  function render(s, dt, { aim } = {}) {
    const realDt = Math.min(0.05, dt);
    clock += realDt;
    const playing = s && (s.phase === 'wave' || s.phase === 'break');
    const enemies = playing || s?.phase === 'won' || s?.phase === 'lost' ? s.enemies : demoState(clock);
    const px = s?.x ?? 0;

    // camera: at the eye, drifting a little, banking into a strafe
    const vx = (px - lastX) / Math.max(1e-3, realDt);
    lastX = px;
    camX += (px - camX) * Math.min(1, realDt * 30);
    const sway = calm ? 0 : 1;
    camera.position.set(camX + Math.sin(clock * 0.9) * 0.025 * sway, EYE + Math.sin(clock * 1.3) * 0.035 * sway, 0);
    e3.set(-0.06 + Math.sin(clock * 0.7) * 0.004 * sway, 0, -vx * 0.006 * sway);
    camera.rotation.copy(e3);
    feel.update(realDt, camera);

    if (aim) aimV.set(aim.x, aim.y, aim.z).normalize();

    // drones, missiles, discs, bolts
    drones.begin();
    missiles.begin();
    discs.begin();
    bolts.begin();
    const seen = new Set();
    let di = 0;
    for (const e of enemies) {
      if (e.kind === 'drone') {
        // face you, banking into its turn
        v3.set(camX - e.x, EYE - e.y, -e.z).normalize();
        const yaw = Math.atan2(v3.x, v3.z);
        e3.set(-Math.asin(v3.y) * 0.6, yaw, Math.max(-0.6, Math.min(0.6, -(e.vx ?? 0) * 0.08 - Math.sin(clock * 3 + e.seed) * 0.1)), 'YXZ');
        m4.compose(v3.set(e.x, e.y + Math.sin(clock * 4 + (e.seed ?? 0)) * 0.05, e.z), q.setFromEuler(e3), one);
        const f = flashes.get(e.id) ?? 0;
        droneBody.setColorAt(di, new THREE.Color(1 + f * 6, 1 + f * 6, 1 + f * 6));
        drones.set(m4);
        di++;
      } else if (e.kind === 'missile') {
        v3.set(e.vx, e.vy, e.vz).normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3);
        m4.compose(v3.set(e.x, e.y, e.z), q, one);
        missiles.set(m4);
        if (!calm && Math.random() < 0.8) vfx.trail(v3.set(e.x - e.vx * 0.03, e.y - e.vy * 0.03, e.z - e.vz * 0.03), { size: 0.55, life: 0.4 });
        if (!calm && Math.random() < 0.25) vfx.smoke(v3, { size: 0.5, count: 1, life: 1.4, rise: 0.4, opacity: 0.35, spread: 0.1, color: 0x8a8a8c, to: 0xb0b0b4 });
      } else if (e.kind === 'disc') {
        e3.set(0.15, e.t * 9, 0.1);
        m4.compose(v3.set(e.x, e.y, e.z), q.setFromEuler(e3), one);
        discs.set(m4);
      } else if (e.kind === 'sentry') {
        const h = figureFor(e.id);
        if (!h) continue;
        seen.add(h);
        h.root.visible = true;
        h.root.position.set(e.x, e.y - 1.53, e.z);
        h.root.rotation.y = Math.atan2(camX - e.x, -e.z);
        const charging = e.charging > 0 ? 1 - e.charging / 0.9 : 0;
        poseHumanoid(h, { t: clock, mode: 'hover', aim: e.charging > 0 ? Math.min(1, charging * 3) : 0, phase: e.seed, flinch: (flashes.get(e.id) ?? 0) * 2 });
        h.glow.color.copy(hot(0xff2a1a, 2.4 + charging * 6));
        h.body.emissiveIntensity = (flashes.get(e.id) ?? 0) * 2;
        if (charging > 0 && !calm && Math.random() < 0.3) {
          h.bones.handR.getWorldPosition(v3);
          vfx.sparks(v3, { count: 1, speed: 1.5, color: 0xff6040, to: 0xff2010, life: 0.3, size: 0.08, gravity: 0 });
        }
      } else if (e.kind === 'prime') {
        prime.root.visible = true;
        prime.root.position.set(e.x, e.y - 1.46 * PRIME_SCALE, e.z);
        prime.root.rotation.y = Math.atan2(camX - e.x, -e.z);
        const volley = e.volley ? 1 - e.volley.t / 1.25 : 0;
        poseHumanoid(prime, { t: clock, mode: 'hover', aim: volley > 0 ? Math.min(1, volley * 2.5) : 0, speed: 0.7, flinch: (flashes.get(e.id) ?? 0) * 1.4 });
        for (const part of e.parts) if (plates[part.name]) plates[part.name].visible = part.hp > 0;
        const exposed = e.parts.every((p) => p.core || p.hp <= 0);
        primeGlow.color.copy(hot(0xff2a1a, exposed ? 6 + Math.sin(clock * 10) * 2 : 2.8 + volley * 4));
        plateMat.emissiveIntensity = (flashes.get(e.id) ?? 0) * 3;
        primeBody.emissiveIntensity = (flashes.get(e.id) ?? 0) * 1.2;
      }
    }
    for (const b of s?.bolts ?? []) {
      v3.set(b.vx, b.vy, b.vz).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3);
      m4.compose(v3.set(b.x, b.y, b.z), q, one);
      bolts.set(m4);
      if (!calm && Math.random() < 0.5) vfx.trail(v3, { size: 0.32, life: 0.14, color: 0xff4030, to: 0x400000, a: 0.6 });
    }
    drones.end();
    missiles.end();
    discs.end();
    bolts.end();
    if (droneBody.instanceColor) droneBody.instanceColor.needsUpdate = true;
    for (const h of sentries) {
      if (!seen.has(h) && h.id != null) {
        sentryFor.delete(h.id);
        h.id = null;
        h.root.visible = false;
      }
    }
    if (!enemies.some((e) => e.kind === 'prime')) prime.root.visible = false;
    for (const [id, f] of flashes) {
      const n = f - realDt * 6;
      if (n <= 0) flashes.delete(id);
      else flashes.set(id, n);
    }

    // the boss's volley lanes
    const volley = enemies.find((e) => e.kind === 'prime' && e.volley)?.volley;
    laneMat.forEach((m, i) => {
      const on = volley?.lanes.includes(i);
      const target = on ? 0.22 + 0.18 * Math.sin(clock * 22) : 0;
      m.opacity += (target - m.opacity) * Math.min(1, realDt * 14);
    });
    laneStrips.forEach((m) => (m.visible = laneMat[0].opacity > 0.01 || laneMat[1].opacity > 0.01 || laneMat[2].opacity > 0.01));

    // the gauntlets: raised and aimed while firing, lowered when not
    const firing = s?.input?.firing && playing;
    idleT = firing ? 0 : idleT + realDt;
    const lower = Math.min(1, Math.max(0, idleT - 0.8) / 0.5);
    hands.forEach((h, i) => {
      handKick[i] *= Math.exp(-realDt * 14);
      const rest = handRest[i];
      // the firing hand comes up and turns toward the aim; the other stays low
      const up = 1 - lower;
      h.position.set(rest.x + aimV.x * 0.08 * up, rest.y - lower * 0.42 + aimV.y * 0.08 * up, rest.z + handKick[i] * 0.07);
      h.rotation.set(-0.18 - handKick[i] * 0.45 + lower * 0.5 + aimV.y * 0.35, -aimV.x * 0.4 + (i ? -0.3 : 0.3), (i ? -1 : 1) * 0.1);
    });
    palmMat.color.copy(hot(0xbff4ff, 2 + (handKick[0] + handKick[1]) * 5));

    // the unibeam, from just below your eye along your aim
    if (s?.beam) {
      const o = v3.set(camera.position.x, camera.position.y - 0.55, camera.position.z - 0.3);
      beamCore.position.copy(o);
      beamCore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), aimV);
      const k = Math.min(1, s.beam.t / 0.15) * Math.min(1, (1.1 - s.beam.t) / 0.25);
      const w = (0.5 + Math.sin(clock * 50) * 0.05) * k;
      beamCore.scale.set(w, w, 130);
      beamMat.opacity = 0.85 * k;
      beamCore.visible = true;
      if (!calm && Math.random() < 0.6) {
        const at = v3.copy(aimV).multiplyScalar(4 + Math.random() * 60).add(o);
        vfx.sparks(at, { count: 2, speed: 3, color: 0xdff8ff, to: 0x60c8ff, life: 0.3, size: 0.12, gravity: 0 });
      }
      feel.trauma(realDt * 0.6);
    } else beamCore.visible = false;

    vfx.update(realDt, camera, engine.size.h);
    engine.render();
  }

  // the rules' events, as effects
  function fx(events, s) {
    for (const e of events) {
      if (e.type === 'shot') {
        const h = hands[e.hand];
        handKick[e.hand] = 1;
        h.updateMatrixWorld(true);
        const palm = new THREE.Vector3(0, 0.055, -0.05).applyMatrix4(h.matrixWorld);
        let end = new THREE.Vector3(e.x, e.y, e.z);
        // a miss that would go into the ground stops there, in a puff
        if (!e.hit && aimV.y < 0) {
          const t = -EYE / aimV.y;
          if (t < 90) {
            end = new THREE.Vector3(s.x + aimV.x * t, 0.05, aimV.z * t);
            vfx.sparks(end, { count: 8, speed: 4, color: 0xdff8ff, to: 0x6aa8ff, life: 0.35, size: 0.1 });
            vfx.smoke(end, { size: 0.9, count: 2, life: 1.2, rise: 0.6, opacity: 0.35, color: 0x7a746a, to: 0x9a958c });
          }
        }
        vfx.beam(palm, end, { color: 0xbff4ff, width: 0.045, life: 0.09 });
        vfx.sparks(palm, { count: 3, speed: 1.2, color: 0xdff8ff, to: 0x60c8ff, life: 0.12, size: 0.03, gravity: 0 });
      } else if (e.type === 'hit') {
        flashes.set(e.id, 1);
        vfx.sparks(new THREE.Vector3(e.x, e.y, e.z), { count: 14, speed: 6, color: 0xdff8ff, to: 0xffa040, life: 0.4, size: 0.12 });
      } else if (e.type === 'deflect') {
        vfx.sparks(new THREE.Vector3(e.x, e.y, e.z), { count: 10, speed: 5, color: 0xffe0a0, to: 0xff8040, life: 0.3, size: 0.1 });
      } else if (e.type === 'kill') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        if (e.kind === 'disc') {
          vfx.debris(at, { count: 8, speed: 6, size: 0.1 });
          vfx.sparks(at, { count: 20, speed: 7, color: 0xffb070, to: 0xff6020, life: 0.5 });
          vfx.smoke(at, { size: 0.8, count: 3, life: 1, color: 0xf08040, to: 0xd0c0b0, opacity: 0.4 });
        } else if (e.kind === 'prime') {
          vfx.explode(at, { scale: 3 });
          for (let i = 0; i < 5; i++) later(() => vfx.explode(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 2)), { scale: 1.6 }), 120 + i * 140);
          feel.trauma(0.9);
          feel.punch(8);
        } else if (e.kind !== 'plate') {
          vfx.explode(at, { scale: e.kind === 'sentry' ? 1.3 : e.kind === 'missile' ? 0.9 : 0.8 });
          feel.trauma(e.kind === 'sentry' ? 0.3 : 0.15);
        }
        if (e.kind !== 'plate') feel.hitstop(e.kind === 'sentry' ? 45 : 25);
      } else if (e.type === 'plate') {
        const p = plates[e.part];
        if (p) {
          p.getWorldPosition(v3);
          vfx.debris(v3, { count: 10, speed: 8, size: 0.25 });
          vfx.sparks(v3, { count: 30, speed: 9, life: 0.6 });
          vfx.fire(v3, { size: 1.4, count: 5 });
        }
        feel.trauma(0.25);
      } else if (e.type === 'damage') {
        feel.trauma(0.55);
        feel.punch(3);
        feel.hitstop(70);
      } else if (e.type === 'unibeam') {
        feel.punch(6);
      } else if (e.type === 'bolt') {
        vfx.flash(new THREE.Vector3(e.x, e.y, e.z), { color: 0xff3020, intensity: 30, distance: 10, life: 0.2 });
      }
    }
  }

  // the direction through a point of the screen (normalised device coords)
  const aimDir = (nx, ny) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    return { x: ray.ray.direction.x, y: ray.ray.direction.y, z: ray.ray.direction.z };
  };

  // world → screen, for the HUD
  const project = (x, y, z) => engine.project(v3.set(x, y, z));

  const resize = (w, h) => {
    engine.resize(w, h);
    // keep the field in view on tall screens: widen the vertical field of view
    const aspect = w / Math.max(1, h);
    const fov = aspect < 1.2 ? 62 + (1.2 - aspect) * 28 : 62;
    // on a tall screen the hands sit further off, so they don't fill it
    const k = aspect < 1.2 ? 1.35 : 1;
    handRest[0].set(-0.34, -0.3 * k, -0.7 * k);
    handRest[1].set(0.34, -0.3 * k, -0.7 * k);
    feel.setBaseFov(fov);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };

  return {
    engine,
    render,
    fx,
    // how much of a frame the game should advance (hitstop)
    timeScale: (dt) => feel.scale(dt),
    aimDir,
    project,
    resize,
    info: engine.info,
    dispose() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      vfx.dispose();
      engine.dispose();
    },
  };
}

