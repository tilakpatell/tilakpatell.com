// Edoras, in WebGL: the hill in the wind-swept plain of Rohan with the White
// Mountains behind, the stockade and the thatched halls, the great stair,
// and Meduseld, the Golden Hall, on the top; the barrows of the kings
// outside the gate, white with simbelmynë; the hall inside, dim and carved
// and smoky; the night watch for the beacon, and the host of Rohan riding
// out at dawn. Made in code (./props.js, ./folk.js, ../ground.js), so
// nothing is downloaded.
//
// Two places, drawn apart in one scene (the hill with all its land, and
// the hall inside), and only the one you're in is shown. It draws what the
// component hands it and decides nothing.
//
// createEdorasWorld(canvas) returns { render(state, ms, fast), fx(type),
// resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { EMBER, FIRE, SMOKE, createParticles } from '../../kit';
import { sit } from '../../shire/people';
import { makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { makeTerrain } from '../ground';
import { createGhosts } from '../ghosts';
import { gallop } from '../weathertop/props';
import { createEdorasKit } from './props';
import { createEdorasFolk } from './folk';
import { BRAWL } from './rules';
import { DAIS, DOOR_GUARDS, DOORS, FEAST, FLOWERS, GANDALF, GATE, GRAVE, GRIMA, HAMA, MEDUSELD, ROAD, THRONE, WATCH, clearView, faceTo, groundAt, hillHeight, inHall } from './layout';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// where each place is drawn
const AT = { hill: V(0, 0, 0), hall: V(0, -900, 0) };

// ── the light of each place, and each time of day ──
const MOODS = {
  day: { top: 0x6c88aa, horizon: 0xd2d6cc, sun: [-0.5, 0.55, 0.45], sunColour: 0xfff0d6, sunPower: 2.5, hemiSky: 0xc0ccd8, hemiGround: 0x7a7246, hemi: 1.4, fog: 0xbcc4c4, fogNear: 220, fogFar: 2600, cloud: 0.6, cloudColour: 0xeef0f2, stars: 0, exposure: 1.1 },
  evening: { top: 0x3a4a70, horizon: 0xe8a868, sun: [-0.9, 0.12, 0.2], sunColour: 0xffb070, sunPower: 2, hemiSky: 0x8a90a8, hemiGround: 0x5a4a30, hemi: 1.2, fog: 0xa89080, fogNear: 220, fogFar: 2400, cloud: 0.45, cloudColour: 0xf0b890, stars: 0.1, exposure: 1.2 },
  night: { top: 0x070b1c, horizon: 0x1e2a48, sun: [0.3, 0.5, -0.4], sunColour: 0x9aacd8, sunPower: 0.7, hemiSky: 0x3a4a78, hemiGround: 0x141820, hemi: 1.1, fog: 0x101830, fogNear: 300, fogFar: 3600, cloud: 0.2, cloudColour: 0x2a3450, stars: 1, exposure: 1.55 },
  dawn: { top: 0x3a5080, horizon: 0xf4b080, sun: [0.85, 0.1, -0.15], sunColour: 0xffc890, sunPower: 2.2, hemiSky: 0x9aa4c4, hemiGround: 0x6a5a3a, hemi: 1.3, fog: 0xc0a898, fogNear: 260, fogFar: 2800, cloud: 0.5, cloudColour: 0xf8c0a0, stars: 0, exposure: 1.15 },
  hall: { top: 0x080604, horizon: 0x100c08, sun: [-0.3, 0.8, 0.4], sunColour: 0xd8c8a8, sunPower: 0.9, hemiSky: 0x8a6a4a, hemiGround: 0x2a1a10, hemi: 0.95, fog: 0x1a120c, fogNear: 25, fogFar: 90, cloud: 0, cloudColour: 0x000000, stars: 0, exposure: 1.4 },
};
const COLOURS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour'];
const NUMBERS = ['sunPower', 'hemi', 'fogNear', 'fogFar', 'cloud', 'stars', 'exposure'];

// ── the land: the hill in the plain, grass everywhere, the mountains south ──
const noise = makeNoise(61);
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x7a8a40);
const GOLD = C(0xa89a52);
const DRY = C(0x8a7a48);
const ROCK = C(0x7a7670);
const SNOW = C(0xf0f2f6);
function landPaint(x, z, h, out) {
  const n = fbm(noise, x * 0.01, z * 0.01, { octaves: 3 });
  const streak = fbm(noise, x * 0.05 + 3, z * 0.012, { octaves: 2 });
  for (let i = 0; i < 3; i++) out[i] = GRASS[i] + (GOLD[i] - GRASS[i]) * smooth(0.4, 0.7, n) + (DRY[i] - GRASS[i]) * smooth(0.55, 0.8, streak) * 0.5;
  const rock = smooth(60, 160, h);
  for (let i = 0; i < 3; i++) out[i] += (ROCK[i] - out[i]) * rock;
  const snow = smooth(300, 380, h + (n - 0.5) * 60);
  for (let i = 0; i < 3; i++) out[i] += (SNOW[i] - out[i]) * snow;
  return out;
}
// The ground as one mesh, denser near the hill than far off
const WARP = { half: 3000, lin: 0.26 };
const warp = (u) => Math.sign(u) * WARP.half * (WARP.lin * Math.abs(u) + (1 - WARP.lin) * Math.abs(u) ** 3);
function makeLand(renderer, seg) {
  const mesh = makeTerrain(renderer, { size: 2, seg, height: (u, v) => hillHeight(warp(u), warp(v)), paint: (u, v, h, out) => landPaint(warp(u), warp(v), h, out), blades: 0.45 });
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, warp(p.getX(i)), p.getY(i), warp(p.getZ(i)));
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
  return mesh;
}
// the way out at dawn: the king from the gate, down the road between the
// barrows and away east; the host waits on the plain past the barrows, in two
// wings either side of the road, and moves off when he reaches it
const musterAt = (s) => ({ x: GATE.x + 14 + s, z: 0 });
const HOST = { front: ROAD.x0 + 110, lead: 30, lane: 7, row: 3.6, col: 2.6, wing: 22 };
const hostFront = (s) => Math.max(HOST.front, musterAt(s).x + HOST.lead);
// at the feast: the benches either side of the two tables (Gimli and Legolas
// have the south end of the right-hand one to themselves)
const SEATS = [
  [-7.6, -3.5, 0],
  [-5.6, -0.5, Math.PI],
  [-7.6, 3.5, 0],
  [-5.6, 6.5, Math.PI],
  [7.6, -2.5, Math.PI],
  [5.6, 1.5, 0],
];

