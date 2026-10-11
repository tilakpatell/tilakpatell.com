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
//   loadGltfFile(url) → Promise<gltf>: that loader's parse of one file, asked
//                              of the asset base first (src/lib/assetBase.js),
//                              through the site's pool (src/lib/assetLoad.js),
//                              as every load of the shared loader is
//   loadGltf(url, { renderer, fresh }) → Promise<{ scene, animations, gltf }
//                              | null>: cached by URL for the page's life; with
//                              `fresh`, `scene` is a copy to move, wrap and
//                              tune (geometry and textures shared)
//   prepare(root, { renderer, shadows, receive, cullSkinned }) → root
//   detectSupport(ktx2, renderer) → Promise<ktx2>: the chip's KTX2 formats
//                              read, a node renderer waited for till it's up
//   tune(material, rules) → material: generator defaults clamped
//   tuneTree(root, rules) → root: `tune` over every material, each once
//   SHIP_PROFILE: the rules the universe map's hero ships are tuned by
//
// Only lazily loaded scene modules import this.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fitTextures, sharpenTree } from './textures';
import { basisUp, meshoptUp } from './wasmDecoders.js';
import { loadBytes } from '../assetLoad';
import { features } from '../wasm/features.js';

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
  // Its bytes through the site's pool (lib/assetLoad): the bucket's copy
  // where it holds the file, the site's after; retried, timed out, held to
  // its length, one request per URL, and stopped with the world that asked
  // (an abort rejects with an AbortError, nothing parsed). The URL its
  // sidecars resolve against stays the site's, as three's own load has it.
  load(url, onLoad, onProgress, onError) {
    const resourcePath = this.resourcePath !== '' ? this.resourcePath : this.path !== '' ? THREE.LoaderUtils.resolveURL(THREE.LoaderUtils.extractUrlBase(url), this.path) : THREE.LoaderUtils.extractUrlBase(url);
    const full = this.path !== '' ? THREE.LoaderUtils.resolveURL(url, this.path) : url;
    this.manager.itemStart(url);
    const fail = (e) => {
      if (onError) onError(e);
      else if (e?.name !== 'AbortError') console.error(e);
      this.manager.itemError(url);
      this.manager.itemEnd(url);
    };
    loadBytes(this.manager.resolveURL(full)).then(
      (data) => {
        try {
          this.parse(
            data,
            resourcePath,
            (gltf) => {
              onLoad(gltf);
              this.manager.itemEnd(url);
            },
            fail,
          );
        } catch (e) {
          fail(e);
        }
      },
      fail,
    );
  }

  parse(data, path, onLoad, onError) {
    const done = (gltf) => {
      try {
        for (const scene of gltf.scenes?.length ? gltf.scenes : [gltf.scene]) fitTextures(scene);
      } catch {
        // a map that can't be fitted is drawn as it came
      }
      onLoad(gltf);
    };
    // (the decoders up first, so one that can't come up fails the model
    // with its name, lib/three/wasmDecoders.js, rather than the parser's words)
    const decoders = !this.ktx2Loader && usesBasisu(data) ? Promise.all([meshopt(), ktx2Loader()]) : meshopt();
    decoders.then(
      () => super.parse(data, path, done, onError),
      (e) => onError?.(e),
    );
  }
}

