// Minas Tirith, in WebGL: the white city of seven levels on the knee of
// Mount Mindolluin, over the green Pelennor, with the Mountains of Shadow
// dark across the river; the road up through its gates on Shadowfax; the
// Citadel and the White Tree; the hall of the kings; the beacon on its ledge
// and the chain of fires away to Rohan; the siege by night; and the morning
// the tree flowered. Made in code (./props.js, ./folk.js, ../ground.js), so
// nothing is downloaded.
//
// Two places, drawn apart in one scene (the city with all its land, and the
// hall of the kings), and only the one you're in is shown. It draws what
// the component hands it and decides nothing.
//
// createMinasWorld(canvas) returns { render(state, ms, fast), fx(type),
// resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { createHouse } from '../../../../lib/three/house';
import { dress, rolesFor } from '../../../../lib/three/core';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { EMBER, FIRE, SMOKE, createParticles } from '../../kit';
import { sit } from '../../shire/people';
import { lookFrom, makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { makeTerrain } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { createGhosts } from '../ghosts';
import { gallop } from '../weathertop/props';
import { createMinasKit } from './props';
import { createMinasFolk } from './folk';
import { RIDE, SIEGE, rangeOf } from './rules';
import {
  ARAGORN,
  BEACONS,
  BEREGOND,
  CHAIR,
  COURT_IN,
  COURT_Y,
  DENETHOR,
  FOUNTAIN,
  FRIENDS,
  GUARDS,
  HALL_HOUSE,
  HOST,
  LANES,
  LEDGE,
  LEVEL_Y,
  OVERLOOK,
  PILE,
  SIEGE_AT,
  SPAN,
  TOMATOES,
  TOWER,
  TREBUCHETS,
  TREE,
  WALL_R,
  besideRoad,
  clearView,
  faceTo,
  inHall,
  ledgeAt,
  roadAt,
  towerX,
} from './layout';
import { attend, castDo, castPlay, releaseCast, tickCast } from '../../cast3d';
import { turn as easeYaw } from '../../../../lib/three/gait';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// where each place is drawn
const AT = { city: V(0, 0, 0), hall: V(0, -900, 0) };

// ── the light of each place, and each time of day ──
const MOODS = {
  ride: { top: 0x5c86c4, horizon: 0xe6dccb, sun: [0.7, 0.42, 0.25], sunColour: 0xfff0d8, sunPower: 2.8, hemiSky: 0xc4d4ec, hemiGround: 0x7a6a50, hemi: 1.35, fog: 0xc4ccd8, fogNear: 260, fogFar: 2600, cloud: 0.35, cloudColour: 0xf4f0ea, stars: 0, exposure: 1.1 },
  court: { top: 0x5078b8, horizon: 0xeed6ae, sun: [-0.35, 0.45, 0.55], sunColour: 0xffdcae, sunPower: 2.6, hemiSky: 0xc8d2e6, hemiGround: 0x8a7258, hemi: 1.35, fog: 0xd6ccbc, fogNear: 260, fogFar: 2600, cloud: 0.4, cloudColour: 0xfbefe0, stars: 0, exposure: 1.1 },
  hall: { top: 0x06080c, horizon: 0x0c0e12, sun: [-0.3, 0.8, 0.4], sunColour: 0xc4d2ea, sunPower: 1.4, hemiSky: 0x7a8498, hemiGround: 0x2a2620, hemi: 1.1, fog: 0x0e1014, fogNear: 30, fogFar: 140, cloud: 0, cloudColour: 0x000000, stars: 0, exposure: 1.45 },
  beacon: { top: 0x18224a, horizon: 0xd0784a, sun: [-0.85, 0.07, -0.25], sunColour: 0xff9a62, sunPower: 1.5, hemiSky: 0x6a7aa8, hemiGround: 0x4a3a3a, hemi: 1.55, fog: 0x5a5068, fogNear: 260, fogFar: 2800, cloud: 0.45, cloudColour: 0xb07a6a, stars: 0.25, exposure: 1.5 },
  chain: { top: 0x0a1030, horizon: 0x7a4048, sun: [-0.9, 0.02, -0.3], sunColour: 0xd06a48, sunPower: 0.8, hemiSky: 0x3a4668, hemiGround: 0x241a1e, hemi: 0.9, fog: 0x2a2838, fogNear: 600, fogFar: 4200, cloud: 0.3, cloudColour: 0x5a3a4a, stars: 0.7, exposure: 1.45 },
  walls: { top: 0x0a0505, horizon: 0x6a200c, sun: [0.3, 0.35, 0.25], sunColour: 0x9aa6c8, sunPower: 1.1, hemiSky: 0x5a4450, hemiGround: 0x8a3410, hemi: 1.7, fog: 0x2e1408, fogNear: 140, fogFar: 1500, cloud: 0.85, cloudColour: 0x3a1006, stars: 0, exposure: 1.8 },
  dawn: { top: 0x2a3a64, horizon: 0xf0a868, sun: [0.85, 0.08, -0.2], sunColour: 0xffc890, sunPower: 2, hemiSky: 0x8a90b0, hemiGround: 0x5a3a28, hemi: 1.2, fog: 0x9a8a8a, fogNear: 200, fogFar: 2400, cloud: 0.5, cloudColour: 0xf0b890, stars: 0, exposure: 1.25 },
  day: { top: 0x4a7ed0, horizon: 0xf2ecde, sun: [0.45, 0.75, 0.35], sunColour: 0xfff6e6, sunPower: 3, hemiSky: 0xd6e4fa, hemiGround: 0x8a7a60, hemi: 1.55, fog: 0xd8e2ec, fogNear: 400, fogFar: 3200, cloud: 0.25, cloudColour: 0xffffff, stars: 0, exposure: 1.05 },
};
const COLOURS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour'];
const NUMBERS = ['sunPower', 'hemi', 'fogNear', 'fogFar', 'cloud', 'stars', 'exposure'];

// ── the land: the Pelennor, the mountain behind the city, the range to Rohan ──
const noise = makeNoise(97);
// the level a radius out from the city's middle falls on (-1 outside the first wall)
const ringOf = (r) => {
  if (r <= WALL_R[6]) return 6;
  for (let k = 5; k >= 0; k--) if (r <= WALL_R[k]) return k;
  return -1;
};
// the range from behind the city away north-west to Rohan: how far from its spine
const RANGE = [
  [-120, -220],
  [-2400, -1240],
];
function fromRange(x, z) {
  const [[ax, az], [bx, bz]] = RANGE;
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * k, z - az - dz * k);
}
function landHeight(x, z) {
  const r = Math.hypot(x, z);
  const a = Math.abs(Math.atan2(z, x));
  const rough = fbm(noise, x * 0.004, z * 0.004, { octaves: 4 });
  // Mindolluin, behind, and the White Mountains running away north-west
  let h = 640 * smooth(30, -820, x) * (0.7 + 0.6 * rough) * (0.55 + 0.45 * Math.exp(-((z / 900) ** 2)));
  h = Math.max(h, 360 * Math.exp(-((fromRange(x, z) / 300) ** 2)) * (0.6 + 0.8 * rough) * smooth(-40, -420, x));
  // the knee of the mountain the city is built on: behind the ends of each
  // level the rock stands over it, rising round the back
  const behind = smooth(SPAN - 0.02, SPAN + 0.2, a);
  if (behind > 0 && r < WALL_R[0] + 90) {
    const k = ringOf(r);
    const top = (k >= 0 ? LEVEL_Y[k] : 0) + 9 + (a - SPAN) * 72;
    h = Math.max(h, top * behind * smooth(WALL_R[0] + 90, WALL_R[0] + 20, r));
  }
  // in the city: flat under its levels (they stand on their own)
  if (ringOf(r) >= 0 && behind <= 0) h = 0;
  // the Citadel's round, over the mountain behind
  if (r <= WALL_R[6] + 1.5) h = Math.min(h, COURT_Y - 1);
  // the ledge of the beacon: cut into the mountain, the cliff above it and
  // the slope falling away below it towards the Citadel
  {
    const zm = LEDGE.z0 - LEDGE.len / 2;
    const along = 1 - smooth(LEDGE.len / 2 + 2, LEDGE.len / 2 + 9, Math.abs(z - zm));
    if (along > 0 && x > LEDGE.x - 40 && x < LEDGE.x + 24) {
      // (the flat cut is wider than the ledge, and a little under it, so it
      // survives the ground's own cells, which are wider than the ledge)
      const west = LEDGE.w / 2 + 11;
      const east = LEDGE.w / 2 + 8;
      let cut = h;
      if (x < LEDGE.x - west) cut = Math.max(h, LEDGE.y + 2 + (LEDGE.x - west - x) * 2.6);
      else if (x <= LEDGE.x + east) cut = LEDGE.y - 1.6;
      else cut = Math.min(h, LEDGE.y - 1.6 - (x - LEDGE.x - east) * 1.7);
      h += (cut - h) * along;
    }
  }
  // the Pelennor: a little roll to it; and the Anduin, far off east
  if (x > WALL_R[0]) {
    h += (fbm(noise, x * 0.01, z * 0.01, { octaves: 3 }) - 0.5) * 3 * smooth(WALL_R[0] + 10, WALL_R[0] + 80, r);
    h -= 6 * Math.exp(-(((x - 1040 - Math.sin(z * 0.004) * 60) / 34) ** 2));
  }
  // the causeway to the Great Gate stands on level ground
  if (Math.abs(z) < 9 && x > WALL_R[0] && x < 250) h *= smooth(0, 9, Math.abs(z)) * 0.6 + 0.4 * smooth(4, 9, Math.abs(z));
  return h;
}
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const FIELD = C(0x6a8a3a);
const GOLD = C(0xb0a050);
const DIRT = C(0x8a7a5a);
const ROCK = C(0x8a8680);
const DARK = C(0x5a5652);
const SNOW = C(0xf0f2f6);
const RIVER = C(0x3a5a6a);
function landPaint(x, z, h, out) {
  const fields = fbm(noise, x * 0.012, z * 0.012, { octaves: 2 });
  const strip = Math.sin(x * 0.05 + fbm(noise, x * 0.003, z * 0.003) * 9) * 0.5 + 0.5;
  for (let i = 0; i < 3; i++) out[i] = FIELD[i] + (GOLD[i] - FIELD[i]) * smooth(0.45, 0.62, fields) * strip;
  // tracks across the field, and the trodden ground by the walls
  const near = 1 - smooth(WALL_R[0] + 6, WALL_R[0] + 40, Math.hypot(x, z));
  for (let i = 0; i < 3; i++) out[i] += (DIRT[i] - out[i]) * Math.max(near * 0.7, Math.abs(z) < 8 && x > 0 ? 0.8 : 0);
  // rock up the mountain, darker in its folds; snow on the heights
  const rock = smooth(14, 60, h);
  const fold = fbm(noise, x * 0.03, z * 0.03, { octaves: 3 });
  for (let i = 0; i < 3; i++) out[i] += (ROCK[i] + (DARK[i] - ROCK[i]) * fold - out[i]) * rock;
  const snow = smooth(380, 470, h + (fold - 0.5) * 60);
  for (let i = 0; i < 3; i++) out[i] += (SNOW[i] - out[i]) * snow;
  // the river
  const wet = Math.exp(-(((x - 1040 - Math.sin(z * 0.004) * 60) / 30) ** 2));
  for (let i = 0; i < 3; i++) out[i] += (RIVER[i] - out[i]) * wet;
  return out;
}
// The ground as one mesh, denser near the city than far off: a grid `seg`
// squares a side over [-1, 1], pulled out to `half` metres with most of its
// rows near the middle.
const WARP = { half: 3200, lin: 0.22 };
const warp = (u) => Math.sign(u) * WARP.half * (WARP.lin * Math.abs(u) + (1 - WARP.lin) * Math.abs(u) ** 3);
function makeLand(renderer, seg) {
  const mesh = makeTerrain(renderer, { size: 2, seg, height: (u, v) => landHeight(warp(u), warp(v)), paint: (u, v, h, out) => landPaint(warp(u), warp(v), h, out), blades: 0.2 });
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, warp(p.getX(i)), p.getY(i), warp(p.getZ(i)));
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
  return mesh;
}

