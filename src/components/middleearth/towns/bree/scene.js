// Bree, the town, in WebGL: a wet night on the East Road. The stockade and
// its gates, tall houses down the high street and the lanes, the Prancing
// Pony with its windows lit, mud and puddles and rain, Bree-hill dark
// behind; then the Nazgûl in the lanes, and a grey dawn. Made in code
// (./props.js, ./inn.js, ../ground.js, ../rain.js), so nothing is
// downloaded.
//
// It draws what the component hands it every frame (the walker, the scene
// in hand, the Nazgûl, the camera) and decides nothing; ./layout.js and
// ./story.js have the rules.
//
// createBreeWorld(canvas) returns { render(state, ms, fast), fx(type,
// data), screenOf(kind, id), resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { createHouse } from '../../../../lib/three/house';
import { dress, rolesFor } from '../../../../lib/three/core';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { instances } from '../../shire/ground';
import { makeAtmosphere, makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { bake, farTree } from '../bake';
import { createGhosts } from '../ghosts';
import { makePuddles, makeTerrain, makeTufts } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { makeRain } from '../rain';
import { createWraithKit } from '../wraiths';
import { createBreeKit, makeFolk } from './props';
import { NAZGUL } from './story';
import { INN, buildInn } from './inn';
import {
  BANKS,
  BILL,
  CAST,
  CLUTTER,
  COLLIDERS,
  FERNY,
  GATES,
  HOUSES,
  LAMPS,
  LODGE,
  PONY,
  PUDDLES,
  SPOTS,
  STABLE,
  STALLS,
  STOCKADE,
  STRIDER_NIGHT,
  TOWN,
  TREES,
  WELL,
  WORLD,
  boxDist,
  height,
  roadAmount,
} from './layout';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const faceTo = (obj, face) => {
  obj.rotation.y = face;
};

// Bree's three moods, in the sky's own slots: `day` is the wet evening the
// hobbits come in, `night` the night the Riders come, `dawn` the morning.
const MOODS = {
  day: { top: 0x2c3646, horizon: 0x66707e, sun: [0.3, 0.55, 0.6], sunColour: 0xb4bed0, sunPower: 1.15, hemiSky: 0x98a8c2, hemiGround: 0x3e3c32, hemi: 1.35, fog: 0x46505e, fogNear: 16, fogFar: 120, cloud: 0.95, cloudColour: 0x707a8a, stars: 0, exposure: 1.32, water: 0x56627a, deep: 0x12161c },
  night: { top: 0x070a12, horizon: 0x1c2434, sun: [-0.4, 0.62, -0.5], sunColour: 0x7686aa, sunPower: 0.85, hemiSky: 0x4c5e8c, hemiGround: 0x1a1c1e, hemi: 1.1, fog: 0x10161f, fogNear: 12, fogFar: 95, cloud: 0.85, cloudColour: 0x222838, stars: 0, exposure: 1.6, water: 0x202a3c, deep: 0x06080c },
  dawn: { top: 0x5a6a88, horizon: 0xd8b49c, sun: [0.85, 0.2, 0.3], sunColour: 0xffc89a, sunPower: 1.9, hemiSky: 0xd8d0c8, hemiGround: 0x4a4a3a, hemi: 0.85, fog: 0xc4b2a4, fogNear: 30, fogFar: 175, cloud: 0.55, cloudColour: 0xe8c0a8, stars: 0, exposure: 1.05, water: 0xb8a8a0, deep: 0x2a2a34 },
};

// the ground's colours
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x3f5c2c);
const GRASS_DEEP = C(0x2a4220);
const GRASS_HILL = C(0x5a7440);
const MUD = C(0x4c3c2a);
const MUD_WET = C(0x2e241a);
const DIRT = C(0x5c4a36);
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const PADS = [...HOUSES, PONY, STABLE, LODGE, FERNY];
const noise = makeNoise(29);
function paint(x, z, h, out) {
  const patch = fbm(noise, x * 0.06 + 3, z * 0.06, { octaves: 3 });
  lerp3(out, GRASS_DEEP, GRASS, smooth(0.3, 0.75, patch));
  lerp3(out, out, GRASS_HILL, smooth(4, 12, h) * 0.6);
  const r = Math.hypot(x, z);
  // the town's ground is trodden; its streets are mud, wetter in the ruts
  if (r < TOWN.r + 1) lerp3(out, out, DIRT, 0.22);
  let near = Infinity;
  for (const p of PADS) near = Math.min(near, boxDist(p, x, z));
  if (near < 2.2) lerp3(out, out, DIRT, (1 - smooth(0.2, 2.2, near)) * 0.7);
  const road = roadAmount(x, z);
  if (road > 0) {
    lerp3(out, out, MUD, road * 0.9);
    lerp3(out, out, MUD_WET, road * smooth(0.45, 0.8, fbm(noise, x * 0.5, z * 0.5, { octaves: 2 })) * 0.7);
  }
  if (Math.abs(r - TOWN.r) < 1.2) lerp3(out, out, DIRT, (1 - Math.abs(r - TOWN.r) / 1.2) * 0.6);
  return out;
}
const growable = (x, z) => {
  if (roadAmount(x, z) > 0.05) return false;
  const r = Math.hypot(x, z);
  if (Math.abs(r - TOWN.r) < 0.9) return false;
  for (const p of PADS) if (boxDist(p, x, z) < 0.5) return false;
  return true;
};

