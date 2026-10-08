// Orthanc, in WebGL: Saruman's great hall, black and polished, lit by its
// braziers and the grey light falling from its windows, with the library of
// lore off it; the vision in the palantír (the Eye on its tower, and the
// armies under Isengard); the long stair inside the tower; and the
// pinnacle, in a storm, high over the ring of Isengard and its pits of
// fire, where a moth comes, and then the Windlord. Made in code
// (./props.js, ../ground.js), so nothing is downloaded.
//
// The three places (the hall, the tower in its ring, and the vision's dark
// plain) are drawn apart in one scene, and only the one you're in is shown.
// It draws what the component hands it and decides nothing.
//
// createOrthancWorld(canvas) returns { render(state, ms, fast), fx(type),
// resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { createHouse } from '../../../../lib/three/house';
import { dress, rolesFor } from '../../../../lib/three/core';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { SMOKE, createParticles } from '../../kit';
import { LOOKS, makePerson, sit } from '../../shire/people';
import { lookFrom, makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { makeTerrain } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { makeFolk } from '../bree/props';
import { createGhosts } from '../ghosts';
import { makeRain } from '../rain';
import { createOrthancKit, insideTop } from './props';
import { DUEL_AT, HOST, LEAF, LECTERN, MOTH_AT, PALANTIR, PITS, PIN, PIN_IN, RING, SARUMAN_AT, STAIR, STAIR_LEN, TOWER_H, clearView, indoors, stairAngle, stairAt, stairFace } from './layout';
import { attend, castDo, castPlay, releaseCast, tickCast } from '../../cast3d';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// where each place is drawn
const AT = { hall: V(0, 0, 0), tower: V(3000, 0, 0), vision: V(-3000, 0, 0) };

const SARUMAN = { tall: 1.58, robe: 0xeeece4, hairStyle: 'long', hair: 0xf2f0ea, beard: { color: 0xf4f2ec, len: 0.5 }, item: 'white-staff', feet: 'boots', seed: 17 };
const ROBE = new THREE.Color(SARUMAN.robe);

// ── the light of each place ──
const MOODS = {
  hall: { top: 0x020203, horizon: 0x050608, sun: [-0.4, 0.8, 0.5], sunColour: 0xa8bad8, sunPower: 1.2, hemiSky: 0x5a6478, hemiGround: 0x1a120c, hemi: 1.05, fog: 0x06070a, fogNear: 30, fogFar: 120, cloud: 0, cloudColour: 0x000000, stars: 0, exposure: 1.6 },
  vision: { top: 0x140302, horizon: 0x7a2208, sun: [0, 0.25, -1], sunColour: 0xff6a20, sunPower: 1.4, hemiSky: 0x8a3a20, hemiGround: 0x1a0402, hemi: 1.3, fog: 0x2a0804, fogNear: 300, fogFar: 2600, cloud: 0.85, cloudColour: 0x3a0a04, stars: 0, exposure: 1.4 },
  army: { top: 0x140604, horizon: 0x8a2a0c, sun: [0.3, 0.35, 0.6], sunColour: 0xff8a40, sunPower: 2.2, hemiSky: 0xb06040, hemiGround: 0x8a2a08, hemi: 2.4, fog: 0x2a0c06, fogNear: 40, fogFar: 520, cloud: 0.9, cloudColour: 0x3a1208, stars: 0, exposure: 1.8 },
  stair: { top: 0x10141c, horizon: 0x5a3020, sun: [0.3, 0.6, -0.4], sunColour: 0xb0c0dc, sunPower: 1.2, hemiSky: 0x6a7488, hemiGround: 0x6a2a10, hemi: 1.3, fog: 0x2a1e1c, fogNear: 80, fogFar: 900, cloud: 0.9, cloudColour: 0x40444e, stars: 0, exposure: 1.7 },
  top: { top: 0x121824, horizon: 0x7a3a22, sun: [0.3, 0.7, -0.5], sunColour: 0xb8c8e8, sunPower: 2, hemiSky: 0x8890a8, hemiGround: 0xa04818, hemi: 2.1, fog: 0x2e2226, fogNear: 120, fogFar: 950, cloud: 0.95, cloudColour: 0x4a4e5a, stars: 0, exposure: 1.7 },
};
const COLOURS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour'];
const NUMBERS = ['sunPower', 'hemi', 'fogNear', 'fogFar', 'cloud', 'stars', 'exposure'];

// ── Isengard: the plain in its ring, the pits, the mountains round ──
const noise = makeNoise(83);
const bump = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));
function isenHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(noise, x * 0.02, z * 0.02, { octaves: 3 }) - 0.5) * 2.4;
  for (const p of PITS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.size * 1.6) h -= 4 * (1 - smooth(p.size * 0.7, p.size * 1.3, d));
  }
  // the ring wall, and its one gate in the south
  const a = Math.atan2(z, x);
  let da = a - RING.gate;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const gate = smooth(0.05, 0.11, Math.abs(da));
  h += 46 * bump(r, RING.r + 6, 13) * gate + smooth(RING.r + 10, RING.r + 90, r) * 26;
  // Nan Curunír's mountains: highest to the north
  h += smooth(RING.r + 70, RING.r + 260, r) * (110 + 120 * Math.max(0, -z / Math.max(1, r))) * (0.7 + fbm(noise, x * 0.01, z * 0.01, { octaves: 3 }) * 0.6);
  // the tower's foot: levelled
  h *= smooth(16, 30, r);
  return h;
}
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const EARTH = C(0x2a221c);
const ASHY = C(0x4a423a);
const SCORCH = C(0x3a160c);
const ROCK = C(0x34302e);
function isenPaint(x, z, h, out) {
  const k = smooth(0.35, 0.7, fbm(noise, x * 0.05, z * 0.05, { octaves: 3 }));
  for (let i = 0; i < 3; i++) out[i] = EARTH[i] + (ASHY[i] - EARTH[i]) * k;
  let near = 0;
  for (const p of PITS) near = Math.max(near, 1 - smooth(p.size, p.size * 2.6, Math.hypot(x - p.x, z - p.z)));
  for (let i = 0; i < 3; i++) out[i] += (SCORCH[i] - out[i]) * near * 0.8;
  const rock = smooth(6, 20, h);
  for (let i = 0; i < 3; i++) out[i] += (ROCK[i] - out[i]) * rock;
  return out;
}

