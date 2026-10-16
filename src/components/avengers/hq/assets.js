// Loading the HQ games' CC0 assets from public/hq/ (made by
// scripts/hq-assets.mjs): PBR texture sets, skies and models. Everything is
// cached, so two games, or a game played twice, load a file once. A file that
// fails to load never stops a game: a texture set falls back to a plain
// material of the right colour, a model to an empty group.

import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { loadGltfFile } from '../../../lib/three/gltf';
import { loadTexture, sharpen, sharpenMaterial, warm } from '../../../lib/three/textures';
import { IMPOSTORS, MODELS, SKIES, TEXTURES } from './catalog';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}hq/`;
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

// (decoded off the main thread where the browser can, as sharp at a slant
// as the device's tier allows; the colour space is set by whoever asked)
const loadImage = (url) => loadTexture(url, { color: undefined });

// Roughly the colour of each set, for when its files can't be had.
const FALLBACK = {
  grass: 0x5d6b34,
  'forest-floor': 0x5e5a3a,
  asphalt: 0x3a3a3c,
  brick: 0x7a3b2e,
  bark: 0x4a3b2c,
  'painted-metal': 0xb02a22,
};

// A texture set: colour, normal, and AO/roughness/metal packed into one map
// (red, green, blue, which is how three.js reads them). `small` asks for the
// half-size files, for phones.
export function loadSet(name, { small = false } = {}) {
  const spec = TEXTURES[name];
  if (!spec) return Promise.resolve(null);
  const suffix = small ? `-${spec.small}` : '';
  return once(`set:${name}${suffix}`, async () => {
    try {
      const [map, normalMap, arm] = await Promise.all([
        loadImage(`${BASE}tex/${name}/color${suffix}.webp`),
        loadImage(`${BASE}tex/${name}/normal${suffix}.jpg`),
        loadImage(`${BASE}tex/${name}/arm${suffix}.jpg`),
      ]);
      map.colorSpace = THREE.SRGBColorSpace;
      for (const t of [map, normalMap, arm]) sharpen(t, { wrap: true });
      return { map, normalMap, arm, alpha: spec.alpha };
    } catch {
      return null;
    }
  });
}

// A physically based material from a texture set, tiled `repeat` times. The
// set's textures are shared; each material gets its own tiling.
export async function pbr(name, { repeat = [1, 1], small = false, color, normalScale = 1, roughness = 1, metalness = 1, aoMapIntensity = 1, envMapIntensity, side, transparent, alphaTest, rotation = 0, physical, ...extra } = {}) {
  const set = await loadSet(name, { small });
  const Mat = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  if (!set) return new Mat({ color: color ?? FALLBACK[name] ?? 0x808080, roughness: 0.8, metalness: 0, ...(side != null ? { side } : {}), ...extra });
  const tile = (t) => {
    const c = t.clone();
    c.repeat.set(repeat[0], repeat[1]);
    c.rotation = rotation;
    c.needsUpdate = true;
    return c;
  };
  const arm = tile(set.arm);
  const m = new Mat({
    ...(side != null ? { side } : {}),
    map: tile(set.map),
    normalMap: tile(set.normalMap),
    normalScale: new THREE.Vector2(normalScale, normalScale),
    aoMap: arm,
    aoMapIntensity,
    roughnessMap: arm,
    metalnessMap: arm,
    roughness,
    metalness,
    transparent: transparent ?? false,
    alphaTest: alphaTest ?? (set.alpha ? 0.5 : 0),
    ...extra,
  });
  if (color != null) m.color = new THREE.Color(color);
  if (envMapIntensity != null) m.envMapIntensity = envMapIntensity;
  return m;
}

// A sky: the HDR that lights the scene, the photo you see, and what the asset
// script found in it (its sun, the colour of its horizon). The photo is only
// fetched for a scene that shows it (`background`): the compound's sky
// lights the map but is never seen, and its photo alone is 1.6 MB.
const skyPhoto = (name) =>
  once(`sky-photo:${name}`, () =>
    loadImage(`${BASE}sky/${name}/sky.jpg`)
      .then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })
      .catch(() => null),
  );

export function loadSky(name, { background = true } = {}) {
  const meta = SKIES[name] ?? { sun: null, horizon: [0.5, 0.5, 0.5], sky: false };
  const hdr = once(`sky:${name}`, async () => {
    const t = await new HDRLoader().loadAsync(`${BASE}sky/${name}/env.hdr`).catch(() => {
      // no sky file: a plain grey one, so the scene still lights
      const g = new THREE.DataTexture(new Float32Array([0.5, 0.5, 0.5, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
      g.needsUpdate = true;
      return g;
    });
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  });
  return Promise.all([hdr, background && meta.sky ? skyPhoto(name) : null]).then(([h, photo]) => ({ hdr: h, background: photo, meta }));
}

// A model, as loaded (shared: clone it before placing it).
export function loadModel(name) {
  return once(`model:${name}`, async () => {
    try {
      const gltf = await loadGltfFile(`${BASE}models/${name}.glb`);
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) sharpenMaterial(m);
        }
      });
      return gltf.scene;
    } catch {
      return new THREE.Group();
    }
  });
}

// A copy of a model ready to place, its feet on the ground at the origin
// (the script records each model's bounds), optionally one named part of it.
export async function placeModel(name, { node } = {}) {
  const src = await loadModel(name);
  const part = node ? src.getObjectByName(node) ?? src : src;
  const copy = part.clone(true);
  const b = MODELS[name]?.nodes?.[node] ?? MODELS[name];
  if (node && b) {
    // a variant sitting beside the others in its file: centre it
    copy.position.set(-(b.min[0] + b.max[0]) / 2 + copy.position.x, -b.min[1] + copy.position.y, -(b.min[2] + b.max[2]) / 2 + copy.position.z);
  }
  const holder = new THREE.Group();
  holder.add(copy);
  return holder;
}

// Every geometry and material in a model, as instanced-mesh parts: one draw
// per part however many copies are placed. `transforms` is a list of
// THREE.Matrix4. Returns a group of InstancedMeshes.
export async function instanceModel(name, transforms, { node, shadows = true } = {}) {
  const src = await loadModel(name);
  const part = node ? src.getObjectByName(node) ?? src : src;
  const group = new THREE.Group();
  src.updateMatrixWorld(true);
  // a variant is moved so its feet sit at the origin (its bounds are in the
  // file's world space); a whole model keeps the file's own origin
  const b = node ? MODELS[name]?.nodes?.[node] : null;
  const base = b ? new THREE.Matrix4().makeTranslation(-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2) : new THREE.Matrix4().copy(part.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  part.traverse((o) => {
    if (!o.isMesh) return;
    local.multiplyMatrices(base, o.matrixWorld);
    const inst = new THREE.InstancedMesh(o.geometry, o.material, transforms.length);
    transforms.forEach((t, i) => inst.setMatrixAt(i, m.multiplyMatrices(t, local)));
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  });
  return group;
}

// A tree photographed for distant forests (scripts/hq-impostors.mjs): its
// colour, its normals, and its size.
export function loadImpostor(name) {
  const meta = IMPOSTORS[name];
  if (!meta) return Promise.resolve(null);
  return once(`imp:${name}`, async () => {
    try {
      const [map, normalMap] = await Promise.all([loadImage(`${BASE}impostors/${name}/color.webp`), loadImage(`${BASE}impostors/${name}/normal.png`)]);
      map.colorSpace = THREE.SRGBColorSpace;
      for (const t of [map, normalMap]) sharpen(t);
      return { ...meta, map, normalMap };
    } catch {
      return null;
    }
  });
}

// Start loading what a game needs while it's still being built.
// (`backgrounds: false` for a game whose skies only light it)
// With a `renderer`, everything that came is uploaded to the graphics chip
// over the next idle moments (lib/three/textures' warm), so the first frames
// of the game don't each stop for a texture.
export const preload = ({ sets = [], skies = [], models = [], impostors = [], small = false, backgrounds = true, renderer = null } = {}) =>
  Promise.all([...sets.map((s) => loadSet(s, { small })), ...skies.map((s) => loadSky(s, { background: backgrounds })), ...models.map(loadModel), ...impostors.map(loadImpostor)]).then((loaded) => {
    if (renderer) warm(renderer, loaded.filter(Boolean), { idle: true });
    return loaded;
  });
