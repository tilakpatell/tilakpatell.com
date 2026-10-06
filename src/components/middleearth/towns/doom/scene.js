// Mordor and Mount Doom, in WebGL: the plain of Gorgoroth under a sky the
// colour of a forge, the orc column on its road and the camps, the Eye on
// its Tower sweeping the plain with its light, the mountain with its road
// and its door; inside, the spur out over the Crack of Doom; and at the
// end, the mountain blazing, a rock in a river of fire, and the eagles.
// Made in code (./props.js, ../ground.js), so nothing is downloaded.
//
// The plain and the mountain are one world; the Sammath Naur is drawn
// apart. It draws what the component hands it and decides nothing.
//
// createDoomWorld(canvas) returns { render(state, ms, fast), fx(type),
// screenOf(), resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { createParticles } from '../../kit';
import { instances } from '../../shire/ground';
import { LOOKS, sit } from '../../shire/people';
import { makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { makeTerrain } from '../ground';
import { makeFolk } from '../bree/props';
import { createGhosts } from '../ghosts';
import { createDoomKit } from './props';
import { BARAD, CAMP, CROSS, CROSS_START, DOOM, EDGE, EYE_AT, FOOT, MARCH_LEN, REFUGE, ROCKS, alongMarch, groundHeight } from './layout';
import { BURSTS, CARRY, EYE, FLIGHT } from './rules';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// the Crack of Doom, drawn apart
const NAUR = V(6000, 0, 0);

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
const noise = makeNoise(73);
const ASH = C(0x2e2420);
const ASH_PALE = C(0x5a4a40);
const CINDER = C(0x1a1412);
const paint = (x, z, h, out) => {
  lerp3(out, ASH, ASH_PALE, smooth(0.4, 0.75, fbm(noise, x * 0.03, z * 0.03, { octaves: 3 })));
  return lerp3(out, out, CINDER, smooth(0.55, 0.8, fbm(noise, x * 0.11 + 5, z * 0.11, { octaves: 2 })) * 0.7);
};
// the plain's middle, where its ground is drawn about
const PLAIN = { x: -650, z: 0, size: 960 };

// ── the light ──
const MOODS = {
  plain: { top: 0x140806, horizon: 0x7a3216, sun: [0.6, 0.35, -0.2], sunColour: 0xff9a60, sunPower: 1.0, hemiSky: 0xa8664a, hemiGround: 0x1a0c08, hemi: 1.5, fog: 0x3a1a10, fogNear: 80, fogFar: 1100, cloud: 0.9, cloudColour: 0x3a1a10, stars: 0, exposure: 1.4 },
  slope: { top: 0x140806, horizon: 0x8a3818, sun: [0.5, 0.45, -0.3], sunColour: 0xffa070, sunPower: 1.1, hemiSky: 0xb07050, hemiGround: 0x200e08, hemi: 1.6, fog: 0x401c10, fogNear: 60, fogFar: 900, cloud: 0.95, cloudColour: 0x40200f, stars: 0, exposure: 1.4 },
  crack: { top: 0x080202, horizon: 0x200804, sun: [0.1, -0.9, 0.1], sunColour: 0xff6a20, sunPower: 0.6, hemiSky: 0x5a2a1a, hemiGround: 0xa03a10, hemi: 1.2, fog: 0x2a0c04, fogNear: 25, fogFar: 140, cloud: 0, cloudColour: 0x100404, stars: 0, exposure: 1.35 },
  erupt: { top: 0x2a0c06, horizon: 0xc0501a, sun: [0.4, 0.3, -0.3], sunColour: 0xffb070, sunPower: 1.4, hemiSky: 0xd0805a, hemiGround: 0x3a1408, hemi: 1.9, fog: 0x5a2410, fogNear: 50, fogFar: 800, cloud: 1, cloudColour: 0x5a2a14, stars: 0, exposure: 1.1 },
};
const COLOURS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour'];
const NUMBERS = ['sunPower', 'hemi', 'fogNear', 'fogFar', 'cloud', 'stars', 'exposure'];

// the eagles' way out, west from the rock: the point `s` metres along at
// `lat` across
const FLY_DIR = V(-0.97, 0, 0.24).normalize();
const FLY_SIDE = V(-FLY_DIR.z, 0, FLY_DIR.x);
const flyAt = (s, lat, out = V()) => out.set(REFUGE.x, 32, REFUGE.z).addScaledVector(FLY_DIR, s).addScaledVector(FLY_SIDE, lat);

// the column's road, carried on straight past its end
function marchAt(d) {
  if (d <= MARCH_LEN) return alongMarch(d);
  const [x, z, a] = alongMarch(MARCH_LEN);
  const over = d - MARCH_LEN;
  return [x + Math.cos(a) * over, z + Math.sin(a) * over, a];
}

export function createDoomWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 52, near: 0.1, far: 4200, bloom: { strength: 0.8, radius: 0.6, threshold: 0.8 }, onLost });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x3a1a10, 80, 1100);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0xa8664a, 0x1a0c08, 1.5);
  const sun = new THREE.DirectionalLight(0xff9a60, 1);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  // the Eye's searching light where it falls on the plain
  const eyeSpot = new THREE.SpotLight(0xffd27a, 0, 0, Math.atan(EYE.r / 70), 0.45, 0);
  scene.add(eyeSpot, eyeSpot.target);
  const sky = makeSky(3800);
  scene.add(sky.dome);

  const kit = createDoomKit(renderer);
  const mats = kit.mats ?? {};
  const world = new THREE.Group();
  const naur = new THREE.Group();
  naur.position.copy(NAUR);
  scene.add(world, naur);
  const rockMat = mats.rock ?? new THREE.MeshLambertMaterial({ vertexColors: true });

  // ── the plain ──
  {
    const ground = makeTerrain(renderer, { size: PLAIN.size, seg: tier === 'high' ? 200 : 120, height: (x, z) => groundHeight(x + PLAIN.x, z + PLAIN.z), paint: (x, z, h, out) => paint(x + PLAIN.x, z + PLAIN.z, h, out), blades: 0 });
    ground.position.set(PLAIN.x, 0, PLAIN.z);
    world.add(ground);
    // and out to the horizon
    const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x241a16 }));
    far.position.y = -1.2;
    world.add(far);
  }
  // the rocks to hide behind, and more across the plain
  const rockGeos = [1, 2, 3].map((i) => kit.ashRock(i));
  {
    const lists = [[], [], []];
    ROCKS.forEach(([x, z, r], i) => lists[i % 3].push({ x, z, y: groundHeight(x, z) - 0.2, s: r / 1.2, turn: i * 2.3 }));
    const rand = (() => {
      let s = 19;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    for (let i = 0; i < 260 * many; i++) {
      const x = PLAIN.x + (rand() - 0.5) * PLAIN.size * 0.95;
      const z = PLAIN.z + (rand() - 0.5) * PLAIN.size * 0.95;
      if (x > CROSS.west - 6 && x < CROSS.east + 6 && z > CROSS.north - 6 && z < CROSS.south + 6) continue;
      if (Math.hypot(x - DOOM.x, z - DOOM.z) < DOOM.r + 8) continue;
      if (Math.hypot(x - REFUGE.x, z - REFUGE.z) < 30) continue;
      lists[i % 3].push({ x, z, y: groundHeight(x, z) - 0.3, s: 0.6 + rand() * 1.8, turn: rand() * TAU });
    }
    lists.forEach((list, i) => world.add(instances(rockGeos[i], rockMat, list, { shadow: false })));
    const fangs = [];
    for (let i = 0; i < 70 * many; i++) {
      const x = PLAIN.x + (rand() - 0.5) * PLAIN.size;
      const z = PLAIN.z + (rand() - 0.5) * PLAIN.size;
      if (x > CROSS.west - 10 && x < CROSS.east + 10 && z > CROSS.north - 10 && z < CROSS.south + 10) continue;
      if (Math.hypot(x - DOOM.x, z - DOOM.z) < DOOM.r + 20) continue;
      fangs.push({ x, z, y: groundHeight(x, z) - 0.5, s: 0.8 + rand() * 1.6, turn: rand() * TAU });
    }
    world.add(instances(kit.spike(1), rockMat, fangs, { shadow: false }));
  }
  // the camps, the one the column halts at and others far off
  const camps = [
    [CAMP.x + 6, CAMP.z + 10],
    [-920, -220],
    [-420, 300],
    [-980, 260],
  ].map(([x, z], i) => {
    const c = kit.camp();
    c.group.position.set(x, groundHeight(x, z), z);
    c.group.rotation.y = i * 1.9;
    world.add(c.group);
    c.group.updateMatrixWorld(true);
    c.fireAt = c.group.localToWorld(c.fire.clone());
    return c;
  });

  // ── the mountain, turned so its road starts due west ──
  const doom = kit.mountDoom();
  {
    const r0 = doom.road(0);
    doom.group.rotation.y = Math.atan2(r0.z, r0.x) - Math.PI;
  }
  doom.group.position.set(DOOM.x, 0, DOOM.z);
  world.add(doom.group);
  doom.group.updateMatrixWorld(true);
  const roadAt = (k, out = V()) => doom.group.localToWorld(out.copy(doom.road(Math.max(0, Math.min(1, k)))));
  const doorAt = doom.group.localToWorld(doom.door.clone());
  const summit = doom.group.localToWorld(V(0, 300, 0));

  // ── Barad-dûr, far off, the Eye on it, turned to the plain ──
  const barad = kit.baradDur();
  barad.group.position.set(BARAD.x, 0, BARAD.z);
  barad.group.rotation.y = Math.atan2(PLAIN.x - BARAD.x, PLAIN.z - BARAD.z);
  world.add(barad.group);
  barad.group.updateMatrixWorld(true);
  barad.doom?.copy(summit);
  const baradY = barad.group.position.y;

  // the lava at the end, round the rock
  const lava = kit.lavaField(260, 260);
  const lavaMesh = lava.group ?? lava.mesh;
  lavaMesh.position.set(REFUGE.x, groundHeight(REFUGE.x, REFUGE.z) + 0.9, REFUGE.z);
  world.add(lavaMesh);
  const refuge = kit.refuge();
  refuge.group.position.set(REFUGE.x, groundHeight(REFUGE.x, REFUGE.z) - 0.6, REFUGE.z);
  world.add(refuge.group);
  refuge.group.updateMatrixWorld(true);
  const seat = refuge.group.localToWorld(refuge.seat.clone());

  // the column
  const columnGeo = kit.orcColumn();
  const column = new THREE.InstancedMesh(columnGeo, mats.orc ?? new THREE.MeshLambertMaterial({ vertexColors: true }), 60);
  column.frustumCulled = false;
  world.add(column);
  const slaver = kit.orc(7, { slaver: true });
  world.add(slaver.group);

  // the eagles
  const gwaihir = kit.eagle();
  const landroval = kit.eagle();
  world.add(gwaihir.group, landroval.group);
  landroval.group.scale.setScalar(0.92);

  // ── the Sammath Naur ──
  const crack = kit.sammathNaur();
  naur.add(crack.group);
  const ring = kit.ring();
  scene.add(ring.group);

  // ── people ──
  const blobGeo = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blob = (f) => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.position.y = 0.04;
    b.renderOrder = 1;
    f.group.add(b);
    f.blob = b;
    return f;
  };
  const frodo = blob(folk('frodo'));
  const sam = blob(folk('sam'));
  scene.add(frodo.group, sam.group);
  const gollum = kit.gollum();
  scene.add(gollum.group);
  // other travellers, online, from other worlds (../ghosts.js), out on the plain
  const ghosts = createGhosts({ height: groundHeight });
  world.add(ghosts.group);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const ash = createParticles(Math.round(400 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.55, 0.48, 0.44, 0],
      [0.2, 0.55, 0.48, 0.44, 0.55],
      [1, 0.45, 0.4, 0.36, 0],
    ],
    additive: false,
    gravity: -0.25,
    drag: 0.5,
    swirl: 0.7,
  });
  scene.add(ash.mesh);
  const sparks = createParticles(Math.round(500 * Math.max(0.4, many)), {
    ramp: [
      [0, 1, 0.85, 0.5, 0],
      [0.1, 1, 0.7, 0.3, 1],
      [0.6, 1, 0.35, 0.1, 0.7],
      [1, 0.6, 0.15, 0.05, 0],
    ],
    additive: true,
    gravity: -6,
    drag: 0.2,
  });
  scene.add(sparks.mesh);

  // ── state ──
  const cur = {};
  for (const k of COLOURS) cur[k] = new THREE.Color(MOODS.plain[k]);
  for (const k of NUMBERS) cur[k] = MOODS.plain[k];
  const sunDir = V(...MOODS.plain.sun).normalize();
  const A = { t: 0, cam: { at: V(0, 4, 10), look: V(0, 2, -10) }, mode: '', shake: 0, first: true, mood: '', erupt: 0, fall: 0, lash: 0, hit: 0, ash: 0, sparks: 0, gollumT: 0, ringK: 0, fov: 52, sink: 0, shire: 0 };
  const tmp = V();
  const tmp2 = V();
  const tmp3 = V();
  const look = V();
  const target = new THREE.Color();
  const blend = new THREE.Color();
  const fireCol = new THREE.Color(0xff6a20);
  const lavaCol = new THREE.Color(0xff5a10);
  const shireCol = new THREE.Color(0xffd890);
  const hostM = new THREE.Matrix4();
  const hostQ = new THREE.Quaternion();
  const hostE = new THREE.Euler();
  const hostS = V(1, 1, 1);
  const hidden = V(0, 0, 0);
  const beamAt = V();
  const stand = (f, x, y, z, face) => {
    f.group.visible = true;
    f.group.position.set(x, y, z);
    f.group.rotation.set(0, face, 0);
    sit(f, false);
    if (f.arms?.[0]) f.arms[0].rotation.x = 0;
    if (f.arms?.[1]) f.arms[1].rotation.x = 0;
    if (f.blob) f.blob.visible = true;
  };
  const faceOf = (dx, dz) => Math.atan2(-dz, dx);

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const zone = s.zone;
    kit.tick?.(t);
    sky.uniforms.uTime.value = t;
    const inNaur = zone === 'crack';
    world.visible = !inNaur;
    naur.visible = inNaur;
    if (inNaur) eyeSpot.intensity = 0;
    const h = s.hobbit;
    const lights = [];
    const done = s.done ?? [];
    // (remembering the Shire at the mountain's foot, it isn't erupting yet)
    const after = s.mode !== 'remember' && (done.includes('crack') || s.talking === 'refuge' || s.mode === 'flight' || (s.mode === 'end' && done.includes('eagles')));
    // the mountain wakes as the Ring goes into the fire
    const wantErupt = after ? 1 : inNaur && (s.talking === 'done' || (s.talking === 'crack' && s.line === 'fall')) ? 0.7 : 0;
    A.erupt += (wantErupt - A.erupt) * Math.min(1, dt * 0.8);

    // ── the light ──
    const moodKey = inNaur ? 'crack' : zone === 'slope' ? 'slope' : 'plain';
    const mood = MOODS[moodKey];
    const ease = A.first ? 1 : Math.min(1, dt * 1.5);
    A.first = false;
    const ek = inNaur ? 0 : A.erupt;
    for (const k of COLOURS) cur[k].lerp(blend.set(mood[k]).lerp(target.set(MOODS.erupt[k]), ek), ease);
    for (const k of NUMBERS) cur[k] += (mood[k] + (MOODS.erupt[k] - mood[k]) * ek - cur[k]) * ease;
    sunDir.lerp(tmp2.set(...mood.sun).normalize(), ease).normalize();
    const u = sky.uniforms;
    u.uTop.value.copy(cur.top);
    u.uHorizon.value.copy(cur.horizon);
    // no sun to speak of, behind the reek
    u.uSunColour.value.copy(cur.sunColour).multiplyScalar(0.18);
    u.uCloudColour.value.copy(cur.cloudColour);
    u.uCloud.value = cur.cloud;
    u.uStars.value = cur.stars;
    u.uMoon.value = 0;
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

    // everyone hidden, then placed
    frodo.group.visible = false;
    sam.group.visible = false;
    gollum.group.visible = false;
    ring.group.visible = false;
    gwaihir.group.visible = false;
    landroval.group.visible = false;

    // ── the mountain, the Tower, the camps ──
    if (!inNaur) {
      doom.update?.(t, { erupt: A.erupt });
      camps.forEach((c, i) => {
        c.update?.(t + i);
        if (c.fireAt.distanceToSquared(camera.position) < 160 * 160) lights.push([c.fireAt.clone().add(V(0, 1, 0)), fireCol, 6, 30]);
      });
      // the Tower falls once it's done
      if (after) A.sink = Math.min(1, A.sink + dt * (s.talking === 'refuge' ? 0.05 : 1));
      else A.sink = 0;
      barad.group.position.y = baradY - A.sink * A.sink * 460;
      barad.group.visible = A.sink < 0.999;
      // the Eye: on its searching light while you cross, else sweeping far
      // off, and to the mountain when the Ring is put on
      if (s.search) beamAt.set(s.search.x, groundHeight(s.search.x, s.search.z), s.search.z);
      else beamAt.set(PLAIN.x - 200 + Math.sin(t * 0.07) * 300, 0, PLAIN.z + Math.cos(t * 0.05) * 300);
      barad.aim?.(beamAt);
      if (s.search) {
        eyeSpot.target.position.copy(beamAt);
        eyeSpot.position.set(EYE_AT.x - beamAt.x, EYE_AT.y - beamAt.y, EYE_AT.z - beamAt.z).setLength(70).add(beamAt);
        eyeSpot.intensity = 6 + (s.search.seen ?? 0) * 10;
      } else eyeSpot.intensity = 0;
      barad.update?.(t, { k: (1 - A.sink) * (s.search?.seen > 0 ? 1.4 : 1), look: after ? 1 : 0 });
      lights.push([doorAt.clone().add(V(0, 2, 0)), fireCol, 30 + A.erupt * 60, 120]);
      lights.push([summit.clone().add(V(0, 60, 0)), lavaCol, 200 + A.erupt * 600, 1400]);
    }

    if (!(s.talking === 'refuge' || s.mode === 'flight' || (s.mode === 'end' && done.includes('eagles')))) lavaMesh.visible = false;

    // ── the column ──
    const m = s.march;
    const marching = s.mode === 'march' && m;
    const colDist = marching ? m.s : s.talking === 'halt' ? MARCH_LEN - 4 : s.talking === 'column' ? -12 : -999;
    column.visible = colDist > -100 && !inNaur;
    slaver.group.visible = column.visible;
    if (column.visible) {
      const n = column.count;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 4);
        const file = (i % 4) - 1.5;
        // you two are in the eighth row, files 1 and 2
        if (marching && row === 7 && (file === -0.5 || file === 0.5)) {
          hostM.compose(hidden, hostQ.identity(), hidden);
          column.setMatrixAt(i, hostM);
          continue;
        }
        const halted = s.talking === 'halt';
        const d = colDist + (7 - row) * 1.5 + (halted ? Math.sin(i * 3.1) * 1.4 : 0);
        const [x, z, a] = marchAt(d);
        const px = x - Math.sin(a) * file * 1.15 + (halted ? Math.sin(i * 7.7) * 1.2 : 0);
        const pz = z + Math.cos(a) * file * 1.15 + (halted ? Math.cos(i * 5.3) * 1.2 : 0);
        const bob = marching ? Math.abs(Math.sin(t * 6.5 * (m.pace ?? 1) + row)) * 0.06 : 0;
        hostE.set(0, -a + (halted ? Math.sin(i * 2.3) * 2 : 0), 0);
        hostQ.setFromEuler(hostE);
        hostM.compose(tmp2.set(px, groundHeight(px, pz) + bob, pz), hostQ, hostS);
        column.setMatrixAt(i, hostM);
      }
      column.instanceMatrix.needsUpdate = true;
      // the slaver walks alongside, by you
      const [x, z, a] = marchAt(colDist + 0.5);
      const sx = x + Math.sin(a) * 3;
      const sz = z - Math.cos(a) * 3;
      slaver.group.position.set(sx, groundHeight(sx, sz), sz);
      slaver.group.rotation.y = -a;
      A.lash = Math.max(0, A.lash - dt * 2);
      slaver.animate?.(t, { marching: Boolean(marching), lash: A.lash });
    }

    // ── Frodo and Sam ──
    let lead = frodo;
    if (inNaur) {
      // inside: Frodo at the edge, Sam behind him; then Frodo hanging
      const nx = NAUR.x;
      const g = s.hang;
      const line = s.line;
      if (s.mode === 'hang' && g) {
        const slip = (1 - g.grip) * 0.35;
        stand(frodo, nx + EDGE.x + 0.75, NAUR.y - 1.45 - slip, NAUR.z, Math.PI);
        if (frodo.blob) frodo.blob.visible = false;
        if (frodo.arms?.[0]) frodo.arms[0].rotation.x = -2.9;
        if (frodo.arms?.[1]) frodo.arms[1].rotation.x = g.phase === 'reach' ? 2.4 + Math.sin(t * 8) * 0.1 : 1.2;
        stand(sam, nx + EDGE.x - 0.25, NAUR.y, NAUR.z, 0);
        sit(sam, true);
        if (sam.arms?.[1]) sam.arms[1].rotation.x = -0.6 - g.arm * 1.4;
        lead = sam;
      } else if (s.talking === 'done') {
        // up again, the two of you on the spur
        stand(frodo, nx + EDGE.x - 1.2, NAUR.y, NAUR.z + 0.2, 0);
        sit(frodo, true);
        stand(sam, nx + EDGE.x - 2, NAUR.y, NAUR.z - 0.2, 0.3);
        sit(sam, true);
        // the Ring in the fire, melting
        A.ringK = Math.max(0, A.ringK - dt * (line === 'gone' ? 0.12 : 0.6));
        ring.group.visible = A.ringK > 0.02;
        ring.group.position.set(nx + 17, NAUR.y - 40 + A.erupt * 12 + 0.3, NAUR.z + 1);
        ring.set?.(A.ringK);
        ring.group.scale.setScalar(8);
      } else {
        const gone = line === 'mine' || line === 'gollum' || line === 'fall';
        stand(frodo, nx + EDGE.x - 0.4, NAUR.y, NAUR.z, gone ? Math.PI : 0);
        frodo.group.visible = !gone;
        stand(sam, nx + 2.5, NAUR.y, NAUR.z, 0);
        if (s.speaker === 'sam') pose(sam, t, { moving: false, wave: 0.5 });
        // the Ring in his hand, held out over the fire
        if (!gone) {
          ring.group.visible = true;
          ring.group.scale.setScalar(2.2);
          ring.group.position.set(nx + EDGE.x + 0.05, NAUR.y + 0.85, NAUR.z + 0.15);
          ring.set?.(0.7 + Math.sin(t * 3) * 0.2);
          if (frodo.arms?.[1]) frodo.arms[1].rotation.x = -1.4;
          A.ringK = 1;
        }
        // Gollum, dancing at the edge with it, then gone over
        if (line === 'gollum' || line === 'fall') {
          gollum.group.visible = true;
          if (line === 'fall') A.gollumT += dt;
          else A.gollumT = 0;
          const fallT = A.gollumT;
          const gy = NAUR.y - Math.min(40, fallT * fallT * 4.9);
          gollum.group.position.set(nx + EDGE.x - 0.2 + Math.min(2, fallT * 1.5), gy, NAUR.z);
          gollum.group.rotation.set(0, line === 'fall' ? Math.PI : Math.sin(t * 4) * 0.8, 0);
          gollum.animate?.(t, line === 'fall' ? { pose: 'fall' } : { pose: 'crouch', reach: 1, look: Math.sin(t * 6) * 0.4 });
          ring.group.visible = fallT < 2.5;
          ring.group.scale.setScalar(2.2);
          ring.group.position.copy(gollum.group.position).add(V(0.3, 0.75, 0));
          ring.set?.(1);
        } else A.gollumT = 0;
      }
      crack.update?.(t, { erupt: A.erupt });
      // the fire below
      lights.push([V(nx + 15, NAUR.y - 30 + A.erupt * 10, NAUR.z), lavaCol, 120 + A.erupt * 200, 90]);
      lights.push([V(nx + 8, NAUR.y - 8, NAUR.z + 6), fireCol, 18 + A.erupt * 20, 40]);
      A.sparks += dt * (20 + A.erupt * 60) * Math.max(0.4, many);
      while (A.sparks > 1) {
        A.sparks -= 1;
        sparks.emit(nx + 6 + Math.random() * 22, NAUR.y - 36 + A.erupt * 12, NAUR.z + R(14), R(1.5), 8 + Math.random() * 10, R(1.5), 3, 0.12, 0.05, 1);
      }
    } else if (marching) {
      // in the column, in step
      const [x, z, a] = marchAt(m.s + m.off);
      const face = -a;
      const fx2 = x - Math.sin(a) * -0.575;
      const fz = z + Math.cos(a) * -0.575;
      stand(frodo, fx2, groundHeight(fx2, fz), fz, face);
      pose(frodo, t, { moving: true, speed: 0.7 * (m.pace ?? 1) });
      const sx = x - Math.sin(a) * 0.575;
      const sz = z + Math.cos(a) * 0.575;
      stand(sam, sx, groundHeight(sx, sz), sz, face);
      pose(sam, t + 0.3, { moving: true, speed: 0.7 * (m.pace ?? 1) });
    } else if (s.mode === 'carry' || s.talking === 'door') {
      // Sam, with Frodo on his back, up the road
      lead = sam;
      const c = s.carry;
      const k = s.talking === 'door' ? 0.995 : 0.82 + 0.18 * ((c?.s ?? 0) / CARRY.len);
      const p = roadAt(k, tmp3);
      const q = roadAt(k + 0.004, tmp2);
      const face = faceOf(q.x - p.x, q.z - p.z);
      if (s.talking === 'door') {
        stand(frodo, p.x, p.y, p.z, face);
        stand(sam, p.x - Math.cos(face) * 2, p.y, p.z + Math.sin(face) * 2, face);
        gollum.group.visible = true;
        gollum.group.position.set(p.x + Math.cos(face) * 1.4, p.y, p.z - Math.sin(face) * 1.4);
        gollum.group.rotation.y = face + Math.PI;
        gollum.animate?.(t, { pose: s.line === 'gollum' ? 'crawl' : 'cower', speed: 1, reach: s.line === 'gollum' ? 1 : 0 });
      } else {
        stand(sam, p.x, p.y, p.z, face);
        const stepping = (c?.stumbleT ?? 0) > 0 ? 0 : 1;
        pose(sam, t, { moving: stepping > 0 && (c?.tremorT ?? 0) === 0, speed: 0.45 });
        if (sam.arms?.[0]) sam.arms[0].rotation.x = -0.9;
        if (sam.arms?.[1]) sam.arms[1].rotation.x = 0.9;
        // Frodo on his back
        stand(frodo, p.x - Math.cos(face) * 0.28, p.y + 0.42, p.z + Math.sin(face) * 0.28, face);
        sit(frodo, true);
        if (frodo.blob) frodo.blob.visible = false;
        if (frodo.arms?.[0]) frodo.arms[0].rotation.x = -1.2;
        if (frodo.arms?.[1]) frodo.arms[1].rotation.x = 1.2;
        if ((c?.tremorT ?? 0) > 0) A.shake = Math.max(A.shake, 0.18);
      }
    } else if (s.talking === 'refuge' || s.mode === 'flight' || (s.mode === 'end' && done.includes('eagles'))) {
      // on the rock in the fire, then away with the eagles
      const f = s.flight;
      const flying = s.mode === 'flight' || s.mode === 'end';
      const fs = f ? f.s : s.mode === 'end' ? FLIGHT.len : 0;
      const lat = f ? f.lat : 0;
      if (!flying) {
        stand(frodo, seat.x - 0.4, seat.y, seat.z, 0.4);
        sit(frodo, true);
        stand(sam, seat.x + 0.4, seat.y, seat.z + 0.3, 0.4 + Math.PI);
        sit(sam, true);
        if (s.line === 'eagles') {
          // they come in out of the smoke
          gwaihir.group.visible = true;
          landroval.group.visible = true;
          A.fall += dt;
          const k = Math.min(1, A.fall / 6);
          gwaihir.group.position.set(seat.x + 60 * (1 - k), seat.y + 6 + 30 * (1 - k), seat.z - 20 * (1 - k));
          gwaihir.group.rotation.set(0, Math.PI - 0.3, 0);
          gwaihir.animate?.(t, { flap: 1, reach: k });
          landroval.group.position.set(seat.x + 80 * (1 - k) + 8, seat.y + 10 + 30 * (1 - k), seat.z - 10 - 20 * (1 - k));
          landroval.group.rotation.set(0, Math.PI - 0.2, 0);
          landroval.animate?.(t + 1, { flap: 1, reach: k });
        } else A.fall = 0;
      } else {
        // Gwaihir with Frodo, Landroval with Sam
        const p = flyAt(fs, lat, tmp3);
        gwaihir.group.visible = true;
        gwaihir.group.position.copy(p).add(V(0, Math.sin(t * 1.5) * 0.6, 0));
        gwaihir.group.rotation.set((f?.stunT ?? 0) > 0 ? Math.sin(t * 20) * 0.2 : 0, Math.atan2(-FLY_DIR.z, FLY_DIR.x), Math.sin(t * 0.7) * 0.1 - (s.steerLean ?? 0));
        gwaihir.animate?.(t, { flap: 0.8, glide: 0.2, reach: 1 });
        stand(frodo, p.x, p.y - 3.1, p.z, Math.atan2(-FLY_DIR.z, FLY_DIR.x));
        if (frodo.blob) frodo.blob.visible = false;
        const q = flyAt(Math.max(0, fs - 10), lat + 7, tmp2);
        landroval.group.visible = true;
        landroval.group.position.copy(q).add(V(0, 2 + Math.sin(t * 1.3 + 1) * 0.6, 0));
        landroval.group.rotation.set(0, Math.atan2(-FLY_DIR.z, FLY_DIR.x), 0);
        landroval.animate?.(t + 1, { flap: 0.85, glide: 0.2, reach: 1 });
        stand(sam, q.x, q.y - 1.1, q.z, Math.atan2(-FLY_DIR.z, FLY_DIR.x));
        if (sam.blob) sam.blob.visible = false;
        // the fountains of fire ahead
        for (const b of BURSTS) {
          const ahead = b.s - fs;
          if (ahead < -10 || ahead > 60) continue;
          const at = flyAt(b.s, b.lat, tmp2);
          const gy = groundHeight(at.x, at.z);
          if (lights.length < POOL) lights.push([V(at.x, gy + 8, at.z), lavaCol, 40, 80]);
          for (let i = 0; i < 3 * Math.max(0.4, many); i++) sparks.emit(at.x + R(1.2), gy + 1, at.z + R(1.2), R(2), 26 + Math.random() * 14, R(2), 2.2, 0.6, 0.2, 1);
        }
      }
      lava.update?.(t);
      refuge.glow?.(1);
      lavaMesh.visible = true;
      lights.push([seat.clone().add(V(0, 4, 0)), lavaCol, 14, 60]);
    } else if (s.talking === 'foot' || s.mode === 'remember') {
      // at the foot, Frodo down
      stand(frodo, FOOT.x, groundHeight(FOOT.x, FOOT.z), FOOT.z, 0);
      sit(frodo, true);
      frodo.group.rotation.z = 0.9;
      // (Sam a step off, so the two of them read apart)
      stand(sam, FOOT.x - 1.5, groundHeight(FOOT.x - 1.5, FOOT.z + 1.1), FOOT.z + 1.1, -0.7);
      sit(sam, true);
      if (s.mode === 'remember') {
        // the Shire coming back to him: a little warm light round the two
        // of them, more the more he remembers
        const k = s.remember?.k ?? 0;
        A.shire += (k - A.shire) * Math.min(1, dt * 1.5);
        lights.unshift([V(FOOT.x - 0.4, groundHeight(FOOT.x, FOOT.z) + 1.2, FOOT.z + 0.6), shireCol, 1.5 + A.shire * 9 + Math.sin(t * 2) * 0.3, 6 + A.shire * 6]);
        pose(sam, t, { moving: false, talk: s.speaker === 'sam' ? 1 : 0 });
        sit(sam, true); // (pose straightens the legs; he stays sitting)
        frodo.group.rotation.z = 0.9 - A.shire * 0.5;
      }
    } else if (s.talking === 'column' || s.talking === 'halt' || (s.mode === 'walk' && !s.search && s.next === 'column')) {
      // by the road, the column behind
      const [x, z, a] = s.talking === 'halt' ? marchAt(MARCH_LEN + 6) : marchAt(-2);
      stand(frodo, x, groundHeight(x, z), z, -a);
      stand(sam, x - Math.sin(a) * 0.9, groundHeight(x, z), z + Math.cos(a) * 0.9, -a);
      if (s.talking === 'halt') {
        sit(frodo, true);
        sit(sam, true);
      }
    } else {
      // walking: across the plain, or waiting at a part's start
      let x = h.x;
      let z = h.z;
      let face = h.face;
      if (!s.search && zone === 'slope') {
        const p = roadAt(0.82, tmp3);
        x = p.x;
        z = p.z;
        face = Math.PI;
      }
      const y = zone === 'slope' && !s.search ? roadAt(0.82, tmp3).y : groundHeight(x, z);
      stand(frodo, x, y, z, face);
      pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
      if (s.hidden) frodo.group.position.y -= 0.25;
      // Sam at your heels
      const sx = x - Math.cos(face) * 1.3 + Math.sin(face) * 0.5;
      const sz = z + Math.sin(face) * 1.3 + Math.cos(face) * 0.5;
      tmp2.set(sx, zone === 'slope' && !s.search ? y : groundHeight(sx, sz), sz);
      sam.group.visible = true;
      sam.group.position.lerp(tmp2, sam.group.position.distanceTo(tmp2) > 6 ? 1 : Math.min(1, dt * 4));
      sam.group.rotation.set(0, face, 0);
      sit(sam, false);
      pose(sam, t + 1, { moving: h.speed > 0.3 });
    }
    if (frodo.group.rotation.z !== 0 && s.talking !== 'foot' && s.mode !== 'remember') frodo.group.rotation.z = 0;
    // other travellers, crossing the plain
    ghosts.update(zone === 'plain' ? (s.travellers ?? []) : [], t, dt);

    // ash in the air, everywhere but inside
    if (!inNaur) {
      A.ash += dt * (12 + A.erupt * 30) * Math.max(0.4, many);
      const lp = lead.group.position;
      while (A.ash > 1) {
        A.ash -= 1;
        ash.emit(lp.x + R(30), lp.y + 3 + Math.random() * 10, lp.z + R(30), 1.2, -0.3, 0.5, 7, 0.08, 0.06, 1);
      }
    }
    ash.step(dt);
    sparks.step(dt);
    A.hit = Math.max(0, A.hit - dt * 2);
    fx.step(dt, t, { night: 0.6, day: 0.4 });

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
    const fp = frodo.group.position;
    const sp = sam.group.position;
    if (inNaur) {
      if (s.mode === 'hang') {
        camAt = tmp.set(NAUR.x + EDGE.x + 2.6, NAUR.y + 0.4, NAUR.z + 4.2);
        camLook = look.set(NAUR.x + EDGE.x + 0.2, NAUR.y - 0.9, NAUR.z);
      } else if (s.talking === 'done') {
        camAt = tmp.set(NAUR.x + EDGE.x - 4, NAUR.y + 2.2, NAUR.z + 4);
        camLook = look.set(NAUR.x + EDGE.x + 3, NAUR.y - 14, NAUR.z);
      } else if (s.line === 'fall') {
        camAt = tmp.set(NAUR.x + EDGE.x - 1, NAUR.y + 3, NAUR.z + 3);
        camLook = look.copy(gollum.group.position);
      } else {
        // along the spur past Sam, the fire beyond
        camAt = tmp.set(NAUR.x + 5.5, NAUR.y + 2.1, NAUR.z + 3.2);
        camLook = look.set(NAUR.x + EDGE.x, NAUR.y + 0.3, NAUR.z);
      }
    } else if (marching) {
      // side on to the column
      const [, , a] = marchAt(m.s);
      camAt = tmp.copy(fp).add(V(-Math.sin(a) * -8 - Math.cos(a) * 2, 3.4, Math.cos(a) * -8 - Math.sin(a) * 2));
      camLook = look.copy(fp).add(V(Math.cos(a) * 3, 0.9, Math.sin(a) * 3));
    } else if (s.mode === 'carry' || s.talking === 'door') {
      // from the road itself a few steps back (so never inside the
      // mountain), out over the edge a little and above
      const k = s.talking === 'door' ? 0.995 : 0.82 + 0.18 * ((s.carry?.s ?? 0) / CARRY.len);
      const out = V(sp.x - DOOM.x, 0, sp.z - DOOM.z).normalize();
      camAt = roadAt(k - 0.005, tmp).addScaledVector(out, 2.6).add(V(0, 2.8, 0));
      camLook = roadAt(Math.min(1, k + 0.003), look).lerp(sp, 0.5).add(V(0, 0.9, 0));
    } else if (s.mode === 'flight' || (s.mode === 'end' && done.includes('eagles'))) {
      const gp = gwaihir.group.position;
      camAt = tmp.copy(gp).addScaledVector(FLY_DIR, s.mode === 'end' ? 22 : -16).add(V(0, s.mode === 'end' ? 4 : 6, 0));
      camLook = s.mode === 'end' ? look.copy(summit) : look.copy(gp).addScaledVector(FLY_DIR, 14).add(V(0, -2, 0));
    } else if (s.talking === 'refuge') {
      camAt = tmp.copy(seat).add(V(-7, 3.2, 6));
      camLook = s.line === 'eagles' ? look.copy(seat).add(V(10, 8, -4)) : look.copy(seat).add(V(0, 0.8, 0));
    } else if (s.talking === 'foot' || s.mode === 'remember') {
      // the two of them at the foot: Frodo down, Sam a step off to his left
      camAt = tmp.copy(fp).add(V(1.8, 2.0, 4.6));
      camLook = look.copy(fp).add(V(-0.7, 0.9, 0.4));
    } else if (s.talking === 'column' || s.talking === 'halt' || (s.mode === 'walk' && !s.search && s.next === 'column')) {
      // from the road, out over the plain to the mountain
      // behind and beside you two, out to the mountain
      const to = tmp2.copy(summit).sub(fp).setY(0).normalize();
      camAt = tmp.copy(fp).addScaledVector(to, -6.5).add(V(to.z * 2.4, 2.4, -to.x * 2.4));
      camLook = look.copy(fp).addScaledVector(to, 20).add(V(0, 3.2, 0));
    } else if (s.mode === 'walk' && !s.search && zone === 'slope') {
      // waiting below the door: up the mountain
      const out = tmp2.copy(fp).sub(V(DOOM.x, fp.y, DOOM.z)).setY(0).normalize();
      camAt = tmp.copy(fp).addScaledVector(out, 7).add(V(0, 2.6, 0));
      camLook = look.copy(fp).lerp(doorAt, 0.06).add(V(0, 1.2, 0));
    } else if (s.mode === 'end') {
      camAt = tmp.set(CROSS_START.x - 20, groundHeight(CROSS_START.x, CROSS_START.z) + 12, CROSS_START.z + 30);
      camLook = look.copy(summit);
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.34;
      const dist = s.camDist ?? 6.4;
      look.set(fp.x, fp.y + 1.1, fp.z);
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const floor = groundHeight(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const key = `${zone}|${s.mode}|${s.talking ?? ''}|${s.line === 'fall' ? 'f' : ''}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'march' || s.mode === 'carry' || s.mode === 'flight';
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
    const fov = s.mode === 'hang' ? 46 : 52;
    A.fov += (fov - A.fov) * Math.min(1, dt * 3);
    if (Math.abs(camera.fov - A.fov) > 0.01) {
      camera.fov = A.fov;
      camera.updateProjectionMatrix();
    }
    sky.dome.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 80);
    sun.target.position.copy(camera.position);
    const seen = s.search?.seen ?? 0;
    stage.grade({ saturation: 0.95 - seen * 0.4, contrast: 0.12 + seen * 0.15, vignette: 0.3 + seen * 0.4, grain: 0.02, shadow: [0.03, 0.01, 0.0], high: [0.06 + seen * 0.1, 0.02, 0] });
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type) => {
    if (type === 'lash') {
      A.lash = 1;
      A.shake = Math.max(A.shake, 0.1);
    } else if (type === 'found') A.shake = 0.3;
    else if (type === 'tremor') A.shake = Math.max(A.shake, 0.3);
    else if (type === 'stumble') A.shake = Math.max(A.shake, 0.2);
    else if (type === 'caught') A.shake = 0.15;
    else if (type === 'erupt') A.shake = 0.5;
    else if (type === 'recall') fx.pop(tmp2.copy(frodo.group.position).add(V(-0.3, 1.1, 0.3)), 'gold', 10, 0.6);
    else if (type === 'hit') {
      A.shake = 0.4;
      A.hit = 1;
    }
  };

  return {
    scene: import.meta.env.DEV ? scene : null,
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
      ghosts.dispose();
      disposeTree(scene);
      stage.dispose();
    },
  };
}
