// Lothlórien, in WebGL: the golden wood, its mallorns going up out of
// sight and their leaves coming down; Caras Galadhon round its great tree,
// the flets and the stair and the blue-white lanterns at night; the Mirror
// in its hollow; the landing and the boats; then the Anduin between its
// cliffs, and the Pillars of the Kings. And on the side, Legolas's painted
// boards among the trees, and the arrows you shoot at them. Made in code (./props.js,
// ../ground.js), so nothing is downloaded.
//
// The wood is at the origin and the river is drawn well off to the east;
// only the one you're in is shown. It draws what the component hands it
// and decides nothing.
//
// createLorienWorld(canvas) returns { render(state, ms, fast), fx(type, id),
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
import { createLorienKit } from './props';
import { createGollum } from '../marshes/props';
import { AMBUSH, BANK, BOARDS, BUTTS, CAST, CITY, COLLIDERS, GALADHRIM, LANDING, MALLORNS, MIRROR, PATHS, RANGE, RIVER_Y, STAIR, TABLE, TREE, WOOD, groundHeight, nearPath, streamX, woodHeight } from './layout';
import { RIVER, aimDir, riverBend, riverWide } from './rules';
import { attend, castDo, castPlay, followDrawn, releaseCast, tickCast } from '../../cast3d';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const TAU = Math.PI * 2;
// where each place is drawn
const AT = { wood: V(0, 0, 0), river: V(3000, 0, 0) };
const TEMPT_FOG = new THREE.Color(0x0a1a14);
// where the Argonath stand along the river
const KINGS = RIVER.argonath + 34;

// who's who
const LOOKS_HERE = {
  frodo: LOOKS.frodo,
  sam: { ...LOOKS.sam, pack: true },
  merry: LOOKS.merry,
  pippin: LOOKS.pippin,
  aragorn: { tall: 1.5, coat: 0x3e3a34, shirt: 0x5a5246, cloak: 0x4a5444, hairStyle: 'long', hair: 0x2a1e16, beard: { color: 0x2a1e16, len: 0.12 }, item: 'sword', feet: 'boots', seed: 7 },
  gimli: { tall: 0.95, wide: 1.35, coat: 0x6a3a22, shirt: 0x8a8f98, hat: 'helm', hairStyle: 'none', hair: 0x9a3a1a, beard: { color: 0xa8441c, len: 0.5 }, item: 'axe', feet: 'boots', seed: 11 },
  legolas: { tall: 1.5, coat: 0x5a6a3a, shirt: 0x7a7a5a, hairStyle: 'long', hair: 0xf2e4b0, item: 'bow', feet: 'boots', seed: 15 },
  boromir: { tall: 1.55, coat: 0x6a2a22, shirt: 0x5a4a3a, cloak: 0x3a2a24, hairStyle: 'long', hair: 0x5a3a22, beard: { color: 0x5a3a22, len: 0.1 }, item: 'horn', feet: 'boots', seed: 19 },
  haldir: { tall: 1.56, coat: 0x4a5238, shirt: 0x6a6a4a, cloak: 0x6a7056, hairStyle: 'long', hair: 0xe8d8a8, item: 'bow', feet: 'boots', seed: 41 },
  galadriel: { tall: 1.62, robe: 0xf6f4ec, hairStyle: 'long', hair: 0xf2dca0, hat: 'crown', feet: 'boots', seed: 43 },
  celeborn: { tall: 1.64, robe: 0xdfe4ea, hairStyle: 'long', hair: 0xeeeeea, hat: 'crown', feet: 'boots', seed: 45 },
  elf: { tall: 1.52, coat: 0x56603e, shirt: 0x6a6a4a, cloak: 0x6e7656, hairStyle: 'long', hair: 0xd8c08a, item: 'bow', feet: 'boots', seed: 47 },
};
const folk = (look) => makeFolk(look, { look: LOOKS_HERE[look] ?? LOOKS_HERE.elf });
// the Fellowship following you in, in the order the component gives them
const COMPANY = ['aragorn', 'sam', 'gimli', 'legolas', 'merry', 'pippin', 'boromir'];

const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const LITTER = C(0x7a6430);
const GOLD = C(0xb8923a);
const MOSS = C(0x56602e);
const PATH = C(0xc8bfa4);
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const noise = makeNoise(61);
function paint(x, z, h, out) {
  lerp3(out, LITTER, GOLD, smooth(0.35, 0.7, fbm(noise, x * 0.05, z * 0.05, { octaves: 3 })));
  lerp3(out, out, MOSS, smooth(0.55, 0.78, fbm(noise, x * 0.11 + 7, z * 0.11, { octaves: 2 })) * 0.7);
  // the paths, pale and worn
  const p = 1 - smooth(1.1, 2.3, nearPath(x, z));
  if (p > 0) lerp3(out, out, PATH, p * 0.85);
  // pale stone round the great tree
  const d = Math.hypot(x - TREE.x, z - TREE.z);
  if (d < 9) lerp3(out, out, PATH, (1 - smooth(6.5, 9, d)) * 0.7);
  return out;
}
const growable = (x, z) => nearPath(x, z) > 2.5 && Math.hypot(x - TREE.x, z - TREE.z) > 10 && Math.hypot(x - MIRROR.x, z - MIRROR.z) > MIRROR.foot + 1 && x < BANK - 2 && x > WOOD.west + 1;

// The wood's moods, in the sky's slots: `day` the golden afternoon you come
// in, `night` blue under the lanterns, `dawn` the pale morning you leave.
const MOODS = {
  day: { top: 0x8ab0d8, horizon: 0xf6e6b0, sun: [-0.5, 0.55, 0.3], sunColour: 0xffe2a0, sunPower: 2.2, hemiSky: 0xf2e6c0, hemiGround: 0x6a5a2a, hemi: 1.05, fog: 0xd8c890, fogNear: 30, fogFar: 210, cloud: 0.3, cloudColour: 0xfff4dc, stars: 0, exposure: 1.05, water: 0x8aa8a0, deep: 0x2a3a30 },
  night: { top: 0x060c22, horizon: 0x1c2c52, sun: [0.3, 0.6, -0.4], sunColour: 0x9ab4f0, sunPower: 0.55, hemiSky: 0x4a62a8, hemiGround: 0x101820, hemi: 0.9, fog: 0x101c34, fogNear: 22, fogFar: 150, cloud: 0.15, cloudColour: 0x2a3a60, stars: 0.9, exposure: 1.45, water: 0x2a3a5a, deep: 0x060a14 },
  dawn: { top: 0x8aaad0, horizon: 0xf2ece0, sun: [0.7, 0.28, -0.2], sunColour: 0xfff0d8, sunPower: 1.8, hemiSky: 0xe8ecf0, hemiGround: 0x5a5a3a, hemi: 1.05, fog: 0xd2d8d0, fogNear: 45, fogFar: 280, cloud: 0.35, cloudColour: 0xffffff, stars: 0, exposure: 0.98, water: 0xa0b8c0, deep: 0x30444a },
};