export function createOrthancWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 50, near: 0.05, far: 3200, bloom: { strength: 0.85, radius: 0.55, threshold: 0.82 }, onLost });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; it follows the moods below
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x040506, 24, 90);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0x3e4656, 0x0c0806, 1);
  const sun = new THREE.DirectionalLight(0x9fb2d0, 1);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 4 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(2800);
  scene.add(sky.dome);

  const kit = createOrthancKit(renderer);
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(kit.mats ?? {}, rolesFor(kit.mats ?? {}), { strength: 0.3, normal: 0.6, keep: true });
  const mats = kit.mats;
  const zones = { hall: new THREE.Group(), tower: new THREE.Group(), vision: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);

  // ── the hall, and the library ──
  const hall = kit.hall();
  zones.hall.add(hall.group);
  const lib = kit.library();
  zones.hall.add(lib.group);
  const stone = kit.palantir();
  stone.group.position.set(PALANTIR.x, 0, PALANTIR.z);
  zones.hall.add(stone.group);
  const stoneAt = wpos('hall', PALANTIR.x, 1.62, PALANTIR.z);
  // where the cast's eyes go: into the stone, down at the book, at the jar
  const PALANTIR_EYE = stoneAt.clone();
  const LECTERN_EYE = wpos('hall', LECTERN.x, 1.15, LECTERN.z);
  const LEAF_EYE = wpos('hall', LEAF.jar[0], 0.9, LEAF.jar[1]);
  const throneLamp = hall.lamp.clone().add(AT.hall);
  // the light from the windows, falling in shafts
  // (each its own material, so one the camera is in can fade on its own)
  const SHAFT = 26;
  const shafts = [];
  {
    const geo = new THREE.PlaneGeometry(2.4, SHAFT).translate(0, -SHAFT / 2, 0);
    const down = V(0, -1, 0);
    for (const w of hall.windows) {
      const dir = w.dir.clone().multiplyScalar(0.62).add(V(0, -1, 0)).normalize();
      const mat = mats.shaftLight.clone();
      for (const turn of [0, Math.PI / 2]) {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(w.at);
        m.quaternion.setFromUnitVectors(down, dir);
        m.rotateY(turn);
        m.renderOrder = 4;
        zones.hall.add(m);
      }
      shafts.push({ mat, from: w.at.clone().add(AT.hall), to: w.at.clone().add(AT.hall).addScaledVector(dir, SHAFT) });
    }
  }
  const seg = new THREE.Line3();
  const onSeg = V();
  // the braziers, the library's lanterns, and (last) the candle on its lectern
  const hallLamps = [...hall.fires, ...lib.lamps, lib.candle].map((p) => p.clone().add(AT.hall));
  const LANTERN = hall.fires.length;
  const fireCol = new THREE.Color(0xff8a3a);
  const candleCol = new THREE.Color(0xffc080);
  const stoneCol = new THREE.Color(0xff6a20);
  const paleCol = new THREE.Color(0xcfe0ff);
  const whiteCol = new THREE.Color(0xf4f6ff);

  // ── Isengard, and the tower in it ──
  const isenLand = makeTerrain(renderer, { size: 900, seg: tier === 'high' ? 200 : 130, height: isenHeight, paint: isenPaint, blades: 0 });
  zones.tower.add(isenLand);
  {
    const { rim, glow } = kit.pits();
    const list = PITS.map((p) => ({ x: p.x, z: p.z, y: isenHeight(p.x, p.z) * 0.2, s: p.size, turn: p.size }));
    const place = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const o = new THREE.Object3D();
      list.forEach((p, i) => {
        o.position.set(p.x, -0.6, p.z);
        o.scale.set(p.s, 1.2, p.s);
        o.rotation.set(0, p.turn, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      zones.tower.add(m);
      return m;
    };
    place(rim, mats.pitRim);
    place(glow, mats.pitGlow);
  }
  // felled trees, lying by the pits and along the wall; stumps where they stood
  {
    const logGeo = kit.logs();
    const piles = [];
    const r = makeNoise(5);
    PITS.forEach((p, i) => {
      if (i % 2) return;
      for (let k = 0; k < 4; k++) {
        const a = i * 1.7 + k * 0.4;
        const d = p.size + 4 + k * 0.9;
        piles.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, turn: a + Math.PI / 2 + r(i, k) * 0.4 });
      }
    });
    {
      const m = new THREE.InstancedMesh(logGeo, mats.log, piles.length);
      const o = new THREE.Object3D();
      piles.forEach((p, i) => {
        o.position.set(p.x, isenHeight(p.x, p.z) - 0.1, p.z);
        o.rotation.set(0, p.turn, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      zones.tower.add(m);
    }
    const stumps = [];
    for (let i = 0; i < 140; i++) {
      const a = i * 2.39996;
      const rr = 40 + ((i * 53) % 170);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (PITS.some((p) => Math.hypot(p.x - x, p.z - z) < p.size + 3)) continue;
      stumps.push({ x, z, s: 0.7 + (i % 5) * 0.15 });
    }
    const sg = new THREE.CylinderGeometry(0.35, 0.5, 0.7, 7).translate(0, 0.3, 0);
    const sm = new THREE.InstancedMesh(sg, mats.log, stumps.length);
    const o = new THREE.Object3D();
    stumps.forEach((p, i) => {
      o.position.set(p.x, isenHeight(p.x, p.z), p.z);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      sm.setMatrixAt(i, o.matrix);
    });
    zones.tower.add(sm);
  }
  // the Uruk-hai, mustered in ranks, facing the tower; banners before them
  const hostGeo = kit.orcColumn?.();
  if (hostGeo) {
    const n = HOST.rows * HOST.files;
    const m = new THREE.InstancedMesh(hostGeo, mats.orc, n);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / HOST.files);
      const file = (i % HOST.files) - (HOST.files - 1) / 2;
      const x = HOST.x + file * HOST.gap + Math.sin(i * 7.1) * 0.15;
      const z = HOST.z + row * HOST.gap * 1.3;
      o.position.set(x, isenHeight(x, z), z);
      o.rotation.set(0, Math.PI / 2, 0);
      o.scale.setScalar(1.22);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.frustumCulled = false;
    zones.tower.add(m);
  }
  const banners = [-9, -3, 3, 9].map((dx, i) => {
    const b = kit.banner(3.6);
    const x = HOST.x + dx;
    const z = HOST.z - 4;
    b.group.position.set(x, isenHeight(x, z), z);
    b.group.rotation.y = Math.PI / 2 + (i % 2 ? 0.1 : -0.1);
    zones.tower.add(b.group);
    return b;
  });
  const orthanc = kit.tower();
  zones.tower.add(orthanc.group);
  const shaft = kit.shaft();
  zones.tower.add(shaft.group);
  const torches = shaft.torches.map((p) => p.clone().add(AT.tower));
  const torchCol = new THREE.Color(0xff8a40);
  const pitCol = new THREE.Color(0xff5a14);
  // (Gwaihir and the moth are placed in world coordinates, by Gandalf and
  // wpos, so they hang off the scene itself, not the tower's group, which
  // is already at AT.tower: in it they'd draw 3 km off, and Gandalf would
  // ride on nothing)
  const gwaihir = kit.eagle();
  gwaihir.group.scale.setScalar(1.35);
  gwaihir.group.visible = false;
  scene.add(gwaihir.group);
  const moth = kit.moth();
  moth.group.visible = false;
  scene.add(moth.group);
  const rain = makeRain({ count: Math.round(2600 * Math.max(0.4, many)), size: [34, 26, 34], speed: 18, len: 0.9, splashes: Math.round(120 * many), height: () => TOWER_H });
  scene.add(rain.group);

  // ── the vision: the Eye on its tower, on a dark plain ──
  const barad = kit.baradDur();
  zones.vision.add(barad.group);
  barad.group.updateMatrixWorld(true);
  {
    const plain = new THREE.Mesh(new THREE.CircleGeometry(2400, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x140a08, roughness: 1 }));
    plain.position.y = -2;
    zones.vision.add(plain);
  }
  const eyeAt = barad.eyeAt.clone().add(AT.vision);

  // ── people ──
  // (outdoors, each stands on a soft blob slid away from the sun, and dims in
  // the baked shade, ../grounded.js; the circle under each is kept for the
  // zones indoors, and hidden while a blob is drawn)
  const movers = [];
  const blobGeo = new THREE.CircleGeometry(0.46, 20).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const blob = (f) => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.position.y = 0.03;
    b.renderOrder = 1;
    movers.push({ object: f.group, size: [FIGURE, FIGURE], contact: b });
    f.group.add(b);
    f.blob = b;
    return f;
  };
  const gandalf = blob(makeFolk('gandalf', { look: LOOKS.gandalf }));
  const saruman = blob(makeFolk('saruman', { look: SARUMAN }));
  scene.add(gandalf.group, saruman.group);
  // a staff is the group in the right hand: the wood and the light on top
  const staffOf = (f) => f.arms[1].children.find((c) => c.isGroup) ?? null;
  const gStaff = staffOf(gandalf);
  const sStaff = staffOf(saruman);
  const orbOf = (st) => st?.children.find((c) => c.material?.isMeshBasicMaterial) ?? null;
  const gOrb = orbOf(gStaff);
  const sOrb = orbOf(sStaff);
  // Saruman's robe, and the one it turns out to be: woven of all colours,
  // shimmering and changing as he moves (a thin film's colours, by angle)
  const robes = [];
  saruman.group.traverse((o) => {
    if (o.isMesh && o.material?.color && o.material.color.equals(ROBE)) robes.push([o, o.material]);
  });
  const manyColours = new THREE.MeshPhysicalMaterial({ color: 0xf4f0ff, roughness: 0.32, metalness: 0.15, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [160, 900], sheen: 0.6, sheenColor: new THREE.Color(0xffd8f0), envMap: kit.tex.hallEnv, envMapIntensity: 2.4 });
  // bands of every colour down the robe, moving, and turning with the angle
  const robeTime = { value: 0 };
  manyColours.onBeforeCompile = (sh) => {
    sh.uniforms.uRobeTime = robeTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRobe;').replace('#include <project_vertex>', '#include <project_vertex>\nvRobe = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRobeTime;\nvarying vec3 vRobe;\nvec3 robeHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float robeAngle = 1.0 - abs(dot(normalize(vViewPosition), normalize(vNormal)));
        diffuseColor.rgb *= mix(vec3(1.0), robeHue(fract(vRobe.y * 1.3 + robeAngle * 0.9 + uRobeTime * 0.2)), 0.6);`,
      );
  };
  manyColours.customProgramCacheKey = () => 'orthanc-many-colours';
  const ghosts = createGhosts({ make: () => makePerson('gandalf'), tag: 0.42 });
  zones.hall.add(ghosts.group);

  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const flames = createParticles(Math.round(260 * Math.max(0.4, many)), {
    ramp: [
      [0, 2.6, 1.6, 0.6, 0],
      [0.12, 2.8, 1.3, 0.35, 0.9],
      [0.5, 1.6, 0.45, 0.08, 0.55],
      [1, 0.3, 0.05, 0, 0],
    ],
    additive: true,
    gravity: 1.4,
    drag: 1.1,
    swirl: 0.7,
  });
  scene.add(flames.mesh);
  const smoke = createParticles(Math.round(220 * Math.max(0.4, many)), { ramp: SMOKE, additive: false, gravity: 1.2, drag: 0.25, swirl: 0.4 });
  scene.add(smoke.mesh);
  const sparks = createParticles(Math.round(240 * Math.max(0.4, many)), {
    ramp: [
      [0, 3, 3.2, 3.6, 0],
      [0.1, 2.6, 2.9, 3.4, 1],
      [1, 0.4, 0.6, 1.2, 0],
    ],
    additive: true,
    gravity: -1,
    drag: 1.6,
  });
  scene.add(sparks.mesh);
  // the bolt from Saruman's staff, and the push's ring of force
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true).translate(0, 0.5, 0), boltMat);
  bolt.visible = false;
  scene.add(bolt);
  const waveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 40), waveMat);
  wave.visible = false;
  scene.add(wave);

  // ── state ──
  const cur = {};
  for (const k of COLOURS) cur[k] = new THREE.Color(MOODS.hall[k]);
  for (const k of NUMBERS) cur[k] = MOODS.hall[k];
  const sunDir = V(...MOODS.hall.sun).normalize();
  const A = { t: 0, cam: { at: V(0, 3, 16), look: V(0, 2, 0) }, mode: '', shake: 0, first: true, fov: 50, mood: '', flash: 0, block: 0, push: 0, hit: 0, cast: 0, sx: DUEL_AT.saruman.x, gx: DUEL_AT.gandalf.x, down: 0, jump: 0, ring: -1, ring2: -1, eyeLook: 0, flames: 0, smoke: 0, wake: 0, eye: 0 };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const target = new THREE.Color();
  const turnTo = (p, face, dt, k = 4) => {
    let d = face - p.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.group.rotation.y += d * Math.min(1, dt * k);
  };
  const stand = (f, zone, x, y, z, face) => {
    f.group.visible = true;
    wpos(zone, x, y, z, f.group.position);
    f.group.rotation.set(0, face, 0);
    f.body.rotation.z = 0;
    sit(f, false);
    if (f.blob) f.blob.visible = true;
    // (on the cast: what each does here is set after, frame by frame)
    castDo(f, { base: null, upper: null, look: null, crouch: false, air: 0, full: null, down: false });
  };
  const faceTo = (ax, az, bx, bz) => Math.atan2(-(bz - az), bx - ax);
  // where a staff's light is, in the world
  const tipOf = (orb, out) => (orb ? orb.getWorldPosition(out) : out.set(0, 0, 0));
  // the flight away: from under the pinnacle, down and out north over the
  // ring wall, towards the mountains
  const FLIGHT = new THREE.CatmullRomCurve3([V(0, TOWER_H - 5, -7), V(6, TOWER_H - 22, -60), V(-10, TOWER_H - 40, -150), V(0, 70, -260), V(20, 95, -420), V(40, 130, -640)]);
  const FLIGHT_T = 11;

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    kit.tick(t);
    sky.uniforms.uTime.value = t;
    const h = s.wizard;
    const gz = s.gaze;
    const looking = s.mode === 'gaze' && gz?.looking;
    const vision = looking ? (gz.stage === 'eye' ? 'vision' : 'army') : null;
    const zone = s.zone;
    // which place is drawn
    const shown = vision === 'vision' ? 'vision' : vision === 'army' || zone === 'stair' || zone === 'top' ? 'tower' : 'hall';
    for (const [k, g] of Object.entries(zones)) g.visible = k === shown;
    const inShaft = shown === 'tower' && zone === 'stair' && !vision;
    orthanc.shell.visible = !inShaft;
    shaft.group.visible = inShaft;
    const lights = [];

    // ── the light ──
    const moodKey = vision ?? (zone === 'stair' ? 'stair' : zone === 'top' ? 'top' : 'hall');
    const mood = MOODS[moodKey];
    const cut = A.first || A.mood !== moodKey;
    const ease = cut ? 1 : Math.min(1, dt * 1.5);
    A.first = false;
    A.mood = moodKey;
    for (const k of COLOURS) cur[k].lerp(target.set(mood[k]), ease);
    for (const k of NUMBERS) cur[k] += (mood[k] - cur[k]) * ease;
    sunDir.lerp(tmp2.set(...mood.sun).normalize(), ease).normalize();
    A.flash = Math.max(0, A.flash - dt * 2.4);
    const flash = A.flash * A.flash;
    const u = sky.uniforms;
    u.uTop.value.copy(cur.top).lerp(target.set(0xc8d4ff), flash * 0.6);
    u.uHorizon.value.copy(cur.horizon).lerp(target.set(0x8a8ca8), flash * 0.5);
    // (no sun in the sky of the vision: the Eye is light enough)
    u.uSunColour.value.copy(cur.sunColour).multiplyScalar(moodKey === 'vision' ? 0 : 1);
    u.uCloudColour.value.copy(cur.cloudColour).lerp(target.set(0xb0b8d8), flash * 0.7);
    u.uCloud.value = cur.cloud;
    u.uStars.value = cur.stars;
    u.uMoon.value = 1;
    u.uSunDir.value.copy(sunDir);
    sun.color.copy(cur.sunColour);
    sun.intensity = cur.sunPower + flash * 3;
    hemi.color.copy(cur.hemiSky);
    hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = cur.hemi + flash * 1.6;
    scene.fog.color.copy(cur.fog);
    scene.fog.near = cur.fogNear;
    scene.fog.far = cur.fogFar;
    lookFrom(houseLook, { sky, sun, hemi, fog: scene.fog, renderer, exposure: cur.exposure });

    // everyone hidden, then placed by the place and what's happening
    gandalf.group.visible = false;
    saruman.group.visible = false;
    moth.group.visible = false;
    gwaihir.group.visible = false;
    bolt.visible = false;
    wave.visible = false;
    if (gStaff) gStaff.visible = s.staff;
    for (const f of [gandalf, saruman]) {
      f.arms[0].rotation.set(0, 0, 0);
      f.arms[1].rotation.set(0, 0, 0);
    }
    // Saruman of Many Colours
    for (const [o, m] of robes) o.material = s.colours ? manyColours : m;
    robeTime.value = t;
    if (gOrb) gOrb.scale.setScalar(1);
    if (sOrb) sOrb.scale.setScalar(1);

    // ── the hall ──
    if (shown === 'hall') {
      const wantWake = s.mode === 'gaze' ? 0.35 + (gz?.seen ?? 0) * 0.4 : s.talking === 'stone' || s.talking === 'seen' ? 0.3 : 0;
      A.wake += (wantWake - A.wake) * Math.min(1, dt * 2);
      A.eye += ((s.mode === 'gaze' ? (gz?.notice ?? 0) : 0) - A.eye) * Math.min(1, dt * 3);
      stone.update(t, { wake: A.wake, eye: A.eye, covered: !s.uncovered });
      ghosts.update(s.travellers ?? [], t, dt);
      // the braziers, and the library's candle
      A.flames += dt * 30 * Math.max(0.4, many);
      while (A.flames > 1) {
        A.flames -= 1;
        const p = hallLamps[Math.floor(Math.random() * hall.fires.length)];
        flames.emit(p.x + R(0.3), p.y, p.z + R(0.3), R(0.15), 0.9 + Math.random() * 0.6, R(0.15), 0.55 + Math.random() * 0.4, 0.42, 0.1, 1);
      }
      if (Math.random() < dt * 14) {
        const c = hallLamps[hallLamps.length - 1];
        flames.emit(c.x + R(0.005), c.y - 0.04, c.z + R(0.005), 0, 0.12, 0, 0.35, 0.05, 0.02, 1);
      }
      const cam = camera.position;
      const near = hallLamps.map((p, i) => [p, p.distanceToSquared(cam), i]).sort((a, b) => a[1] - b[1]);
      near.slice(0, POOL - 1).forEach(([p, , i]) => {
        const candle = i === hallLamps.length - 1;
        const lantern = i >= LANTERN && !candle;
        lights.push([p, candle ? candleCol : fireCol, candle ? 1.6 + Math.sin(t * 17) * 0.1 : lantern ? 4 + Math.sin(t * 9 + i) * 0.2 : 5 + Math.sin(t * 11 + i * 2) * 0.6 + Math.sin(t * 7.3 + i) * 0.4, candle ? 8 : lantern ? 12 : 18]);
      });
      if (A.wake > 0.05) lights.unshift([stoneAt, stoneCol, A.wake * 6 + A.eye * 6, 7]);
      // a pale light high over the throne, so the dark end of the hall shows
      if (cam.x < 13) lights.unshift([throneLamp, paleCol, 7, 20]);
      // the shafts of light, faint when the camera is in one, or close in on a scene
      for (const sh of shafts) {
        seg.set(sh.from, sh.to).closestPointToPoint(camera.position, true, onSeg);
        sh.mat.opacity = smooth(1.6, 5, onSeg.distanceTo(camera.position)) * (s.mode === 'walk' ? 1 : 0.4);
      }

      // Saruman, by the stone; Gandalf, walking or talking
      const duel = s.duel;
      const fighting = s.mode === 'duel' || s.talking === 'seen' || s.talking === 'staff';
      if (fighting) {
        // across the floor from each other
        A.block = Math.max(0, A.block - dt * 2.2);
        A.push = Math.max(0, A.push - dt * 1.6);
        A.hit = Math.max(0, A.hit - dt * 1.8);
        A.cast = Math.max(0, A.cast - dt * 3);
        const wantS = DUEL_AT.saruman.x + (duel ? duel.pushes : s.talking === 'staff' ? 3 : 0) * DUEL_AT.back;
        A.sx += (wantS - A.sx) * Math.min(1, dt * 5);
        const wantG = DUEL_AT.gandalf.x - A.hit * 0.9;
        A.gx += (wantG - A.gx) * Math.min(1, dt * 6);
        const gzz = DUEL_AT.gandalf.z;
        const szz = DUEL_AT.saruman.z;
        stand(gandalf, 'hall', A.gx, 0, gzz, 0);
        stand(saruman, 'hall', A.sx, 0, szz, Math.PI);
        const ph = duel?.phase ?? 'idle';
        pose(gandalf, t, { moving: false, talk: s.speaker === 'gandalf' ? 1 : 0 });
        pose(saruman, t + 1, { moving: ph === 'idle' && Boolean(duel), speed: 0.4, talk: s.speaker === 'saruman' ? 1 : 0 });
        // on the cast (../../cast3d.js): each with his eyes on the other; Saruman
        // raises his staff in the tell and looses the spell in the cast, reels
        // when he's open; Gandalf goes down by his own fall and gets up again
        castDo(gandalf, { look: saruman, down: A.down > 0, flinch: null, fall: 'knockdown', rise: 'arise' });
        castDo(saruman, { look: gandalf, upper: ph === 'tell' ? 'cast.idle' : null });
        // (driven back, he laughs, and takes your staff from you)
        const laughing = s.talking === 'staff' && s.line === 'laugh';
        if (laughing && !A.laughed) castPlay(saruman, 'taunt', { layer: 'full', fade: 0.15 });
        A.laughed = laughing;
        if (ph !== A.sPh) {
          if (ph === 'tell') castPlay(saruman, 'cast.enter', { layer: 'full', fade: 0.15 });
          else if (ph === 'cast') castPlay(saruman, 'cast', { layer: 'full', fade: 0.08 });
          else if (ph === 'open') castPlay(saruman, 'hit.head', { layer: 'full', fade: 0.08 });
          A.sPh = ph;
        }
        // Gandalf's staff: raised across to block, thrust to push
        if (s.staff) gandalf.arms[1].rotation.x = -1.2 * A.block - 0.4 * A.push;
        gandalf.arms[1].rotation.z = 1.2 * A.push + 0.3;
        gandalf.body.rotation.z = -0.25 * A.hit + 0.12 * A.push;
        if (A.down > 0) {
          A.down = Math.max(0, A.down - dt * 0.6);
          gandalf.body.rotation.z = -1.2 * Math.min(1, A.down * 2);
        }
        // Saruman: raised high in the tell, down in the cast, reeling when open
        const raise = ph === 'tell' ? Math.max(0, Math.min(1, 1 - duel.phaseT / 0.8)) : 0;
        saruman.arms[1].rotation.x = -2.6 * raise;
        saruman.arms[1].rotation.z = ph === 'cast' ? 1.1 : 0;
        saruman.body.rotation.z = ph === 'open' ? 0.35 + Math.sin(t * 9) * 0.05 : ph === 'recover' ? -0.1 : 0;
        if (sOrb) sOrb.scale.setScalar(1 + raise * 2.2 + (ph === 'cast' ? 1.5 : 0));
        if (gOrb) gOrb.scale.setScalar(1 + A.block * 2 + A.push * 2.5);
        // the bolt, and the ring of force
        if (A.cast > 0) {
          gandalf.group.updateMatrixWorld(true);
          saruman.group.updateMatrixWorld(true);
          const a = tipOf(sOrb, tmp);
          const b = tipOf(gOrb, tmp2);
          if (!s.staff || !gOrb) b.copy(gandalf.group.position).add(V(0, 1.3, 0));
          bolt.visible = true;
          bolt.position.copy(a);
          const d = b.clone().sub(a);
          bolt.scale.set(1 + A.cast * 2, d.length(), 1 + A.cast * 2);
          bolt.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
          boltMat.opacity = A.cast;
        }
        if (A.ring >= 0) {
          A.ring += dt * 1.6;
          const k = A.ring;
          if (k > 1) A.ring = -1;
          else {
            wave.visible = true;
            const sx = gandalf.group.position.x + (saruman.group.position.x - gandalf.group.position.x) * k;
            wave.position.set(sx, AT.hall.y + 1.3, gandalf.group.position.z);
            wave.lookAt(camera.position);
            wave.scale.setScalar(0.4 + k * 1.6);
            waveMat.opacity = (1 - k) * 0.9;
          }
        }
        lights.unshift([tipOf(sOrb, V()), whiteCol, (ph === 'tell' ? 3 * raise : 0) + (ph === 'cast' ? 8 : 0) + A.cast * 6, 12]);
        if (A.block > 0 || A.push > 0) lights.unshift([tipOf(gOrb, V()), paleCol, (A.block + A.push) * 9, 12]);
      } else {
        stand(saruman, 'hall', SARUMAN_AT.x, 0, SARUMAN_AT.z, SARUMAN_AT.face);
        A.sPh = null;
        if (s.mode === 'talk' && s.talking && s.talking !== 'lore' && s.talking !== 'leaf') turnTo(saruman, faceTo(SARUMAN_AT.x, SARUMAN_AT.z, h.x, h.z), dt, 6);
        else if (saruman.cast?.ready) {
          // (on the cast: by the stone, his eyes on you as you go about his hall, his body turned only as he must)
          if (s.talking) turnTo(saruman, faceTo(SARUMAN_AT.x, SARUMAN_AT.z, h.x, h.z), dt, 6);
          else attend(saruman, h, SARUMAN_AT.face, dt, { who: gandalf, near: 9, greet: false });
        } else saruman.group.rotation.y = s.talking ? faceTo(SARUMAN_AT.x, SARUMAN_AT.z, h.x, h.z) : SARUMAN_AT.face;
        if (s.talking) castDo(saruman, { look: gandalf });
        pose(saruman, t + 1, { moving: false, talk: s.speaker === 'saruman' ? 1 : 0 });
        if (s.mode === 'gaze') {
          // before the stone, bent to it
          const fx = PALANTIR.x - 0.5;
          const fz = PALANTIR.z + 1.1;
          stand(gandalf, 'hall', fx, 0, fz, Math.PI / 2);
          pose(gandalf, t, { moving: false });
          gandalf.body.rotation.z = -0.22 - (looking ? 0.1 : 0);
          gandalf.arms[0].rotation.z = 0.9;
          // (on the cast: his hands to the stone, his eyes in it)
          castDo(gandalf, { upper: 'pickup', look: PALANTIR_EYE });
          if (gz?.phase === 'turn' && looking) A.shake = Math.max(A.shake, 0.05);
        } else if (s.talking === 'lore') {
          // reading, at the lectern
          stand(gandalf, 'hall', LECTERN.x - 0.95, 0, LECTERN.z, 0);
          pose(gandalf, t, { moving: false, talk: s.speaker === 'gandalf' ? 1 : 0 });
          gandalf.head.rotation.z = -0.25;
          castDo(gandalf, { look: LECTERN_EYE }); // (on the cast: reading)
        } else if (s.talking === 'leaf') {
          // crouched by the case, the jar in his hand
          stand(gandalf, 'hall', LEAF.x + 0.1, 0, LEAF.z + 0.8, faceTo(LEAF.x + 0.1, LEAF.z + 0.8, LEAF.jar[0], LEAF.jar[1]));
          pose(gandalf, t, { moving: false, talk: s.speaker === 'gandalf' ? 1 : 0 });
          gandalf.body.rotation.z = -0.2;
          castDo(gandalf, { crouch: true, look: LEAF_EYE }); // (on the cast: down by the case, the jar in view)
        } else {
          stand(gandalf, 'hall', h.x, 0, h.z, h.face);
          pose(gandalf, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1, talk: s.speaker === 'gandalf' ? 1 : 0 });
        }
      }
      // a smoke ring, from the pipe
      if (A.ring2 >= 0) {
        A.ring2 += dt * 0.32;
        if (A.ring2 > 1) A.ring2 = -1;
        else {
          const k = A.ring2;
          const gp = gandalf.group.position;
          const fa = gandalf.group.rotation.y;
          fx.showRings([{ at: tmp.set(gp.x + Math.cos(fa) * (0.5 + k * 1.2), gp.y + 1.8 + k * 1.4, gp.z - Math.sin(fa) * (0.5 + k * 1.2)), r: 0.12 + k * 0.4, face: V(Math.cos(fa), 0.3, -Math.sin(fa)), opacity: (1 - k) * 0.85 }], t);
        }
      } else fx.showRings([], t);
    } else fx.showRings([], t);
    flames.step(dt);

    // ── the vision ──
    if (vision === 'vision') {
      // when it turns, its beam swings round and comes down just in front of you
      barad.doom?.set(camera.position.x + 30, AT.vision.y, camera.position.z - 90);
      const turning = gz.phase === 'turn' ? 1 : gz.phase === 'stir' ? 0.4 : 0;
      A.eyeLook += (turning - A.eyeLook) * Math.min(1, dt * 2.5);
      barad.aim?.(wpos('vision', Math.sin(t * 0.4) * 500, 0, 300 + Math.cos(t * 0.3) * 200, tmp));
      barad.update?.(t, { k: 0.9 + gz.notice * 0.6, look: A.eyeLook });
      if (turning > 0.9) A.shake = Math.max(A.shake, 0.08);
    }

    // ── Isengard, the stair, the pinnacle ──
    if (shown === 'tower') {
      const top = PIN_IN;
      // smoke going up from the pits, and sparks
      A.smoke += dt * 10 * Math.max(0.4, many);
      while (A.smoke > 1) {
        A.smoke -= 1;
        const p = PITS[Math.floor(Math.random() * PITS.length)];
        const q = wpos('tower', p.x + R(p.size * 0.4), 0, p.z + R(p.size * 0.4), tmp);
        smoke.emit(q.x, q.y - 1, q.z, R(0.6) + 0.8, 3 + Math.random() * 2, R(0.6), 9 + Math.random() * 5, 3, 14, 1);
        if (Math.random() < 0.5) sparks.emit(q.x, q.y, q.z, R(1), 5 + Math.random() * 5, R(1), 1.6, 0.5, 0.1, 1);
      }
      banners.forEach((b, i) => b.wave(t + i, 1));
      // the two nearest pits light the ground near them; torches in the shaft
      const cam = camera.position;
      if (inShaft) {
        const near = torches.map((p) => [p, p.distanceToSquared(cam)]).sort((a, b) => a[1] - b[1]);
        near.slice(0, 3).forEach(([p], i) => {
          lights.push([p, torchCol, 3.4 + Math.sin(t * 13 + i * 2.1) * 0.4, 14]);
          if (Math.random() < dt * 20) flames.emit(p.x + R(0.05), p.y, p.z + R(0.05), R(0.05), 0.5, R(0.05), 0.5, 0.18, 0.05, 1);
        });
      }
      const pits = PITS.map((p) => [p, (p.x + AT.tower.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).sort((a, b) => a[1] - b[1]);
      pits.slice(0, 2).forEach(([p]) => lights.push([wpos('tower', p.x, 4, p.z), pitCol, 40, 60]));

      if (zone === 'stair' && !vision) {
        // up the stair, Saruman a few steps behind with both staves
        const c = s.climb;
        const sp = c ? c.s : 0;
        const [x, y, z] = stairAt(sp);
        stand(gandalf, 'tower', x, y, z, stairFace(sp));
        pose(gandalf, t, { moving: s.climbing, speed: 0.8, talk: s.speaker === 'gandalf' ? 1 : 0 });
        if (gandalf.blob) gandalf.blob.visible = false;
        const ss = Math.max(0, sp - 3.4);
        const [x2, y2, z2] = stairAt(ss);
        stand(saruman, 'tower', x2, y2, z2, stairFace(ss));
        pose(saruman, t + 1, { moving: s.climbing, speed: 0.8, talk: s.speaker === 'voice' ? 1 : 0 });
        if (saruman.blob) saruman.blob.visible = false;
        if (s.talking === 'prison') {
          // at the top, the hatch: Gandalf out, Saruman below, looking up
          stand(gandalf, 'tower', top.x, TOWER_H, STAIR.r - 0.6, Math.PI / 2);
          saruman.group.visible = s.line === 'top';
        }
      }
      if (zone === 'top') {
        // the pinnacle
        const onPin = s.mode !== 'flight' && !(s.mode === 'end' && s.done?.includes('pinnacle'));
        if (onPin) {
          if (s.mode === 'moth' || s.mode === 'leap' || (s.mode === 'talk' && s.talking === 'moth')) {
            const fx0 = MOTH_AT.x;
            const fz0 = MOTH_AT.z + 0.6;
            stand(gandalf, 'tower', fx0, TOWER_H, fz0, Math.PI / 2 + (s.moth ? -s.moth.hand * 0.35 : 0));
            pose(gandalf, t, { moving: false, talk: s.speaker === 'gandalf' ? 1 : 0 });
            // his right hand held out
            if (s.mode !== 'leap') {
              gandalf.arms[1].rotation.z = 1.5;
              gandalf.arms[1].rotation.x = -0.25;
            }
            // (on the cast: his hand out to the moth)
            castDo(gandalf, { upper: s.mode !== 'leap' ? 'aim.pistol' : null });
          } else {
            stand(gandalf, 'tower', h.x, TOWER_H, h.z, h.face);
            pose(gandalf, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1, talk: s.speaker === 'gandalf' ? 1 : 0 });
          }
          if (A.jump > 0) {
            // stepping off the edge
            A.jump += dt;
            const k = Math.min(1, A.jump / 0.9);
            gandalf.group.position.z -= k * 2.4;
            gandalf.group.position.y -= k * k * 5;
          }
        }
        // the moth: fluttering at the north edge, or over your hand
        const mothOn = s.next === 'pinnacle' && (s.mode === 'walk' || s.mode === 'moth' || (s.mode === 'talk' && s.talking === 'moth' && (s.line === 'lands' || s.line === 'whisper')));
        if (mothOn) {
          moth.group.visible = true;
          const gp = gandalf.group.position;
          if (s.mode === 'moth' && s.moth) {
            const m = s.moth;
            const settled = m.settle;
            const lx = m.x * 1.1;
            const y = 1.95 + (1 - settled) * (0.25 + Math.sin(t * 7) * 0.08);
            moth.group.position.set(gp.x + lx, gp.y + y, gp.z - 0.75 + Math.sin(t * 5.3) * 0.08 * (1 - settled));
            moth.group.scale.setScalar(2.2);
            moth.group.rotation.set(0, Math.PI / 2 + Math.sin(t * 3) * 0.6 * (1 - settled), 0);
            moth.animate(t, { flap: 1 - settled * 0.8 });
          } else if (s.mode === 'talk') {
            moth.group.scale.setScalar(2.2);
            moth.group.position.set(gp.x + 0.25, gp.y + 1.75 + (s.line === 'whisper' ? 0.15 : 0), gp.z - 0.55);
            moth.group.rotation.set(0, Math.PI / 2, 0);
            moth.animate(t, { flap: 0.15 });
          } else {
            moth.group.scale.setScalar(2.2);
            wpos('tower', MOTH_AT.x + Math.sin(t * 1.3) * 1.2, TOWER_H + 1.6 + Math.sin(t * 2.1) * 0.4, MOTH_AT.z - 0.6 + Math.cos(t * 1.7) * 0.4, moth.group.position);
            moth.group.rotation.set(0, t * 2, 0);
            moth.animate(t, { flap: 1 });
          }
        }
        // Gwaihir: round and round the tower, under the edge at the middle of his lap
        if (s.leap || s.mode === 'flight' || (s.mode === 'end' && s.done?.includes('pinnacle')) || (s.talking === 'moth' && s.line === 'jump')) {
          gwaihir.group.visible = true;
          if (s.mode === 'flight' || s.mode === 'end') {
            const k = Math.min(1, (s.flight ?? FLIGHT_T) / FLIGHT_T);
            const ease = k < 1 ? k * k * (3 - 2 * k) : 1;
            const p = FLIGHT.getPointAt(ease, tmp);
            const q = FLIGHT.getTangentAt(Math.min(0.999, ease + 0.001), tmp2);
            wpos('tower', p.x, p.y, p.z, gwaihir.group.position);
            gwaihir.group.rotation.set(0, Math.atan2(-q.z, q.x), Math.sin(t * 0.7) * 0.12 - q.y * 0.4);
            gwaihir.animate?.(t, { flap: 0.6 + 0.4 * Math.abs(q.y), glide: 0.4 });
            // Gandalf on his back
            stand(gandalf, 'tower', 0, 0, 0, gwaihir.group.rotation.y);
            gandalf.group.position.copy(gwaihir.group.position).add(V(0, 0.5, 0));
            sit(gandalf, true);
            if (gandalf.blob) gandalf.blob.visible = false;
            pose(gandalf, t, { moving: false });
            gandalf.body.rotation.z = -0.35;
            gandalf.arms[0].rotation.x = 0.6;
            // the fires below light him, and the moon above
            lights.unshift([V().copy(gwaihir.group.position).add(V(0, -8, 0)), pitCol, 40, 50], [V().copy(gwaihir.group.position).add(V(4, 10, 6)), paleCol, 36, 60]);
          } else {
            const k = s.leap ? s.leap.k : 0.05;
            const th = (k - 0.5) * TAU;
            const x = Math.sin(th) * 46;
            const y = TOWER_H - 4.5 + (1 - Math.cos(th)) * 9;
            const z = -6.5 - (1 - Math.cos(th)) * 30;
            wpos('tower', x, y, z, gwaihir.group.position);
            const dx = Math.cos(th) * 46;
            const dz = -Math.sin(th) * 30;
            gwaihir.group.rotation.set(0, Math.atan2(-dz, dx), -Math.sin(th) * 0.35);
            gwaihir.animate?.(t, { flap: s.leap?.under ? 0.2 : 0.8, glide: s.leap?.under ? 0.8 : 0.2, reach: 0 });
          }
        }
      }
    }
    smoke.step(dt);
    sparks.step(dt);
    rain.update(camera, t, shown === 'tower' && (zone === 'top' || s.mode === 'flight' || s.mode === 'end') && !vision ? 1 : 0, gandalf.group.position);
    fx.step(dt, t, { night: 1, day: 0 });

    pool.forEach((l, i) => {
      const v = lights[i];
      if (!v) return (l.intensity = 0);
      l.position.copy(v[0]);
      l.color.copy(v[1]);
      l.intensity = v[2];
      l.distance = v[3];
      return undefined;
    });

    // ── the camera ──
    let camAt;
    let camLook;
    let fov = 50;
    const gp = gandalf.group.position;
    if (vision === 'vision') {
      // across the dark plain to the Eye, drawn in as you look
      const k = gz.seen / 0.5;
      const d = 900 - k * 520;
      camAt = tmp.set(eyeAt.x + Math.sin(t * 0.2) * 12, eyeAt.y - 40 + k * 30, eyeAt.z + d);
      camLook = look.copy(eyeAt);
      fov = 34 - k * 8;
    } else if (vision === 'army') {
      // low over the ranks under the tower, the pits glowing
      const k = (gz.seen - 0.5) / 0.5;
      camAt = wpos('tower', -24 + k * 30, 9 - k * 3, HOST.z + 40 - k * 30, tmp);
      camLook = wpos('tower', HOST.x, 2, HOST.z - 10, look);
      fov = 46;
    } else if (shown === 'hall' && s.mode === 'gaze') {
      // over your shoulder, into the stone
      camAt = tmp.copy(stoneAt).add(V(1.3, 1.0, 2.9));
      camLook = look.copy(stoneAt).add(V(-0.2, 0, 0));
      fov = 38;
    } else if (shown === 'hall' && (s.mode === 'duel' || s.talking === 'seen' || s.talking === 'staff')) {
      // side on: Gandalf left, Saruman right
      const mx = (gandalf.group.position.x + saruman.group.position.x) / 2;
      camAt = tmp.set(mx - 0.5, 2.7, DUEL_AT.gandalf.z + 8.4);
      camLook = look.set(mx, 1.4, DUEL_AT.gandalf.z);
      fov = 48;
    } else if (shown === 'hall' && s.mode === 'talk' && s.talking === 'lore') {
      camAt = tmp.set(LECTERN.x - 2.7, 2.4, LECTERN.z + 2.1);
      camLook = look.set(LECTERN.x - 0.2, 1.25, LECTERN.z);
      fov = 44;
    } else if (shown === 'hall' && s.mode === 'talk' && s.talking === 'leaf') {
      camAt = tmp.set(LEAF.x + 1.4, 1.6, LEAF.z - 0.4);
      camLook = look.set(LEAF.jar[0] + 0.2, 0.7, LEAF.jar[1] + 0.3);
      fov = 50;
    } else if (shown === 'hall' && s.mode === 'talk') {
      // the two of them, by the throne and the stone
      const sp = saruman.group.position;
      const mx = (gp.x + sp.x) / 2;
      const mz = (gp.z + sp.z) / 2;
      camAt = tmp.set(mx + 4.2, 2.4, mz + 3.6);
      camLook = look.set(mx - 0.3, 1.5, mz - 0.6);
      fov = 44;
    } else if (shown === 'tower' && zone === 'stair' && s.mode === 'talk' && s.talking !== 'prison') {
      // at the window, looking out over Isengard
      const sp = s.climb ? s.climb.s : 0;
      const a = stairAngle(sp);
      const [, y] = stairAt(sp);
      camAt = wpos('tower', Math.cos(a) * (STAIR.wall + 3.1), y + 2.2, Math.sin(a) * (STAIR.wall + 3.1), tmp);
      const sight = s.talking === 'host' ? [HOST.x, 0, HOST.z] : s.talking === 'pits' ? [Math.cos(a) * 120, 0, Math.sin(a) * 120] : [Math.cos(a) * 200, 4, Math.sin(a) * 200];
      camLook = wpos('tower', ...sight, look);
      fov = 46;
    } else if (shown === 'tower' && zone === 'stair') {
      // from further up the stair, looking back down at you, and him behind
      const sp = s.climb ? s.climb.s : 0;
      const ahead = sp + 3.6;
      const a = stairAngle(ahead);
      const [, y] = stairAt(Math.min(ahead, STAIR_LEN));
      const r = 4.3;
      camAt = wpos('tower', Math.cos(a) * r, y + 2.3 + Math.max(0, ahead - STAIR_LEN) * 0.4, Math.sin(a) * r, tmp);
      camLook = look.copy(gp).add(V(0, 1.1, 0));
      if (s.talking === 'prison') {
        camAt = wpos('tower', 2.4, TOWER_H + 2.4, STAIR.r + 3.4, tmp);
        camLook = look.copy(gp).add(V(0, 1.2, 0));
      }
      fov = 56;
    } else if (shown === 'tower' && (s.mode === 'flight' || s.mode === 'end')) {
      const ep = gwaihir.group.position;
      const fa = gwaihir.group.rotation.y;
      const fwd = V(Math.cos(fa), 0, -Math.sin(fa));
      if (s.mode === 'end') {
        camAt = tmp.copy(ep).addScaledVector(fwd, 30).add(V(12, 8, 0));
        camLook = look.copy(ep);
      } else {
        camAt = tmp.copy(ep).addScaledVector(fwd, -11).add(V(3.5, 4.2, 0));
        camLook = look.copy(ep).addScaledVector(fwd, 12).add(V(0, -1.5, 0));
      }
      fov = 54;
    } else if (shown === 'tower' && zone === 'top' && (s.mode === 'moth' || (s.mode === 'talk' && s.talking === 'moth' && s.line !== 'wait' && s.line !== 'jump'))) {
      // close by your hand, the moth before it
      camAt = tmp.copy(gp).add(V(2.1, 1.75, 0.5));
      camLook = look.copy(gp).add(V(0.2, 1.95, -0.85));
      fov = 46;
    } else if (shown === 'tower' && zone === 'top' && (s.mode === 'leap' || (s.mode === 'talk' && s.talking === 'moth'))) {
      // behind you, out over the edge, to where he comes round
      camAt = tmp.copy(gp).add(V(2.2, 2.6, 4.2));
      camLook = look.copy(gp).add(V(0, -2, -14));
      fov = 58;
    } else {
      // walking: behind, pulled in so no wall comes between (and higher,
      // looking down, the closer it's pulled)
      const yaw = s.camYaw ?? 0;
      let pitch = s.camPitch ?? 0.32;
      const full = s.camDist ?? 6;
      let dist = full;
      look.set(gp.x, gp.y + 1.5, gp.z);
      let boxed = false;
      if (shown === 'hall') {
        boxed = true;
        for (let d = dist; d > 1.6; d -= 0.3) {
          dist = d;
          const cx = look.x + Math.sin(yaw) * Math.cos(pitch) * d;
          const cz = look.z + Math.cos(yaw) * Math.cos(pitch) * d;
          if (indoors(cx, cz, 0.6) && clearView(look.x, look.z, cx, cz)) {
            boxed = false;
            break;
          }
        }
        pitch = Math.min(1, pitch + (full - dist) * 0.07);
        // nowhere clear behind (into a corner, between the cases): from above
        if (boxed) {
          dist = 3.2;
          pitch = 1.35;
        }
      } else if (zone === 'top') {
        // on the pinnacle: pulled in, and up, so no horn comes between
        for (let d = dist; d > 1.6; d -= 0.3) {
          dist = d;
          const p = Math.min(1.1, pitch + (full - d) * 0.09);
          // (along the whole way from the wizard to it, not just where it ends)
          let clear = true;
          for (let f = 0.25; f <= 1 && clear; f += 0.25) {
            const cx = look.x + Math.sin(yaw) * Math.cos(p) * d * f - AT.tower.x;
            const cz = look.z + Math.cos(yaw) * Math.cos(p) * d * f - AT.tower.z;
            clear = !insideTop(cx, look.y + Math.sin(p) * d * f - AT.tower.y, cz);
          }
          if (clear) break;
        }
        pitch = Math.min(1.1, pitch + (full - dist) * 0.09);
      }
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      if (shown === 'hall' && camAt.y < 0.4) camAt.y = 0.4;
      if (zone === 'top' && camAt.y < AT.tower.y + TOWER_H + 0.4 && Math.hypot(camAt.x - AT.tower.x, camAt.z - AT.tower.z) < PIN.r + 1.5) camAt.y = AT.tower.y + TOWER_H + 0.4;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
      if (s.debugCam.fov) fov = s.debugCam.fov;
    }
    const key = `${shown}|${vision ?? ''}|${s.mode}|${s.talking ?? ''}|${zone}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'climb' || s.mode === 'flight' || s.mode === 'moth';
    const ke = jump ? 1 : Math.min(1, dt * (follow ? 6 : 2.6));
    A.cam.at.lerp(camAt, ke);
    A.cam.look.lerp(camLook, ke);
    A.fov += (fov - A.fov) * (jump ? 1 : Math.min(1, dt * 3));
    if (Math.abs(camera.fov - A.fov) > 0.01) {
      camera.fov = A.fov;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(A.cam.at);
    if (A.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * A.shake;
      camera.position.y += (Math.random() - 0.5) * A.shake;
      A.shake = Math.max(0, A.shake - dt * 0.8);
    }
    camera.lookAt(A.cam.look);
    sky.dome.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 80);
    sun.target.position.copy(camera.position);
    const notice = s.mode === 'gaze' ? (gz?.notice ?? 0) : 0;
    stage.grade({
      saturation: vision ? 0.8 : shown === 'hall' ? 0.82 : 0.78,
      contrast: 0.14,
      vignette: vision ? 0.5 + notice * 0.4 : shown === 'hall' ? 0.42 : 0.36,
      grain: vision ? 0.05 : 0.02,
      shadow: vision ? [0.06 + notice * 0.1, 0.01, 0] : [0, 0, 0],
      high: [0, 0, 0],
    });
    for (const g of grounds) g.update();
    // the people on the cast (../../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type) => {
    if (type === 'flash') A.flash = 1;
    else if (type === 'boom') A.shake = Math.max(A.shake, 0.12);
    else if (type === 'found') A.shake = 0.4;
    else if (type === 'cast') A.cast = 1;
    else if (type === 'block') {
      A.block = 1;
      castPlay(gandalf, 'block', { layer: 'upper', fade: 0.06 }); // (on the cast: the staff across)
      A.cast = Math.min(A.cast, 0.4);
      const p = tipOf(gOrb, V());
      for (let i = 0; i < 40 * Math.max(0.5, many); i++) sparks.emit(p.x, p.y, p.z, R(4), R(4), R(4), 0.6 + Math.random() * 0.4, 0.16, 0.02, 1);
    } else if (type === 'push') {
      A.push = 1;
      A.ring = 0;
      // (on the cast: Gandalf's staff thrust, and Saruman driven back a step, staggering)
      castPlay(gandalf, 'cast', { layer: 'upper', fade: 0.06 });
      castPlay(saruman, 'hit.chest', { layer: 'full', fade: 0.06 });
      A.shake = Math.max(A.shake, 0.1);
    } else if (type === 'hit') {
      A.hit = 1;
      castPlay(gandalf, 'hit.chest', { layer: 'full', fade: 0.06 }); // (on the cast: struck, and back a step)
      A.shake = Math.max(A.shake, 0.3);
    } else if (type === 'down') A.down = 1.6;
    else if (type === 'fumble') A.block = Math.max(A.block, 0.3);
    else if (type === 'taken') A.shake = Math.max(A.shake, 0.15);
    else if (type === 'ring') A.ring2 = 0;
    else if (type === 'jump') A.jump = 0.001;
    else if (type === 'reset') {
      A.jump = 0;
      A.down = 0;
      A.ring = -1;
    }
  };

  // ── the floor's light, baked in each zone outdoors when it's first shown ──
  const grounds = [
    groundTown({ place: 'orthanc-tower', renderer, scene, terrain: isenLand, outdoors: zones.tower, sun, height: null, people: movers, skip: [sky.dome, ghosts.group], tier, radius: null, shade: 0x2a2a26, clip: true }),
  ];
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    ground: import.meta.env.DEV ? grounds[0] : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    render,
    fx: fxEvent,
    resize: stage.resize,
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier };
    },
    get lost() {
      return stage.lost;
    },
    dispose() {
      for (const g of grounds) g.dispose();
      for (const [o, m] of robes) o.material = m;
      manyColours.dispose();
      ghosts.dispose();
      disposeTree(scene);
      releaseCast(scene);
      stage.dispose();
    },
  };
}
