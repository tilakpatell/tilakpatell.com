// Weathertop, in WebGL: the hill of Amon Sûl at dusk, its crown of crags
// and the broken ring of the watchtower black against the last of the
// light; then night, stars and a low moon, the hobbits' fire in the dell,
// five Nazgûl coming up the slopes, a brand's light on the summit, Sam's
// lantern in the heather; and, set apart in the same scene, the road
// through the Trollshaws to the Ford of Bruinen for the ride. Made in code
// (./props.js, ../wraiths.js, ../ground.js), so nothing is downloaded.
//
// It draws what the component hands it every frame and decides nothing;
// ./layout.js, ./story.js and ./rules.js have the rules.
//
// createWeathertopWorld(canvas) returns { render(state, ms, fast), fx(type),
// screenOf(kind, id), aimAt(x, y), resize, dispose, lost, info }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../../lib/stage3d';
import { createHouse } from '../../../../lib/three/house';
import { dress, rolesFor } from '../../../../lib/three/core';
import { device } from '../../../../lib/device';
import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pose } from '../../mapFigures';
import { EMBER, FIRE as FLAME, createParticles } from '../../kit';
import { instances } from '../../shire/ground';
import { makeAtmosphere, makeSky } from '../../shire/sky';
import { createFx } from '../../shire/fx';
import { bake } from '../bake';
import { createGhosts } from '../ghosts';
import { makeTerrain, makeTufts } from '../ground';
import { FIGURE, groundTown } from '../grounded';
import { makeFolk } from '../bree/props';
import { createWraithKit } from '../wraiths';
import { createWeathertopKit } from './props';
import { ARWEN_AT, BED, CAST, COLLIDERS, CRAGS, DELL, FIRE_AT, GAPS, HILL, PATCHES, PLANTS, ROCKS, RUIN, SPOTS, STAIR, STAIR_W, STAND, TREES, TROLLS, WALLS, WORLD, WOUNDED, height, pathAmount, stairNear } from './layout';
import { BRAND, MARK_LINES, OBSTACLES, RIDE, glowOf, roadBend, roadTurn } from './rules';
import { sharpen } from '../../../../lib/three/textures';
import { attend, castDo, castPlay, releaseCast, tickCast } from '../../cast3d';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// Weathertop's moods, in the sky's slots: `day` is the dusk you climb in,
// `night` the night the Nazgûl come, `dawn` the grey morning after.
const MOODS = {
  day: { top: 0x1c2a4a, horizon: 0xd88a5a, sun: [-0.85, 0.08, 0.35], sunColour: 0xffa070, sunPower: 1.5, hemiSky: 0x8a90b8, hemiGround: 0x3a3428, hemi: 1.05, fog: 0x7a6a78, fogNear: 30, fogFar: 190, cloud: 0.5, cloudColour: 0xd8907a, stars: 0.25, exposure: 1.2, water: 0x5a6a8a, deep: 0x14182a },
  night: { top: 0x03060f, horizon: 0x14203a, sun: [0.55, 0.32, -0.6], sunColour: 0xa4b8ec, sunPower: 1.25, hemiSky: 0x4a5e96, hemiGround: 0x1a1c20, hemi: 1.3, fog: 0x0c1224, fogNear: 26, fogFar: 150, cloud: 0.3, cloudColour: 0x283450, stars: 1, exposure: 1.5, water: 0x2a3e66, deep: 0x060a14 },
  dawn: { top: 0x4a5a7a, horizon: 0xc8aa98, sun: [0.85, 0.16, 0.25], sunColour: 0xffd0a8, sunPower: 1.7, hemiSky: 0xc8c8d0, hemiGround: 0x4a463a, hemi: 0.95, fog: 0xa89c9c, fogNear: 34, fogFar: 200, cloud: 0.65, cloudColour: 0xd8b8a8, stars: 0.05, exposure: 1.08, water: 0x9aa4b8, deep: 0x2a2e3a },
};

// the ground's colours
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x4a5430);
const GRASS_DRY = C(0x6a6438);
const HEATHER = C(0x4a3a3e);
const ROCK = C(0x6a6a66);
const ROCK_DARK = C(0x3e3e3c);
const DIRT = C(0x5a4a38);
const DELL_GRASS = C(0x3e5a2a);
const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const noise = makeNoise(41);
// how steep the land is at (x, z), as rise over run
const steep = (x, z) => Math.hypot(height(x + 0.6, z) - height(x - 0.6, z), height(x, z + 0.6) - height(x, z - 0.6)) / 1.2;
function paint(x, z, h, out) {
  const patch = fbm(noise, x * 0.07 + 2, z * 0.07, { octaves: 3 });
  lerp3(out, GRASS, GRASS_DRY, smooth(0.35, 0.7, patch));
  lerp3(out, out, HEATHER, smooth(0.55, 0.75, fbm(noise, x * 0.11 - 4, z * 0.11 + 9, { octaves: 2 })) * 0.7);
  // bare rock where it's steep, and all through the crags
  const s = steep(x, z);
  const r = Math.hypot(x, z);
  const crag = r > HILL.crag[0] - 0.5 && r < HILL.crag[1] + 0.5 ? 1 - smooth(0, 1, Math.abs(r - (HILL.crag[0] + HILL.crag[1]) / 2) / 4) : 0;
  lerp3(out, out, s > 1 ? ROCK_DARK : ROCK, Math.max(smooth(0.55, 1.1, s), crag * 0.9));
  // the summit: thin turf on stone
  if (r < HILL.crag[0]) lerp3(out, out, ROCK, 0.35);
  // the dell: greener, and sheltered
  const d = Math.hypot(x - DELL.x, z - DELL.z);
  if (d < DELL.r * 1.4) lerp3(out, out, DELL_GRASS, (1 - smooth(DELL.r * 0.6, DELL.r * 1.4, d)) * 0.7);
  // the road and the stair, trodden to dirt
  const p = pathAmount(x, z);
  if (p > 0) lerp3(out, out, DIRT, p * 0.85);
  return out;
}
const growable = (x, z) => {
  const r = Math.hypot(x, z);
  if (r < RUIN.r + 1.2) return false;
  if (pathAmount(x, z) > 0.1) return false;
  if (steep(x, z) > 0.75) return false;
  return true;
};

