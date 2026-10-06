// One loader for every model on the site. Meshopt is always on (every GLB
// here is meshopt-compressed); GPU-compressed textures (KTX2, Basis
// Universal) are read too, with their transcoder fetched only the first
// time a model or a texture actually carries one, so a world without them
// downloads nothing extra. Every model that comes through gets the same
// care (`prepare`): shadows where asked, skinned meshes never culled, every
// map as sharp at a slant as the device's tier allows; and as it's parsed,
// every map no bigger than the device's detail level keeps (lib/detail).
//
//   gltfLoader({ renderer }) → the shared GLTFLoader, for modules with caches
//                              of their own
//   loadGltf(url, { renderer, fresh }) → Promise<{ scene, animations, gltf }
//                              | null>: cached by URL for the page's life; with
//                              `fresh`, `scene` is a copy to move, wrap and
//                              tune (geometry and textures shared)
//   prepare(root, { renderer, shadows, receive, cullSkinned }) → root
//   tune(material, rules) → material: generator defaults clamped
//
// Only lazily loaded scene modules import this.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fitTextures, sharpenTree } from './textures';

let loader = null;
let ktx2 = null; // the KTX2Loader, once something has needed it
let ktx2Pending = null;
let detectedWith = null; // the renderer the KTX2 support was read from

// three's loader, with two changes: a file that carries GPU-compressed
// textures waits for the KTX2 loader (fetched then, not before) before it's
// parsed, whichever way it was asked for (load, loadAsync or parseAsync);
// and every model's maps are brought under this device's ceiling as it's
// parsed (lib/detail: none over 1024 on a phone, 512 on a weak device, a
// desktop's untouched), before anything has uploaded them.
class SiteGLTFLoader extends GLTFLoader {
  parse(data, path, onLoad, onError) {
    const done = (gltf) => {
      try {
        for (const scene of gltf.scenes?.length ? gltf.scenes : [gltf.scene]) fitTextures(scene);
      } catch {
        // a map that can't be fitted is drawn as it came
      }
      onLoad(gltf);
    };
    if (!this.ktx2Loader && usesBasisu(data)) {
      ktx2Loader().then(
        () => super.parse(data, path, done, onError),
        (e) => onError?.(e),
      );
      return;
    }
    super.parse(data, path, done, onError);
  }
}

export function gltfLoader() {
  if (!loader) {
    loader = new SiteGLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

// What the graphics chip can take GPU-compressed textures as, read the way
// three's KTX2Loader reads it from a renderer, from any object with
// `extensions.has(name)` (a renderer, or the probe below).
function probeRenderer() {
  let gl = null;
  try {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ?? canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
  } catch {
    gl = null;
  }
  const got = new Map();
  const get = (name) => {
    if (!got.has(name)) got.set(name, gl ? gl.getExtension(name) : null);
    return got.get(name);
  };
  return { isWebGPURenderer: false, extensions: { has: (name) => Boolean(get(name)), get } };
}

// The KTX2 loader, made and attached the first time it's needed; its
// transcoder (three's basis_transcoder.js and .wasm, bundled by Vite from
// three's own URL) only downloads on the first texture it decodes.
export function ktx2Loader({ renderer = null } = {}) {
  if (!ktx2Pending) {
    ktx2Pending = import('three/examples/jsm/loaders/KTX2Loader.js').then(({ KTX2Loader }) => {
      ktx2 = new KTX2Loader();
      ktx2.setWorkerLimit(Math.max(1, Math.min(2, (navigator?.hardwareConcurrency ?? 2) - 1)));
      ktx2.detectSupport(renderer ?? probeRenderer());
      detectedWith = renderer;
      gltfLoader().setKTX2Loader(ktx2);
      return ktx2;
    });
  }
  return ktx2Pending.then((k) => {
    if (renderer && detectedWith !== renderer) {
      k.detectSupport(renderer);
      detectedWith = renderer;
    }
    return k;
  });
}

// Does a glTF (a GLB's bytes, or a .gltf's text) carry Basis Universal
// textures? Read from its JSON chunk, so the transcoder is only fetched for
// one that does. Pure.
export function usesBasisu(data) {
  if (typeof data === 'string') return data.includes('KHR_texture_basisu');
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (!bytes || bytes.length < 20) return false;
  const u32 = (i) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | ((bytes[i + 3] << 24) >>> 0);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'glTF') return new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1 << 20))).includes('KHR_texture_basisu');
  const len = u32(12);
  const json = new TextDecoder().decode(bytes.subarray(20, Math.min(bytes.length, 20 + len)));
  return json.includes('KHR_texture_basisu');
}

