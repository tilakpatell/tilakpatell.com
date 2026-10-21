// Beasts at graze beside the road: the farm pack's rigged animals
// (public/kit/farm/, Quaternius, CC0, from tilakverse-assets), a herd a
// row of a stage's life (stages/life.js `herds`). Each beast is its model
// cloned, at its kind's height a little varied, turned its own way, its
// Idle (heads down to the grass and up) playing from its own phase and at
// its own pace, stood on the land and never on the road or in the water.
// Loaded through the `load` lands is given (the runtime's asset cache), so
// they go with the Road.
//
//   createHerd({ load, kind, count, at: [x, z], spread, coat, seed, heightAt, away }) → { group, ready, tick(dt), dispose }
//     away(x, z) → true where no beast may stand (the road, the water, a built place)
//     coat: a colour the beasts' coats lean to (the elves' horses grey-white), as road/creatures/horse.js does
//   herdSpots({ count, at, spread, seed, away }) → [{ x, z, yaw, size, phase, pace }] (pure)
//   HERDS: each kind's file and height (m)

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { rngOf } from './scatter';

export const HERDS = {
  cow: { url: '/kit/farm/cow.glb', height: 1.45 },
  pig: { url: '/kit/farm/pig.glb', height: 0.8 },
  sheep: { url: '/kit/farm/sheep.glb', height: 0.95 },
  horse: { url: '/kit/farm/horse.glb', height: 1.6 },
};
const TRIES = 8; // a beast's tries at a spot clear of `away`

export function herdSpots({ count, at: [cx, cz], spread = 6, seed = 1, away = () => false }) {
  const rng = rngOf(7919 * seed + 13);
  const out = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < TRIES; t++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const yaw = rng() * Math.PI * 2;
      const size = 0.9 + rng() * 0.2;
      const phase = rng();
      const pace = 0.8 + rng() * 0.4;
      // (not on the road, nor in the water, nor too near another beast)
      if (away(x, z) || out.some((o) => Math.hypot(o.x - x, o.z - z) < 1.6)) continue;
      out.push({ x, z, yaw, size, phase, pace });
      break;
    }
  }
  return out;
}

export function createHerd({ load, kind, count = 3, at, spread = 6, coat = null, seed = 1, heightAt = () => 0, away = () => false }) {
  const def = HERDS[kind];
  const group = new THREE.Group();
  group.name = `road:herd:${kind}`;
  const beasts = [];
  const owned = []; // (the coats' materials, this herd's own)
  let gone = false;
  const ready = Promise.resolve(def && load ? load(def.url) : null)
    .then((g) => {
      if (!g?.scene || gone) return false;
      const box = new THREE.Box3().setFromObject(g.scene);
      const tall = Math.max(1e-3, box.max.y - box.min.y);
      const idle = g.animations.find((a) => a.name === 'Idle') ?? g.animations[0] ?? null;
      // (one coat for the herd: the cache's materials cloned once and leaned to it)
      const coated = new Map();
      const coatOf = (m) => {
        if (!coat || !m?.color) return m;
        if (!coated.has(m)) {
          const c = m.clone();
          c.color.lerp(new THREE.Color(coat), 0.85);
          coated.set(m, c);
          owned.push(c);
        }
        return coated.get(m);
      };
      for (const s of herdSpots({ count, at, spread, seed, away })) {
        const model = cloneSkinned(g.scene);
        const k = (def.height * s.size) / tall;
        model.scale.setScalar(k);
        model.position.set(s.x, heightAt(s.x, s.z) - box.min.y * k, s.z);
        model.rotation.y = s.yaw;
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.material = coatOf(o.material);
          o.castShadow = true;
          o.frustumCulled = false; // (a skinned mesh's bounds don't follow its pose)
        });
        group.add(model);
        const mixer = new THREE.AnimationMixer(model);
        if (idle) {
          const action = mixer.clipAction(idle);
          action.timeScale = s.pace;
          action.play();
          mixer.setTime(s.phase * idle.duration);
        }
        beasts.push({ model, mixer });
      }
      return true;
    })
    .catch(() => false);

  return {
    group,
    ready,
    tick(dt) {
      for (const b of beasts) b.mixer.update(dt);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      for (const b of beasts) b.mixer.stopAllAction();
      beasts.length = 0;
      for (const m of owned) m.dispose();
    },
  };
}