// The ride's stretch of land, far off the hill, out of the fog's reach.
const RIDE_AT = V(2600, 0, 0);
// the river at the ford: from `RIDE.length + FORD[0]` to `+ FORD[1]` along
// the road
const FORD = [8, 34];
const FORD_MID = RIDE.length + (FORD[0] + FORD[1]) / 2;
// a point of the road, `s` along and `lat` across, in the world
function roadAt(s, lat = 0, out = V()) {
  const t = roadTurn(s);
  return out.set(RIDE_AT.x + s - Math.sin(t) * lat, 0, RIDE_AT.z + roadBend(s) + Math.cos(t) * lat);
}
const rideNoise = makeNoise(77);
// the ride's land: the road's bed flat, banks rising to wooded hills, and
// the river's channel at the ford
function rideHeight(s, lat) {
  const off = Math.abs(lat);
  let h = smooth(5.5, 30, off) * (4 + fbm(rideNoise, s * 0.02, lat * 0.03, { octaves: 3 }) * 10);
  h += (fbm(rideNoise, s * 0.08 + 9, lat * 0.08, { octaves: 2 }) - 0.5) * 0.6 * smooth(4, 8, off);
  const k = s - RIDE.length;
  // the ford's channel, the far bank rising out of it
  h -= 1.4 * (smooth(FORD[0] - 6, FORD[0] + 2, k) - smooth(FORD[1] - 2, FORD[1] + 6, k));
  h += smooth(FORD[1] + 4, FORD[1] + 60, k) * 3;
  return h;
}

