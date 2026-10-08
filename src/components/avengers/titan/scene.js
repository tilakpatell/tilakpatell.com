// Titan in 3D: the Infinity Gauntlet raised against the dusk over Thanos's
// ruined world, the back of the hand to us, every socket in sight. Stones are
// set into it one by one; with all six it snaps, and the light goes white. If
// they were all taken back by playing, it's Tony's snap instead: a cut to
// Thanos on the plateau, turning to dust.

import * as THREE from 'three';
import { createEngine } from '../hq/engine';
import { pbr, preload } from '../hq/assets';
import { buildGround, fbm } from '../hq/kit/world';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { createVfx } from '../hq/vfx';
import { createFeel } from '../hq/feel';
import { lightningPool } from '../lawn/models';
import { loadMeshy, meshyFigure } from '../smash/meshy';
import { STONES } from '../../interests/stones';
import { SOCKETS, THANOS_JOINTS, buildGauntlet, engravingNormal, rubbleGeometry, spireGeometry, thanosStyle, titanSky } from './models';

const SCALE = 1.45;
const FOV = 40;
const SUN = new THREE.Vector3(-0.35, 0.12, -1).normalize();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => k * k * (3 - 2 * k);

// Thanos turning to dust: fragments burn away where noise falls under the
// threshold, an ember edge just ahead of it.
function dusty(mat, dustU) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uDust = dustU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDustPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDustPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDustPos;
        uniform float uDust;
        float dHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float dNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dustN = dNoise(vDustPos * 9.0) * 0.6 + dNoise(vDustPos * 23.0) * 0.4;
        // it goes from the hand that snapped, outward, and from the top down a little
        float dustEdge = dustN + vDustPos.y * 0.05 - uDust * 1.35;
        if (uDust > 0.0 && dustEdge < 0.0) discard;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uDust > 0.0) totalEmissiveRadiance += vec3(1.0, 0.45, 0.15) * smoothstep(0.08, 0.0, dustEdge) * 2.5;`,
      );
  };
  mat.customProgramCacheKey = () => `dust-${prev ? 'p' : ''}`;
  return mat;
}

export async function create(canvas, { onLost, onSlow, calm = false, meshy, invalidate } = {}) {
  const engine = createEngine(canvas, { exposure: 0.92, fov: FOV, near: 0.05, far: 3000, bloom: { strength: 0.55, radius: 0.45, threshold: 1.6 }, onLost, onSlow, invalidate });
  const { scene, camera, hemi } = engine;
  const small = engine.small;
  await preload({ sets: ['rock', 'leather', 'carbon', 'concrete-worn'], skies: ['dusk'], small, backgrounds: false, renderer: engine.renderer });

  // a low sun behind the haze, ahead of him: he's lit from the front and
  // stands against the light; a cool fill from the violet sky above
  await engine.setSky('dusk', { background: false, envIntensity: 0.28, sunDir: SUN.toArray(), sunIntensity: 3, sunColor: [1, 0.66, 0.4], fill: 0.0, fog: { color: 0xc07a4e, density: 0.0028 } });
  hemi.color.set(0x7a5a86);
  hemi.groundColor.set(0x2a1812);
  hemi.intensity = 0.32;
  const rim = new THREE.DirectionalLight(0xffa860, 2.2); // the haze's light, catching his edges
  rim.position.set(4, 2, -6);
  scene.add(rim);
  engine.setShadowBox(new THREE.Vector3(0, 0, -2), 9, 60);
  const sky = titanSky(SUN);
  scene.add(sky.mesh);

  // ── the ground: a broken plateau, falling away into the plains ──
  const flat = (x, z) => {
    const d = Math.hypot(x, z + 4);
    return clamp((d - 14) / 40, 0, 1);
  };
  const { mesh: ground, heightAt } = await buildGround({ size: 1400, seg: small ? 110 : 160, texture: 'rock', tile: 7, hill: 26, flat, small, color: 0xc0866a, colorVar: 0.3 });
  ground.position.y = -0.02;
  ground.material.roughnessMap = null; // the rock's own map is too glossy at this low sun
  ground.material.roughness = 0.98;
  ground.material.needsUpdate = true;
  scene.add(ground);
  // the drop at the edge of the plateau: the plains are far below
  const drop = (x, z) => (z < -26 ? Math.min(70, (-26 - z) * 1.8) * (0.6 + 0.4 * fbm(x * 0.02, z * 0.02)) : 0);
  const groundY = (x, z) => heightAt(x, z) - drop(x, z);
  {
    const a = ground.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) a.setY(i, a.getY(i) - drop(a.getX(i), a.getZ(i)));
    a.needsUpdate = true;
    ground.geometry.computeVertexNormals();
  }

  const rockMat = await pbr('rock', { repeat: [2, 2], small, roughness: 0.95, metalness: 0, color: 0xa87058 });
  // spires of rock out on the plains, standing in the haze
  const spireKinds = [spireGeometry(1, 1), spireGeometry(2.3, 1), spireGeometry(4.1, 1)];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const spots = [];
  for (let i = 0; i < 24; i++) {
    const a = -Math.PI / 2 + (i / 24 - 0.5) * 2.4 + Math.sin(i * 7.7) * 0.06;
    const r = 380 + ((i * 97) % 700);
    spots.push([Math.cos(a) * r, Math.sin(a) * r, 60 + ((i * 53) % 150)]);
  }
  spireKinds.forEach((g, k) => {
    const list = spots.filter((_, i) => i % 3 === k);
    const mesh = new THREE.InstancedMesh(g, rockMat, list.length);
    list.forEach(([x, z, h], i) => {
      const w = h * (0.1 + ((i * 0.37) % 0.08));
      m4.compose(v3.set(x, groundY(x, z) - 4, z), q.setFromEuler(new THREE.Euler(0, i * 1.7, 0)), new THREE.Vector3(w, h, w));
      mesh.setMatrixAt(i, m4);
    });
    scene.add(mesh);
  });
  // fallen blocks and the stumps of columns round him, off to the sides
  const rubble = rubbleGeometry(3);
  const near = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    near.push([side * (3.5 + (i % 5) * 2.4), -2 - ((i * 3.7) % 18), 0.25 + (i % 4) * 0.22]);
  }
  const blocks = new THREE.InstancedMesh(rubble, rockMat, near.length);
  near.forEach(([x, z, s], i) => {
    m4.compose(v3.set(x, groundY(x, z) + s * 0.2, z), q.setFromEuler(new THREE.Euler(i, i * 0.7, 0)), new THREE.Vector3(s, s * 0.8, s));
    blocks.setMatrixAt(i, m4);
  });
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  scene.add(blocks);
  // the broken moon: rubble hanging in the sky, slowly turning
  // against the bright haze the debris is near-silhouette: unfogged, dark
  const debrisMat = rockMat.clone();
  debrisMat.fog = false;
  debrisMat.color = new THREE.Color(0x4a3028);
  const DEBRIS = small ? 40 : 90;
  const debris = new THREE.InstancedMesh(rubbleGeometry(7, 2), debrisMat, DEBRIS);
  const drift = Array.from({ length: DEBRIS }, (_, i) => {
    const a = -Math.PI / 2 + (i / DEBRIS - 0.5) * 2.6 + Math.sin(i * 12.9) * 0.2;
    const r = 420 + (i % 9) * 90;
    return { x: Math.cos(a) * r, y: 90 + ((i * 37) % 300), z: Math.sin(a) * r, s: 2 + ((i * 13) % 11) * (i % 7 === 0 ? 2.5 : 1), spin: (i % 2 ? 1 : -1) * (0.02 + (i % 5) * 0.01), ph: i };
  });
  scene.add(debris);

  // ── Thanos ──
  const dustU = { value: 0 };
  const skin = await pbr('leather', { repeat: [6, 6], small, roughness: 0.6, metalness: 0, color: 0x76607e, normalScale: 0.35 });
  skin.map = null; // his skin's own purple, the leather's relief only
  const suit = await pbr('carbon', { repeat: [4, 4], small, roughness: 0.75, metalness: 0.1, color: 0x1c2232 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd7a540, metalness: 1, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17161a, roughness: 0.6, metalness: 0.3 });
  const thanosMats = { skin: dusty(skin, dustU), suit: dusty(suit, dustU), gold: dusty(gold, dustU), dark: dusty(dark, dustU) };
  const thanos = buildHumanoid({ style: thanosStyle, joints: THANOS_JOINTS, materials: thanosMats, scale: SCALE });
  thanos.root.rotation.y = Math.PI; // facing the horizon (−z)
  // Meshy's Thanos, if he's been made (scripts/meshy.mjs <step> hq): he stands
  // where the built one would, the gauntlet on his left forearm
  const M = await loadMeshy({ manifest: meshy }).catch(() => ({}));
  const mt = M.thanos ? meshyFigure(M.thanos, { h: 2.8 }) : null;
  if (mt) {
    mt.root.rotation.y = Math.PI;
    for (const m of mt.materials) dusty(m, dustU);
    scene.add(mt.root);
  } else scene.add(thanos.root);

  // the gauntlet on his left forearm
  const stoneMats = Object.fromEntries(
    STONES.map((s) => [
      s.id,
      dusty(new THREE.MeshPhysicalMaterial({ color: s.dark, emissive: new THREE.Color(s.color), emissiveIntensity: 0, roughness: 0.22, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.15, flatShading: true, envMapIntensity: 0.35 }), dustU),
    ]),
  );
  const engraved = engravingNormal();
  engraved.wrapS = engraved.wrapT = THREE.RepeatWrapping;
  engraved.repeat.set(3, 2);
  const gauntletGold = dusty(new THREE.MeshPhysicalMaterial({ color: 0xc8962f, metalness: 1, roughness: 0.34, clearcoat: 0.25, clearcoatRoughness: 0.3, normalMap: engraved, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.75, envMap: scene.environment }), dustU);
  const gauntletDark = dusty(new THREE.MeshStandardMaterial({ color: 0x2a1a06, metalness: 0.85, roughness: 0.55 }), dustU);
  const gauntlet = buildGauntlet({ gold: gauntletGold, dark: gauntletDark }, stoneMats);
  gauntlet.group.scale.setScalar(SCALE * 1.15);
  // It's held up on its own in front of the plateau, fingers to the sky and
  // the back of the hand to the camera (it's built pointing down the arm,
  // its back to +x): `stand` turns it upright, `rig` sways it a touch.
  const STAND = new THREE.Vector3(0, 2.4, 1.2);
  const TURN = -0.28; // turned a little, the thumb towards us
  const rig = new THREE.Group();
  rig.position.copy(STAND);
  const stand = new THREE.Group();
  stand.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
  stand.add(gauntlet.group);
  // the cuff's lower end sits at the stand, the hand above it
  gauntlet.group.position.set(0, 0, 0);
  rig.add(stand);
  scene.add(rig);
  // a warm key from the front and above, so the gold and the stones read
  // against the light (the low sun behind it rims the edges)
  const key = new THREE.DirectionalLight(0xffe9d2, 2.6);
  key.position.copy(STAND).add(new THREE.Vector3(-1.6, 2.2, 3.2));
  key.target = rig;
  scene.add(key);
  // the stones' light on the gold: one soft light at the back of the hand,
  // its colour the mix of what's set
  const handLight = new THREE.PointLight(0xffffff, 0, 1.4, 2);
  handLight.position.set(0.12, -0.1, 0);
  gauntlet.wrist.add(handLight);
  const mixC = new THREE.Color();

  const vfx = createVfx(scene, { calm, maxSparks: 900, maxPuffs: 320, maxDebris: 40 });
  const zap = lightningPool(scene, 8);
  const feel = createFeel({ seed: 9, calm, baseFov: FOV, offset: 0.05 });

  // dust in the air, drifting
  const MOTES = small ? 300 : 700;
  const motePos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) motePos.set([(Math.random() - 0.5) * 30, Math.random() * 12, -Math.random() * 30 + 6], i * 3);
  const motes = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(motePos, 3)),
    new THREE.PointsMaterial({ color: 0xffc89a, size: 0.035, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true }),
  );
  scene.add(motes);

  // ── state ──
  let clock = 0;
  const popFx = [];
  const set = new Set();
  const pop = {}; // stone → seconds since it was set
  let snapT = -1; // seconds into a snap, or -1
  let tony = false;
  let dustT = -1; // seconds into his turning to dust
  let onSnapped = null;
  let fov = FOV;
  const tmp = new THREE.Vector3();

  let first = true; // stones already set when it opens just sit there
  function setStones(list) {
    for (const id of SOCKETS) {
      const on = list.includes(id);
      if (on && !set.has(id)) {
        set.add(id);
        if (!first) {
          pop[id] = 0;
          popFx.push(id); // sparks once the hand is posed this frame
        }
      }
      if (!on) set.delete(id);
      gauntlet.stones[id].visible = on;
    }
    first = false;
  }

  // ── his pose ──
  // he's seen only in the wide shot after Tony's snap: standing, arms down,
  // looking out at the haze
  function poseMeshy(dt) {
    mt.set('idle');
    mt.update(dt);
  }

  function pose(dt) {
    const b = thanos.bones;
    poseHumanoid(thanos, { t: clock, mode: 'idle', speed: 1 });
    const breathe = Math.sin(clock * 1.1);
    b.hips.position.y = thanos.rest.hips.y;
    b.chest.rotation.x = -0.04 + breathe * 0.012;
    b.spine.rotation.y = 0.12;
    b.head.rotation.set(-0.12 + breathe * 0.01, 0.1, 0);
    b.neck.rotation.set(-0.05, 0.1, 0);
    // feet apart, his weight on the right
    b.thighL.rotation.set(-0.12, 0, 0.1);
    b.thighR.rotation.set(0.08, 0, -0.12);
    b.kneeL.rotation.x = 0.18;
    b.kneeR.rotation.x = 0.08;
    // the right arm down, the fist loose
    b.shoulderR.rotation.set(0.05, 0, -0.16);
    b.elbowR.rotation.set(-0.25, 0, 0);
    b.shoulderL.rotation.set(0.05, 0, 0.16);
    b.elbowL.rotation.set(-0.25, 0, 0);
    if (mt) poseMeshy(dt);
    // the gauntlet: held still (the sockets have buttons on them), a slow
    // breath of a sway, a lift into the snap
    const s = snapT >= 0 ? snapT : 99;
    const lift = s < 0.35 ? ease(s / 0.35) : s < 1.6 ? 1 : 1 - ease(clamp((s - 1.6) / 0.8, 0, 1));
    rig.rotation.set(0, TURN + (calm ? 0 : Math.sin(clock * 0.3) * 0.018), 0);
    rig.position.set(STAND.x, STAND.y + (calm ? 0 : Math.sin(clock * 0.45) * 0.004) + lift * 0.05, STAND.z);
    gauntlet.wrist.rotation.set(0, 0, -0.06 - lift * 0.1);
    // the fingers: open and a little curled; the snap's press and release
    const F = gauntlet.fingers;
    const open = [0.12, 0.18, 0.12];
    const press = s < 0.4 ? ease(s / 0.4) : s < 0.48 ? 1 - (s - 0.4) / 0.08 : 0;
    const flick = s >= 0.4 && s < 1.6 ? 1 : s >= 1.6 && s < 2.2 ? 1 - (s - 1.6) / 0.6 : 0;
    for (const [name, segs] of Object.entries(F)) {
      segs.forEach((seg, i) => {
        let curl = open[i] + Math.sin(clock * 0.9 + i + name.length) * 0.02;
        if (name === 'middle') curl += press * [0.35, 0.5, 0.3][i] + flick * [1.1, 1.0, 0.6][i];
        else if (name !== 'index') curl += (press + flick) * [0.7, 0.9, 0.6][i];
        else curl += press * 0.3 + flick * 0.25;
        seg.rotation.z = -curl;
      });
    }
    gauntlet.thumb.forEach((seg, i) => (seg.rotation.z = -(0.1 + press * [0.5, 0.35, 0.2][i] + flick * 0.15)));
    // the stones glow, more when all six are set, blinding at the snap
    const all = set.size === SOCKETS.length;
    const surge = snapT >= 0 ? Math.max(0, 1 - Math.abs(snapT - 0.44) / 0.3) : 0;
    for (const st of STONES) {
      const on = set.has(st.id);
      if (pop[st.id] != null) pop[st.id] += dt;
      const p = pop[st.id] ?? 9;
      const k = on ? 1 + (p < 0.6 ? (1 - p / 0.6) * 1.2 : 0) : 0;
      const pulse = 0.85 + 0.15 * Math.sin(clock * 3 + st.id.length);
      stoneMats[st.id].emissiveIntensity = (on ? (all ? 1.5 : 1.25) * pulse : 0) * k + surge * 4;
      gauntlet.stones[st.id].scale.setScalar(on ? 1 + (p < 0.3 ? Math.sin((p / 0.3) * Math.PI) * 0.5 : 0) : 1);
    }
    mixC.setRGB(0, 0, 0);
    for (const st of STONES) if (set.has(st.id)) mixC.add(new THREE.Color(st.color).multiplyScalar(1 / Math.max(1, set.size)));
    handLight.color.copy(mixC);
    handLight.intensity = set.size ? 0.15 + set.size * 0.04 + surge * 6 : 0;
    // with all six, the gauntlet crackles
    if (all && !calm && snapT < 0 && dustT < 0 && Math.random() < dt * 2.2) {
      const ids = [...set];
      const a = gauntlet.sockets[ids[Math.floor(Math.random() * ids.length)]].getWorldPosition(new THREE.Vector3());
      const c = gauntlet.sockets[ids[Math.floor(Math.random() * ids.length)]].getWorldPosition(new THREE.Vector3());
      if (a.distanceTo(c) > 0.02) zap.strike(a, c, camera, { width: 0.012, jag: 0.5, forks: 0, life: 0.12, color: 0xd8c8ff, k: 3 });
    }
  }

  // ── the camera ──
  // close: square on to the back of the hand, a little below it, the hand
  // filling the frame and the cuff running out of the bottom; wide (a cut, on
  // Tony's snap): behind Thanos on the plateau as he turns to dust
  const wristW = new THREE.Vector3();
  const tipW = new THREE.Vector3();
  let frame = null; // { center, dist, len }, from the open hand
  function frameHand() {
    rig.updateMatrixWorld(true);
    gauntlet.wrist.getWorldPosition(wristW);
    gauntlet.fingers.middle.at(-1).getWorldPosition(tipW);
    const len = wristW.distanceTo(tipW) + 0.08;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // from a little below the wrist to just over the fingertips, and the hand's width
    const H = len * 1.5;
    const W = len * 1.15;
    const dist = Math.max(H / 2 / Math.tan(vfov / 2), W / 2 / Math.tan(hfov / 2));
    const center = wristW.clone().lerp(tipW, 0.48);
    center.x = STAND.x;
    center.z = STAND.z;
    frame = { center, dist, len };
  }
  const widePos = new THREE.Vector3();
  const wideLook = new THREE.Vector3();
  function placeCamera(dt) {
    if (!frame) frameHand();
    const tall = camera.aspect < 1;
    if (dustT >= 0) {
      widePos.set(-2.6, 1.9, 7.8 + (tall ? 3 : 0));
      wideLook.set(-0.6, 2.4, -3);
      camera.position.copy(widePos);
      camera.lookAt(wideLook);
    } else {
      const { center, dist, len } = frame;
      camera.position.set(center.x + Math.sin(clock * 0.21) * 0.006, center.y - len * 0.22 + Math.sin(clock * 0.17) * 0.004, center.z + dist);
      camera.lookAt(center.x, center.y, center.z);
    }
    feel.update(dt, camera);
  }

  function snapFx() {
    gauntlet.wrist.getWorldPosition(tmp);
    vfx.flash(tmp, { color: 0xfff4e6, intensity: 9, distance: 2.5, life: 0.5 });
    vfx.ring(tmp.clone(), { color: 0xfff2e0, from: 0.1, to: 3.5, life: 0.8, normal: camera.position.clone().sub(tmp).normalize(), opacity: 0.55 });
    vfx.sparks(tmp, { count: 90, speed: 2.5, color: 0xffffff, to: 0xffd08a, life: 0.8, size: 0.025, gravity: 0 });
    for (const id of set) {
      const a = gauntlet.sockets[id].getWorldPosition(new THREE.Vector3());
      zap.strike(a, a.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, Math.random() * 0.22, (Math.random() - 0.5) * 0.25)), camera, { width: 0.004, jag: 0.5, forks: 0, life: 0.25, color: STONES.find((s) => s.id === id).color, k: 4 });
    }
    feel.trauma(0.5);
    feel.punch(3);
  }

  function dustFx(dt) {
    if (dustT < 0) return;
    dustT += dt;
    dustU.value = clamp(dustT / 5, 0, 1.05);
    if (calm) return;
    // ash from wherever he's still standing, blown off to the side
    const bones = Object.values(mt ? mt.bones : thanos.bones).filter(Boolean);
    for (let i = 0; i < 3; i++) {
      const b = bones[Math.floor(Math.random() * bones.length)];
      b.getWorldPosition(tmp);
      tmp.x += (Math.random() - 0.5) * 0.4;
      tmp.z += (Math.random() - 0.5) * 0.4;
      if (Math.random() < dustU.value * 1.5) vfx.smoke(tmp, { size: 0.5, count: 1, life: 2.2, rise: 0.6, opacity: 0.55, color: 0x4a3a34, to: 0x8a7a70, spread: 0.3 });
      vfx.sparks(tmp, { count: 2, speed: 0.6, color: 0xffb070, to: 0x3a2a24, life: 1.6, size: 0.03, gravity: -0.6, dir: new THREE.Vector3(1, 0.4, 0.2), spread: 0.5 });
    }
  }

  function render(dt) {
    const d = Math.min(0.05, dt);
    clock += d;
    if (snapT >= 0) {
      const before = snapT;
      snapT += d * feel.scale(d);
      if (before < 0.44 && snapT >= 0.44) {
        snapFx();
        onSnapped?.(tony);
      }
      // Tony's: once the flash has gone, cut to Thanos
      if (tony && before < 1.05 && snapT >= 1.05) dustT = 0;
      if (snapT > 2.4) snapT = -1;
    }
    pose(d);
    if (popFx.length) {
      (mt ? mt.root : thanos.root).updateMatrixWorld(true);
      for (const id of popFx.splice(0)) {
        gauntlet.sockets[id].getWorldPosition(tmp);
        const c = STONES.find((st) => st.id === id).color;
        vfx.sparks(tmp, { count: 12, speed: 0.9, color: 0xffffff, to: c, life: 0.35, size: 0.02, gravity: 0 });
        vfx.flash(tmp, { color: c, intensity: 5, distance: 2.5, life: 0.4 });
      }
    }
    dustFx(d);
    // the gauntlet in the close shot; Thanos in the wide one, and when he's
    // gone, back to the gauntlet
    if (dustT > 8) {
      dustT = -1;
      dustU.value = 0;
    }
    const wideNow = dustT >= 0;
    rig.visible = !wideNow;
    key.intensity = wideNow ? 0 : 2.6;
    (mt ? mt.root : thanos.root).visible = wideNow;
    sky.mat.uniforms.uTime.value = clock;
    // the debris turning in the sky
    drift.forEach((o, i) => {
      m4.compose(v3.set(o.x + Math.sin(clock * 0.03 + o.ph) * 4, o.y + Math.sin(clock * 0.05 + o.ph) * 2, o.z), q.setFromEuler(new THREE.Euler(clock * o.spin, o.ph + clock * o.spin * 0.7, 0)), new THREE.Vector3(o.s, o.s, o.s));
      debris.setMatrixAt(i, m4);
    });
    debris.instanceMatrix.needsUpdate = true;
    const mp = motes.geometry.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      let x = mp.getX(i) + d * 0.35;
      if (x > 15) x -= 30;
      mp.setX(i, x);
      mp.setY(i, mp.getY(i) + Math.sin(clock + i) * d * 0.05);
    }
    mp.needsUpdate = true;
    placeCamera(d);
    sky.mesh.position.copy(camera.position);
    zap.update(d);
    vfx.update(d, camera, engine.size.h);
    engine.render();
  }

  const resize = (w, h) => {
    engine.resize(w, h);
    frame = null;
    const aspect = w / Math.max(1, h);
    fov = aspect < 1 ? FOV + (1 - aspect) * 30 : FOV;
    feel.setBaseFov(fov);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  };

  return {
    engine,
    render,
    resize,
    setStones,
    // the snap: `tonyToo` for Tony's, when the stones were all won back
    snap(tonyToo, done) {
      if (snapT >= 0 || dustT >= 0) return false;
      tony = !!tonyToo;
      onSnapped = done;
      snapT = 0;
      return true;
    },
    // Thanos back, whole (after Tony's snap)
    restore() {
      dustT = -1;
      dustU.value = 0;
    },
    // where a socket is on screen, for the buttons laid over it
    socket(id) {
      gauntlet.sockets[id].getWorldPosition(tmp);
      return engine.project(tmp);
    },
    info: engine.info,
    dispose() {
      vfx.dispose();
      engine.dispose();
    },
    get busy() {
      return snapT >= 0;
    },
    get dusting() {
      return dustT >= 0;
    },
  };
}
