// A level pack's meshes, loaded for the scene (lane L): each GLB fetched
// through the asset base, parsed without its textures (levelPack.js's
// splitTextures) and its maps bound from one cache, so a KTX2 the pack
// shares is fetched, transcoded and uploaded once whatever names it, at the
// tier's size (tex/<slug>.<size>.ktx2). A colour or emissive map is sRGB
// whatever its file says: the game stores its colour maps as sRGB (BC7_SRGB,
// textures.jsonl's `format`), but many of the pack's KTX2s are labelled
// linear, and read as linear they came out washed pale (bindSlot).
//
//   createLevelLoader({ world, tier, renderer, fetchBytes, sizes, recipes, materialFor }) → { load(glbPath) → Promise<{ scene } | null>, dispose() }
//   (sizes: level.json's `tex`, each map's size per tier)
//
// With `recipes` and `materialFor` (lane Q1: a node world draws the game's
// own surface shader), each GLB material is matched to its recipe by the
// shader its extras name (matchRecipes) and replaced by
// materialFor(recipe, { glb, detail, grunge, … }); the recipe's extra maps
// come from the same cache, a map the pack has not got as null. The GLB's
// material is disposed (its maps are the cache's and stay).
//   recipes: { forGlb(glbPath) → recipe[] | null, maps: { name → 'tex/x.ktx2' | null }, tex: sizes }
//   mapKeys: the recipe maps the tier draws (gameMaterial.js's TIER_MAPS), the rest never fetched
//   variations: levelVariations.js's index (lane colour: the pack's
//     variations.json): a varied mesh's recipes go through applyVariation
//     first, its own maps (color, normal) found in the index's `maps`

import { SRGBColorSpace } from 'three';
import { gltfLoader, ktx2Loader } from '../../../../lib/three/gltf.js';
import { assetUrl, withFallback } from '../../../../lib/assetBase.js';
import { packUrl, splitTextures, tierTexture } from './levelPack.js';
import { applyVariation } from './levelVariations.js';