// Water: a slow ripple and the sky in it; `flow` runs it along +x.
function waterMaterial(water, flow = 0) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uFlow: { value: flow } }]),
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
      uniform float uTime, uFlow;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        vec2 p = vWorld.xz * 0.35 - vec2(uTime * uFlow, 0.0);
        float n = noise(p + uTime * 0.06) * 0.5 + noise(p * 2.3 - uTime * 0.09) * 0.5;
        vec3 nrm = normalize(vec3((n - 0.5) * 0.3, 1.0, (noise(p * 1.6 + 3.0) - 0.5) * 0.3));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.25 + fres * 0.7);
        col += uSunColor * pow(max(dot(reflect(-normalize(uSun), nrm), view), 0.0), 90.0) * 1.6;
        // a little white where it runs fast
        col += vec3(0.8) * smoothstep(0.82, 0.95, noise(p * 4.0 - uTime * uFlow * 0.5)) * min(uFlow, 1.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) m.uniforms[k] = water.uniforms[k];
  return m;
}

// Every mesh of a model, instanced at each place in `list` ({ x, y, z, s,
// turn }): a whole tree in a handful of draw calls.
function instanceModel(model, list) {
  const out = new THREE.Group();
  model.updateMatrixWorld(true);
  const place = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = V();
  const at = V();
  model.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const mesh = new THREE.InstancedMesh(o.geometry, o.material, Math.max(1, list.length));
    const m = new THREE.Matrix4();
    list.forEach((p, i) => {
      e.set(0, p.turn ?? 0, 0);
      q.setFromEuler(e);
      sc.setScalar(p.s ?? 1);
      at.set(p.x, p.y ?? 0, p.z);
      place.compose(at, q, sc);
      m.multiplyMatrices(place, o.matrixWorld);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = list.length;
    mesh.frustumCulled = false;
    out.add(mesh);
  });
  return out;
}

