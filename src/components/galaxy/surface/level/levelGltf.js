// A level pack's meshes, loaded for the scene (lane L): each GLB fetched
// through the asset base, parsed without its textures (levelPack.js's
// splitTextures) and its maps bound from one cache, so a KTX2 the pack
// shares is fetched, transcoded and uploaded once whatever names it, at the
// tier's size (tex/<slug>.<size>.ktx2).
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

import { gltfLoader, ktx2Loader } from '../../../../lib/three/gltf.js';
import { assetUrl, withFallback } from '../../../../lib/assetBase.js';
import { packUrl, splitTextures, tierTexture } from './levelPack.js';

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
// (the dump lists LOD variants the GLB lacks, so the orders differ), else
// the recipe at its own index when the GLB names no shader; else none
export function matchRecipes(shaders, recipes) {
  const used = new Set();
  return shaders.map((shader, i) => {
    if (!shader) return recipes[i] ?? null;
    const k = recipes.findIndex((r, j) => !used.has(j) && r?.shader === shader);
    if (k < 0) return null;
    used.add(k);
    return recipes[k];
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
];

export function createLevelLoader({ world, tier, renderer, fetchBytes, sizes = {}, recipes = null, materialFor = null, mapKeys = null }) {
  // (mapKeys: the recipe maps the tier draws; null, all of them)
  const keys = mapKeys ? MAP_KEYS.filter(([k]) => mapKeys.includes(k)) : MAP_KEYS;
  if (recipes?.tex) sizes = { ...sizes, ...recipes.tex };
  const textures = new Map(); // pack path → Promise<Texture | null>
  const meshes = new Map(); // glb path → Promise<{ scene } | null>
  let gone = false;

  function texture(path) {
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
        if (slot === 'metalRough') {
          mat.roughnessMap = tex;
          mat.metalnessMap = tex;
        } else mat[slot] = tex;
        mat.needsUpdate = true;
      }),
    );
  }

  async function gameMaterials(gltf, glbPath) {
    const list = recipes.forGlb(glbPath);
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
        const maps = { glb };
        await Promise.all(
          keys.map(async ([key, get]) => {
            const name = get(recipe.maps ?? {});
            if (typeof name !== 'string') return;
            const path = recipes.maps?.[name];
            maps[key] = path ? await texture(path) : null;
          }),
        );
        if (!gone) swap.set(glb, materialFor(recipe, maps));
      }),
    );
    if (!swap.size) return;
    gltf.scene.traverse((o) => {
      if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material);
    });
    for (const glb of swap.keys()) glb.dispose();
  }

  function load(glbPath) {
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
