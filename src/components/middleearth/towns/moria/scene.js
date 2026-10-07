// Moria, in WebGL: the shore under the cliff at night, the Doors of Durin
// shining in the moonlight and the lake still and black; then the dark
// inside, by the light of Gandalf's staff, until he risks a little more and
// the great hall of pillars goes up out of sight; the Chamber of Mazarbul
// in its shaft of grey daylight; and the stair and the bridge over the
// abyss, with fire far below and the Balrog behind. Made in code
// (./props.js, ../ground.js), so nothing is downloaded.
//
// The three places are drawn apart in one scene (the gate at the origin,
// the halls and the flight off to the east), and only the one you're in is
// shown. It draws what the component hands it and decides nothing.
//
// createMoriaWorld(canvas) returns { render(state, ms, fast), fx(type),
// screenOf(kind, id), resize, dispose, lost, info }.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { createHouse } from '../../../../lib/three/house';
import { dress, rolesFor } from '../../../../lib/three/core';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { EMBER, FIRE as FLAME, createParticles } from '../../kit';
import { instances } from '../../shire/ground';
import { LOOKS } from '../../shire/people';
import { tube } from '../../shire/props';
import { makeAtmosphere, makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { createGhosts } from '../ghosts';
import { makeTerrain } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { makeFolk } from '../bree/props';
import { createMoriaKit } from './props';
import { CAST, CHAMBER, COMPANY, FLIGHT, FORK, GATE, GATE_ROCKS, HALL, HALL_COLLIDERS, HALL_WALLS, LAKE_Y, PASSAGE, SHAFT, TOMB, WELL, gateHeight, hallHeight } from './layout';
import { PLANK, TUMBLE } from './rules';
import { sharpen } from '../../../../lib/three/textures';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const BLACK = new THREE.Color(0x020203);
const LIT_FOG = new THREE.Color(0x0c1118);
// where each place is drawn
const AT = { gate: V(0, 0, 0), halls: V(1400, 0, 0), flight: V(2800, 0, 0) };

// who's who
const LOOKS_HERE = {
  frodo: LOOKS.frodo,
  sam: { ...LOOKS.sam, pack: true },
  merry: LOOKS.merry,
  pippin: LOOKS.pippin,
  gandalf: LOOKS.gandalf,
  aragorn: { tall: 1.5, coat: 0x3e3a34, shirt: 0x5a5246, cloak: 0x2e3328, hairStyle: 'long', hair: 0x2a1e16, beard: { color: 0x2a1e16, len: 0.12 }, item: 'sword', feet: 'boots', seed: 7 },
  gimli: { tall: 0.95, wide: 1.35, coat: 0x6a3a22, shirt: 0x8a8f98, hat: 'helm', hairStyle: 'none', hair: 0x9a3a1a, beard: { color: 0xa8441c, len: 0.5 }, item: 'axe', feet: 'boots', seed: 11 },
  legolas: { tall: 1.5, coat: 0x5a6a3a, shirt: 0x7a7a5a, hairStyle: 'long', hair: 0xf2e4b0, item: 'bow', feet: 'boots', seed: 15 },
  boromir: { tall: 1.55, coat: 0x6a2a22, shirt: 0x5a4a3a, cloak: 0x3a2a24, hairStyle: 'long', hair: 0x5a3a22, beard: { color: 0x5a3a22, len: 0.1 }, item: 'horn', feet: 'boots', seed: 19 },
};
const folk = (look) => makeFolk(look, { look: LOOKS_HERE[look] });

const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const SHORE = C(0x3a3a30);
const GRAVEL = C(0x5a5a50);
const MOSS = C(0x2e3a26);
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const noise = makeNoise(43);
function paint(x, z, h, out) {
  lerp3(out, SHORE, MOSS, smooth(0.4, 0.7, fbm(noise, x * 0.1, z * 0.1, { octaves: 3 })));
  lerp3(out, out, GRAVEL, smooth(GATE.shore - 3, GATE.shore, z) * 0.8);
  const apron = 1 - smooth(2.5, 4.5, Math.hypot(x / 1.4, z - GATE.cliff - 3));
  lerp3(out, out, C(0x6a6a62), apron * 0.8);
  return out;
}
// the moonlit night, in the sky's slots (only `night` is used)
const MOODS = {
  day: { top: 0x060a16, horizon: 0x223050, sun: [0.3, 0.55, 0.6], sunColour: 0xc8d6ff, sunPower: 1.7, hemiSky: 0x5a6c9e, hemiGround: 0x14161a, hemi: 1.7, fog: 0x0e1424, fogNear: 34, fogFar: 170, cloud: 0.2, cloudColour: 0x2a3450, stars: 1, exposure: 1.75, water: 0x24365a, deep: 0x04060a },
};
MOODS.night = MOODS.day;
MOODS.dawn = MOODS.day;

export function createMoriaWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 52, near: 0.1, far: 520, bloom: { strength: 0.85, radius: 0.6, threshold: 0.78 }, onLost });
  stage.grade({ contrast: 0.16, saturation: 0.8, vignette: 0.38, grain: 0.02, shadow: [0.0, 0.01, 0.03], high: [0.02, 0.01, 0.0] });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x0a0e18, 30, 160);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.3;

  const hemi = new THREE.HemisphereLight(0x4a5a8a, 0x101214, 1);
  const sun = new THREE.DirectionalLight(0xb8c8f0, 1.1);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 5;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(480);
  scene.add(sky.dome);
  const water = { uniforms: { uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSun: { value: V(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlints: { value: 1 } } };
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water, stage, house: houseLook, moods: MOODS });

  const kit = createMoriaKit(renderer);
  const mats = kit.mats;
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });
  const zones = { gate: new THREE.Group(), halls: new THREE.Group(), flight: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);

  // ── the West-gate ──
  const gateLand = makeTerrain(renderer, { size: 120, seg: tier === 'high' ? 160 : 100, height: gateHeight, paint, blades: 0.1 });
  zones.gate.add(gateLand);
  const gate = kit.westGate();
  gate.group.position.set(0, gateHeight(0, GATE.cliff + 0.5) - 0.2, GATE.cliff);
  zones.gate.add(gate.group);
  // the lake: black and still, the moon on it
  const lakeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uStir: { value: 0 } }]),
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
      uniform float uTime, uStir;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // still, but for slow rings; stirred when the Watcher wakes
        vec2 p = vWorld.xz * 0.4;
        float n = noise(p + uTime * 0.05) * 0.5 + noise(p * 2.7 - uTime * 0.08) * 0.5;
        float rip = sin(length(vWorld.xz - vec2(4.0, 10.0)) * 3.0 - uTime * 2.0) * uStir * 0.5;
        vec3 nrm = normalize(vec3((n - 0.5) * (0.12 + uStir * 0.5) + rip * 0.1, 1.0, (noise(p * 1.7 + 3.0) - 0.5) * (0.12 + uStir * 0.5)));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 4.0);
        vec3 col = mix(uDeep, uSky, fres * 0.8);
        col += uSunColor * pow(max(dot(reflect(-normalize(uSun), nrm), view), 0.0), 160.0) * 3.0;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) lakeMat.uniforms[k] = water.uniforms[k];
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(220, 120).rotateX(-Math.PI / 2), lakeMat);
  lake.position.set(0, LAKE_Y, GATE.shore + 60);
  zones.gate.add(lake);
  if (kit.rubble) {
    const rocks = GATE_ROCKS.map(([x, z, s], i) => ({ x, z, y: gateHeight(x, z) - 0.2, s, turn: i * 2.1 }));
    zones.gate.add(instances(kit.rubble(5), mats.rubble ?? mats.stone, rocks, { shadow: false }));
  }
  // the shore's own clutter: stones of every size fallen from the cliff and
  // washed up by the lake, reeds along the water, dead trees past the ends
  // of the shore, and mist lying on the lake
  {
    const rnd = makeNoise(71);
    const stone = (() => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 0.72 + rnd(p.getX(i) * 3.1, p.getY(i) * 2.7 + p.getZ(i) * 1.9) * 0.5;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k);
      }
      return g.toNonIndexed();
    })();
    stone.computeVertexNormals();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a706a, roughness: 0.92, flatShading: true });
    const list = [];
    for (let i = 0; list.length < Math.round(230 * Math.max(0.4, many)) && i < 4000; i++) {
      const x = GATE.west + 1 + ((i * 7.13 + rnd(i, 1) * 9) % (GATE.east - GATE.west - 2));
      const z = GATE.cliff + 1 + ((i * 3.71 + rnd(i, 2) * 5) % (GATE.shore - GATE.cliff + 1.5));
      // keep the apron before the Doors, and the way to them, clear
      if (Math.hypot(x / 1.4, z - GATE.cliff - 3) < 5.2 || (Math.abs(x) < 2.6 && z < GATE.shore - 1)) continue;
      const big = rnd(i, 3) > 0.86;
      // more of them under the cliff, and along the water
      const s = big ? 0.3 + rnd(i, 4) * 0.35 : 0.04 + rnd(i, 4) * rnd(i, 16) * 0.2;
      const nearEdge = z < GATE.cliff + 3 || z > GATE.shore - 2.5;
      if (!nearEdge && (big || rnd(i, 5) > 0.7)) continue;
      list.push({ x, z, s });
    }
    const m = new THREE.InstancedMesh(stone, stoneMat, list.length);
    const o = new THREE.Object3D();
    list.forEach((q, i) => {
      o.position.set(q.x, gateHeight(q.x, q.z) - q.s * 0.25, q.z);
      o.rotation.set(rnd(i, 6) * 0.6, rnd(i, 7) * 6.28, rnd(i, 8) * 0.6);
      o.scale.set(q.s * (1 + rnd(i, 9) * 0.5), q.s, q.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, new THREE.Color().setHSL(0.3, 0.04, 0.32 + rnd(i, 10) * 0.16));
    });
    zones.gate.add(m);
    // reeds in clumps along the water's edge, and out into the shallows
    const blade = (() => {
      const geos = [];
      for (let b = 0; b < 9; b++) {
        const a = (b / 9) * Math.PI * 2;
        const h = 0.7 + (b % 3) * 0.28;
        const g = new THREE.PlaneGeometry(0.035, h, 1, 3).translate(0, h / 2, 0);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const k = p.getY(i) / h;
          p.setX(i, p.getX(i) * (1 - k * 0.9) + k * k * 0.12 * Math.cos(a));
          p.setZ(i, k * k * 0.12 * Math.sin(a));
        }
        g.rotateY(a).translate(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09);
        geos.push(g);
      }
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      return merged;
    })();
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.9, side: THREE.DoubleSide });
    const reeds = [];
    for (let i = 0; i < Math.round(70 * Math.max(0.4, many)); i++) {
      const x = GATE.west - 4 + ((i * 11.7 + rnd(i, 11) * 6) % (GATE.east - GATE.west + 8));
      const z = GATE.shore - 0.6 + rnd(i, 12) * 2.6;
      if (Math.abs(x) < 3) continue;
      reeds.push({ x, z, s: 0.7 + rnd(i, 13) * 0.6 });
    }
    const rm = new THREE.InstancedMesh(blade, reedMat, reeds.length);
    reeds.forEach((q, i) => {
      o.position.set(q.x, Math.max(LAKE_Y - 0.25, gateHeight(q.x, q.z) - 0.05), q.z);
      o.rotation.set(0, rnd(i, 14) * 6.28, 0);
      o.scale.set(q.s, q.s * (0.8 + rnd(i, 15) * 0.5), q.s);
      o.updateMatrix();
      rm.setMatrixAt(i, o.matrix);
    });
    zones.gate.add(rm);
    // dead trees, grey and bare, past the ends of the shore
    const bark = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.95 });
    for (const [x, z, s, seed] of [
      [-29, -7, 1.1, 3],
      [-31, 1, 0.8, 5],
      [25, -9, 1.2, 7],
      [27.5, 0.5, 0.9, 9],
    ]) {
      const r = makeNoise(seed);
      const geos = [tube([[0, -0.4, 0], [0.2, 2.2 * s, 0.1], [-0.1, 4.2 * s, 0.3], [0.3, 5.6 * s, 0]], 0.32 * s, 0.06, { seg: 10, radial: 7, gnarl: 0.3, seed })];
      for (let b = 0; b < 4; b++) {
        const y = (2 + b * 0.9) * s;
        const a = b * 2.3 + r(b, 1) * 0.8;
        const len = (1.6 - b * 0.22) * s;
        geos.push(tube([[0, y, 0], [Math.cos(a) * len * 0.5, y + 0.5 * s, Math.sin(a) * len * 0.5], [Math.cos(a) * len, y + 1.1 * s + r(b, 2) * 0.4, Math.sin(a) * len]], 0.1 * s, 0.015, { seg: 6, radial: 5, gnarl: 0.4, seed: seed + b }));
      }
      const g = mergeGeometries(geos.map((q) => (q.index ? q.toNonIndexed() : q)));
      const tree = new THREE.Mesh(g, bark);
      tree.position.set(x, gateHeight(x, z) - 0.2, z);
      tree.rotation.y = seed;
      zones.gate.add(tree);
    }
  }
  // mist lying on the lake, drifting slowly along the shore
  const mist = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    sharpen(tex);
    const list = [];
    for (let i = 0; i < Math.round(18 * Math.max(0.5, many)); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x9aaccc, transparent: true, opacity: 0.12 + (i % 4) * 0.03, depthWrite: false, fog: true }));
      sp.scale.set(10 + (i % 5) * 3, 1.6 + (i % 3) * 0.6, 1);
      sp.position.set(-40 + i * 5.1, LAKE_Y + 0.5 + (i % 3) * 0.35, GATE.shore + 3 + (i % 5) * 3.2);
      zones.gate.add(sp);
      list.push({ sp, v: 0.25 + (i % 3) * 0.12 });
    }
    return list;
  })();

  // the Watcher's arms, waiting under the water, and the marks where they'll fall
  const watcher = kit.watcher();
  const tentacles = Array.from({ length: 5 }, (_, i) => {
    const t = watcher.tentacle(i + 1);
    t.group.visible = false;
    zones.gate.add(t.group);
    return t;
  });
  // (their bones bend them far from where they rest, so don't cull them by it)
  for (const t of tentacles) t.group.traverse((o) => o.isSkinnedMesh && (o.frustumCulled = false));
  const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.9, 0.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const markGeo = new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2);
  const marks = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(markGeo, markMat.clone());
    m.renderOrder = 2;
    zones.gate.add(m);
    return m;
  });

  // ── the halls ──
  const hall = kit.hall();
  zones.halls.add(hall.group);
  const fork = kit.fork();
  fork.group.position.set(FORK.x, 0, 0);
  fork.group.rotation.y = -Math.PI / 2;
  zones.halls.add(fork.group);
  const chamber = kit.chamber();
  chamber.group.position.set(CHAMBER.x, 0, CHAMBER.z);
  // the grey daylight down the shaft onto the tomb
  chamber.beam?.set?.(1);
  zones.halls.add(chamber.group);
  // the dark stone of the passage and the walls, the floor where the hall's
  // own doesn't reach, and the rock-falls in the wrong ways
  const darkStone = mats.stone ?? new THREE.MeshStandardMaterial({ color: 0x2a2c2c, roughness: 0.7 });
  const slab = (x, y, z, w, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkStone);
    m.position.set(x, y, z);
    zones.halls.add(m);
  };
  const pw = PASSAGE.w / 2;
  slab((PASSAGE.x0 + FORK.x) / 2, -0.25, 0, FORK.x - PASSAGE.x0 + 6, 0.5, PASSAGE.w + 2);
  slab((PASSAGE.x0 + FORK.x) / 2, 7, -pw - 0.5, FORK.x - PASSAGE.x0, 14, 1);
  slab((PASSAGE.x0 + FORK.x) / 2, 7, pw + 0.5, FORK.x - PASSAGE.x0, 14, 1);
  slab(PASSAGE.x0 - 0.5, 7, 0, 1, 14, PASSAGE.w);
  slab((PASSAGE.x0 + FORK.x) / 2, 12, 0, FORK.x - PASSAGE.x0, 1, PASSAGE.w + 2);
  slab(-HALL.w / 2 - 0.5, 10, -HALL.d / 4 - 1.5, 1, 20, HALL.d / 2 + 3);
  slab(-HALL.w / 2 - 0.5, 10, HALL.d / 2 - 2.3, 1, 20, 4.6);
  slab(-HALL.w / 2 - 0.5, 14, FORK.ways[FORK.right], 1, 12, 3);
  if (kit.rubble)
    zones.halls.add(
      instances(
        kit.rubble(9),
        mats.rubble ?? darkStone,
        FORK.ways.filter((_, i) => i !== FORK.right).map((z, i) => ({ x: FORK.x + 2.6, z, y: 0, s: 1.2, turn: i })),
        { shadow: false },
      ),
    );
  // on the side: an old shaft in the floor of the hall with a plank across
  // it, and Gandalf's pipe lying on the plank over the middle, where Pippin
  // left it
  const shaft = (() => {
    const g = new THREE.Group();
    g.position.set(SHAFT.x, 0, SHAFT.z);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.7, '#020202');
    grad.addColorStop(1, '#1c1a17');
    x.fillStyle = grad;
    x.fillRect(0, 0, 64, 64);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(SHAFT.r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    hole.position.y = 0.012;
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(SHAFT.r + 0.06, 0.15, 6, 30).rotateX(Math.PI / 2), darkStone);
    kerb.scale.y = 0.55;
    kerb.position.y = 0.05;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(SHAFT.plank, 0.07, 0.36), new THREE.MeshStandardMaterial({ color: 0x5c4129, roughness: 0.85 }));
    plank.position.y = 0.17;
    const pipe = new THREE.Group();
    const briar = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.6 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.44, 6).rotateZ(Math.PI / 2), briar);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.08, 10), briar);
    bowl.position.set(-0.22, 0.03, 0);
    pipe.add(stem, bowl);
    pipe.position.set(0.05, 0.22, 0.05);
    pipe.rotation.y = 0.6;
    g.add(hole, kerb, plank, pipe);
    zones.halls.add(g);
    return { plank, pipe };
  })();

  // the falling dwarf at the well: his skull, his body, the bucket and chain
  const bone = new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.5, metalness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
  const tumbling = {
    skull: new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), bone),
    body: new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.3), iron),
    bucket: new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.32, 12), wood),
  };
  for (const m of Object.values(tumbling)) {
    m.visible = false;
    zones.halls.add(m);
  }

  // ── the flight: the stair and the bridge ──
  const stairs = kit.stairs();
  stairs.group.rotation.y = Math.PI;
  stairs.group.position.set(FLIGHT.stair[1], 0, 0);
  zones.flight.add(stairs.group);
  const bridge = kit.bridge(FLIGHT.bridge[1] - FLIGHT.bridge[0]);
  bridge.group.position.set((FLIGHT.bridge[0] + FLIGHT.bridge[1]) / 2, 0, 0);
  zones.flight.add(bridge.group);
  // the landing between them, and the far side
  const landing = new THREE.Mesh(new THREE.BoxGeometry(FLIGHT.bridge[0] - FLIGHT.stair[1] + 1, 1, 6), darkStone);
  landing.position.set((FLIGHT.stair[1] + FLIGHT.bridge[0]) / 2, -0.5, 0);
  // the ledge you come out onto, at the stair's head
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(FLIGHT.stair[0] + 12, 1, 5), darkStone);
  ledge.position.set((FLIGHT.stair[0] - 12) / 2, FLIGHT.drop - 0.5, 0);
  zones.flight.add(ledge);
  const far = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 24), darkStone);
  far.position.set(FLIGHT.bridge[1] + 15, -0.5, 0);
  zones.flight.add(landing, far);
  const balrog = kit.balrog();
  zones.flight.add(balrog.group);
  // where a runner is, along the flight: down the stair, then level
  const flightY = (s) => FLIGHT.drop * (1 - Math.max(0, Math.min(1, (s - FLIGHT.stair[0]) / (FLIGHT.stair[1] - FLIGHT.stair[0]))));

  // ── people ──
  // (outdoors, each stands on a soft blob slid away from the sun, and dims in
  // the baked shade, ../grounded.js; the circle under each is kept for the
  // zones indoors, and hidden while a blob is drawn)
  const movers = [];
  const blobGeo = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const blob = (f, s = 1) => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.position.y = 0.04;
    b.scale.setScalar(s);
    b.renderOrder = 1;
    movers.push({ object: f.group, size: [FIGURE * s, FIGURE * s], contact: b });
    f.group.add(b);
    return f;
  };
  const frodo = blob(folk('frodo'));
  scene.add(frodo.group);
  const ghosts = createGhosts({ height: gateHeight });
  zones.gate.add(ghosts.group);
  const people = {};
  for (const c of CAST) {
    const p = blob(folk(c.look));
    p.group.visible = false;
    zones[c.zone].add(p.group);
    p.home = c;
    people[c.id] = p;
  }
  // the Fellowship, following in the halls and on the flight
  const company = Object.fromEntries(
    COMPANY.map((id) => {
      const p = blob(folk(id));
      p.group.visible = false;
      scene.add(p.group);
      return [id, p];
    }),
  );
  const staff = kit.staffLight?.();
  if (staff) company.gandalf.group.add(staff.sprite);
  if (staff) staff.sprite.position.set(0.3, 2.6, 0.2);
  // the troll, and goblins in the chamber
  const troll = kit.caveTroll();
  troll.group.visible = false;
  zones.halls.add(troll.group);
  const goblins = Array.from({ length: tier === 'low' ? 4 : 8 }, (_, i) => {
    const g = kit.goblin(i + 1);
    g.group.visible = false;
    zones.halls.add(g.group);
    return g;
  });

  // ── light and fire ──
  const flames = createParticles(Math.round(500 * Math.max(0.5, many)), { ramp: FLAME, additive: true, gravity: 2.2, drag: 1.1, swirl: 0.9 });
  const embers = createParticles(Math.round(400 * Math.max(0.5, many)), { ramp: EMBER, additive: true, gravity: 1.4, drag: 0.5, swirl: 1.6 });
  scene.add(flames.mesh, embers.mesh);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;

  // ── state ──
  const A = { t: 0, cam: { at: V(0, 4, 10), look: V(0, 2, -10) }, mode: '', shake: 0, lit: 0, open: 0, ithil: 0, stir: 0, fire: 0 };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const white = new THREE.Color(0xe8eeff);
  const fireCol = new THREE.Color(0xff6a2a);
  const dayCol = new THREE.Color(0xc8d0d8);
  const turnTo = (p, face, dt, k = 4) => {
    let d = face - p.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.group.rotation.y += d * Math.min(1, dt * k);
  };

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const zone = s.zone;
    sky.uniforms.uTime.value = t;
    lakeMat.uniforms.uTime.value = t;
    kit.tick?.(t);
    if (zone === 'halls') chamber.update?.(t);
    if (zone === 'flight') {
      bridge.update?.(t);
      bridge.glow?.set(0.7);
    }
    for (const [k, g] of Object.entries(zones)) g.visible = k === zone;
    const sunDir = atmosphere(1, 0);
    const lights = [];
    const h = s.hobbit;

    // ── the place's light ──
    sky.dome.visible = zone === 'gate';
    // (under the mountain the fog is the dark's own, not the sky's)
    houseLook.set({ fogMix: zone === 'gate' ? 1 : 0 });
    if (zone === 'gate') {
      scene.background = null;
    } else {
      scene.background = BLACK;
      scene.fog.color.set(zone === 'flight' ? 0x0a0402 : 0x020304).lerp(LIT_FOG, zone === 'halls' ? A.lit : 0);
      scene.fog.near = zone === 'flight' ? 20 : 6 + A.lit * 16;
      scene.fog.far = zone === 'flight' ? 140 : 46 + A.lit * 120;
      hemi.color.set(zone === 'flight' ? 0x5a2010 : 0x56687c);
      hemi.groundColor.set(0x0a0a0c);
      hemi.intensity = zone === 'flight' ? 0.5 : 0.06 + A.lit * 1.25;
      // grey light from high shafts, once he's risked it
      sun.color.set(0x9aaabb);
      sun.intensity = zone === 'halls' ? A.lit * 0.55 : 0;
      renderer.toneMappingExposure = 1.4 * houseLook.exposure;
      // (full light under the mountain is these lights', not the day's)
      houseLook.light({ sun, hemi });
    }
    A.lit += ((s.lit ? 1 : 0) - A.lit) * Math.min(1, dt * (s.revealing ? 0.6 : 2));
    hall.lightFrom?.(A.lit);

    // ── the Doors ──
    A.open += ((s.doorsOpen ? 1 : 0) - A.open) * Math.min(1, dt * 0.4);
    gate.open(A.open);
    A.ithil += ((s.ithildin ? 1 : 0) - A.ithil) * Math.min(1, dt * 0.8);
    gate.setIthildin(Math.max(0.15, A.ithil));
    A.stir += ((s.dash ? 1 : 0) - A.stir) * Math.min(1, dt * 1.5);
    lakeMat.uniforms.uStir.value = A.stir;

    // ── Frodo ──
    let fy = 0;
    if (zone === 'gate') fy = gateHeight(h.x, h.z);
    else if (zone === 'halls') fy = hallHeight(h.x);
    frodo.group.visible = zone !== 'flight' || s.mode === 'flight';
    if (zone === 'flight') {
      const f = s.flight;
      const sAt = f ? f.s : 0;
      const air = f && f.air > 0 ? Math.sin((1 - f.air / 0.8) * Math.PI) * 1.1 : 0;
      wpos('flight', sAt, flightY(sAt) + air, f ? f.lat : 0, frodo.group.position);
      frodo.group.rotation.set(0, 0, 0);
      pose(frodo, t, { moving: true, speed: 1.5 });
      frodo.group.visible = s.mode === 'flight' || s.mode === 'bridge';
      if (s.mode === 'bridge') {
        wpos('flight', FLIGHT.end - 2, 0, -0.5, frodo.group.position);
        frodo.group.rotation.y = Math.PI;
        pose(frodo, t, { moving: false });
      }
    } else {
      wpos(zone, h.x, fy, h.z, frodo.group.position);
      frodo.group.rotation.set(0, h.face, 0);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
      if (s.held) frodo.body.rotation.z = -0.5;
      else frodo.body.rotation.z = 0;
      // out on the plank: tipping as the balance goes, arms out to keep it
      if (s.mode === 'plank' && s.plank) {
        const lean = s.plank.lean;
        frodo.group.position.y += 0.2;
        frodo.group.rotation.set(lean * 0.55, h.face, 0);
        frodo.arms[0].rotation.x = 1.2 + lean * 0.4;
        frodo.arms[1].rotation.x = -1.2 + lean * 0.4;
      } else frodo.arms[0].rotation.x = 0;
    }
    ghosts.update(zone === 'gate' ? (s.travellers ?? []) : [], t, dt, { ringOn: Boolean(s.wearing) });
    if (zone === 'gate') {
      for (const m of mist) {
        m.sp.position.x += m.v * dt;
        if (m.sp.position.x > 46) m.sp.position.x -= 92;
      }
    }

    // ── who's about ──
    for (const c of CAST) {
      const p = people[c.id];
      const on = c.zone === zone && s.cast?.includes(c.id);
      p.group.visible = Boolean(on);
      if (!on) continue;
      const y = c.zone === 'gate' ? gateHeight(c.x, c.z) : hallHeight(c.x);
      p.group.position.set(c.x, y, c.z);
      const near = Math.hypot(h.x - c.x, h.z - c.z) < 5;
      turnTo(p, near ? Math.atan2(-(h.z - c.z), h.x - c.x) : c.face, dt);
      pose(p, t + c.x, { moving: false, talk: s.talk === c.id ? 1 : 0 });
    }
    // the Fellowship behind you, in the halls and on the flight
    COMPANY.forEach((id, i) => {
      const p = company[id];
      const at = s.company?.[id];
      p.group.visible = Boolean(at);
      if (!at) return;
      if (at.zone === 'flight') {
        wpos('flight', at.s, flightY(at.s), at.lat ?? 0, p.group.position);
        p.group.rotation.y = at.face ?? 0;
      } else {
        wpos(at.zone, at.x, at.zone === 'halls' ? hallHeight(at.x) : gateHeight(at.x, at.z), at.z, p.group.position);
        turnTo(p, at.face, dt, 6);
      }
      pose(p, t + i, { moving: Boolean(at.moving), speed: at.zone === 'flight' ? 1.5 : 1, wave: at.fight ? 0.6 : 0 });
    });
    // Gandalf's staff: the only light in the dark, till he risks more
    if (zone !== 'gate' && company.gandalf.group.visible) {
      const at = company.gandalf.group.position.clone().add(V(0.3, 2.6, 0.2));
      const fire = zone === 'flight';
      staff?.set(fire ? 0.45 : 1);
      lights.push([at, white, fire ? 2.5 : 7 + A.lit * 4, fire ? 10 : 16 + A.lit * 10]);
    }

    // ── the West-gate: the Watcher ──
    const strikes = s.dash?.strikes ?? [];
    marks.forEach((m, i) => {
      const st = strikes[i];
      m.visible = zone === 'gate' && Boolean(st) && !st.fallen;
      if (!m.visible) return;
      const k = Math.min(1, st.t / 0.95);
      m.position.set(st.x, gateHeight(st.x, st.z) + 0.05, st.z);
      m.scale.setScalar(st.r * (0.4 + 0.6 * k));
      m.material.opacity = 0.25 + 0.6 * k;
    });
    tentacles.forEach((tc, i) => {
      const st = strikes[i];
      tc.group.visible = zone === 'gate' && (Boolean(s.dash) || A.stir > 0.05);
      if (!tc.group.visible) return;
      // each rises from the lake's edge, turned towards where it will fall
      const base = st ? V(st.x * 0.6, LAKE_Y, GATE.shore + 2 + i * 0.8) : V(-8 + i * 4, LAKE_Y, GATE.shore + 3 + (i % 2) * 2);
      tc.group.position.copy(base);
      if (st) tc.group.rotation.y = Math.atan2(-(st.z - base.z), st.x - base.x);
      const rise = st ? Math.min(1, st.t * 2) : 0.4 + Math.sin(t * 0.7 + i) * 0.1;
      const slam = st && st.t >= 0.95 ? Math.min(1, (st.t - 0.95) * 6) * (1 - Math.max(0, st.t - 1.4) * 2) : 0;
      tc.update(t + i, rise * A.stir, Math.max(0, slam));
    });

    // ── the chamber: the dwarf at the well, the troll, the goblins ──
    const tm = s.tumble;
    for (const [id, m] of Object.entries(tumbling)) {
      const it = TUMBLE.items.find((x) => x.id === id);
      m.visible = Boolean(tm) && zone === 'halls';
      if (!m.visible) continue;
      const caught = tm.caught.includes(id);
      const k = Math.max(0, Math.min(1, (tm.t - it.at) / it.fall));
      const y = caught ? 1.1 : k <= 0 ? 1.15 : 1.15 - k * k * 7;
      m.position.set(WELL.x + 0.2 * (id === 'body' ? 1 : -1), y, WELL.z + 0.6);
      m.visible = caught || y > -1.5;
      m.rotation.z = caught ? 0 : k * 6;
    }
    const tw = s.troll?.[0];
    troll.group.visible = zone === 'halls' && Boolean(tw);
    if (tw) {
      troll.group.position.set(tw.x, 0, tw.z);
      turnTo(troll, tw.face, dt, 8);
      const hunting = tw.mode === 'alert' || tw.mode === 'chase';
      troll.animate?.(t, { walking: tw.mode === 'search' ? Boolean(tw.goal) : tw.mode === 'suspicious' ? !(tw.looked > 0) : tw.mode !== 'patrol' || tw.wait <= 0, swing: s.swing ?? 0, roar: hunting ? 1 : 0 });
    }
    goblins.forEach((g, i) => {
      const on = zone === 'halls' && Boolean(s.troll);
      g.group.visible = on;
      if (!on) return;
      // fighting along the chamber's walls
      const a = (i / goblins.length) * TAU + t * 0.08;
      g.group.position.set(CHAMBER.x + Math.cos(a) * 6.4, 0, CHAMBER.z + Math.sin(a) * 5);
      g.group.rotation.y = -a + Math.PI;
      g.animate?.(t + i, { running: true });
    });
    // daylight on the tomb, from the high window
    if (zone === 'halls' && h.z < -HALL.d / 2 + 2) lights.push([V(TOMB.x, 6, TOMB.z).add(AT.halls), dayCol, 6, 14]);

    // ── the flight: the Balrog behind, fire below ──
    const f = s.flight;
    balrog.group.visible = zone === 'flight';
    if (zone === 'flight') {
      let bs;
      if (s.mode === 'bridge') bs = FLIGHT.bridge[0] + 16 + Math.min(1, s.stepT * 0.2) * 4;
      else bs = (f ? f.s - f.behind * 1.4 : 0) - 9;
      balrog.group.position.set(bs, flightY(Math.max(0, bs)) - (s.fallen ?? 0) * 40, 0);
      balrog.group.rotation.y = 0;
      balrog.update(t, { stride: s.mode === 'flight' ? 1 : 0.3, rage: s.mode === 'bridge' ? 1 : 0.6, whip: s.whip ?? 0 });
      const glow = balrog.group.position.clone().add(AT.flight).add(V(0, 6, 0));
      lights.push([glow, fireCol, s.mode === 'bridge' ? 14 : 9, 40]);
      lights.push([wpos('flight', (f?.s ?? 70) + 4, -14, 0), fireCol, 6, 40]);
      // embers rising out of the abyss
      A.fire += dt;
      while (A.fire > 0.04) {
        A.fire -= 0.04;
        const x = (f?.s ?? 70) + R(30);
        embers.emit(AT.flight.x + x, -8 + R(4), R(12), R(0.3), 2 + Math.random() * 2, R(0.3), 4, 0.06, 0.02, 1.4);
        flames.emit(balrog.group.position.x + AT.flight.x + R(1.5), 9 + R(2), R(1.2), R(0.4), 2, R(0.4), 0.9, 1.2, 0.2, 1);
      }
    }
    flames.step(dt);
    embers.step(dt);
    fx.step(dt, t, { night: 0, day: 0 });

    pool.forEach((l, i) => {
      const v = lights[i];
      if (!v) return (l.intensity = 0);
      l.position.copy(v[0]);
      l.color.copy(v[1]);
      l.intensity = v[2];
      l.distance = v[3];
      return undefined;
    });

    // the plank over the old shaft sways with you, and the pipe lies on it
    // till you have it (or it's gone down the shaft, or Gandalf has it back)
    const pl = s.mode === 'plank' ? s.plank : null;
    shaft.plank.rotation.x = pl ? pl.lean * 0.07 : 0;
    shaft.pipe.visible = pl ? !pl.back : !s.pipeTaken;
    shaft.pipe.rotation.x = pl ? pl.lean * 0.07 : 0;

    // ── the camera ──
    let camAt;
    let camLook;
    if (zone === 'flight') {
      const sAt = s.mode === 'bridge' ? FLIGHT.bridge[0] + 22 : (f?.s ?? 0);
      if (s.mode === 'bridge') {
        // past Gandalf's shoulder, at the Balrog on the bridge
        camAt = wpos('flight', sAt + 9, 2, 1.8, tmp);
        camLook = wpos('flight', sAt - 8, 4.5 - (s.fallen ?? 0) * 6, 0, look);
      } else {
        camAt = wpos('flight', sAt - 7, flightY(Math.max(0, sAt - 7)) + 4.2, (f?.lat ?? 0) + 3.4, tmp);
        camLook = wpos('flight', sAt + 6, flightY(sAt + 6) + 0.6, 0, look);
      }
    } else if (s.mode === 'talk' && s.camShot) {
      camAt = wpos(zone, ...s.camShot.at, tmp);
      camLook = wpos(zone, ...s.camShot.look, look);
    } else if (s.mode === 'plank') {
      // from the west end, along the plank: tipping shows left and right
      camAt = wpos('halls', SHAFT.x - PLANK.half - 3.6, 2.3, SHAFT.z + 0.4, tmp);
      camLook = wpos('halls', SHAFT.x + 0.4, 0.55, SHAFT.z, look);
    } else if (s.mode === 'tumble') {
      camAt = wpos('halls', WELL.x - 3.2, 2.4, WELL.z + 3.2, tmp);
      camLook = wpos('halls', WELL.x, 0.6, WELL.z, look);
    } else if (s.mode === 'dash') {
      // from out over the water's edge, side on: the Doors, you, and the arms coming up out of the lake
      camAt = wpos('gate', h.x + 9, gateHeight(h.x, h.z) + 6.5, GATE.shore + 5, tmp);
      camLook = wpos('gate', h.x - 2.5, 1, (h.z + GATE.cliff) / 2 + 1, look);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.36;
      const dist = s.camDist ?? 6.4;
      wpos(zone, h.x, fy + 1.1, h.z, look);
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      if (zone === 'halls') {
        const k = clearance(look.clone().sub(AT.halls), camAt.clone().sub(AT.halls));
        if (k < 1) camAt.lerpVectors(look, camAt, Math.max(0.25, k));
        camAt.y = Math.min(camAt.y, 9);
      } else {
        const floor = gateHeight(camAt.x, camAt.z) + 0.6;
        if (camAt.y < floor) camAt.y = floor;
        if (camAt.z < GATE.cliff + 1.5) camAt.z = GATE.cliff + 1.5;
      }
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const key = `${zone}|${s.mode}|${s.camShot?.id ?? ''}`;
    const jump = A.mode !== key;
    A.mode = key;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' || s.mode === 'flight' ? 7 : 2.4));
    A.cam.at.lerp(camAt, ease);
    A.cam.look.lerp(camLook, ease);
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

  const fxEvent = (type, at) => {
    if (type === 'slam') {
      A.shake = Math.max(A.shake, 0.18);
      if (at) fx.puff(V(at.x, gateHeight(at.x, at.z) + 0.3, at.z), V(0, 1, 0), 10);
    } else if (type === 'grabbed') A.shake = 0.3;
    else if (type === 'drums') A.shake = Math.max(A.shake, 0.12);
    else if (type === 'troll') A.shake = Math.max(A.shake, 0.2);
    else if (type === 'hit') A.shake = Math.max(A.shake, 0.25);
    else if (type === 'break') A.shake = 0.5;
    else if (type === 'caught') fx.pop(tmp2.copy(frodo.group.position).add(V(0, 1.2, 0)), 'gold', 12, 1);
  };
  const screenOf = (kind, id) => {
    const p0 = people[id];
    if (kind !== 'cast' || !p0 || !p0.group.visible) return null;
    const p = p0.group.getWorldPosition(tmp).add(tmp2.set(0, 2.2, 0)).project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };

  // ── the floor's light, baked in each zone outdoors when it's first shown ──
  const grounds = [
    groundTown({ renderer, scene, terrain: gateLand, outdoors: zones.gate, sun, height: null, people: movers, skip: [sky.dome, ghosts.group], tier, radius: null, shade: 0x1e2026, clip: true }),
  ];
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    ground: import.meta.env.DEV ? grounds[0] : null, // for the QA scripts
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
      for (const g of grounds) g.dispose();
      ghosts.dispose();
      disposeTree(scene);
      stage.dispose();
    },
  };
}

// What the camera can't go through in the halls: the pillars, the walls.
const BLOCKERS = HALL_COLLIDERS.filter((c) => !c.low);
function insideAt(x, y, z) {
  if (y < 0.3) return true;
  for (const c of BLOCKERS) {
    if (c.kind === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + 0.25) return true;
    } else if (Math.abs(x - c.x) < c.w / 2 + 0.25 && Math.abs(z - c.z) < c.d / 2 + 0.25) return true;
  }
  for (const [x0, z0, x1, z1, thick] of HALL_WALLS) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < thick + 0.3) return true;
  }
  return false;
}
function clearance(from, to) {
  const N = 12;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    if (insideAt(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k)) return Math.max(0.2, (i - 1) / N);
  }
  return 1;
}