export function createLorienWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 52, near: 0.1, far: 900, bloom: { strength: 0.7, radius: 0.6, threshold: 0.8 }, onLost });
  stage.grade({ contrast: 0.08, saturation: 1.04, vignette: 0.26, grain: 0.012, shadow: [0.02, 0.02, 0.04], high: [0.05, 0.035, 0.0] });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0xd8c890, 30, 210);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0xf2e6c0, 0x6a5a2a, 1);
  const sun = new THREE.DirectionalLight(0xffe2a0, 2);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(800);
  scene.add(sky.dome);
  const water = { uniforms: { uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSun: { value: V(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlints: { value: 1 } } };
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water, stage, house: houseLook, moods: MOODS });

  const kit = createLorienKit(renderer);
  const mats = kit.mats ?? {};
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });
  const zones = { wood: new THREE.Group(), river: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);
  const wood = zones.wood;

  // ── the ground, the stream and the Silverlode ──
  // (sunk a little under the Mirror's hollow, which brings its own ground)
  const under = (x, z) => woodHeight(x, z) - 0.3 * (1 - smooth(MIRROR.foot - 1.5, MIRROR.foot, Math.hypot(x - MIRROR.x, z - MIRROR.z)));
  const terrain = makeTerrain(renderer, { size: 320, seg: tier === 'high' ? 220 : tier === 'mid' ? 160 : 110, height: under, paint, blades: 0.05 });
  wood.add(terrain);
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(9, 200, 1, 1).rotateX(-Math.PI / 2), waterMaterial(water, 0.4));
  stream.position.set(streamX(0) - 1, -1.35, 0);
  const silverlode = new THREE.Mesh(new THREE.PlaneGeometry(140, 260).rotateX(-Math.PI / 2), waterMaterial(water, 0.15));
  silverlode.position.set(BANK + 68, RIVER_Y, 0);
  wood.add(stream, silverlode);
  const waters = [stream.material, silverlode.material];

  // ── the trees ──
  // the great mallorn, its stair and its flets
  const great = kit.mallorn({ h: 72, r: TREE.r, seed: 3 });
  great.group.position.set(TREE.x, woodHeight(TREE.x, TREE.z) - 0.3, TREE.z);
  wood.add(great.group);
  const stair = kit.spiralStair({ r: STAIR.r, rise: STAIR.rise, turns: STAIR.turns, start: STAIR.start });
  stair.group.position.set(TREE.x, woodHeight(TREE.x, TREE.z) - 0.05, TREE.z);
  wood.add(stair.group);
  const stairBase = stair.group.position.clone();
  // the high flet, its opening where the stair arrives
  // the stair winds down-angle as it climbs: its top is at angle `top`
  const top = stair.end ?? STAIR.start - STAIR.turns * TAU;
  const stairAngle = (k) => STAIR.start - k * STAIR.turns * TAU;
  const trunkAt = (y) => great.radiusAt?.(y) ?? TREE.r;
  const highFlet = kit.flet({ r: 7.5, trunkR: trunkAt(STAIR.rise) });
  highFlet.group.position.set(TREE.x, stairBase.y + STAIR.rise, TREE.z);
  // its opening (local +x) where the stair arrives
  highFlet.group.rotation.y = -top;
  wood.add(highFlet.group);
  for (const [y, r, turn] of [[30, 5.6, 2.6]]) {
    const f = kit.flet({ r, trunkR: trunkAt(y) });
    f.group.position.set(TREE.x, stairBase.y + y, TREE.z);
    f.group.rotation.y = turn;
    wood.add(f.group);
  }
  // the city's lesser trees, each with a flet
  highFlet.group.updateMatrixWorld(true);
  const lamps = [...(highFlet.lamps ?? [])].map((v) => v.clone().applyMatrix4(highFlet.group.matrixWorld));
  CITY.forEach((c, i) => {
    const t = kit.mallorn({ h: 52 + i * 3, r: c.r, seed: 11 + i });
    const y = woodHeight(c.x, c.z) - 0.3;
    t.group.position.set(c.x, y, c.z);
    t.group.rotation.y = i * 1.7;
    wood.add(t.group);
    const f = kit.flet({ r: c.r + 2.6, trunkR: c.r });
    f.group.position.set(c.x, y + 8 + (i % 3) * 3, c.z);
    f.group.rotation.y = i * 2.3;
    wood.add(f.group);
    f.group.updateMatrixWorld(true);
    for (const v of f.lamps ?? []) lamps.push(v.clone().applyMatrix4(f.group.matrixWorld));
  });
  // the wood: a few mallorns, each placed many times, in full near the
  // paths and as the far wood's simpler trees further off
  const near = MALLORNS.filter(([x, z]) => nearPath(x, z) < 17);
  const away = MALLORNS.filter(([x, z]) => nearPath(x, z) >= 17);
  const variants = [0, 1].map((k) => kit.mallorn({ h: 48 + k * 7, r: 1.6, seed: 31 + k * 7 }).group);
  variants.forEach((v, k) => {
    const list = near.filter((_, i) => i % 2 === k).map(([x, z, r, seed]) => ({ x, z, y: woodHeight(x, z) - 0.3, s: r / 1.6, turn: (seed % 100) * 0.0628 }));
    if (list.length) wood.add(instanceModel(v, list));
  });
  const awayTrees = away.map(([x, z, r, seed]) => ({ x, z, y: woodHeight(x, z) - 0.4, s: 1 + r * 0.25, turn: seed * 0.37 }));
  // and far off, past where you can walk, and over the river
  if (kit.mallornFar) {
    const far = [];
    const rand = (() => {
      let s = 7;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    far.push(...awayTrees);
    for (let i = 0; i < Math.round(70 * Math.max(0.5, many)); i++) {
      const a = rand() * TAU;
      const d = 120 + rand() * 120;
      const x = -6 + Math.cos(a) * d * 1.1;
      const z = Math.sin(a) * d;
      far.push({ x, z, y: Math.min(0, woodHeight(x, z)) - 0.5, s: 0.9 + rand() * 0.6, turn: rand() * TAU });
    }
    // the ring just past the edges
    for (let i = 0; i < Math.round(45 * Math.max(0.6, many)); i++) {
      const side = i % 3;
      const x = side === 0 ? WOOD.west - 12 - rand() * 20 : WOOD.west + rand() * (BANK - WOOD.west);
      const z = side === 0 ? (rand() - 0.5) * 120 : side === 1 ? WOOD.north - 6 - rand() * 18 : WOOD.south + 6 + rand() * 18;
      far.push({ x, z, y: woodHeight(x, z) - 0.5, s: 0.8 + rand() * 0.5, turn: rand() * TAU });
    }
    wood.add(instances(kit.mallornFar(5), mats.far, far, { shadow: false }));
  }
  // ferns and fallen leaves on the floor
  {
    const rand = (() => {
      let s = 17;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    const ferns = [];
    const leaves = [];
    for (let i = 0; i < 3000 && (ferns.length < 110 * many || leaves.length < 90 * many); i++) {
      const x = WOOD.west + rand() * (BANK - WOOD.west);
      const z = WOOD.north + rand() * (WOOD.south - WOOD.north);
      if (!growable(x, z)) continue;
      const near = COLLIDERS.some((c) => c.kind === 'circle' && !c.low && Math.hypot(x - c.x, z - c.z) < c.r + 0.4);
      if (near) continue;
      if (rand() < 0.5) {
        if (ferns.length < 110 * many) ferns.push({ x, z, y: woodHeight(x, z), s: 0.7 + rand() * 0.7, turn: rand() * TAU });
      } else if (leaves.length < 90 * many) leaves.push({ x, z, y: woodHeight(x, z) + 0.02, s: 0.8 + rand() * 0.8, turn: rand() * TAU });
    }
    if (kit.fern) wood.add(instances(kit.fern(3), mats.fern ?? new THREE.MeshLambertMaterial({ vertexColors: true }), ferns, { shadow: false }));
    if (kit.goldLeaves) wood.add(instances(kit.goldLeaves(4), mats.litter, leaves, { shadow: false }));
  }

  // ── lanterns along the paths, on slender posts ──
  const postMat = mats.elfwood;
  const postGeo = (() => {
    const pole = new THREE.CylinderGeometry(0.035, 0.05, 2.7, 6).translate(0, 1.35, 0);
    const arm = new THREE.TorusGeometry(0.28, 0.025, 5, 10, Math.PI).rotateZ(Math.PI / 2).translate(0.28, 2.7, 0);
    const g = new THREE.BufferGeometry();
    const parts = [pole, arm].map((x) => x.toNonIndexed());
    const n = parts.reduce((a, x) => a + x.attributes.position.count, 0);
    const pos = new Float32Array(n * 3);
    const nrm = new Float32Array(n * 3);
    let o = 0;
    for (const x of parts) {
      pos.set(x.attributes.position.array, o * 3);
      nrm.set(x.attributes.normal.array, o * 3);
      o += x.attributes.position.count;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    return g;
  })();
  const posts = [];
  for (const path of PATHS) {
    let carry = 4;
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1];
      const [bx, bz] = path[i];
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = carry; d < len; d += 11) {
        const k = d / len;
        const side = posts.length % 2 ? 1 : -1;
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const x = ax + (bx - ax) * k + nx * 1.9 * side;
        const z = az + (bz - az) * k + nz * 1.9 * side;
        if (Math.hypot(x - TREE.x, z - TREE.z) < TREE.r + 3) continue;
        posts.push({ x, z, y: woodHeight(x, z), turn: Math.atan2(-nz * -side, nx * -side) });
      }
      carry = 0;
    }
  }
  wood.add(instances(postGeo, postMat, posts, { shadow: false }));
  const lantern = kit.lantern();
  const hung = posts.map((p) => ({ x: p.x + Math.cos(p.turn) * 0.56, z: p.z - Math.sin(p.turn) * 0.56, y: p.y + 2.45, turn: p.turn }));
  wood.add(instanceModel(lantern.group, hung));
  for (const p of hung) lamps.push(V(p.x, p.y, p.z));

  // ── the Mirror, in its hollow ──
  const mirror = kit.mirror();
  mirror.group.position.set(MIRROR.x, woodHeight(MIRROR.x, MIRROR.z) - 0.02, MIRROR.z);
  mirror.group.rotation.y = Math.PI;
  wood.add(mirror.group);

  // ── the landing: a white jetty, the boats, the Lady's table ──
  const white = mats.elfwood;
  const jetty = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 2.6), white);
  deck.position.set(BANK + 5, RIVER_Y + 0.7, LANDING.z);
  jetty.add(deck);
  for (let i = 0; i < 5; i++) {
    for (const sz of [-1.15, 1.15]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2, 8), white);
      post.position.set(BANK - 1 + i * 3, RIVER_Y, LANDING.z + sz);
      jetty.add(post);
    }
  }
  wood.add(jetty);
  const moored = [0, 1, 2].map((i) => {
    const b = kit.boat();
    b.group.position.set(BANK + 2 + i * 3.6, RIVER_Y + 0.05, LANDING.z + (i % 2 ? 2.4 : -2.4));
    b.group.rotation.y = i === 1 ? Math.PI : 0;
    wood.add(b.group);
    return b;
  });
  const table = new THREE.Group();
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 0.08, TABLE.d), white);
  tableTop.position.y = 0.86;
  table.add(tableTop);
  for (const [lx, lz] of [
    [-1, -0.38],
    [1, -0.38],
    [-1, 0.38],
    [1, 0.38],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.86, 6), white);
    leg.position.set(lx, 0.43, lz);
    table.add(leg);
  }
  // the gifts on it
  const giftMat = { bow: new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.5 }), metal: new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.25, metalness: 0.8 }), rope: new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.9 }), casket: new THREE.MeshStandardMaterial({ color: 0xe8d8a0, roughness: 0.3, metalness: 0.6, emissive: 0x3a2a08 }) };
  const gifts = {
    bow: new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.025, 6, 24, Math.PI * 0.8).rotateX(-Math.PI / 2), giftMat.bow),
    daggers: new THREE.Group(),
    rope: new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 16).rotateX(-Math.PI / 2), giftMat.rope),
    hairs: new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), giftMat.casket),
  };
  for (const dz of [-0.06, 0.06]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.05), giftMat.metal);
    d.position.z = dz;
    gifts.daggers.add(d);
  }
  gifts.bow.position.set(-0.6, 0.92, 0);
  gifts.daggers.position.set(0.15, 0.91, -0.15);
  gifts.rope.position.set(0.6, 0.94, 0.15);
  gifts.hairs.position.set(0.85, 0.95, -0.2);
  for (const g of Object.values(gifts)) table.add(g);
  table.position.set(TABLE.x, woodHeight(TABLE.x, TABLE.z), TABLE.z);
  wood.add(table);

  // ── on the side: Legolas's targets ──
  // five painted boards on their stands, face on to the mark by the path
  // (green, a white ring, the gold), and a quiver on a post at the mark
  const boardMat = {
    rim: new THREE.MeshStandardMaterial({ color: 0x4e6036, roughness: 0.8, emissive: 0x0e1408 }),
    white: new THREE.MeshStandardMaterial({ color: 0xece4c8, roughness: 0.7, emissive: 0x1c1a12 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0b040, roughness: 0.4, metalness: 0.3, emissive: 0x3a2806 }),
  };
  const ring = (r, m, x) => {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateY(Math.PI / 2), m);
    d.position.x = x;
    return d;
  };
  for (const b of BOARDS) {
    const g = new THREE.Group();
    const face = new THREE.Group();
    const back = new THREE.Mesh(new THREE.CylinderGeometry(b.r + 0.05, b.r + 0.05, 0.08, 32).rotateZ(Math.PI / 2), mats.elfwood);
    face.add(back, ring(b.r, boardMat.rim, 0.041), ring(b.r * 0.68, boardMat.white, 0.043), ring(b.r * 0.35, boardMat.gold, 0.045));
    face.position.y = b.up;
    g.add(face);
    // two legs splayed, and a strut behind
    for (const sz of [-0.34, 0.34]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, b.up + 0.25, 6), mats.elfwood);
      leg.position.set(-0.08, (b.up + 0.25) / 2 - 0.05, sz);
      leg.rotation.x = sz > 0 ? -0.14 : 0.14;
      g.add(leg);
    }
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, b.up + 0.2, 6), mats.elfwood);
    strut.position.set(-0.42, (b.up + 0.2) / 2 - 0.05, 0);
    strut.rotation.z = -0.36;
    g.add(strut);
    g.position.set(b.x, groundHeight(b.x, b.z), b.z);
    g.rotation.y = b.face;
    wood.add(g);
  }
  // an arrow: its point along +x, at x 0.43
  const arrowMat = { shaft: new THREE.MeshStandardMaterial({ color: 0xd8cca0, roughness: 0.6 }), head: new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.3, metalness: 0.8 }), fletch: new THREE.MeshStandardMaterial({ color: 0xf4f0e0, roughness: 0.8, side: THREE.DoubleSide }) };
  const shaftGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.78, 5).rotateZ(Math.PI / 2);
  const headGeo = new THREE.ConeGeometry(0.022, 0.08, 6).rotateZ(-Math.PI / 2).translate(0.43, 0, 0);
  const fletchGeo = new THREE.PlaneGeometry(0.12, 0.035).translate(-0.31, 0.02, 0);
  const makeArrow = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(shaftGeo, arrowMat.shaft), new THREE.Mesh(headGeo, arrowMat.head));
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const f = new THREE.Mesh(fletchGeo, arrowMat.fletch);
      f.rotation.x = a;
      g.add(f);
    }
    return g;
  };
  const quiver = new THREE.Group();
  {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 7).translate(0, 0.65, 0), mats.elfwood);
    const case_ = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.6, 9), new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.8 }));
    case_.position.set(0.11, 0.62, 0);
    case_.rotation.z = -0.12;
    quiver.add(post, case_);
    for (let i = 0; i < 5; i++) {
      const a = makeArrow();
      a.scale.setScalar(0.85);
      a.rotation.z = Math.PI / 2 - 0.12 + (i - 2) * 0.05;
      a.rotation.y = i * 1.3;
      a.position.set(0.11 + (i - 2) * 0.02, 0.85, (i % 2 ? 0.02 : -0.02));
      quiver.add(a);
    }
    const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0xc8c2a8, roughness: 0.9 }));
    mark.position.set(-1.3, 0.02, 0.2);
    quiver.add(mark);
  }
  quiver.position.set(BUTTS.x + 1.3, groundHeight(BUTTS.x + 1.3, BUTTS.z - 0.2), BUTTS.z - 0.2);
  wood.add(quiver);
  // the arrows in the air and stuck where they ended
  const arrows = Array.from({ length: 8 }, () => {
    const a = makeArrow();
    a.visible = false;
    wood.add(a);
    return a;
  });

  // ── the river: the Anduin between its cliffs, and the Kings ──
  const river = zones.river;
  const along = (s, lat = 0, y = 0, out = V()) => out.set(AT.river.x + s, AT.river.y + y, AT.river.z + riverBend(s) + lat);
  const bankAt = (s) => {
    const open = Math.max(0, 1 - Math.abs(s - KINGS) / 46);
    return riverWide(s) + 7 + open * 34;
  };
  {
    // the water, as a ribbon following the bends
    const N = 120;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const s = -60 + ((RIVER.len + 160) * i) / N;
      const z = riverBend(s);
      const w = bankAt(s) + 6;
      pos.push(s, RIVER_Y, z - w, s, RIVER_Y, z + w);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = waterMaterial(water, 0.9);
    waters.push(m);
    river.add(new THREE.Mesh(g, m));
  }
  if (kit.riverCliff) {
    const stone = mats.cliff;
    const cliffs = [[], []];
    for (let s = -50; s < RIVER.len + 140; s += 26) {
      const z = riverBend(s);
      const dir = Math.atan2(-(riverBend(s + 1) - riverBend(s - 1)), 2);
      const w = bankAt(s);
      cliffs[0].push({ x: s, z: z - w - 2, y: RIVER_Y - 3, s: 1 + ((s * 7) % 5) / 10, turn: dir });
      cliffs[1].push({ x: s, z: z + w + 2, y: RIVER_Y - 3, s: 1 + ((s * 11) % 5) / 10, turn: dir + Math.PI });
    }
    river.add(instances(kit.riverCliff(1), stone, cliffs[0], { shadow: false }));
    river.add(instances(kit.riverCliff(2), stone, cliffs[1], { shadow: false }));
  }
  if (kit.riverRock) {
    const rocks = RIVER.rocks.map((r, i) => ({ x: r.s, z: riverBend(r.s) + r.lat, y: RIVER_Y - 0.4, s: 1 + (i % 3) * 0.15, turn: i * 2.2 }));
    river.add(instances(kit.riverRock(7), mats.riverRock, rocks, { shadow: false }));
  }
  const kings = kit.argonath();
  kings.group.position.set(KINGS, RIVER_Y, riverBend(KINGS));
  kings.group.rotation.y = Math.PI / 2;
  river.add(kings.group);
  // the boats on the river: yours, and the others ahead
  // (these are placed in world coordinates, so they hang off the scene)
  const boats = [0, 1, 2, 3].map(() => {
    const b = kit.boat();
    scene.add(b.group);
    return b;
  });
  // Gollum, on his log behind: the one Gollum (../marshes/props.js),
  // crouched on it, faces +x along it, as the log goes
  const gollum = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 3.2, 8).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a2e22 }));
  const smeagol = createGollum(renderer);
  smeagol.group.position.set(0.2, 0.28, 0);
  gollum.add(log, smeagol.group);
  scene.add(gollum);

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
  // at the targets: you with a bow, and Legolas by the mark
  const archer = blob(makeFolk('frodo', { look: { ...LOOKS.frodo, item: 'bow' } }));
  const legolasMark = blob(folk('legolas'));
  for (const p of [archer, legolasMark]) {
    p.group.visible = false;
    wood.add(p.group);
  }
  const ghosts = createGhosts({ height: woodHeight });
  wood.add(ghosts.group);
  const people = {};
  for (const c of CAST) {
    const p = blob(folk(c.look));
    p.group.visible = false;
    wood.add(p.group);
    people[c.id] = p;
  }
  const haldir = blob(folk('haldir'));
  haldir.group.visible = false;
  wood.add(haldir.group);
  const galadhrim = GALADHRIM.map(() => {
    const p = blob(folk('elf'));
    p.group.visible = false;
    wood.add(p.group);
    return p;
  });
  const company = Object.fromEntries(
    COMPANY.map((id) => {
      const p = blob(folk(id));
      p.group.visible = false;
      wood.add(p.group);
      return [id, p];
    }),
  );
  // the Lord and Lady on the high flet
  const lady = folk('galadriel');
  const lord = folk('celeborn');
  for (const p of [lady, lord]) {
    p.group.visible = false;
    wood.add(p.group);
  }
  // who's in the boats: Sam with you; Aragorn ahead; the rest
  const rowers = [['sam'], ['aragorn'], ['legolas', 'gimli'], ['boromir', 'merry', 'pippin']].map((ids) =>
    ids.map((id) => {
      const p = folk(id);
      sit(p);
      scene.add(p.group);
      return p;
    }),
  );

  // ── light, leaves ──
  const fall = createParticles(Math.round(700 * Math.max(0.4, many)), {
    ramp: [
      [0, 1, 0.86, 0.42, 0],
      [0.1, 1, 0.84, 0.36, 0.95],
      [0.8, 0.86, 0.64, 0.2, 0.9],
      [1, 0.7, 0.48, 0.14, 0],
    ],
    additive: false,
    gravity: -0.3,
    drag: 1.4,
    swirl: 1.2,
  });
  scene.add(fall.mesh);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const ladyLight = new THREE.PointLight(0xe8f4ff, 0, 12, 1.2);
  scene.add(ladyLight);

  // ── state ──
  const A = { t: 0, cam: { at: V(0, 4, 10), look: V(0, 2, -10) }, mode: '', shake: 0, night: 0, dawn: 0, first: true, leaves: 0, tempt: 0, eye: 0, sight: V(), sightD: 20 };
  const tmp = V();
  const tmp2 = V();
  // where the cast's eyes go: down into the Mirror, along the range to the butts
  const MIRROR_EYE = V(MIRROR.x, woodHeight(MIRROR.x, MIRROR.z) + 0.9, MIRROR.z);
  const BUTTS_EYE = V(BUTTS.x, groundHeight(BUTTS.x, BUTTS.z) + 1.2, BUTTS.z);
  const look = V();
  const lampCol = new THREE.Color(0xb8d4ff);
  const turnTo = (p, face, dt, k = 4) => {
    let d = face - p.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.group.rotation.y += d * Math.min(1, dt * k);
  };
  const stairAt = (k, out = V()) => out.copy(stair.at(Math.max(0, Math.min(1, k)))).add(stairBase);
  const fletTop = V(TREE.x, stairBase.y + STAIR.rise, TREE.z);

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const zone = s.zone;
    sky.uniforms.uTime.value = t;
    for (const m of waters) m.uniforms.uTime.value = t;
    for (const [k, g] of Object.entries(zones)) g.visible = k === zone;
    for (const b of boats) b.group.visible = zone === 'river';
    for (const r of rowers) for (const p of r) p.group.visible = zone === 'river';
    gollum.visible = zone === 'river';
    // crouched on his log, looking about (the log moves him: still on it, he doesn't crawl)
    if (gollum.visible) smeagol.animate(t, { pose: 'crouch', look: Math.sin(t * 0.7) * 0.3 });
    const h = s.hobbit;

    // ── the time of day ──
    const wantNight = s.mood === 'night' ? 1 : 0;
    const wantDawn = s.mood === 'dawn' ? 1 : 0;
    const ease = A.first ? 1 : Math.min(1, dt * 0.5);
    A.first = false;
    A.night += (wantNight - A.night) * ease;
    A.dawn += (wantDawn - A.dawn) * ease;
    const sunDir = atmosphere(A.night, A.dawn);
    // the Lady, terrible as the dawn
    A.tempt += ((s.tempt ? 1 : 0) - A.tempt) * Math.min(1, dt * (s.tempt ? 1.2 : 0.6));
    // (the fog's own colour while it's this, not the sky's)
    houseLook.set({ fogMix: 1 - A.tempt * 0.8 });
    if (A.tempt > 0.01) {
      scene.fog.color.lerp(TEMPT_FOG, A.tempt * 0.8);
      hemi.intensity *= 1 - A.tempt * 0.7;
    }
    kit.setNight?.(A.night);
    if (kit.K?.water?.uTime) kit.K.water.uTime.value = t;
    mirror.update?.(t);
    const lights = [];

    // ── Frodo ──
    let fy = groundHeight(h.x, h.z);
    frodo.group.visible = zone === 'wood' || s.mode === 'river' || zone === 'river';
    sit(frodo, false);
    if (zone === 'river') {
      // in the boat
      const b = s.boat;
      const bs = b ? b.s : 0;
      const lat = b ? b.lat : 0;
      const yaw = Math.atan2(-(riverBend(bs + 1) - riverBend(bs - 1)), 2) - (b ? b.steer * 0.25 : 0);
      const mine = boats[0];
      along(bs, lat, RIVER_Y + Math.sin(t * 2.2) * 0.05, mine.group.position);
      mine.group.rotation.set(Math.sin(t * 1.7) * 0.03, yaw, Math.sin(t * 2.1) * 0.04);
      mine.group.updateMatrixWorld(true);
      const seat = mine.seats?.[1] ?? V(-0.8, 0.3, 0);
      frodo.group.position.copy(seat).applyMatrix4(mine.group.matrixWorld);
      frodo.group.rotation.set(0, yaw, 0);
      sit(frodo, true);
      pose(frodo, t, { moving: false });
      // Sam in front, paddling (on the cast: his arms at the stroke, sat in the boat)
      const sam = rowers[0][0];
      sam.group.position.copy(mine.seats?.[0] ?? V(0.9, 0.3, 0)).applyMatrix4(mine.group.matrixWorld);
      sam.group.rotation.set(0, yaw, 0);
      castDo(sam, { upper: 'push' });
      pose(sam, t, { moving: false, wave: sam.cast?.ready ? 0 : 0.4 + Math.sin(t * 3) * 0.3 });
      mine.paddles?.forEach((p, i) => (p.rotation.z = Math.sin(t * 3 + i * Math.PI) * 0.5));
      // the others ahead, strung out down the river
      for (let i = 1; i < boats.length; i++) {
        const os = bs + 10 + i * 9;
        const ol = Math.sin(i * 1.9) * 2;
        const ob = boats[i];
        along(os, ol, RIVER_Y + Math.sin(t * 2 + i) * 0.05, ob.group.position);
        ob.group.rotation.set(0, Math.atan2(-(riverBend(os + 1) - riverBend(os - 1)), 2), Math.sin(t * 2 + i) * 0.04);
        ob.group.updateMatrixWorld(true);
        rowers[i].forEach((p, j) => {
          const seat2 = ob.seats?.[Math.min(1, j)] ?? V(0.9 - j * 1.2, 0.3, 0);
          p.group.position.copy(seat2).add(tmp2.set(-0.6 * Math.max(0, j - 1), 0, 0)).applyMatrix4(ob.group.matrixWorld);
          p.group.rotation.set(0, ob.group.rotation.y, 0);
          castDo(p, { upper: j === 0 ? 'push' : null });
          pose(p, t + j, { moving: false, wave: j === 0 && !p.cast?.ready ? 0.4 + Math.sin(t * 3 + i) * 0.3 : 0 });
        });
      }
      // Gollum, a long way back
      along(bs - 24, -lat * 0.4 + Math.sin(t * 0.3) * 2, RIVER_Y + 0.05, gollum.position);
      gollum.rotation.y = Math.atan2(-(riverBend(bs - 23) - riverBend(bs - 25)), 2);
      fy = RIVER_Y;
    } else if (s.mode === 'climb' || (s.mode === 'talk' && s.talking === 'caras')) {
      const k = s.mode === 'climb' ? s.climb : 1;
      stairAt(k, frodo.group.position);
      const a = stairAngle(k);
      if (s.mode === 'talk') {
        // on the flet, before the Lord and Lady
        const rf = trunkAt(STAIR.rise) + 3;
        frodo.group.position.set(TREE.x + Math.cos(top) * rf, fletTop.y + 0.05, TREE.z + Math.sin(top) * rf);
      } else frodo.group.rotation.y = Math.PI / 2 - a;
      pose(frodo, t, { moving: s.mode === 'climb' && (s.climbing ?? true), speed: 0.9 });
      fy = frodo.group.position.y;
    } else {
      wpos('wood', h.x, fy, h.z, frodo.group.position);
      frodo.group.rotation.set(0, h.face, 0);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
      if (s.mode === 'mirror' || (s.vision && s.mode === 'talk')) {
        // at the basin, looking down into it
        frodo.group.position.set(MIRROR.x - 1.2, woodHeight(MIRROR.x, MIRROR.z), MIRROR.z - 0.5);
        frodo.group.rotation.y = Math.atan2(-0.5, 1.2);
        frodo.body.rotation.z = -0.25 - (s.pull?.pull ?? 0) * 0.35;
      } else frodo.body.rotation.z = 0;
    }
    // (on the cast: his eyes down into the water of the Mirror)
    castDo(frodo, { look: zone === 'wood' && (s.mode === 'mirror' || (s.vision && s.mode === 'talk')) ? MIRROR_EYE : null });
    // at the targets: the bow up and drawn, Legolas watching, the arrows
    const range = zone === 'wood' && s.mode === 'archery' ? s.range : null;
    archer.group.visible = Boolean(range);
    legolasMark.group.visible = Boolean(range);
    const shown = [];
    if (range) {
      frodo.group.visible = false;
      // at the mark, the bow out in front at arm's length
      const d = aimDir(range.aim.yaw, 0);
      const ax = RANGE.from.x - d.x * 0.3;
      const az = RANGE.from.z - d.z * 0.3;
      archer.group.position.set(ax, groundHeight(ax, az), az);
      archer.group.rotation.y = range.aim.yaw;
      pose(archer, t, { moving: false });
      const up = range.state === 'aim' || range.draw > 0;
      if (archer.arms?.[0]) archer.arms[0].rotation.x = up ? -1.5 : 0;
      if (archer.arms?.[1]) archer.arms[1].rotation.x = 1.3 * range.draw;
      // on the cast: the bow held out at the mark, a loose as each arrow goes, eyes on the butts
      castDo(archer, { upper: up ? 'aim.pistol' : null, look: BUTTS_EYE });
      if (range.arrow && range.arrow !== A.loosed) castPlay(archer, 'shoot.pistol', { layer: 'upper' });
      A.loosed = range.arrow ?? null;
      const lx = BUTTS.x + 2;
      const lz = BUTTS.z + 1.1;
      legolasMark.group.position.set(lx, groundHeight(lx, lz), lz);
      turnTo(legolasMark, range.aim.yaw + 0.25, dt, 3);
      // (on the cast: he watches the arrow fly, and you between)
      castDo(legolasMark, { look: range.arrow ? V(range.arrow.x, range.arrow.y, range.arrow.z) : archer });
      pose(legolasMark, t, { moving: false, talk: s.speaker === 'legolas' ? 1 : 0 });
      if (range.arrow) shown.push([range.arrow, 0.43]);
      for (const a of range.stuck) shown.push([a, 0.3]);
    }
    arrows.forEach((m, i) => {
      const q = shown[i];
      m.visible = Boolean(q);
      if (!q) return;
      const [a, back] = q;
      tmp2.set(a.vx, a.vy, a.vz).normalize();
      m.quaternion.setFromUnitVectors(X_AXIS, tmp2);
      m.position.set(a.x, a.y, a.z).addScaledVector(tmp2, -back);
    });
    ghosts.update(zone === 'wood' ? (s.travellers ?? []) : [], t, dt, { ringOn: false });

    // ── who's about ──
    for (const c of CAST) {
      const p = people[c.id];
      const on = zone === 'wood' && s.cast?.includes(c.id);
      p.group.visible = Boolean(on);
      if (!on) continue;
      p.group.position.set(c.x, groundHeight(c.x, c.z), c.z);
      // they turn to Frodo as he comes by: on the cast the head first, a greeting the first time
      attend(p, h, c.face, dt, { who: frodo });
      pose(p, t + c.x, { moving: false, talk: s.talk === c.id ? 1 : 0 });
      if (c.look === 'galadriel') lights.push([tmp.set(c.x, groundHeight(c.x, c.z) + 2.2, c.z).clone(), lampCol, 2.4, 9]);
    }
    // Haldir, and the Galadhrim with their bows drawn
    const lead = s.lead;
    haldir.group.visible = zone === 'wood' && (Boolean(lead) || (s.ambush && s.talking === 'haldir'));
    if (haldir.group.visible) {
      const hx = lead ? lead.x : AMBUSH.x + 4;
      const hz = lead ? lead.z : AMBUSH.z;
      haldir.group.position.set(hx, groundHeight(hx, hz), hz);
      // on the cast: waiting, he looks back at you and waves you on; walking, ahead
      const waiting = Boolean(lead?.waiting);
      if (waiting && haldir.cast?.ready) attend(haldir, h, lead.face, dt, { who: frodo, near: 30, greet: false });
      else turnTo(haldir, lead ? lead.face : Math.PI, dt, 6);
      if (waiting && !A.haldirWaited) castPlay(haldir, 'beckon', { layer: 'upper' });
      A.haldirWaited = waiting;
      castDo(haldir, { look: waiting || !lead ? frodo : null });
      pose(haldir, t, { moving: Boolean(lead?.moving), speed: 1, talk: s.speaker === 'haldir' ? 1 : 0 });
    }
    galadhrim.forEach((p, i) => {
      const [x, z] = GALADHRIM[i];
      p.group.visible = zone === 'wood' && Boolean(s.ambush) && !lead;
      if (!p.group.visible) return;
      p.group.position.set(x, groundHeight(x, z), z);
      p.group.rotation.y = Math.atan2(-(AMBUSH.z - z), AMBUSH.x - x);
      pose(p, t + i, { moving: false });
      // bow up, drawn (on the cast: held on you, eyes along it)
      if (p.arms?.[0]) p.arms[0].rotation.x = -1.5;
      if (p.arms?.[1]) p.arms[1].rotation.x = 1.3;
      castDo(p, { upper: 'aim.pistol', look: frodo });
    });
    // the Fellowship behind you
    COMPANY.forEach((id, i) => {
      const p = company[id];
      const at = s.company?.[id];
      p.group.visible = zone === 'wood' && Boolean(at);
      if (!at) {
        p.drawn = null;
        return;
      }
      // off the conga line: each to its place at its own pace, apart from the rest
      const d = followDrawn(p, at, dt, { others: [...COMPANY.map((o) => company[o]).filter((o) => o !== p && o.group.visible), { x: h.x, z: h.z }] });
      p.group.position.set(d.x, groundHeight(d.x, d.z), d.z);
      p.group.rotation.y = d.face;
      pose(p, t + i, { moving: Boolean(at.moving) });
    });
    // the Lord and the Lady, on the flet
    const onFlet = zone === 'wood' && s.flet;
    for (const [p, off] of [
      [lady, 0.5],
      [lord, -0.5],
    ]) {
      p.group.visible = onFlet;
      if (!onFlet) continue;
      // a little round the flet from where you stand
      const a = top - 1.05 - off * 0.45;
      const rf = trunkAt(STAIR.rise) + 3;
      p.group.position.set(TREE.x + Math.cos(a) * rf, fletTop.y + 0.05, TREE.z + Math.sin(a) * rf);
      const toFrodo = Math.atan2(-(frodo.group.position.z - p.group.position.z), frodo.group.position.x - p.group.position.x);
      // (on the cast: they turn to you over a moment, their eyes first; a toy faces you at once)
      if (p.cast?.ready) attend(p, frodo.group.position, toFrodo, dt, { who: frodo, near: 30, greet: false });
      else p.group.rotation.y = toFrodo;
      pose(p, t + off, { moving: false, talk: s.speaker === (p === lady ? 'galadriel' : 'celeborn') ? 1 : 0 });
    }
    if (onFlet) lights.push([lady.group.position.clone().add(V(0, 2, 0)), lampCol, 3 + A.night * 2, 12]);
    // Galadriel, tempted: light round her, cold and terrible
    const ladyAtMirror = people['galadriel-mirror'];
    ladyLight.intensity = 0;
    if (zone === 'wood' && ladyAtMirror?.group.visible) {
      ladyAtMirror.group.scale.setScalar(1 + A.tempt * 0.35);
      // (on the cast: her arms up and out as the Ring tempts her)
      castDo(ladyAtMirror, { full: A.tempt > 0.4 ? 'cast.idle' : null });
      ladyLight.position.copy(ladyAtMirror.group.position).add(V(0, 2, 0));
      ladyLight.color.setRGB(0.75 + A.tempt * 0.1, 1, 0.85 + A.tempt * 0.15);
      ladyLight.intensity = 1.5 + A.tempt * 22;
      ladyLight.distance = 10 + A.tempt * 20;
    }

    // ── the gifts ──
    const left = s.giftsLeft ?? [];
    for (const [id, m] of Object.entries(gifts)) m.visible = left.includes(id);
    table.visible = zone === 'wood' && (left.length > 0 || s.carrying != null);

    // ── the Mirror's visions ──
    if (mirror.vision) {
      let kind = 'still';
      let k = 0;
      if (s.vision) {
        const pk = s.pull?.k ?? 1;
        if (s.pull) {
          kind = s.pull.eye || s.pull.soon || pk > 0.45 ? 'eye' : 'shire';
          A.eye += ((s.pull.eye ? 1 : s.pull.soon ? 0.6 : kind === 'eye' ? 0.4 : 0.8) - A.eye) * Math.min(1, dt * 4);
          k = A.eye;
        } else {
          kind = s.talking === 'test' ? 'still' : 'shire';
          k = 0.8;
        }
      }
      mirror.vision(k, kind);
      if (s.pull?.eye) lights.push([V(MIRROR.x, woodHeight(MIRROR.x, MIRROR.z) + 1.3, MIRROR.z), new THREE.Color(0xff6a20), 4 + Math.sin(t * 9) * 1.2, 8]);
    }

    // ── lanterns: the nearest few light the ground at night ──
    if (zone === 'wood' && A.night > 0.05) {
      const cam = camera.position;
      lamps
        .map((v) => [v, v.distanceToSquared(cam)])
        .sort((a, b) => a[1] - b[1])
        .slice(0, POOL - 1)
        .forEach(([v]) => lights.push([v, lampCol, 2.2 * A.night, 13]));
    }
    // leaves coming down round you, catching the light
    if (zone === 'wood') {
      A.leaves += dt * (A.night > 0.5 ? 6 : 22) * Math.max(0.4, many);
      while (A.leaves > 1) {
        A.leaves -= 1;
        const at = frodo.group.position;
        fall.emit(at.x + R(18), at.y + 7 + Math.random() * 8, at.z + R(18), R(0.4), -0.6 - Math.random() * 0.4, R(0.4), 7, 0.09, 0.05, 1);
      }
    }
    fall.step(dt);
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
    moored.forEach((b, i) => (b.group.position.y = RIVER_Y + 0.05 + Math.sin(t * 1.4 + i) * 0.04));

    // ── the camera ──
    let camAt;
    let camLook;
    if (zone === 'river') {
      const b = s.boat;
      const bs = b ? b.s : 0;
      if (s.mode === 'talk' || s.mode === 'end') {
        // low on the water, looking up at the Kings
        camAt = along(bs - 9, (b?.lat ?? 0) + 3, RIVER_Y + 1.6, tmp);
        camLook = along(KINGS, 0, 40 + Math.min(1, s.stepT * 0.1) * 12, look);
      } else {
        camAt = along(bs - 8.5, (b?.lat ?? 0) * 0.7, RIVER_Y + 3.6, tmp);
        camLook = along(bs + 9, (b?.lat ?? 0) * 0.5, RIVER_Y + 0.6, look);
      }
    } else if (s.mode === 'climb') {
      const a = stairAngle(s.climb) + 0.6;
      const fp = frodo.group.position;
      camAt = tmp.set(TREE.x + Math.cos(a) * (STAIR.r + 7.5), fp.y + 2.4, TREE.z + Math.sin(a) * (STAIR.r + 7.5));
      camLook = look.set(fp.x, fp.y + 1, fp.z);
    } else if (s.mode === 'talk' && s.camShot?.flet) {
      const a = top - 0.45;
      const rc = trunkAt(STAIR.rise) + 6.2;
      camAt = tmp.set(TREE.x + Math.cos(a) * rc, fletTop.y + 1.8, TREE.z + Math.sin(a) * rc);
      camLook = look.copy(lady.group.position).lerp(frodo.group.position, 0.4).add(V(0, 1.3, 0));
    } else if (s.mode === 'talk' && s.camShot) {
      const [ax, ay, az] = s.camShot.at;
      const [lx, ly, lz] = s.camShot.look;
      camAt = tmp.set(ax, groundHeight(ax, az) + ay, az);
      camLook = look.set(lx, groundHeight(lx, lz) + ly, lz);
    } else if (s.mode === 'mirror') {
      const floor = woodHeight(MIRROR.x, MIRROR.z);
      // beside you, over the basin
      camAt = tmp.set(MIRROR.x - 0.6, floor + 2.7, MIRROR.z - 2.0);
      camLook = look.set(MIRROR.x + 0.1, floor + 0.95, MIRROR.z + 0.1);
    } else if (s.mode === 'archery' && s.range) {
      // over your right shoulder, looking down the arrow's line; the sight
      // (screenOf('sight')) is on that line as far off as the board it's on
      const d = aimDir(s.range.aim.yaw, s.range.aim.pitch);
      const f = RANGE.from;
      camAt = tmp.set(f.x - d.x * 1.7 - d.z * 0.5, f.y + 0.45 - d.y * 1.7, f.z - d.z * 1.7 + d.x * 0.5);
      camLook = look.set(f.x + d.x * 30, f.y + d.y * 30, f.z + d.z * 30);
      let best = Infinity;
      A.sightD = 20;
      for (const b of RANGE.targets) {
        const dx = b.x - f.x;
        const dy = b.y - f.y;
        const dz = b.z - f.z;
        const dist = Math.hypot(dx, dy, dz);
        const off = 1 - (dx * d.x + dy * d.y + dz * d.z) / dist;
        if (off < best) {
          best = off;
          A.sightD = dist;
        }
      }
      A.sight.set(f.x + d.x * A.sightD, f.y + d.y * A.sightD, f.z + d.z * A.sightD);
    } else if (s.mode === 'table') {
      camAt = tmp.set(TABLE.x - 2.6, woodHeight(TABLE.x, TABLE.z) + 2.4, TABLE.z + 1.2);
      camLook = look.set(TABLE.x, woodHeight(TABLE.x, TABLE.z) + 0.8, TABLE.z);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.34;
      const dist = s.camDist ?? 6.4;
      wpos('wood', h.x, fy + 1.1, h.z, look);
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const k = clearance(look, camAt);
      if (k < 1) camAt.lerpVectors(look, camAt, Math.max(0.25, k));
      const floor = groundHeight(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const key = `${zone}|${s.mode}|${s.camShot?.id ?? ''}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'river' || s.mode === 'climb';
    const k = jump || s.mode === 'archery' ? 1 : Math.min(1, dt * (follow ? 7 : 2.4));
    A.cam.at.lerp(camAt, k);
    A.cam.look.lerp(camLook, k);
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
    if (type === 'hit') A.shake = Math.max(A.shake, 0.22);
    else if (type === 'eye') A.shake = Math.max(A.shake, 0.06);
    else if (type === 'touched') A.shake = 0.3;
    else if (type === 'tempt') A.shake = 0.12;
    else if (type === 'board') {
      const b = BOARDS[id];
      if (b) fx.pop(tmp2.set(b.x, groundHeight(b.x, b.z) + b.up, b.z), 'gold', 16, 1.2);
    } else if (type === 'gift') {
      const p = people[id];
      if (p) fx.pop(tmp2.copy(p.group.position).add(V(0, 1.6, 0)), 'gold', 14, 1);
    }
  };
  const screenOf = (kind, id) => {
    if (kind === 'sight') {
      const p = tmp.copy(A.sight).project(camera);
      if (p.z > 1) return null;
      const { w, h: hh } = stage.size;
      return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
    }
    const p0 = people[id];
    if (kind !== 'cast' || !p0 || !p0.group.visible) return null;
    const p = p0.group.getWorldPosition(tmp).add(tmp2.set(0, 2.3, 0)).project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };

  // ── the floor's light, baked when the town is first drawn ──
  const ground = groundTown({ place: 'lorien', renderer, scene, terrain, outdoors: wood, sun, height: under, people: movers, skip: [sky.dome, ghosts.group], tier, centre: [-6, 0], radius: 72, shade: 0x26301e, sunFloor: 0.4 });
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

// What the camera can't go through in the wood: the trunks.
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