export function createBreeWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 50, near: 0.1, far: 420, bloom: { strength: 0.62, radius: 0.5, threshold: 0.86 }, onLost });
  stage.grade({ contrast: 0.12, saturation: 0.86, vignette: 0.3, grain: 0.016, shadow: [0.0, 0.012, 0.035], high: [0.03, 0.018, 0.0] });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x3c4450, 14, 115);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.3;

  // ── light: a dim sky, and a pool of lamps lent in turn to the street and the inn ──
  const hemi = new THREE.HemisphereLight(0x8494ae, 0x2c2c26, 0.8);
  const sun = new THREE.DirectionalLight(0xa4aec0, 0.75);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'high' ? 6 : tier === 'mid' ? 4 : 3;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffa860, 0, 16, 1.7);
    scene.add(l);
    return l;
  });

  const outdoors = new THREE.Group();
  const statics = new THREE.Group();
  scene.add(outdoors);
  outdoors.add(statics);

  const sky = makeSky(380);
  scene.add(sky.dome);
  const puddles = makePuddles(PUDDLES, height);
  outdoors.add(puddles.mesh);
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water: puddles.material, stage, house: houseLook, moods: MOODS });

  // ── the ground ──
  const terrain = makeTerrain(renderer, { size: WORLD.edge * 2, seg: tier === 'high' ? 210 : tier === 'mid' ? 150 : 100, height, paint, blades: 0.22 });
  outdoors.add(terrain);
  const wind = { uWind: { value: 0 } };
  outdoors.add(makeTufts(Math.round(9000 * many), { radius: 62, height, growable, seed: 41 }, wind));

  const kit = createBreeKit(renderer);
  const mats = kit.mats;
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });

  // ── the buildings ──
  const chimneys = [];
  const place = (part, b, { y = null, sink = 0.05 } = {}) => {
    part.group.position.set(b.x, (y ?? height(b.x, b.z)) - sink, b.z);
    part.group.rotation.y = b.turn || 0;
    statics.add(part.group);
    part.group.updateMatrixWorld(true);
    const tops = part.chimneyTops ?? (part.chimneyTop ? [part.chimneyTop] : []);
    for (const c of tops) chimneys.push(c.clone().applyMatrix4(part.group.matrixWorld));
    return part;
  };
  for (const h of HOUSES) place(kit.house(h), h);
  const pony = place(kit.pony(), PONY);
  // the light of the Pony's door lanterns, a little out from the wall
  const ponyLamp = pony.lamps.map((l) => l.clone().applyMatrix4(pony.group.matrixWorld)).reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(1 / pony.lamps.length).add(V(0, 0.2, 1.1));
  const stable = place(kit.stable(), STABLE);
  place(kit.lodge(), LODGE);
  place(kit.house({ ...FERNY, floors: 2, roof: 'thatch', stone: false, seed: 21, door: 0x26261e }), FERNY);
  place(kit.well(), { ...WELL, turn: 0 });
  for (const s of STALLS) place(kit.stall(s), s);
  for (const [kind, x, z, turn] of CLUTTER) {
    const part = kind === 'cart' ? kit.cart() : kind === 'barrels' ? kit.barrels() : kind === 'crates' ? kit.crates() : kit.hayBale();
    place(part, { x, z, turn }, { sink: 0 });
  }
  const lampAt = LAMPS.map(([x, z, turn]) => {
    const p = place(kit.lampPost(), { x, z, turn }, { sink: 0 });
    return p.light.clone().applyMatrix4(p.group.matrixWorld);
  });
  // the stockade, and the dike's banks along the road outside each gate
  outdoors.add(kit.stockade(STOCKADE, height).group);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x34422a, roughness: 1 });
  const hedgeGeo = kit.hedge();
  const hedges = [];
  for (const [x0, z0, x1, z1] of BANKS) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 2));
    const turn = -Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * k;
      const z = z0 + (z1 - z0) * k;
      const y = height(x, z);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, len / n + 0.15, 7, 1, false, 0, Math.PI), bankMat);
      m.rotation.set(0, turn, Math.PI / 2);
      m.rotation.order = 'YXZ';
      m.position.set(x, y - 0.25, z);
      m.scale.set(1.0, 1, 0.75);
      statics.add(m);
      hedges.push({ x, z, y: y + 0.45, sx: (len / n) * 1.05, sy: 1.0, sz: 0.9, turn });
    }
  }
  if (hedgeGeo) outdoors.add(instances(hedgeGeo, mats.hedge, hedges, { shadow: false }));
  // the gates
  const gates = {};
  for (const [k, g] of Object.entries(GATES)) {
    const part = kit.gate();
    part.group.position.set(g.x, height(g.x, g.z) - 0.05, g.z);
    part.group.rotation.y = g.turn;
    outdoors.add(part.group);
    part.group.updateMatrixWorld(true);
    part.lampAt = part.lamp.clone().applyMatrix4(part.group.matrixWorld);
    part.k = 0;
    gates[k] = part;
  }
  const hatchAt = gates.west.hatchAt.clone().applyMatrix4(gates.west.group.matrixWorld);
  // the West Gate's way out to the road, and along it towards the middle
  const gateOut = V(-Math.sin(GATES.west.turn), 0, -Math.cos(GATES.west.turn));
  const gateAlong = V(Math.cos(GATES.west.turn), 0, -Math.sin(GATES.west.turn));

  // trees: oaks in the yards, and woods on Bree-hill and the hills round
  const oaks = kit.oaks?.() ?? [];
  if (oaks.length) {
    oaks.forEach((oak, k) => {
      const list = TREES.filter((_, i) => i % oaks.length === k).map(([x, z, s]) => ({ x, z, y: height(x, z) - 0.1, s, turn: x * 1.7 }));
      if (!list.length) return;
      outdoors.add(instances(oak.trunk, mats.trunk, list, { shadow: false }));
      outdoors.add(instances(oak.crown, mats.crown, list, { shadow: false }));
    });
  }
  const far = farTree({ leaf: [0x2a4422, 0x34502a, 0x24401e], trunk: 0x3a2e22 });
  const rim = [];
  const rand = (() => {
    let s = 7;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  })();
  for (let tries = 0; rim.length < Math.round(320 * Math.max(0.5, many)) && tries < 6000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = TOWN.r + 4 + Math.pow(rand(), 0.7) * (WORLD.edge - TOWN.r - 8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (roadAmount(x, z) > 0 || (Math.abs(x) > 30 && Math.abs(z - (x < 0 ? 3.5 : -6)) < 9 && r < WORLD.radius + 4)) continue;
    // thicker up Bree-hill, to the north-east
    if (Math.hypot(x - 26, z + 52) > 30 && rand() < 0.45) continue;
    rim.push({ x, z, y: height(x, z) - 0.2, s: 0.9 + rand() * 0.9, turn: rand() * 6.28 });
  }
  // (the far rim of trees in matcaps made from the town's own light: seen
  // only in passing, one texture fetch and no lights for each: ../grounded.js)
  const rimTrees = instances(far, new THREE.MeshLambertMaterial({ vertexColors: true }), rim, { shadow: false });
  outdoors.add(rimTrees);

  // the buildings and props that never move, merged by material
  outdoors.add(bake(statics, [gates.west.group, gates.east.group]));

  // ── the people ──
  // (each stands on a soft blob slid away from the sun, and dims in the
  // baked shade: ../grounded.js)
  const movers = [];
  const blob = (f, s = 1) => {
    movers.push({ object: f.group, size: [FIGURE * s, FIGURE * s] });
    return f;
  };
  const frodo = blob(makeFolk('frodo'));
  outdoors.add(frodo.group);
  // other travellers, online, from other worlds (../ghosts.js)
  const ghosts = createGhosts({ height });
  outdoors.add(ghosts.group);
  const people = {};
  for (const c of CAST) {
    const p = blob(makeFolk(c.look));
    p.group.position.set(c.x, height(c.x, c.z), c.z);
    faceTo(p.group, c.face);
    p.home = { x: c.x, z: c.z, face: c.face };
    outdoors.add(p.group);
    people[c.id] = p;
  }
  const striderNight = blob(makeFolk('strider'));
  striderNight.group.position.set(STRIDER_NIGHT.x, height(STRIDER_NIGHT.x, STRIDER_NIGHT.z), STRIDER_NIGHT.z);
  faceTo(striderNight.group, STRIDER_NIGHT.face);
  outdoors.add(striderNight.group);
  const bill = blob(kit.billPony(), 1.6);
  outdoors.add(bill.group);
  const billStable = stable.stalls[1].clone().applyMatrix4(stable.group.matrixWorld);
  // the Nazgûl, and two of their horses by the broken gate
  const wraithKit = createWraithKit(renderer);
  // (the Ring's pale form, compiled now so putting it on doesn't stall)
  wraithKit.setRing(0.01);
  wraithKit.setRing(0);
  const nazgul = Array.from({ length: 4 }, (_, i) => {
    const n = blob(wraithKit.nazgul({ seed: i + 1, sword: i % 2 === 0 }), 1.3);
    n.group.visible = false;
    outdoors.add(n.group);
    return n;
  });
  // what each can see, on the ground: a cold breath of dread spreading from
  // its feet, grey-blue while it searches, burning red once it's seen you;
  // soft at every edge, and stirring, so it reads as a sense and not a shape
  // (a fan of rings and spokes, laid over the ground each frame, so the
  // lane's rise and fall never cuts it into hard shapes)
  const RINGS_N = 10;
  const SPOKES = 18;
  const fanGeo = () => {
    const pos = [];
    const local = [];
    const idx = [];
    pos.push(0, 0, 0);
    local.push(0, 0);
    for (let r = 1; r <= RINGS_N; r++)
      for (let k = 0; k <= SPOKES; k++) {
        const a = -NAZGUL.cone * 1.15 + (k / SPOKES) * NAZGUL.cone * 2.3;
        const d = (r / RINGS_N) * NAZGUL.sight;
        pos.push(Math.cos(a) * d, 0, -Math.sin(a) * d);
        local.push(Math.cos(a) * d, -Math.sin(a) * d);
      }
    const at = (r, k) => (r === 0 ? 0 : 1 + (r - 1) * (SPOKES + 1) + k);
    for (let r = 0; r < RINGS_N; r++)
      for (let k = 0; k < SPOKES; k++) {
        if (r === 0) idx.push(0, at(1, k), at(1, k + 1));
        else idx.push(at(r, k), at(r + 1, k), at(r + 1, k + 1), at(r, k), at(r + 1, k + 1), at(r, k + 1));
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('local', new THREE.Float32BufferAttribute(local, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.boundingSphere.radius = NAZGUL.sight + 2;
    return g;
  };
  const drapeFan = (m, x, z, face) => {
    const p = m.geometry.attributes.position;
    const l = m.geometry.attributes.local;
    const y0 = height(x, z);
    const c = Math.cos(face);
    const sn = Math.sin(face);
    for (let i = 0; i < p.count; i++) {
      const lx = l.getX(i);
      const lz = l.getY(i);
      // the fan turned to the face, in the world
      const wx = x + lx * c + lz * sn;
      const wz = z - lx * sn + lz * c;
      p.setY(i, height(wx, wz) - y0 + 0.06);
    }
    p.needsUpdate = true;
  };
  const cones = nazgul.map((_, i) => {
    const m = new THREE.Mesh(
      fanGeo(),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x8aa0d8) }, uOpacity: { value: 0.3 }, uTime: { value: 0 }, uSight: { value: NAZGUL.sight }, uCone: { value: NAZGUL.cone }, uSeed: { value: i * 3.7 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: 'attribute vec2 local; varying vec2 vP; void main() { vP = local; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity, uTime, uSight, uCone, uSeed;
          varying vec2 vP;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
          void main() {
            float r = length(vP) / uSight;
            float a = abs(atan(-vP.y, vP.x)) / uCone;
            float edge = 1.0 - smoothstep(0.62, 1.12, a);
            float reach = pow(1.0 - smoothstep(0.0, 1.0, r), 1.4) * smoothstep(0.0, 0.08, r);
            vec2 q = vP * 0.55 + vec2(uTime * 0.35 + uSeed, -uTime * 0.22);
            float mist = 0.55 + 0.45 * noise(q) * noise(q * 2.3 + 4.1);
            float ripple = 0.85 + 0.15 * sin(r * 22.0 - uTime * 3.0);
            float alpha = edge * reach * mist * ripple * uOpacity;
            gl_FragColor = vec4(uColor * (0.7 + 0.5 * (1.0 - r)), alpha);
          }`,
      }),
    );
    m.renderOrder = 2;
    m.visible = false;
    outdoors.add(m);
    return m;
  });
  const horses = [V(-38.2, 0, 2.0), V(-39.8, 0, 5.4)].map((at, i) => {
    const r = kit.blackRider();
    r.rider.group.visible = false;
    r.group.position.set(at.x, height(at.x, at.z), at.z);
    r.group.rotation.y = i ? -0.3 : 0.25;
    r.group.visible = false;
    outdoors.add(r.group);
    movers.push({ object: r.group, size: [1.2, 2.8] });
    return r;
  });
  // a cold light that comes with the Nazgûl, so they're shapes and not holes
  const crowd = [...Object.values(people), striderNight];

  // ── markers: where there's something to do ──
  const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 0.7) });
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.4), transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const markers = Array.from({ length: 3 }, () => {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), markerMat);
    gem.scale.y = 1.5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 9, 12, 1, true), beamMat);
    beam.position.y = -1.2;
    g.add(gem, beam);
    g.visible = false;
    outdoors.add(g);
    return g;
  });
  const hereRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.05, 0.4), transparent: true, opacity: 0.55, depthWrite: false }));
  hereRing.visible = false;
  outdoors.add(hereRing);

  // ── rain, smoke, the inn ──
  const rain = makeRain({ count: Math.round(5200 * many), splashes: tier === 'low' ? 0 : Math.round(220 * many), height });
  scene.add(rain.group);
  const fx = createFx(scene, { scale: many });
  const inn = buildInn(renderer, { kit });
  scene.add(inn.group);

  // ── state ──
  const A = { t: 0, night: 0, dawn: 0, wraith: 0, shake: 0, peep: 0, cam: { at: V(0, 6, 8), look: V(0, 1, 0) }, mode: 'walk', smashed: false, smoke: 0, flame: 0, near: [] };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const look = new THREE.Vector3();
  const DREAD_COLD = new THREE.Color(0x8aa0d8);
  const DREAD_HOT = new THREE.Color(0xd8341c);
  const WRAITH_FOG = new THREE.Color(0.3, 0.33, 0.4);
  const warm = new THREE.Color(0xffa860);
  const fireCol = new THREE.Color(0xff7a2a);
  // the puddles mirror the pool's lamps, and the Pony's windows
  const ponyWindows = [-2.2, 10.2].map((x) => V(x, height(x, -2.4) + 1.9, -2.5));
  const mirror = [];

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const inside = s.mode === 'inside';
    wind.uWind.value = t;
    sky.uniforms.uTime.value = t;

    // the time, eased
    A.night += ((s.sky === 'night' ? 1 : 0) - A.night) * Math.min(1, dt * 0.6);
    A.dawn += ((s.sky === 'dawn' ? 1 : 0) - A.dawn) * Math.min(1, dt * 0.5);
    A.wraith += ((s.wearing ? 1 : 0) - A.wraith) * Math.min(1, dt * 4);
    const sunDir = atmosphere(A.night, A.dawn);
    kit.setNight(Math.min(1, 0.82 + A.night * 0.18 - A.dawn * 0.55));
    const wet = Math.max(0, 1 - A.dawn * 1.1);
    rain.tint(0.62 + 0.25 * (1 - A.night), 0.68 + 0.22 * (1 - A.night), 0.8 + 0.12 * (1 - A.night), 0.22 + 0.14 * (1 - A.night));
    puddles.update(t, wet);
    // the Ring: the world goes grey and blurred, the Eye looks
    sky.uniforms.uGrey.value = A.wraith * 0.85;
    sky.uniforms.uEye.value = A.wraith * (0.4 + 0.6 * (s.gaze ?? 0));
    stage.grade({ saturation: 0.86 - A.wraith * 0.8, contrast: 0.12 + A.wraith * 0.18, vignette: 0.3 + A.wraith * 0.4 + (s.chased ? 0.14 : 0), shadow: [A.wraith * 0.03, 0.012 + A.wraith * 0.03, 0.035 + A.wraith * 0.06] });
    // (the fog's own colour while it's this, not the sky's)
    houseLook.set({ fogMix: 1 - A.wraith * 0.8 });
    if (A.wraith > 0.01) {
      scene.fog.near *= 1 - A.wraith * 0.7;
      scene.fog.far *= 1 - A.wraith * 0.55;
      scene.fog.color.lerp(WRAITH_FOG, A.wraith * 0.8);
    }

    // ── the lamps ──
    const flicker = 0.85 + Math.sin(t * 9.3) * 0.06 + Math.sin(t * 23.1) * 0.05;
    mirror.length = 0;
    if (inside) {
      const set = [
        [inn.lights.fire, fireCol, 26 * flicker, 15],
        [inn.lights.bar, warm, 9, 10],
        [s.beat === 'strider' ? inn.lights.corner : inn.lights.table, warm, s.beat === 'strider' ? 1.4 : 5, 7],
        // his pipe: it lights his face from below as he draws on it
        [inn.lights.pipe, fireCol, 0.35 + inn.draw * (s.beat === 'strider' ? 1.9 : 1.4), 2.2],
      ];
      pool.forEach((l, i) => {
        const v = set[i];
        if (!v) return (l.intensity = 0);
        l.position.copy(v[0]);
        l.color.copy(v[1]);
        l.intensity = v[2];
        l.distance = v[3];
        return undefined;
      });
      sun.intensity *= 0.1;
      hemi.intensity *= 0.3;
      scene.fog.near = 30;
      scene.fog.far = 120;
    } else {
      const lit = 1 - A.dawn * 0.85;
      const list = [
        [ponyLamp, warm, 8 * lit * flicker, 15],
        [gates.west.lampAt, warm, 9 * lit, 13],
        [lampAt[1], warm, 9 * lit, 12],
        [lampAt[0], warm, 8 * lit, 12],
        [lampAt[2], warm, 8 * lit, 12],
        [gates.east.lampAt, warm, 8 * lit, 12],
      ];
      pool.forEach((l, i) => {
        const v = list[i];
        if (!v) return (l.intensity = 0);
        l.position.copy(v[0]);
        l.color.copy(v[1]);
        l.intensity = v[2];
        l.distance = v[3];
        mirror.push({ position: v[0], color: v[1], power: lit });
        return undefined;
      });
      for (const w of ponyWindows) mirror.push({ position: w, color: warm, power: 0.7 * lit });
      puddles.setLights(mirror);
    }

    // ── the gates ──
    const west = gates.west;
    if (s.smashed && !A.smashed) {
      west.smash();
      A.smashed = true;
    }
    west.k += ((s.gateOpen ? 1 : 0) - west.k) * Math.min(1, dt * 1.2);
    west.open(west.k);
    A.peep += ((s.mode === 'talk' && s.talking === 'gate' ? 1 : 0) - A.peep) * Math.min(1, dt * 5);
    west.peep(A.peep);
    gates.east.k += ((s.eastOpen ? 1 : 0) - gates.east.k) * Math.min(1, dt * 1.2);
    gates.east.open(gates.east.k);

    // ── the walker ──
    const h = s.hobbit;
    const hy = height(h.x, h.z);
    frodo.group.position.set(h.x, hy, h.z);
    faceTo(frodo.group, h.face);
    frodo.group.visible = A.wraith < 0.5 && !inside;
    pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
    if (s.crouch) frodo.body.position.y -= 0.12;
    ghosts.update(s.travellers ?? [], t, dt, { ringOn: Boolean(s.wearing) });

    // ── who's about ──
    const tod = s.sky;
    for (const c of CAST) {
      const p = people[c.id];
      const on = c.when.includes(tod) && !inside && !(c.id === 'harry' && !s.gateOpen);
      p.group.visible = on;
      if (!on) continue;
      const near = Math.hypot(h.x - c.x, h.z - c.z) < 5;
      const want = near ? Math.atan2(-(h.z - c.z), h.x - c.x) : p.home.face;
      let d = want - p.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.group.rotation.y += d * Math.min(1, dt * 4);
      pose(p, t + c.x, { moving: false, wave: s.talk === c.id ? 0.5 : 0, talk: s.talk === c.id ? 1 : 0 });
    }
    // Strider waits by the East Gate at night
    striderNight.group.visible = tod === 'night' && !inside;
    if (striderNight.group.visible) {
      faceTo(striderNight.group, Math.atan2(-(h.z - STRIDER_NIGHT.z), h.x - STRIDER_NIGHT.x));
      pose(striderNight, t, { moving: false, wave: Math.hypot(h.x - STRIDER_NIGHT.x, h.z - STRIDER_NIGHT.z) < 8 ? 0.4 : 0 });
    }
    // Bill: in the stable, then at the East Gate with Sam
    bill.group.visible = !inside;
    if (tod === 'dawn') {
      bill.group.position.set(BILL.x, height(BILL.x, BILL.z), BILL.z);
      faceTo(bill.group, BILL.face);
    } else {
      bill.group.position.copy(billStable);
      faceTo(bill.group, -Math.PI / 2 + 0.2);
    }
    bill.legs.forEach((leg) => (leg.rotation.z = 0));
    bill.neck.rotation.z = -0.25 + Math.sin(t * 0.8) * 0.06;
    bill.tail.rotation.y = Math.sin(t * 1.3) * 0.3;
    // the Nazgûl: stooped and sniffing on their rounds, upright and
    // reaching once they've a scent; pale, through the Ring
    const ws = s.watchers ?? [];
    wraithKit.tick(t);
    wraithKit.setRing(A.wraith);
    nazgul.forEach((n, i) => {
      const w = ws[i];
      n.group.visible = Boolean(w) && tod === 'night' && !inside;
      if (!n.group.visible) return;
      n.group.position.set(w.x, height(w.x, w.z), w.z);
      faceTo(n.group, w.face);
      const hunting = w.mode === 'alert' || w.mode === 'chase';
      wraithKit.animate(n, t + i * 1.7, { moving: (w.mode === 'patrol' && w.wait <= 0) || w.mode === 'chase' || w.mode === 'back' || (w.mode === 'search' && Boolean(w.goal)) || (w.mode === 'suspicious' && !(w.looked > 0)), hunt: hunting ? 1 : 0, sniff: w.mode === 'patrol' || w.mode === 'suspicious' || w.mode === 'search' ? 1 : 0, look: w.mode === 'patrol' || w.mode === 'suspicious' || w.mode === 'search' ? (w.look ?? 0) : 0 });
    });
    cones.forEach((c, i) => {
      const w = ws[i];
      c.visible = Boolean(w) && tod === 'night' && s.mode === 'walk' && w.mode !== 'back';
      if (!c.visible) return;
      c.position.set(w.x, height(w.x, w.z), w.z);
      c.rotation.y = w.face + (w.mode === 'patrol' ? w.look : 0);
      drapeFan(c, w.x, w.z, c.rotation.y);
      const alarmed = w.mode === 'alert' || w.mode === 'chase';
      const u = c.material.uniforms;
      u.uColor.value.lerp(alarmed ? DREAD_HOT : DREAD_COLD, Math.min(1, dt * 6));
      u.uOpacity.value += ((alarmed ? 0.46 : 0.3) - u.uOpacity.value) * Math.min(1, dt * 6);
      u.uTime.value = t;
    });
    horses.forEach((r, i) => {
      r.group.visible = tod === 'night' && !inside;
      if (!r.group.visible) return;
      r.horse.neck.rotation.z = -0.1 + Math.sin(t * 0.9 + i) * 0.08;
      r.horse.legs.forEach((leg, j) => (leg.rotation.z = Math.sin(t * 1.4 + j + i) * 0.04));
    });
    // the people far off aren't drawn
    if (!inside) {
      const cx = camera.position.x;
      const cz = camera.position.z;
      for (const f of crowd) if (f.group.visible && Math.hypot(f.group.position.x - cx, f.group.position.z - cz) > 60) f.group.visible = false;
    }

    // ── markers, and the ring at your feet ──
    markers.forEach((m, i) => {
      const q = (s.markers ?? [])[i];
      m.visible = s.mode === 'walk' && Boolean(q) && Math.hypot(q.x - h.x, q.z - h.z) > 6;
      if (!m.visible) return;
      m.position.set(q.x, height(q.x, q.z) + 3.4 + Math.sin(t * 2 + i) * 0.15, q.z);
      m.children[0].rotation.y = t * 1.5;
    });
    const near = s.near ? SPOTS.find((x) => x.id === s.near) : null;
    hereRing.visible = Boolean(near) && s.mode === 'walk';
    if (near) {
      hereRing.position.set(near.x, height(near.x, near.z) + 0.06, near.z);
      hereRing.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    }

    // ── smoke from the chimneys, and the inn's fire ──
    A.smoke += dt;
    if (!inside && A.smoke > 0.4 / Math.max(0.4, many)) {
      A.smoke = 0;
      for (const c of chimneys) if (c.distanceToSquared(camera.position) < 60 * 60) fx.chimney(c);
    }
    if (inside) {
      A.flame += dt;
      while (A.flame > 0.03) {
        A.flame -= 0.03;
        fx.flame(inn.fireAt, 0.6);
      }
    }
    fx.step(dt, t, { night: 0, day: 0 });

    // ── the camera ──
    let camAt;
    let camLook;
    outdoors.visible = !inside;
    inn.group.visible = inside;
    if (inside) {
      const c = inn.update(s.beat ?? 'room', t, dt, { stepT: s.stepT, pour: s.pour, ringOn: s.wearing, song: s.song, dawn: s.sky === 'dawn' });
      camAt = c.at;
      camLook = c.look;
    } else if (s.mode === 'talk' && s.talking === 'gate') {
      // at the gate, over Frodo's head, on the hatch and the face in it:
      // aimed under it, so the hatch sits high and clear of the talk panel
      camAt = tmp.copy(hatchAt).addScaledVector(gateOut, 4.8).addScaledVector(gateAlong, 0.7);
      camAt.y += 0.55;
      camLook = look.copy(hatchAt);
      camLook.y -= 0.9;
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.36;
      const dist = s.camDist ?? 6.4;
      look.set(h.x, hy + 1.15, h.z);
      camAt = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, hy + 1.15 + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      let k = clearance(look, camAt);
      // and which way round the camera would have more room, for the
      // component to swing it to while nobody's steering it
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
      if (k < 0.55) {
        // backed up against a wall: look down from higher instead
        const high = tmp2.set(h.x + Math.sin(yaw) * Math.cos(0.8) * dist, hy + 1.15 + Math.sin(0.8) * dist, h.z + Math.cos(yaw) * Math.cos(0.8) * dist);
        const kh = clearance(look, high);
        if (kh > k) {
          camAt.copy(high);
          k = kh;
        }
      }
      if (k < 1) camAt.lerpVectors(look, camAt, k);
      const floor = height(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode || A.beat !== s.beat;
    A.mode = s.mode;
    A.beat = s.beat;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' ? 8 : 2.5));
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
    rain.update(camera, t, inside ? 0 : wet, frodo.group.position);
    sun.position.copy(frodo.group.position).addScaledVector(sunDir, 70);
    sun.target.position.copy(frodo.group.position);
    ground.update();
    renderer.info.reset();
    stage.render(ms / fast); // (the real frame time, however fast the QA runs the clock)
  };

  // ── events ──
  const fxEvent = (type) => {
    if (type === 'caught') A.shake = 0.3;
    else if (type === 'seen') A.shake = Math.max(A.shake, 0.08);
    else if (type === 'good') fx.pop(tmp2.copy(INN).add(V(1.8, 1.5, -2.5)), 'gold', 22, 1.4);
    else if (type === 'spilt') fx.puff(tmp2.copy(INN).add(V(1.8, 1.48, -2.5)), V(0, 0.2, 0.4), 8);
    else if (type === 'slip') A.shake = 0.12;
    else if (type === 'gate') A.shake = 0.05;
  };

  // Where someone is on screen, for the speech bubbles: { x, y } in CSS
  // pixels of the canvas, or null when they're behind the camera.
  const screenOf = (kind, id) => {
    let p = null;
    if (kind === 'inn') p = inn.headOf(id);
    else if (kind === 'cast' && id === 'harry' && !people.harry.group.visible) p = tmp.copy(hatchAt).add(tmp2.set(0, 0.45, 0));
    else if (kind === 'cast' && id === 'strider' && striderNight.group.visible) p = tmp.copy(striderNight.group.position).add(tmp2.set(0, striderNight.top + 0.25, 0));
    else if (kind === 'cast' && people[id]) p = tmp.copy(people[id].group.position).add(tmp2.set(0, (people[id].top ?? 1.8) + 0.25, 0));
    else if (kind === 'frodo') p = tmp.copy(frodo.group.position).add(tmp2.set(0, 2.0, 0));
    if (!p) return null;
    p = p.clone().project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };

  // ── the floor's light, baked when the town is first drawn ──
  const ground = groundTown({ renderer, scene, terrain, outdoors, sun, height, people: movers, skip: [sky.dome, ghosts.group, puddles.mesh], tier, radius: WORLD.radius + 10, shade: 0x262a30, matcap: [rimTrees] });
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
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
    // a yaw with more room behind the walker, when the camera's boxed in
    get suggestYaw() {
      return A.suggest ?? null;
    },
    dispose() {
      ground.dispose();
      ghosts.dispose();
      disposeTree(inn.group);
      stage.dispose();
    },
  };
}

// What the camera can't go through, with how high each stands: the
// buildings, the trees' trunks, the stockade and the banks.
const BLOCKERS = COLLIDERS.filter((c) => !c.low).map((c) => ({ ...c, y: height(c.x, c.z) + (c.top ?? 4) }));
const WALL_TOP = 4.8;
function insideAt(x, y, z) {
  for (const c of BLOCKERS) {
    if (y > c.y) continue;
    if (c.kind === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + 0.25) return true;
    } else if (boxDist(c, x, z) < 0.25) return true;
  }
  for (const [x0, z0, x1, z1, thick] of [...STOCKADE, ...BANKS]) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < thick + 0.35 && y < height(x, z) + (thick > 0.5 ? 1.6 : WALL_TOP)) return true;
  }
  return false;
}
// how far from `from` to `to` the camera can go before it's inside
// something, as a fraction
function clearance(from, to) {
  const N = 14;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    if (insideAt(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k)) return Math.max(0.18, (i - 1) / N);
  }
  return 1;
}
