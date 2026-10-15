// Trick Shot in 3D: Clint's range in a clearing of a misty pine wood, seen
// down the arrow. It draws the rules' state (./rules.js) and turns their
// events into straw, shards, sparks and slow motion; the HUD (the reticle,
// the sight's pins, the score) is drawn by the page on top.

import * as THREE from 'three';
import { createStage, hot } from '../hq/stage';
import { pbr, preload } from '../hq/assets';
import { buildGround, fbm, scatter, trees } from '../hq/kit/world';
import { PartBuilder, canvasTexture, rbox } from '../hq/kit/shapes';
import { instanced } from '../hq/kit/instanced';
import { createVfx } from '../hq/vfx';
import { createFeel, feelGroups } from '../hq/feel';
import { prefersReducedMotion } from '../../../lib/hooks';
import { EYE, ROUNDS, drawCap, shakeOf, targetAt } from './rules';
import { BOSS_EDGE, TRICK_COLORS, arrowGeometries, buildBoss, buildBow, buildFlag, buildStand, clayGeometry, droneGeometries, droneMaterials, faceTexture } from './models';

const ARROW = 0.78; // arrow length, nock to the head's base
const BASE_FOV = 40;
const PITCH = -0.03; // the view's rest, a little below level
const MAX_FLYING = 16;
const MAX_STUCK = 64;
const MAX_CLAYS = 8;
const MAX_DRONES = 4;
const FACE_Z = 0.16; // a boss's face is this far in front of its centre

const ease = (k) => k * k * (3 - 2 * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));

// a distance sign: "30 m" in black on a white board with a purple band
function signTexture(text) {
  return canvasTexture(256, 160, (x, w, h) => {
    x.fillStyle = '#ece8dc';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#5b2d91';
    x.fillRect(0, 0, w, 26);
    x.fillStyle = '#1c1c1f';
    x.font = 'bold 84px Archivo, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 14);
  });
}

// the backstop net: a dark mesh, mostly see-through
function netTexture() {
  return canvasTexture(
    128,
    128,
    (x, w) => {
      x.clearRect(0, 0, w, w);
      x.strokeStyle = 'rgba(30,36,30,0.95)';
      x.lineWidth = 5;
      for (let i = 0; i <= w; i += 32) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i, w);
        x.moveTo(0, i);
        x.lineTo(w, i);
        x.stroke();
      }
    },
    { repeat: [80, 9] },
  );
}

// the lawn's painted lines and numbers, every 10 m out to 70
function lawnLines() {
  return canvasTexture(512, 2048, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const m = h / 80; // 80 m of lawn, from 6 m behind you to 74 m out
    x.fillStyle = 'rgba(245,243,234,0.82)';
    for (let d = 10; d <= 70; d += 10) {
      const y = (d + 6) * m;
      for (let i = 0; i < w; i += 28) x.fillRect(i, y - 3, 18, 6);
    }
    // the shooting line, solid
    x.fillRect(0, 6 * m - 5, w, 10);
  });
}

