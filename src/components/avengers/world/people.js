// The compound's people from Sketchfab (../people/models.js: Cap, Thor, the
// Hulk, Natasha and an Iron Man armour, CC BY), animated by their own clips:
// idle, walk and run (and Cap's jump), in place, so the world moves them.
//
// loadPerson(url) → a template, loaded once; person(template) → a copy to
// place: { root, play(name, opts), update(dt), bone(name), height, dispose }.
// clipsFor(model, clips) plays clips on any model whose bones they name, and
// loadClips(url) loads clips alone (Spider-Man's moves, for his model).

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from '../../../lib/three/gltf';
import { sharpenMaterial } from '../../../lib/three/textures';

let loader = null;
const cache = new Map();
const asset = (file) => `${import.meta.env?.BASE_URL ?? '/'}${file.replace(/^\//, '')}`;

export function loadPerson(url) {
  if (!cache.has(url)) {
    if (!loader) {
      loader = gltfLoader();
    }
    cache.set(
      url,
      loader.loadAsync(asset(url)).then((g) => {
        g.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.isSkinnedMesh) o.frustumCulled = false;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) sharpenMaterial(m);
        });
        return { scene: g.scene, clips: g.animations };
      }),
    );
  }
  return cache.get(url);
}

// Clips to play on a model (anything whose bones the clips name): play(name,
// { speed, loop, from }) crosses over from the clip playing; `speed` its pace,
// `loop` false to play it once and hold the last frame, `from` where to start.
// From one of the `sync` clips to another (the gaits, whose steps start on
// the same foot) it picks up at the same point of the stride, so the feet
// don't scramble; a looping clip taken back before it has faded out goes on
// from where it was, rather than start over.
export function clipsFor(model, clips, { fade = 0.22, sync = ['walk', 'run'] } = {}) {
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of clips) actions[clip.name] = mixer.clipAction(clip);
  let current = null;
  return {
    actions,
    play(name, { speed = 1, loop = true, from = 0 } = {}) {
      const a = actions[name];
      if (!a) return false;
      a.timeScale = speed;
      if (current === a) return true;
      const stride = current && sync.includes(name) && sync.includes(current.getClip().name) ? (current.time / current.getClip().duration) % 1 : null;
      const fading = loop && a.isRunning() && a.getEffectiveWeight() > 0.01;
      if (!fading) a.reset();
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !loop;
      if (stride !== null) a.time = stride * a.getClip().duration;
      else if (!fading) a.time = from;
      a.enabled = true;
      a.setEffectiveWeight(1);
      a.play();
      if (current) a.crossFadeFrom(current, fade, false);
      current = a;
      return true;
    },
    get playing() {
      return current?.getClip().name ?? null;
    },
    update: (dt) => mixer.update(dt),
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    },
  };
}

// Clips alone, from a file of just a skeleton and its animations (made to
// play on another file's model, as Spider-Man's moves are on his model):
// { name: clip }, or null if there's no such file.
export async function loadClips(url) {
  try {
    const t = await loadPerson(url);
    return Object.fromEntries(t.clips.map((c) => [c.name, c]));
  } catch {
    return null;
  }
}

// A copy to place, its feet at its origin, facing +z (as the downloads were
// made: scripts/sketchfab-avengers.mjs), playing its own clips.
export function person(template, opts) {
  const model = hasSkin(template.scene) ? cloneSkinned(template.scene) : template.scene.clone(true);
  const root = new THREE.Group();
  root.add(model);
  const clips = clipsFor(model, template.clips, opts);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  return {
    root,
    model,
    actions: clips.actions,
    height: box.max.y - box.min.y,
    play: clips.play,
    get playing() {
      return clips.playing;
    },
    update: clips.update,
    bone: (name) => model.getObjectByName(name),
    dispose: clips.dispose,
  };
}

function hasSkin(root) {
  let skin = false;
  root.traverse((o) => {
    if (o.isSkinnedMesh) skin = true;
  });
  return skin;
}
