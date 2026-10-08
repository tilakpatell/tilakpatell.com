// Rivendell, in WebGL: the valley at golden autumn light, falls coming off
// the cliffs all round, the house of Elrond on its terraces, the hall of
// Narsil, Bilbo's pavilion, the Council court on its spur over the gorge,
// the river and its one bridge, leaves coming down; then dusk, and a clear
// morning for setting out. Made in code (./props.js, ../ground.js), so
// nothing is downloaded.
//
// It draws what the component hands it every frame and decides nothing;
// ./layout.js, ./story.js and ./rules.js have the rules.
//
// createRivendellWorld(canvas) returns { render(state, ms, fast), fx(type),
// screenOf(kind, id), headOf(id), resize, dispose, lost, info }.

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
import { bake, farTree } from '../bake';
import { createGhosts } from '../ghosts';
import { makeTerrain, makeTufts } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { makeFolk } from '../bree/props';
import { createRivendellKit } from './props';
import { BRIDGE, CAST, COLLIDERS, COLONNADE, COMPANIONS, COURT, FALLS, GATE, GORGE, HOUSE, INSIDE, LAMPS, PAVILION, SEATS, SPOTS, TREES, WORLD, boxDist, height, padY, pathAmount, riverX } from './layout';
import { attend, castDo, castPlay, followDrawn, releaseCast, tickCast } from '../../cast3d';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// Who's who: the hobbits as in the Shire, the Fellowship as on the map.
export const LOOKS_HERE = {
  frodo: LOOKS.frodo,
  sam: { ...LOOKS.sam, pack: true },
  merry: LOOKS.merry,
  pippin: LOOKS.pippin,
  bilbo: { hair: 0xd8d2c8, coat: 0xb5432e, shirt: 0xf4ecd8, seed: 3 },
  gandalf: LOOKS.gandalf,
  aragorn: { tall: 1.5, coat: 0x3e3a34, shirt: 0x5a5246, cloak: 0x2e3328, hairStyle: 'long', hair: 0x2a1e16, beard: { color: 0x2a1e16, len: 0.12 }, item: 'sword', feet: 'boots', seed: 7 },
  elrond: { tall: 1.55, robe: 0x5a2a4a, hat: 'crown', hairStyle: 'long', hair: 0x1e1a18, feet: 'boots', seed: 9 },
  gimli: { tall: 0.95, wide: 1.35, coat: 0x6a3a22, shirt: 0x8a8f98, hat: 'helm', hairStyle: 'none', hair: 0x9a3a1a, beard: { color: 0xa8441c, len: 0.5 }, item: 'axe', feet: 'boots', seed: 11 },
  legolas: { tall: 1.5, coat: 0x5a6a3a, shirt: 0x7a7a5a, hairStyle: 'long', hair: 0xf2e4b0, item: 'bow', feet: 'boots', seed: 15 },
  boromir: { tall: 1.55, coat: 0x6a2a22, shirt: 0x5a4a3a, cloak: 0x3a2a24, hairStyle: 'long', hair: 0x5a3a22, beard: { color: 0x5a3a22, len: 0.1 }, item: 'horn', feet: 'boots', seed: 19 },
  arwen: { tall: 1.5, robe: 0x4a5a7a, hairStyle: 'long', hair: 0x1e1610, feet: 'boots', seed: 31 },
  elf: { tall: 1.52, robe: 0x8a7a4a, hairStyle: 'long', hair: 0xc8a868, feet: 'boots', seed: 33 },
  dwarf: { tall: 0.92, wide: 1.4, coat: 0x4a4a5a, shirt: 0x6a5a3a, hairStyle: 'none', hair: 0x3a2a1a, beard: { color: 0x5a4a3a, len: 0.45 }, feet: 'boots', seed: 35 },
  man: { tall: 1.5, coat: 0x4a4a3a, shirt: 0x8a7a5a, hairStyle: 'long', hair: 0x3a2a1a, beard: { color: 0x3a2a1a, len: 0.12 }, feet: 'boots', seed: 37 },
};
const folk = (look) => makeFolk(look, { look: LOOKS_HERE[look] });

// Rivendell's moods, in the sky's slots: `day` the golden autumn
// afternoon, `night` the dusk Bilbo gives his gifts in, `dawn` the clear
// cold morning the Fellowship sets out.
const MOODS = {
  day: { top: 0x4a7ac0, horizon: 0xf2d6a0, sun: [-0.7, 0.36, 0.25], sunColour: 0xffd49a, sunPower: 2.4, hemiSky: 0xd8e0f0, hemiGround: 0x6a5a3a, hemi: 1.0, fog: 0xe0cca4, fogNear: 50, fogFar: 260, cloud: 0.45, cloudColour: 0xfff0dc, stars: 0, exposure: 1.02, water: 0x8ab0c8, deep: 0x2a4a5a },
  night: { top: 0x1a2448, horizon: 0xd88a6a, sun: [-0.8, 0.05, 0.3], sunColour: 0xff9a6a, sunPower: 1.1, hemiSky: 0x7a7ab0, hemiGround: 0x3a2e2a, hemi: 1.0, fog: 0x6a5a78, fogNear: 40, fogFar: 220, cloud: 0.5, cloudColour: 0xe08a7a, stars: 0.45, exposure: 1.3, water: 0x4a5a7a, deep: 0x141a2a },
  dawn: { top: 0x6a9ad8, horizon: 0xe8eef4, sun: [0.7, 0.3, -0.3], sunColour: 0xfff2dc, sunPower: 2.0, hemiSky: 0xe0e8f4, hemiGround: 0x5a5a4a, hemi: 1.05, fog: 0xdce4ec, fogNear: 50, fogFar: 280, cloud: 0.35, cloudColour: 0xffffff, stars: 0, exposure: 1.0, water: 0xa8c4d8, deep: 0x3a5a6a },
};