export function createEdorasWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 50, near: 0.1, far: 6000, bloom: { strength: 0.6, radius: 0.5, threshold: 0.86 }, onLost });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0xbcc4c4, 220, 2600);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0xc0ccd8, 0x7a7246, 1);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 4 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(5000);
  scene.add(sky.dome);

  const kit = createEdorasKit(renderer, { tier });
  const folk = createEdorasFolk(renderer, { tier });
  const zones = { hill: new THREE.Group(), hall: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);

  // ── the hill ──
  zones.hill.add(makeLand(renderer, tier === 'high' ? 280 : tier === 'mid' ? 210 : 160));
  const town = kit.town();
  zones.hill.add(town.group);
  const barrows = kit.barrows();
  zones.hill.add(barrows.group);
  const peaks = kit.peaks();
  zones.hill.add(peaks.group);
  const townLamps = town.lamps.map((p) => p.clone().add(AT.hill));
  const peakFires = peaks.fires.map((p) => p.clone().add(AT.hill));
  // ── the hall ──
  const hall = kit.hall();
  zones.hall.add(hall.group);
  const hallLamps = hall.lamps.map((p) => p.clone().add(AT.hall));
  const hearth = hall.fire.clone().add(AT.hall);

  // ── people ──
  const blobGeo = new THREE.CircleGeometry(0.46, 20).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const add = (f) => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.position.y = 0.03;
    b.renderOrder = 1;
    f.group.add(b);
    f.blob = b;
    f.group.visible = false;
    scene.add(f.group);
    return f;
  };
  const gimli = add(folk.person('gimli', { axe: true }));
  const gimliBare = add(folk.person('gimli', { axe: false }));
  const legolas = add(folk.person('legolas'));
  const aragorn = add(folk.person('aragorn'));
  const gandalf = add(folk.person('gandalf'));
  const kingOld = add(folk.person('theoden', { freed: false }));
  const king = add(folk.person('theoden', { freed: true }));
  const grima = add(folk.person('grima'));
  const eowyn = add(folk.person('eowyn'));
  const hama = add(folk.person('hama'));
  const doorGuards = DOOR_GUARDS.map((g, i) => ({ ...g, f: add(folk.person('rider', { n: i })) }));
  const men = Array.from({ length: 8 }, (_, i) => add(folk.person('henchman', { n: i })));
  const feasters = Array.from({ length: 6 }, (_, i) => add(folk.person('rider', { n: 10 + i, helm: false, spear: false, shield: false })));
  const tankards = [folk.tankard(), folk.tankard()];
  gimli.arms[1].add(tankards[0]);
  gimliBare.arms[1].add(tankards[0].clone());
  legolas.arms[1].add(tankards[1]);
  for (const t of [tankards[0], tankards[1], gimliBare.arms[1].children.at(-1)]) {
    t.position.set(0.06, -0.38, 0.04);
    t.visible = false;
  }
  const bunch = folk.flowerBunch();
  bunch.position.set(0.05, -0.36, 0.05);
  bunch.visible = false;
  gimli.arms[0].add(bunch);
  const bunch2 = bunch.clone();
  gimliBare.arms[0].add(bunch2);
  const snowmane = folk.theodenHorse();
  snowmane.group.visible = false;
  scene.add(snowmane.group);
  const mounts = [0, 1, 2].map((n) => {
    const h = folk.horse({ n });
    h.group.visible = false;
    scene.add(h.group);
    return h;
  });
  // the host of Rohan, in a great block, moving out at dawn
  const hostKit = folk.host();
  const host = (() => {
    const { geometry, material } = hostKit;
    const n = Math.min(hostKit.count ?? 1000, Math.round(1000 * many));
    const m = new THREE.InstancedMesh(geometry, material, n);
    // a banner over every seventh rider, riding and waving with him
    const flags = new THREE.InstancedMesh(hostKit.banner.geometry, hostKit.banner.material, Math.ceil(n / 7));
    const o = new THREE.Object3D();
    const rnd = makeNoise(17);
    const cols = HOST.wing * 2;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const c = i % cols;
      const side = c < HOST.wing ? -1 : 1;
      o.position.set(-row * HOST.row + rnd(i, 1) * 1.2, 0, side * (HOST.lane + (c % HOST.wing) * HOST.col) + rnd(i, 2) * 0.9);
      o.rotation.set(0, rnd(i, 3) * 0.08, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (i % 7 === 3) flags.setMatrixAt((i - 3) / 7, o.matrix);
    }
    flags.count = Math.floor((n - 4) / 7) + 1;
    m.frustumCulled = flags.frustumCulled = false;
    m.add(flags);
    m.visible = false;
    scene.add(m);
    return m;
  })();
  const ghosts = createGhosts({ height: (x, z) => groundAt(x, z), make: () => folk.person('gimli', { axe: true }), tag: 0.42 });
  zones.hill.add(ghosts.group);

  // ── fire, smoke, flash ──
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const flames = createParticles(Math.round(300 * Math.max(0.4, many)), { ramp: FIRE, additive: true, gravity: 1.6, drag: 1, swirl: 0.6 });
  const embers = createParticles(Math.round(160 * Math.max(0.4, many)), { ramp: EMBER, additive: true, gravity: 0.8, drag: 0.6, swirl: 0.9 });
  const smoke = createParticles(Math.round(160 * Math.max(0.4, many)), { ramp: SMOKE, additive: false, gravity: 1, drag: 0.3, swirl: 0.4 });
  const dust = createParticles(Math.round(220 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.72, 0.68, 0.56, 0],
      [0.15, 0.68, 0.64, 0.52, 0.6],
      [1, 0.5, 0.46, 0.4, 0],
    ],
    additive: false,
    gravity: 0.4,
    drag: 0.8,
  });
  const light = createParticles(Math.round(120 * Math.max(0.4, many)), {
    ramp: [
      [0, 2.6, 2.7, 3, 0],
      [0.1, 2.4, 2.5, 2.9, 1],
      [1, 1.2, 1.3, 1.6, 0],
    ],
    additive: true,
    gravity: -0.4,
    drag: 1.2,
    swirl: 1,
  });
  scene.add(flames.mesh, embers.mesh, smoke.mesh, dust.mesh, light.mesh);
  const fireCol = new THREE.Color(0xff9a48);
  const whiteCol = new THREE.Color(0xe8eeff);

  // ── state ──
  const cur = {};
  for (const k of COLOURS) cur[k] = new THREE.Color(MOODS.day[k]);
  for (const k of NUMBERS) cur[k] = MOODS.day[k];
  const sunDir = V(...MOODS.day.sun).normalize();
  const A = { t: 0, cam: { at: V(260, 20, 0), look: V(0, 20, 0) }, mode: '', first: true, fov: 50, mood: '', day: 1, shake: 0, flash: 0, bashT: 0, beacon: 0, roll: 0 };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const target = new THREE.Color();
  const stand = (f, zone, x, z, face, y = null) => {
    f.group.visible = true;
    wpos(zone, x, y ?? (zone === 'hill' ? groundAt(x, z) : 0), z, f.group.position);
    f.group.rotation.set(0, face, 0);
    f.body.rotation.set(0, 0, 0);
    sit(f, false);
    if (f.blob) f.blob.visible = true;
  };
  const hideAll = () => {
    for (const f of [gimli, gimliBare, legolas, aragorn, gandalf, kingOld, king, grima, eowyn, hama, ...men, ...feasters]) f.group.visible = false;
    for (const g of doorGuards) g.f.group.visible = false;
    snowmane.group.visible = false;
    for (const m of mounts) m.group.visible = false;
    host.visible = false;
  };
  const knock = (f, k) => {
    if (folk.knock) return folk.knock(f, k);
    f.body.rotation.z = -1.4 * k;
    f.body.position.y = f.baseY - 0.5 * k;
    return undefined;
  };

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    kit.tick?.(t);
    folk.tick?.(t);
    sky.uniforms.uTime.value = t;
    const zone = s.zone;
    const shown = zone === 'hall' ? 'hall' : 'hill';
    for (const [k, g] of Object.entries(zones)) g.visible = k === shown;
    const lights = [];
    const me = s.axe ? gimli : gimliBare;
    const h = s.gimli;

    // ── the light ──
    const moodKey = shown === 'hall' ? 'hall' : s.time;
    const mood = MOODS[moodKey] ?? MOODS.day;
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
    u.uMoon.value = moodKey === 'night' ? 1 : 0;
    u.uSunDir.value.copy(sunDir);
    sun.color.copy(cur.sunColour);
    sun.intensity = cur.sunPower;
    hemi.color.copy(cur.hemiSky);
    hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = cur.hemi;
    scene.fog.color.copy(cur.fog);
    scene.fog.near = cur.fogNear;
    scene.fog.far = cur.fogFar;
    renderer.toneMappingExposure = cur.exposure;
    const night = moodKey === 'night' ? 1 : moodKey === 'evening' ? 0.4 : 0;
    // (the gold reflects a daytime sky: dim it after dark, and indoors)
    A.day += ((moodKey === 'hall' ? 0.35 : 1 - night * 0.8) - A.day) * ease;
    kit.daylight?.(A.day);
    hideAll();
    A.flash = Math.max(0, A.flash - dt * 1.5);
    A.bashT = Math.max(0, A.bashT - dt * 4);
    for (const tk of [...tankards, gimliBare.arms[1].children.at(-1)]) tk.visible = false;
    bunch.visible = bunch2.visible = (s.carrying ?? 0) > 0;
    // the picked flowers are gone from the barrows
    barrows.flowers.forEach((f, i) => (f.visible = !s.picked?.includes(i)));

    // ── on the hill ──
    if (shown === 'hill') {
      ghosts.update(s.mode === 'walk' ? (s.travellers ?? []) : [], t, dt);
      // Háma and the guards at the doors
      if (s.next === 'weapons' || s.finished || s.next === 'flowers') {
        stand(hama, 'hill', HAMA.x, HAMA.z, s.talking === 'door' ? faceTo(HAMA.x, HAMA.z, h.x, h.z) : HAMA.face);
        pose(hama, t, { talk: s.speaker === 'hama' ? 1 : 0 });
        for (const g of doorGuards) {
          stand(g.f, 'hill', g.x, g.z, g.face);
          pose(g.f, t + g.z, {});
        }
      }
      // the companions, with you at the doors
      if (s.talking === 'door') {
        stand(gandalf, 'hill', DOORS.x + 2.6, -1.2, Math.PI);
        stand(aragorn, 'hill', DOORS.x + 3.4, 1.4, Math.PI);
        stand(legolas, 'hill', DOORS.x + 4.4, -2.6, Math.PI);
        for (const f of [gandalf, aragorn, legolas]) pose(f, t + f.group.position.z, { talk: s.speaker === 'gandalf' && f === gandalf ? 1 : 0 });
      }
      // at the barrows: the king and Éowyn by Théodred's
      if (s.next === 'flowers') {
        stand(king, 'hill', GRAVE.x - 1.6, GRAVE.z + 1.2, faceTo(GRAVE.x - 1.6, GRAVE.z + 1.2, GRAVE.x, GRAVE.z - 3));
        stand(eowyn, 'hill', GRAVE.x - 3.2, GRAVE.z + 0.6, faceTo(GRAVE.x - 3.2, GRAVE.z + 0.6, GRAVE.x, GRAVE.z - 3));
        stand(gandalf, 'hill', GRAVE.x - 4.2, GRAVE.z + 2.8, faceTo(GRAVE.x - 4.2, GRAVE.z + 2.8, GRAVE.x, GRAVE.z));
        for (const f of [king, eowyn, gandalf]) pose(f, t + f.group.position.x, { talk: s.speaker === 'theoden' && f === king ? 1 : s.speaker === 'gandalf' && f === gandalf ? 1 : 0 });
        // the flowers to pick glimmer
        FLOWERS.forEach((f, i) => {
          if (s.picked?.includes(i)) return;
          if (Math.random() < dt * 3) light.emit(f.x + R(0.8), groundAt(f.x, f.z) + 0.3, f.z + R(0.8), 0, 0.4, 0, 1.2, 0.12, 0.05, 0.8);
        });
      }
      // Gimli, walking (or watching the mountains at night)
      if (s.mode === 'walk' || s.mode === 'talk' || s.mode === 'end') {
        if (s.mode !== 'end' && s.talking !== 'muster') {
          stand(me, 'hill', h.x, h.z, h.face);
          pose(me, t, { moving: (h.speed ?? 0) > 0.3, speed: Math.min(1.4, (h.speed ?? 0) / 3.2), talk: s.speaker === 'gimli' ? 1 : 0 });
        }
      }
      if (s.mode === 'watch' || s.talking === 'watch' || s.talking === 'lit') {
        const b = s.watch?.look ?? 0;
        stand(me, 'hill', WATCH.x, WATCH.z, b);
        pose(me, t, { talk: s.speaker === 'gimli' ? 1 : 0 });
        if (s.talking === 'lit') {
          stand(aragorn, 'hill', WATCH.x - 1.6, WATCH.z + 1.4, b);
          pose(aragorn, t, { talk: s.speaker === 'aragorn' ? 1 : 0 });
          stand(king, 'hill', DOORS.x + 1.2, 0, 0);
          pose(king, t, { talk: s.speaker === 'theoden' ? 1 : 0 });
        }
      }
      // the beacon on its peak, once lit (and the glow of it)
      if (s.watch?.lit != null) {
        const p = peakFires[s.watch.lit];
        A.beacon = Math.min(1, A.beacon + dt * 0.6);
        if (p && Math.random() < dt * 30 * A.beacon * Math.max(0.5, many)) flames.emit(p.x + R(5), p.y + Math.random() * 4, p.z + R(5), R(1), 8 + Math.random() * 6, R(1), 1.2, 16, 3, 1);
      } else A.beacon = 0;
      // the muster at dawn: the king on Snowmane, the host behind him
      if (s.mode === 'muster' || s.talking === 'muster' || (s.mode === 'end' && s.time === 'dawn')) {
        const ms = s.muster ?? 0;
        const p = musterAt(ms);
        stand(snowmane, 'hill', p.x, p.z, 0);
        snowmane.blob && (snowmane.blob.visible = false);
        gallop(snowmane, t, s.mode === 'muster' ? (s.musterV ?? 0) : 0);
        mounts.forEach((m, i) => {
          const q = musterAt(Math.max(0, ms - 6 - i * 3));
          stand(m, 'hill', q.x, q.z + (i - 1) * 3.4, 0);
          gallop(m, t + i, s.mode === 'muster' ? (s.musterV ?? 0) : 0);
        });
        host.visible = true;
        const front = hostFront(ms);
        host.position.set(front, groundAt(front, 0), 0);
        const off = front > HOST.front && s.mode === 'muster' ? (s.musterV ?? 0) : 0;
        hostKit.ride?.(off);
        if (off > 0.2 && Math.random() < dt * 40 * many) dust.emit(front - 60 - Math.random() * 30, groundAt(front, 0) + 0.5, R(60), R(1), 1 + Math.random(), R(1), 2.5, 2, 6, 0.5);
      }
      // the lamps of the town, after dusk
      if (night > 0) {
        const cam = camera.position;
        townLamps
          .map((p) => [p, p.distanceToSquared(cam)])
          .sort((a, b) => a[1] - b[1])
          .slice(0, POOL - 1)
          .forEach(([p], i) => {
            lights.push([p, fireCol, (5 + Math.sin(t * 9 + i) * 0.5) * night, 16]);
            if (Math.random() < dt * 12) flames.emit(p.x + R(0.05), p.y, p.z + R(0.05), 0, 0.5, 0, 0.4, 0.3, 0.05, 1);
          });
      }
    }

    // ── in the hall ──
    if (shown === 'hall') {
      ghosts.update([], t, dt);
      const brawl = s.brawl;
      const king0 = s.next === 'king' && !s.freed;
      // the king: bent on his throne till Gandalf frees him
      const k = king0 ? kingOld : king;
      stand(k, 'hall', THRONE.x, THRONE.z + 0.4, -Math.PI / 2, DAIS.h);
      sit(k, true);
      pose(k, t, { talk: s.speaker === 'theoden' ? 1 : 0 });
      sit(k, true);
      if (king0) {
        k.body.rotation.z = -0.1;
        stand(grima, 'hall', GRIMA.x, GRIMA.z, GRIMA.face, DAIS.h);
        pose(grima, t, { talk: s.speaker === 'grima' ? 1 : 0 });
        stand(eowyn, 'hall', -2.4, -17.6, -Math.PI / 2, DAIS.h);
        pose(eowyn, t + 2, {});
      }
      // Gandalf at his work, and his light
      if (s.next === 'king') {
        stand(gandalf, 'hall', GANDALF.x, GANDALF.z, GANDALF.face);
        pose(gandalf, t, { talk: s.speaker === 'gandalf' ? 1 : 0 });
        if (s.mode === 'brawl' || s.talking === 'freed') {
          gandalf.arms[1].rotation.x = -2.2 - Math.sin(t * 2) * 0.15;
          const w = brawl?.work ?? 1;
          if (Math.random() < dt * (20 + w * 40) * many) light.emit(GANDALF.x + R(0.6), AT.hall.y + 2.6 + R(0.4), GANDALF.z - 1 + R(0.4), R(1), R(0.6), -1.5 - Math.random(), 0.8, 0.25, 0.05, 1);
          lights.push([wpos('hall', GANDALF.x, 2.8, GANDALF.z - 0.6, V()), whiteCol, 4 + w * 8 + A.flash * 20, 16]);
        }
        stand(aragorn, 'hall', -3.6, -12.6, Math.PI / 2);
        stand(legolas, 'hall', 3.4, -13.4, Math.PI / 2);
        pose(aragorn, t, { wave: brawl ? 0.3 : 0 });
        pose(legolas, t + 1, {});
      }
      // Wormtongue's men
      if (brawl) {
        brawl.men.forEach((m, i) => {
          const f = men[i % men.length];
          stand(f, 'hall', m.x, m.z, faceTo(m.x, m.z, GANDALF.x, GANDALF.z));
          pose(f, t + i, { moving: m.state === 'come', speed: 1.1 });
          if (m.state === 'down') knock(f, Math.min(1, (BRAWL.down - m.downT) * 4));
        });
      }
      // the feast: the tables full, Legolas and you at the end of one
      if (s.next === 'feast' || s.talking === 'down') {
        feasters.forEach((f, i) => {
          const [sx, sz, sf] = SEATS[i];
          stand(f, 'hall', sx, sz, sf);
          sit(f, true);
          f.body.position.y = f.baseY - 0.25;
          pose(f, t + i, { talk: Math.sin(t * 2 + i) > 0.6 ? 1 : 0 });
          sit(f, true);
        });
        stand(legolas, 'hall', FEAST.legolas.x, FEAST.legolas.z, FEAST.legolas.face);
        pose(legolas, t, { talk: s.speaker === 'legolas' ? 1 : 0 });
        tankards[1].visible = true;
        const d = s.drink;
        const gim = s.talking === 'down' ? FEAST.gimli : FEAST.gimli;
        stand(me, 'hall', gim.x, gim.z, gim.face);
        pose(me, t, { talk: s.speaker === 'gimli' ? 1 : 0 });
        const tk = me === gimli ? tankards[0] : gimliBare.arms[1].children.at(-1);
        tk.visible = true;
        // the tankard swinging up to his lips and away
        const kk = d ? (d.k + 1) / 2 : 0.2;
        me.arms[1].rotation.x = -0.4 - kk * 2.2;
        me.arms[1].rotation.z = kk * 0.6;
        legolas.arms[1].rotation.x = -0.4 - (Math.sin(t * 1.7) * 0.5 + 0.5) * 1.6;
        if (s.talking === 'down' || d?.state === 'down') {
          // under the table
          me.body.rotation.z = -1.45;
          me.body.position.y = me.baseY - 0.55;
          tk.visible = false;
        } else if (d) me.body.rotation.z = Math.sin(t * 1.3) * 0.12 * d.head;
        A.roll += ((d ? Math.sin(t * 0.9) * 0.06 * d.head : 0) - A.roll) * Math.min(1, dt * 2);
      } else A.roll *= 0.9;
      // walking about the hall (after the king is free, and before the feast)
      if (s.mode === 'walk' || (s.mode === 'brawl' && h) || (s.mode === 'talk' && s.next !== 'feast')) {
        if (!(s.next === 'feast' || s.talking === 'down')) {
          stand(me, 'hall', h.x, h.z, h.face);
          pose(me, t, { moving: (h.speed ?? 0) > 0.3, speed: Math.min(1.4, (h.speed ?? 0) / 3.2), talk: s.speaker === 'gimli' ? 1 : 0 });
          if (A.bashT > 0) me.arms[1].rotation.x = -2.4 * A.bashT;
        }
      }
      // the hearth, and the lamps
      if (Math.random() < dt * 30 * Math.max(0.4, many)) flames.emit(hearth.x + R(0.6), hearth.y + 0.2, hearth.z + R(2.4), R(0.1), 0.9 + Math.random() * 0.6, R(0.1), 0.7, 0.6, 0.1, 1);
      if (Math.random() < dt * 4) smoke.emit(hearth.x + R(0.4), hearth.y + 1.4, hearth.z + R(2), 0, 1.4, 0, 3, 0.8, 3, 0.25);
      if (Math.random() < dt * 6) embers.emit(hearth.x + R(0.4), hearth.y + 0.4, hearth.z + R(2), R(0.3), 1.6, R(0.3), 1.2, 0.06, 0.02, 1);
      lights.push([hearth, fireCol, 9 + Math.sin(t * 11) * 1.2, 18]);
      const cam = camera.position;
      hallLamps
        .map((p) => [p, p.distanceToSquared(cam)])
        .sort((a, b) => a[1] - b[1])
        .slice(0, POOL - 2)
        .forEach(([p], i) => {
          lights.push([p, fireCol, 4 + Math.sin(t * 10 + i) * 0.4, 12]);
          if (Math.random() < dt * 14) flames.emit(p.x + R(0.04), p.y, p.z + R(0.04), 0, 0.45, 0, 0.35, 0.25, 0.04, 1);
        });
    }

    flames.step(dt);
    embers.step(dt);
    smoke.step(dt);
    dust.step(dt);
    light.step(dt);
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
    const P = (zn, x, y, z, out) => wpos(zn, x, y, z, out);
    if (s.mode === 'watch' || s.talking === 'watch' || s.talking === 'lit') {
      // over his shoulder, out along the mountains where he's looking
      const b = s.watch?.look ?? 0;
      const y = groundAt(WATCH.x, WATCH.z);
      const rx = -Math.sin(b);
      const rz = -Math.cos(b);
      P('hill', WATCH.x - Math.cos(b) * 2.2 + rx * 0.8, y + 1.9, WATCH.z + Math.sin(b) * 2.2 + rz * 0.8, camAt);
      P('hill', WATCH.x + Math.cos(b) * 400, y + 30, WATCH.z - Math.sin(b) * 400, camLook);
      fov = 40;
      if (s.talking === 'lit' && s.line === 'answer') {
        P('hill', WATCH.x + 6, y + 3, WATCH.z + 6, camAt);
        P('hill', DOORS.x, y + 1.8, 0, camLook);
        fov = 48;
      }
    } else if (s.mode === 'muster' || s.talking === 'muster' || (s.mode === 'end' && s.time === 'dawn')) {
      const ms = s.muster ?? 0;
      const p = musterAt(ms);
      const y = groundAt(p.x, p.z);
      if (s.talking === 'muster') {
        // the host gathered below the hill, from the stair
        P('hill', GATE.x + 6, groundAt(GATE.x + 6, 0) + 14, 10, camAt);
        P('hill', HOST.front - 50, 2, 0, camLook);
      } else {
        P('hill', p.x - 16, y + 7, p.z + 10, camAt);
        P('hill', p.x + 30, y + 2, p.z, camLook);
      }
      fov = 54;
    } else if (s.talking && shown === 'hill') {
      const who = s.talking === 'barrows' || s.talking === 'laid' ? GRAVE : { x: h.x + 2, z: h.z };
      const mx = (h.x + who.x) / 2;
      const mz = (h.z + who.z) / 2;
      const dx = who.x - h.x;
      const dz = who.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      const y = groundAt(mx, mz);
      P('hill', mx - (dz / d) * 5.4 - (dx / d) * 1.4, y + 2.4, mz + (dx / d) * 5.4 - (dz / d) * 1.4, camAt);
      P('hill', mx, y + 1.2, mz, camLook);
      if (s.talking === 'door') {
        const g = groundAt(DOORS.x + 2, 0);
        P('hill', DOORS.x + 9.5, g + 3.2, -5.2, camAt);
        P('hill', DOORS.x + 1.6, g + 1.4, 0.8, camLook);
      } else if (who === GRAVE) {
        // from out on the road, east, the gate and the town behind them
        const cz = (h.z + GRAVE.z) / 2;
        const D = Math.max(6.5, d * 0.8 + 3.5);
        P('hill', GRAVE.x + D, groundAt(GRAVE.x + D, cz) + 1.7 + D * 0.18, cz + 0.6, camAt);
        P('hill', GRAVE.x - 1.2, groundAt(GRAVE.x, cz) + 1.1, cz, camLook);
      }
    } else if (shown === 'hall' && (s.next === 'feast' || s.talking === 'down')) {
      // across the table: Gimli and Legolas, and the hall behind
      const fx = (FEAST.gimli.x + FEAST.legolas.x) / 2;
      P('hall', fx, 2.2, FEAST.gimli.z + 5, camAt);
      P('hall', fx, 0.95, FEAST.gimli.z - 0.2, camLook);
      fov = 46;
    } else if (shown === 'hall' && (s.talking === 'king' || s.talking === 'freed')) {
      P('hall', 4, 3, GANDALF.z + 9.6, camAt);
      P('hall', 0.3, 1.5, THRONE.z + 2.3, camLook);
    } else if (s.mode === 'end') {
      P('hill', 140, 40, 70, camAt);
      P('hill', 0, 22, 0, camLook);
    } else {
      // walking (and the brawl): behind, pulled in so nothing comes between
      const yaw = s.camYaw ?? 0;
      let pitch = s.camPitch ?? (s.mode === 'brawl' ? 0.55 : 0.3);
      const full = s.camDist ?? (s.mode === 'brawl' ? 7.5 : 6);
      let dist = full;
      const base = shown === 'hall' ? 0 : groundAt(h.x, h.z);
      P(shown, h.x, base + 1, h.z, look);
      for (let d = dist; d > 1.6; d -= 0.3) {
        dist = d;
        const cx = h.x + Math.sin(yaw) * Math.cos(pitch) * d;
        const cz = h.z + Math.cos(yaw) * Math.cos(pitch) * d;
        const ok = shown === 'hall' ? inHall(cx, cz, 0.6) && clearView(h.x, h.z, cx, cz) : !(cx > MEDUSELD.x0 - 0.6 && cx < MEDUSELD.x1 + 0.6 && Math.abs(cz) < MEDUSELD.z1 + 0.6);
        if (ok) break;
      }
      pitch = Math.min(1.2, pitch + (full - dist) * 0.08);
      const cx = h.x + Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = h.z + Math.cos(yaw) * Math.cos(pitch) * dist;
      let cy = base + 1 + Math.sin(pitch) * dist;
      if (shown === 'hill') cy = Math.max(cy, groundAt(cx, cz) + 0.8);
      camAt = P(shown, cx, cy, cz, camAt);
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
      if (s.debugCam.fov) fov = s.debugCam.fov;
    }
    const key = `${shown}|${s.mode}|${s.talking ?? ''}|${zone}|${s.talking === 'lit' ? s.line : ''}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'brawl' || s.mode === 'muster' || s.mode === 'watch';
    const ke = jump ? 1 : Math.min(1, dt * (follow ? 6 : 2));
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
    if (Math.abs(A.roll) > 0.001) camera.rotateZ(A.roll);
    sky.dome.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 120);
    sun.target.position.copy(camera.position);
    stage.grade({
      saturation: moodKey === 'night' ? 0.8 : moodKey === 'hall' ? 0.9 : 0.94,
      contrast: 0.12,
      vignette: moodKey === 'hall' ? 0.42 : 0.28,
      grain: 0.015,
      shadow: moodKey === 'night' ? [0, 0.01, 0.04] : [0, 0, 0],
      high: moodKey === 'hall' || moodKey === 'evening' ? [0.03, 0.015, 0] : [0, 0, 0],
    });
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type) => {
    if (type === 'bash') {
      A.bashT = 1;
      A.shake = Math.max(A.shake, 0.05);
    } else if (type === 'reach') A.flash = 1;
    else if (type === 'thunder') {
      A.flash = 1;
      A.shake = Math.max(A.shake, 0.3);
    } else if (type === 'door') A.shake = Math.max(A.shake, 0.06);
    else if (type === 'fall') A.shake = Math.max(A.shake, 0.2);
  };

  return {
    scene: import.meta.env.DEV ? scene : null,
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
      ghosts.dispose();
      disposeTree(scene);
      stage.dispose();
    },
  };
}