// '../tex/a.ktx2' named by meshes/x.glb → 'tex/a.ktx2' in the pack
const inPack = (glbPath, uri) => {
  const parts = glbPath.split('/').slice(0, -1);
  for (const seg of uri.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
};

// GLB materials to recipes: each takes the first unused recipe of its shader
// (the dump lists LOD variants the GLB lacks, so the orders differ); then a
// material that names no shader takes the recipe at its own index if no
// other has it; else none. No recipe goes to two materials.
export function matchRecipes(shaders, recipes) {
  const used = new Set();
  const out = shaders.map((shader) => {
    if (!shader) return undefined;
    const k = recipes.findIndex((r, j) => !used.has(j) && r?.shader === shader);
    if (k < 0) return null;
    used.add(k);
    return recipes[k];
  });
  return out.map((r, i) => {
    if (r !== undefined) return r;
    if (used.has(i) || !recipes[i]) return null;
    used.add(i);
    return recipes[i];
  });
}

// A pack's recipes.json for the loader: each of a mesh's LOD files to its
// recipes, the maps they name and those maps' sizes (null without one)
export function recipesIndex(pack, json) {
  if (!json?.meshes) return null;
  const byGlb = new Map();
  pack.meshes.forEach((m, i) => {
    for (const glb of m.glb ?? []) if (glb && json.meshes[i]) byGlb.set(glb, json.meshes[i]);
  });
  return { forGlb: (path) => byGlb.get(path) ?? null, maps: json.maps ?? {}, tex: json.tex ?? {} };
}

// a recipe's map keys as the material takes them
const MAP_KEYS = [
  ['color', (m) => m.color],
  ['normal', (m) => m.normal],
  ['detail', (m) => m.detail ?? m.detailArray],
  ['grunge', (m) => m.grunge],
  ['breakupColor', (m) => m.breakup?.color],
  ['breakupNormal', (m) => m.breakup?.normal],
  ['scorch', (m) => m.scorch],
  ['height', (m) => m.height],
  ['wear', (m) => m.wear],
  ['weathering', (m) => m.weathering],
  ['emissive', (m) => m.emissive],
  ['mask', (m) => m.mask],
  ['hairStrand', (m) => m.hairStrand],
  ['sss', (m) => m.sss],
  ['aoSlice', (m) => m.aoSlice],
];

// the slots whose texture is a colour, in sRGB (the rest are data: normals, roughness and metal)
export const COLOUR_SLOTS = new Set(['map', 'emissiveMap']);

// a pack texture bound to a material's slot, the colour ones read as sRGB
export function bindSlot(mat, slot, tex) {
  if (COLOUR_SLOTS.has(slot) && tex.colorSpace !== SRGBColorSpace) {
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
  }
  if (slot === 'metalRough') {
    mat.roughnessMap = tex;
    mat.metalnessMap = tex;
  } else mat[slot] = tex;
  mat.needsUpdate = true;
}

// A recipe's maps as the material takes them, each through `texture(path)`
// from the pack's `maps` (game name → 'tex/x.ktx2', or a detail array's
// slices as a list); a map the pack has not got is null. keys: the map keys
// the tier draws (null, all).
//   recipeMaps(recipe, { maps, texture, keys }) → Promise<{ detail | detailSlices, grunge, … }>
export async function recipeMaps(recipe, { maps = {}, texture, keys = null }) {
  const out = {};
  await Promise.all(
    MAP_KEYS.filter(([k]) => !keys || keys.includes(k)).map(async ([key, get]) => {
      const name = get(recipe.maps ?? {});
      if (typeof name !== 'string') return;
      const path = maps[name];
      if (Array.isArray(path)) out.detailSlices = await Promise.all(path.map((p) => texture(p)));
      else out[key] = path ? await texture(path) : null;
    }),
  );
  return out;
}

export function createLevelLoader({ world, tier, renderer, fetchBytes, sizes = {}, recipes = null, materialFor = null, mapKeys = null, variations = null }) {
  // (mapKeys: the recipe maps the tier draws; null, all of them)
  if (recipes?.tex) sizes = { ...sizes, ...recipes.tex };
  if (variations?.tex) sizes = { ...sizes, ...variations.tex };
  const mapsOf = { ...(recipes?.maps ?? {}), ...(variations?.maps ?? {}) };
  const textures = new Map(); // pack path → Promise<Texture | null>
  const meshes = new Map(); // glb path → Promise<{ scene } | null>
  let gone = false;

  function texture(path) {
    // (after dispose nothing new is fetched, so nothing is left undisposed)
    if (gone) return Promise.resolve(null);
    if (!textures.has(path)) {
      const local = packUrl(world, tierTexture(path, tier, sizes));
      textures.set(
        path,
        ktx2Loader({ renderer })
          .then((k) => withFallback((u) => k.loadAsync(u))(local))
          .catch(() => null),
      );
    }
    return textures.get(path);
  }

  async function bind(gltf, slots, glbPath) {
    await Promise.all(
      slots.map(async ({ material, slot, uri }) => {
        const [mat, tex] = await Promise.all([gltf.parser.getDependency('material', material), texture(inPack(glbPath, uri))]);
        if (!tex || gone) return;
        bindSlot(mat, slot, tex);
      }),
    );
  }

  async function gameMaterials(gltf, glbPath) {
    const v = variations?.forGlb(glbPath) ?? null;
    const list = v ? recipes.forGlb(glbPath)?.map((r, i) => applyVariation(r, v, i)) : recipes.forGlb(glbPath);
    if (!list?.length) return;
    const glbMats = await gltf.parser.getDependencies('material');
    const chosen = matchRecipes(
      glbMats.map((m) => m.userData?.shader ?? null),
      list,
    );
    // (the scene's materials: the loader's own, or its copies of them, which
    // it makes for a mesh without normals; each said by its GLB index)
    const used = new Map();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const i = gltf.parser.associations.get(o.material)?.materials ?? glbMats.indexOf(o.material);
      if (chosen[i] && chosen[i].family !== 'glb') used.set(o.material, chosen[i]);
    });
    const swap = new Map();
    await Promise.all(
      [...used].map(async ([glb, recipe]) => {
        const maps = { glb, ...(await recipeMaps(recipe, { maps: mapsOf, texture, keys: mapKeys })) };
        if (gone) return;
        // (a variation's colour map is sRGB, as the GLB's is: bindSlot)
        if (maps.color && maps.color.colorSpace !== SRGBColorSpace) {
          maps.color.colorSpace = SRGBColorSpace;
          maps.color.needsUpdate = true;
        }
        // (a recipe the material cannot be made of keeps the GLB's material)
        try {
          swap.set(glb, materialFor(recipe, maps));
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('game material failed', glbPath, recipe.shader, e);
        }
      }),
    );
    if (!swap.size) return;
    gltf.scene.traverse((o) => {
      if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material);
    });
    for (const glb of swap.keys()) glb.dispose();
  }

  function load(glbPath) {
    if (gone) return Promise.resolve(null);
    if (!meshes.has(glbPath)) {
      meshes.set(
        glbPath,
        fetchBytes(glbPath)
          .then(async (bytes) => {
            const { buffer, slots } = splitTextures(bytes);
            const gltf = await gltfLoader().parseAsync(buffer, '');
            await bind(gltf, slots, glbPath);
            if (recipes && materialFor) await gameMaterials(gltf, glbPath);
            return gltf;
          })
          .catch((e) => {
            if (import.meta.env?.DEV) console.warn('level mesh failed', glbPath, e);
            return null;
          }),
      );
    }
    return meshes.get(glbPath);
  }

  return {
    load,
    // (the remote name of a pack file, for the evidence)
    url: (path) => assetUrl(packUrl(world, path)),
    async dispose() {
      gone = true;
      for (const t of await Promise.all(textures.values())) t?.dispose();
      for (const g of await Promise.all(meshes.values())) {
        g?.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const m of [o.material].flat()) m.dispose();
        });
      }
      textures.clear();
      meshes.clear();
    },
  };
}