export function createWeathertopWorld(canvas, { onLost } = {}) {
  const dev = device();
  const tier = dev.tier;
  const stage = createStage(canvas, { shadows: false, fov: 50, near: 0.1, far: 520, bloom: { strength: 0.7, radius: 0.55, threshold: 0.82 }, onLost });
  stage.grade({ contrast: 0.14, saturation: 0.86, vignette: 0.32, grain: 0.016, shadow: [0.0, 0.01, 0.04], high: [0.03, 0.016, 0.0] });
  const { scene, camera, renderer } = stage;
  // the house look (lib/three/house): one shadow colour and the sky's fog
  // on everything, under the house tone mapper; the moods move it
  const houseLook = createHouse();
  renderer.toneMapping = houseLook.toneMapping;
  renderer.info.autoReset = false;
  scene.fog = new THREE.Fog(0x7a6a78, 30, 190);
  const many = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.3;

  // ── light: the sky (the sun at dusk, the moon at night), and a pool of
  // fire lights lent to the camp, the brand, the lantern and the torches ──
  const hemi = new THREE.HemisphereLight(0x8a90b8, 0x3a3428, 1);
  const sun = new THREE.DirectionalLight(0xffa070, 1.4);
  scene.add(hemi, sun, sun.target);
  const POOL = tier === 'low' ? 3 : 4;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xff8a3a, 0, 14, 1.6);
    scene.add(l);
    return l;
  });

  const hill = new THREE.Group();
  const statics = new THREE.Group();
  scene.add(hill);
  hill.add(statics);
  const sky = makeSky(460);
  scene.add(sky.dome);
  // what the sky writes to water: the river at the ford reads it
  const water = { uniforms: { uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSun: { value: V(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uGlints: { value: 1 } } };
  const atmosphere = makeAtmosphere({ sky, sun, hemi, fog: scene.fog, water, stage, house: houseLook, moods: MOODS });

  // ── the hill ──
  // (the ground under the ruin's floor kept a little below its flagstones)
  const ground = (x, z) => height(x, z) - 0.16 * (1 - smooth(RUIN.r - 0.8, RUIN.r + 0.2, Math.hypot(x, z)));
  const terrain = makeTerrain(renderer, { size: WORLD.edge * 2, seg: tier === 'high' ? 230 : tier === 'mid' ? 160 : 110, height: ground, paint, blades: 0.2 });
  hill.add(terrain);
  const wind = { uWind: { value: 0 } };
  hill.add(makeTufts(Math.round(11000 * many), { radius: WORLD.radius + 6, height, growable, seed: 61, base: 0x2e3a1e, tip: 0x8a8a52, hue: [0.16, 0.05] }, wind));

  const kit = createWeathertopKit(renderer);
  const mats = kit.mats;
  // the site's core kit of surfaces on its stone, wood, bark, plaster and
  // iron (lib/three/core), by their names
  dress(mats, rolesFor(mats), { strength: 0.3, normal: 0.6, keep: true });

  // the ruin of Amon Sûl on the summit
  const ruin = kit.ruin(RUIN);
  ruin.group.position.set(0, HILL.top, 0);
  // the blocks tumbled out of the ring lie on the slope where they fell
  for (const b of ruin.fallen ?? []) {
    if (Math.hypot(b.position.x, b.position.z) > RUIN.r) b.position.y = height(b.position.x, b.position.z) - HILL.top - 0.15;
  }
  statics.add(ruin.group);
  // on the side: Gandalf's mark, cut in the broken column on the plinth, on
  // its east side. It shows as the lichen comes off (and stays, once read).
  const markTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 154;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    for (const [w, colour] of [[12, 'rgba(18, 14, 10, 0.9)'], [4, 'rgba(244, 236, 214, 1)']]) {
      g.strokeStyle = colour;
      g.lineWidth = w;
      for (const [u0, v0, u1, v1] of MARK_LINES) {
        g.beginPath();
        g.moveTo(u0 * c.width, v0 * c.height);
        g.lineTo(u1 * c.width, v1 * c.height);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    sharpen(tex);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  // a curved patch of the column's face (CylinderGeometry's theta 0 is +z,
  // so π/2 is east)
  const markFace = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.34, 12, 1, true, Math.PI / 2 - 0.42, 0.84), markMat);
  markFace.position.set(RUIN.plinth.x, HILL.top + 0.92, RUIN.plinth.z);
  markFace.renderOrder = 2;
  hill.add(markFace);
  // the crags round the crown, two rocks deep, and boulders on the slopes
  const rocks = kit.rocks.map(() => []);
  CRAGS.forEach(([x, z, s, i]) => {
    rocks[i % rocks.length].push({ x, z, y: height(x, z) - s * 0.35, s, turn: i * 1.9, tilt: Math.sin(i) * 0.2 });
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z) + (i % 2 ? 1.8 : -1.6);
    const x2 = Math.cos(a + 0.05) * r;
    const z2 = Math.sin(a + 0.05) * r;
    if (stairNear(x2, z2).d > STAIR_W + 1.4) rocks[(i + 1) % rocks.length].push({ x: x2, z: z2, y: height(x2, z2) - s * 0.3, s: s * 0.7, turn: i * 2.7, tilt: Math.cos(i) * 0.2 });
  });
  ROCKS.forEach(([x, z, s], i) => rocks[i % rocks.length].push({ x, z, y: height(x, z) - s * 0.25, s, turn: i * 2.1 }));
  rocks.forEach((list, i) => list.length && hill.add(instances(kit.rocks[i], mats.rock, list, { shadow: false })));
  // the old stair: worn slabs where it climbs, kerbstones along its sides
  const slabs = [];
  const kerbs = [];
  {
    let run = 0;
    for (let i = 1; i < STAIR.length; i++) {
      const [ax, az, ay] = STAIR[i - 1];
      const [bx, bz, by] = STAIR[i];
      const len = Math.hypot(bx - ax, bz - az);
      const turn = -Math.atan2(bz - az, bx - ax);
      const climb = (by - ay) / len;
      for (let d = 0; d < len; d += climb > 0.18 ? 0.62 : 2.4) {
        const k = d / len;
        const x = ax + (bx - ax) * k;
        const z = az + (bz - az) * k;
        const y = height(x, z);
        run += 1;
        if (climb > 0.18) slabs.push({ x, z, y: y - 0.06, sx: 0.66, sy: 1, sz: STAIR_W * (0.92 + Math.sin(run) * 0.05), turn: turn + Math.sin(run * 3.1) * 0.04 });
        if (run % 2 === 0 && climb > 0.1)
          for (const side of [-1, 1]) {
            const kx = x + Math.sin(turn) * side * (STAIR_W / 2 + 0.25);
            const kz = z + Math.cos(turn) * side * (STAIR_W / 2 + 0.25);
            kerbs.push({ x: kx, z: kz, y: height(kx, kz) - 0.05, sx: 0.5, sy: 1.2 + Math.sin(run * 1.3) * 0.4, sz: 0.45, turn: turn + run });
          }
      }
    }
  }
  // grey, weathered: the same stone as the ruin's, worn smoother
  const stairMat = new THREE.MeshStandardMaterial({ map: kit.K.tex.stone, normalMap: kit.K.tex.stoneN, color: 0x8e8a82, roughness: 0.92 });
  const slabGeo = new THREE.BoxGeometry(1, 0.22, 1).translate(0, 0.08, 0);
  const kerbGeo = new THREE.DodecahedronGeometry(0.4, 0).translate(0, 0.15, 0);
  hill.add(instances(slabGeo, stairMat, slabs, { shadow: false }), instances(kerbGeo, stairMat, kerbs, { shadow: false }));
  // dead trees on the heath, and the stone trolls
  for (const [x, z, s] of TREES) {
    const t = kit.deadTree(Math.round(x * 3 + z));
    t.group.position.set(x, height(x, z) - 0.1, z);
    t.group.rotation.y = x * 1.3;
    t.group.scale.setScalar(s);
    statics.add(t.group);
  }
  const trolls = kit.trolls();
  trolls.group.position.set(TROLLS.x, height(TROLLS.x, TROLLS.z) - 0.1, TROLLS.z);
  trolls.group.rotation.y = TROLLS.turn;
  statics.add(trolls.group);
  // the camp in the dell, its fire where the layout says
  const camp = kit.camp();
  camp.group.position.set(FIRE_AT.x - camp.fireAt.x, height(FIRE_AT.x, FIRE_AT.z), FIRE_AT.z - camp.fireAt.z);
  camp.group.rotation.y = 0;
  hill.add(camp.group);
  const fireAt = V(FIRE_AT.x, height(FIRE_AT.x, FIRE_AT.z) + 0.15, FIRE_AT.z);
  // the kingsfoil, and the weeds that look like it
  const plants = PLANTS.map((p, i) => {
    const part = p.athelas ? kit.athelas() : kit.weed(i);
    part.group.position.set(p.x, height(p.x, p.z), p.z);
    part.group.rotation.y = i * 2.3;
    hill.add(part.group);
    return { ...p, part };
  });
  // what never moves, merged by material
  hill.add(bake(statics, []));

  // ── people ──
  // (each stands on a soft blob slid away from the sun, and dims in the
  // baked shade: ../grounded.js)
  const movers = [];
  const blob = (f, s = 1) => {
    movers.push({ object: f.group, size: [FIGURE * s, FIGURE * s] });
    return f;
  };
  const frodo = blob(makeFolk('frodo'));
  const sam = blob(makeFolk('sam'));
  scene.add(frodo.group, sam.group);
  // other travellers, online, from other worlds (../ghosts.js)
  const ghosts = createGhosts({ height });
  hill.add(ghosts.group);
  // Frodo's brand, in his right hand, and the lantern in Sam's
  const brand = kit.torch();
  brand.group.position.set(0, -0.3, 0);
  brand.group.rotation.x = -0.15;
  frodo.arms[1].add(brand.group);
  brand.group.visible = false;
  const lantern = new THREE.Group();
  {
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 6, 1, true), mats.iron ?? new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.0) }));
    lantern.add(frame, glass);
    lantern.position.set(0.08, -0.34, 0);
  }
  sam.arms[1].add(lantern);
  // (on the cast, ../../cast3d.js, the brand and the lantern go to their hands, as all a toy holds does)
  const people = {};
  for (const c of CAST) {
    if (!c.look) continue;
    const p = blob(makeFolk(c.look));
    p.group.position.set(c.x, height(c.x, c.z), c.z);
    p.group.rotation.y = c.face;
    p.home = c;
    hill.add(p.group);
    people[c.id] = p;
  }
  // Frodo, wounded, at the stair's foot
  const wounded = makeFolk('frodo');
  const lying = new THREE.Group();
  wounded.group.rotation.z = Math.PI / 2;
  wounded.group.position.y = 0.2;
  // (on the cast he lies by his own pose, not a toy tipped over)
  wounded.cast?.onReady(() => {
    wounded.group.rotation.z = 0;
    wounded.group.position.y = 0;
    castDo(wounded, { base: 'sleep' });
  });
  lying.add(wounded.group);
  lying.position.set(WOUNDED.x, height(WOUNDED.x, WOUNDED.z), WOUNDED.z);
  lying.rotation.y = WOUNDED.face;
  hill.add(lying);
  // Strider, with fire in both hands, at the end of the fight
  const striderFire = blob(makeFolk('strider'));
  const torches = [kit.torch(), kit.torch()];
  torches.forEach((tc, i) => {
    tc.group.position.set(0, -0.32, 0);
    striderFire.arms[i].add(tc.group);
  });
  striderFire.group.visible = false;
  hill.add(striderFire.group);
  // Asfaloth, with Arwen (and Frodo, once she has him)
  const asfaloth = kit.asfaloth();
  scene.add(asfaloth.group);

  // ── the Nazgûl ──
  const wraiths = createWraithKit(renderer);
  // (the Ring's pale form, compiled now so putting it on doesn't stall)
  wraiths.setRing(0.01);
  wraiths.setRing(0);
  const nazgul = Array.from({ length: 5 }, (_, i) => {
    const n = wraiths.nazgul({ seed: i + 1, sword: true });
    n.group.visible = false;
    scene.add(n.group);
    return n;
  });

  // ── fire: flames, embers and smoke, for the camp, the brand and the torches ──
  const flames = createParticles(Math.round(700 * Math.max(0.5, many)), { ramp: FLAME, additive: true, gravity: 1.8, drag: 1.3, swirl: 0.7 });
  const embers = createParticles(Math.round(300 * Math.max(0.5, many)), { ramp: EMBER, additive: true, gravity: 0.9, drag: 0.6, swirl: 1.4 });
  scene.add(flames.mesh, embers.mesh);
  const fx = createFx(scene, { scale: many });
  const R = (a) => (Math.random() - 0.5) * 2 * a;
  const burn = (at, k = 1, spread = 0.3) => {
    flames.emit(at.x + R(spread), at.y, at.z + R(spread), R(0.15), 0.5 + Math.random() * 0.5 * k, R(0.15), 0.35 + Math.random() * 0.35 * k, 0.28 * (0.6 + k * 0.6), 0.05, 1);
    if (Math.random() < 0.12 * k) embers.emit(at.x + R(spread), at.y + 0.1, at.z + R(spread), R(0.4), 1.2 + Math.random() * 1.4, R(0.4), 1.2 + Math.random(), 0.035, 0.01, 1.4);
  };

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
    hill.add(g);
    return g;
  });
  const hereRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.05, 0.4), transparent: true, opacity: 0.55, depthWrite: false }));
  hereRing.visible = false;
  hill.add(hereRing);
  // a ring of dread at each burning patch's foot, and at the one you can stamp
  const stampRing = hereRing.clone();
  stampRing.material = hereRing.material.clone();
  stampRing.material.color = new THREE.Color(2.2, 0.7, 0.2);
  hill.add(stampRing);

  // ── the ride: the road through the Trollshaws to the Ford ──
  const ride = new THREE.Group();
  ride.visible = false;
  scene.add(ride);
  {
    const L = RIDE.length + 160;
    const W = 120;
    const segL = tier === 'high' ? 280 : tier === 'mid' ? 200 : 140;
    const segW = tier === 'high' ? 60 : 40;
    const geo = new THREE.PlaneGeometry(L, W, segL, segW).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    const col = new Float32Array(p.count * 3);
    const out = [0, 0, 0];
    const w = V();
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) + L / 2 - 60;
      const lat = p.getZ(i);
      const h = rideHeight(s, lat);
      roadAt(s, lat, w);
      p.setXYZ(i, w.x, h, w.z);
      uv.setXY(i, w.x / (WORLD.edge * 2), w.z / (WORLD.edge * 2));
      // the forest floor, the road's ruts, the ford's stones
      const patch = fbm(rideNoise, s * 0.05, lat * 0.05, { octaves: 2 });
      lerp3(out, C(0x2e3a22), C(0x4a4428), smooth(0.4, 0.7, patch));
      const road = 1 - smooth(3.6, 5.4, Math.abs(lat));
      lerp3(out, out, DIRT, road * 0.85);
      const k = s - RIDE.length;
      if (k > FORD[0] - 8 && k < FORD[1] + 8) lerp3(out, out, C(0x5a5a52), (1 - smooth(0, 10, Math.max(FORD[0] - k, k - FORD[1], 0))) * 0.8);
      col.set(out, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    ride.add(new THREE.Mesh(geo, terrain.material));
    // the woods: pines and birches thick on both sides of the road
    const pines = [];
    const birches = [];
    let seed = 3;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const w2 = V();
    for (let s = -50; s < RIDE.length + 100; s += 2.2 / Math.max(0.5, many)) {
      for (const side of [-1, 1]) {
        if (rand() < 0.35) continue;
        const lat = side * (7 + Math.pow(rand(), 0.8) * 48);
        const ss = s + rand() * 2;
        const k = ss - RIDE.length;
        if (k > FORD[0] - 4 && k < FORD[1] + 3) continue;
        roadAt(ss, lat, w2);
        const item = { x: w2.x, z: w2.z, y: rideHeight(ss, lat) - 0.2, s: 0.8 + rand() * 0.6, turn: rand() * TAU };
        (rand() < 0.68 ? pines : birches).push(item);
      }
    }
    ride.add(instances(kit.pine(), new THREE.MeshLambertMaterial({ vertexColors: true }), pines, { shadow: false }));
    ride.add(instances(kit.birch(), new THREE.MeshLambertMaterial({ vertexColors: true }), birches, { shadow: false }));
    // what's on the road
    const stones = [];
    for (const o of OBSTACLES) {
      if (o.kind === 'stone') {
        roadAt(o.s, o.lat, w2);
        stones.push({ x: w2.x, z: w2.z, y: rideHeight(o.s, o.lat) - 0.3, s: o.r * 1.1, turn: o.s });
        continue;
      }
      const t = kit.fallenTree(Math.round(o.s));
      const mid = (Math.max(o.lat0, -RIDE.lane - 2) + Math.min(o.lat1, RIDE.lane + 2)) / 2;
      roadAt(o.s, mid, w2);
      t.group.position.set(w2.x, rideHeight(o.s, mid), w2.z);
      t.group.rotation.y = -roadTurn(o.s);
      // the root plate out beyond the road's edge, the top across it
      if (o.lat0 > -RIDE.lane) t.group.rotation.y += Math.PI;
      t.group.scale.z = Math.max(0.6, (o.lat1 - o.lat0) / 9);
      ride.add(t.group);
    }
    if (stones.length) ride.add(instances(kit.rocks[0], mats.rock, stones, { shadow: false }));
  }
  // the river at the ford, flowing across the road under the moon
  const riverMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uFlood: { value: 0 }, uSky: water.uniforms.uSky, uDeep: water.uniforms.uDeep, uSun: water.uniforms.uSun, uSunColor: water.uniforms.uSunColor }]),
    fog: true,
    transparent: true,
    depthWrite: false,
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
      uniform float uTime, uFlood;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // it flows across the road, to +z; faster and whiter in the flood
        float speed = 1.2 + uFlood * 5.0;
        vec2 p = vec2(vWorld.x * 0.35, vWorld.z * 0.12 - uTime * speed);
        float n = noise(p * 2.0) * 0.6 + noise(p * 5.3 + 3.1) * 0.4;
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 nrm = normalize(vec3((n - 0.5) * 0.35, 1.0, (noise(p * 3.1 + 7.0) - 0.5) * 0.35));
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.35 + fres * 0.65);
        vec3 h = normalize(normalize(uSun) + view);
        col += uSunColor * pow(max(dot(nrm, h), 0.0), 120.0) * 2.4;
        // foam over the stones of the ford, and all of it in the flood
        float foam = smoothstep(0.62 - uFlood * 0.5, 0.9, noise(p * 3.7 + uTime * 0.6));
        col = mix(col, vec3(0.9, 0.97, 1.08), foam * (0.3 + uFlood * 0.45));
        gl_FragColor = vec4(col, 0.86);
        #include <fog_fragment>
      }`,
  });
  // (merge copies its uniforms: the sky's water colours are shared back in)
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) riverMat.uniforms[k] = water.uniforms[k];
  const river = new THREE.Mesh(new THREE.PlaneGeometry(FORD[1] - FORD[0] + 10, 260, 1, 1).rotateX(-Math.PI / 2), riverMat);
  roadAt(FORD_MID, 0, river.position);
  river.position.y = -0.55;
  river.rotation.y = -roadTurn(FORD_MID);
  ride.add(river);
  // the river's horses, rising in the flood upstream and running down on
  // the Nine
  const floodHorses = Array.from({ length: tier === 'low' ? 3 : 6 }, (_, i) => {
    const f = kit.floodHorse(i + 1);
    f.group.visible = false;
    ride.add(f.group);
    return f;
  });
  // the Nine behind
  const nine = Array.from({ length: tier === 'high' ? 9 : tier === 'mid' ? 6 : 4 }, (_, i) => {
    const r = kit.blackRider();
    r.k = i;
    r.group.visible = false;
    ride.add(r.group);
    return r;
  });

  // ── state ──
  const A = { t: 0, night: 0, dawn: 0, wraith: 0, shake: 0, cam: { at: V(0, 30, 60), look: V(0, 20, 0) }, mode: 'walk', climbT: 0, flash: 0, flame: 0 };
  const tmp = V();
  const tmp2 = V();
  const look = V();
  const warm = new THREE.Color(0xff8a3a);
  const lanternCol = new THREE.Color(0xffb060);
  const elfLight = new THREE.Color(0xdde8ff);
  const coldLight = new THREE.Color(0x6a80c0);
  const WRAITH_FOG = new THREE.Color(0.32, 0.34, 0.4);
  const placeWraith = (n, x, z, face, y = null) => {
    n.group.position.set(x, y ?? height(x, z), z);
    n.group.rotation.y = face;
  };
  // the ride's horses and riders, at (s, lat) facing along the road
  const onRoad = (g, s, lat, y = 0) => {
    roadAt(s, lat, g.position);
    g.position.y = rideHeight(s, lat) + y;
    g.rotation.y = -roadTurn(s);
  };
  // a torch in a figure's hand, held upright and leaning forward by `lean`,
  // in the figure's own frame (+x ahead), however the arm is turned
  const qArm = new THREE.Quaternion();
  const qWant = new THREE.Quaternion();
  const UP = V(0, 1, 0);
  const lean = V();
  const qGroup = new THREE.Quaternion();
  const upright = (obj, f, arm, k) => {
    qWant.setFromUnitVectors(UP, lean.set(Math.sin(k), Math.cos(k), 0));
    if (obj.parent?.isBone) {
      // in the cast's hand: upright in the figure's own frame, whatever the hand's doing
      obj.parent.getWorldQuaternion(qArm).invert().multiply(f.group.getWorldQuaternion(qGroup));
      obj.quaternion.copy(qArm.multiply(qWant));
      return;
    }
    qArm.copy(f.body.quaternion).multiply(f.arms[arm].quaternion).invert();
    obj.quaternion.copy(qArm.multiply(qWant));
  };

  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const riding = s.mode === 'ride' || s.mode === 'ford';
    wind.uWind.value = t;
    sky.uniforms.uTime.value = t;
    riverMat.uniforms.uTime.value = t;
    wraiths.tick(t);

    // the time, eased (but as it is, the first frame)
    const nightTo = s.sky === 'night' || riding ? 1 : 0;
    const dawnTo = s.sky === 'dawn' && !riding ? 1 : 0;
    if (A.first !== false) {
      A.first = false;
      A.night = nightTo;
      A.dawn = dawnTo;
    }
    A.night += (nightTo - A.night) * Math.min(1, dt * 0.5);
    A.dawn += (dawnTo - A.dawn) * Math.min(1, dt * 0.4);
    const ringOn = s.wearing || (s.mode === 'brand' && s.brand?.state === 'ring');
    A.wraith += ((ringOn ? 1 : 0) - A.wraith) * Math.min(1, dt * 4);
    const sunDir = atmosphere(A.night, A.dawn);
    wraiths.setRing(A.wraith);
    sky.uniforms.uGrey.value = A.wraith * 0.85;
    sky.uniforms.uEye.value = A.wraith * (0.4 + 0.6 * (s.gaze ?? 0));
    stage.grade({ saturation: 0.86 - A.wraith * 0.8, contrast: 0.14 + A.wraith * 0.18, vignette: 0.32 + A.wraith * 0.4 + (s.danger ?? 0) * 0.2, shadow: [A.wraith * 0.03, 0.01 + A.wraith * 0.03, 0.04 + A.wraith * 0.06] });
    // (the fog's own colour while it's this, not the sky's)
    houseLook.set({ fogMix: 1 - A.wraith * 0.8 });
    if (A.wraith > 0.01) {
      scene.fog.near *= 1 - A.wraith * 0.7;
      scene.fog.far *= 1 - A.wraith * 0.55;
      scene.fog.color.lerp(WRAITH_FOG, A.wraith * 0.8);
    }
    hill.visible = !riding;
    ride.visible = riding;
    markMat.opacity += ((s.markShown ?? 0) * 0.92 - markMat.opacity) * Math.min(1, dt * 6);
    markFace.visible = markMat.opacity > 0.01;

    const h = s.hobbit;
    const asSam = s.as === 'sam';
    const walker = asSam ? sam : frodo;
    const hy = height(h.x, h.z);
    const lights = [];

    // ── the walker ──
    frodo.group.visible = !riding && !asSam && A.wraith < 0.5;
    sam.group.visible = !riding && asSam;
    if (!riding) {
      if (s.mode === 'brand') {
        // Frodo on the summit, the brand held out where it points
        const aim = s.brand?.aim ?? 0;
        frodo.group.position.set(STAND.x, height(STAND.x, STAND.z), STAND.z);
        frodo.group.rotation.y = -aim;
        pose(frodo, t, { moving: false });
        // the brand held up and out before him; a thrust jabs it forward
        const jab = s.brand?.cool > BRAND.thrustCool - 0.2 ? 1 : 0;
        frodo.arms[1].rotation.z = 1.5 - jab * 0.35;
        frodo.arms[1].rotation.x = -0.6;
        // (on the cast: held out at arm's length, a jab with each thrust)
        castDo(frodo, { upper: 'aim.pistol', base: null });
        if (jab && !A.jabbed) castPlay(frodo, 'jab', { layer: 'upper', fade: 0.06 });
        A.jabbed = Boolean(jab);
        // the brand kept upright in his fist, leaning forward (more so in a
        // jab), whatever his arm's doing: turned in the arm's own frame
        upright(brand.group, frodo, 1, 0.45 + jab * 0.6);
        frodo.group.visible = true;
      } else {
        walker.group.position.set(h.x, hy, h.z);
        walker.group.rotation.y = h.face;
        pose(walker, t, { moving: h.speed > 0.3, speed: h.running ? 1.45 : 1 });
        if (s.stamping > 0) walker.legs[0].rotation.z = -0.9 * s.stamping;
        // at the stone, his hand on it, scraping at the lichen
        if (s.mode === 'mark') walker.arms[1].rotation.z = 1.15 + Math.sin(t * 13) * 0.12;
        // on the cast: a stamp on the flames, scraping at the stone, the lantern held up
        if (s.stamping > 0 && !A.stamped) castPlay(walker, 'stomp', { layer: 'full', fade: 0.08 });
        A.stamped = s.stamping > 0;
        castDo(walker, { upper: s.mode === 'mark' ? 'interact' : null });
        // asleep in the dell, before the smell of bacon wakes him (on the cast: lying, by his own pose)
        castDo(frodo, { base: s.mode === 'sleep' ? 'sleep' : null });
        if (s.mode === 'sleep') {
          frodo.group.position.set(BED.x, height(BED.x, BED.z) + 0.15, BED.z);
          frodo.group.rotation.set(0, BED.face, frodo.cast?.ready ? 0 : Math.PI / 2);
        } else frodo.group.rotation.set(0, frodo.group.rotation.y, 0);
      }
      brand.group.visible = s.mode === 'brand';
      if (s.mode === 'brand') {
        // flames off the brand's head, as many a second however fast it runs
        frodo.group.updateMatrixWorld(true);
        const at = brand.flameAt.clone().applyMatrix4(brand.group.matrixWorld);
        A.brandT = (A.brandT ?? 0) + dt;
        for (; A.brandT > 0.022; A.brandT -= 0.022) flames.emit(at.x + R(0.05), at.y, at.z + R(0.05), R(0.12), 0.55 + Math.random() * 0.35, R(0.12), 0.32 + Math.random() * 0.25, 0.22, 0.04, 0.9);
        // (its light a little out in front, so it lights them and not his back)
        const aim = s.brand?.aim ?? 0;
        lights.push([at.clone().add(V(Math.cos(aim) * 0.9, 0.3, Math.sin(aim) * 0.9)), warm, 6 + Math.sin(t * 17) * 0.8, 14]);
      }
      if (asSam) {
        sam.arms[1].rotation.z = 0.6;
        lights.push([lantern.getWorldPosition(tmp).clone(), lanternCol, 5.5 + Math.sin(t * 7) * 0.3, 10]);
      }
    }

    ghosts.update(riding ? [] : (s.travellers ?? []), t, dt, { ringOn: Boolean(s.wearing) });

    // ── who's about ──
    for (const c of CAST) {
      const p = people[c.id];
      if (!p) continue;
      const on = !riding && s.cast?.includes(c.id) && s.mode !== 'brand';
      p.group.visible = Boolean(on);
      if (!on) continue;
      // they turn to Frodo as he comes by: on the cast the head first, a greeting the first time
      attend(p, h, c.face, dt, { who: walker });
      pose(p, t + c.x, { moving: false, wave: 0, talk: s.talk === c.id || s.speaker === c.id ? 1 : 0 });
    }
    lying.visible = !riding && Boolean(s.cast?.includes('strider-foot'));
    if (lying.visible) wounded.body.rotation.z = Math.sin(t * 1.3) * 0.01;

    // ── the camp's fire, and the patches it's caught ──
    const f = s.fire;
    const burning = s.sky !== 'dusk' && !s.fireOut;
    let heat = 0;
    if (!riding && (f || burning)) {
      A.flame += dt;
      const steps = Math.floor(A.flame / 0.03);
      A.flame -= steps * 0.03;
      for (let n = 0; n < steps; n++) {
        if (f) {
          PATCHES.forEach((p, i) => {
            const k = f.heat[i];
            if (k <= 0) return;
            burn(tmp.set(p.x, height(p.x, p.z) + 0.1, p.z), k, 0.22 + k * 0.2);
          });
        } else burn(fireAt, 0.9, 0.25);
      }
      heat = f ? f.heat.reduce((a, b) => a + b, 0) / 2 : 1;
      if (heat > 0) lights.push([tmp2.set(fireAt.x, fireAt.y + 0.8, fireAt.z).clone(), warm, (4 + heat * 6) * (0.85 + Math.sin(t * 9.3) * 0.08 + Math.sin(t * 23) * 0.05), 12 + heat * 4]);
    }
    if (mats.ember) mats.ember.emissiveIntensity = burning || f ? 1.4 + Math.sin(t * 3) * 0.4 : 0.15;
    // the patch you can stamp on
    stampRing.visible = Boolean(f) && s.stampable >= 0 && s.mode === 'walk';
    if (stampRing.visible) {
      const p = PATCHES[s.stampable];
      stampRing.position.set(p.x, height(p.x, p.z) + 0.08, p.z);
      stampRing.scale.setScalar(0.85 + Math.sin(t * 8) * 0.06);
    }

    // ── the kingsfoil, glowing for Sam's lantern ──
    for (const p of plants) {
      const picked = s.found?.includes(p.id);
      p.part.group.visible = !riding && !picked;
      if (!p.athelas) continue;
      const k = s.hunting && !picked ? glowOf(p, h.x, h.z) : 0;
      p.part.glow(k * (0.75 + Math.sin(t * 2.4 + p.x) * 0.25));
      // and motes of pale green light drifting up off it
      p.mote = (p.mote ?? 0) + dt * k;
      if (p.mote > 0.35) {
        p.mote = 0;
        fx.pop(tmp.set(p.x, height(p.x, p.z) + 0.3, p.z), 'green', 2, 0.35);
      }
    }

    // ── the Nazgûl ──
    const climbing = s.riders && !riding && s.mode !== 'brand';
    A.climbT = climbing ? A.climbT + dt : 0;
    nazgul.forEach((n, i) => {
      n.group.visible = false;
      if (riding) return;
      if (s.mode === 'brand' && s.brand) {
        const w = s.brand.wraiths[i];
        if (!w) return;
        n.group.visible = true;
        const fled = s.brand.state === 'won' ? Math.min(1, s.stepT * 0.6) : 0;
        const r = w.r + fled * 10;
        const x = STAND.x + Math.cos(w.a) * r;
        const z = STAND.z + Math.sin(w.a) * r;
        placeWraith(n, x, z, Math.PI - w.a);
        n.group.visible = fled < 0.95;
        // driven back by the brand it rears from it; held at its edge, it flinches
        wraiths.animate(n, t + i, { moving: w.mode === 'creep' || w.mode === 'back', hunt: w.mode === 'wait' ? 0 : 1, recoil: w.mode === 'back' ? 1 : w.mode === 'held' ? 0.4 : 0 });
        return;
      }
      if (climbing) {
        // coming up the hill from all sides, slowly, through the dark
        const a = GAPS[i] + Math.sin(i * 1.7) * 0.2;
        const r = Math.max(HILL.crag[1] + 1.5, 44 - A.climbT * 0.45 - i * 1.5);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        n.group.visible = true;
        // turned on you if the Ring's on
        const face = s.wearing ? Math.atan2(-(h.z - z), h.x - x) : Math.PI - a;
        placeWraith(n, x, z, face);
        wraiths.animate(n, t + i * 1.3, { moving: r > HILL.crag[1] + 1.6, hunt: s.wearing ? 1 : 0, sniff: s.wearing ? 0 : 1 });
      }
    });

    // Strider, with fire, at the end of the fight
    striderFire.group.visible = s.mode === 'brand' && s.brand?.state === 'won';
    if (striderFire.group.visible) {
      const a = 2.375;
      const k = Math.min(1, s.stepT * 0.5);
      const r = 9.5 - k * 4.5;
      const x = STAND.x + Math.cos(a) * r;
      const z = STAND.z + Math.sin(a) * r;
      striderFire.group.position.set(x, height(x, z), z);
      striderFire.group.rotation.y = Math.PI - a;
      pose(striderFire, t, { moving: k < 1 });
      // (on the cast: the fire swung at them in both hands)
      castDo(striderFire, { upper: 'walk.fight' });
      striderFire.arms[0].rotation.z = 1.4 + Math.sin(t * 4) * 0.4;
      striderFire.arms[1].rotation.z = 1.1 - Math.sin(t * 4) * 0.4;
      torches.forEach((tc, i) => upright(tc.group, striderFire, i, 0.3));
      striderFire.group.updateMatrixWorld(true);
      A.torchT = (A.torchT ?? 0) + dt;
      for (; A.torchT > 0.035; A.torchT -= 0.035)
        for (const tc of torches) {
          const at = tc.flameAt.clone().applyMatrix4(tc.group.matrixWorld);
          flames.emit(at.x + R(0.04), at.y, at.z + R(0.04), R(0.1), 0.5 + Math.random() * 0.3, R(0.1), 0.3 + Math.random() * 0.25, 0.16, 0.03, 0.75);
        }
      lights.push([torches[0].flameAt.clone().applyMatrix4(torches[0].group.matrixWorld), warm, 10, 16]);
    }

    // ── Asfaloth: at the foot when Arwen comes, then on the road ──
    asfaloth.group.visible = riding || s.talking === 'arwen';
    asfaloth.frodo.group.visible = riding;
    if (riding) {
      const r = s.ride;
      if (s.mode === 'ride') {
        onRoad(asfaloth.group, r.s, r.lat);
        kit.gallop(asfaloth, t, r.v / RIDE.base);
      } else {
        // across the ford, and turned at the far bank to face them
        const k = Math.min(1, s.stepT / 3.5);
        onRoad(asfaloth.group, RIDE.length + k * (FORD[1] + 6), (1 - k) * r.lat);
        if (k >= 1) asfaloth.group.rotation.y += Math.PI;
        kit.gallop(asfaloth, t, k < 1 ? 0.8 : 0);
      }
    } else if (asfaloth.group.visible) {
      asfaloth.group.position.set(ARWEN_AT.x, height(ARWEN_AT.x, ARWEN_AT.z), ARWEN_AT.z);
      asfaloth.group.rotation.y = ARWEN_AT.face;
      kit.gallop(asfaloth, t, 0);
    }
    // the Nine, and the river's horses
    nine.forEach((r, i) => {
      r.group.visible = riding;
      if (!riding) return;
      const row = Math.floor(i / 3);
      const lat = ((i % 3) - 1) * 2.6 + Math.sin(t * 0.7 + i) * 0.6;
      let along;
      let swept = 0;
      if (s.mode === 'ride') along = s.ride.s - s.ride.gap - 4 - row * 5;
      else {
        // drawn up at the near bank, then into the river, then gone
        along = RIDE.length - 4 - row * 4 + Math.min(1, (s.flood ?? 0) * 3) * 10;
        swept = Math.max(0, (s.flood ?? 0) - 0.3 - i * 0.03) * 70;
      }
      onRoad(r.group, along, lat + swept);
      r.group.position.y -= Math.min(2.5, swept * 0.15);
      r.group.visible = swept < 30;
      // a walk into a gallop at the pace they're put down the road at; stood, shifting (../../shire/props.js)
      r.animate?.(t + i);
    });
    const flood = s.flood ?? 0;
    if (riding) {
      // Arwen shines; and a cold light goes with the Nine, so they're shapes
      // in the dark and not holes in it
      lights.push([asfaloth.group.position.clone().add(V(0, 3, 0)), elfLight, 3.2, 12]);
      const pack = nine.find((r) => r.group.visible);
      if (pack) lights.push([pack.group.position.clone().add(V(0, 4, 0)), coldLight, 6 * (1 - flood), 22]);
    }
    riverMat.uniforms.uFlood.value = flood > 0 ? Math.min(1, flood * 3) : 0;
    floodHorses.forEach((fh, i) => {
      fh.group.visible = riding && flood > 0;
      if (!fh.group.visible) return;
      // upstream (-z across the road) and down on the near bank
      const k = Math.max(0, flood * 1.6 - i * 0.08);
      const lat = -70 + k * 110 + (i % 2) * 6;
      const along = RIDE.length + FORD[0] + 2 + (i % 3) * 6;
      onRoad(fh.group, along, lat);
      fh.group.position.y = -0.5;
      // they run across the road, to +lat
      fh.group.rotation.y = -roadTurn(along) - Math.PI / 2;
      fh.update(t + i, Math.min(1, k * 2.5) * (1 - smooth(0.85, 1, flood)));
    });

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

    // ── the lights ──
    pool.forEach((l, i) => {
      const v = lights[i];
      if (!v) return (l.intensity = 0);
      l.position.copy(v[0]);
      l.color.copy(v[1]);
      l.intensity = v[2];
      l.distance = v[3];
      return undefined;
    });
    flames.step(dt);
    embers.step(dt);
    fx.step(dt, t, { night: 0, day: 0 });

    // ── the camera ──
    let camAt;
    let camLook;
    if (s.mode === 'brand') {
      // behind Frodo, looking where the brand points
      const aim = s.brand?.aim ?? 0;
      const y0 = height(STAND.x, STAND.z);
      // (a little over his right shoulder, so the brand in his right hand shows)
      camAt = tmp.set(STAND.x - Math.cos(aim) * 4.6 - Math.sin(aim) * 0.8, y0 + 3.4, STAND.z - Math.sin(aim) * 4.6 + Math.cos(aim) * 0.8);
      camLook = look.set(STAND.x + Math.cos(aim) * 5, y0 + 1.1, STAND.z + Math.sin(aim) * 5);
      if (s.brand?.state === 'won') {
        // round to see Strider come
        camAt.set(STAND.x - 4.5, y0 + 2.6, STAND.z - 3.2);
        camLook.set(STAND.x + Math.cos(2.375) * 5, y0 + 1.4, STAND.z + Math.sin(2.375) * 5);
      }
    } else if (s.mode === 'ride') {
      const r = s.ride;
      const back = 7.5;
      // behind her, looking down the road; when the Nine are close, round
      // to the side and ahead, looking back past her at them
      const close = smooth(16, 6, r.gap);
      const ahead = roadAt(r.s + 10, r.lat * 0.5, look);
      ahead.y = rideHeight(r.s + 10, 0) + 1.6;
      const along = r.s - back * (1 - close) + close * 5;
      camAt = roadAt(along, r.lat * 0.6 + close * 7.5, tmp);
      camAt.y = rideHeight(along, r.lat) + 3.2 - close * 0.8;
      if (close > 0) look.lerp(roadAt(r.s - r.gap - 2, r.lat, tmp2).setY(rideHeight(r.s, r.lat) + 1.6), close * 0.75);
      camLook = look;
    } else if (s.mode === 'ford') {
      // from the far bank, past Arwen, at the Nine and the river
      const k = Math.min(1, s.stepT / 3.5);
      camAt = roadAt(RIDE.length + FORD[1] + 12, 6 + (1 - k) * 4, tmp);
      camAt.y = rideHeight(RIDE.length + FORD[1] + 12, 6) + 2.4 + flood * 2.5;
      camLook = roadAt(RIDE.length + FORD[0] - 2 + flood * 4, -flood * 14, look);
      camLook.y = 1.8 + flood * 2;
    } else if (s.mode === 'mark') {
      // close on the column's east face, Frodo bent over it to one side
      camAt = tmp.set(RUIN.plinth.x + 2.3, HILL.top + 1.55, RUIN.plinth.z - 1.35);
      camLook = look.set(RUIN.plinth.x + 0.45, HILL.top + 0.95, RUIN.plinth.z + 0.1);
    } else if (s.mode === 'talk' && s.speakerAt) {
      // over the shoulder, at whoever's speaking
      const a = tmp2.set(h.x, hy + 1.3, h.z);
      const b = V(...s.speakerAt);
      const d = b.clone().sub(a);
      d.y = 0;
      const len = Math.max(0.5, d.length());
      d.normalize();
      const side = V(-d.z, 0, d.x);
      camAt = tmp.copy(a).addScaledVector(d, -1.8).addScaledVector(side, 1.4);
      camAt.y = Math.max(hy, b.y) + 1.2 + Math.min(1.2, len * 0.12);
      camLook = look.copy(b).lerp(a, 0.25);
      camLook.y += 0.2;
      const floor = height(camAt.x, camAt.z) + 0.6;
      if (camAt.y < floor) camAt.y = floor;
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.36;
      const dist = s.camDist ?? 6.4;
      look.set(h.x, hy + 1.1, h.z);
      camAt = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, hy + 1.1 + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      let k = clearance(look, camAt);
      A.suggest = null;
      if (k < 0.6) {
        let best = k;
        for (const dy of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
          const y2 = yaw + dy;
          const kk = clearance(look, tmp2.set(h.x + Math.sin(y2) * Math.cos(pitch) * dist, hy + 1.1 + Math.sin(pitch) * dist, h.z + Math.cos(y2) * Math.cos(pitch) * dist));
          if (kk > best + 0.15) {
            best = kk;
            A.suggest = y2;
          }
        }
      }
      if (k < 1) camAt.lerpVectors(look, camAt, Math.max(k, 0.35));
      // never under the hillside
      const floor = Math.max(height(camAt.x, camAt.z), height((camAt.x + h.x) / 2, (camAt.z + h.z) / 2)) + 0.7;
      if (camAt.y < floor) camAt.y = floor;
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode;
    A.mode = s.mode;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' || s.mode === 'ride' ? 7 : s.mode === 'brand' ? 9 : 2.5));
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
    floorLight.update();
    // the people on the cast (../../cast3d.js), drawn for this frame
    tickCast(scene, camera, dt);
    renderer.info.reset();
    stage.render(ms / fast);
  };

  // ── events ──
  const fxEvent = (type) => {
    if (type === 'stabbed') A.shake = 0.35;
    else if (type === 'hit') A.shake = Math.max(A.shake, 0.25);
    else if (type === 'thrust') A.shake = Math.max(A.shake, 0.04);
    else if (type === 'close' || type === 'seen') A.shake = Math.max(A.shake, 0.1);
    else if (type === 'found') fx.pop(tmp2.copy(sam.group.position).add(V(0, 0.6, 0)), 'green', 24, 1.6);
    else if (type === 'out') fx.puff(tmp2.copy(frodo.group.position).add(V(0, 0.3, 0)), V(0, 0.6, 0), 10);
    else if (type === 'mark') fx.pop(tmp2.set(RUIN.plinth.x + 0.6, HILL.top + 0.95, RUIN.plinth.z), 'gold', 26, 1.4);
  };

  // Where someone is on screen, for the speech bubbles: { x, y } in CSS
  // pixels of the canvas, or null when they're off it.
  const screenOf = (kind, id) => {
    let p = null;
    if (kind === 'cast' && id === 'trolls') p = tmp.set(TROLLS.x, height(TROLLS.x, TROLLS.z) + 5.4, TROLLS.z);
    else if (kind === 'cast' && people[id]) p = tmp.copy(people[id].group.position).add(tmp2.set(0, 2.1, 0));
    if (!p) return null;
    p = p.clone().project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h: hh } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh };
  };
  // where someone's head is in the world, for the talk camera
  const headOf = (id) => {
    if (id === 'arwen') return [ARWEN_AT.x, height(ARWEN_AT.x, ARWEN_AT.z) + 2.6, ARWEN_AT.z];
    const p = people[id];
    return p ? p.group.position.clone().add(V(0, 1.7, 0)).toArray() : null;
  };
  // The angle round Frodo on the summit that a point on the canvas (CSS
  // pixels) is at, for aiming the brand with the pointer.
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(V(0, 1, 0), -(HILL.top + 0.9));
  const aimAt = (x, y) => {
    const { w, h: hh } = stage.size;
    ray.setFromCamera({ x: (x / w) * 2 - 1, y: -(y / hh) * 2 + 1 }, camera);
    const hit = ray.ray.intersectPlane(plane, tmp2);
    if (!hit) return null;
    return Math.atan2(hit.z - STAND.z, hit.x - STAND.x);
  };

  // ── the floor's light, baked when the town is first drawn ──
  const floorLight = groundTown({ place: 'weathertop', renderer, scene, terrain, outdoors: hill, sun, height: ground, people: movers, skip: [sky.dome, ghosts.group], tier, radius: WORLD.radius + 10, shade: 0x2a2620 });
  // (last, over the floor light's own tints: one shadow colour everywhere)
  houseLook.adopt(scene);

  return {
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    ground: import.meta.env.DEV ? floorLight : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    render,
    fx: fxEvent,
    screenOf,
    headOf,
    aimAt,
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
      floorLight.dispose();
      ghosts.dispose();
      disposeTree(scene);
      releaseCast(scene);
      stage.dispose();
    },
  };
}

// What the camera can't go through, with how high each stands: the trolls,
// the trees, the ruin's walls and the crags.
const BLOCKERS = COLLIDERS.filter((c) => !c.low).map((c) => ({ ...c, y: height(c.x, c.z) + (c.top ?? 4) }));
function insideAt(x, y, z) {
  for (const c of BLOCKERS) {
    if (y > c.y) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + 0.25) return true;
  }
  for (const [x0, z0, x1, z1, thick] of WALLS) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
    const top = thick > 0.8 ? 3.2 : 3;
    if (Math.hypot(x - (x0 + t * dx), z - (z0 + t * dz)) < thick + 0.3 && y < height(x, z) + top) return true;
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