export function gltfLoader() {
  if (!loader) {
    loader = new SiteGLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

// the meshopt decoder up (its SIMD build where the browser has it), once
const meshopt = () => meshoptUp(MeshoptDecoder, { simd: features().simd });

// The decoders a world's models and textures need, brought up while its
// chunk loads (a world's module calls this beside its own imports): the
// meshopt decoder always, the Basis transcoder where the world draws KTX2.
// Settles either way; what failed is in lib/wasm/load's status() and fails
// again, by name, where it's used.
export function preloadDecoders({ renderer = null, basis = false } = {}) {
  return Promise.allSettled([meshopt(), basis ? ktx2Loader({ renderer }) : null]);
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

// The chip's formats read into the KTX2 loader. A node renderer answers
// from its device, which three (r186) has only once init() has resolved,
// and throws before; so one not yet up is waited for, within `timeoutMs`
// (three's init() hands back the promise already running, so asking again
// starts nothing, as its own detectSupportAsync did). A throw is a named
// KTX2SupportError, never an unhandled one.
//   detectSupport(ktx2, renderer, { timeoutMs }) → Promise<ktx2>
export async function detectSupport(k, renderer, { timeoutMs = 10000 } = {}) {
  let timer = null;
  try {
    if (typeof renderer?.hasInitialized === 'function' && renderer.hasInitialized() === false) {
      const late = new Promise((_, no) => (timer = setTimeout(() => no(new Error(`the renderer did not come up in ${timeoutMs} ms`)), timeoutMs)));
      await Promise.race([renderer.init(), late]);
    }
    k.detectSupport(renderer);
    return k;
  } catch (e) {
    const named = new Error(`ktx2: the chip's texture formats could not be read (${e?.message ?? e})`, { cause: e });
    named.name = 'KTX2SupportError';
    throw named;
  } finally {
    clearTimeout(timer);
  }
}

// The KTX2 loader, made and attached the first time it's needed; its
// transcoder (three's basis_transcoder.js and .wasm, bundled by Vite from
// three's own URL) only downloads on the first texture it decodes.
// The transcoder is brought up (fetched and compiled on the main thread,
// wasmDecoders.js's basisUp) before the loader is handed out, so a
// transcoder that can't be had is a named WasmError here and not a texture
// waiting for a worker that never answers; and a loader that failed so is
// let go, the next ask making another. The chip's formats are read the same
// way (detectSupport above): a renderer not yet up is waited for, and one
// that can't say is a named error and another try on the next ask.
export function ktx2Loader({ renderer = null } = {}) {
  if (!ktx2Pending) {
    ktx2Pending = import('three/examples/jsm/loaders/KTX2Loader.js')
      .then(async ({ KTX2Loader }) => {
        const k = new KTX2Loader();
        k.setWorkerLimit(Math.max(1, Math.min(2, (navigator?.hardwareConcurrency ?? 2) - 1)));
        try {
          await detectSupport(k, renderer ?? probeRenderer());
          await basisUp(k);
        } catch (e) {
          k.dispose();
          throw e;
        }
        ktx2 = k;
        detectedWith = renderer;
        gltfLoader().setKTX2Loader(ktx2);
        return ktx2;
      })
      .catch((e) => {
        ktx2Pending = null;
        throw e;
      });
  }
  return ktx2Pending.then(async (k) => {
    if (renderer && detectedWith !== renderer) {
      // (one that can't say rejects this ask alone; the next asks again)
      await detectSupport(k, renderer);
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
function fetchGltf(url, renderer, opts) {
  // (the bucket's copy where it has one, through the pool: the same bytes,
  // so the same model; resolved against the site's path, as it always was)
  return loadBytes(url, opts).then(async (buffer) => {
    if (renderer && usesBasisu(buffer)) await ktx2Loader({ renderer });
    const path = THREE.LoaderUtils.extractUrlBase(url);
    return gltfLoader().parseAsync(buffer, path);
  });
}

// One file through the shared loader, uncached, for a module that keeps its
// own: from the asset bucket where it has the file (the same bytes, so the
// same model), else the site (the loader's own load asks that way).
export function loadGltfFile(url) {
  return gltfLoader().loadAsync(url);
}

// A model by URL, parsed once for the page's life (two worlds asking for the
// same ship share one download and one decode). Resolves null if it can't be
// had (and forgets it, so a later try asks again). The cached `scene` is the
// shared original: move or re-parent it and every user sees that, so pass
// `fresh: true` for a copy of your own (skinned ones copied with their bones;
// geometry, materials and textures still shared).
//
// `signal` and `priority` go to the pool (lib/assetLoad: by default the
// world in front's, and 0); a caller whose signal has gone by the time the
// model is there gets null, so a world left mid-load touches nothing.
export function loadGltf(url, { renderer = null, fresh = false, prepare: prep = true, signal, priority } = {}) {
  if (!parsed.has(url)) {
    const p = fetchGltf(url, renderer, { ...(signal !== undefined && { signal }), ...(priority !== undefined && { priority }) })
      .then((gltf) => {
        if (prep) prepare(gltf.scene, { renderer });
        return gltf;
      })
      .catch((e) => {
        if (parsed.get(url) === p) parsed.delete(url);
        if (import.meta.env?.DEV && e?.name !== 'AbortError') console.warn('model failed to load', url, e);
        return null;
      });
    parsed.set(url, p);
  }
  return parsed.get(url).then((gltf) => {
    if (!gltf || signal?.aborted) return null;
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
//              doesn't say metal (`metalNames` decides); or { metal, paint },
//              a value for each
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
  if (metalness != null && 'metalness' in material && !material.metalnessMap) {
    const metal = metalNames.test(material.name ?? '');
    if (typeof metalness === 'object') material.metalness = metal ? metalness.metal : metalness.paint;
    else if (!metal) material.metalness = metalness;
  }
  if (glow && material.emissive && glow.names?.test(material.name ?? '')) {
    if (material.emissive.getHex?.() === 0 && material.color) material.emissive.copy(material.color);
    material.emissiveIntensity = glow.intensity ?? 1;
  }
  if (envMapIntensity != null && 'envMapIntensity' in material) material.envMapIntensity = envMapIntensity;
  return material;
}

// The hero ships' finish (universe/shipModels.js): a clay-looking export
// read as paint over metal. The paint a satin, 0.42 to 0.6 rough (the top
// low enough that the key makes a real highlight on the hull), a tenth
// metallic; the parts named as metal (not the hull or its plates, which are
// painted on a ship) 0.65; and the space round it in the hull a little
// brighter than the scene's own, 1.3, so the hull catches the stars.
export const SHIP_PROFILE = {
  roughness: [0.42, 0.6],
  metalness: { metal: 0.65, paint: 0.1 },
  metalNames: /metal|steel|iron|chrome|gold|silver|brass|copper|alumin|titan|trim|engine|exhaust|thruster|nozzle|gun|cannon|barrel|pipe/i,
  envMapIntensity: 1.3,
  // The hull's light (livery.js reads it): the key at full, the rim at a
  // half, the fill at 0.6. A quarter made every ship you fly (the RV, the
  // cruiser) black on the side away from its star, which the chase camera
  // often sees; 0.6 still keeps the lit side the brighter by more than the
  // soft 2.35 : fill that made the ship flat.
  light: { key: 1, fill: 0.6, rim: 0.5 },
};

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
