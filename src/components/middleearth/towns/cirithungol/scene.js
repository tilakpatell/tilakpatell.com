// Cirith Ungol, in WebGL: the shelf above the Morgul road with the dead
// city glowing across its valley and the host pouring over its bridge; the
// endless stairs up the black cliff; Shelob's tunnels, dark but for the
// phial, and the pass beyond where Sam fights her; and the courtyard of
// the orcs' Tower by torchlight. And on the side, the night on the stair:
// Sam asleep under his cloak, and Gollum's crumbs on it. Made in code
// (./props.js, ../ground.js), so nothing is downloaded.
//
// The four places are drawn apart in one scene, and only the one you're
// in is shown. It draws what the component hands it and decides nothing.
//
// createCirithUngolWorld(canvas) returns { render(state, ms, fast),
// fx(type), screenOf(), resize, dispose, lost, info }.

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
import { createGollum } from '../marshes/props';
import { createGhosts } from '../ghosts';
import { createCirithKit } from './props';
import { BRAWL, BRIDGE, CITY_YAW, COURT, HIDE, LAIR_OUT, MORGUL_ROAD, PASS, TOWER_DOOR, TOWER_PILLARS, TUNNELS, roughHeight, stairAt } from './layout';
import { CRUMBS, STAIRS, cloakLift } from './rules';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
// where each place is drawn
const AT = { vale: V(0, 0, 0), stairs: V(1500, 0, 0), lair: V(3000, 0, 0), tower: V(4500, 0, 0) };

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
const bump = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));
const noise = makeNoise(61);

// ── the ground of each place ──
// The vale: the shelf you hide on, high above the road; the road below
// it; the river's gorge under the bridge; mountains all round.
function valeHeight(x, z) {
  let h = 12 * smooth(12, -2, z);
  h += smooth(-40, -200, z) * 60 + smooth(110, 260, Math.abs(x - 20)) * 70;
  h -= 22 * bump(z, 150, 22) * (1 - smooth(60, 120, Math.abs(x - BRIDGE.x)));
  h += (fbm(noise, x * 0.05, z * 0.05, { octaves: 3 }) - 0.5) * 3;
  // the hollow you crouch in
  h -= 0.8 * bump(Math.hypot(x - HIDE.x, z - HIDE.z), 0, 2.5);
  return h;
}
// the pass, out of the tunnels: a cleft, the rock rising either side
function passHeight(x, z) {
  let h = -0.4 + smooth(78.5, 82, x) * (0.4 + roughHeight(x, z));
  h += smooth(5, 15, Math.abs(z - PASS.z)) * 18;
  h += smooth(80.5, 74, x) * smooth(2, 5, Math.abs(z - LAIR_OUT.z)) * 22;
  return h;
}
const deepHeight = (x, z) => -58 + (fbm(noise, x * 0.03, z * 0.03, { octaves: 3 }) - 0.5) * 14;

