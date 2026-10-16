// rv.js on the node renderer: the wings, the winged RV seen from outside,
// Hank’s SUV after it and Walt’s blue crystals, copied line for line; the
// glows are the node kit’s sprites (../kitNodes.js) and the crystals'
// material is the MeshStandardMaterial’s node twin, the same settings. The
// models’ own materials stay as they load: the node renderer draws a
// classic material through its node twin by itself.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { gltfLoader } from '../../../lib/three/gltf';
import { glowSprite, rng } from '../kitNodes';
import { smooth } from '../timeline';
import { TAU, V3 } from './rvNodesKit';

// ── the wings ──
// Walt's home-made wings, the site owner's Meshy models (scripts/meshy-rv.mjs):
// one wing as it came, a right one (its root at +z, its tip at −z, its
// leading edge at −x, the jet hanging under it), mirrored for the left; and
// the whole RV with a pair of them, for the last look at it from outside (its
// cab at −x, its wings along z). Raw: where things are on the models as they
// came, in their own units.
const WINGS = { x: 1.22, y: 0.45, z: 0.1, span: 5.2, stow: 1.52, rise: 0.05 };
const WING_RAW = { span: 1.9, top: 0.18, jet: [0.235, -0.14, 0.374], tip: [-0.1, 0.15, -0.955] };
const FLYER = { length: 8.5, jet: [-0.15, -0.27, 0.5], tip: [-0.2, -0.19, 0.955] };
// the RV from outside: where it is (from your eye) and how it's turned, `u`
// of the way from the cut to the peak; off ahead and to the right, banking
// away and climbing, so its side and both wings show
export function flightAt(u) {
  const d = 32 * u ** 1.4;
  return { x: 1.6 + 0.43 * d, y: -3 + 0.3 * d, z: -11 - 0.88 * d, yaw: -0.45, pitch: 0.25, roll: -0.12 - 0.08 * u };
}
// Hank, after you: his SUV (Albuquerque's, its front at −x, 5 m long and
// standing on y = 0) behind the RV, off to its left and below, and gaining,
// `u` as above, from the RV; it comes up from behind you, closes, then the
// RV pulls away
export function chaseAt(u) {
  const close = smooth((u - 0.05) / 0.5);
  return { x: -10 + 2.6 * close, y: -5 + 2.6 * smooth(u / 0.5), z: 19 - 9.5 * close + 16 * smooth((u - 0.78) / 0.22) };
}
// the blue crystals: how many spill out, and where from on the RV (its back
// door, from the RV's middle, in metres)
export const CRYSTALS = 70;
export const DOOR = [0.4, -0.6, 3.8];

export const LATE = 4000; // how long the cab waits for these three (ms)
export const WING_URL = '/models/cockpit/rv-wing.glb';
export const FLYER_URL = '/models/universe/rv-wings.glb';
export const SUV_URL = '/models/albuquerque/world/suv.glb';

export function loadModel(url) {
  const l = gltfLoader();
  return l
    .loadAsync(url)
    .then((g) => g.scene)
    .catch(() => null);
}

// Its paint lit from within a little (none by day), so a wing still reads as
// one against the night; returns the materials, to turn that up and down.
function selfLit(model) {
  const mats = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.isMeshStandardMaterial || mats.has(m)) continue;
      m.emissive.setRGB(1, 0.92, 0.82);
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0;
      m.metalness = Math.min(m.metalness, 0.3);
      mats.add(m);
    }
  });
  return [...mats];
}

// The pair, each on a pivot at the trailing edge of its root, under the side
// windows: swung back along the body below the window line (where you can't
// see them) until `open` swings them out level and they lock with a little
// rise. Each jet's glow is a pair of sprites (a hot core in a wide haze); the
// tips carry a red light on the left and a green on the right.
export function wingPair(model) {
  const s = WINGS.span / WING_RAW.span;
  const group = new THREE.Group();
  const mats = selfLit(model);
  const pivots = [];
  const jets = [];
  const tips = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * WINGS.x, WINGS.y, WINGS.z);
    pivot.scale.x = sx; // the left is the right one mirrored
    const wing = sx > 0 ? model : model.clone();
    wing.rotation.y = -Math.PI / 2;
    wing.scale.setScalar(s);
    wing.updateMatrixWorld(true);
    // its root on the pivot, its trailing edge too, its top surface level with it
    const box = new THREE.Box3().setFromObject(wing);
    wing.position.set(-box.min.x, -WING_RAW.top * s, -box.max.z);
    const haze = glowSprite(0xff8a3a, 1.5 / s, 0);
    const core = glowSprite(0xfff0d8, 0.55 / s, 0);
    haze.position.set(...WING_RAW.jet).x += 0.08;
    core.position.set(...WING_RAW.jet).x += 0.03;
    const tip = glowSprite(sx < 0 ? 0xff2a2a : 0x38ff6a, 0.5 / s, 0);
    tip.position.set(...WING_RAW.tip);
    wing.add(haze, core, tip);
    jets.push(haze, core);
    tips.push(tip);
    pivot.add(wing);
    group.add(pivot);
    pivots.push(pivot);
  }
  return {
    group,
    // open: 0 stowed … 1 out; jets and lights: 0 … 1; night: how dark it is
    set(open, jets01, lights, night, t) {
      pivots.forEach((p, i) => {
        const sx = i ? 1 : -1;
        const o = open[i];
        p.rotation.set(0, -sx * WINGS.stow * (1 - o), sx * WINGS.rise * smooth((o - 0.92) / 0.08));
        p.visible = o > 0.001;
      });
      const flicker = 1 + 0.08 * Math.sin(t * 61) + 0.05 * Math.sin(t * 37);
      jets.forEach((j, i) => (j.material.opacity = jets01 * (i % 2 ? 1 : 0.75) * flicker));
      const blink = lights * (Math.sin(t * 5.2) > 0.2 ? 1 : 0.18);
      tips.forEach((tip) => (tip.material.opacity = blink));
      for (const m of mats) m.emissiveIntensity = 0.16 * night + 0.12 * jets01;
    },
  };
}

