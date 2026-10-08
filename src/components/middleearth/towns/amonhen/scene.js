// Amon Hen, in WebGL: the lawn of Parth Galen by the lake in the late
// afternoon, the falls of Rauros smoking at the lake's foot, the woods
// going up the hill with the old kings standing and fallen among them, the
// stair, and the Seat of Seeing on the summit; grey and roaring with the
// Ring on, and the Eye far off in the east. Made in code (./props.js,
// ../ground.js), so nothing is downloaded.
//
// It draws what the component hands it and decides nothing.
//
// createAmonHenWorld(canvas) returns { render(state, ms, fast), fx(type),
// screenOf(kind, id), resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { createHouse } from '../../../../lib/three/house';
import { dress, rolesFor } from '../../../../lib/three/core';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { createParticles } from '../../kit';
import { instances } from '../../shire/ground';
import { LOOKS, sit } from '../../shire/people';
import { makeAtmosphere, makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { createGhosts } from '../ghosts';
import { makeTerrain } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { makeFolk } from '../bree/props';
import { createAmonHenKit } from './props';
import { stoneAt } from './rules';
import { BOATS, CAMP, CAST, COLLIDERS, DECOY_RUN, KINGS, LAKE_Y, PILLARS, SEAT, SHORE_SPOT, SKIPPERS, SKIPPING, STAIR, STICKS, TREES, height, shoreX, toPath } from './layout';
import { attend, castDo, castPlay, drawWatcher, releaseCast, tickCast, upgrade } from '../../cast3d';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// where the Eye is, far off in the east, and how big
const EYE_AT = V(560, -10, -60);
const EYE_SCALE = 4;

const LOOKS_HERE = {
  frodo: LOOKS.frodo,
  sam: { ...LOOKS.sam, pack: true },
  merry: LOOKS.merry,
  pippin: LOOKS.pippin,
  aragorn: { tall: 1.5, coat: 0x3e3a34, shirt: 0x5a5246, cloak: 0x4a5444, hairStyle: 'long', hair: 0x2a1e16, beard: { color: 0x2a1e16, len: 0.12 }, item: 'sword', feet: 'boots', seed: 7 },
  gimli: { tall: 0.95, wide: 1.35, coat: 0x6a3a22, shirt: 0x8a8f98, hat: 'helm', hairStyle: 'none', hair: 0x9a3a1a, beard: { color: 0xa8441c, len: 0.5 }, item: 'axe', feet: 'boots', seed: 11 },
  legolas: { tall: 1.5, coat: 0x5a6a3a, shirt: 0x7a7a5a, hairStyle: 'long', hair: 0xf2e4b0, item: 'bow', feet: 'boots', seed: 15 },
  boromir: { tall: 1.55, coat: 0x6a2a22, shirt: 0x5a4a3a, cloak: 0x4a5444, hairStyle: 'long', hair: 0x5a3a22, beard: { color: 0x5a3a22, len: 0.1 }, item: 'horn', feet: 'boots', seed: 19 },
};
const folk = (look) => makeFolk(look, { look: LOOKS_HERE[look] });

const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x6a7a34);
const GRASS_GOLD = C(0x9a8a3a);
const LITTER = C(0x5a4a26);
const MOSS = C(0x3e4e22);
const PATHC = C(0x8a7a5a);
const STONE = C(0x8a8a80);
const SAND = C(0x9a8e6a);
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const noise = makeNoise(83);
function paint(x, z, h, out) {
  // the lawn, then leaf litter and moss under the trees
  const wood = smooth(18, 8, x);
  lerp3(out, GRASS, GRASS_GOLD, smooth(0.4, 0.7, fbm(noise, x * 0.06, z * 0.06, { octaves: 3 })) * 0.6);
  lerp3(out, out, LITTER, wood * 0.85);
  lerp3(out, out, MOSS, wood * smooth(0.5, 0.75, fbm(noise, x * 0.1 + 4, z * 0.1, { octaves: 2 })) * 0.7);
  const p = 1 - smooth(0.9, 2, toPath(x, z));
  if (p > 0) lerp3(out, out, PATHC, p * 0.7);
  // pale stone on the summit
  const d = Math.hypot(x - SEAT.x, z - SEAT.z);
  if (d < SEAT.r + 4) lerp3(out, out, STONE, (1 - smooth(SEAT.r, SEAT.r + 4, d)) * 0.6);
  // the beach
  lerp3(out, out, SAND, smooth(shoreX(z) - 4, shoreX(z) - 0.5, x) * 0.8);
  return out;
}