export async function create(rt, { onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.02, fov: BASE_FOV, near: 0.03, far: 900, bloom: { strength: 0.42, radius: 0.5, threshold: 0.96 }, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;

  // start every download at once
  const sets = ['forest-floor', 'grass', 'hay', 'planks', 'bark', 'brushed-steel', 'leather', 'plywood'];
  await preload({ sets, skies: ['pines'], models: ['stump', 'rocks', 'grass-clump', 'shrub', 'crate'], impostors: ['fir-a', 'fir-b', 'fir-c', 'broadleaf'], small, renderer: engine.renderer });

  // a soft, high light through the mist, from over your left shoulder
  await engine.setSky('pines', { sunDir: [-0.42, 0.82, 0.38], sunIntensity: 1.35, sunColor: [1, 0.96, 0.9], envIntensity: 1.05, bgIntensity: 0.98, fill: 0.08, fog: { density: 0.0088, tint: 1.04 } });
  engine.setShadowBox(new THREE.Vector3(0, 0, -32), 36, 110);

  // ── the ground: the wood's floor, and a mown lawn down the range ──
  const flat = (x, z) => {
    const k = Math.max((Math.abs(x) - 24) / 45, (-z - 96) / 70, (z - 26) / 30, 0);
    return Math.min(1, k) ** 2;
  };
  const { mesh: ground, heightAt } = await buildGround({ size: 760, seg: 170, texture: 'forest-floor', tile: 2.4, hill: 18, flat, small, colorVar: 0.2, color: 0xe6dccb });
  scene.add(ground);

  // the lawn: a sheet of grass over the floor, its edges ragged and soft
  const LW = 34;
  const LZ0 = 8;
  const LZ1 = -84;
  const lawnGeo = new THREE.PlaneGeometry(LW, LZ0 - LZ1, 48, 120).rotateX(-Math.PI / 2).translate(0, 0, (LZ0 + LZ1) / 2);
  const lp = lawnGeo.attributes.position;
  const lawnColors = new Float32Array(lp.count * 4);
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    const z = lp.getZ(i);
    lp.setY(i, heightAt(x, z) + 0.012);
    const edge = Math.min(LW / 2 - Math.abs(x), LZ0 - z, z - LZ1) - (fbm(x * 0.35 + 4, z * 0.35) - 0.5) * 5;
    const a = clamp(edge / 3.5, 0, 1);
    const stripe = Math.floor((x + 100) / 2.6) % 2 ? 1.05 : 0.95;
    const n = 0.9 + fbm(x * 0.08, z * 0.08 + 9) * 0.22;
    lawnColors.set([stripe * n, stripe * n, stripe * n * 0.96, ease(a)], i * 4);
  }
  lawnGeo.setAttribute('color', new THREE.BufferAttribute(lawnColors, 4));
  lawnGeo.computeVertexNormals();
  const lawnMat = await pbr('grass', { repeat: [LW / 2.2, (LZ0 - LZ1) / 2.2], small, vertexColors: true, transparent: true, roughness: 1, metalness: 0, color: 0xb6c79a, normalScale: 1.1 });
  lawnMat.depthWrite = false;
  lawnMat.polygonOffset = true;
  lawnMat.polygonOffsetFactor = -2;
  lawnMat.polygonOffsetUnits = -2;
  const lawn = new THREE.Mesh(lawnGeo, lawnMat);
  lawn.receiveShadow = true;
  lawn.renderOrder = -1;
  scene.add(lawn);
  const lines = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 80).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: lawnLines(), transparent: true, roughness: 0.9, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  lines.position.set(0, 0.03, 6 - 40);
  lines.receiveShadow = true;
  lines.renderOrder = 0;
  scene.add(lines);

  // ── materials ──
  const wood = await pbr('planks', { repeat: [1, 1], small, metalness: 0, roughness: 1, color: 0xb59a7a });
  const darkWood = await pbr('bark', { repeat: [1, 2], small, metalness: 0, roughness: 1, color: 0x8a7a68 });
  const straw = await pbr('hay', { repeat: [1.6, 0.5], small, metalness: 0, roughness: 1, color: new THREE.Color(1.25, 1.16, 0.84), aoMapIntensity: 0.7 });
  // bales: the straw runs along their length
  const baleMat = await pbr('hay', { repeat: [1.2, 1.2], rotation: Math.PI / 2, small, metalness: 0, roughness: 1, color: new THREE.Color(1.3, 1.2, 0.86), aoMapIntensity: 0.7, normalScale: 1.4 });
  // older bales, greyer and darker, mixed in
  const baleOld = baleMat.clone();
  baleOld.color = new THREE.Color(1.0, 0.98, 0.78);
  const twineMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2e, roughness: 1, metalness: 0 });
  // a bale, a little different every time: size, a lean, a sag
  const addBale = (b, x, y, z, ry, seed) => {
    const r = (k) => fbm(seed * 3.7 + k, seed * 1.3 - k) - 0.5;
    const w = 0.98 + r(1) * 0.1;
    const h = 0.5 + r(2) * 0.05;
    const d = 0.62 + r(3) * 0.06;
    const rot = [r(4) * 0.05, ry + r(5) * 0.14, r(6) * 0.05];
    b.add(r(7) > 0.12 ? 'old' : 'straw', rbox(w, h, d, 0.09, 2), { p: [x, y + h / 2, z], r: rot });
    for (const dx of [-0.24, 0.24]) b.add('twine', rbox(0.025, h + 0.006, d + 0.006, 0.01, 1), { p: [x + dx * Math.cos(rot[1]), y + h / 2, z - dx * Math.sin(rot[1])], r: rot });
  };
  const steel = await pbr('brushed-steel', { repeat: [1, 1], small, metalness: 1, roughness: 0.45, color: 0xc9ced6 });
  const plywood = await pbr('plywood', { repeat: [1, 1], small, metalness: 0, roughness: 0.9 });
  const faceTex = faceTexture();

  // the fence down both sides: posts and two rails
  const fence = new PartBuilder();
  for (const side of [-1, 1]) {
    const x = side * 15.5;
    for (let z = 6; z >= -78; z -= 4) {
      fence.add('wood', new THREE.BoxGeometry(0.12, 1.25, 0.12), { p: [x, 0.6, z], r: [0, (z % 3) * 0.1, 0] });
      if (z > -78)
        for (const y of [0.55, 1.0]) fence.add('wood', new THREE.BoxGeometry(0.05, 0.1, 4), { p: [x + side * 0.07, y, z - 2] });
    }
  }
  scene.add(fence.build({ wood: darkWood }));

  // the backstop: poles and a net across the end of the range
  const net = new THREE.Mesh(new THREE.PlaneGeometry(40, 5.2), new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false, color: 0x6d7468 }));
  net.position.set(0, 2.6, -74);
  scene.add(net);
  const poles = new PartBuilder();
  for (let x = -20; x <= 20; x += 8) poles.add('wood', new THREE.CylinderGeometry(0.09, 0.11, 5.6, 10), { p: [x, 2.8, -74] });
  poles.add('wood', new THREE.CylinderGeometry(0.03, 0.03, 40, 6), { p: [0, 5.15, -74], r: [0, 0, Math.PI / 2] });
  scene.add(poles.build({ wood: darkWood }));

  // ── the targets: a boss on an easel, on a rail, on a swing ──
  const targetSets = ROUNDS.map((R) => R.targets.map((t) => makeTarget(t)));
  for (const set of targetSets) for (const tg of set) scene.add(tg.group);

  function makeTarget(t) {
    const group = new THREE.Group();
    const y = t.y ?? 1.25;
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.85, metalness: 0, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0 });
    const boss = buildBoss(t.r, { straw, face: faceMat });
    const holder = new THREE.Group(); // moves with the target; the boss wobbles in it
    holder.add(boss);
    group.add(holder);
    const sign = (text, x, z) => {
      const s = new THREE.Group();
      const board = new THREE.Mesh(rbox(0.62, 0.4, 0.04, 0.01), [plywood, plywood, plywood, plywood, new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.85, metalness: 0 }), plywood]);
      board.position.y = 0.95;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.06), darkWood);
      post.position.y = 0.47;
      s.add(board, post);
      s.position.set(x, heightAt(x, z), z + 0.4);
      s.rotation.y = -x * 0.012;
      s.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      return s;
    };
    const dist = `${Math.round(-t.z)} m`;
    let stand = null;
    if (t.kind === 'board') {
      stand = buildStand(t.r, y, { wood });
      holder.add(stand);
      group.add(sign(dist, t.x + t.r + 0.9, t.z));
    } else if (t.kind === 'mover') {
      // a trolley on a rail
      const lo = Math.min(t.x, t.to) - 1;
      const hi = Math.max(t.x, t.to) + 1;
      const rail = new PartBuilder();
      for (const dz of [-0.42, 0.06]) rail.add('steel', new THREE.CylinderGeometry(0.035, 0.035, hi - lo, 10).rotateZ(Math.PI / 2), { p: [(lo + hi) / 2, 0.1, t.z + dz] });
      for (let x = lo; x <= hi + 0.01; x += 1) rail.add('wood', rbox(0.18, 0.08, 0.8, 0.02), { p: [x, 0.04, t.z - 0.18] });
      group.add(rail.build({ steel, wood: darkWood }));
      const cart = new PartBuilder();
      cart.add('steel', rbox(1.1, 0.1, 0.75, 0.02), { p: [0, 0.22, -0.18] });
      for (const dx of [-0.42, 0.42]) for (const dz of [-0.42, 0.06]) cart.add('dark', new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14).rotateX(Math.PI / 2), { p: [dx, 0.14, dz] });
      holder.add(cart.build({ steel, dark: new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.5, roughness: 0.5 }) }));
      stand = buildStand(t.r, y - 0.27, { wood });
      stand.position.y = 0.27;
      holder.add(stand);
      group.add(sign(dist, hi + 0.8, t.z));
    } else if (t.kind === 'swing') {
      // an A-frame at each end and a beam; the boss hangs on two ropes
      const top = y + 2.6;
      const reach = Math.sin(t.amp) * t.len + t.r * BOSS_EDGE + 0.6;
      const frame = new PartBuilder();
      for (const sd of [-1, 1]) {
        const x = t.x + sd * reach;
        for (const dz of [-1, 1]) {
          const len = Math.hypot(top + 0.1, 1);
          frame.add('wood', rbox(0.13, len, 0.13, 0.02), { p: [x, (top + 0.1) / 2, t.z + dz * 0.5], r: [dz * Math.atan2(1, top + 0.1), 0, 0] });
        }
      }
      frame.add('wood', rbox(reach * 2 + 0.4, 0.16, 0.16, 0.03), { p: [t.x, top + 0.08, t.z] });
      group.add(frame.build({ wood: darkWood }));
      group.add(sign(dist, t.x + reach + 0.8, t.z));
      // the ropes are rebuilt each frame from the pivot to the boss
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8b7a5a, roughness: 1, metalness: 0 });
      group.userData.ropes = [-1, 1].map(() => {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5).translate(0, 0.5, 0), ropeMat);
        r.castShadow = true;
        group.add(r);
        return r;
      });
      group.userData.pivot = new THREE.Vector3(t.x, top, t.z - FACE_Z);
    }
    // the hay wall in front, and a marker pole behind so you know where it is
    if (t.behind) {
      const w = t.behind;
      const bale = new PartBuilder();
      const rows = Math.round(w.h / 0.52);
      let n = 0;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 0.25 : -0.25;
        for (let x = w.x0 + 0.5 + off; x <= w.x1 + 0.3; x += 1.0) addBale(bale, x + (fbm(x * 3, r * 7) - 0.5) * 0.1, r * 0.52, w.z - 0.31 + (fbm(r, x) - 0.5) * 0.12, 0, ++n);
      }
      // a couple fallen at the foot of the wall
      addBale(bale, w.x0 - 0.7, 0, w.z + 0.2, 0.9, 41);
      addBale(bale, w.x1 + 0.6, 0, w.z + 0.4, -0.6, 43);
      group.add(bale.build({ straw: baleMat, old: baleOld, twine: twineMat }));
      const mark = new PartBuilder();
      mark.add('steel', new THREE.CylinderGeometry(0.025, 0.025, 4.1, 8), { p: [t.x, 2.05, t.z - 0.75] });
      group.add(mark.build({ steel }));
      const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.36).translate(0.35, 0, 0), new THREE.MeshStandardMaterial({ color: 0x6a35b0, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 }));
      pennant.position.set(t.x, 3.9, t.z - 0.75);
      group.add(pennant);
      group.userData.pennant = pennant;
      group.add(sign(dist, w.x1 + 0.9, w.z));
    }
    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.visible = false;
    // how it stands before a round starts
    const rest = { ...t, x0: t.x, y, phase: t.x * 0.37, wob: 0 };
    return { group, holder, boss, faceMat, t, y, rest };
  }

  // the clay traps either side, half sunk in the grass
  const trap = new PartBuilder();
  for (const side of [-1, 1]) {
    const x = side * 17.6;
    trap.add('wood', rbox(2.4, 1.1, 2.8, 0.05), { p: [x, 0.5, -29] });
    trap.add('roof', rbox(2.7, 0.12, 3.1, 0.03), { p: [x, 1.12, -29], r: [0, 0, side * -0.12] });
    trap.add('dark', rbox(0.06, 0.28, 1.6, 0.02), { p: [x - side * 1.21, 0.78, -29] });
  }
  scene.add(trap.build({ wood: darkWood, roof: wood, dark: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1, metalness: 0 }) }));

  // ── props: a barrel of spare arrows by you, bales, stumps, rocks, grass ──
  const props = [];
  props.push(scatter('crate', [[-3.4, -6.2, 1.3, 0.3], [-3.9, -7.3, 1.1, -0.2]], { heightAt }));
  props.push(scatter('stump', [[3.4, -6.2, 0.9, 1]], { heightAt, sink: 0.05 }));
  props.push(scatter('stump', [[-11, -17, 1.2, 2], [-12.5, -55, 1.3, 3]], { heightAt, sink: 0.05, shadows: false }));
  const rockNames = ['rock_moss_set_01_rock01', 'rock_moss_set_01_rock02', 'rock_moss_set_01_rock03', 'rock_moss_set_01_rock04', 'rock_moss_set_01_rock05', 'rock_moss_set_01_rock06'];
  const rockPts = rockNames.map(() => []);
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (18 + ((i * 7.3) % 22));
    const z = 6 - ((i * 23.7) % 90);
    rockPts[i % 6].push([x, z, 0.5 + (i % 4) * 0.25, i * 1.9]);
  }
  // only the rocks near you cast shadows; the mist hides the rest
  rockNames.forEach((node, k) => rockPts[k].length && props.push(scatter('rocks', rockPts[k], { heightAt, node, sink: 0.12, tilt: 0.3, shadows: k < 2 })));
  const grassPts = [[], [], [], [], []];
  const grassN = small ? 70 : 130;
  for (let i = 0; i < grassN; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (11 + ((i * 7.31) % 24));
    const z = 8 - ((i * 13.7) % 96);
    grassPts[i % 5].push([x, z, 1.6 + (i % 4) * 0.4, i * 2.1]);
  }
  // a few tufts along the lawn's edge and round the targets' feet
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1;
    grassPts[i % 5].push([side * (14.6 + (i % 3) * 0.3), 4 - i * 2.6, 1.4, i]);
  }
  grassPts.forEach((pts, k) => props.push(scatter('grass-clump', pts, { heightAt, node: `grass_medium_02_${'abcde'[k]}`, shadows: false })));
  const shrubPts = [];
  for (let i = 0; i < (small ? 8 : 14); i++) {
    const side = i % 2 ? 1 : -1;
    shrubPts.push([side * (17 + ((i * 5.7) % 16)), 6 - ((i * 11.3) % 80), 3.5 + (i % 3), i]);
  }
  props.push(scatter('shrub', shrubPts, { heightAt, shadows: false }));
  for (const p of await Promise.all(props)) scene.add(p);

  // hay bales by the shooting line, on the right
  const bales = new PartBuilder();
  for (const [x, z, y, r, seed] of [
    [3.2, -5.2, 0, 0.2, 1],
    [4.3, -5.0, 0, -0.1, 2],
    [3.75, -5.1, 0.51, 0.05, 3],
  ])
    addBale(bales, x, y, z, r, seed);
  scene.add(bales.build({ straw: baleMat, old: baleOld, twine: twineMat }));

  // the wood: dense beyond the fence and the net, thinning toward the lawn
  const treePts = [];
  const N = small ? 1700 : 3200;
  for (let i = 0; i < N; i++) {
    const x = ((i * 0.6180339) % 1) * 420 - 210;
    const z = 60 - ((i * 0.7548776) % 1) * 400;
    const inRange = Math.abs(x) < 19 + fbm(z * 0.05, 3) * 6 && z > -84 - fbm(x * 0.05, 7) * 8;
    if (inRange || (Math.abs(x) < 26 && z > -2)) continue;
    if (fbm(x * 0.03 + 2, z * 0.03 - 5) < 0.36) continue; // clearings
    const kind = fbm(x * 0.02 + 5, z * 0.02) > 0.62 ? 3 : i % 3;
    const h = kind === 3 ? 8 + fbm(x, z) * 6 : 15 + fbm(x * 0.07, z * 0.07) * 16;
    treePts.push([x, z, h, kind, i * 2.3]);
  }
  scene.add(await trees(treePts, { heightAt }));

  // wind flags, one each side
  const cloth = new THREE.MeshStandardMaterial({ color: 0xb3261e, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
  const flags = [
    [-14.2, -22],
    [14.2, -47],
  ].map(([x, z]) => {
    const f = buildFlag({ pole: steel, cloth });
    f.group.position.set(x, heightAt(x, z), z);
    scene.add(f.group);
    return f;
  });

  // ── things that move: arrows, clays, drones ──
  const arrowMats = {
    shaft: new THREE.MeshStandardMaterial({ color: 0x1d1d22, metalness: 0.35, roughness: 0.38 }),
    head: new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 1, roughness: 0.28 }),
    nock: new THREE.MeshStandardMaterial({ color: 0x7b3fc4, metalness: 0.2, roughness: 0.4 }),
    vane: new THREE.MeshStandardMaterial({ color: 0x6a35b0, metalness: 0, roughness: 0.6, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const arrowGeos = { ...arrowGeometries(ARROW), glow: new THREE.SphereGeometry(0.03, 10, 8).translate(0, 0, -ARROW - 0.025) };
  const flying = instanced(arrowGeos, arrowMats, MAX_FLYING, { shadows: false });
  const stuck = instanced(arrowGeos, arrowMats, MAX_STUCK, { noShadow: ['glow', 'vane'] });
  scene.add(flying.group, stuck.group);
  const glowOf = Object.fromEntries(Object.entries(TRICK_COLORS).map(([k, c]) => [k, hot(c, 3)]));
  const noGlow = new THREE.Color(0, 0, 0);
  for (const pool of [flying, stuck]) {
    const g = pool.meshes.find((m) => m.name === 'glow');
    for (let i = 0; i < g.count; i++) g.setColorAt(i, noGlow);
  }

  const clayMat = new THREE.MeshStandardMaterial({ color: 0xe0561c, roughness: 0.55, metalness: 0 });
  const clays = instanced({ clay: clayGeometry() }, { clay: clayMat }, MAX_CLAYS);
  scene.add(clays.group);

  const dMats = droneMaterials();
  const drones = instanced(droneGeometries(), dMats, MAX_DRONES, { noShadow: ['rotor', 'light'] });
  scene.add(drones.group);
  const lightRed = hot(0xff2a2a, 2.6);
  const lightOff = new THREE.Color(0.15, 0.02, 0.02);
  const lightEmp = hot(0x4ab8ff, 3);

  // ── Hawkeye's bow, in your left hand ──
  const bowMats = {
    riser: new THREE.MeshPhysicalMaterial({ color: 0x26242b, metalness: 0.75, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    grip: await pbr('leather', { small, roughness: 1, metalness: 0, color: 0x3a2b24 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x6b3fa0, metalness: 0.9, roughness: 0.3 }),
    limb: new THREE.MeshPhysicalMaterial({ color: 0x1c1b21, metalness: 0.2, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.7 }),
    pin: new THREE.MeshBasicMaterial({ color: hot(0x7dff8a, 2.2), toneMapped: false }),
  };
  const bow = buildBow(bowMats);
  const nocked = new THREE.Group();
  const nockedHead = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 1, roughness: 0.28 });
  const nockedGlow = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [k, g] of Object.entries(arrowGeos)) nocked.add(new THREE.Mesh(g, k === 'head' ? nockedHead : k === 'glow' ? nockedGlow : arrowMats[k]));
  bow.bow.add(nocked);
  const viewModel = new THREE.Group();
  viewModel.add(bow.bow);
  bow.bow.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = false;
    }
  });
  camera.add(viewModel);
  scene.add(camera);
  const restPoint = new THREE.Vector3(0.03, 0.05, -0.01); // where the arrow lies on the riser

  const vfx = createVfx(scene, { calm, ground: 0, debrisMaterial: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.1 }) });
  const feel = createFeel({ seed: 7, calm, baseFov: BASE_FOV, offset: 0.05 });
  // ?debug: the feel's numbers on the one panel (hq/stage's tune)
  engine.tune(feelGroups(feel), 'trickshot');

  // a camera that never moves, for turning the pointer into an aim
  const ref = new THREE.PerspectiveCamera(BASE_FOV, 16 / 9, 0.05, 500);
  ref.position.set(0, EYE, 0);
  ref.rotation.set(PITCH, 0, 0, 'YXZ');
  ref.updateMatrixWorld();
  const ray = new THREE.Raycaster();

  // ── per frame ──
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const v4 = new THREE.Vector3();
  const e3 = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const fwd = new THREE.Vector3(0, 0, -1);
  const UP = new THREE.Vector3(0, 1, 0);
  let clock = 0;
  let baseFov = BASE_FOV;
  let camYaw = 0;
  let camPitch = PITCH;
  let raise = 0; // the bow coming up to shooting position
  let string = 0; // the string's draw as shown (it snaps forward on a loose)
  let kick = 0; // the bow's jump on a loose
  let nockT = 1; // seconds since the last loose (the next arrow comes onto the string)
  let zoom = 1;
  let lastRound = -1;
  let planted = []; // arrows in the ground and the hay: { x, y, z, dir, trick }
  const demoState = { moveT: 0 };

  const placeArrow = (pool, tip, dir, trick, embed = 0) => {
    // the tip at `tip` (pushed `embed` along the flight), pointing along `dir`
    v3.set(dir[0], dir[1], dir[2]).normalize();
    q.setFromUnitVectors(fwd, v3);
    v4.copy(tip).addScaledVector(v3, embed - ARROW - 0.07);
    m4.compose(v4, q, one);
    pool.set(m4, { glow: trick ? glowOf[trick] : noGlow });
  };

  let snap = false; // the next frame jumps straight to where the view is heading
  function render(g, dt, { aim, input = 'mouse' } = {}) {
    const realDt = snap ? 5 : Math.min(0.05, dt);
    snap = false;
    clock += Math.min(0.05, dt);
    const s = g?.s;
    const live = g?.phase === 'live';
    const round = g && s ? g.round : 0;
    if (round !== lastRound) {
      lastRound = round;
      targetSets.forEach((set, i) => set.forEach((tg) => (tg.group.visible = i === round)));
      planted = [];
    }
    demoState.moveT = clock;
    const ms = s ?? demoState;

    // ── the view: turning to the aim as the bow comes up, zooming in on a draw ──
    const drawing = live && s.drawing;
    raise = approach(raise, drawing ? 1 : 0, drawing ? 9 : 2.6, realDt);
    const cap = s ? drawCap(s) : 1;
    const drawK = drawing ? s.draw / cap : 0;
    string = drawing ? approach(string, s.draw, 30, realDt) : approach(string, 0, 40, realDt);
    kick *= Math.exp(-realDt * 9);
    nockT += realDt;
    const a = aim ?? { x: 0, y: Math.sin(PITCH), z: -Math.cos(PITCH) };
    const aYaw = Math.atan2(a.x, -a.z);
    const aPitch = Math.asin(clamp(a.y, -1, 1));
    const halfV = (baseFov * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    // at rest, the view only follows an aim that nears its edge (the mouse never does)
    const lag = (aimV, camV, dz) => camV + Math.sign(aimV - camV) * Math.max(0, Math.abs(aimV - camV) - dz);
    const restYaw = input === 'mouse' ? 0 : lag(aYaw, camYaw, halfH * 0.7);
    const restPitch = input === 'mouse' ? PITCH : lag(aPitch, camPitch, halfV * 0.6);
    const focus = ease(raise) * 0.92;
    camYaw = approach(camYaw, restYaw + (aYaw - restYaw) * focus, 7, realDt);
    camPitch = approach(camPitch, restPitch + (aPitch - restPitch) * focus, 7, realDt);
    const sway = calm ? 0 : 1;
    camera.position.set(Math.sin(clock * 0.8) * 0.01 * sway, EYE + Math.sin(clock * 1.1) * 0.012 * sway, 0);
    // (yaw is positive to the right; three.js turns left for a positive y)
    camera.rotation.set(camPitch + Math.sin(clock * 0.9) * 0.002 * sway, -camYaw, 0, 'YXZ');
    zoom = approach(zoom, 1 + (calm ? 0.35 : 0.8) * ease(clamp(drawK, 0, 1)) * raise, 6, realDt);
    feel.setBaseFov((Math.atan(Math.tan(halfV) / zoom) * 360) / Math.PI);
    feel.update(realDt, camera);

    // ── the bow: lowered at rest, raised and drawn, kicking on a loose ──
    const k = ease(raise);
    const comp = Math.tan(halfV) / Math.tan((camera.fov * Math.PI) / 360); // keep its size on screen through the zoom
    const tall = camera.aspect < 1.2 ? 1.25 : 1;
    const shake = s && drawing ? shakeOf(s) : 0;
    // drawn, the bow sits in the left third, canted away from the view, its
    // arrow parallel to the aim (so it points at the reticle) and below it
    const px = THREE.MathUtils.lerp(-0.3, -0.175, k);
    const py = THREE.MathUtils.lerp(-0.52, -0.095, k);
    const pz = THREE.MathUtils.lerp(-0.85, -0.86, k) + kick * 0.05;
    bow.bow.position.set(px * comp * tall, py * comp * tall, pz * comp * tall);
    bow.bow.rotation.set(THREE.MathUtils.lerp(-0.55, 0, k) - kick * 0.16 + Math.sin(clock * 23) * shake * 2.5, THREE.MathUtils.lerp(0.3, 0, k), THREE.MathUtils.lerp(0.8, 0.24, k) + Math.cos(clock * 19) * shake * 2);
    const nock = bow.setDraw(string);
    nocked.position.copy(nock);
    v3.copy(restPoint).sub(nock).normalize();
    nocked.quaternion.setFromUnitVectors(fwd, v3);
    nocked.visible = !!s && s.arrows > 0 && nockT > 0.35 && g.phase === 'live';
    if (!s) nocked.visible = true;
    const trick = s?.nocked;
    nockedGlow.color.copy(trick ? glowOf[trick] : noGlow);
    nockedHead.color.set(trick ? TRICK_COLORS[trick] : 0xd0d4da);

    // ── targets: movers slide, swings swing, a hit makes a boss shudder ──
    const frozen = !!s && s.emp > 0;
    targetSets[round].forEach((tg, i) => {
      const t = s?.targets[i] ?? tg.rest;
      const p = targetAt(t, ms);
      const wob = t.wob ?? 0;
      tg.holder.position.set(tg.t.kind === 'mover' ? p.x : tg.t.x, 0, tg.t.z);
      if (tg.t.kind === 'swing') {
        tg.boss.position.set(p.x - tg.t.x, p.y, -FACE_Z);
        const pivot = tg.group.userData.pivot;
        tg.group.userData.ropes.forEach((r, j) => {
          const top = v3.set(pivot.x + (j ? 0.3 : -0.3), pivot.y, pivot.z);
          const d = v4.set(p.x + (j ? 0.16 : -0.16), p.y + tg.t.r * BOSS_EDGE * 0.92, pivot.z).sub(top);
          r.position.copy(top);
          r.scale.set(1, d.length(), 1);
          r.quaternion.setFromUnitVectors(UP, d.normalize());
        });
      } else tg.boss.position.set(0, tg.y, -FACE_Z);
      tg.boss.rotation.set(Math.sin(clock * 31) * 0.05 * wob, Math.sin(clock * 37) * 0.07 * wob, 0);
      tg.faceMat.emissive.set(frozen ? 0x4ab8ff : 0xffffff);
      tg.faceMat.emissiveIntensity = wob * 0.35 + (frozen ? 0.06 + 0.04 * Math.sin(clock * 20) : 0);
      const pen = tg.group.userData.pennant;
      if (pen) pen.rotation.y = Math.sin(clock * 3) * 0.3 + (s && s.wind * s.windDir < 0 ? Math.PI : 0);
    });

    // ── arrows in flight, along their velocity ──
    flying.begin();
    for (const ar of s?.flying ?? []) {
      v3.set(ar.vx, ar.vy, ar.vz).normalize();
      placeArrow(flying, v4.set(ar.x, ar.y, ar.z), [v3.x, v3.y, v3.z], ar.trick);
      if (!calm && ar.t > 0.03) {
        const c = ar.trick ? TRICK_COLORS[ar.trick] : 0xf4f1ea;
        vfx.trail(v4.set(ar.x, ar.y, ar.z), { size: ar.trick ? 0.22 : 0.07, life: ar.trick ? 0.35 : 0.18, color: c, to: c, a: ar.trick ? 0.7 : 0.25 });
      }
    }
    flying.end();

    // ── arrows stuck in the boards, the ground and the hay ──
    stuck.begin();
    if (s) {
      for (const st of s.stuck) {
        const t = s.targets[st.target];
        if (!t) continue;
        const p = targetAt(t, s);
        placeArrow(stuck, v4.set(p.x + st.dx, p.y + st.dy, p.z), st.dir ?? [0, -0.05, -1], st.trick, 0.12);
      }
    }
    for (const pl of planted) placeArrow(stuck, v4.set(pl.x, pl.y, pl.z), pl.dir, pl.trick, pl.embed);
    stuck.end();

    // ── clays, spinning as they fly ──
    clays.begin();
    for (const c of s?.clays ?? []) {
      if (!c.alive) continue;
      e3.set(0.25 + Math.atan2(c.vy, 12) * 0.4, clock * 14 + c.id, Math.sign(c.vx) * 0.2);
      m4.compose(v3.set(c.x, c.y, c.z), q.setFromEuler(e3), one);
      clays.set(m4);
    }
    clays.end();

    // ── practice drones: bobbing, banking, their lights blinking ──
    drones.begin();
    for (const d of s?.drones ?? []) {
      if (!d.alive) continue;
      const sag = frozen ? Math.min(1, (4 - s.emp) * 2) * 0.25 : 0;
      e3.set(Math.sin(clock * 1.7 + d.id) * 0.06 + sag * 0.6, Math.sin(clock * 0.3 + d.id) * 0.4, frozen ? Math.sin(clock * 30) * 0.03 : Math.cos(d.phase * 0.7 + d.id) * 0.25);
      m4.compose(v3.set(d.x, d.y - sag + Math.sin(clock * 3 + d.id) * 0.04, d.z), q.setFromEuler(e3), one);
      const blink = Math.sin(clock * 6 + d.id * 2) > 0.2;
      drones.set(m4, { light: frozen ? lightEmp : blink ? lightRed : lightOff });
      if (frozen && !calm && Math.random() < 0.15) vfx.sparks(v3, { count: 2, speed: 2, color: 0xbfe6ff, to: 0x4ab8ff, life: 0.25, size: 0.05, gravity: 0 });
    }
    drones.end();

    // ── wind flags ──
    const wind = s ? s.wind * s.windDir : Math.sin(clock * 0.2) * 0.4;
    flags.forEach((f, i) => f.update(clock + i * 1.3, wind));

    vfx.update(realDt, camera, engine.size.h);
    engine.render();
  }

  // the rules' events, as effects
  function fx(events, g) {
    const s = g.s;
    for (const e of events) {
      if (e.type === 'loose') {
        kick = 1;
        string = 0;
        nockT = 0;
        feel.punch(-1.2);
      } else if (e.type === 'ring') {
        const t = s.targets[e.target];
        const p = targetAt(t, s);
        const st = s.stuck.at(-1);
        const at = new THREE.Vector3(p.x + (st?.dx ?? 0), p.y + (st?.dy ?? 0), p.z + 0.05);
        vfx.smoke(at, { size: 0.32, count: 4, life: 0.9, rise: 0.25, opacity: 0.45, spread: 0.25, color: 0xd9c48a, to: 0xc8b27a });
        vfx.debris(at, { count: 8, speed: 2.4, size: 0.035, life: 1.2, color: 0xd8c07a, dir: new THREE.Vector3(0, 0.3, 1), spread: 0.9 });
        if (e.ring >= 9) {
          vfx.ring(at, { color: e.x ? 0xffd04a : 0xffe7a0, from: 0.15, to: t.r * 2.2, life: 0.45, normal: new THREE.Vector3(0, 0, 1), opacity: 0.9 });
          feel.hitstop(e.x ? 140 : 70);
        }
      } else if (e.type === 'hit' && e.kind === 'clay') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        vfx.debris(at, { count: 16, speed: 7, size: 0.05, life: 1.6, color: 0xe0561c });
        vfx.sparks(at, { count: 10, speed: 5, color: 0xffb070, to: 0xd04010, life: 0.3, size: 0.06 });
        vfx.smoke(at, { size: 0.7, count: 4, life: 1, rise: 0.2, opacity: 0.4, spread: 0.6, color: 0xe08a5a, to: 0xd8c0a8 });
        feel.hitstop(60);
      } else if (e.type === 'hit' && e.kind === 'drone') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        vfx.explode(at, { scale: 0.55 });
        vfx.debris(at, { count: 10, speed: 6, size: 0.06, color: 0x2b2e33 });
        feel.trauma(0.12);
        feel.hitstop(50);
      } else if (e.type === 'blast') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        vfx.explode(at, { scale: 1.25 });
        vfx.debris(at, { count: 14, speed: 9, size: 0.08, color: 0xd8c07a });
        feel.trauma(0.32);
        feel.punch(3);
      } else if (e.type === 'emp') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        vfx.ring(at, { color: 0x4ab8ff, from: 0.3, to: 26, life: 0.9, normal: new THREE.Vector3(0, 0, 1), opacity: 1 });
        vfx.ring(at, { color: 0x9fdcff, from: 0.3, to: 18, life: 0.7, normal: new THREE.Vector3(0, 1, 0), opacity: 0.8 });
        vfx.sparks(at, { count: 40, speed: 9, color: 0xdff4ff, to: 0x4ab8ff, life: 0.6, size: 0.1, gravity: 0 });
        vfx.flash(at, { color: 0x4ab8ff, intensity: 50, distance: 20, life: 0.5 });
        feel.punch(2);
      } else if (e.type === 'wall') {
        const at = new THREE.Vector3(e.x, e.y, e.z);
        vfx.smoke(at, { size: 0.5, count: 5, life: 1.1, rise: 0.3, opacity: 0.5, spread: 0.4, color: 0xd9c48a, to: 0xc8b27a });
        vfx.debris(at, { count: 6, speed: 2.5, size: 0.035, color: 0xd8c07a, dir: new THREE.Vector3(0, 0.4, 1) });
        planted.push({ x: e.x, y: e.y, z: e.z, dir: e.dir, trick: null, embed: 0.25 });
      } else if (e.type === 'miss' && e.ground) {
        const at = new THREE.Vector3(e.x, 0.02, e.z);
        vfx.smoke(at, { size: 0.45, count: 3, life: 1, rise: 0.25, opacity: 0.35, spread: 0.3, color: 0x7a6a52, to: 0x9a8c74 });
        planted.push({ x: e.x, y: 0, z: e.z, dir: e.dir, trick: null, embed: 0.18 });
      } else if (e.type === 'clay') {
        const c = s.clays.at(-1);
        if (c) vfx.smoke(new THREE.Vector3(c.x, 0.8, c.z), { size: 0.8, count: 4, life: 1.2, rise: 0.8, opacity: 0.35, spread: 0.6, color: 0xc8c2b4, to: 0xdcd8d0 });
      } else if (e.type === 'round') {
        planted = [];
        lastRound = -1;
        vfx.clear();
      }
    }
    if (planted.length > 28) planted = planted.slice(-28);
  }

  // the aim through a point of the screen (normalised device coordinates),
  // through the camera that doesn't move
  const aimAt = (nx, ny) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), ref);
    const d = ray.ray.direction;
    return { x: d.x, y: d.y, z: d.z };
  };

  // world → screen, for the HUD
  const project = (x, y, z) => engine.project(v3.set(x, y, z));

  const resize = (w, h) => {
    engine.resize(w, h);
    // keep the range in view on tall screens: widen the vertical field of view
    const aspect = w / Math.max(1, h);
    baseFov = aspect < 1.2 ? BASE_FOV + (1.2 - aspect) * 32 : BASE_FOV;
    ref.fov = baseFov;
    ref.aspect = aspect;
    ref.updateProjectionMatrix();
    feel.setBaseFov(baseFov);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  };

  return {
    engine,
    render,
    fx,
    timeScale: (dt) => feel.scale(dt),
    aimAt,
    project,
    resize,
    // radians of aim per CSS pixel at the current zoom, for dragging an aim
    radPerPx: () => ((camera.fov * Math.PI) / 180) / Math.max(1, engine.size.h),
    get zoom() {
      return zoom;
    },
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