// the ground's colours
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x6a7a3a);
const GRASS_GOLD = C(0x9a8a42);
const GRASS_RUST = C(0x8a5a2a);
const ROCK = C(0x8a8478);
const PAVING = C(0xc8b896);
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const noise = makeNoise(61);
const steep = (x, z) => Math.hypot(height(x + 0.6, z) - height(x - 0.6, z), height(x, z + 0.6) - height(x, z - 0.6)) / 1.2;
const BUILT = [
  { ...HOUSE, w: HOUSE.w + 2, d: HOUSE.d + 2 },
  { ...COLONNADE, w: COLONNADE.w + 2, d: COLONNADE.d + 2 },
];
function paint(x, z, h, out) {
  const patch = fbm(noise, x * 0.06 + 3, z * 0.06, { octaves: 3 });
  lerp3(out, GRASS, GRASS_GOLD, smooth(0.35, 0.72, patch));
  lerp3(out, out, GRASS_RUST, smooth(0.62, 0.8, fbm(noise, x * 0.12 - 5, z * 0.12 + 2, { octaves: 2 })) * 0.6);
  lerp3(out, out, ROCK, smooth(0.6, 1.2, steep(x, z)));
  // paved paths and courts, and round the buildings
  const p = pathAmount(x, z);
  if (p > 0) lerp3(out, out, PAVING, p * 0.85);
  let near = Infinity;
  for (const b of BUILT) near = Math.min(near, boxDist(b, x, z));
  near = Math.min(near, Math.hypot(x - COURT.x, z - COURT.z) - COURT.r, Math.hypot(x - PAVILION.x, z - PAVILION.z) - PAVILION.r - 1);
  if (near < 1.5) lerp3(out, out, PAVING, (1 - smooth(-0.5, 1.5, near)) * 0.75);
  return out;
}
const growable = (x, z) => pathAmount(x, z) < 0.05 && steep(x, z) < 0.6 && Math.abs(x - riverX(z)) > GORGE.rim + 1 && Math.hypot(x - COURT.x, z - COURT.z) > COURT.r + 0.5;

