// What a fight looks like aboard: the blaster bolts (a white-hot capsule
// about 0.9 m long in a red glow: red for every side’s blasters, as every
// hand blaster in the films is, and green only for the station’s own
// turbolasers and its superlaser), the sparks off whatever a bolt strikes,
// the scorch it leaves on the wall (glowing as it cools), the flare at the
// muzzle, smoke, and explosions. Everything is pooled and made here at the
// start (four draws at most however hot the fight: the bolts’ cores, every
// glow and spark and flash as one set of sprites, every puff of fire and
// smoke as another, the scorches, and nothing for an empty pool), and its
// shaders can be compiled before the first shot (`warm`), so nothing is
// allocated or compiled mid-fight. One PointLight, kept in the scene at
// intensity 0 so the room’s shaders never change when it lights, is the
// muzzle flare and an explosion’s flash; whichever is brighter has it.
//
// The shaders are TSL (./nodes/fx.js: a glow, a puff, a scorch); the GLSL
// they were is ./glsl/fx.js, for the parity check.
//
// Bolts are drawn as the rules have them: call bolt(b) for every bolt in
// the air each frame (combat.js’s `combat.bolts`), before update(dt); one
// not given again is gone (it struck something, or ran out of range).
// Between two steps a bolt is carried on along its way by the time since,
// so it flies smoothly at any frame rate.
//
//   POOLS → { bolts, sparks, puffs, scorches, flashes, small: { … } }   how many of each are kept
//   inFlight(weapon) → n   how many bolts one gun can have in the air at once
//   boltHue(b) → 'red' | 'green'
//   flareLevel(t, life) → 0…1   a flare’s strength t seconds after it was lit
//   createSlots(n) → { take() → i, release(i), used(i) }   a pool’s slots: a free one, or else the oldest
//   createFx(scene, { small }) → fx
//     fx.bolt(b)   b: a combat.js bolt { id, x, y, z, dx, dy, dz, speed, side, weapon }
//     fx.spark(at, n, normal?)   n sparks thrown from `at`, off a surface facing `normal` if given
//     fx.scorch(at, normal)   a burn on the surface at `at` facing `normal`, glowing as it cools
//     fx.flare(at, hue = 'red')   a muzzle’s flash and its light
//     fx.smoke(at, size = 0.5)   a puff that rises and spreads
//     fx.explode(at, size)   fire, smoke, sparks and a flash `size` metres across
//     fx.update(dt)   once a frame, after the bolts
//     fx.warm(renderer, camera, target?) → Promise   compiles every shader the effects use
//     fx.live() → { bolts, sparks, puffs, scorches, flashes }   how many are showing
//     fx.meshes   the effects’ meshes;  fx.dispose()

import * as THREE from 'three';
import { precompile } from '../../../../lib/three/renderer';
import { WEAPONS } from '../rules/combat';
import { puffMaterial, scorchMaterial, spriteMaterial } from './nodes/fx';

const STEP = 1 / 30; // the game’s step: a bolt is never carried on further than one
const BOLT = { length: 0.9, r: 0.028, glow: 0.16 }; // a bolt’s core and how far its glow reaches round it
const GREEN = new Set(['turbolaser', 'superlaser']);
const SHOOTERS = 8; // you, your companions and the three troopers each holding a shot token
const GRAVITY = 9.8;

// the hues, as light (over 1 is brighter than white: what the bloom picks up)
const HUES = {
  red: { core: [6, 1.4, 1.1], glow: [1.6, 0.16, 0.08], flash: [3.2, 0.9, 0.5], light: 0xff4a32 },
  green: { core: [1.4, 6, 1.4], glow: [0.2, 1.5, 0.25], flash: [0.9, 3.2, 0.9], light: 0x5cff6a },
};
const HOT = [4, 2.2, 0.9]; // a spark as it leaves
const COOL = [1.2, 0.25, 0.04]; // and as it dies
const FLARE = { intensity: 30, distance: 7, life: 0.08, size: 0.22 };
const BLAST = { intensity: 120, distance: 16, life: 0.45, colour: 0xff8a3a, flash: [4, 2.6, 1.2] };
const SCORCH = { life: 90, fade: 10, cool: 0.9 }; // seconds a scorch stays, fades out over, glows for

