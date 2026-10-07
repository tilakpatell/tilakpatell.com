// The Emyn Muil, the Dead Marshes and the Black Gate, in WebGL: jagged rock
// under a storm, the cliff and the rope, Gollum coming down head first by
// night; the marshes in their grey mist, the lights in the pools and the
// faces under them, a Nazgûl passing over; then the ash slope above the
// Morannon, the Easterlings on the road, and the Gate. Made in code
// (./props.js, ../ground.js), so nothing is downloaded.
//
// The three places are drawn apart in one scene, and only the one you're
// in is shown. It draws what the component hands it and decides nothing.
//
// createMarshesWorld(canvas) returns { render(state, ms, fast), fx(type),
// screenOf(), resize, dispose, lost, info }.

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
import { createMarshesKit } from './props';
import { BED, BOULDERS, EMYN, GATE_AT, ISLAND, LIGHTS, LOOKOUT, MARSH_PATH, MARSH_Y, POOL as SAFE, POOL_BANK, ROAD, SNAGS, SPIKES, emynHeight, marshHeight, slopeHeight, toPath, tussockAt } from './layout';
import { CREEP, FELL, ROPE, WAY } from './rules';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// where each place is drawn
const AT = { emyn: V(0, 0, 0), marsh: V(1500, 0, 0), gate: V(3000, 0, 0) };
const HEIGHT = { emyn: emynHeight, marsh: marshHeight, gate: slopeHeight };

const LOOKS_HERE = { frodo: LOOKS.frodo, sam: { ...LOOKS.sam, pack: true } };
const folk = (look) => makeFolk(look, { look: LOOKS_HERE[look] });

const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const noise = makeNoise(51);
const ROCK = C(0x5a5a58);
const ROCK_DARK = C(0x34363a);
const MUD = C(0x2a2a1c);
const TUSSOCK = C(0x6a6a3a);
const ASH = C(0x4a423a);
const ASH_PALE = C(0x7a6e60);
const paints = {
  emyn: (x, z, h, out) => lerp3(out, ROCK_DARK, ROCK, smooth(0.35, 0.7, fbm(noise, x * 0.2, z * 0.2, { octaves: 3 }))),
  marsh: (x, z, h, out) => {
    lerp3(out, MUD, TUSSOCK, 1 - smooth(1.6, 3.2, toPath(x, z, MARSH_PATH)));
    return lerp3(out, out, C(0x4a5a2a), smooth(0.55, 0.8, fbm(noise, x * 0.1, z * 0.1, { octaves: 2 })) * 0.5);
  },
  gate: (x, z, h, out) => lerp3(out, ASH, ASH_PALE, smooth(0.4, 0.75, fbm(noise, x * 0.05 + 3, z * 0.05, { octaves: 3 }))),
};

// the three places' skies: the storm at dusk (day) going to night, the
// marsh's grey (dawn slot), the ash-red over the Gate (set by hand)
const MOODS = {
  day: { top: 0x2a3444, horizon: 0x7a8088, sun: [0.2, 0.4, 0.6], sunColour: 0xb8c0d0, sunPower: 0.9, hemiSky: 0x8a96a8, hemiGround: 0x2a2a2a, hemi: 0.9, fog: 0x4a525a, fogNear: 20, fogFar: 140, cloud: 0.85, cloudColour: 0x4a5260, stars: 0, exposure: 1.15, water: 0x4a5a5a, deep: 0x0e1414 },
  night: { top: 0x04060c, horizon: 0x18202e, sun: [0.3, 0.6, 0.4], sunColour: 0x9ab0e0, sunPower: 0.85, hemiSky: 0x5a6a90, hemiGround: 0x14141a, hemi: 1.15, fog: 0x0a0e16, fogNear: 14, fogFar: 90, cloud: 0.4, cloudColour: 0x1a2030, stars: 0.6, exposure: 1.5, water: 0x1a2430, deep: 0x04060a },
  dawn: { top: 0x5a6458, horizon: 0xa8ae98, sun: [0.4, 0.5, 0.3], sunColour: 0xd8d8c0, sunPower: 0.8, hemiSky: 0xa8b098, hemiGround: 0x2a2e20, hemi: 1.0, fog: 0x7a8270, fogNear: 8, fogFar: 85, cloud: 0.9, cloudColour: 0x8a907e, stars: 0, exposure: 1.1, water: 0x4a5444, deep: 0x0a0e08 },
};
const GATE_SKY = { top: 0x1a1210, horizon: 0x8a4a2a, fog: 0x4a3a30 };

