// A level pack's meshes, loaded for the scene (lane L): each GLB fetched
// through the asset base, parsed without its textures (levelPack.js's
// splitTextures) and its maps bound from one cache, so a KTX2 the pack
// shares is fetched, transcoded and uploaded once whatever names it, at the
// tier's size (tex/<slug>.<size>.ktx2). A colour or emissive map is sRGB
// whatever its file says: the game stores its colour maps as sRGB (BC7_SRGB,
// textures.jsonl's `format`), but many of the pack's KTX2s are labelled
// linear, and read as linear they came out washed pale (bindSlot).
//
//   createLevelLoader({ world, tier, renderer, fetchBytes, sizes, recipes, materialFor }) → { load(glbPath) → Promise<{ scene } | null>,
//     parse(bytes, glbPath) → Promise<{ scene } | null>, texture(packPath, sizes?) → Promise<Texture | null>,
//     has(glbPath), busy(), dispose() }
//   (sizes: level.json's `tex`, each map's size per tier; fetchBytes(path,
//   { glb }) is told which GLB a file is for, so the stream can rank it
//   (lane N4); parse: a file the stream fetched itself, a coarse cell; has:
//   a GLB loaded; busy: the loads not yet bound, which the boot waits for)
//
// (lane N4) Every map comes at its smallest row first (levelPack.js's
// firstTexture) and answers at once; the tier's row (tierTexture: UASTC for
// a data map on mid and up, where the chip takes it) is then fetched as
// detail and swapped into the same texture (swapInto), so every material
// and node that holds it draws the finer one from the next frame. A
// promotion that lands for a map no one shown wears (`wanted(path, glbs)`)
// is kept, not uploaded, and bound by refresh() once one is.
//   texture(path, sizes?, { of, coarse }): of, the GLB asking (for the stream's rank)
//   refresh(): the kept promotions now wanted, bound
//   (parseKtx2(bytes) → Promise<Texture> and formats: the KTX2 loader's
//   parse and textureFormats(renderer) by default; tests give their own)
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

import { NoColorSpace, SRGBColorSpace } from 'three';
import { COLOUR_MAP_KEYS } from '../../../../lib/three/surface/families.js';
import { gltfLoader, ktx2Loader, textureFormats } from '../../../../lib/three/gltf.js';
import { assetUrl } from '../../../../lib/assetBase.js';
import { firstTexture, isDataMap, packUrl, splitTextures, tierTexture } from './levelPack.js';
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

// The game's own word on a map, carried in the pack's `tex` row (`srgb`:
// true or false, from textures.jsonl, written by the pipeline): a texture
// so marked is read as the game reads it, and nothing below overrules it. A
// row without the word leaves the slot rules to decide (a colour slot sRGB
// whatever the file says, since many of the drop's files were tagged wrong).
export function gameWordOf(tex, sizes, path) {
  const slug = String(path).split('/').pop().replace(/\.ktx2$/, '');
  const said = sizes?.[slug]?.srgb;
  if (typeof said !== 'boolean' || !tex?.isTexture) return tex;
  tex.userData.gameSrgb = said;
  const want = said ? SRGBColorSpace : NoColorSpace;
  if (tex.colorSpace !== want) {
    tex.colorSpace = want;
    tex.needsUpdate = true;
  }
  return tex;
}

// a colour map read as sRGB whatever its file says (bindSlot's rule, for a
// recipe's maps too: the crew's and a pack's emissive maps come this way),
// unless the pack carries the game's word on it
export function asColour(tex, colour) {
  if (colour && tex?.isTexture && typeof tex.userData?.gameSrgb !== 'boolean' && tex.colorSpace !== SRGBColorSpace) {
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
  }
  return tex;
}

// a pack texture bound to a material's slot, the colour ones read as sRGB
// unless the pack's word says the game reads that map linear
export function bindSlot(mat, slot, tex) {
  if (COLOUR_SLOTS.has(slot) && typeof tex.userData?.gameSrgb !== 'boolean' && tex.colorSpace !== SRGBColorSpace) {
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
      else out[key] = path ? asColour(await texture(path), COLOUR_MAP_KEYS.has(key)) : null;
    }),
  );
  return out;
}

// (lane N4) a finer row swapped into the texture already bound: its GPU
// copy let go (three uploads a disposed texture again when next drawn, on
// either backend), then its source and mips the new one's
export function swapInto(tex, next, row = null) {
  tex.dispose();
  tex.source = next.source;
  tex.mipmaps = next.mipmaps;
  tex.format = next.format;
  tex.type = next.type;
  tex.needsUpdate = true;
  if (row != null) tex.userData.row = row;
  return tex;
}

const rowOf = (file) => Number(String(file).match(/\.(\d+)(\.uastc)?\.ktx2$/)?.[1] ?? 0) || null;