export function inFlight(weapon) {
  const w = WEAPONS[weapon];
  return w ? Math.ceil(w.range / w.speed / w.gap) : 0;
}

const most = Math.max(...Object.keys(WEAPONS).map(inFlight));
export const POOLS = Object.freeze({
  bolts: SHOOTERS * most,
  sparks: 240,
  puffs: 48,
  scorches: 64,
  flashes: 8,
  small: Object.freeze({ bolts: SHOOTERS * most, sparks: 120, puffs: 24, scorches: 32, flashes: 8 }),
});

export function boltHue(b) {
  return GREEN.has(b?.weapon) ? 'green' : 'red';
}

export function flareLevel(t, life) {
  if (!(t < life)) return 0;
  const k = 1 - Math.max(0, t) / life;
  return k * k;
}

export function createSlots(n) {
  const taken = new Float64Array(n).fill(-1); // when each was taken (in takes), −1 while free
  let takes = 0;
  return {
    take() {
      let pick = -1;
      for (let i = 0; i < n; i++) {
        if (taken[i] < 0) {
          pick = i;
          break;
        }
        if (pick < 0 || taken[i] < taken[pick]) pick = i;
      }
      taken[pick] = takes++;
      return pick;
    },
    release(i) {
      taken[i] = -1;
    },
    used: (i) => taken[i] >= 0,
  };
}

// ── the effects ──

