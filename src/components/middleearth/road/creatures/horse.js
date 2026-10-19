// A horse on the Road: the farm pack’s rigged horse (public/kit/farm/
// horse.glb, CC0, Quaternius) with its own clips, its gait by its speed
// (horse.rules.js), its coat recoloured: bay for Gandalf’s cart, black for
// the Nazgûl, white for Asfaloth, and at 0.7 the hobbits’ ponies. Loaded
// through the runtime’s asset cache, so it goes with the Road.
//
//   createHorse(rt, { coat, height, seed }) → { group, ready, set({ speed }), tick(dt), dispose }

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GAITS, gaitFor } from './horse.rules';

const URL = '/kit/farm/horse.glb';
export const COATS = { bay: 0x7a4a2a, black: 0x16161a, white: 0xeeeeea, grey: 0x9a9a98, pony: 0x8a6a48 };
const FADE = 0.3; // s between gaits

export function createHorse(rt, { coat = 'bay', height = 1.6, seed = 0 } = {}) {
  const group = new THREE.Group();
  group.name = `road:horse:${coat}`;
  let st = null;
  let speed = 0;
  let gone = false;
  const ready = Promise.resolve(rt?.assets?.gltf?.(URL))
    .then((g) => {
      if (!g?.scene || gone) return false;
      const model = cloneSkinned(g.scene);
      const box = new THREE.Box3().setFromObject(g.scene);
      const k = height / Math.max(1e-3, box.max.y - box.min.y);
      model.scale.setScalar(k);
      model.position.y = -box.min.y * k;
      const materials = new Set();
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        // (the body’s material is the big one; the mane and hooves keep theirs, darkened with it)
        if (o.material.color) o.material.color.lerp(new THREE.Color(COATS[coat] ?? coat), 0.85);
        if ('roughness' in o.material) o.material.roughness = 0.9;
        materials.add(o.material);
        o.frustumCulled = false;
        o.castShadow = true;
      });
      group.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const actions = Object.fromEntries(g.animations.map((a) => [a.name, mixer.clipAction(a)]));
      st = { model, mixer, actions, materials, k, gait: null };
      // (each its own phase, so a team never steps as one)
      mixer.setTime((seed % 7) * 0.37);
      return true;
    })
    .catch(() => false);

  const show = (gait) => {
    if (!st || st.gait === gait) return;
    const next = st.actions[gait] ?? st.actions.Idle;
    const was = st.gait && st.actions[st.gait];
    next?.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    was?.fadeOut(FADE);
    st.gait = gait;
  };

  return {
    group,
    ready,
    set(next) {
      if (next.speed != null) speed = next.speed;
    },
    tick(dt) {
      if (!st) return;
      const gait = gaitFor(speed);
      show(gait);
      // (the clip paced to the ground, so the hooves don’t slide)
      const own = GAITS[gait] * (height / 1.6);
      const action = st.actions[gait];
      if (action && own > 0) action.timeScale = Math.max(0.4, Math.min(2.2, Math.abs(speed) / own));
      st.mixer.update(dt);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      if (!st) return;
      st.mixer.stopAllAction();
      for (const m of st.materials) m.dispose();
      st = null;
    },
  };
}