export function createLevelLoader({
  world,
  tier,
  renderer,
  fetchBytes,
  sizes = {},
  recipes = null,
  materialFor = null,
  mapKeys = null,
  variations = null,
  wanted = () => true,
  parseKtx2 = (bytes) => ktx2Loader({ renderer }).then((k) => new Promise((ok, no) => k.parse(bytes, ok, no))),
  formats = textureFormats(renderer),
}) {
  // (mapKeys: the recipe maps the tier draws; null, all of them)
  if (recipes?.tex) sizes = { ...sizes, ...recipes.tex };
  if (variations?.tex) sizes = { ...sizes, ...variations.tex };
  const mapsOf = { ...(recipes?.maps ?? {}), ...(variations?.maps ?? {}) };
  const textures = new Map(); // pack path → Promise<Texture | null>
  const meshes = new Map(); // glb path → Promise<{ scene } | null>
  let gone = false;

  const users = new Map(); // pack path → Set of the GLBs that wear it
  const kept = new Map(); // pack path → { tex, next, row }: promotions not yet wanted

  // (a part's own maps say their sizes beside them: `own`)
  function texture(path, own = sizes, { of = null, coarse = false } = {}) {
    // (after dispose nothing new is fetched, so nothing is left undisposed)
    if (gone) return Promise.resolve(null);
    if (of) (users.get(path) ?? users.set(path, new Set()).get(path)).add(of);
    if (!textures.has(path)) {
      const slug = path.split('/').pop().replace(/\.ktx2$/, '');
      const data = isDataMap(null, own?.[slug] ?? sizes?.[slug], slug);
      const first = firstTexture(path, own);
      const target = tierTexture(path, tier, own, { formats, data });
      const get = (file, promote) => Promise.resolve(fetchBytes(file, { glb: of, promote, ...(coarse ? { coarse } : {}) })).then((bytes) => parseKtx2(bytes));
      let held = first;
      const p = get(first, false)
        .catch(() => {
          // (no first row to be had: the tier's, at once)
          held = target;
          return first === target ? null : get(target, false);
        })
        .then((t) => {
          if (!t) return null;
          t.userData.row = rowOf(held);
          return gameWordOf(t, sizes, path);
        })
        .catch(() => null);
      textures.set(path, p);
      p.then((t) => {
        if (!t || gone || held === target) return;
        get(target, true)
          .then((next) => {
            if (gone || !next) return;
            if (wanted(path, users.get(path) ?? new Set())) swapInto(t, next, rowOf(target));
            else kept.set(path, { tex: t, next, row: rowOf(target) });
          })
          .catch(() => {}); // (the first row stays)
      });
    }
    return textures.get(path);
  }

  function refresh() {
    for (const [path, k] of kept) {
      if (!wanted(path, users.get(path) ?? new Set())) continue;
      swapInto(k.tex, k.next, k.row);
      kept.delete(path);
    }
  }

  async function bind(gltf, slots, glbPath) {
    await Promise.all(
      slots.map(async ({ material, slot, uri }) => {
        const [mat, tex] = await Promise.all([gltf.parser.getDependency('material', material), texture(inPack(glbPath, uri), sizes, { of: glbPath })]);
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
        const maps = { glb, ...(await recipeMaps(recipe, { maps: mapsOf, texture: (p) => texture(p, sizes, { of: glbPath }), keys: mapKeys })) };
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

  // a GLB's bytes to a scene: parsed without its textures, its maps bound
  // from the cache, its materials the game's where the pack has recipes
  async function fromBytes(bytes, glbPath) {
    const { buffer, slots } = splitTextures(bytes);
    const gltf = await gltfLoader().parseAsync(buffer, '');
    await bind(gltf, slots, glbPath);
    if (recipes && materialFor) await gameMaterials(gltf, glbPath);
    return gltf;
  }

  const loaded = new Set(); // glb paths whose scene is up
  let pending = 0;
  function track(glbPath, p) {
    pending++;
    return p
      .then((gltf) => {
        if (gltf) loaded.add(glbPath);
        return gltf;
      })
      .catch((e) => {
        if (import.meta.env?.DEV) console.warn('level mesh failed', glbPath, e);
        return null;
      })
      .finally(() => pending--);
  }

  function load(glbPath) {
    if (gone) return Promise.resolve(null);
    if (!meshes.has(glbPath)) meshes.set(glbPath, track(glbPath, Promise.resolve(fetchBytes(glbPath, { glb: glbPath })).then((bytes) => fromBytes(bytes, glbPath))));
    return meshes.get(glbPath);
  }

  function parse(bytes, glbPath) {
    if (gone) return Promise.resolve(null);
    if (!meshes.has(glbPath)) meshes.set(glbPath, track(glbPath, fromBytes(bytes, glbPath)));
    return meshes.get(glbPath);
  }

  return {
    load,
    parse,
    texture,
    refresh,
    has: (glbPath) => loaded.has(glbPath),
    busy: () => pending,
    // (the remote name of a pack file, for the evidence)
    url: (path) => assetUrl(packUrl(world, path)),
    async dispose() {
      gone = true;
      for (const t of await Promise.all(textures.values())) t?.dispose();
      for (const k of kept.values()) k.next.dispose();
      kept.clear();
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