const parsed = new Map(); // url → Promise<gltf | null>

// Fetch and parse, reading the KTX2 support from the scene's renderer where
// one is given (the loader's own parse falls back to a probe context).
function fetchGltf(url, renderer) {
  const files = new THREE.FileLoader();
  files.setResponseType('arraybuffer');
  return files.loadAsync(url).then(async (buffer) => {
    if (renderer && usesBasisu(buffer)) await ktx2Loader({ renderer });
    const path = THREE.LoaderUtils.extractUrlBase(url);
    return gltfLoader().parseAsync(buffer, path);
  });
}

// A model by URL, parsed once for the page's life (two worlds asking for the
// same ship share one download and one decode). Resolves null if it can't be
// had (and forgets it, so a later try asks again). The cached `scene` is the
// shared original: move or re-parent it and every user sees that, so pass
// `fresh: true` for a copy of your own (skinned ones copied with their bones;
// geometry, materials and textures still shared).
export function loadGltf(url, { renderer = null, fresh = false, prepare: prep = true } = {}) {
  if (!parsed.has(url)) {
    parsed.set(
      url,
      fetchGltf(url, renderer)
        .then((gltf) => {
          if (prep) prepare(gltf.scene, { renderer });
          return gltf;
        })
        .catch((e) => {
          parsed.delete(url);
          if (import.meta.env?.DEV) console.warn('model failed to load', url, e);
          return null;
        }),
    );
  }
  return parsed.get(url).then((gltf) => {
    if (!gltf) return null;
    const scene = fresh ? copy(gltf.scene) : gltf.scene;
    return { scene, animations: gltf.animations, gltf };
  });
}

// Forget a cached model (its owner disposes it).
export function forgetGltf(url) {
  parsed.delete(url);
}

// A copy of a model's scene, bones and all where it has them.
export function copy(root) {
  let skinned = false;
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned = true;
  });
  return skinned ? cloneSkinned(root) : root.clone(true);
}

// What every loaded model gets: shadows cast and received where asked,
// skinned meshes drawn whatever their (stale) bounds say, every map sharp at
// a slant. Done once per root (`userData.prepared`), so a shared model isn't
// walked again for every copy.
export function prepare(root, { renderer = null, shadows = false, receive = shadows, cullSkinned = false } = {}) {
  if (!root || root.userData?.prepared) return root;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (shadows) o.castShadow = true;
    if (receive) o.receiveShadow = true;
    if (o.isSkinnedMesh && !cullSkinned) o.frustumCulled = false;
  });
  sharpenTree(root, { renderer });
  if (root.userData) root.userData.prepared = true;
  return root;
}

// Generator defaults clamped: Meshy and many Sketchfab exports arrive with
// metalness 1 on painted plastic, roughness 0 on cloth, or a lamp whose
// emissive is black. Rules, each optional:
//   roughness: [min, max] applied where there's no roughness map
//   metalness: a value for materials without a metalness map whose name
//              doesn't say metal (`metalNames` decides)
//   glow: { names: /regex/, intensity } turns emissive on, from the colour,
//         for materials named like lights
//   envMapIntensity: a value
// Pure over the material's fields, so it's tested on plain objects.
const METAL_NAMES = /metal|steel|iron|chrome|gold|silver|brass|copper|alumin|titan|hull|plate|armou?r/i;
export function tune(material, { roughness = null, metalness = null, metalNames = METAL_NAMES, glow = null, envMapIntensity = null } = {}) {
  if (!material) return material;
  if (roughness && 'roughness' in material && !material.roughnessMap) {
    const r = material.roughness ?? 1;
    material.roughness = Math.min(Math.max(r, roughness[0]), roughness[1]);
  }
  if (metalness != null && 'metalness' in material && !material.metalnessMap && !metalNames.test(material.name ?? '')) material.metalness = metalness;
  if (glow && material.emissive && glow.names?.test(material.name ?? '')) {
    if (material.emissive.getHex?.() === 0 && material.color) material.emissive.copy(material.color);
    material.emissiveIntensity = glow.intensity ?? 1;
  }
  if (envMapIntensity != null && 'envMapIntensity' in material) material.envMapIntensity = envMapIntensity;
  return material;
}

// `tune` over every material under a root, each once.
export function tuneTree(root, rules) {
  const seen = new Set();
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      tune(m, rules);
    }
  });
  return root;
}