// late afternoon gold (day), the same going grey for the Ring (unused
// slots copy it)
const MOODS = {
  day: { top: 0x6a8ab8, horizon: 0xf0dcb0, sun: [0.55, 0.32, 0.4], sunColour: 0xffd8a0, sunPower: 2.3, hemiSky: 0xe0dcc0, hemiGround: 0x4a4a2a, hemi: 1.0, fog: 0xc8c4a8, fogNear: 40, fogFar: 300, cloud: 0.4, cloudColour: 0xfff0d8, stars: 0, exposure: 1.02, water: 0x7a9aa8, deep: 0x1e3038 },
};
MOODS.night = MOODS.day;
MOODS.dawn = MOODS.day;
const RING_FOG = new THREE.Color(0x5a5a5e);

export function createAmonHenWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 52, near: 0.1, far: 1200, bloom: { strength: 0.55, radius: 0.55, threshold: 0.85 }, onLost });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0xc8c4a8, 40, 300);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0xe0dcc0, 0x4a4a2a, 1);
  const sun = new THREE.DirectionalLight(0xffd8a0, 2.2);
  scene.add(hemi, sun, sun.target);
  const POOL = 3;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(1000);
  scene.add(sky.dome);
  const water = { uniforms: { uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSun: { value: V(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlints: { value: 1 } } };
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water, stage, house: houseLook, moods: MOODS });

  const kit = createAmonHenKit(renderer);
  const mats = kit.mats ?? {};
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });
  const land = new THREE.Group();
  scene.add(land);

  // ── the ground and the lake ──
  const terrain = makeTerrain(renderer, { size: 340, seg: tier === 'high' ? 230 : tier === 'mid' ? 170 : 110, height, paint, blades: 0.12 });
  land.add(terrain);
  const lakeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        vec2 p = vWorld.xz * 0.3;
        float n = noise(p + uTime * 0.07) * 0.5 + noise(p * 2.4 - uTime * 0.1) * 0.5;
        vec3 nrm = normalize(vec3((n - 0.5) * 0.28, 1.0, (noise(p * 1.7 + 3.0) - 0.5) * 0.28));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.2 + fres * 0.75);
        col += uSunColor * pow(max(dot(reflect(-normalize(uSun), nrm), view), 0.0), 120.0) * 2.0;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) lakeMat.uniforms[k] = water.uniforms[k];
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), lakeMat);
  lake.position.set(shoreX(0) + 440, LAKE_Y, 0);
  land.add(lake);
  // the far shore: the hills of the Emyn Muil, grey-green
  {
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x5a6a52 });
    const rand = (() => {
      let s = 5;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), hillMat);
      m.scale.set(60 + rand() * 50, 26 + rand() * 30, 40 + rand() * 30);
      m.position.set(300 + rand() * 60, LAKE_Y - 2, -260 + i * 62 + rand() * 20);
      land.add(m);
    }
  }
  const rauros = kit.rauros?.();
  if (rauros) {
    rauros.group.position.set(150, LAKE_Y - 1, 260);
    rauros.group.rotation.y = Math.PI - 0.4;
    land.add(rauros.group);
  }

  // ── the woods ──
  const foliage = mats.tree ?? mats.foliage ?? new THREE.MeshLambertMaterial({ vertexColors: true });
  const lists = [[], []];
  for (const [x, z, kind, seed] of TREES) lists[kind].push({ x, z, y: height(x, z) - 0.2, s: 0.85 + (seed % 40) / 100, turn: seed * 0.37 });
  // (the near woods, hidden when you see far from the Seat)
  const woods = [];
  if (kit.pine) woods.push(land.add(instances(kit.pine(1), foliage, lists[0], { shadow: false })).children.at(-1));
  if (kit.beech) woods.push(land.add(instances(kit.beech(2), foliage, lists[1], { shadow: false })).children.at(-1));
  // and a ring of them past where you can walk
  {
    const far = [[], []];
    const rand = (() => {
      let s = 23;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    for (let i = 0; i < Math.round(160 * Math.max(0.5, many)); i++) {
      const side = i % 3;
      const x = side === 0 ? -96 - rand() * 50 : -140 + rand() * 170;
      const z = side === 0 ? (rand() - 0.5) * 220 : side === 1 ? -60 - rand() * 50 : 60 + rand() * 50;
      if (x > shoreX(z) - 4) continue;
      far[i % 2].push({ x, z, y: height(x, z) - 0.3, s: 0.9 + rand() * 0.4, turn: rand() * TAU });
    }
    if (kit.pine) land.add(instances(kit.pine(3), foliage, far[0], { shadow: false }));
    if (kit.beech) land.add(instances(kit.beech(4), foliage, far[1], { shadow: false }));
  }
  // ferns, mossy rocks and broken pillars
  {
    const rand = (() => {
      let s = 31;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    const ferns = [];
    const rocks = [];
    for (let i = 0; i < 4000 && ferns.length < 320 * many; i++) {
      const x = -90 + rand() * 106;
      const z = -54 + rand() * 108;
      if (toPath(x, z) < 2.2 || Math.hypot(x - SEAT.x, z - SEAT.z) < SEAT.r + 2) continue;
      if (COLLIDERS.some((c) => c.kind === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + 0.3)) continue;
      if (rand() < 0.86) ferns.push({ x, z, y: height(x, z), s: 0.7 + rand() * 0.8, turn: rand() * TAU });
      else rocks.push({ x, z, y: height(x, z) - 0.3, s: 0.6 + rand() * 0.9, turn: rand() * TAU });
    }
    // (the fronds are wound both ways with their normals up: single-sided)
    const green = mats.fern ?? new THREE.MeshLambertMaterial({ vertexColors: true });
    const stone = mats.stone ?? new THREE.MeshLambertMaterial({ vertexColors: true });
    if (kit.fern) land.add(instances(kit.fern(5), green, ferns, { shadow: false }));
    if (kit.mossRock) land.add(instances(kit.mossRock(6), stone, rocks, { shadow: false }));
    if (kit.pillar) land.add(instances(kit.pillar(7), stone, PILLARS.map(([x, z, turn]) => ({ x, z, y: height(x, z) - 0.1, turn })), { shadow: false }));
  }
  // the kings
  for (const [kind, x, z, turn] of KINGS) {
    const k = kit.king({ kind });
    k.group.position.set(x, height(x, z) - (kind === 'head' ? 0.6 : 0.15), z);
    k.group.rotation.y = turn;
    land.add(k.group);
  }
  // the stair, and the Seat looking out east
  const stairRise = height(STAIR.x1, STAIR.z) - height(STAIR.x0, STAIR.z);
  const stair = kit.ruinStair({ len: Math.abs(STAIR.x1 - STAIR.x0), w: STAIR.w, rise: stairRise });
  stair.group.position.set(STAIR.x0, height(STAIR.x0, STAIR.z) - 0.05, STAIR.z);
  stair.group.rotation.y = Math.PI;
  land.add(stair.group);
  const seat = kit.seat();
  const seatY = height(SEAT.x, SEAT.z);
  seat.group.position.set(SEAT.x, seatY - 0.05, SEAT.z);
  seat.group.rotation.y = Math.PI;
  land.add(seat.group);
  seat.group.updateMatrixWorld(true);
  const sitAt = (seat.sit ?? V(0, 1.6, 0)).clone().applyMatrix4(seat.group.matrixWorld);
  // the camp, the boats drawn up, the firewood
  const camp = kit.camp();
  camp.group.position.set(CAMP.x, height(CAMP.x, CAMP.z), CAMP.z);
  land.add(camp.group);
  for (const b of BOATS) {
    const boat = kit.boat();
    boat.group.position.set(b.x, Math.max(LAKE_Y, height(b.x, b.z)) + 0.02, b.z);
    boat.group.rotation.y = b.turn;
    land.add(boat.group);
  }
  const sticks = STICKS.map(([x, z], i) => {
    const m = new THREE.Mesh(kit.stick(i + 1), mats.wood ?? new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.set(x, height(x, z) + 0.05, z);
    m.rotation.y = i * 1.3;
    land.add(m);
    return m;
  });
  // the boat you push out, and Sam in the water
  const myBoat = kit.boat();
  land.add(myBoat.group);
  // on the side, ducks and drakes: a little heap of flat stones on the
  // shore, the one in the air, and the rings where it meets the water
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.85 });
  const pebbleGeo = new THREE.SphereGeometry(0.09, 9, 6).scale(1, 0.32, 0.8);
  {
    const heap = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(pebbleGeo, pebbleMat);
      const a = i * 2.4;
      const r = 0.12 + (i % 3) * 0.1;
      p.position.set(Math.cos(a) * r, 0.03 + (i > 5 ? 0.05 : 0), Math.sin(a) * r);
      p.rotation.set(0.2 * Math.sin(i), a, 0.15 * Math.cos(i * 3));
      p.scale.setScalar(0.8 + (i % 4) * 0.12);
      heap.add(p);
    }
    const hx = SKIPPING.x - 0.9;
    const hz = SKIPPING.z - 0.9;
    heap.position.set(hx, height(hx, hz), hz);
    land.add(heap);
  }
  const stone = new THREE.Mesh(pebbleGeo, pebbleMat);
  stone.visible = false;
  land.add(stone);
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xf2f6f8, transparent: true, opacity: 0, depthWrite: false });
  const rippleGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(rippleGeo, rippleMat.clone());
    m.visible = false;
    m.renderOrder = 2;
    land.add(m);
    return { m, age: 9, big: 1 };
  });
  // the Eye, far off, for the Seat
  const eye = kit.eye();
  eye.group.position.copy(EYE_AT);
  eye.group.scale.setScalar(EYE_SCALE);
  eye.group.visible = false;
  scene.add(eye.group);

  // ── people ──
  // (each stands on a soft blob slid away from the sun, and dims in the
  // baked shade: ../grounded.js)
  const movers = [];
  const blob = (f, s = 1) => {
    movers.push({ object: f.group, size: [FIGURE * s, FIGURE * s] });
    return f;
  };
  const frodo = blob(folk('frodo'));
  scene.add(frodo.group);
  const ghosts = createGhosts({ height });
  land.add(ghosts.group);
  const people = {};
  for (const c of CAST) {
    const p = blob(folk(c.look));
    p.group.visible = false;
    land.add(p.group);
    people[c.id] = p;
  }
  const boromir = blob(folk('boromir'));
  boromir.group.visible = false;
  land.add(boromir.group);
  const aragorn = blob(folk('aragorn'));
  aragorn.group.visible = false;
  land.add(aragorn.group);
  const sam = folk('sam');
  sam.group.visible = false;
  land.add(sam.group);
  // Merry and Pippin by the water, watching your stones
  const skippers = SKIPPERS.map((c) => {
    const p = blob(folk(c.look));
    p.group.visible = false;
    land.add(p.group);
    return { ...c, p };
  });
  const uruks = Array.from({ length: 6 }, (_, i) => {
    const u = kit.uruk(i + 1, { lurtz: i === 0 });
    u.group.visible = false;
    land.add(u.group);
    // on the cast once its model's here (../../cast3d.js): the Uruk-hai, as
    // tall as this one, its own body hidden (and kept, should it not come)
    const tall = new THREE.Box3().setFromObject(u.group).getSize(V()).y * 0.95;
    upgrade(u, 'uruk', { role: 'folk', hide: [...u.group.children], top: tall, seed: i + 1 });
    return u;
  });

  // ── light and air ──
  const motes = createParticles(Math.round(300 * Math.max(0.4, many)), {
    ramp: [
      [0, 1, 0.92, 0.6, 0],
      [0.2, 1, 0.9, 0.55, 0.6],
      [0.8, 1, 0.85, 0.5, 0.5],
      [1, 1, 0.8, 0.45, 0],
    ],
    additive: true,
    gravity: 0.02,
    drag: 0.8,
    swirl: 0.6,
  });
  scene.add(motes.mesh);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;

  // ── state ──
  const A = { t: 0, cam: { at: V(0, 4, 10), look: V(0, 2, -10) }, mode: '', shake: 0, ring: 0, gaze: 0, motes: 0, first: true };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const fireCol = new THREE.Color(0xff6a20);
  const turnTo = (p, face, dt, k = 4) => {
    let d = face - p.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.group.rotation.y += d * Math.min(1, dt * k);
  };
  const lakeAt = (x, z) => Math.max(LAKE_Y, height(x, z));

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    sky.uniforms.uTime.value = t;
    lakeMat.uniforms.uTime.value = t;
    rauros?.update?.(t);
    const h = s.hobbit;
    const lights = [];

    // ── the light, and the Ring's grey ──
    const sunDir = atmosphere(0, 0);
    A.ring += ((s.ring ? 1 : 0) - A.ring) * (A.first ? 1 : Math.min(1, dt * 3));
    A.first = false;
    const gazing = s.seat?.on ? 1 : 0;
    A.gaze += (gazing - A.gaze) * Math.min(1, dt * 6);
    sky.uniforms.uGrey.value = A.ring * 0.85;
    sky.uniforms.uEye.value = A.ring * (0.3 + 0.7 * A.gaze);
    stage.grade({ saturation: 1.04 - A.ring * 0.9, contrast: 0.08 + A.ring * 0.2, vignette: 0.24 + A.ring * 0.4 + A.gaze * 0.2, grain: 0.012, shadow: [0.02 + A.gaze * 0.08, 0.02, 0.03 + A.ring * 0.05], high: [0.05 + A.gaze * 0.15, 0.03, 0.0] });
    // (the fog's own colour while it's this, not the sky's)
    houseLook.set({ fogMix: 1 - A.ring * 0.8 });
    if (A.ring > 0.01) {
      scene.fog.near *= 1 - A.ring * 0.7;
      scene.fog.far *= 1 - A.ring * 0.5;
      scene.fog.color.lerp(RING_FOG, A.ring * 0.8);
    }
    // on the Seat, the fog draws back: you see far
    const seeing = s.onSeat && A.ring > 0.3;
    if (seeing) {
      scene.fog.near = 200;
      scene.fog.far = 1100;
    }

    // ── Frodo ──
    let fy = height(h.x, h.z);
    sit(frodo, false);
    castDo(frodo, { upper: null, look: null }); // (on the cast: set below, frame by frame)
    frodo.group.visible = A.ring < 0.5 || seeing;
    if (s.onSeat) {
      frodo.group.position.copy(sitAt);
      frodo.group.rotation.set(0, 0, 0);
      sit(frodo, true);
      pose(frodo, t, { moving: false });
      fy = sitAt.y;
      if (s.aragorn) {
        // stood, by the Seat, as Aragorn comes up
        frodo.group.position.set(SEAT.x + 2.4, seatY + 1.05, SEAT.z + 0.6);
        frodo.group.rotation.y = 0;
        sit(frodo, false);
      }
    } else if (s.mode === 'rescue' || s.promise || s.mode === 'end') {
      // in the boat, out on the water
      const gap = s.rescue?.gap ?? 1;
      const bx = SHORE_SPOT.x + 7 + gap;
      myBoat.group.visible = true;
      myBoat.group.position.set(bx, LAKE_Y + 0.05 + Math.sin(t * 1.6) * 0.04, SHORE_SPOT.z);
      myBoat.group.rotation.set(0, Math.PI, Math.sin(t * 1.9) * 0.04);
      myBoat.group.updateMatrixWorld(true);
      frodo.group.position.copy(myBoat.seats?.[1] ?? V(-0.8, 0.3, 0)).applyMatrix4(myBoat.group.matrixWorld);
      frodo.group.rotation.set(0, Math.PI, 0);
      sit(frodo, true);
      pose(frodo, t, { moving: false, wave: s.mode === 'rescue' ? 0.5 + Math.sin(t * 3) * 0.3 : 0 });
      // (on the cast: reaching out over the side for Sam the whole while)
      castDo(frodo, { upper: s.mode === 'rescue' ? 'wave.help' : null, look: s.mode === 'rescue' ? sam : null });
      fy = frodo.group.position.y;
    } else {
      frodo.group.position.set(h.x, fy, h.z);
      frodo.group.rotation.set(0, h.face, 0);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
      const sk = s.skipping;
      if (sk) {
        // side-on to the water, the throwing arm back, then whipped round low
        frodo.group.rotation.y = SKIPPING.face + 0.5;
        frodo.body.rotation.z = sk.phase === 'flying' ? 0.12 : -0.18;
        const arm = frodo.arms?.[1];
        if (arm) {
          const k = sk.thrown < 0.35 ? sk.thrown / 0.35 : 1;
          arm.rotation.x = sk.phase === 'flying' || sk.phase === 'done' ? -1.2 + k * 2.4 : -1.4 - Math.sin(t * 2) * 0.1;
        }
      } else frodo.body.rotation.z = 0;
      // (on the cast: the throw, once, as the stone goes)
      if (sk?.phase === 'flying' && A.threw !== sk.throws) {
        A.threw = sk.throws;
        castPlay(frodo, 'cast', { layer: 'upper', fade: 0.08 });
      }
    }
    if (!(s.mode === 'rescue' || s.promise || s.mode === 'end')) myBoat.group.visible = false;
    ghosts.update(s.travellers ?? [], t, dt, { ringOn: Boolean(s.ring) });

    // ── who's about ──
    for (const c of CAST) {
      const p = people[c.id];
      const on = s.cast?.includes(c.id) && !(c.id.endsWith('decoy') && s.decoyed);
      p.group.visible = Boolean(on);
      if (!on) continue;
      p.group.position.set(c.x, height(c.x, c.z), c.z);
      // they turn to Frodo as he comes by: on the cast the head first, a greeting the first time
      attend(p, h, c.face, dt, { who: frodo });
      pose(p, t + c.x, { moving: false, talk: s.talk === c.id ? 1 : 0 });
    }
    // Merry and Pippin, running off with the Uruk-hai after them
    if (s.decoyed) {
      for (const [id, off] of [
        ['merry-decoy', 0],
        ['pippin-decoy', 1.2],
      ]) {
        const p = people[id];
        const d = s.drawn?.[0];
        const k = Math.min(1, (d?.t ?? 0) / 7);
        p.group.visible = k < 1;
        if (!p.group.visible) continue;
        const x = DECOY_RUN.x * k + (CAST.find((c) => c.id === id).x) * (1 - k) + off;
        const z = DECOY_RUN.z * k + (CAST.find((c) => c.id === id).z) * (1 - k);
        p.group.position.set(x, height(x, z), z);
        p.group.rotation.y = Math.atan2(-(DECOY_RUN.z - z), DECOY_RUN.x - x);
        // (on the cast: running, arms up and calling the Uruks after them)
        castDo(p, { upper: 'wave.help' });
        pose(p, t + off, { moving: true, speed: 1.6, wave: p.cast?.ready ? 0 : Math.sin(t * 8) > 0 ? 1 : 0 });
      }
    }
    // Boromir, in the glade
    const b = s.boromir;
    boromir.group.visible = Boolean(b);
    if (b) {
      boromir.group.position.set(b.x, height(b.x, b.z), b.z);
      // on the cast: talking, his eyes on you and his body turned over a
      // moment; hunting, his head on you and no hand raised (the toy's arm
      // was all it had); a lunge for the Ring when he has you
      if (b.mode === 'talk') {
        if (boromir.cast?.ready) attend(boromir, h, Math.atan2(-(h.z - b.z), h.x - b.x), dt, { who: frodo, near: 30, greet: false });
        else boromir.group.rotation.y = Math.atan2(-(h.z - b.z), h.x - b.x);
        castDo(boromir, { upper: null, look: frodo });
      } else {
        turnTo(boromir, b.face, dt, 8);
        drawWatcher(boromir, b, dt, { you: frodo, blow: 'collect' });
      }
      const hunting = b.mode === 'alert' || b.mode === 'chase';
      pose(boromir, t, { moving: b.mode === 'chase' || (b.mode === 'patrol' && b.wait <= 0) || b.mode === 'back', speed: hunting ? 1.5 : 1, talk: s.speaker === 'boromir' ? 1 : 0, wave: hunting && !boromir.cast?.ready ? 0.8 : 0 });
    }
    // Aragorn, coming up to the Seat
    aragorn.group.visible = Boolean(s.aragorn);
    if (s.aragorn) {
      const k = Math.min(1, s.stepT / 2.5);
      const x = SEAT.x + 9 - k * 3.4;
      aragorn.group.position.set(x, height(x, SEAT.z + 0.6) + (x < SEAT.x + SEAT.r ? 1 : 0), SEAT.z + 0.6);
      aragorn.group.rotation.y = Math.PI;
      pose(aragorn, t, { moving: k < 1, talk: s.speaker === 'aragorn' ? 1 : 0 });
    }
    // Sam: in the water, then in the boat
    sam.group.visible = Boolean(s.rescue) || s.promise || s.mode === 'end';
    if (s.rescue && !s.rescue.got) {
      const bx = SHORE_SPOT.x + 7 + s.rescue.gap;
      const sx = bx - s.rescue.gap - 0.4;
      sit(sam, false);
      const bob = s.rescue.up ? -0.55 + Math.sin(t * 6) * 0.06 : -1.6;
      sam.group.position.set(sx, LAKE_Y + bob, SHORE_SPOT.z + 0.3);
      sam.group.rotation.y = 0;
      // (on the cast: treading water, his arm up for Frodo's hand)
      castDo(sam, { base: 'swim.idle', upper: s.rescue.up ? 'wave.help' : null, look: frodo });
      pose(sam, t, { moving: false, wave: s.rescue.up && !sam.cast?.ready ? 1 : 0 });
    } else if (sam.group.visible) {
      sam.group.position.copy(myBoat.seats?.[0] ?? V(0.9, 0.3, 0)).applyMatrix4(myBoat.group.matrixWorld);
      sam.group.rotation.y = Math.PI;
      castDo(sam, { base: null, upper: null, look: s.speaker === 'sam' || s.promise ? frodo : null });
      sit(sam, true);
      pose(sam, t, { moving: false, talk: s.speaker === 'sam' ? 1 : 0 });
    }
    // the Uruk-hai: hunting through the woods, and the two drawn off
    const list = s.uruks ?? [];
    uruks.forEach((u, i) => {
      const w = list[i];
      const d = !w ? s.drawn?.[i - list.length] : null;
      u.group.visible = Boolean(w || (d && d.t < 8));
      if (w) {
        u.group.position.set(w.x, height(w.x, w.z), w.z);
        // (on the cast its head does the looking about; the toy turned its whole self)
        turnTo(u, w.face + (u.cast?.ready ? 0 : (w.look ?? 0)), dt, 8);
        const hunting = w.mode === 'alert' || w.mode === 'chase';
        if (!drawWatcher(u, w, dt, { you: frodo })) u.animate?.(t + i, { running: w.mode === 'chase' || w.mode === 'back' || (w.mode === 'patrol' && w.wait <= 0), swing: w.mode === 'chase' ? Math.max(0, Math.sin(t * 4)) : 0, look: hunting ? 0 : (w.look ?? 0) });
      } else if (d) {
        const k = Math.min(1, d.t / 8);
        const x = d.x + (DECOY_RUN.x - d.x) * k;
        const z = d.z + (DECOY_RUN.z - d.z) * k;
        u.group.position.set(x, height(x, z), z);
        u.group.rotation.y = Math.atan2(-(DECOY_RUN.z - z), DECOY_RUN.x - x);
        castDo(u, { upper: null, look: null });
        u.animate?.(t + i, { running: true });
      }
    });

    // ── ducks and drakes: Merry and Pippin, the stone, the rings ──
    const sk = s.skipping;
    for (const c of skippers) {
      c.p.group.visible = Boolean(sk);
      if (!sk) continue;
      c.p.group.position.set(c.x, height(c.x, c.z), c.z);
      turnTo(c.p, sk.phase === 'flying' ? 0 : c.face, dt, 3);
      const cheering = sk.cheer && sk.phase === 'done';
      // on the cast: eyes on the stone as it skips, a cheer (each his own) when it's a good one
      const going = cheering && (c.look === 'pippin' || sk.cheer > 1);
      if (going && !c.cheered) castPlay(c.p, c.look === 'pippin' ? 'cheer.up' : 'fist.pump');
      c.cheered = going;
      castDo(c.p, { look: stone.visible ? stone : null });
      pose(c.p, t + c.x, { moving: false, talk: s.speaker === c.look ? 1 : 0, wave: going && !c.p.cast?.ready ? 0.6 + Math.sin(t * 9) * 0.3 : 0 });
    }
    // the stone, out of your hand (about a metre over the shore) and along the water
    const at = sk?.touches && sk.phase === 'flying' ? stoneAt(sk.touches, sk.thrown, 0.95 + height(SKIPPING.x, SKIPPING.z) - LAKE_Y) : null;
    stone.visible = Boolean(at);
    if (at) {
      stone.position.set(SKIPPING.x + 0.3 + at.d, LAKE_Y + 0.04 + at.y, SKIPPING.z - 0.15);
      stone.rotation.y = t * 25;
    }
    for (const r of ripples) {
      r.age += dt;
      const on = r.age < 2.2;
      r.m.visible = on;
      if (!on) continue;
      const k = r.age / 2.2;
      r.m.scale.setScalar(0.15 + k * 1.6 * r.big);
      r.m.material.opacity = (1 - k) * 0.55;
    }

    // ── the firewood ──
    sticks.forEach((m, i) => (m.visible = s.next === 'camp' && !s.sticks?.includes(i)));

    // ── the Eye ──
    eye.group.visible = seeing;
    for (const w of woods) w.visible = !seeing;
    if (seeing) {
      eye.update?.(t, 0.5 + A.gaze * 0.5);
      lights.push([tmp2.copy(sitAt).add(V(3, 3, 0)).clone(), fireCol, A.gaze * 6, 20]);
    }

    // motes of light in the woods' sunbeams
    A.motes += dt * 12 * Math.max(0.4, many) * (1 - A.ring);
    while (A.motes > 1) {
      A.motes -= 1;
      const at = frodo.group.position;
      motes.emit(at.x + R(14), at.y + 1 + Math.random() * 6, at.z + R(14), R(0.1), R(0.05), R(0.1), 5, 0.05, 0.04, 0.6);
    }
    motes.step(dt);
    fx.step(dt, t, { night: 0, day: 1 });
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
    if (s.onSeat && !s.aragorn) {
      // up over Frodo's head, out east over the land to the Eye
      camAt = tmp.copy(sitAt).add(V(-0.6, 2.7 + A.gaze * 0.2, 0.8));
      camLook = seeing ? look.copy(EYE_AT).add(V(0, 110, 0)) : look.set(sitAt.x + 40, sitAt.y, sitAt.z);
    } else if (s.mode === 'talk' && s.camShot?.at) {
      const [ax, ay, az] = s.camShot.at;
      const [lx, ly, lz] = s.camShot.look;
      camAt = tmp.set(ax, height(ax, az) + ay, az);
      camLook = look.set(lx, height(lx, lz) + ly, lz);
    } else if (s.mode === 'skipping' && s.skipping) {
      // up on the shore behind you and to your left, Merry and Pippin on
      // your right, looking out over the water after the stone
      const out = Math.min(30, s.skipping.out ?? 0);
      const gy = height(SKIPPING.x, SKIPPING.z);
      camAt = tmp.set(SKIPPING.x - 4.2, gy + 2.9, SKIPPING.z - 2.6);
      camLook = look.set(SKIPPING.x + 10 + out * 0.5, LAKE_Y + 0.2, SKIPPING.z + 1.2);
    } else if (s.mode === 'rescue' || s.promise || s.mode === 'end') {
      const bx = myBoat.group.position.x;
      camAt = tmp.set(bx + 4.5, LAKE_Y + 2.6, SHORE_SPOT.z - 3.5);
      camLook = look.set(bx - 2.5, LAKE_Y + 0.4, SHORE_SPOT.z);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.34;
      const dist = s.camDist ?? 6.4;
      look.set(h.x, fy + 1.1, h.z);
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const k = clearance(look, camAt);
      if (k < 1) camAt.lerpVectors(look, camAt, Math.max(0.25, k));
      const floor = lakeAt(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const key = `${s.mode}|${s.camShot?.id ?? ''}|${s.onSeat}|${s.aragorn}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'skipping';
    const ke = jump ? 1 : Math.min(1, dt * (follow ? 7 : 2.4));
    A.cam.at.lerp(camAt, ke);
    A.cam.look.lerp(camLook, ke);
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
    ground.update();
    // the people on the cast (../../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type, id) => {
    if (type === 'grab') A.shake = 0.3;
    else if (type === 'eye') A.shake = 0.35;
    else if (type === 'gaze') A.shake = Math.max(A.shake, 0.12);
    else if (type === 'got') fx.pop(tmp2.copy(frodo.group.position).add(V(0, 1, 0)), 'gold', 12, 1);
    else if (type === 'splash' && id) {
      // a stone meeting the water `id.d` out from the shore: a ring, and spray
      const r = ripples.reduce((a, b) => (b.age > a.age ? b : a));
      r.age = 0;
      r.big = id.sinks ? 1.3 : 0.7 + Math.min(0.6, id.k * 0.6);
      r.m.position.set(SKIPPING.x + 0.3 + id.d, LAKE_Y + 0.03, SKIPPING.z - 0.15);
      fx.pop(tmp2.set(SKIPPING.x + 0.3 + id.d, LAKE_Y + 0.1, SKIPPING.z - 0.15), 'white', id.sinks ? 10 : 5, id.sinks ? 1.1 : 0.7);
    }
  };
  const screenOf = (kind, id) => {
    const p0 = people[id];
    if (kind !== 'cast' || !p0 || !p0.group.visible) return null;
    const p = p0.group.getWorldPosition(tmp).add(tmp2.set(0, 2.2, 0)).project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };

  // ── the floor's light, baked when the town is first drawn ──
  // (the woods keep some sun on their floor: the bake's sun never reaches it
  // under the crowns, and by the sky's term alone it went black)
  const ground = groundTown({ place: 'amonhen', renderer, scene, terrain, outdoors: land, sun, height, people: movers, skip: [sky.dome, ghosts.group], tier, centre: [-25, 0], radius: 72, shade: 0x2e2a1e, sunFloor: 0.4 });
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    ground: import.meta.env.DEV ? ground : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    render,
    fx: fxEvent,
    screenOf,
    resize: stage.resize,
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier };
    },
    get lost() {
      return stage.lost;
    },
    get suggestYaw() {
      return null;
    },
    dispose() {
      ground.dispose();
      ghosts.dispose();
      disposeTree(scene);
      releaseCast(scene);
      stage.dispose();
    },
  };
}

// What the camera can't go through: the trunks and the kings.
const BLOCKERS = COLLIDERS.filter((c) => c.kind === 'circle' && !c.low);
function clearance(from, to) {
  const N = 10;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    const x = from.x + (to.x - from.x) * k;
    const z = from.z + (to.z - from.z) * k;
    for (const c of BLOCKERS) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return Math.max(0.2, (i - 1) / N);
  }
  return 1;
}
