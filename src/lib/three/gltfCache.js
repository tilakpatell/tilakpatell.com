// One fetch and parse of each model file for the page's life, and copies of it
// that are safe to hand out.
//
// Every place that wants a model used to load it itself, so the same GLB was
// fetched and parsed again for each (the fleet, the galaxy's ships, the
// planets' models). loadGLTF(url) keeps the promise for each url, so the
// second asker and every one after gets the first's result, and a copy of it
// comes from cloneScene(gltf): geometry and textures are shared with the
// cached original (the big, GPU-held things, uploaded once), and each copy has
// materials of its own, so a copy can be tinted, faded or disposed without
// touching the others or the original. A skinned model's copies are made with
// SkeletonUtils so each has bones of its own.
//
// loadGLTF(url, { loader }) → Promise<GLTF | null>
//   The loader is the site's (gltf.js: meshopt, and KTX2 when a file needs it;
//   a test hands in a stand-in with just loadAsync(url); the cache is by url
//   alone, so whichever loader asks first is the one that loads it). Its maps
//   are sharpened once, on the original, as the copies share them.
//   A load that fails resolves null and isn't kept, so a later call tries again.
// cloneScene(gltf) → Object3D
// gltfStats() → { requests, parses }: loadGLTF calls and loads actually started
//   (counted in dev builds only; nought in a production one)
// clearGLTFCache(): forgets everything, and the counts. For tests only: a
//   page keeps what it loaded.

import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from './gltf';
import { sharpenTree } from './textures';

const cache = new Map(); // url → Promise<GLTF | null>
const stats = { requests: 0, parses: 0 };

export function loadGLTF(url, { loader } = {}) {
  if (import.meta.env.DEV) stats.requests++;
  if (cache.has(url)) return cache.get(url);
  if (import.meta.env.DEV) stats.parses++;
  const p = Promise.resolve()
    .then(() => (loader ?? gltfLoader()).loadAsync(url))
    .then((gltf) => {
      if (gltf?.scene) sharpenTree(gltf.scene);
      return gltf ?? null;
    })
    .catch(() => null)
    .then((gltf) => {
      // (a failure is forgotten, unless the cache was cleared and refilled meanwhile)
      if (!gltf && cache.get(url) === p) cache.delete(url);
      return gltf;
    });
  cache.set(url, p);
  return p;
}

export function cloneScene(gltf) {
  let skinned = false;
  gltf.scene.traverse((o) => o.isSkinnedMesh && (skinned = true));
  const copy = skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
  // (clone shares materials with the original; each copy gets its own, one for
  // each the original has, so meshes that shared a material still do: GLTFLoader
  // gives every primitive of a glTF material the one Material, and a ship of 30
  // primitives on 3 materials is 3 in a copy, not 30)
  const own = new Map(); // the original's material → this copy's
  const swap = (m) => {
    if (!own.has(m)) own.set(m, m.clone());
    return own.get(m);
  };
  copy.traverse((o) => {
    if (o.material) o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return copy;
}

export function gltfStats() {
  return { ...stats };
}

export function clearGLTFCache() {
  cache.clear();
  stats.requests = 0;
  stats.parses = 0;
}