export function createMarshesWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 52, near: 0.1, far: 1400, bloom: { strength: 0.7, radius: 0.6, threshold: 0.8 }, onLost });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x4a525a, 20, 140);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0x8a96a8, 0x2a2a2a, 1);
  const sun = new THREE.DirectionalLight(0xb8c0d0, 1);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 5;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(1200);
  scene.add(sky.dome);
  const water = { uniforms: { uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSun: { value: V(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlints: { value: 1 } } };
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water, stage, house: houseLook, moods: MOODS });

  const kit = createMarshesKit(renderer);
  const mats = kit.mats ?? {};
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });
  const zones = { emyn: new THREE.Group(), marsh: new THREE.Group(), gate: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);
  const rockMat = mats.rock ?? new THREE.MeshLambertMaterial({ vertexColors: true });

  // ── the Emyn Muil ──
  const emynLand = makeTerrain(renderer, { size: 120, seg: tier === 'high' ? 140 : 90, height: emynHeight, paint: paints.emyn, blades: 0 });
  zones.emyn.add(emynLand);
  const cliff = kit.cliff({ w: 60, h: EMYN.top, outcrops: ROPE.outcrops });
  cliff.group.position.set(0, emynHeight(0, EMYN.cliff), EMYN.cliff);
  zones.emyn.add(cliff.group);
  const cliffFoot = cliff.group.position.y;
  zones.emyn.add(instances(kit.spike(3), rockMat, SPIKES.map(([x, z, r, seed]) => ({ x, z, y: emynHeight(x, z) - 0.2, s: r, turn: seed * 0.1 })), { shadow: false }));
  // and the rocks crowding round past the rim
  {
    const ring = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI + Math.PI * 0.02;
      const r = 26 + (i % 5) * 4;
      ring.push({ x: Math.cos(a) * r, z: EMYN.cliff + 2 + Math.sin(a) * r, y: 2, s: 2.2 + (i % 4) * 0.6, turn: i * 1.7 });
    }
    zones.emyn.add(instances(kit.spike(5), rockMat, ring, { shadow: false }));
  }
  const rope = kit.rope();
  zones.emyn.add(rope.mesh ?? rope.group);
  const ropeTop = V(0, cliffFoot + EMYN.top + 0.5, EMYN.cliff + 0.4);
  // Sam's bedroll and pack by the rock
  const samSleep = folk('sam');
  sit(samSleep);
  zones.emyn.add(samSleep.group);
  const gollum = kit.gollum();
  scene.add(gollum.group);
  const fallingRain = createParticles(Math.round(900 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.7, 0.75, 0.85, 0],
      [0.1, 0.7, 0.75, 0.85, 0.5],
      [1, 0.6, 0.65, 0.75, 0.4],
    ],
    additive: false,
    stretch: 6,
    gravity: -9,
    drag: 0,
  });
  scene.add(fallingRain.mesh);

  // ── the Dead Marshes ──
  const marshLand = makeTerrain(renderer, { size: 220, seg: tier === 'high' ? 200 : 130, height: marshHeight, paint: paints.marsh, blades: 0.1 });
  zones.marsh.add(marshLand);
  const marshMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    fog: true,
    transparent: false,
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
      uniform vec3 uSky, uDeep;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // black, still, a film of scum, the sky dull in it
        vec2 p = vWorld.xz * 0.25;
        float n = noise(p + uTime * 0.02) * 0.6 + noise(p * 3.1) * 0.4;
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(view.y, 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.15 + fres * 0.55);
        col = mix(col, vec3(0.16, 0.18, 0.1), smoothstep(0.55, 0.8, n) * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ['uSky', 'uDeep']) marshMat.uniforms[k] = water.uniforms[k];
  const marshWater = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), marshMat);
  marshWater.position.y = MARSH_Y;
  zones.marsh.add(marshWater);
  const snagMat = mats.wood ?? new THREE.MeshLambertMaterial({ vertexColors: true });
  zones.marsh.add(instances(kit.deadTree(1), snagMat, SNAGS.filter((_, i) => i % 2 === 0).map(([x, z, seed]) => ({ x, z, y: MARSH_Y - 0.3, s: 0.8 + (seed % 50) / 100, turn: seed * 0.2 })), { shadow: false }));
  const reedMat = mats.reeds ?? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  {
    const rand = (() => {
      let s = 9;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    const reeds = [];
    const tufts = [];
    for (let i = 0; i < 3000 && reeds.length < 300 * many; i++) {
      const x = -72 + rand() * 148;
      const z = -30 + rand() * 60;
      const d = toPath(x, z, MARSH_PATH);
      if (d < 0.8 || d > 22) continue;
      if (LIGHTS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 1.4)) continue;
      // (and the pool of Sméagol's safe way kept clear, to see the tussocks)
      if (Math.abs(x - SAFE.x) < SAFE.cols * SAFE.gap * 0.5 + 0.8 && z < SAFE.z - SAFE.first + 1.4 && z > ISLAND.z - ISLAND.r) continue;
      if (d < 2.4) tufts.push({ x, z, y: marshHeight(x, z) - 0.05, s: 0.7 + rand() * 0.6, turn: rand() * TAU });
      else reeds.push({ x, z, y: MARSH_Y - 0.2, s: 0.7 + rand() * 0.8, turn: rand() * TAU });
    }
    zones.marsh.add(instances(kit.reeds(2), reedMat, reeds, { shadow: false }));
    zones.marsh.add(instances(kit.tussock(3), reedMat, tufts, { shadow: false }));
  }
  // ── on the side: Sméagol's safe way ──
  // tussocks in rows across a pool, each on its own mound of mud so it can
  // sink; an island past them with a dead tree; and lights over the wrong
  // ones while you cross
  const mudMat = new THREE.MeshLambertMaterial({ color: 0x2e2a1e });
  const moundGeo = new THREE.CylinderGeometry(0.5, 0.78, 0.7, 9).translate(0, -0.35, 0);
  const tussockGeo = kit.tussock(5);
  const tussocks = [];
  for (let row = 0; row < SAFE.rows; row++)
    for (let col = 0; col < SAFE.cols; col++) {
      const g = new THREE.Group();
      const mound = new THREE.Mesh(moundGeo, mudMat);
      const tuft = new THREE.Mesh(tussockGeo, reedMat);
      tuft.scale.setScalar(0.95 + ((row * 7 + col * 3) % 5) * 0.05);
      tuft.rotation.y = row * 1.3 + col * 2.1;
      g.add(mound, tuft);
      const { x, z } = tussockAt(col, row);
      g.position.set(x, MARSH_Y + 0.16, z);
      zones.marsh.add(g);
      tussocks.push({ g, row, col, sink: 0 });
    }
  {
    const island = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2).scale(ISLAND.r, 0.5, ISLAND.r * 0.8), mudMat);
    island.position.set(ISLAND.x, MARSH_Y - 0.12, ISLAND.z);
    zones.marsh.add(island);
    const snag = new THREE.Mesh(kit.deadTree(4), snagMat);
    snag.position.set(ISLAND.x + 0.6, MARSH_Y + 0.1, ISLAND.z - 0.5);
    snag.scale.setScalar(0.9);
    zones.marsh.add(snag);
    const tuft = new THREE.Mesh(tussockGeo, reedMat);
    tuft.position.set(ISLAND.x - 0.9, MARSH_Y + 0.25, ISLAND.z + 0.3);
    zones.marsh.add(tuft);
  }
  const lures = Array.from({ length: SAFE.rows }, () => {
    const w = kit.wisp();
    w.group.visible = false;
    zones.marsh.add(w.group);
    return w;
  });
  // where he has just put his foot, as he shows you: a pale flash on it
  const footMark = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8fff0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  footMark.renderOrder = 3;
  zones.marsh.add(footMark);
  const tileAt = (row, col, path) => (row < 0 ? { x: POOL_BANK.x - 0.6, z: POOL_BANK.z, y: marshHeight(POOL_BANK.x, POOL_BANK.z) } : row >= SAFE.rows ? { x: ISLAND.x - 0.4, z: ISLAND.z + 0.7, y: MARSH_Y + 0.3 } : { ...tussockAt(path ? path[row] : col, row), y: MARSH_Y + 0.42 });

  const wisps = LIGHTS.map(([x, z], i) => {
    const w = kit.wisp();
    w.group.position.set(x, MARSH_Y + 0.2, z);
    w.seed = i;
    zones.marsh.add(w.group);
    return w;
  });
  const FACE_AT = [
    [0.5, 0.4],
    [-0.6, 0.7],
    [0.1, -0.7],
  ];
  const faces = LIGHTS.flatMap(([x, z], i) =>
    FACE_AT.slice(0, tier === 'low' ? 1 : 3).map(([dx, dz], j) => {
      const f = kit.face(i * 3 + j + 1);
      f.group.position.set(x + dx, MARSH_Y - 0.6, z + dz);
      zones.marsh.add(f.group);
      return f;
    }),
  );
  const fell = kit.fellBeast();
  fell.group.visible = false;
  scene.add(fell.group);
  const mist = createParticles(Math.round(160 * Math.max(0.5, many)), {
    ramp: [
      [0, 0.75, 0.78, 0.7, 0],
      [0.3, 0.75, 0.78, 0.7, 0.16],
      [0.7, 0.75, 0.78, 0.7, 0.12],
      [1, 0.75, 0.78, 0.7, 0],
    ],
    additive: false,
    gravity: 0,
    drag: 0.2,
    swirl: 0.3,
  });
  scene.add(mist.mesh);

  // ── before the Gate ──
  const gateLand = makeTerrain(renderer, { size: 440, seg: tier === 'high' ? 180 : 120, height: slopeHeight, paint: paints.gate, blades: 0 });
  zones.gate.add(gateLand);
  zones.gate.add(instances(kit.ashRock(4), rockMat, BOULDERS.map(([x, z, r], i) => ({ x, z, y: slopeHeight(x, z) - 0.3, s: r, turn: i * 1.3 })), { shadow: false }));
  const gate = kit.blackGate();
  gate.group.position.set(GATE_AT.x, slopeHeight(GATE_AT.x, GATE_AT.z) - 2, GATE_AT.z);
  gate.group.rotation.y = Math.PI;
  zones.gate.add(gate.group);
  // the road to it, and the column marching down it
  {
    const pos = [];
    const idx = [];
    const N = 60;
    const along = (k) => {
      const seg = Math.min(ROAD.length - 2, Math.floor(k * (ROAD.length - 1)));
      const u = k * (ROAD.length - 1) - seg;
      const [ax, az] = ROAD[seg];
      const [bx, bz] = ROAD[seg + 1];
      return [ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bz - az, bx - ax)];
    };
    for (let i = 0; i <= N; i++) {
      const [x, z, a] = along(i / N);
      const nx = -Math.sin(a) * 4;
      const nz = Math.cos(a) * 4;
      pos.push(x - nx, slopeHeight(x - nx, z - nz) + 0.05, z - nz, x + nx, slopeHeight(x + nx, z + nz) + 0.05, z + nz);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    zones.gate.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x3a342e })));
  }
  const column = kit.column ? new THREE.InstancedMesh(kit.column(), mats.easterling ?? new THREE.MeshLambertMaterial({ vertexColors: true }), 48) : null;
  if (column) {
    column.frustumCulled = false;
    zones.gate.add(column);
  }
  const scouts = Array.from({ length: 4 }, (_, i) => {
    const e = kit.easterling(i + 1);
    e.group.visible = false;
    zones.gate.add(e.group);
    return e;
  });
  const cloak = kit.elvenCloak();
  cloak.group.visible = false;
  scene.add(cloak.group);
  const ash = createParticles(Math.round(300 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.6, 0.55, 0.5, 0],
      [0.2, 0.6, 0.55, 0.5, 0.5],
      [1, 0.5, 0.45, 0.4, 0],
    ],
    additive: false,
    gravity: -0.3,
    drag: 0.5,
    swirl: 0.8,
  });
  scene.add(ash.mesh);

  // ── people ──
  // (outdoors, each stands on a soft blob slid away from the sun, and dims in
  // the baked shade, ../grounded.js; the circle under each is kept for the
  // zones indoors, and hidden while a blob is drawn)
  const movers = [];
  const blobGeo = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blob = (f) => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.position.y = 0.04;
    b.renderOrder = 1;
    movers.push({ object: f.group, size: [FIGURE, FIGURE], contact: b });
    f.group.add(b);
    return f;
  };
  const frodo = blob(folk('frodo'));
  const sam = blob(folk('sam'));
  scene.add(frodo.group, sam.group);
  const ghosts = createGhosts({ height: emynHeight });
  zones.emyn.add(ghosts.group);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;

  // ── state ──
  const A = { t: 0, cam: { at: V(0, 4, 10), look: V(0, 2, -10) }, mode: '', shake: 0, night: 0, dawn: 0, first: true, rain: 0, mist: 0, ash: 0, open: 0, flash: 0, drawn: 0, fellAt: null };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const wispCol = new THREE.Color(0xb8ffd8);
  const fireCol = new THREE.Color(0xff8a40);
  const turnTo = (p, face, dt, k = 4) => {
    let d = face - p.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.group.rotation.y += d * Math.min(1, dt * k);
  };
  const columnM = new THREE.Matrix4();
  const columnQ = new THREE.Quaternion();
  const columnE = new THREE.Euler();
  const columnS = V(1, 1, 1);

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const zone = s.zone;
    sky.uniforms.uTime.value = t;
    marshMat.uniforms.uTime.value = t;
    for (const [k, g] of Object.entries(zones)) g.visible = k === zone;
    const h = s.hobbit;
    const lights = [];
    const ground = HEIGHT[zone];

    // ── the sky of each place ──
    const wantNight = zone === 'emyn' && s.next === 'smeagol' ? 1 : 0;
    const wantDawn = zone === 'marsh' ? 1 : 0;
    const ease = A.first ? 1 : Math.min(1, dt * 0.6);
    A.first = false;
    A.night += (wantNight - A.night) * ease;
    A.dawn += (wantDawn - A.dawn) * ease;
    const sunDir = atmosphere(A.night, A.dawn);
    if (zone === 'gate') {
      sky.uniforms.uTop.value.set(GATE_SKY.top);
      sky.uniforms.uHorizon.value.set(GATE_SKY.horizon);
      scene.fog.color.set(GATE_SKY.fog);
      scene.fog.near = 60;
      scene.fog.far = 520;
      sun.color.set(0xd88a5a);
      sun.intensity = 1.5;
      hemi.color.set(0x9a7a6a);
      hemi.intensity = 1.25;
    }
    // lightning over the Emyn Muil
    if (zone === 'emyn' && s.next === 'rope' && Math.random() < dt * 0.25) A.flash = 1;
    A.flash = Math.max(0, A.flash - dt * 3);
    if (A.flash > 0) hemi.intensity += A.flash * 2.5;

    // ── Frodo, and Sam ──
    let fy = ground(h.x, h.z);
    sit(frodo, false);
    frodo.group.visible = true;
    sam.group.visible = false;
    cloak.group.visible = false;
    if (zone === 'emyn' && s.mode === 'rope') {
      // on the rope, down the face
      const d = s.descent;
      const y = cliffFoot + EMYN.top - (d?.y ?? 0);
      wpos('emyn', d?.lat ?? 0, y, EMYN.cliff + 0.7, frodo.group.position);
      frodo.group.rotation.set(0, Math.PI / 2, 0);
      pose(frodo, t, { moving: Boolean(d && d.stunT <= 0), speed: 0.6 });
      if (frodo.arms?.[0]) frodo.arms[0].rotation.x = -2.6;
      if (frodo.arms?.[1]) frodo.arms[1].rotation.x = 2.6;
      rope.set?.([ropeTop, tmp2.copy(frodo.group.position).add(V(0, 1.4, 0)).sub(AT.emyn).clone()]);
      // Sam, up top, paying it out
      sam.group.visible = true;
      wpos('emyn', 0.8, cliffFoot + EMYN.top, EMYN.cliff - 0.8, sam.group.position);
      sam.group.rotation.y = -Math.PI / 2;
      pose(sam, t, { moving: false, wave: 0.3 });
      fy = frodo.group.position.y;
    } else if (zone === 'emyn' && s.mode === 'walk' && s.next === 'rope') {
      // at the top, looking down it, Sam with the rope
      wpos('emyn', -0.4, cliffFoot + EMYN.top, EMYN.cliff - 0.5, frodo.group.position);
      frodo.group.rotation.set(0, -Math.PI / 2, 0);
      pose(frodo, t, { moving: false });
      sam.group.visible = true;
      wpos('emyn', 0.7, cliffFoot + EMYN.top, EMYN.cliff - 1.1, sam.group.position);
      sam.group.rotation.set(0, -Math.PI / 2 + 0.5, 0);
      pose(sam, t + 1, { moving: false });
      rope.set?.([ropeTop, V(0.1, cliffFoot + EMYN.top - 3, EMYN.cliff + 0.5)]);
      fy = frodo.group.position.y;
    } else if (zone === 'emyn' && s.mode === 'creep') {
      // lying by Sam, pretending to sleep
      wpos('emyn', BED.x - 0.9, emynHeight(BED.x, BED.z) + 0.15, BED.z, frodo.group.position);
      frodo.group.rotation.set(0, BED.face, Math.PI / 2 - 0.15);
      pose(frodo, t, { moving: false });
      rope.set?.([ropeTop, V(0, cliffFoot + 0.3, EMYN.cliff + 0.6)]);
      fy = frodo.group.position.y;
    } else if (zone === 'emyn' && s.mode === 'talk' && s.talking === 'smeagol') {
      // over him, Sting out, and Sam with the rope
      const fx = BED.x - 1.6;
      const fz = BED.z - 0.3;
      wpos('emyn', fx, emynHeight(fx, fz), fz, frodo.group.position);
      frodo.group.rotation.set(0, Math.PI - 0.1, 0);
      pose(frodo, t, { moving: false });
      if (frodo.arms?.[1]) frodo.arms[1].rotation.x = -1.2;
      sam.group.visible = true;
      const sx = BED.x - 2.2;
      const sz = BED.z + 0.7;
      wpos('emyn', sx, emynHeight(sx, sz), sz, sam.group.position);
      sam.group.rotation.set(0, Math.atan2(1, -0.3), 0);
      pose(sam, t + 1, { moving: false });
      rope.set?.([ropeTop, V(0, cliffFoot + 0.3, EMYN.cliff + 0.6)]);
      fy = frodo.group.position.y;
    } else if (zone === 'marsh' && s.way) {
      // hopping from tussock to tussock, or going under one
      const w = s.way;
      const to = w.sankAt ? tileAt(w.sankAt.row, w.sankAt.col) : tileAt(w.row, w.col);
      if (!A.hop || A.hop.row !== w.row || A.hop.col !== w.col) A.hop = { row: w.row, col: w.col, from: A.hop && w.row >= 0 ? A.hop.to : to, to };
      const k = Math.min(1, w.hopT / (WAY.step * 0.9));
      const f = A.hop.from;
      const y = f.y + (to.y - f.y) * k + Math.sin(k * Math.PI) * 0.55 - (w.phase === 'sunk' ? Math.min(1.6, Math.max(0, w.t - 0.15) * 2.4) : 0);
      wpos('marsh', f.x + (to.x - f.x) * k, y, f.z + (to.z - f.z) * k, frodo.group.position);
      frodo.group.rotation.set(0, Math.PI / 2, 0);
      frodo.group.visible = !(w.phase === 'sunk' && w.t > 0.9);
      pose(frodo, t, { moving: k < 1, speed: 1.2, wave: w.phase === 'sunk' ? 1 : w.phase === 'across' ? 0.7 : 0 });
      fy = frodo.group.position.y;
    } else {
      wpos(zone, h.x, fy, h.z, frodo.group.position);
      frodo.group.rotation.set(0, h.face, 0);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
      if (s.hiding) {
        // down in the reeds, or under the cloak
        frodo.group.position.y -= 0.35;
        sit(frodo, true);
        if (zone === 'gate') {
          cloak.group.visible = true;
          cloak.group.position.copy(frodo.group.position);
          cloak.group.rotation.y = h.face;
          frodo.group.visible = false;
        }
      }
      if (zone === 'emyn') rope.set?.([ropeTop, V(0, cliffFoot + 0.3, EMYN.cliff + 0.6)]);
      // Sam at your heels; at the foot of the cliff, beside you looking up
      // at his rope
      sam.group.visible = zone !== 'emyn' || (s.mode === 'talk' && s.talking === 'down');
      if (sam.group.visible && zone === 'emyn') {
        const sx = h.x + 1.1;
        const sz = h.z + 0.3;
        wpos('emyn', sx, emynHeight(sx, sz), sz, sam.group.position);
        sam.group.rotation.set(0, Math.PI / 2 + 0.15, 0);
        pose(sam, t + 1, { moving: false });
        sit(sam, false);
      } else if (sam.group.visible) {
        const back = V(Math.cos(h.face), 0, -Math.sin(h.face)).multiplyScalar(-1.4).add(V(Math.sin(h.face) * 0.6, 0, Math.cos(h.face) * 0.6));
        const sx = h.x + back.x;
        const sz = h.z + back.z;
        tmp2.set(AT[zone].x + sx, AT[zone].y + ground(sx, sz), AT[zone].z + sz);
        sam.group.position.lerp(tmp2, sam.group.position.distanceTo(tmp2) > 6 ? 1 : Math.min(1, dt * 4));
        turnTo(sam, h.face, dt, 6);
        pose(sam, t + 1, { moving: h.speed > 0.3 });
        if (s.hiding) {
          sam.group.position.y = AT[zone].y + ground(sx, sz) - 0.35;
          sit(sam, true);
          sam.group.visible = zone !== 'gate';
        } else sit(sam, false);
      }
    }
    // Sam asleep at the foot of the cliff
    samSleep.group.visible = zone === 'emyn' && s.next === 'smeagol' && s.mode !== 'talk';
    if (samSleep.group.visible) {
      samSleep.group.position.set(BED.x + 0.5, emynHeight(BED.x, BED.z) + 0.15, BED.z + 0.4);
      samSleep.group.rotation.set(0, BED.face, Math.PI / 2 - 0.1);
    }
    ghosts.update(zone === 'emyn' ? (s.travellers ?? []) : [], t, dt, { ringOn: false });

    // ── Gollum ──
    gollum.group.visible = false;
    if (zone === 'emyn' && s.creep) {
      // head first down the rock, then across to you
      gollum.group.visible = true;
      const k = Math.max(0, (s.creep.d - CREEP.reach) / (CREEP.from - CREEP.reach));
      const moving = s.creep.phase === 'creep' ? 1 : 0;
      const peer = s.creep.phase === 'look' ? Math.sin(t * 3) * 0.6 : 0;
      if (k > 0.2) {
        // on the rock, the face at his +x
        wpos('emyn', BED.x - 1.4, cliffFoot + 0.3 + ((k - 0.2) / 0.8) * 12, EMYN.cliff + 0.5, gollum.group.position);
        gollum.group.rotation.set(0, Math.PI / 2, 0);
        gollum.animate?.(t, { pose: 'climb', speed: moving, look: peer });
      } else {
        // off it, and across the stones to you on all fours
        const u = 1 - k / 0.2;
        const gx = BED.x - 1.4 + u * 0.4;
        const gz = EMYN.cliff + 0.7 + u * (BED.z - 1.05 - EMYN.cliff - 0.7);
        wpos('emyn', gx, emynHeight(gx, gz), gz, gollum.group.position);
        gollum.group.rotation.set(0, Math.atan2(-(BED.z - gz), BED.x - 0.9 - gx), 0);
        gollum.animate?.(t, { pose: u < 1 ? 'crawl' : 'crouch', speed: moving, look: peer, reach: s.creep.phase === 'reach' ? 1 : 0 });
      }
    } else if (zone === 'emyn' && s.mode === 'talk' && s.talking === 'smeagol') {
      gollum.group.visible = true;
      wpos('emyn', BED.x - 2.6, emynHeight(BED.x - 2.6, BED.z - 0.4), BED.z - 0.4, gollum.group.position);
      gollum.group.rotation.set(0, 0, 0);
      gollum.animate?.(t, { pose: 'cower' });
    } else if (zone === 'marsh' && s.way) {
      // showing you the way, a hop at a time, then waiting on the island
      gollum.group.visible = true;
      const w = s.way;
      let at;
      let next;
      let k = 0;
      if (w.phase === 'show') {
        const u = (w.t - WAY.wait) / WAY.hop + 1;
        const i = Math.max(-1, Math.min(SAFE.rows, Math.floor(u) - 1));
        k = i >= SAFE.rows ? 0 : Math.max(0, Math.min(1, (u - Math.floor(u) - 0.5) / 0.5));
        at = tileAt(i, 0, w.path);
        next = tileAt(Math.min(SAFE.rows, i + 1), 0, w.path);
      } else at = next = tileAt(SAFE.rows, 0, w.path);
      if (at.x === POOL_BANK.x - 0.6) at = { ...at, x: POOL_BANK.x + 0.8 };
      wpos('marsh', at.x + (next.x - at.x) * k, at.y + (next.y - at.y) * k + Math.sin(k * Math.PI) * 0.45 - 0.05, at.z + (next.z - at.z) * k, gollum.group.position);
      gollum.group.rotation.set(0, w.phase === 'show' ? Math.atan2(-(next.z - at.z), next.x - at.x || 0.001) : -Math.PI / 2, 0);
      gollum.animate?.(t, { pose: w.phase === 'show' && k > 0 ? 'crawl' : 'crouch', speed: w.phase === 'show' ? 1 : 0, look: s.speaker === 'gollum' ? Math.sin(t * 5) * 0.3 : 0 });
    } else if (zone === 'marsh' && s.lead) {
      gollum.group.visible = true;
      wpos('marsh', s.lead.x, marshHeight(s.lead.x, s.lead.z), s.lead.z, gollum.group.position);
      turnTo(gollum, s.lead.face, dt, 6);
      gollum.animate?.(t, { pose: s.lead.moving ? 'crawl' : 'crouch', speed: s.lead.moving ? 1 : 0 });
    } else if ((zone === 'marsh' && s.mode === 'talk') || (zone === 'gate' && (s.mode === 'talk' || s.mode === 'end' || s.mode === 'walk'))) {
      gollum.group.visible = true;
      const gx = zone === 'gate' ? (s.mode === 'walk' ? h.x - 2.4 : LOOKOUT.x - 1.6) : h.x + 2.2;
      const gz = zone === 'gate' ? (s.mode === 'walk' ? h.z - 1.2 : LOOKOUT.z - 1.4) : h.z + 0.6;
      tmp2.set(AT[zone].x + gx, AT[zone].y + ground(gx, gz), AT[zone].z + gz);
      gollum.group.position.lerp(tmp2, gollum.group.position.distanceTo(tmp2) > 6 ? 1 : Math.min(1, dt * 3));
      turnTo(gollum, h.face, dt, 4);
      gollum.animate?.(t, { pose: 'crouch', speed: 0, look: s.speaker === 'gollum' ? Math.sin(t * 5) * 0.3 : 0 });
    }

    // ── the safe way: a wrong tussock going under, the lights over the wrong ones ──
    if (zone === 'marsh') {
      const w = s.way;
      for (const tu of tussocks) {
        const sunk = w?.sankAt && w.sankAt.row === tu.row && w.sankAt.col === tu.col && w.phase === 'sunk';
        tu.sink += ((sunk ? 1 : 0) - tu.sink) * Math.min(1, dt * (sunk ? 5 : 1.5));
        tu.g.position.y = MARSH_Y + 0.16 - tu.sink * 0.9;
        tu.g.rotation.z = tu.sink * 0.3;
      }
      // his last footstep, flashing on its tussock as he lands
      footMark.visible = false;
      if (w?.phase === 'show') {
        const u = (w.t - WAY.wait) / WAY.hop + 1;
        const i = Math.floor(u) - 1;
        if (i >= 0 && i < SAFE.rows) {
          const at = tussockAt(w.path[i], i);
          footMark.visible = true;
          footMark.position.set(at.x, MARSH_Y + 0.5, at.z);
          footMark.material.opacity = 0.85 * (1 - Math.min(1, (u - Math.floor(u)) * 1.4));
          footMark.scale.setScalar(1 + (u - Math.floor(u)) * 0.4);
        }
      }
      lures.forEach((l, i) => {
        l.group.visible = Boolean(w);
        if (!w) return;
        const { x, z } = tussockAt(w.lures[i], i);
        l.group.position.set(x + 0.3, MARSH_Y + 0.45, z - 0.2);
        l.update?.(t * 1.1 + i * 1.7);
      });
    }

    // ── the marsh: lights, faces, the fell beast ──
    if (zone === 'marsh') {
      const cam = camera.position;
      wisps.forEach((w, i) => {
        w.update?.(t + i);
        const at = w.group.getWorldPosition(tmp2);
        if (at.distanceToSquared(cam) < 900) lights.push([at.clone().add(V(0, 0.6, 0)), wispCol, 1.4 + Math.sin(t * 3 + i) * 0.3, 7]);
      });
      if (s.way) lures.slice(0, 3).forEach((l, i) => lights.unshift([l.group.getWorldPosition(V()).add(V(0, 0.4, 0)), wispCol, 1.1 + Math.sin(t * 3 + i) * 0.25, 5]));
      A.drawn += ((s.lure ?? 0) - A.drawn) * Math.min(1, dt * 3);
      faces.forEach((f, i) => f.update?.(t + i, Math.max(A.drawn, s.talking === 'faces' ? 1 : 0)));
      // the Nazgûl, passing over
      const ph = s.fell?.phase;
      if (ph === 'warn' || ph === 'over') {
        if (!A.fellAt) A.fellAt = [h.x, h.z];
        fell.group.visible = true;
        // through the warning and the pass, 0..1, right over you two
        // thirds of the way: from the north-west, low, away south-east
        const u = ph === 'warn' ? (1 - Math.max(0, s.fell.phaseT ?? 0) / FELL.warn) * (FELL.warn / (FELL.warn + FELL.over)) : (FELL.warn + FELL.over - Math.max(0, s.fell.phaseT ?? 0)) / (FELL.warn + FELL.over);
        const off = (u - 0.68) * 160;
        const x = A.fellAt[0] + off * 0.81;
        const z = A.fellAt[1] + off * 0.58;
        wpos('marsh', x, 8 + Math.abs(u - 0.68) * 40, z, fell.group.position);
        fell.group.rotation.set(0, -Math.atan2(0.58, 0.81), 0);
        fell.animate?.(t, { flap: Math.abs(u - 0.68) < 0.12 ? 0.3 : 1 });
      } else {
        fell.group.visible = false;
        A.fellAt = null;
      }
      // mist drifting over the water
      A.mist += dt * 6 * Math.max(0.4, many);
      while (A.mist > 1) {
        A.mist -= 1;
        mist.emit(frodo.group.position.x + R(30), MARSH_Y + 0.4 + Math.random() * 0.6, frodo.group.position.z + R(30), R(0.3), 0.02, R(0.3), 9, 2.4, 4.5, 1);
      }
    } else fell.group.visible = false;
    mist.step(dt);

    // ── the Gate: the column, the scouts, the Gate opening ──
    if (zone === 'gate') {
      A.open += ((s.gateOpen ? 1 : 0) - A.open) * Math.min(1, dt * 0.25);
      gate.open?.(A.open);
      if (column) {
        // a column marching down the road and in at the Gate
        const n = column.count;
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / 4);
          const file = (i % 4) - 1.5;
          const k = ((t * 1.3 + row * 1.6) % 140) / 140;
          const seg = Math.min(ROAD.length - 2, Math.floor(k * (ROAD.length - 1)));
          const u = k * (ROAD.length - 1) - seg;
          const [ax, az] = ROAD[seg];
          const [bx, bz] = ROAD[seg + 1];
          const a = Math.atan2(bz - az, bx - ax);
          const x = ax + (bx - ax) * u - Math.sin(a) * file * 1.2;
          const z = az + (bz - az) * u + Math.cos(a) * file * 1.2;
          columnE.set(0, -a, 0);
          columnQ.setFromEuler(columnE);
          columnM.compose(tmp2.set(x, slopeHeight(x, z) + Math.abs(Math.sin(t * 6 + row)) * 0.05, z), columnQ, columnS);
          column.setMatrixAt(i, columnM);
        }
        column.instanceMatrix.needsUpdate = true;
      }
      const list = s.scouts ?? [];
      scouts.forEach((e, i) => {
        const w = list[i];
        e.group.visible = Boolean(w);
        if (!w) return;
        e.group.position.set(w.x, slopeHeight(w.x, w.z), w.z);
        turnTo(e, w.face + (w.look ?? 0), dt, 8);
        e.animate?.(t + i, { marching: w.mode === 'chase' || w.mode === 'back' || (w.mode === 'patrol' && w.wait <= 0) || (w.mode === 'search' && Boolean(w.goal)) || (w.mode === 'suspicious' && !(w.looked > 0)), alert: w.mode === 'alert' || w.mode === 'chase' ? 1 : 0 });
      });
      // the fires of Mordor, glowing behind the Gate
      lights.push([wpos('gate', GATE_AT.x, 40, GATE_AT.z + 30), fireCol, 30, 300]);
      A.ash += dt * 14 * Math.max(0.4, many);
      while (A.ash > 1) {
        A.ash -= 1;
        ash.emit(frodo.group.position.x + R(25), frodo.group.position.y + 4 + Math.random() * 6, frodo.group.position.z + R(25), 0.8, -0.2, 0.4, 6, 0.06, 0.05, 1);
      }
    }
    ash.step(dt);

    // rain in the Emyn Muil
    if (zone === 'emyn' && s.next === 'rope') {
      A.rain += dt * 160 * Math.max(0.4, many);
      while (A.rain > 1) {
        A.rain -= 1;
        fallingRain.emit(frodo.group.position.x + R(18), frodo.group.position.y + 10 + Math.random() * 6, frodo.group.position.z + R(18), 0.6, -8, 0.2, 1.4, 0.03, 0.03, 1);
      }
    }
    fallingRain.step(dt);
    fx.step(dt, t, { night: A.night, day: 1 - A.night });

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
    if (zone === 'emyn' && s.mode === 'rope') {
      const fp = frodo.group.position;
      camAt = tmp.set(fp.x + 3.5, fp.y + 0.6, fp.z + 7.5);
      camLook = look.set(fp.x + 0.3, fp.y - 0.6, fp.z);
    } else if (zone === 'emyn' && s.mode === 'walk' && s.next === 'rope') {
      // from the rocks below, up the face to the two of you at the top
      camAt = wpos('emyn', 9, cliffFoot + 7, EMYN.cliff + 26, tmp);
      camLook = wpos('emyn', 0, cliffFoot + EMYN.top - 6, EMYN.cliff, look);
    } else if (zone === 'emyn' && s.mode === 'creep') {
      // low by your head, looking up the rock where he comes
      camAt = wpos('emyn', BED.x + 1.6, emynHeight(BED.x, BED.z) + 0.9, BED.z + 2.4, tmp);
      camLook = gollum.group.position.clone().lerp(frodo.group.position, 0.35);
    } else if (zone === 'marsh' && s.way && s.way.phase === 'show') {
      // up behind the bank, the whole pool laid out before you
      camAt = wpos('marsh', SAFE.x + 0.3, MARSH_Y + 9.5, SAFE.z + 6.5, tmp);
      camLook = wpos('marsh', SAFE.x, MARSH_Y - 0.4, SAFE.z - 8, look);
    } else if (zone === 'marsh' && s.way) {
      // over your shoulder, the next rows of tussocks ahead of you
      const rz = s.way.row >= 0 ? tussockAt(0, s.way.row).z : SAFE.z;
      camAt = wpos('marsh', SAFE.x + 0.2, MARSH_Y + 5.5, rz + 4.5, tmp);
      camLook = wpos('marsh', SAFE.x, MARSH_Y, rz + 0.3, look);
    } else if (s.mode === 'talk' && s.camShot?.faces) {
      // down into the pool by the light that had you
      let best = LIGHTS[0];
      for (const p of LIGHTS) if (Math.hypot(p[0] - h.x, p[1] - h.z) < Math.hypot(best[0] - h.x, best[1] - h.z)) best = p;
      camAt = wpos('marsh', best[0] + 0.5, MARSH_Y + 1.7, best[1] + 1.4, tmp);
      camLook = wpos('marsh', best[0], MARSH_Y - 0.6, best[1] + 0.1, look);
    } else if ((s.mode === 'talk' || s.mode === 'end') && zone === 'gate') {
      // from the lookout, out over the Gate
      camAt = wpos('gate', LOOKOUT.x - 3, slopeHeight(LOOKOUT.x, LOOKOUT.z) + 2.6, LOOKOUT.z - 4, tmp);
      camLook = wpos('gate', GATE_AT.x, 22, GATE_AT.z, look);
    } else if (s.mode === 'talk' && s.camShot?.at) {
      const [ax, ay, az] = s.camShot.at;
      const [lx, ly, lz] = s.camShot.look;
      camAt = wpos(zone, ax, ground(ax, az) + ay, az, tmp);
      camLook = wpos(zone, lx, ground(lx, lz) + ly, lz, look);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.34;
      const dist = s.camDist ?? 6.4;
      wpos(zone, h.x, fy + 1.1, h.z, look);
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const floor = AT[zone].y + ground(camAt.x - AT[zone].x, camAt.z - AT[zone].z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      if (zone === 'emyn' && camAt.z < EMYN.cliff + 1.5) camAt.z = EMYN.cliff + 1.5;
      camLook = look;
      if (fell.group.visible) camLook.lerp(fell.group.position, 0.18);
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const key = `${zone}|${s.mode}|${s.camShot?.id ?? ''}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'rope';
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
    for (const g of grounds) g.update();
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type) => {
    if (type === 'knock') A.shake = 0.3;
    else if (type === 'pounce') A.shake = 0.25;
    else if (type === 'reach') A.shake = Math.max(A.shake, 0.05);
    else if (type === 'drawn') A.shake = 0.2;
    else if (type === 'shriek') A.shake = Math.max(A.shake, 0.15);
    else if (type === 'over') A.shake = Math.max(A.shake, 0.25);
    else if (type === 'caught') A.shake = 0.3;
    else if (type === 'gate') A.shake = 0.2;
    else if (type === 'rope') fx.puff(tmp2.copy(frodo.group.position).add(V(-1, 0.3, -0.5)), V(0, 1, 0), 6);
    else if (type === 'sank') {
      A.shake = 0.18;
      fx.pop(tmp2.copy(frodo.group.position).add(V(0, 0.3, 0)), 'green', 12, 0.9);
    } else if (type === 'across') fx.pop(tmp2.copy(frodo.group.position).add(V(0, 1.2, 0)), 'gold', 14, 1);
  };

  // ── the floor's light, baked in each zone outdoors when it's first shown ──
  const grounds = [
    groundTown({ renderer, scene, terrain: emynLand, outdoors: zones.emyn, sun, height: null, people: movers, skip: [sky.dome, ghosts.group], tier, radius: null, shade: 0x22261e, clip: true }),
    groundTown({ renderer, scene, terrain: marshLand, outdoors: zones.marsh, sun, height: null, people: movers, skip: [sky.dome, ghosts.group], tier, radius: null, shade: 0x22261e, clip: true }),
    groundTown({ renderer, scene, terrain: gateLand, outdoors: zones.gate, sun, height: null, people: movers, skip: [sky.dome, ghosts.group], tier, radius: null, shade: 0x22261e, clip: true }),
  ];
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    ground: import.meta.env.DEV ? grounds[0] : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    render,
    fx: fxEvent,
    screenOf: () => null,
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
      for (const g of grounds) g.dispose();
      ghosts.dispose();
      disposeTree(scene);
      stage.dispose();
    },
  };
}