const quadGeo = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.instanceCount = 0;
  return g;
};
const perInstance = (geo, name, n, size) => {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
  a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, a);
  return a;
};
const put3 = (arr, i, x, y, z) => {
  arr[i * 3] = x;
  arr[i * 3 + 1] = y;
  arr[i * 3 + 2] = z;
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createFx(scene, { small = false } = {}) {
  const N = small ? POOLS.small : POOLS;
  const group = new THREE.Group();
  group.name = 'fx';
  let seed = 0x2545f491;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // ── the bolts’ cores: capsules along y, centred, so a matrix carries one onto its way ──
  const coreGeo = new THREE.CapsuleGeometry(BOLT.r, BOLT.length - 2 * BOLT.r, 3, 8);
  const coreMat = new THREE.MeshBasicMaterial({ name: 'ds-bolt', color: 0xffffff, toneMapped: false });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, N.bolts);
  cores.name = 'bolt-cores';
  cores.count = 0;
  cores.frustumCulled = false;
  cores.setColorAt(0, new THREE.Color());
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ── the sprites: bolts’ glows, sparks and muzzle flashes ──
  const spriteCap = N.bolts + N.sparks + N.flashes;
  const spriteGeo = quadGeo();
  const sAt = perInstance(spriteGeo, 'aAt', spriteCap, 3);
  const sDir = perInstance(spriteGeo, 'aDir', spriteCap, 3);
  const sSize = perInstance(spriteGeo, 'aSize', spriteCap, 2);
  const sColour = perInstance(spriteGeo, 'aColour', spriteCap, 3);
  const spriteMat = spriteMaterial();
  const sprites = new THREE.Mesh(spriteGeo, spriteMat);
  sprites.name = 'fx-sprites';
  sprites.frustumCulled = false;
  sprites.renderOrder = 5;

  // ── the puffs: fire and smoke ──
  const puffGeo = quadGeo();
  const pAt = perInstance(puffGeo, 'aAt', N.puffs, 3);
  const pShape = perInstance(puffGeo, 'aShape', N.puffs, 4);
  const pColour = perInstance(puffGeo, 'aColour', N.puffs, 4);
  const puffMat = puffMaterial();
  const puffs = new THREE.Mesh(puffGeo, puffMat);
  puffs.name = 'fx-puffs';
  puffs.frustumCulled = false;
  puffs.renderOrder = 4;

  // ── the scorches ──
  const scorchGeo = new THREE.PlaneGeometry(1, 1);
  const burn = perInstance(scorchGeo, 'aBurn', N.scorches, 3);
  // (pulled towards the eye in depth, so a scorch never fights the wall it is on)
  const scorchMat = scorchMaterial();
  const scorches = new THREE.InstancedMesh(scorchGeo, scorchMat, N.scorches);
  scorches.name = 'fx-scorches';
  scorches.count = 0;
  scorches.frustumCulled = false;
  scorches.renderOrder = 3;

  // ── the flare’s light, kept in at 0 ──
  const light = new THREE.PointLight(HUES.red.light, 0, FLARE.distance, 2);
  light.name = 'fx-flare';
  const glare = { t: 0, life: FLARE.life, peak: 0 };

  group.add(cores, sprites, puffs, scorches, light);
  scene.add(group);
  const meshes = [cores, sprites, puffs, scorches];

  // ── state, in flat arrays so a fight makes no garbage ──
  const boltSlots = createSlots(N.bolts);
  // (where each bolt was given, in doubles: a float32 copy of a station coordinate, rounded, never
  // matches the rules’ own again, and would count every bolt far from the origin as moved each frame)
  const bolts = { id: new Array(N.bolts).fill(null), p: new Float64Array(N.bolts * 3), d: new Float32Array(N.bolts * 3), speed: new Float32Array(N.bolts), lead: new Float32Array(N.bolts), seen: new Uint8Array(N.bolts), fresh: new Uint8Array(N.bolts), green: new Uint8Array(N.bolts) };
  const sparkSlots = createSlots(N.sparks);
  const sparks = { p: new Float32Array(N.sparks * 3), v: new Float32Array(N.sparks * 3), t: new Float32Array(N.sparks), life: new Float32Array(N.sparks) };
  const flashSlots = createSlots(N.flashes);
  const flashes = { p: new Float32Array(N.flashes * 3), t: new Float32Array(N.flashes), life: new Float32Array(N.flashes), size: new Float32Array(N.flashes), colour: new Float32Array(N.flashes * 3) };
  const puffSlots = createSlots(N.puffs);
  // per puff: where, its drift, sizes from and to, age, life, delay, fire (1) or smoke (0), spin, seed
  const puffState = { p: new Float32Array(N.puffs * 3), v: new Float32Array(N.puffs * 3), from: new Float32Array(N.puffs), to: new Float32Array(N.puffs), t: new Float32Array(N.puffs), life: new Float32Array(N.puffs), delay: new Float32Array(N.puffs), fire: new Uint8Array(N.puffs), spin: new Float32Array(N.puffs), seed: new Float32Array(N.puffs * 2) };
  const scorchSlots = createSlots(N.scorches);
  const scorchState = { m: new Float32Array(N.scorches * 16), t: new Float32Array(N.scorches), seed: new Float32Array(N.scorches) };

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);

  function addFlash(at, size, colour, life = FLARE.life) {
    const i = flashSlots.take();
    put3(flashes.p, i, at.x, at.y, at.z);
    put3(flashes.colour, i, colour[0], colour[1], colour[2]);
    flashes.size[i] = size;
    flashes.t[i] = 0;
    flashes.life[i] = life;
  }

  function lightUp(at, colour, peak, life) {
    // the brighter of the flash now and the one still fading keeps the light
    if (glare.peak * flareLevel(glare.t, glare.life) > peak) return;
    light.position.set(at.x, at.y, at.z);
    light.color.setHex(colour);
    light.distance = peak > FLARE.intensity ? BLAST.distance : FLARE.distance;
    glare.t = 0;
    glare.life = life;
    glare.peak = peak;
  }

  function addPuff(at, fire, from, to, life, delay, spread, rise) {
    const i = puffSlots.take();
    put3(puffState.p, i, at.x + (rand() - 0.5) * spread, at.y + (rand() - 0.5) * spread * 0.6, at.z + (rand() - 0.5) * spread);
    put3(puffState.v, i, (rand() - 0.5) * 0.3, rise * (0.7 + rand() * 0.6), (rand() - 0.5) * 0.3);
    puffState.from[i] = from;
    puffState.to[i] = to;
    puffState.t[i] = 0;
    puffState.life[i] = life;
    puffState.delay[i] = delay;
    puffState.fire[i] = fire ? 1 : 0;
    puffState.spin[i] = rand() * Math.PI * 2;
    puffState.seed[i * 2] = rand() * 40;
    puffState.seed[i * 2 + 1] = rand() * 40;
  }

  const fx = {
    meshes,

    bolt(b) {
      if (!b) return;
      let i = -1;
      for (let k = 0; k < N.bolts; k++) {
        if (bolts.id[k] === b.id && boltSlots.used(k)) {
          i = k;
          break;
        }
      }
      if (i < 0) {
        i = boltSlots.take();
        bolts.id[i] = b.id;
        bolts.fresh[i] = 1;
      } else if (bolts.p[i * 3] !== b.x || bolts.p[i * 3 + 1] !== b.y || bolts.p[i * 3 + 2] !== b.z) bolts.fresh[i] = 1;
      put3(bolts.p, i, b.x, b.y, b.z);
      const len = Math.hypot(b.dx, b.dy, b.dz) || 1;
      put3(bolts.d, i, b.dx / len, b.dy / len, b.dz / len);
      bolts.speed[i] = b.speed ?? 0;
      bolts.green[i] = boltHue(b) === 'green' ? 1 : 0;
      bolts.seen[i] = 1;
    },

    spark(at, n = 8, normal = null) {
      for (let k = 0; k < n; k++) {
        const i = sparkSlots.take();
        // a way out: off the surface if there is one, else anywhere, leaning up
        _v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
        if (normal) _v.multiplyScalar(0.9).add(_n.set(normal.x, normal.y, normal.z));
        else _v.y += 0.6;
        _v.normalize().multiplyScalar(2.5 + rand() * 4.5);
        put3(sparks.p, i, at.x, at.y, at.z);
        put3(sparks.v, i, _v.x, _v.y, _v.z);
        sparks.t[i] = 0;
        sparks.life[i] = 0.25 + rand() * 0.35;
      }
    },

    scorch(at, normal) {
      const i = scorchSlots.take();
      _n.set(normal?.x ?? 0, normal?.y ?? 0, normal?.z ?? 1).normalize();
      // a whisker off the surface, turned to face out of it, spun at random, some bigger than others
      _v.set(at.x, at.y, at.z).addScaledVector(_n, 0.012);
      _q.setFromUnitVectors(Z, _n).multiply(_q2.setFromAxisAngle(Z, rand() * Math.PI * 2));
      _m.compose(_v, _q, _s.setScalar(0.32 + rand() * 0.2));
      _m.toArray(scorchState.m, i * 16);
      scorchState.t[i] = 0;
      scorchState.seed[i] = rand() * 50;
    },

    flare(at, hue = 'red') {
      const h = HUES[hue] ?? HUES.red;
      addFlash(at, FLARE.size, h.flash);
      lightUp(at, h.light, FLARE.intensity, FLARE.life);
    },

    smoke(at, size = 0.5) {
      addPuff(at, false, size * 0.3, size * 1.2, 2.2 + rand() * 0.8, 0, size * 0.3, 0.35);
    },

    explode(at, size = 1) {
      const s = Math.max(0.2, size);
      // the fireball first, then the smoke it leaves rolling up after it
      for (let k = 0; k < 6; k++) addPuff(at, true, s * 0.15, s * (0.45 + rand() * 0.3), 0.6 + rand() * 0.3, rand() * 0.12, s * 0.5, 0.6);
      for (let k = 0; k < 5; k++) addPuff(at, false, s * 0.3, s * (0.9 + rand() * 0.5), 2.6 + rand() * 1.2, 0.25 + rand() * 0.35, s * 0.6, 0.5);
      fx.spark(at, Math.round(10 + 20 * Math.min(s, 3)));
      addFlash(at, s * 0.9, BLAST.flash, 0.14);
      lightUp(at, BLAST.colour, BLAST.intensity * s, BLAST.life);
    },

    update(dt) {
      const step = Math.max(0, dt || 0);
      let ns = 0; // sprites written

      // the bolts: drawn where the rules have them, carried on by the time since their last step
      let nb = 0;
      for (let i = 0; i < N.bolts; i++) {
        if (!boltSlots.used(i)) continue;
        if (!bolts.seen[i]) {
          boltSlots.release(i);
          bolts.id[i] = null;
          continue;
        }
        bolts.seen[i] = 0;
        if (bolts.fresh[i]) bolts.lead[i] = 0;
        else bolts.lead[i] = Math.min(STEP, bolts.lead[i] + step);
        bolts.fresh[i] = 0;
        const ahead = bolts.speed[i] * bolts.lead[i] - BOLT.length / 2;
        _n.fromArray(bolts.d, i * 3);
        _v.fromArray(bolts.p, i * 3).addScaledVector(_n, ahead);
        _q.setFromUnitVectors(Y, _n);
        cores.setMatrixAt(nb, _m.compose(_v, _q, _s.setScalar(1)));
        const h = bolts.green[i] ? HUES.green : HUES.red;
        cores.setColorAt(nb, _c.setRGB(h.core[0], h.core[1], h.core[2]));
        nb++;
        sAt.setXYZ(ns, _v.x, _v.y, _v.z);
        sDir.setXYZ(ns, _n.x, _n.y, _n.z);
        sSize.setXY(ns, BOLT.length / 2, BOLT.glow);
        sColour.setXYZ(ns, h.glow[0], h.glow[1], h.glow[2]);
        ns++;
      }
      cores.count = nb;
      cores.visible = nb > 0;
      cores.instanceMatrix.needsUpdate = true;
      if (cores.instanceColor) cores.instanceColor.needsUpdate = true;

      // the sparks: thrown, falling, dragged, streaked along their way and cooling
      for (let i = 0; i < N.sparks; i++) {
        if (!sparkSlots.used(i)) continue;
        sparks.t[i] += step;
        const k = sparks.t[i] / sparks.life[i];
        if (k >= 1) {
          sparkSlots.release(i);
          continue;
        }
        const drag = Math.exp(-1.5 * step);
        const j = i * 3;
        sparks.v[j] *= drag;
        sparks.v[j + 1] = sparks.v[j + 1] * drag - GRAVITY * step;
        sparks.v[j + 2] *= drag;
        for (let a = 0; a < 3; a++) sparks.p[j + a] += sparks.v[j + a] * step;
        const speed = Math.hypot(sparks.v[j], sparks.v[j + 1], sparks.v[j + 2]) || 1;
        sAt.setXYZ(ns, sparks.p[j], sparks.p[j + 1], sparks.p[j + 2]);
        sDir.setXYZ(ns, sparks.v[j] / speed, sparks.v[j + 1] / speed, sparks.v[j + 2] / speed);
        sSize.setXY(ns, Math.min(0.09, speed * 0.012), 0.014);
        const fade = 1 - k * k;
        sColour.setXYZ(ns, (HOT[0] + (COOL[0] - HOT[0]) * k) * fade, (HOT[1] + (COOL[1] - HOT[1]) * k) * fade, (HOT[2] + (COOL[2] - HOT[2]) * k) * fade);
        ns++;
      }

      // the flashes: round, gone in a blink
      for (let i = 0; i < N.flashes; i++) {
        if (!flashSlots.used(i)) continue;
        flashes.t[i] += step;
        const k = flareLevel(flashes.t[i], flashes.life[i]);
        if (k <= 0) {
          flashSlots.release(i);
          continue;
        }
        const j = i * 3;
        sAt.setXYZ(ns, flashes.p[j], flashes.p[j + 1], flashes.p[j + 2]);
        sDir.setXYZ(ns, 0, 0, 0);
        sSize.setXY(ns, 0, flashes.size[i] * (0.6 + 0.4 * k));
        sColour.setXYZ(ns, flashes.colour[j] * k, flashes.colour[j + 1] * k, flashes.colour[j + 2] * k);
        ns++;
      }
      spriteGeo.instanceCount = ns;
      sprites.visible = ns > 0;
      for (const a of [sAt, sDir, sSize, sColour]) a.needsUpdate = true;

      // the puffs: fire swells white to orange to dark and is gone; smoke rises, spreads and thins
      let np = 0;
      for (let i = 0; i < N.puffs; i++) {
        if (!puffSlots.used(i)) continue;
        puffState.t[i] += step;
        const t = puffState.t[i] - puffState.delay[i];
        const k = t / puffState.life[i];
        if (k >= 1) {
          puffSlots.release(i);
          continue;
        }
        if (t < 0) continue;
        const j = i * 3;
        for (let a = 0; a < 3; a++) puffState.p[j + a] += puffState.v[j + a] * step;
        const fire = puffState.fire[i] === 1;
        const grow = fire ? 1 - (1 - k) ** 3 : 1 - (1 - k) ** 2;
        const r = puffState.from[i] + (puffState.to[i] - puffState.from[i]) * grow;
        pAt.setXYZ(np, puffState.p[j], puffState.p[j + 1], puffState.p[j + 2]);
        pShape.setXYZW(np, r, puffState.spin[i] + t * (fire ? 0.8 : 0.25), puffState.seed[i * 2], puffState.seed[i * 2 + 1]);
        if (fire) {
          const glow = (1 - k) ** 1.5;
          const w = smooth(0, 0.35, k);
          // white-hot to orange to a dull red, adding light and covering a little
          pColour.setXYZW(np, (6 - 5.4 * w) * glow, (4.5 - 4.3 * w) * glow, (2.5 - 2.45 * w) * glow, 0.12 * glow);
        } else {
          const a = 0.45 * smooth(0, 0.12, k) * (1 - smooth(0.35, 1, k));
          pColour.setXYZW(np, 0.11 * a, 0.11 * a, 0.12 * a, a);
        }
        np++;
      }
      puffGeo.instanceCount = np;
      puffs.visible = np > 0;
      for (const a of [pAt, pShape, pColour]) a.needsUpdate = true;

      // the scorches: an ember cooling, then soot that stays, until it is old and fades
      let nc = 0;
      for (let i = 0; i < N.scorches; i++) {
        if (!scorchSlots.used(i)) continue;
        const t = (scorchState.t[i] += step);
        if (t >= SCORCH.life + SCORCH.fade) {
          scorchSlots.release(i);
          continue;
        }
        _m.fromArray(scorchState.m, i * 16);
        scorches.setMatrixAt(nc, _m);
        burn.setXYZ(nc, flareLevel(t, SCORCH.cool), 1 - smooth(SCORCH.life, SCORCH.life + SCORCH.fade, t), scorchState.seed[i]);
        nc++;
      }
      scorches.count = nc;
      scorches.visible = nc > 0;
      scorches.instanceMatrix.needsUpdate = true;
      burn.needsUpdate = true;

      // the light: the flash’s, fading; then back to 0, where it stays
      glare.t += step;
      light.intensity = glare.peak * flareLevel(glare.t, glare.life);
      if (light.intensity === 0) glare.peak = 0;
    },

    // every shader the effects use made now, not at the first shot (the
    // pools are hidden while empty; precompile takes hidden ones too)
    warm(renderer, camera, target) {
      return precompile(renderer, group, camera, scene, target);
    },

    live() {
      const count = (slots, n) => {
        let c = 0;
        for (let i = 0; i < n; i++) if (slots.used(i)) c++;
        return c;
      };
      return { bolts: count(boltSlots, N.bolts), sparks: count(sparkSlots, N.sparks), puffs: count(puffSlots, N.puffs), scorches: count(scorchSlots, N.scorches), flashes: count(flashSlots, N.flashes) };
    },

    dispose() {
      group.removeFromParent();
      cores.dispose();
      for (const g of [coreGeo, spriteGeo, puffGeo, scorchGeo]) g.dispose();
      for (const m of [coreMat, spriteMat, puffMat, scorchMat]) m.dispose();
      scorches.dispose();
      light.dispose();
    },
  };
  return fx;
}