export function createMinasWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 50, near: 0.1, far: 6000, bloom: { strength: 0.7, radius: 0.5, threshold: 0.85 }, onLost });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; it follows the moods below
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0xc4ccd8, 260, 2600);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0xc4d4ec, 0x7a6a50, 1);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 4 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 16, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(5600);
  scene.add(sky.dome);

  const kit = createMinasKit(renderer, { tier });
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(kit.mats ?? {}, rolesFor(kit.mats ?? {}), { strength: 0.3, normal: 0.6, keep: true });
  const folk = createMinasFolk(renderer, { tier });
  const zones = { city: new THREE.Group(), hall: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);

  // ── the city and its land ──
  const land = makeLand(renderer, tier === 'high' ? 300 : tier === 'mid' ? 230 : 170);
  zones.city.add(land);
  const city = kit.city();
  zones.city.add(city.group);
  // the streets and the court are the city's floor too, with the land: its
  // light is baked on them (../grounded.js)
  const streets = [];
  city.group.traverse((o) => o.isMesh && (o.material === kit.mats.paving || o.material === kit.mats.court) && streets.push(o));
  const ledge = kit.ledge();
  zones.city.add(ledge.group);
  zones.city.add(kit.shadow().group);
  const tree = kit.tree();
  tree.group.position.set(TREE.x, COURT_Y, TREE.z);
  zones.city.add(tree.group);
  const cityLamps = city.lamps.map((p) => p.clone().add(AT.city));
  const hallKit = kit.hall();
  zones.hall.add(hallKit.group);
  const hallLamps = hallKit.lamps.map((p) => p.clone().add(AT.hall));
  // the river: a strip of water down the far side of the field
  {
    const geo = new THREE.PlaneGeometry(90, 6000, 1, 60).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + 1040 + Math.sin(p.getZ(i) * 0.004) * 60);
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.18, metalness: 0.4 }));
    water.position.y = -2.2;
    zones.city.add(water);
  }

  // the engines on the first wall
  const trebs = TREBUCHETS.map((t) => {
    const e = folk.trebuchet();
    e.group.position.set(t.x, LEVEL_Y[0], t.z);
    e.group.rotation.y = t.face;
    zones.city.add(e.group);
    return { ...e, k: 0, at: t, throw: -1, from: null };
  });
  // the arm swings through in THROW s; the stone leaves the sling at
  // e.release, which is RELEASE of the way through the rules' flight
  const THROW = 0.7;
  // the host of Mordor, encamped on the field, and its siege-towers
  const hostMesh = (() => {
    const { geometry, material } = folk.host();
    const n = Math.round(2400 * many);
    const m = new THREE.InstancedMesh(geometry, material, n);
    const o = new THREE.Object3D();
    const rnd = makeNoise(31);
    for (let i = 0; i < n; i++) {
      // in blocks, with lanes between them
      const bx = HOST.x0 + ((i * 7.31) % (HOST.x1 - HOST.x0));
      const bz = HOST.z0 + ((i * 13.77) % (HOST.z1 - HOST.z0));
      const x = bx + rnd(i, 1) * 2;
      const z = bz + rnd(i, 2) * 2;
      o.position.set(x, landHeight(x, z), z);
      o.rotation.set(0, Math.PI + rnd(i, 3) * 0.3, 0);
      o.scale.setScalar(1.15);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.frustumCulled = false;
    m.visible = false;
    zones.city.add(m);
    return m;
  })();
  const TOWERS = 8;
  const towers = Array.from({ length: TOWERS }, () => {
    const w = folk.siegeTower();
    w.group.visible = false;
    zones.city.add(w.group);
    return { ...w, fall: 0, i: -1 };
  });
  const stones = Array.from({ length: 4 }, () => {
    const m = folk.stone();
    m.visible = false;
    scene.add(m);
    return m;
  });
  const fireballs = Array.from({ length: 5 }, () => {
    const m = folk.fireball();
    m.visible = false;
    scene.add(m);
    return { m, t: -1, from: V(), to: V(), dur: 2 };
  });
  const beasts = [0, 1].map(() => {
    const b = folk.fellBeast();
    b.group.visible = false;
    b.group.scale.setScalar(0.9);
    scene.add(b.group);
    return b;
  });
  // the range the engines are laid to: a line of light across the field
  const rangeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.6), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const rangeLine = new THREE.Mesh(new THREE.PlaneGeometry(3, LANES[4] - LANES[0] + 70).rotateX(-Math.PI / 2), rangeMat);
  rangeLine.visible = false;
  zones.city.add(rangeLine);

  // ── people ──
  // (each stands on a soft blob slid away from the sun, and dims in the
  // baked shade: ../grounded.js)
  const movers = [];
  const blob = (f) => {
    movers.push({ object: f.group, size: [FIGURE * 1.1, FIGURE * 1.1] });
    f.group.visible = false;
    scene.add(f.group);
    return f;
  };
  const pippin = blob(folk.person('pippin'));
  const pippinGuard = blob(folk.person('pippin', { livery: true }));
  const gandalf = blob(folk.person('gandalf'));
  const beregond = blob(folk.person('beregond'));
  const denethor = blob(folk.person('denethor'));
  const aragorn = blob(folk.person('aragorn'));
  const friends = FRIENDS.map((f) => ({ ...f, fig: blob(folk.person(f.id)) }));
  const guards = GUARDS.map((g, i) => ({ ...g, fig: blob(folk.guard(i)) }));
  const keeper = blob(folk.guard(7));
  const wallGuards = [0, 1, 2, 3].map((i) => blob(folk.guard(10 + i)));
  const fax = folk.shadowfax();
  fax.group.visible = false;
  scene.add(fax.group);
  // Shadowfax under Gandalf, and the fell beasts (a blob only as they stoop low)
  movers.push({ object: fax.group, size: [1.2, 2.8] }, ...beasts.map((b) => ({ object: b.group, size: [5, 5] })));
  const ghosts = createGhosts({ make: () => folk.person('pippin'), tag: 0.42 });
  zones.city.add(ghosts.group);
  // what's in the way on the road up, made when a ride starts
  let things = [];
  let thingsOf = null;
  const clearThings = () => {
    for (const o of things) {
      o.obj.removeFromParent();
      o.obj.traverse((m) => m.geometry?.dispose?.());
    }
    things = [];
  };

  // ── fire and smoke ──
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const flames = createParticles(Math.round(420 * Math.max(0.4, many)), { ramp: FIRE, additive: true, gravity: 1.6, drag: 1, swirl: 0.6 });
  const embers = createParticles(Math.round(260 * Math.max(0.4, many)), { ramp: EMBER, additive: true, gravity: 0.8, drag: 0.6, swirl: 0.9 });
  const smoke = createParticles(Math.round(300 * Math.max(0.4, many)), { ramp: SMOKE, additive: false, gravity: 1.1, drag: 0.3, swirl: 0.4 });
  const dust = createParticles(Math.round(200 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.75, 0.7, 0.62, 0],
      [0.15, 0.7, 0.66, 0.58, 0.7],
      [1, 0.5, 0.48, 0.44, 0],
    ],
    additive: false,
    gravity: 0.6,
    drag: 0.9,
  });
  const petals = createParticles(Math.round(160 * Math.max(0.4, many)), {
    ramp: [
      [0, 1.6, 1.6, 1.6, 0],
      [0.15, 1.5, 1.5, 1.5, 0.95],
      [1, 1.3, 1.3, 1.3, 0],
    ],
    additive: false,
    gravity: -0.35,
    drag: 1.4,
    swirl: 1.2,
  });
  const spray = createParticles(Math.round(90 * Math.max(0.4, many)), {
    ramp: [
      [0, 1.4, 1.5, 1.7, 0],
      [0.2, 1.2, 1.3, 1.5, 0.5],
      [1, 1, 1.1, 1.2, 0],
    ],
    additive: true,
    gravity: -4,
    drag: 0.3,
  });
  scene.add(flames.mesh, embers.mesh, smoke.mesh, dust.mesh, petals.mesh, spray.mesh);
  const fireCol = new THREE.Color(0xff9a48);
  const paleCol = new THREE.Color(0xd8e4ff);
  const beaconCol = new THREE.Color(0xff8a30);

  // ── state ──
  const cur = {};
  for (const k of COLOURS) cur[k] = new THREE.Color(MOODS.ride[k]);
  for (const k of NUMBERS) cur[k] = MOODS.ride[k];
  const sunDir = V(...MOODS.ride.sun).normalize();
  const A = { t: 0, cam: { at: V(260, 20, 0), look: V(0, 30, 0) }, mode: '', first: true, fov: 50, mood: '', shake: 0, knock: 0, loosed: 0, lit: 0, fires: 0, flames: 0, chain: -1, dread: 0, bloom: 0, fireT: 1, hornT: 0 };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const target = new THREE.Color();
  const fireAt = ledge.fireAt.clone().add(AT.city);
  // the beacons along the range: each on the highest ground near where it
  // should be, on the land as drawn (so the fire sits on the summit)
  const downRay = new THREE.Raycaster();
  land.updateMatrixWorld(true);
  const groundAt = (x, z) => {
    downRay.set(V(x, 3000, z), V(0, -1, 0));
    const hit = downRay.intersectObject(land, false)[0];
    return hit ? hit.point.y : landHeight(x, z);
  };
  const peakFires = BEACONS.map((b) => {
    let best = [b.x, -1e9, b.z];
    for (let dx = -180; dx <= 180; dx += 30) {
      for (let dz = -180; dz <= 180; dz += 30) {
        const h = landHeight(b.x + dx, b.z + dz);
        if (h > best[1]) best = [b.x + dx, h, b.z + dz];
      }
    }
    return V(best[0], groundAt(best[0], best[2]) + 2, best[2]).add(AT.city);
  });
  // a glow over each, seen from far off once it's lit
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,220,160,1)');
    g.addColorStop(0.35, 'rgba(255,140,50,0.55)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const peakGlows = peakFires.map((p) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.2, 1.4, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.copy(p).add(V(0, 6, 0));
    sp.scale.setScalar(0);
    scene.add(sp);
    return sp;
  });
  // the camera's flight along the beacons, from the ledge away north-west
  const CHAIN_T = 15;
  const CHAIN = new THREE.CatmullRomCurve3([
    fireAt.clone().add(V(22, 14, 18)),
    ...peakFires.map((p) => {
      // (south-east of each, and high: over the hills between)
      const x = p.x + 220;
      const z = p.z + 300;
      return V(x, Math.max(p.y + 150, groundAt(x, z) + 140), z);
    }),
  ]);
  const stand = (f, zone, x, y, z, face) => {
    f.group.visible = true;
    wpos(zone, x, y, z, f.group.position);
    f.group.rotation.set(0, face, 0);
    f.body.rotation.set(0, 0, 0);
    f.group.scale.setScalar(1);
    sit(f, false);
    if (f.blob) f.blob.visible = true;
    // (on the cast: what each does here is set after, frame by frame)
    castDo(f, { base: null, upper: null, look: null, crouch: false, seat: null });
  };
  // a figure kneeling (the crowning), on the cast: held low in a kneel, till it's let up
  const kneel = (f, on) => {
    if (!f.cast?.ready || Boolean(f.kneeling) === on) return;
    f.kneeling = on;
    if (on) castPlay(f, 'kneel.fix', { layer: 'full', at: 1.2, speed: 0.04, loop: true, fade: 0.4 });
    else f.cast.stop('full', 0.5);
  };
  const hideAll = () => {
    for (const f of [pippin, pippinGuard, gandalf, beregond, denethor, aragorn, keeper, ...wallGuards]) f.group.visible = false;
    for (const f of friends) f.fig.group.visible = false;
    for (const g of guards) g.fig.group.visible = false;
    fax.group.visible = false;
    for (const b of beasts) b.group.visible = false;
  };

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    kit.tick?.(t);
    folk.tick?.(t);
    sky.uniforms.uTime.value = t;
    const zone = s.zone;
    const shown = zone === 'hall' ? 'hall' : 'city';
    for (const [k, g] of Object.entries(zones)) g.visible = k === shown;
    const lights = [];
    const me = s.livery ? pippinGuard : pippin;
    const h = s.pippin;

    // ── the light ──
    const moodKey = shown === 'hall' ? 'hall' : s.mode === 'chain' || s.talking === 'lit' ? 'chain' : zone === 'beacon' ? 'beacon' : zone === 'walls' ? (s.talking === 'held' && s.line && s.line !== 'falls' ? 'dawn' : 'walls') : zone === 'ride' ? 'ride' : s.day ? 'day' : 'court';
    const mood = MOODS[moodKey];
    const cut = A.first || (A.mood !== moodKey && (A.mood === 'hall' || moodKey === 'hall'));
    const ease = cut ? 1 : Math.min(1, dt * 0.8);
    A.first = false;
    A.mood = moodKey;
    for (const k of COLOURS) cur[k].lerp(target.set(mood[k]), ease);
    for (const k of NUMBERS) cur[k] += (mood[k] - cur[k]) * ease;
    sunDir.lerp(tmp2.set(...mood.sun).normalize(), ease).normalize();
    const u = sky.uniforms;
    u.uTop.value.copy(cur.top);
    u.uHorizon.value.copy(cur.horizon);
    u.uSunColour.value.copy(cur.sunColour);
    u.uCloudColour.value.copy(cur.cloudColour);
    u.uCloud.value = cur.cloud;
    u.uStars.value = cur.stars;
    u.uMoon.value = moodKey === 'walls' ? 1 : 0;
    u.uSunDir.value.copy(sunDir);
    sun.color.copy(cur.sunColour);
    sun.intensity = cur.sunPower;
    hemi.color.copy(cur.hemiSky);
    hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = cur.hemi;
    scene.fog.color.copy(cur.fog);
    scene.fog.near = cur.fogNear;
    scene.fog.far = cur.fogFar;
    lookFrom(houseLook, { sky, sun, hemi, fog: scene.fog, renderer, exposure: cur.exposure });
    const night = moodKey === 'walls' || moodKey === 'chain' ? 1 : moodKey === 'beacon' ? 0.5 : 0;
    // windows lit, and the lanterns bright, after dusk
    if (kit.mats.house) kit.mats.house.emissiveIntensity = night;
    if (kit.mats.lampGlass) kit.mats.lampGlass.emissiveIntensity = 0.25 + night * 0.9;

    hideAll();
    hostMesh.visible = zone === 'walls';
    rangeLine.visible = false;
    for (const w of towers) w.group.visible = false;
    for (const st of stones) st.visible = false;
    // the tree: dead and white till the King comes back
    A.bloom += ((s.day ? 1 : 0) - A.bloom) * Math.min(1, dt * (s.talking === 'crown' ? 0.6 : 3));
    tree.set(A.bloom);
    // the beacon's pile: lit once it's lit
    ledge.pile.set(A.lit);

    // ── the city ──
    if (shown === 'city') {
      ghosts.update(zone === 'court' ? (s.travellers ?? []) : [], t, dt);
      // ride: Shadowfax up the road, Gandalf and Pippin on him
      if (zone === 'ride' && s.ride) {
        const r = s.ride;
        if (r.things !== thingsOf) {
          clearThings();
          thingsOf = r.things;
          things = r.things.map((o) => {
            const obj = folk.obstacle(o.kind);
            const p = besideRoad(o.s, o.lane * RIDE.lanes);
            obj.position.set(p.x, p.y, p.z);
            const face = p.face + (o.lane > 0 ? -0.3 : 0.3);
            obj.rotation.y = face;
            zones.city.add(obj);
            return { o, obj, tip: 0, face };
          });
        }
        for (const th of things) {
          if (th.o.hit) th.tip = Math.min(1, th.tip + dt * 3);
          th.obj.visible = Math.abs(th.o.s - r.s) < 160;
          if (!th.obj.visible) continue;
          // townsfolk scatter and hens flap off when he's into them; carts tip
          if (th.o.kind === 'hens') {
            th.obj.userData.peck?.(t + th.o.s);
            th.obj.position.y = roadAt(th.o.s).y + th.tip * Math.abs(Math.sin(t * 9)) * 0.5;
          } else if (th.o.kind === 'folk') {
            const figs = th.obj.userData.figures ?? [];
            if (figs.length && figs.every((f) => f.cast?.ready)) {
              // on the cast: talking together in the road till he's into
              // them, then they run for it, each off its own side (not spun)
              th.obj.rotation.y = th.face;
              th.ran = th.tip > 0 ? (th.ran ?? 0) + dt : 0;
              figs.forEach((f, j) => {
                f.home ??= f.group.position.clone();
                f.homeFace ??= f.group.rotation.y;
                const side = f.home.z < 0 ? -1 : 1;
                const away = Math.min(5, th.ran * th.ran * 2 + th.ran * 2.5);
                f.group.position.set(f.home.x + away * 0.45, f.home.y, f.home.z + side * away);
                f.group.rotation.y = th.ran > 0 ? easeYaw(f.group.rotation.y, Math.atan2(-side, 0.45), dt, 10) : f.homeFace;
                castDo(f, { look: th.ran > 0 ? null : figs[1 - j] ?? null, upper: th.ran > 0 ? 'wave.help' : null });
                pose(f, t + th.o.s, { moving: th.ran > 0, talk: th.ran > 0 ? 0 : 1 });
              });
            } else {
              for (const f of figs) pose(f, t + th.o.s, { moving: th.tip > 0, wave: th.tip > 0 ? 0 : 0.3 });
              th.obj.rotation.y = th.face + th.tip * 2.4;
            }
          } else th.obj.rotation.z = -th.tip * 0.9;
        }
        const p = besideRoad(r.s, r.lane * RIDE.lanes);
        fax.group.visible = true;
        wpos('city', p.x, p.y, p.z, fax.group.position);
        // he leans into the climb
        const ahead = roadAt(r.s + 2);
        const behind = roadAt(Math.max(0, r.s - 2));
        fax.group.rotation.set(0, p.face, Math.atan2(ahead.y - behind.y, 4) * 0.8);
        gallop(fax, t, r.v / RIDE.canter);
        A.knock = Math.max(0, A.knock - dt * 2);
        if (A.knock > 0) fax.group.rotation.z += Math.sin(t * 30) * 0.06 * A.knock;
        // dust from his hooves
        if (Math.random() < dt * r.v * 1.4) dust.emit(p.x + R(0.6), p.y + 0.2, p.z + R(0.6), R(0.6), 0.6 + Math.random() * 0.6, R(0.6), 0.9 + Math.random() * 0.5, 0.5, 1.6, 0.5);
      } else if (thingsOf) {
        clearThings();
        thingsOf = null;
      }

      // the court: Pippin walking, Beregond and the Guards by the tree
      if (zone === 'court') {
        const crowning = s.day;
        for (const g of guards) {
          stand(g.fig, 'city', g.x, COURT_Y, g.z, g.face);
          pose(g.fig, t + g.x, { moving: false });
          // (on the cast: the Guards of the Citadel stand still, but their eyes follow you by)
          castDo(g.fig, { look: h && Math.hypot(h.x - g.x, h.z - g.z) < 6 ? me : null });
        }
        if (!crowning && s.next === 'court') {
          stand(beregond, 'city', BEREGOND.x, COURT_Y, BEREGOND.z, BEREGOND.face);
          // (on the cast: his eyes on you and his body round over a moment; a toy faces you at once)
          if (beregond.cast?.ready) attend(beregond, h, s.talking === 'beregond' ? faceTo(BEREGOND.x, BEREGOND.z, h.x, h.z) : BEREGOND.face, dt, { who: me, near: s.talking === 'beregond' ? 30 : 5 });
          else if (s.talking === 'beregond') beregond.group.rotation.y = faceTo(BEREGOND.x, BEREGOND.z, h.x, h.z);
          pose(beregond, t + 3, { talk: s.speaker === 'beregond' ? 1 : 0 });
        }
        if (crowning) {
          stand(aragorn, 'city', ARAGORN.x, COURT_Y, ARAGORN.z, s.talking === 'crown' ? faceTo(ARAGORN.x, ARAGORN.z, h.x, h.z) : ARAGORN.face);
          pose(aragorn, t, { talk: s.speaker === 'aragorn' ? 1 : 0 });
          for (const f of friends) {
            stand(f.fig, 'city', f.x, COURT_Y, f.z, f.face);
            pose(f.fig, t + f.x * 2, {});
          }
          // and when he kneels, so do they all
          const kneeling = s.talking === 'crown' && (s.line === 'kneel' || s.line === 'none');
          for (const f of [aragorn, ...friends.map((x) => x.fig), ...guards.map((g) => g.fig)]) kneel(f, kneeling && !(f === aragorn && s.line !== 'kneel'));
          if (kneeling) {
            const k = s.line === 'kneel' ? 1 : 0.4;
            for (const f of [aragorn, ...friends.map((x) => x.fig), ...guards.map((g) => g.fig)]) {
              if (f === aragorn && s.line !== 'kneel') continue;
              f.body.position.y -= 0.18 * k;
              f.body.rotation.z = -0.3 * k;
            }
          }
          // petals off the tree
          if (Math.random() < dt * 22 * many) petals.emit(TREE.x + R(3.4), COURT_Y + 4 + Math.random() * 3, TREE.z + R(3.4), R(0.4), -0.1, R(0.4), 5 + Math.random() * 3, 0.12, 0.1, 1);
        }
        // arriving: Gandalf on Shadowfax, Pippin off him
        if (s.talking === 'arrive') {
          fax.group.visible = true;
          wpos('city', COURT_IN.x + 2.4, COURT_Y, COURT_IN.z + 1.8, fax.group.position);
          fax.group.rotation.set(0, COURT_IN.face, 0);
          gallop(fax, t, 0);
          fax.riders?.pippin && (fax.riders.pippin.visible = false);
        } else if (fax.riders?.pippin) fax.riders.pippin.visible = true;
        // the fountain
        if (Math.random() < dt * 30 * many) spray.emit(FOUNTAIN.x + R(0.15), COURT_Y + 1.6, FOUNTAIN.z + R(0.15), R(0.8), 2.4 + Math.random(), R(0.8), 0.7, 0.08, 0.04, 0.8);
        stand(me, 'city', h.x, COURT_Y, h.z, h.face);
        pose(me, t, { moving: (h.speed ?? 0) > 0.3, speed: Math.min(1.4, (h.speed ?? 0) / 3.4), talk: s.speaker === 'pippin' ? 1 : 0 });
      }

      // dusk, and the view from the point of the prow: Gandalf and Pippin looking east
      if (s.talking === 'dusk' || s.talking === 'view') {
        stand(me, 'city', OVERLOOK.x - 0.6, COURT_Y, OVERLOOK.z + 0.8, 0);
        pose(me, t, { talk: s.speaker === 'pippin' ? 1 : 0 });
        if (s.talking === 'dusk') {
          stand(gandalf, 'city', OVERLOOK.x - 0.4, COURT_Y, OVERLOOK.z - 1.2, 0.2);
          pose(gandalf, t + 1, { talk: s.speaker === 'gandalf' ? 1 : 0 });
          castDo(gandalf, { look: s.speaker === 'pippin' ? me : null });
          castDo(me, { look: s.speaker === 'gandalf' ? gandalf : null });
        }
      }

      // the beacon: along the ledge, the guard at his supper, up the pile
      if (zone === 'beacon' && s.talking !== 'dusk') {
        const n = s.sneak;
        const gs = ledge.guardSeat;
        stand(keeper, 'city', gs.x, gs.y, gs.z, -Math.PI / 2);
        sit(keeper, true);
        keeper.body.position.y = keeper.baseY - 0.32;
        const ph = n?.phase ?? 'eat';
        // (on the cast: at his supper, stirring the pot, or looking about him; drawn only)
        castDo(keeper, { seat: keeper.baseY - 0.32, upper: ph === 'eat' ? 'sit.drink' : ph === 'stir' ? 'interact' : 'look.around' });
        // his supper fire, by the stool
        const sup = wpos('city', gs.x + 0.9, gs.y + 0.3, gs.z + 0.7, tmp2);
        if (Math.random() < dt * 26 * Math.max(0.5, many)) flames.emit(sup.x + R(0.15), sup.y, sup.z + R(0.15), R(0.1), 0.7 + Math.random() * 0.4, R(0.1), 0.5, 0.35, 0.08, 1);
        lights.push([sup.clone(), fireCol, 7 + Math.sin(t * 13) * 0.8, 16]);
        keeper.head.rotation.z = ph === 'look' ? 0.25 : ph === 'stir' ? Math.sin(t * 9) * 0.1 : -0.35 + Math.sin(t * 4) * 0.05;
        keeper.head.rotation.y = ph === 'look' ? Math.sin(t * 0.9) * 0.4 : 0;
        keeper.arms[1].rotation.x = ph === 'eat' ? -1.2 + Math.sin(t * 5) * 0.25 : 0;
        if (n) {
          const sp = Math.min(n.s, PILE.s);
          const [lx, ly, lz] = ledgeAt(sp);
          const up = n.climb * PILE.top;
          const onPile = n.s >= PILE.s - 0.05;
          stand(me, 'city', lx + (onPile ? 0.2 : 0.4), ly + up, lz - (onPile ? 0.6 + n.climb * 0.9 : 0), Math.PI / 2);
          me.body.rotation.z = n.covered || (!n.moving && n.phase !== 'eat') ? -0.4 : 0;
          // (on the cast: crouched low while he's watched, eyes on the guard)
          castDo(me, { crouch: Boolean(n.covered || (!n.moving && n.phase !== 'eat')), look: keeper });
          if (onPile && n.climb > 0) {
            me.arms[0].rotation.x = -2.6;
            me.arms[1].rotation.x = -2.6 + Math.sin(t * 8) * 0.4;
          }
          pose(me, t, { moving: n.moving, speed: 0.7 });
          // the lamps of the city, below, catch him a little
          lights.push([wpos('city', lx + 3, ly + 2.5 + up, lz + 1.5, V()), paleCol, 3, 9]);
          if (onPile && n.climb > 0 && n.moving) {
            me.arms[0].rotation.z = -2.4 + Math.sin(t * 8) * 0.5;
            me.arms[1].rotation.z = -2.4 - Math.sin(t * 8) * 0.5;
          }
        }
      }
      // the beacon burning (from when it's lit, through the chain and after)
      if (A.lit > 0) {
        A.lit = Math.min(1, A.lit + dt * 0.5);
        A.fires += dt * 60 * Math.max(0.5, many) * A.lit;
        while (A.fires > 1) {
          A.fires -= 1;
          flames.emit(fireAt.x + R(1.4), fireAt.y + Math.random() * 1.2, fireAt.z + R(1.4), R(0.5), 3 + Math.random() * 3, R(0.5), 0.8 + Math.random() * 0.6, 2.4, 0.6, 1);
          if (Math.random() < 0.3) embers.emit(fireAt.x + R(1), fireAt.y + 2, fireAt.z + R(1), R(2), 5 + Math.random() * 4, R(2), 1.6, 0.3, 0.1, 1);
          if (Math.random() < 0.18) smoke.emit(fireAt.x + R(1), fireAt.y + 4, fireAt.z + R(1), R(0.6), 4, R(0.6), 4, 3, 9, 0.5);
        }
        lights.push([fireAt, beaconCol, 40 * A.lit, 60]);
      }
      // and the beacons away along the mountains, one after another
      if (A.chain >= 0) {
        const lit = Math.floor((A.chain / CHAIN_T) * (peakFires.length + 1.2));
        peakFires.forEach((p, i) => {
          const g = peakGlows[i];
          if (i >= lit) return g.scale.setScalar(0);
          g.scale.setScalar(Math.min(60, g.scale.x + dt * 80) * (1 + Math.sin(t * 13 + i) * 0.04));
          if (Math.random() < dt * 30 * Math.max(0.5, many)) flames.emit(p.x + R(4), p.y + Math.random() * 3, p.z + R(4), R(1), 9 + Math.random() * 6, R(1), 1.2 + Math.random(), 12, 3, 1);
          if (Math.random() < dt * 4) smoke.emit(p.x, p.y + 12, p.z, R(2), 6, R(2), 6, 10, 30, 0.4);
          return undefined;
        });
      }

      // the siege by night
      if (zone === 'walls') {
        const g = s.siege;
        stand(me, 'city', SIEGE_AT.x - 0.8, SIEGE_AT.y, SIEGE_AT.z, 0);
        pose(me, t, { talk: s.speaker === 'pippin' ? 1 : 0 });
        stand(gandalf, 'city', SIEGE_AT.x - 1.4, SIEGE_AT.y, SIEGE_AT.z - 2.2, 0.15);
        pose(gandalf, t + 2, { talk: s.speaker === 'gandalf' ? 1 : 0 });
        castDo(gandalf, { look: s.speaker === 'pippin' ? me : null });
        wallGuards.forEach((f, i) => {
          const a = 0.02 + i * 0.09 - (i > 1 ? 0.3 : 0);
          stand(f, 'city', Math.cos(a) * (WALL_R[0] - 1.6), LEVEL_Y[0], Math.sin(a) * (WALL_R[0] - 1.6), -a);
          pose(f, t + i, {});
        });
        // the engines: the arm swings through, the stone flies from the
        // sling, and then they wind it back down
        trebs.forEach((e) => {
          if (e.throw >= 0) {
            e.throw += dt;
            const was = e.k;
            e.k = e.throw < THROW ? e.throw / THROW : e.throw < THROW + 0.3 ? 1 : Math.max(0, 1 - (e.throw - THROW - 0.3) / 1.1);
            if (was < e.release && e.k >= e.release) e.from = e.stoneAt(V());
            if (e.throw > THROW + 1.4) {
              e.throw = -1;
              e.k = 0;
            }
          }
          e.set(e.k);
        });
        // the range across the field
        if (g && s.mode === 'siege') {
          rangeLine.visible = true;
          rangeLine.position.set(towerX(rangeOf(g.aim)), 1.6, (LANES[0] + LANES[4]) / 2);
          rangeMat.opacity = g.loaded ? 0.5 + Math.sin(t * 8) * 0.15 : 0.18;
          rangeMat.color.setRGB(g.dread > 0 ? 2.4 : 2.2, g.dread > 0 ? 0.8 : 1.7, g.dread > 0 ? 0.5 : 0.6);
        }
        // the towers coming on (a siege begun again starts its towers afresh)
        if (g && A.towersOf !== g.towers) {
          A.towersOf = g.towers;
          A.loosed = 0;
          for (const w of towers) {
            w.i = -1;
            w.fall = 0;
          }
        }
        (g?.towers ?? []).forEach((w, j) => {
          const slot = towers[w.i % TOWERS];
          if (!slot) return;
          slot.group.visible = true;
          const x = towerX(w.d);
          const z = LANES[w.lane];
          slot.group.position.set(x, landHeight(x, z), z);
          slot.group.rotation.y = Math.sin(t * 0.7 + j) * 0.02;
          if (slot.i !== w.i) {
            slot.i = w.i;
            slot.fall = 0;
          }
          if (w.state === 'fall') {
            const was = slot.fall;
            slot.fall = Math.min(1, slot.fall + dt * 0.7);
            if (was === 0) for (let i = 0; i < 40 * Math.max(0.5, many); i++) dust.emit(x + R(5), 2 + Math.random() * 14, z + R(5), R(3), 2 + Math.random() * 2, R(3), 2 + Math.random() * 2, 4, 10, 0.7);
          }
          slot.set(slot.fall);
          // torches on the towers
          if (w.state === 'on' && Math.random() < dt * 6 * many) flames.emit(x + R(1), 14 + Math.random() * 2, z + R(1), R(0.3), 1.6, R(0.3), 0.6, 0.8, 0.2, 1);
        });
        // the stones in the air, from the sling they left to where they come down
        const REL = (THROW * trebs[0].release) / SIEGE.flight;
        (g?.shots ?? []).forEach((sh) => {
          const e = trebs[sh.i % trebs.length];
          const st = stones[sh.i % stones.length];
          if (!st || !e || sh.k < REL) return;
          const from = e.from ?? tmp.set(e.at.x + 3, LEVEL_Y[0] + 12, e.at.z);
          let zt = e.at.z;
          let best = Infinity;
          for (const w of g.towers) {
            if (w.state !== 'on') continue;
            const off = Math.abs(w.d - sh.d);
            if (off < best) {
              best = off;
              zt = LANES[w.lane];
            }
          }
          const k = Math.min(1, (sh.k - REL) / (1 - REL));
          const tx = towerX(sh.d);
          st.visible = true;
          st.position.set(from.x + (tx - from.x) * k, from.y + (0.4 - from.y) * k + Math.sin(k * Math.PI) * 60, from.z + (zt - from.z) * k);
          st.rotation.set(t * 3, t * 2, 0);
        });
        // the host's fire thrown at the wall
        A.fireT -= dt;
        if (A.fireT <= 0) {
          A.fireT = 0.9 + Math.random() * 1.6;
          const fb = fireballs.find((b) => b.t < 0);
          if (fb) {
            fb.t = 0;
            fb.dur = 2.2 + Math.random() * 0.8;
            fb.from.set(HOST.x0 + 20 + Math.random() * 120, 4, LANES[0] + Math.random() * (LANES[4] - LANES[0]));
            const a = (Math.random() - 0.5) * 0.9;
            fb.to.set(Math.cos(a) * (WALL_R[0] + 1), 3 + Math.random() * 9, Math.sin(a) * (WALL_R[0] + 1));
          }
        }
        for (const fb of fireballs) {
          if (fb.t < 0) {
            fb.m.visible = false;
            continue;
          }
          fb.t += dt / fb.dur;
          const k = Math.min(1, fb.t);
          fb.m.visible = true;
          fb.m.position.lerpVectors(fb.from, fb.to, k).add(AT.city);
          fb.m.position.y += Math.sin(k * Math.PI) * 60;
          if (Math.random() < dt * 40 * many) flames.emit(fb.m.position.x, fb.m.position.y, fb.m.position.z, R(1), R(1), R(1), 0.5, 2.2, 0.4, 1);
          if (fb.t >= 1) {
            for (let i = 0; i < 26 * Math.max(0.5, many); i++) flames.emit(fb.to.x + R(2), fb.to.y + R(2), fb.to.z + R(2), R(5), Math.random() * 5, R(5), 0.7, 2.6, 0.5, 1);
            for (let i = 0; i < 10 * Math.max(0.5, many); i++) smoke.emit(fb.to.x + R(2), fb.to.y, fb.to.z + R(2), R(1), 2, R(1), 3, 3, 8, 0.6);
            lights.push([fb.to.clone(), fireCol, 30, 50]);
            fb.t = -1;
            A.shake = Math.max(A.shake, 0.08);
          }
        }
        // fires burning over the field
        if (Math.random() < dt * 40 * many) {
          const x = HOST.x0 - 40 + Math.random() * 400;
          const z = HOST.z0 + Math.random() * (HOST.z1 - HOST.z0);
          flames.emit(x, landHeight(x, z) + 0.5, z, R(0.5), 2 + Math.random() * 2, R(0.5), 0.9, 3, 0.8, 0.8);
          if (Math.random() < 0.3) smoke.emit(x, 4, z, R(1), 3, R(1), 5, 5, 16, 0.4);
        }
        // the fell beasts, wheeling over; one stoops on the wall when it screams
        A.dread = Math.max(0, A.dread - dt * 0.5);
        beasts.forEach((b, i) => {
          b.group.visible = true;
          const th = t * (0.22 + i * 0.05) + i * 2.4;
          const stoop = i === 0 ? A.dread : 0;
          const rr = 120 + i * 40 - stoop * 60;
          const cx = WALL_R[0] + 100;
          const x = cx + Math.cos(th) * rr;
          const z = Math.sin(th) * rr * 0.8;
          const y = 80 + i * 20 + Math.sin(t * 0.8 + i) * 6 - stoop * 55;
          b.group.position.set(x, y, z);
          b.group.rotation.set(0, Math.atan2(-Math.cos(th) * 0.8, -Math.sin(th)) + Math.PI, Math.sin(th) * 0.2 + 0.3);
          b.animate?.(t, { flap: stoop > 0.2 ? 0.2 : 0.7 });
        });
        // torches along the wall
        const cam = camera.position;
        cityLamps
          .map((p) => [p, p.distanceToSquared(cam)])
          .sort((a, b) => a[1] - b[1])
          .slice(0, POOL - 2)
          .forEach(([p], i) => lights.push([p, fireCol, 6 + Math.sin(t * 9 + i) * 0.6, 18]));
      }

      // the city's lamps, lit after dusk (the court and the beacon)
      if (night > 0 && zone !== 'walls') {
        const cam = camera.position;
        cityLamps
          .map((p) => [p, p.distanceToSquared(cam)])
          .sort((a, b) => a[1] - b[1])
          .slice(0, POOL - 2)
          .forEach(([p], i) => lights.push([p, fireCol, (4 + Math.sin(t * 9 + i) * 0.4) * night, 16]));
      }
      if (night > 0) {
        A.flames += dt * 40 * night * Math.max(0.4, many);
        while (A.flames > 1) {
          A.flames -= 1;
          const p = cityLamps[Math.floor(Math.random() * cityLamps.length)];
          if (p && p.distanceToSquared(camera.position) < 200 * 200) flames.emit(p.x + R(0.08), p.y, p.z + R(0.08), 0, 0.5, 0, 0.4, 0.28, 0.05, 1);
        }
      }
    }

    // ── the hall of the kings ──
    if (shown === 'hall') {
      ghosts.update([], t, dt);
      // (on the cast: the Steward stays in his chair and looks at you; a toy turns the chair)
      stand(denethor, 'hall', CHAIR.x, 0.35, CHAIR.z, s.talking === 'denethor' && !denethor.cast?.ready ? faceTo(CHAIR.x, CHAIR.z, h.x, h.z) : DENETHOR.face);
      sit(denethor, true);
      denethor.body.position.y = denethor.baseY - 0.1;
      pose(denethor, t, { talk: s.speaker === 'denethor' ? 1 : 0 });
      sit(denethor, true);
      // at his supper, when you're near the dish
      if (s.talking === 'tomato') denethor.arms[1].rotation.x = -1.4 + Math.sin(t * 3) * 0.2;
      castDo(denethor, { seat: denethor.baseY - 0.1, upper: s.talking === 'tomato' ? 'sit.drink' : null, look: s.talking ? me : null });
      stand(me, 'hall', h.x, 0, h.z, h.face);
      pose(me, t, { moving: (h.speed ?? 0) > 0.3, speed: Math.min(1.4, (h.speed ?? 0) / 3.4), talk: s.speaker === 'pippin' ? 1 : 0 });
      // the braziers by the throne
      A.flames += dt * 24 * Math.max(0.4, many);
      while (A.flames > 1) {
        A.flames -= 1;
        const p = hallLamps[Math.floor(Math.random() * hallLamps.length)];
        if (p) flames.emit(p.x + R(0.2), p.y, p.z + R(0.2), R(0.1), 0.8 + Math.random() * 0.5, R(0.1), 0.5, 0.4, 0.08, 1);
      }
      const cam = camera.position;
      hallLamps
        .map((p) => [p, p.distanceToSquared(cam)])
        .sort((a, b) => a[1] - b[1])
        .slice(0, POOL - 1)
        .forEach(([p], i) => lights.push([p, fireCol, 5 + Math.sin(t * 11 + i) * 0.5, 16]));
      lights.push([wpos('hall', 0, 14, -16, V()), paleCol, 6, 40]);
    }

    flames.step(dt);
    embers.step(dt);
    smoke.step(dt);
    dust.step(dt);
    petals.step(dt);
    spray.step(dt);
    fx.step(dt, t, { night, day: 1 - night });

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
    let camAt = tmp.set(0, 0, 0);
    let camLook = look.set(0, 0, 0);
    let fov = 50;
    const P = (zoneName, x, y, z, out) => wpos(zoneName, x, y, z, out);
    if (zone === 'ride' && s.ride) {
      // behind Shadowfax, a little above, looking up the road
      const r = s.ride;
      const p = besideRoad(r.s, r.lane * RIDE.lanes * 0.5);
      // trailing him along the way he's going (smoothed over the road behind)
      // (before the start of the road, straight back along it)
      const back = r.s >= 8.5 ? roadAt(r.s - 8.5) : (() => {
        const a = roadAt(0);
        return { ...a, x: a.x - a.dx * (8.5 - r.s), z: a.z - a.dz * (8.5 - r.s) };
      })();
      const ahead = roadAt(r.s + 14);
      P('city', back.x * 0.85 + p.x * 0.15, Math.max(back.y, p.y) + 4.2, back.z * 0.85 + p.z * 0.15, camAt);
      P('city', ahead.x, ahead.y + 2.4, ahead.z, camLook);
      fov = 58 + Math.min(10, (r.v - RIDE.canter) * 1.2);
    } else if (s.mode === 'chain') {
      const k = Math.min(1, Math.max(0, A.chain) / CHAIN_T);
      const e = k * k * (3 - 2 * k);
      CHAIN.getPointAt(e, camAt);
      const i = Math.min(peakFires.length - 1, Math.floor(e * peakFires.length + 0.6));
      camLook.copy(peakFires[i]).add(V(0, 20, 0));
      fov = 46;
    } else if (s.talking === 'lit') {
      P('city', LEDGE.x + 10, LEDGE.y + 9, LEDGE.z0 - 20, camAt);
      camLook.copy(peakFires[2]).add(V(0, 40, 0));
      fov = 44;
    } else if (s.talking === 'dusk' || s.talking === 'view') {
      // behind them on the point of the prow, looking east to Mordor
      P('city', OVERLOOK.x - 8, COURT_Y + 3.4, OVERLOOK.z + 2.4, camAt);
      P('city', OVERLOOK.x + 60, COURT_Y - 8, OVERLOOK.z - 6, camLook);
      fov = 52;
    } else if (zone === 'beacon') {
      // from the air beside the ledge: Pippin, the rocks, and the guard beyond
      const n = s.sneak;
      const sp = n ? Math.min(n.s, PILE.s) : 0;
      const [, , lz] = ledgeAt(sp);
      const climb = n ? n.climb * PILE.top : 0;
      P('city', LEDGE.x + 7.5, LEDGE.y + 3.6 + climb * 0.6, lz + 4.5, camAt);
      P('city', LEDGE.x - 0.5, LEDGE.y + 1 + climb * 0.7, lz - 4, camLook);
      fov = 52;
      if (n && n.state === 'lit') {
        P('city', LEDGE.x + 34, LEDGE.y + 14, fireAt.z + 22, camAt);
        camLook.copy(fireAt).add(V(0, 4, 0));
      }
    } else if (zone === 'walls') {
      // on the wall behind the engines, out over the field
      if (s.talking === 'held' && s.line && s.line !== 'falls') {
        P('city', SIEGE_AT.x - 10, SIEGE_AT.y + 16, SIEGE_AT.z + 8, camAt);
        P('city', SIEGE_AT.x + 220, 10, SIEGE_AT.z - 260, camLook);
      } else if (s.talking === 'siege' && s.line === 'fires') {
        P('city', SIEGE_AT.x - 6, SIEGE_AT.y + 30, SIEGE_AT.z + 30, camAt);
        P('city', SIEGE_AT.x + 260, 0, SIEGE_AT.z - 10, camLook);
      } else {
        // along the wall walk behind him, over the parapet (no houses up here)
        const a = Math.atan2(SIEGE_AT.z, SIEGE_AT.x) + 7 / WALL_R[0];
        P('city', Math.cos(a) * (WALL_R[0] - 2.2), SIEGE_AT.y + 6.5, Math.sin(a) * (WALL_R[0] - 2.2), camAt);
        P('city', WALL_R[0] + 150, 0, 22, camLook);
      }
      fov = 54;
    } else if (s.talking && shown === 'city' && zone === 'court') {
      // a conversation in the court: the two of them, from the side
      const who = s.talking === 'arrive' ? { x: COURT_IN.x + 2.4, z: COURT_IN.z + 1.8, y: 2.2 } : s.talking === 'crown' ? { x: ARAGORN.x, z: ARAGORN.z, y: 1.6 } : { x: BEREGOND.x, z: BEREGOND.z, y: 1.6 };
      const mx = (h.x + who.x) / 2;
      const mz = (h.z + who.z) / 2;
      const dx = who.x - h.x;
      const dz = who.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      // (on whichever side is further from the tree and its guards)
      const sx = mx - dz / d;
      const sz = mz + dx / d;
      const side = Math.hypot(sx - TREE.x, sz - TREE.z) > Math.hypot(mx + dz / d - TREE.x, mz - dx / d - TREE.z) ? 1 : -1;
      P('city', mx - (dz / d) * 5.6 * side - (dx / d) * 1.2, COURT_Y + 2.3, mz + (dx / d) * 5.6 * side - (dz / d) * 1.2, camAt);
      P('city', mx, COURT_Y + who.y * 0.7, mz, camLook);
      if (s.talking === 'crown' && s.line === 'kneel') {
        P('city', TREE.x + 16, COURT_Y + 7, TREE.z + 10, camAt);
        P('city', TREE.x - 2, COURT_Y + 2, TREE.z, camLook);
      }
    } else if (s.talking && shown === 'hall') {
      const who = s.talking === 'tomato' ? TOMATOES : DENETHOR;
      const mx = (h.x + who.x) / 2;
      const mz = (h.z + who.z) / 2;
      P('hall', mx + 4.6, 2.6, mz + 2.2, camAt);
      P('hall', mx, 1.2, mz, camLook);
    } else if (s.mode === 'end') {
      P('city', TREE.x + 17, COURT_Y + 13, TREE.z + 15, camAt);
      P('city', TREE.x - 3, COURT_Y + 3, TREE.z, camLook);
    } else {
      // walking: behind, pulled in so nothing comes between
      const yaw = s.camYaw ?? 0;
      let pitch = s.camPitch ?? 0.3;
      const full = s.camDist ?? 6;
      let dist = full;
      const zoneName = shown;
      const baseY = shown === 'hall' ? 0 : COURT_Y;
      P(zoneName, h.x, baseY + 1.2, h.z, look);
      const lx = h.x;
      const lz = h.z;
      for (let d = dist; d > 1.6; d -= 0.3) {
        dist = d;
        const cx = lx + Math.sin(yaw) * Math.cos(pitch) * d;
        const cz = lz + Math.cos(yaw) * Math.cos(pitch) * d;
        const ok = shown === 'hall' ? inHall(cx, cz, 0.6) && clearView(lx, lz, cx, cz) : !(cx > HALL_HOUSE.x0 - 0.6 && cx < HALL_HOUSE.x1 + 0.6 && cz > HALL_HOUSE.z0 - 0.6 && cz < HALL_HOUSE.z1 + 0.6) && Math.hypot(cx - TOWER.x, cz - TOWER.z) > TOWER.r + 0.8;
        if (ok) break;
      }
      pitch = Math.min(1.2, pitch + (full - dist) * 0.08);
      camAt = P(zoneName, lx + Math.sin(yaw) * Math.cos(pitch) * dist, baseY + 1.2 + Math.sin(pitch) * dist, lz + Math.cos(yaw) * Math.cos(pitch) * dist, camAt);
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
      if (s.debugCam.fov) fov = s.debugCam.fov;
    }
    const key = `${shown}|${s.mode}|${s.talking ?? ''}|${zone}|${s.mode === 'chain' ? '' : (s.talking === 'crown' || s.talking === 'held' || s.talking === 'siege') ? s.line : ''}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'ride' || s.mode === 'sneak' || s.mode === 'chain';
    const ke = jump && s.mode !== 'chain' && !(s.talking === 'crown' || s.talking === 'held') ? 1 : Math.min(1, dt * (follow ? 6 : 1.6));
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
    sun.position.copy(camera.position).addScaledVector(sunDir, 120);
    sun.target.position.copy(camera.position);
    if (A.chain >= 0 && s.mode === 'chain') A.chain += dt;
    stage.grade({
      saturation: moodKey === 'walls' ? 0.86 : moodKey === 'hall' ? 0.8 : 0.96,
      contrast: 0.12,
      vignette: moodKey === 'walls' ? 0.45 : moodKey === 'hall' ? 0.42 : 0.28,
      grain: moodKey === 'walls' ? 0.04 : 0.015,
      shadow: moodKey === 'walls' ? [0.05, 0.01, 0] : [0, 0, 0.01],
      high: moodKey === 'day' ? [0.02, 0.015, 0] : [0, 0, 0],
    });
    ground.update();
    // the people on the cast (../../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type) => {
    if (type === 'knock') {
      A.knock = 1;
      A.shake = Math.max(A.shake, 0.12);
    } else if (type === 'lit') A.lit = Math.max(A.lit, 0.05);
    else if (type === 'chain') A.chain = 0;
    else if (type === 'unlit') {
      A.lit = 0;
      A.chain = -1;
    } else if (type === 'loose') {
      const e = trebs[(A.loosed ?? 0) % trebs.length];
      A.loosed = (A.loosed ?? 0) + 1;
      e.throw = 0;
      e.from = null;
      A.shake = Math.max(A.shake, 0.1);
    } else if (type === 'fall') A.shake = Math.max(A.shake, 0.25);
    else if (type === 'dread') {
      A.dread = 1;
      A.shake = Math.max(A.shake, 0.15);
    } else if (type === 'door') A.shake = Math.max(A.shake, 0.06);
  };

  // ── the floor's light, baked when the town is first drawn ──
  const ground = groundTown({ place: 'minastirith', renderer, scene, terrain: [land, ...streets], outdoors: zones.city, sun, height: null, people: movers, skip: [sky.dome, ghosts.group], tier, radius: WALL_R[0] + 25, shade: 0x34302a });
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    ground: import.meta.env.DEV ? ground : null, // for the QA scripts
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
      ground.dispose();
      clearThings();
      ghosts.dispose();
      disposeTree(scene);
      releaseCast(scene);
      stage.dispose();
    },
  };
}