export function createRivendellWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 50, near: 0.1, far: 620, bloom: { strength: 0.55, radius: 0.55, threshold: 0.86 }, onLost });
  stage.grade({ contrast: 0.08, saturation: 1.02, vignette: 0.24, grain: 0.012, shadow: [0.02, 0.01, 0.02], high: [0.04, 0.025, 0.0] });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0xe0cca4, 50, 260);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.3;

  const hemi = new THREE.HemisphereLight(0xd8e0f0, 0x6a5a3a, 1);
  const sun = new THREE.DirectionalLight(0xffd49a, 2.4);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 5;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffc070, 0, 12, 1.6);
    scene.add(l);
    return l;
  });

  const valley = new THREE.Group();
  const statics = new THREE.Group();
  scene.add(valley);
  valley.add(statics);
  const sky = makeSky(560);
  scene.add(sky.dome);
  const water = { uniforms: { uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSun: { value: V(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlints: { value: 1 } } };
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water, stage, house: houseLook, moods: MOODS });

  // ── the valley floor ──
  // (the ground kept just under the court's paving and the bridge's
  // abutments, so it never shows through them)
  const under = (x, z) => {
    const court = 1 - smooth(COURT.r - 0.6, COURT.r + 0.4, Math.hypot(x - COURT.x, z - COURT.z));
    const ends = Math.abs(z - BRIDGE.z) < 2.2 && Math.abs(Math.abs(x - BRIDGE.x) - BRIDGE.len / 2 - 0.7) < 1.6 ? 1 : 0;
    return height(x, z) - 0.2 * Math.max(court, ends);
  };
  const terrain = makeTerrain(renderer, { size: WORLD.edge * 2, seg: tier === 'high' ? 240 : tier === 'mid' ? 170 : 110, height: under, paint, blades: 0.2 });
  valley.add(terrain);
  const wind = { uWind: { value: 0 } };
  valley.add(makeTufts(Math.round(9000 * many), { radius: WORLD.radius + 4, height, growable, seed: 71, base: 0x4a5a26, tip: 0xb8a052, hue: [0.12, 0.06] }, wind));

  const kit = createRivendellKit(renderer);
  const mats = kit.mats;
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });
  const place = (part, b, y = null) => {
    part.group.position.set(b.x, y ?? height(b.x, b.z), b.z);
    part.group.rotation.y = b.turn || 0;
    statics.add(part.group);
    part.group.updateMatrixWorld(true);
    return part;
  };
  const toWorld = (part, v) => v.clone().applyMatrix4(part.group.matrixWorld);

  // ── the buildings ──
  const house = place(kit.house(), HOUSE, padY('house'));
  const colonnade = place(kit.colonnade(), COLONNADE, padY('colonnade'));
  const pavilion = place(kit.pavilion(), PAVILION, padY('pavilion'));
  // on the side: Bilbo's riddle candle, on the desk in front of him, burning
  // down as each riddle waits for its answer
  const riddleCandle = (() => {
    const g = new THREE.Group();
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 1, 10).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xf2e8cc, roughness: 0.6 }));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8).translate(0, 0.03, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.9, 0.7) }));
    g.add(wax, flame);
    pavilion.group.updateMatrixWorld(true);
    g.position.copy(pavilion.desk).add(V(0.06, 0, -0.32)).applyMatrix4(pavilion.group.matrixWorld);
    g.visible = false;
    scene.add(g);
    return { g, wax, flame };
  })();
  const court = place(kit.court(), COURT, padY('court'));
  // the Ring on its plinth, where the Council's eyes go
  const COURT_RING = V(COURT.x, padY('court') + 0.9, COURT.z);
  place(kit.gate(), GATE);
  place(kit.bridge(BRIDGE.len), { x: BRIDGE.x, z: BRIDGE.z, turn: 0 }, BRIDGE.y0);
  const lampAt = LAMPS.map(([x, z, turn]) => {
    const part = place(kit.lamp(), { x, z, turn });
    return toWorld(part, part.light);
  });
  // the shards of Narsil on their statue's tray, and the Ring on its plinth
  const shards = kit.shards();
  shards.group.position.copy(toWorld(colonnade, colonnade.shardsAt));
  shards.group.rotation.y = COLONNADE.turn;
  valley.add(shards.group);
  // where each piece lies when the sword's laid out whole: the puzzle's places
  const slotX = shards.pieces.map((p) => p.position.x);
  const ring = kit.ring();
  ring.group.position.copy(toWorld(court, court.plinthTop));
  valley.add(ring.group);
  const balcony = toWorld(house, house.balcony);

  // ── the cliffs all round, and the falls ──
  const cliffs = [];
  let seed = 9;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + rand() * 0.05;
    // the valley opens to the south, where the road goes out
    if (Math.abs(a - Math.PI / 2) < 0.32) continue;
    const r = 66 + rand() * 10;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    cliffs.push({ x, z, y: height(x, z) - 4, s: 1.3 + rand() * 0.9, sy: 1.6 + rand() * 1.2, turn: -a - Math.PI / 2 + (rand() - 0.5) * 0.4 });
  }
  valley.add(instances(kit.cliff(3), mats.cliff, cliffs.map((c) => ({ ...c, sx: c.s, sz: c.s })), { shadow: false }));
  const falls = FALLS.map(([x, z, h, w, turn]) => {
    const f = kit.waterfall({ h, w });
    f.group.position.set(x, height(x, z) - 2, z);
    f.group.rotation.y = turn;
    valley.add(f.group);
    return f;
  });

  // ── the river in its gorge ──
  const riverMat = new THREE.ShaderMaterial({
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
        // flowing south, quick and white over the stones
        vec2 p = vec2(vWorld.x * 0.45, vWorld.z * 0.14 - uTime * 1.6);
        float n = noise(p * 2.0) * 0.6 + noise(p * 5.0 + 3.0) * 0.4;
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 nrm = normalize(vec3((n - 0.5) * 0.4, 1.0, (noise(p * 3.0 + 7.0) - 0.5) * 0.4));
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.3 + fres * 0.6);
        col += uSunColor * pow(max(dot(nrm, normalize(normalize(uSun) + view)), 0.0), 90.0) * 1.6;
        col = mix(col, vec3(0.92, 0.95, 1.0), smoothstep(0.66, 0.92, noise(p * 3.4 + uTime * 0.5)) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) riverMat.uniforms[k] = water.uniforms[k];
  {
    const pos = [];
    const idx = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const z = -90 + (i / N) * 180;
      const x = riverX(z);
      pos.push(x - GORGE.rim, GORGE.water, z, x + GORGE.rim, GORGE.water, z);
      if (i < N) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    valley.add(new THREE.Mesh(g, riverMat));
  }

  // ── trees, and the leaves on the ground ──
  const beeches = [];
  const birches = [];
  for (const [x, z, s, kind] of TREES) (kind ? birches : beeches).push({ x, z, y: height(x, z) - 0.1, s, turn: x * 1.7 });
  valley.add(instances(kit.beech(), new THREE.MeshLambertMaterial({ vertexColors: true }), beeches, { shadow: false }));
  valley.add(instances(kit.goldBirch(), new THREE.MeshLambertMaterial({ vertexColors: true }), birches, { shadow: false }));
  // and woods up the slopes past the rim: simpler trees, in the same golds
  const woods = [[], []];
  for (let tries = 0, n = 0; n < Math.round(280 * Math.max(0.5, many)) && tries < 4000; tries++) {
    const a = rand() * TAU;
    const r = WORLD.radius + 2 + rand() * 16;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x - riverX(z)) < GORGE.rim + 3) continue;
    woods[n % 2].push({ x, z, y: height(x, z) - 0.2, s: 1.1 + rand() * 0.7, turn: rand() * TAU });
    n += 1;
  }
  const woodMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // (the far woods in matcaps made from the valley's own light: seen only in
  // passing, one texture fetch and no lights for each: ../grounded.js)
  const farWoods = [
    instances(farTree({ leaf: [0xd8902a, 0xe8b040, 0xb8541e], trunk: 0x6a5a4a }), woodMat, woods[0], { shadow: false }),
    instances(farTree({ leaf: [0xe8c050, 0xd8a838, 0xc89030], trunk: 0xd8d0c0 }), woodMat, woods[1], { shadow: false }),
  ];
  valley.add(...farWoods);
  const leaves = [];
  for (const [x, z] of TREES)
    for (let k = 0; k < 4; k++) {
      const lx = x + (rand() - 0.5) * 7;
      const lz = z + (rand() - 0.5) * 7;
      if (pathAmount(lx, lz) > 0.5) continue;
      leaves.push({ x: lx, z: lz, y: height(lx, lz) + 0.02, s: 0.8 + rand() * 0.6, turn: rand() * TAU });
    }
  if (kit.fallenLeaves) valley.add(instances(kit.fallenLeaves(5), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), leaves, { shadow: false }));

  valley.add(bake(statics, []));

  // ── the bedroom, set apart under the valley ──
  const room = kit.bedroom();
  room.group.position.set(INSIDE.x, INSIDE.y, INSIDE.z);
  scene.add(room.group);
  const roomAt = (v) => v.clone().add(V(INSIDE.x, INSIDE.y, INSIDE.z));

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
  valley.add(ghosts.group);
  const people = {};
  for (const c of CAST) {
    const p = blob(folk(c.look));
    p.group.position.set(c.x, height(c.x, c.z), c.z);
    p.group.rotation.y = c.face;
    valley.add(p.group);
    people[c.id] = p;
  }
  // Bilbo, at his desk in the pavilion, writing
  const bilboSeat = toWorld(pavilion, pavilion.seat);
  people.bilbo.group.position.set(bilboSeat.x, bilboSeat.y - people.bilbo.baseY, bilboSeat.z);
  people.bilbo.group.rotation.y = PAVILION.turn;
  people.bilbo.seated = true;
  const companions = {};
  for (const c of COMPANIONS) {
    const p = blob(folk(c.look));
    p.group.visible = false;
    scene.add(p.group);
    companions[c.id] = p;
  }
  // the Council: who sits where, round the court
  const COUNCIL_SEATS = ['elrond', 'gandalf', 'aragorn', 'boromir', 'man', 'gimli', 'dwarf', 'legolas', 'elf', 'frodo'];
  const council = COUNCIL_SEATS.map((look, i) => {
    if (look === 'frodo') return null;
    const p = blob(folk(look));
    const s = SEATS[i];
    p.group.position.set(s.x, padY('court'), s.z);
    p.group.rotation.y = s.face;
    p.group.visible = false;
    valley.add(p.group);
    return p;
  });
  const frodoSeat = SEATS[COUNCIL_SEATS.indexOf('frodo')];
  // in the bedroom: Gandalf in his chair, and Sam at the door
  const roomGandalf = folk('gandalf');
  roomGandalf.group.position.copy(roomAt(room.chair));
  roomGandalf.group.position.y -= roomGandalf.baseY;
  roomGandalf.group.rotation.y = room.chairFace ?? Math.PI;
  sit(roomGandalf);
  scene.add(roomGandalf.group);
  const roomSam = folk('sam');
  roomSam.group.position.copy(roomAt(room.door));
  scene.add(roomSam.group);

  // ── light and movement ──
  const leafFall = createParticles(Math.round(400 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.85, 0.55, 0.15, 0],
      [0.1, 0.9, 0.5, 0.12, 0.95],
      [0.8, 0.7, 0.3, 0.08, 0.9],
      [1, 0.5, 0.2, 0.05, 0],
    ],
    additive: false,
    gravity: -0.35,
    drag: 0.8,
    swirl: 1.6,
  });
  scene.add(leafFall.mesh);
  const fx = createFx(scene, { scale: many });

  // ── markers: where there's something to do ──
  const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 0.7) });
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.4), transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const markers = Array.from({ length: 8 }, () => {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), markerMat);
    gem.scale.y = 1.5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 9, 12, 1, true), beamMat);
    beam.position.y = -1.2;
    g.add(gem, beam);
    g.visible = false;
    valley.add(g);
    return g;
  });
  const hereRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.05, 0.4), transparent: true, opacity: 0.55, depthWrite: false }));
  hereRing.visible = false;
  valley.add(hereRing);

  // ── state ──
  const A = { t: 0, night: 0, dawn: 0, wraith: 0, shake: 0, cam: { at: V(0, 20, 50), look: V(0, 4, 0) }, mode: 'walk', leaf: 0, axe: -9, axeTimer: 0, eye: 0 };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const warm = new THREE.Color(0xffc070);
  const WRAITH_FOG = new THREE.Color(0.32, 0.34, 0.4);
  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const inside = s.mode === 'inside';
    wind.uWind.value = t;
    sky.uniforms.uTime.value = t;
    riverMat.uniforms.uTime.value = t;
    for (const f of falls) f.update(t);

    // the light, eased (but as it is, the first frame)
    const nightTo = s.sky === 'dusk' ? 1 : 0;
    const dawnTo = s.sky === 'dawn' ? 1 : 0;
    if (A.first !== false) {
      A.first = false;
      A.night = nightTo;
      A.dawn = dawnTo;
    }
    A.night += (nightTo - A.night) * Math.min(1, dt * 0.5);
    A.dawn += (dawnTo - A.dawn) * Math.min(1, dt * 0.5);
    A.wraith += ((s.wearing ? 1 : 0) - A.wraith) * Math.min(1, dt * 4);
    const sunDir = atmosphere(A.night, A.dawn);
    // the Council at its height: the Eye in the Ring, and in the sky
    A.eye += ((s.mode === 'council' ? (s.council?.heat ?? 0) : 0) - A.eye) * Math.min(1, dt * 2);
    sky.uniforms.uGrey.value = A.wraith * 0.85;
    sky.uniforms.uEye.value = Math.max(A.wraith * (0.4 + 0.6 * (s.gaze ?? 0)), smooth(0.5, 1, A.eye) * 0.35);
    stage.grade({ saturation: 1.02 - A.wraith * 0.85 - A.eye * 0.25, contrast: 0.08 + A.wraith * 0.18 + A.eye * 0.1, vignette: 0.24 + A.wraith * 0.4 + A.eye * 0.25 });
    // (the fog's own colour while it's this, not the sky's)
    houseLook.set({ fogMix: 1 - A.wraith * 0.8 });
    if (A.wraith > 0.01) {
      scene.fog.near *= 1 - A.wraith * 0.7;
      scene.fog.far *= 1 - A.wraith * 0.55;
      scene.fog.color.lerp(WRAITH_FOG, A.wraith * 0.8);
    }
    if (inside) {
      scene.fog.near = 30;
      scene.fog.far = 120;
    }
    valley.visible = !inside;
    room.group.visible = inside;
    ring.glow?.(Math.min(1, A.eye * 1.4 + (s.mode === 'bilbo' ? 0.4 : 0)));

    const h = s.hobbit;
    const hy = height(h.x, h.z);
    const lights = [];

    // ── Frodo ──
    frodo.group.visible = A.wraith < 0.5;
    if (inside) {
      // in bed, sitting up as he wakes
      frodo.group.position.copy(roomAt(room.bed));
      // (on the cast: lying, then sat up in bed by his own pose; a toy is tipped up)
      const up = Math.PI / 2 - s.stepT * 0.4 < 0.9;
      frodo.group.rotation.set(0, -Math.PI / 2, frodo.cast?.ready ? 0 : Math.min(Math.PI / 2, Math.max(0.3, Math.PI / 2 - s.stepT * 0.4)));
      castDo(frodo, { base: up ? 'sit.floor' : 'sleep', seat: 0.1, look: up ? roomGandalf : null });
      pose(frodo, t, { moving: false, talk: s.talk === 'frodo' ? 1 : 0 });
    } else if (s.mode === 'council') {
      castDo(frodo, { base: null, seat: null, look: COURT_RING });
      frodo.group.position.set(frodoSeat.x, padY('court') + (s.stood ? 0 : (court.seatHeight ?? 0.5) - frodo.baseY + 0.05), frodoSeat.z);
      frodo.group.rotation.set(0, frodoSeat.face, 0);
      pose(frodo, t, { moving: false });
      if (!s.stood) sit(frodo);
    } else {
      castDo(frodo, { base: null, seat: null, look: null });
      frodo.group.position.set(h.x, hy, h.z);
      frodo.group.rotation.set(0, h.face, 0);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
    }
    ghosts.update(inside ? [] : (s.travellers ?? []), t, dt, { ringOn: Boolean(s.wearing) });

    // ── who's about ──
    for (const c of CAST) {
      const p = people[c.id];
      const on = !inside && s.cast?.includes(c.id) && s.mode !== 'council';
      p.group.visible = Boolean(on);
      if (!on) continue;
      // they turn to Frodo as he comes by: on the cast the head first, a greeting the first time
      if (!p.seated) attend(p, h, c.face, dt, { who: frodo });
      else castDo(p, { look: Math.hypot(h.x - c.x, h.z - c.z) < 5 ? frodo : null });
      // Bilbo at his desk reaches for the Ring, as the game says (on the
      // cast: his hand out over the desk, and the lunge a snarl)
      castDo(p, { upper: c.id === 'bilbo' && s.mode === 'bilbo' && s.reach ? (s.reach.state === 'lunge' ? 'shout' : s.reach.hand > 0.2 ? 'pickup' : null) : null });
      if (c.id === 'bilbo' && s.mode === 'bilbo' && s.reach) {
        pose(p, t, { moving: false });
        sit(p);
        p.arms[1].rotation.z = 0.4 + s.reach.hand * 1.1;
        p.arms[1].rotation.x = -0.2;
        if (s.reach.state === 'lunge') p.head.rotation.z = Math.sin(t * 30) * 0.06;
        continue;
      }
      pose(p, t + c.x, { moving: false, talk: s.talk === c.id || s.speaker === c.id || (c.id === 'bilbo' && s.mode === 'riddles') ? 1 : 0 });
      if (p.seated) sit(p);
    }
    // the Nine: about the valley until they join, then behind you
    for (const c of COMPANIONS) {
      const p = companions[c.id];
      const at = s.party?.[c.id];
      const waiting = s.gathering && !at;
      p.group.visible = !inside && Boolean(at || waiting);
      if (!p.group.visible) continue;
      if (at) {
        // off the conga line: each walks to its place at its own pace, apart from the rest
        const d = followDrawn(p, at, dt, { others: [...Object.values(companions).filter((o) => o !== p && o.group.visible), { x: h.x, z: h.z }] });
        p.group.position.set(d.x, height(d.x, d.z), d.z);
        p.group.rotation.y = d.face;
        pose(p, t + c.x, { moving: d.v > 0.3, speed: 1 });
      } else {
        p.drawn = null;
        p.group.position.set(c.x, height(c.x, c.z), c.z);
        const near = Math.hypot(h.x - c.x, h.z - c.z) < 5;
        attend(p, h, c.face, dt, { who: frodo });
        pose(p, t + c.x, { moving: false, wave: near && !p.cast?.ready ? 0.4 : 0 });
      }
    }
    // the Council, in their seats
    const councilOn = s.mode === 'council';
    council.forEach((p, i) => {
      if (!p) return;
      p.group.visible = councilOn;
      if (!councilOn) return;
      const heat = s.council?.heat ?? 0;
      const look = COUNCIL_SEATS[i];
      // up out of their seats as the argument rises
      const up = heat > 0.4 + (i % 3) * 0.12;
      const s0 = SEATS[i];
      const k = up ? 0.9 : 0;
      // in their chairs, until the argument gets them up
      p.group.position.set(s0.x + (COURT.x - s0.x) * 0.12 * k, padY('court') + (up ? 0 : (court.seatHeight ?? 0.5) - p.baseY + 0.05), s0.z + (COURT.z - s0.z) * 0.12 * k);
      // Gimli and his axe
      if (look === 'gimli' && t - A.axe < 1.6) {
        const f = Math.min(1, (t - A.axe) / 0.5);
        p.group.position.set(s0.x + (COURT.x - s0.x) * 0.8 * f, padY('court'), s0.z + (COURT.z - s0.z) * 0.8 * f);
        p.arms[1].rotation.z = 2.6 - f * 3.2;
        // (on the cast: the blow, once, as he gets there)
        if (!p.struck && f >= 1) p.struck = castPlay(p, 'cross', { fade: 0.08 });
      } else p.struck = null;
      // on the cast: up and arguing (each in their own way), all eyes on the Ring
      castDo(p, { upper: up ? (look === 'gimli' || look === 'boromir' || look === 'dwarf' ? 'talk.angry' : 'talk.passion') : null, look: COURT_RING });
      pose(p, t + i, { moving: false, talk: up ? 1 : 0, wave: up && i % 2 && !p.cast?.ready ? 0.3 : 0 });
      if (!up && !(look === 'gimli' && t - A.axe < 1.6)) sit(p);
    });
    // in the bedroom
    roomGandalf.group.visible = inside;
    roomSam.group.visible = inside && s.samIn;
    if (inside) {
      pose(roomGandalf, t, { moving: false, talk: s.speaker === 'gandalf' ? 1 : 0 });
      sit(roomGandalf);
      // (on the cast: they look at Frodo; Sam waves as he comes in, then hovers)
      castDo(roomGandalf, { look: frodo });
      castDo(roomSam, { look: frodo });
      if (s.samIn && !A.samWaved && roomSam.cast?.ready) {
        A.samWaved = true;
        roomSam.cast.greet();
      } else if (!s.samIn) A.samWaved = false;
      pose(roomSam, t, { moving: false, wave: roomSam.cast?.ready ? 0 : 0.5, talk: s.speaker === 'sam' ? 1 : 0 });
    }

    // the shards on their cloth, in the order the puzzle has them
    shards.pieces.forEach((piece, i) => {
      const at = s.shards ? s.shards.order.indexOf(i) : i;
      piece.position.x += (slotX[at] - piece.position.x) * Math.min(1, dt * 8);
      piece.position.y = s.shards && s.shards.held === at ? 0.06 : 0;
    });

    // ── markers, and the ring at your feet ──
    markers.forEach((m, i) => {
      const q = (s.markers ?? [])[i];
      m.visible = s.mode === 'walk' && Boolean(q) && Math.hypot(q.x - h.x, q.z - h.z) > 5;
      if (!m.visible) return;
      m.position.set(q.x, height(q.x, q.z) + 3.4 + Math.sin(t * 2 + i) * 0.15, q.z);
      m.children[0].rotation.y = t * 1.5;
    });
    const near = s.near ? (SPOTS.find((x) => x.id === s.near) ?? COMPANIONS.find((x) => x.id === s.near)) : null;
    hereRing.visible = Boolean(near) && s.mode === 'walk';
    if (near) {
      hereRing.position.set(near.x, height(near.x, near.z) + 0.06, near.z);
      hereRing.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    }

    // Bilbo's riddle candle, as far burnt down as the riddle's gone
    riddleCandle.g.visible = s.mode === 'riddles';
    if (riddleCandle.g.visible) {
      const k = s.riddles?.state === 'ask' ? s.riddles.candle : 0;
      const h = 0.03 + 0.16 * k;
      riddleCandle.wax.scale.y = h;
      riddleCandle.flame.position.y = h;
      riddleCandle.flame.visible = k > 0;
      riddleCandle.flame.scale.set(1, 0.85 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08, 1);
    }

    // ── the lamps, at dusk; the room's sunlight ──
    if (inside) lights.push([roomAt(room.sun), warm, 14, 12]);
    else {
      const lit = A.night;
      if (lit > 0.05) for (const l of lampAt) lights.push([l, warm, 5 * lit, 10]);
      if (s.mode === 'bilbo') lights.push([toWorld(pavilion, pavilion.desk).add(V(0, 1.2, 0)), warm, 4, 6]);
      if (s.mode === 'riddles') lights.push([riddleCandle.g.position.clone().add(V(0, 0.3, 0)), warm, 1.5 + 3 * (s.riddles?.candle ?? 0), 5]);
    }
    if (s.mode === 'council' && A.eye > 0.3) lights.push([ring.group.position.clone().add(V(0, 0.6, 0)), new THREE.Color(1, 0.4, 0.1), A.eye * 4, 6]);
    pool.forEach((l, i) => {
      const v = lights[i];
      if (!v) return (l.intensity = 0);
      l.position.copy(v[0]);
      l.color.copy(v[1]);
      l.intensity = v[2];
      l.distance = v[3];
      return undefined;
    });

    // leaves coming down, round wherever you are
    A.leaf += dt;
    if (!inside)
      while (A.leaf > 0.06 / Math.max(0.4, many)) {
        A.leaf -= 0.06 / Math.max(0.4, many);
        const a = Math.random() * TAU;
        const r = 3 + Math.random() * 22;
        const x = camera.position.x + Math.cos(a) * r;
        const z = camera.position.z + Math.sin(a) * r;
        leafFall.emit(x, height(x, z) + 6 + Math.random() * 6, z, 0.3, -0.4, 0.15, 7 + Math.random() * 4, 0.09, 0.08, 1);
      }
    leafFall.step(dt);
    fx.step(dt, t, { night: 0, day: 0 });

    // ── the camera ──
    let camAt;
    let camLook;
    if (inside) {
      // by the window, on the bed and the chair
      const bed = roomAt(room.bed);
      camAt = tmp.copy(bed).add(V(-2.6, 1.6, 2.2));
      camLook = look.copy(bed).add(V(0.6, 0.6, -0.4));
    } else if (s.mode === 'council') {
      // round the court, slowly, closer as it heats up
      const heat = s.council?.heat ?? 0;
      const a = 0.9 + t * 0.05;
      const r = 9.5 - heat * 2.5;
      const y0 = padY('court');
      camAt = tmp.set(COURT.x + Math.cos(a) * r, y0 + 3.6 - heat * 1.2, COURT.z + Math.sin(a) * r);
      camLook = look.set(COURT.x, y0 + 1.2, COURT.z);
      if (s.stood) {
        camAt.set(frodoSeat.x + (COURT.x - frodoSeat.x) * 0.45, y0 + 1.6, frodoSeat.z + (COURT.z - frodoSeat.z) * 0.45);
        camLook.set(frodoSeat.x, y0 + 1, frodoSeat.z);
      }
    } else if (s.mode === 'narsil') {
      const at = shards.group.position;
      camAt = tmp.copy(at).add(V(0, 1.8, 2.6));
      camLook = look.copy(at).add(V(0, 0.2, 0));
    } else if (s.mode === 'bilbo' || s.mode === 'riddles') {
      // in front of him, across the desk (he faces the pavilion's +x)
      camAt = tmp.copy(toWorld(pavilion, V(2.2, 2.1, -0.4)));
      camLook = look.copy(toWorld(pavilion, V(-0.4, 1.3, -1)));
    } else if (s.mode === 'talk' && s.speakerAt) {
      const a = tmp2.set(h.x, hy + 1.3, h.z);
      const b = V(...s.speakerAt);
      const d = b.clone().sub(a);
      d.y = 0;
      const len = Math.max(0.5, d.length());
      d.normalize();
      const side = V(-d.z, 0, d.x);
      camAt = tmp.copy(a).addScaledVector(d, -1.8).addScaledVector(side, 1.4);
      camAt.y = Math.max(hy, b.y) + 1.1 + Math.min(1.2, len * 0.12);
      camLook = look.copy(b).lerp(a, 0.25);
      const floor = height(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
    } else if (s.mode === 'leaving') {
      // from the gate, as they go
      camAt = tmp.set(GATE.x + 6, height(GATE.x, GATE.z) + 4, GATE.z + 10);
      camLook = look.set(GATE.x, height(GATE.x, GATE.z) + 1.5, GATE.z - 4);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.36;
      const dist = s.camDist ?? 6.4;
      look.set(h.x, hy + 1.15, h.z);
      camAt = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, hy + 1.15 + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      let k = clearance(look, camAt);
      A.suggest = null;
      if (k < 0.6) {
        let best = k;
        for (const dy of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
          const y2 = yaw + dy;
          const kk = clearance(look, tmp2.set(h.x + Math.sin(y2) * Math.cos(pitch) * dist, hy + 1.15 + Math.sin(pitch) * dist, h.z + Math.cos(y2) * Math.cos(pitch) * dist));
          if (kk > best + 0.15) {
            best = kk;
            A.suggest = y2;
          }
        }
      }
      if (k < 1) camAt.lerpVectors(look, camAt, Math.max(k, 0.3));
      const floor = Math.max(height(camAt.x, camAt.z), hy - 1) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode;
    A.mode = s.mode;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' ? 7 : 2.2));
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
    sun.position.copy(camera.position).addScaledVector(sunDir, 90);
    sun.target.position.copy(camera.position);
    ground.update();
    // the people on the cast (../../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms / fast);
  };

  // ── events ──
  const fxEvent = (type) => {
    if (type === 'axe') {
      A.axe = A.t;
      A.shake = 0.25;
      clearTimeout(A.axeTimer);
      A.axeTimer = setTimeout(() => fx.pop(ring.group.position.clone().add(V(0, 0.3, 0)), 'white', 40, 3.4), 450);
    } else if (type === 'lunge') A.shake = Math.max(A.shake, 0.15);
    else if (type === 'joined') fx.pop(tmp2.copy(frodo.group.position).add(V(0, 1.4, 0)), 'gold', 18, 1.4);
    else if (type === 'solved') fx.pop(shards.group.position.clone().add(V(0, 0.3, 0)), 'gold', 30, 1.8);
    else if (type === 'heard') A.shake = 0.12;
  };

  const screenOf = (kind, id) => {
    let p = null;
    if (kind === 'cast' && people[id]) p = tmp.copy(people[id].group.position).add(tmp2.set(0, 2.2, 0));
    else if (kind === 'cast' && companions[id]) p = tmp.copy(companions[id].group.position).add(tmp2.set(0, 2.2, 0));
    if (!p) return null;
    p = p.clone().project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };
  const headOf = (id) => {
    const p = people[id] ?? companions[id];
    return p ? p.group.position.clone().add(V(0, 1.7, 0)).toArray() : null;
  };

  // ── the floor's light, baked when the town is first drawn ──
  const ground = groundTown({ place: 'rivendell', renderer, scene, terrain, outdoors: valley, sun, height: under, people: movers, skip: [sky.dome, ghosts.group], tier, radius: WORLD.radius + 10, shade: 0x3a2a1c, matcap: farWoods });
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    ground: import.meta.env.DEV ? ground : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    render,
    fx: fxEvent,
    screenOf,
    headOf,
    balcony,
    resize: stage.resize,
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier };
    },
    get lost() {
      return stage.lost;
    },
    get suggestYaw() {
      return A.suggest ?? null;
    },
    dispose() {
      ground.dispose();
      clearTimeout(A.axeTimer);
      ghosts.dispose();
      disposeTree(scene);
      releaseCast(scene);
      stage.dispose();
    },
  };
}

// What the camera can't go through: the buildings, the trees.
const BLOCKERS = COLLIDERS.filter((c) => !c.low).map((c) => ({ ...c, y: height(c.x, c.z) + (c.top ?? 4) }));
function insideAt(x, y, z) {
  for (const c of BLOCKERS) {
    if (y > c.y) continue;
    if (c.kind === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + 0.25) return true;
    } else if (boxDist(c, x, z) < 0.25) return true;
  }
  return y < height(x, z) + 0.3;
}
function clearance(from, to) {
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    if (insideAt(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k)) return Math.max(0.18, (i - 1) / N);
  }
  return 1;
}