// Hank's SUV, turned to −z, its lights on the roof (red and blue, taking
// turns) and its tail lights on.
export function chaserOf(model) {
  const group = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  model.position.y = -0.95;
  group.add(model);
  const mats = selfLit(model);
  // (each lamp a hot core in a wide, faint halo: one big bright sprite reads
  // as a ball of light sat on the roof, not as a lamp)
  const bar = [0xff2a2a, 0x2a6bff].map((c, i) => {
    const core = glowSprite(c, 0.9, 0);
    const halo = glowSprite(c, 4.2, 0);
    for (const s of [core, halo]) s.position.set(i ? 0.45 : -0.45, 1.05, 0.3);
    group.add(core, halo);
    return { core, halo };
  });
  for (const sx of [-1, 1]) {
    const tail = glowSprite(0xff3020, 0.7, 0.8);
    tail.position.set(sx * 0.85, 0.1, 2.5);
    group.add(tail);
  }
  group.visible = false;
  return {
    group,
    set(t) {
      const a = Math.sin(t * 19) > 0;
      bar.forEach((lamp, i) => {
        const on = (i === 0) === a;
        lamp.core.material.opacity = on ? 1 : 0.12;
        lamp.halo.material.opacity = on ? 0.3 : 0.03;
      });
      for (const m of mats) m.emissiveIntensity = 0.2;
    },
  };
}

// Walt's blue crystals, tumbling out of the RV's back door as it climbs: each
// let go at its own moment where the RV was then, drifting back past you
// while the RV pulls away (all worked out from the moment, so a jump or a
// skip shows them where they'd be). One instanced mesh.
export function crystals(n) {
  const geo = new THREE.OctahedronGeometry(0.11, 0).scale(0.7, 1.5, 0.7);
  const mat = new MeshStandardNodeMaterial({ color: 0x8fdcff, emissive: 0x2a9cff, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.1, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const r = rng(83);
  const each = Array.from({ length: n }, (_, i) => ({ at: 0.04 + (0.8 * i) / n + r() * 0.01, v: [(r() - 0.5) * 3, (r() - 0.6) * 2, 5 + r() * 7], spin: [r() * 6, r() * 6, r() * TAU], size: 0.7 + r() * 0.9 }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new V3();
  const sc = new V3();
  mesh.visible = false;
  return {
    mesh,
    // u: through the shot; secs: how long the shot is; from(at) → where the
    // door was at `at`
    set(u, secs, from) {
      each.forEach((c, i) => {
        const age = (u - c.at) * secs;
        if (age < 0) {
          sc.setScalar(0);
          m.compose(pos.set(0, 0, 0), q.identity(), sc);
        } else {
          from(c.at, pos);
          pos.x += c.v[0] * age;
          pos.y += c.v[1] * age;
          pos.z += c.v[2] * age;
          e.set(c.spin[2] + c.spin[0] * age, c.spin[1] * age, 0);
          sc.setScalar(c.size * Math.min(1, age * 6));
          m.compose(pos, q.setFromEuler(e), sc);
        }
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// The whole winged RV from outside: centred, its cab turned to −z,
// FLYER.length long, with its jets and its wingtips' lights.
export function flyerOf(model) {
  const group = new THREE.Group();
  const box = new THREE.Box3().setFromObject(model);
  const s = FLYER.length / (box.max.x - box.min.x);
  model.position.copy(box.getCenter(new V3())).negate();
  const holder = new THREE.Group();
  holder.rotation.y = -Math.PI / 2;
  holder.scale.setScalar(s);
  holder.add(model);
  group.add(holder);
  const mats = selfLit(model);
  const jets = [];
  const tips = [];
  for (const sz of [-1, 1]) {
    const haze = glowSprite(0xff8a3a, 2.4 / s, 0);
    const core = glowSprite(0xfff0d8, 0.8 / s, 0);
    haze.position.set(FLYER.jet[0] + 0.03, FLYER.jet[1], sz * FLYER.jet[2]);
    core.position.set(FLYER.jet[0] + 0.01, FLYER.jet[1], sz * FLYER.jet[2]);
    // its left wing is the one along +z
    const tip = glowSprite(sz > 0 ? 0xff2a2a : 0x38ff6a, 0.9 / s, 0);
    tip.position.set(FLYER.tip[0], FLYER.tip[1], sz * FLYER.tip[2]);
    model.add(haze, core, tip);
    jets.push(haze, core);
    tips.push(tip);
  }
  group.visible = false;
  return {
    group,
    set(jets01, t) {
      const flicker = 1 + 0.1 * Math.sin(t * 57) + 0.06 * Math.sin(t * 31);
      jets.forEach((j, i) => (j.material.opacity = jets01 * (i % 2 ? 1 : 0.8) * flicker));
      const blink = Math.sin(t * 5.2) > 0.2 ? 1 : 0.15;
      tips.forEach((tip) => (tip.material.opacity = blink));
      for (const m of mats) m.emissiveIntensity = 0.1;
    },
  };
}