const ROCK = C(0x2a2c2a);
const ROCK_PALE = C(0x4a4e4a);
const ROAD_C = C(0x3a3a34);
const paints = {
  vale: (x, z, h, out) => {
    lerp3(out, ROCK, ROCK_PALE, smooth(0.4, 0.75, fbm(noise, x * 0.08, z * 0.08, { octaves: 3 })));
    let d = Infinity;
    for (let i = 1; i < MORGUL_ROAD.length; i++) {
      const [ax, az] = MORGUL_ROAD[i - 1];
      const [bx, bz] = MORGUL_ROAD[i];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return lerp3(out, out, ROAD_C, 1 - smooth(3, 5, d));
  },
  deep: (x, z, h, out) => lerp3(out, C(0x141614), C(0x24282a), smooth(0.4, 0.7, fbm(noise, x * 0.05, z * 0.05, { octaves: 2 }))),
  pass: (x, z, h, out) => lerp3(out, C(0x3a3430), C(0x6a5e54), smooth(0.4, 0.75, fbm(noise, x * 0.2, z * 0.2, { octaves: 3 }))),
};

// ── the light of each place ──
const MOODS = {
  vale: { top: 0x030806, horizon: 0x1c3a2c, sun: [0.1, 0.5, 0.9], sunColour: 0x7ad0a8, sunPower: 0.7, hemiSky: 0x4a7a64, hemiGround: 0x0a100c, hemi: 1.1, fog: 0x0c1c16, fogNear: 40, fogFar: 560, cloud: 0.7, cloudColour: 0x183026, stars: 0.25, exposure: 1.45 },
  stairs: { top: 0x05080c, horizon: 0x1c2e28, sun: [0.4, 0.5, 0.8], sunColour: 0xa8c4d4, sunPower: 1.4, hemiSky: 0x6a8494, hemiGround: 0x101416, hemi: 1.7, fog: 0x0e1a18, fogNear: 30, fogFar: 300, cloud: 0.8, cloudColour: 0x1a2426, stars: 0.35, exposure: 1.45 },
  lair: { top: 0x020203, horizon: 0x05060a, sun: [0.2, 0.9, 0.3], sunColour: 0x6a7a90, sunPower: 0.12, hemiSky: 0x3a4658, hemiGround: 0x050506, hemi: 0.42, fog: 0x020304, fogNear: 3, fogFar: 24, cloud: 0.2, cloudColour: 0x0a0a0c, stars: 0, exposure: 1.6 },
  pass: { top: 0x06060a, horizon: 0x4a2014, sun: [0.6, 0.4, -0.3], sunColour: 0xd08a60, sunPower: 1.2, hemiSky: 0x8a7470, hemiGround: 0x1a1210, hemi: 1.8, fog: 0x1a100e, fogNear: 20, fogFar: 140, cloud: 0.85, cloudColour: 0x2a1610, stars: 0, exposure: 1.45 },
  tower: { top: 0x140806, horizon: 0x7a2c18, sun: [-0.3, 0.5, -0.6], sunColour: 0xd07050, sunPower: 0.7, hemiSky: 0x8a5a4a, hemiGround: 0x140c0a, hemi: 0.95, fog: 0x2a1410, fogNear: 30, fogFar: 170, cloud: 0.8, cloudColour: 0x3a1a12, stars: 0, exposure: 1.35 },
};
const COLOURS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour'];
const NUMBERS = ['sunPower', 'hemi', 'fogNear', 'fogFar', 'cloud', 'stars', 'exposure'];

// the host's road: out of the gate, over the bridge, along under the shelf
const HOST_PATH = [[BRIDGE.x, BRIDGE.z + BRIDGE.len / 2], ...MORGUL_ROAD];
const HOST_LEN = (() => {
  let n = 0;
  for (let i = 1; i < HOST_PATH.length; i++) n += Math.hypot(HOST_PATH[i][0] - HOST_PATH[i - 1][0], HOST_PATH[i][1] - HOST_PATH[i - 1][1]);
  return n;
})();
// the point `d` metres along it: [x, z, angle]
function alongHost(d) {
  let left = Math.max(0, Math.min(HOST_LEN, d));
  for (let i = 1; i < HOST_PATH.length; i++) {
    const [ax, az] = HOST_PATH[i - 1];
    const [bx, bz] = HOST_PATH[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (left <= len || i === HOST_PATH.length - 1) {
      const u = Math.min(1, left / len);
      return [ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bz - az, bx - ax)];
    }
    left -= len;
  }
  return [HOST_PATH[0][0], HOST_PATH[0][1], 0];
}
// along the stair, the way it climbs there
const stairFace = (s) => {
  const a = stairAt(Math.max(0, s - 0.5));
  const b = stairAt(Math.min(STAIRS.len, s + 0.5));
  return Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
};

export function createCirithUngolWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 52, near: 0.1, far: 2000, bloom: { strength: 0.8, radius: 0.6, threshold: 0.8 }, onLost });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x0c1c16, 40, 560);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35;

  const hemi = new THREE.HemisphereLight(0x4a7a64, 0x0a100c, 1);
  const sun = new THREE.DirectionalLight(0x7ad0a8, 1);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    scene.add(l);
    return l;
  });
  const sky = makeSky(1600);
  scene.add(sky.dome);

  const kit = createCirithKit(renderer);
  const mats = kit.mats ?? {};
  const zones = { vale: new THREE.Group(), stairs: new THREE.Group(), lair: new THREE.Group(), tower: new THREE.Group() };
  for (const [k, g] of Object.entries(zones)) {
    g.position.copy(AT[k]);
    scene.add(g);
  }
  const wpos = (zone, x, y, z, out = V()) => out.set(AT[zone].x + x, AT[zone].y + y, AT[zone].z + z);
  const rockMat = mats.rock ?? new THREE.MeshLambertMaterial({ vertexColors: true });
  const rockGeo = (seed) => kit.rock?.(seed) ?? new THREE.DodecahedronGeometry(1, 0);

  // ── the Morgul vale ──
  zones.vale.add(makeTerrain(renderer, { size: 640, seg: tier === 'high' ? 200 : 120, height: valeHeight, paint: paints.vale, blades: 0 }));
  const morgul = kit.morgul();
  // the bridge runs out from the gate along the kit's +z; here, north
  morgul.group.position.set(BRIDGE.x, 0, BRIDGE.z + BRIDGE.len / 2);
  morgul.group.rotation.y = Math.PI;
  zones.vale.add(morgul.group);
  morgul.group.updateMatrixWorld(true);
  const deckEnd = morgul.bridgeEnd ? morgul.bridgeEnd.y : 0;
  // the rocks you hide among, lower to the south so you can see over
  {
    const ring = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + 0.2;
      const r = 2.4 + (i % 3) * 0.7;
      const x = HIDE.x + Math.cos(a) * r;
      const z = HIDE.z + Math.sin(a) * r;
      const south = Math.max(0, Math.sin(a));
      ring.push({ x, z, y: valeHeight(x, z) - 0.3, s: 0.7 + (1 - south) * 0.6 + (i % 2) * 0.2, turn: i * 1.9 });
    }
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996;
      const r = 8 + (i % 7) * 4;
      const x = HIDE.x + Math.cos(a) * r;
      const z = HIDE.z - Math.abs(Math.sin(a)) * r * 0.8 + 2;
      ring.push({ x, z, y: valeHeight(x, z) - 0.4, s: 1 + (i % 4) * 0.5, turn: i * 0.7 });
    }
    zones.vale.add(instances(rockGeo(1), rockMat, ring.filter((_, i) => i % 2 === 0), { shadow: false }));
    zones.vale.add(instances(rockGeo(2), rockMat, ring.filter((_, i) => i % 2 === 1), { shadow: false }));
  }
  const hostGeo = kit.orcColumn?.();
  const host = hostGeo ? new THREE.InstancedMesh(hostGeo, mats.orc ?? new THREE.MeshLambertMaterial({ vertexColors: true }), 80) : null;
  if (host) {
    host.frustumCulled = false;
    zones.vale.add(host);
  }
  const witch = kit.witchKing?.();
  if (witch) zones.vale.add(witch.group);

  // ── the stairs ──
  const stairs = kit.stairs({ at: stairAt, len: STAIRS.len, steps: 260 });
  zones.stairs.add(stairs.group);
  {
    const deep = makeTerrain(renderer, { size: 500, seg: 70, height: deepHeight, paint: paints.deep, blades: 0 });
    deep.position.z = 200;
    zones.stairs.add(deep);
  }
  const greenBelow = V(40, -40, 160);
  // on the side, the night on the stair: Sam's cloak over his legs as he
  // sleeps against the rock on the shelf at the top (./props.js stairs()),
  // the lembas crumbs Gollum dusted on it, and your hand over it (CRUMBS:
  // u across, v out from the rock)
  const [cx, cy, cz] = stairAt(STAIRS.len);
  const CLOAK = V(cx + 1.6, cy + 0.02, cz + 0.25);
  const cloakMesh = (() => {
    const g = new THREE.PlaneGeometry(CRUMBS.w + 0.16, CRUMBS.d + 0.12, 28, 20).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, cloakLift(p.getX(i), p.getZ(i)) - 0.012 * Math.max(0, Math.abs(p.getX(i)) * 2 - CRUMBS.w + 0.1));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x55604c, roughness: 0.95, side: THREE.DoubleSide }));
    m.position.copy(CLOAK);
    m.visible = false;
    zones.stairs.add(m);
    return m;
  })();
  // (the cloak, the crumbs and the ring sit in zones.stairs, which is already at AT.stairs)
  const crumbGeo = new THREE.IcosahedronGeometry(0.011, 0);
  const crumbMat = new THREE.MeshStandardMaterial({ color: 0xf2e4b4, roughness: 0.8, emissive: 0x3a3220 });
  const crumbs = Array.from({ length: CRUMBS.n }, () => {
    const m = new THREE.Mesh(crumbGeo, crumbMat);
    m.visible = false;
    zones.stairs.add(m);
    return m;
  });
  const handRing = new THREE.Mesh(new THREE.RingGeometry(CRUMBS.reach * 0.8, CRUMBS.reach, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xcdbb8a, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false }));
  handRing.renderOrder = 3;
  handRing.visible = false;
  zones.stairs.add(handRing);

  // ── Shelob's lair, and the pass ──
  const tunnels = kit.tunnels(TUNNELS, { r: 1.6 });
  zones.lair.add(tunnels.group);
  {
    const cx = PASS.x + 8;
    const cz = PASS.z;
    const pass = makeTerrain(renderer, { size: 70, seg: tier === 'high' ? 90 : 60, height: (x, z) => passHeight(x + cx, z + cz), paint: (x, z, h, out) => paints.pass(x + cx, z + cz, h, out), blades: 0 });
    pass.position.set(cx, 0, cz);
    zones.lair.add(pass);
    const rocks = [];
    for (let i = 0; i < 14; i++) {
      const x = 84 + i * 3.1;
      const side = i % 2 ? 1 : -1;
      const z = PASS.z + side * (9.5 + (i % 3) * 1.8);
      rocks.push({ x, z, y: passHeight(x, z) - 0.6, s: 1.2 + (i % 4) * 0.5, turn: i * 2.1 });
    }
    zones.lair.add(instances(rockGeo(3), rockMat, rocks, { shadow: false }));
  }
  const shelob = kit.shelob();
  zones.lair.add(shelob.group);
  const silk = kit.silk();
  silk.group.position.set(PASS.x + 4.6, 0.1 + roughHeight(PASS.x + 4.6, PASS.z + 1.6), PASS.z + 1.6);
  zones.lair.add(silk.group);
  const phial = kit.phial();
  scene.add(phial.group);

  // ── the Tower ──
  const court = kit.court({ w: COURT.w, d: COURT.d, pillars: TOWER_PILLARS, door: TOWER_DOOR });
  zones.tower.add(court.group);
  court.group.updateMatrixWorld(true);
  const torches = (court.torches ?? []).map((p) => p.clone().add(AT.tower));
  const orcs = Array.from({ length: 3 }, (_, i) => {
    const o = kit.orc(i + 1, { big: i === 1 });
    o.group.visible = false;
    zones.tower.add(o.group);
    return o;
  });
  const brawl = Array.from({ length: 4 }, (_, i) => {
    const o = kit.orc(10 + i, { big: i === 0 });
    const a = (i / 4) * TAU + 0.4;
    o.group.position.set(BRAWL.x + Math.cos(a) * BRAWL.r * 0.7, 0, BRAWL.z + Math.sin(a) * BRAWL.r * 0.7);
    o.group.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a));
    o.seed = i;
    zones.tower.add(o.group);
    return o;
  });
  // other travellers, online, from other worlds (../ghosts.js), in whichever
  // zone you're walking (the courtyard's ground and the tunnels' are flat;
  // only those in the same zone are listed)
  const ghosts = createGhosts();
  zones.tower.add(ghosts.group);

  // ── people ──
  const blobGeo = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blob = (f) => {
    const b = new THREE.Mesh(blobGeo, blobMat);
    b.position.y = 0.04;
    b.renderOrder = 1;
    f.group.add(b);
    return f;
  };
  const frodo = blob(folk('frodo'));
  const sam = blob(folk('sam'));
  scene.add(frodo.group, sam.group);
  const gollum = createGollum(renderer);
  scene.add(gollum.group);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const embers = createParticles(Math.round(220 * Math.max(0.4, many)), {
    ramp: [
      [0, 1, 0.6, 0.3, 0],
      [0.15, 1, 0.55, 0.25, 0.9],
      [1, 0.6, 0.2, 0.1, 0],
    ],
    additive: true,
    gravity: 0.6,
    drag: 0.4,
    swirl: 0.6,
  });
  scene.add(embers.mesh);
  const dust = createParticles(Math.round(160 * Math.max(0.4, many)), {
    ramp: [
      [0, 0.7, 0.75, 0.8, 0],
      [0.3, 0.7, 0.75, 0.8, 0.35],
      [1, 0.6, 0.65, 0.7, 0],
    ],
    additive: false,
    gravity: -0.05,
    drag: 0.6,
    swirl: 0.4,
  });
  scene.add(dust.mesh);

  // ── state ──
  const cur = {};
  for (const k of COLOURS) cur[k] = new THREE.Color(MOODS.vale[k]);
  for (const k of NUMBERS) cur[k] = MOODS.vale[k];
  const sunDir = V(...MOODS.vale.sun).normalize();
  const A = { t: 0, cam: { at: V(0, 4, 10), look: V(0, 2, -10) }, mode: '', shake: 0, first: true, beam: 0, stab: 0, dodge: 0, hit: 0, embers: 0, dust: 0, fov: 52, mood: '' };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const target = new THREE.Color();
  const phialCol = new THREE.Color(0xd8ecff);
  const torchCol = new THREE.Color(0xff8a40);
  const greenCol = new THREE.Color(0x6aff9a);
  const dawnCol = new THREE.Color(0xc8d4e8);
  const hostM = new THREE.Matrix4();
  const hostQ = new THREE.Quaternion();
  const hostE = new THREE.Euler();
  const hostS = V(1, 1, 1);
  const hidden = V(0, 0, 0);
  const turnTo = (p, face, dt, k = 4) => {
    let d = face - p.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.group.rotation.y += d * Math.min(1, dt * k);
  };
  const stand = (f, zone, x, y, z, face) => {
    f.group.visible = true;
    wpos(zone, x, y, z, f.group.position);
    f.group.rotation.set(0, face, 0);
    sit(f, false);
  };
  // the phial in a hand, raised or at the side
  const holdPhial = (f, up) => {
    const fp = f.group.position;
    const fa = f.group.rotation.y;
    const fwd = V(Math.cos(fa), 0, -Math.sin(fa));
    const side = V(Math.sin(fa), 0, Math.cos(fa));
    phial.group.position.copy(fp).addScaledVector(fwd, 0.25 + up * 0.1).addScaledVector(side, 0.25).add(V(0, 0.7 + up * 0.75, 0));
    if (f.arms?.[1]) f.arms[1].rotation.x = -2.5 * up;
  };

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const zone = s.zone;
    sky.uniforms.uTime.value = t;
    kit.tick?.(t);
    for (const [k, g] of Object.entries(zones)) g.visible = k === zone;
    const h = s.hobbit;
    const lights = [];
    const outside = zone === 'lair' && (s.mode === 'duel' || s.talking === 'sam' || s.talking === 'frodo' || h.x > 77);

    // ── the light ──
    const moodKey = outside ? 'pass' : zone;
    const mood = MOODS[moodKey];
    const ease = A.first || A.mood !== moodKey ? (A.first ? 1 : Math.min(1, dt * 1.5)) : Math.min(1, dt * 1.5);
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

    // everyone hidden, then placed by the place and what's happening
    frodo.group.visible = false;
    sam.group.visible = false;
    gollum.group.visible = false;
    phial.group.visible = false;
    if (frodo.arms?.[1]) frodo.arms[1].rotation.x = 0;
    if (sam.arms?.[1]) sam.arms[1].rotation.x = 0;
    let lead = frodo;

    // ── the Morgul vale ──
    if (zone === 'vale') {
      const m = s.morgul;
      const watching = s.mode === 'morgul';
      const wantBeam = watching || (s.talking === 'morgul' && s.line === 'light') ? 1 : 0;
      A.beam += (wantBeam - A.beam) * Math.min(1, dt * (wantBeam ? 1.2 : 0.4));
      morgul.update?.(t, { beam: A.beam, glow: 1 + A.beam * 0.4 + (m?.pausing ? 0.3 : 0) });
      // crouched among the rocks, Sam by you, Gollum flat on the rock
      stand(frodo, 'vale', HIDE.x, valeHeight(HIDE.x, HIDE.z) - 0.3, HIDE.z, CITY_YAW - Math.PI / 2);
      sit(frodo, true);
      stand(sam, 'vale', HIDE.x - 1.1, valeHeight(HIDE.x - 1.1, HIDE.z - 0.5) - 0.3, HIDE.z - 0.5, CITY_YAW - Math.PI / 2 + 0.3);
      sit(sam, true);
      gollum.group.visible = true;
      wpos('vale', HIDE.x + 1.3, valeHeight(HIDE.x + 1.3, HIDE.z - 0.4), HIDE.z - 0.4, gollum.group.position);
      gollum.group.rotation.set(0, CITY_YAW - Math.PI / 2 - 0.4, 0);
      gollum.animate?.(t, { pose: 'crouch', look: s.speaker === 'gollum' ? Math.sin(t * 6) * 0.3 : 0 });
      // the host, out of the gate and over the bridge
      if (host) {
        const go = m ? m.t : -1;
        const n = host.count;
        for (let i = 0; i < n; i++) {
          const row = Math.floor(i / 4);
          const file = (i % 4) - 1.5;
          const d = go * 3.4 - row * 1.5;
          if (d < 0 || d > HOST_LEN - 2) {
            hostM.compose(hidden, hostQ.identity(), hidden);
            host.setMatrixAt(i, hostM);
            continue;
          }
          const [x, z, a] = alongHost(d);
          const px = x - Math.sin(a) * file * 1.1;
          const pz = z + Math.cos(a) * file * 1.1;
          const y = d < BRIDGE.len ? (d / BRIDGE.len) * deckEnd : valeHeight(px, pz);
          hostE.set(0, -a, 0);
          hostQ.setFromEuler(hostE);
          hostM.compose(tmp2.set(px, y + Math.abs(Math.sin(t * 6 + row)) * 0.05, pz), hostQ, hostS);
          host.setMatrixAt(i, hostM);
        }
        host.instanceMatrix.needsUpdate = true;
      }
      // the Witch-king on his beast, over the bridge; when he stops he turns
      // his head towards you
      if (witch) {
        witch.group.visible = Boolean(m) || s.talking === 'morgul';
        const mt = m ? m.t : 0;
        const d = Math.min(BRIDGE.len * 0.8, mt * 2.2);
        const [x, z, a] = alongHost(d);
        wpos('vale', x, deckEnd + 16 + Math.sin(t * 0.8) * 1.2, z, witch.group.position);
        const face = -a;
        turnTo(witch, m?.pausing ? Math.atan2(-(HIDE.z - z), HIDE.x - x) : face, dt, 1.2);
        witch.animate?.(t, { flap: m?.pausing ? 0.4 : 1, turn: m?.pausing ? 0.9 : 0 });
      }
      lights.push([wpos('vale', BRIDGE.x, 30, BRIDGE.z + 60), greenCol, 60 + A.beam * 80, 420]);
    } else {
      A.beam = 0;
    }

    // ── the night on the stair, on the side ──
    const cr = zone === 'stairs' && s.mode === 'crumbs' ? s.crumbs : null;
    cloakMesh.visible = Boolean(cr);
    handRing.visible = Boolean(cr && cr.state === 'on');
    crumbs.forEach((m, i) => {
      const c = cr?.crumbs[i];
      m.visible = Boolean(c && !c.gone);
      if (!m.visible) return;
      m.position.set(CLOAK.x + c.u, CLOAK.y + cloakLift(c.u, c.v) + 0.006, CLOAK.z + c.v);
      m.scale.setScalar(c.size);
      m.rotation.set(c.turn, c.turn * 2, 0);
    });
    if (cr) {
      handRing.position.set(CLOAK.x + cr.hand.u, CLOAK.y + cloakLift(cr.hand.u, cr.hand.v) + 0.015, CLOAK.z + cr.hand.v);
      handRing.material.opacity = 0.35 + 0.15 * Math.sin(t * 5);
      // Sam asleep against the rock, the cloak over his legs
      // (pose first: it straightens the legs, and sit bends them)
      stand(sam, 'stairs', CLOAK.x - 0.05, CLOAK.y, CLOAK.z - CRUMBS.d / 2 - 0.05, -Math.PI / 2);
      pose(sam, t * 0.3, { moving: false });
      sit(sam, true);
      sam.head.rotation.z = 0.35 + Math.sin(t * 0.8) * 0.03;
      // Frodo asleep by him, stirring as the light comes
      const stir = Math.max(0, 1 - (t - (A.stirAt ?? -9)) / 1.4);
      stand(frodo, 'stairs', CLOAK.x + CRUMBS.w / 2 + 0.55, CLOAK.y, CLOAK.z - 0.3, -Math.PI / 2 - 0.4);
      pose(frodo, t * 0.3 + 2, { moving: false });
      sit(frodo, true);
      frodo.head.rotation.z = -0.4 + Math.sin(t * 9) * 0.12 * stir;
      frodo.group.rotation.z = 0.1 * stir * Math.sin(t * 6);
      // Gollum, a few steps up, watching
      gollum.group.visible = true;
      wpos('stairs', CLOAK.x - CRUMBS.w / 2 - 0.9, CLOAK.y + 0.15, CLOAK.z - 0.35, gollum.group.position);
      gollum.group.rotation.set(0, -0.3, 0);
      gollum.animate?.(t, { pose: 'crouch', speed: 0, look: Math.sin(t * 1.3) * 0.25 });
      // the grey before dawn coming, and a little of it on the cloak
      const k = Math.min(1, (cr.t + cr.late) / CRUMBS.time);
      lights.push([V(CLOAK.x + 0.4, CLOAK.y + 1.9, CLOAK.z + 1.4).add(AT.stairs), dawnCol, 1.3 + k * 2.5, 7]);
      lights.push([greenBelow.clone().add(AT.stairs), greenCol, 40, 260]);
    }

    // ── the stairs ──
    if (zone === 'stairs' && !cr) {
      const c = s.climb;
      const top = s.mode === 'talk' && s.talking === 'lembas';
      const at = top ? STAIRS.len : (c?.s ?? 0);
      const [x, y, z] = stairAt(at);
      stand(frodo, 'stairs', x, y, z, stairFace(at));
      pose(frodo, t, { moving: Boolean(c && s.mode === 'climb' && !c.spent && s.climbing), speed: 0.7 });
      if (c?.spent) sit(frodo, true);
      // Gollum ahead, Sam behind
      gollum.group.visible = true;
      const ga = Math.min(STAIRS.len, at + (top ? 0 : 3.5));
      const [gx, gy, gz] = stairAt(ga);
      wpos('stairs', gx + (top ? 1.6 : 0), gy, gz + (top ? 0.2 : 0), gollum.group.position);
      gollum.group.rotation.set(0, top ? Math.PI : stairFace(ga), 0);
      gollum.animate?.(t, { pose: top ? 'crouch' : 'crawl', speed: s.climbing ? 1 : 0, look: s.speaker === 'gollum' ? Math.sin(t * 6) * 0.3 : 0 });
      const sa = Math.max(0, at - (top ? 0 : 2.2));
      const [sx, sy, sz] = stairAt(sa);
      // at the foot, beside you rather than in you
      const beside = !top && at < 2.2 ? 1.3 : 0;
      stand(sam, 'stairs', sx - (top ? 1.4 : 0) - beside, sy, sz + (top ? 0.2 : 0) + beside * 0.3, top ? 0 : stairFace(sa));
      pose(sam, t + 1, { moving: Boolean(s.climbing), speed: 0.7 });
      if (top && (s.line === 'crumbs' || !s.line)) sit(sam, true);
      if (top && s.line === 'go') {
        // Sam turns back down the stair
        sam.group.rotation.y = stairFace(at) + Math.PI;
      }
      lights.push([greenBelow.clone().add(AT.stairs), greenCol, 40, 260]);
    }

    // ── Shelob's lair, and the pass ──
    const sh = s.shelob;
    shelob.group.visible = false;
    silk.group.visible = false;
    if (zone === 'lair') {
      const duel = s.duel;
      if (s.mode === 'duel' || s.talking === 'sam' || s.talking === 'frodo') {
        // the pass: Sam, Sting and the phial; her, and Frodo in silk
        lead = sam;
        silk.group.visible = true;
        const sx = PASS.x - 2.6;
        let sz = PASS.z;
        A.dodge = Math.max(0, A.dodge - dt * 1.6);
        A.stab = Math.max(0, A.stab - dt * 3);
        sz += Math.sin(A.dodge * Math.PI) * 1.3;
        const lunge = Math.sin(A.stab * Math.PI) * 0.6;
        stand(sam, 'lair', sx + lunge, roughHeight(sx, sz), sz, 0);
        pose(sam, t, { moving: duel?.phase === 'stalk', speed: 0.4 });
        if (sam.arms?.[0]) sam.arms[0].rotation.x = -1.2 - A.stab * 1.2;
        if (s.talking === 'frodo') {
          // kneeling by him, the silk cut
          stand(sam, 'lair', PASS.x + 3.6, roughHeight(PASS.x + 3.6, PASS.z + 1), PASS.z + 1, -0.54);
          sit(sam, true);
        } else {
          phial.group.visible = true;
          holdPhial(sam, 0.85);
          phial.set?.(0.62);
          lights.push([phial.group.position.clone(), phialCol, 2.4, 16]);
        }
        lights.push([wpos('lair', PASS.x + 60, 30, PASS.z), torchCol, 60, 220]);
        if (s.talking === 'frodo') {
          phial.group.visible = true;
          phial.group.position.copy(sam.group.position).add(V(0.5, 0.15, 0.5));
          phial.set?.(0.35);
          lights.push([phial.group.position.clone(), phialCol, 1.4, 10]);
        }
        const fled = s.talking === 'frodo';
        shelob.group.visible = !fled;
        if (!fled) {
          const ph = duel?.phase ?? 'stalk';
          const k = duel ? Math.max(0, duel.phaseT) : 0;
          const near = ph === 'strike' ? 1.4 : ph === 'tell' ? -0.4 : ph === 'rear' ? 0.6 : 0;
          shelob.group.position.set(PASS.x + 1.6 - near + Math.sin(t * 0.9) * 0.3, roughHeight(PASS.x + 1.6, PASS.z), PASS.z + Math.sin(t * 0.6) * 0.4);
          shelob.group.rotation.set(0, Math.PI, 0);
          shelob.animate?.(t, {
            walking: ph === 'stalk' ? 0.5 : 0,
            rear: ph === 'rear' ? 1 : 0,
            strike: ph === 'strike' ? 1 : ph === 'tell' ? 0.25 : 0,
            hurt: (duel?.wounds ?? 0) / 4 + A.hit * 0.3,
            recoil: ph === 'tell' ? 0.5 : ph === 'recover' ? Math.min(1, k) * 0.4 : 0,
          });
        }
      } else {
        // in the tunnels: Frodo, and her
        stand(frodo, 'lair', h.x, 0, h.z, h.face);
        pose(frodo, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
        const ph = s.phial;
        phial.group.visible = true;
        const up = ph?.on ? 1 : 0;
        holdPhial(frodo, up);
        const glow = ph ? (ph.on ? 0.45 + ph.charge * 0.28 : 0.08) : 0.08;
        phial.set?.(glow);
        lights.push([phial.group.position.clone(), phialCol, ph?.on ? 1.4 + ph.charge * 2.2 : 0.6, ph?.on ? 20 : 6]);
        if (sh) {
          shelob.group.visible = true;
          shelob.group.position.set(sh.x, 0, sh.z);
          turnTo(shelob, sh.face + (sh.look ?? 0), dt, 5);
          const moving = sh.mode === 'chase' || sh.mode === 'back' || (sh.mode === 'patrol' && sh.wait <= 0);
          shelob.animate?.(t, { walking: moving ? (sh.mode === 'chase' ? 1 : 0.6) : 0, rear: sh.mode === 'alert' ? 0.4 : 0, strike: 0, hurt: 0, recoil: sh.mode === 'back' ? 1 : 0 });
        }
      }
      // dust in the dark, and webs drifting
      A.dust += dt * 10 * Math.max(0.4, many);
      while (A.dust > 1) {
        A.dust -= 1;
        const lp = lead.group.position;
        dust.emit(lp.x + R(8), lp.y + 0.3 + Math.random() * 2.5, lp.z + R(8), R(0.1), 0.02, R(0.1), 5, 0.05, 0.04, 1);
      }
    }
    dust.step(dt);

    // ── the Tower ──
    if (zone === 'tower') {
      lead = sam;
      court.update?.(t);
      if (s.mode === 'talk' || s.mode === 'end') {
        // at the top of the stair, together
        const dx = TOWER_DOOR.x - 1.5;
        const dz = TOWER_DOOR.z + 1.6;
        stand(sam, 'tower', dx, 0, dz, Math.PI / 2 + 0.6);
        stand(frodo, 'tower', dx + 1.2, 0, dz - 0.4, Math.PI / 2 + 2.4);
        if (s.line === 'frodo' || s.line === 'gone') sit(frodo, true);
      } else {
        stand(sam, 'tower', h.x, 0, h.z, h.face);
        pose(sam, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
        if (sam.arms?.[0]) sam.arms[0].rotation.x = -0.6;
      }
      const list = s.orcs ?? [];
      orcs.forEach((o, i) => {
        const w = list[i];
        o.group.visible = Boolean(w);
        if (!w) return;
        o.group.position.set(w.x, 0, w.z);
        turnTo(o, w.face + (w.look ?? 0), dt, 8);
        o.animate?.(t + i, { running: w.mode === 'chase' || w.mode === 'back' || (w.mode === 'patrol' && w.wait <= 0), fighting: w.mode === 'chase' ? 0.5 : 0 });
      });
      brawl.forEach((o) => o.animate?.(t + o.seed * 0.7, { running: false, fighting: 1 }));
      // the nearest torches
      const cam = camera.position;
      const near = torches.map((p) => [p, p.distanceToSquared(cam)]).sort((a, b) => a[1] - b[1]);
      near.slice(0, Math.max(1, POOL - 1)).forEach(([p], i) => lights.push([p, torchCol, 3.2 + Math.sin(t * 13 + i * 2.1) * 0.4 + Math.sin(t * 7.3 + i) * 0.3, 16]));
      A.embers += dt * 8 * Math.max(0.4, many);
      while (A.embers > 1 && near.length) {
        A.embers -= 1;
        const p = near[Math.floor(Math.random() * Math.min(3, near.length))][0];
        embers.emit(p.x + R(0.15), p.y + 0.3, p.z + R(0.15), R(0.3), 0.8 + Math.random(), R(0.3), 1.6, 0.05, 0.02, 1);
      }
    }
    // other travellers, walking the courtyard or the tunnels
    if (ghosts.group.parent !== zones[zone]) zones[zone].add(ghosts.group);
    ghosts.update(zone === 'tower' || zone === 'lair' ? (s.travellers ?? []) : [], t, dt);
    embers.step(dt);
    A.hit = Math.max(0, A.hit - dt * 2);
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
    let fov = 52;
    if (zone === 'vale' && s.mode === 'morgul' && s.morgul) {
      // over your shoulder, your eyes where the gaze is; drawn in as the
      // pull grows
      const m = s.morgul;
      const a = CITY_YAW + m.gaze;
      // over your right shoulder
      wpos('vale', HIDE.x - Math.sin(a) * 1.3 + Math.cos(a) * 0.8, valeHeight(HIDE.x, HIDE.z) + 1.9, HIDE.z - Math.cos(a) * 1.3 - Math.sin(a) * 0.8, tmp);
      camAt = tmp;
      camLook = look.set(camAt.x + Math.sin(a) * 100, camAt.y - 8 + (1 - Math.min(1, Math.abs(m.gaze))) * 14, camAt.z + Math.cos(a) * 100);
      fov = 52 - m.pull * 22;
      if (m.pausing) A.shake = Math.max(A.shake, 0.04);
    } else if (zone === 'vale') {
      // behind the hide, the city beyond
      const a = CITY_YAW;
      camAt = wpos('vale', HIDE.x - Math.sin(a) * 5 + 2, valeHeight(HIDE.x, HIDE.z) + 3.2, HIDE.z - Math.cos(a) * 5, tmp);
      // up to the beam once it goes up
      camLook = wpos('vale', BRIDGE.x, 14 + A.beam * 40, BRIDGE.z + 30, look);
    } else if (zone === 'stairs' && s.mode === 'crumbs') {
      // looking down at the cloak from over Sam's knees
      camAt = tmp.copy(CLOAK).add(AT.stairs).add(V(0.12, 1.3, 0.92));
      camLook = look.copy(CLOAK).add(AT.stairs).add(V(0, 0.02, -0.02));
    } else if (zone === 'stairs') {
      const fp = frodo.group.position;
      if (s.mode === 'talk') {
        camAt = tmp.set(fp.x + 2.4, fp.y + 1.8, fp.z + 6);
        camLook = look.set(fp.x - 0.3, fp.y + 0.6, fp.z);
      } else if (s.mode === 'climb') {
        // out from the cliff, the drop under you
        camAt = tmp.set(fp.x + 5, fp.y + 2.4, fp.z + 11);
        camLook = look.set(fp.x + 0.5, fp.y + 0.2, fp.z);
      } else {
        // the stair going up and up from its foot
        camAt = tmp.set(fp.x + 8, fp.y + 3.4, fp.z + 15);
        camLook = look.set(fp.x - 1, fp.y + 3.2, fp.z);
      }
    } else if (zone === 'lair' && lead === sam && s.talking === 'frodo') {
      const sp = sam.group.position;
      camAt = tmp.copy(sp).add(V(-1.6, 1.8, 3.4));
      camLook = silk.group.getWorldPosition(look).add(V(-0.4, 0.4, 0));
    } else if (zone === 'lair' && lead === sam) {
      // side on: Sam left, her right, Frodo beyond
      const sp = sam.group.position;
      camAt = tmp.set(sp.x + 2.2, sp.y + 2.4, sp.z + 7.6);
      camLook = look.set(sp.x + 2.6, sp.y + 1.4, sp.z - 0.2);
    } else if (zone === 'tower' && (s.mode === 'talk' || s.mode === 'end')) {
      const sp = sam.group.position;
      camAt = tmp.copy(sp).add(V(-2.6, 1.7, 3.2));
      camLook = look.copy(sp).add(V(0.6, 0.6, -0.4));
    } else {
      // walking: behind, close in the tunnels
      const yaw = s.camYaw ?? 0;
      const pitch = zone === 'lair' ? Math.min(0.32, s.camPitch ?? 0.3) : (s.camPitch ?? 0.34);
      let dist = s.camDist ?? 6;
      const lp = lead.group.position;
      look.set(lp.x, lp.y + 1.1, lp.z);
      if (zone === 'tower') {
        // pull in rather than go through the court's walls
        for (let d = dist; d > 2; d -= 0.4) {
          dist = d;
          const cx = look.x - AT.tower.x + Math.sin(yaw) * Math.cos(pitch) * d;
          const cz = look.z - AT.tower.z + Math.cos(yaw) * Math.cos(pitch) * d;
          if (Math.abs(cx) < COURT.w / 2 - 0.8 && Math.abs(cz) < COURT.d / 2 - 0.8) break;
        }
      }
      if (zone === 'lair') {
        // pull in so the roof and walls don't come between
        dist = Math.min(dist, 3.6);
        for (let d = dist; d > 1.2; d -= 0.3) {
          const cx = look.x - AT.lair.x + Math.sin(yaw) * Math.cos(pitch) * d;
          const cz = look.z - AT.lair.z + Math.cos(yaw) * Math.cos(pitch) * d;
          dist = d;
          if (TUNNELS.some(([x0, z0, x1, z1]) => cx >= Math.min(x0, x1) - 1.2 && cx <= Math.max(x0, x1) + 1.2 && cz >= Math.min(z0, z1) - 1.2 && cz <= Math.max(z0, z1) + 1.2)) break;
        }
      }
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      if (zone === 'lair') camAt.y = Math.min(camAt.y, AT.lair.y + 2.5);
      if (zone === 'tower') {
        // inside the court's walls
        const lim = (v, a) => Math.max(-a, Math.min(a, v));
        camAt.x = AT.tower.x + lim(camAt.x - AT.tower.x, COURT.w / 2 - 0.8);
        camAt.z = AT.tower.z + lim(camAt.z - AT.tower.z, COURT.d / 2 - 0.8);
      }
      if (camAt.y < AT[zone].y + 0.5) camAt.y = AT[zone].y + 0.5;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const key = `${zone}|${s.mode}|${s.talking ?? ''}|${lead === sam ? 's' : 'f'}`;
    const jump = A.mode !== key;
    A.mode = key;
    const follow = s.mode === 'walk' || s.mode === 'climb' || s.mode === 'morgul';
    const ke = jump ? 1 : Math.min(1, dt * (follow ? 7 : 2.4));
    A.cam.at.lerp(camAt, ke);
    A.cam.look.lerp(camLook, ke);
    A.fov += (fov - A.fov) * Math.min(1, dt * 3);
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
    stage.grade({ saturation: zone === 'lair' ? 0.75 : 0.9, contrast: 0.12, vignette: zone === 'lair' && lead === frodo ? 0.55 : 0.32, grain: 0.02 });
    renderer.info.reset();
    stage.render(ms / fast);
  };

  const fxEvent = (type, id) => {
    if (type === 'pause') A.shake = Math.max(A.shake, 0.12);
    else if (type === 'stood') A.shake = 0.2;
    else if (type === 'slip') A.shake = 0.35;
    else if (type === 'phial') fx.puff?.(tmp2.copy(phial.group.position), V(0, 1, 0), 4);
    else if (type === 'caught') A.shake = 0.3;
    else if (type === 'hit') {
      A.shake = 0.35;
      A.hit = 1;
    } else if (type === 'stab') {
      A.stab = 1;
      A.shake = Math.max(A.shake, 0.12);
    } else if (type === 'dodge') A.dodge = 1;
    else if (type === 'brush' && id) fx.pop(tmp2.set(CLOAK.x + id.u, CLOAK.y + 0.08, CLOAK.z + id.v).add(AT.stairs), 'white', 2 + id.got * 2, 0.3);
    else if (type === 'stir') A.stirAt = A.t;
  };
  // where on Sam's cloak a point on the screen is, as { u, v }, or null
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(V(0, 1, 0), 0);
  const cloakAt = (x, y) => {
    const { w, h: hh } = stage.size;
    ray.setFromCamera({ x: (x / w) * 2 - 1, y: -(y / hh) * 2 + 1 }, camera);
    plane.constant = -(CLOAK.y + AT.stairs.y + 0.06);
    const hit = ray.ray.intersectPlane(plane, tmp2);
    if (!hit) return null;
    return { u: hit.x - CLOAK.x - AT.stairs.x, v: hit.z - CLOAK.z - AT.stairs.z };
  };

  return {
    scene: import.meta.env.DEV ? scene : null,
    render,
    fx: fxEvent,
    screenOf: () => null,
    cloakAt,
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
