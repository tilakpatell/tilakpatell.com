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
//     texture(packPath, sizes?) → Promise<Texture | null>, counts(), dispose() }
//   (sizes: level.json's `tex`, each map's size per tier)
//   counts() → { asked, loaded, failed, why }: the pack's maps so far, each
//     path once (failed: those not had now; why: the first of them's name
//     and words), for the evidence (level/index.js's stats().maps)
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
//   baked: the pack's Enlighten set (GPU-first lane N3, light/baked.js's
//     createBaked over level.json's `enlighten`, bound once a pack): a game
//     material whose meshes all carry TEXCOORD_1, in a GLB the set has a
//     chart for, takes the atlas as its diffuse indirect light (withBaked);
//     any other keeps the probe term. applyBaked(material, chart) overrides
//     how (the tests'). loader.atlas(path) loads one of the set's maps as the
//     pack has it (linear, no tier size), for createBaked's loadTexture.
//
// A material that names no colour map (lane E3: the game's leaf and branch
// cards and some hull plates take theirs from the shader preset, which the
// export never wrote, its `textures` empty in the GLB and in the material
// dump alike) would draw white: a two-sided card is not drawn (a leaf card
// without its alpha is a white slab), a solid piece is a dark moss grey (bareGlb).
// So would one whose colour map was named and did not come (a 404, or a
// Basis transcoder that would not come up, when every map fails and the
// whole level drew white with nothing said): it is bare too, and the first
// such map of a world is said once (missed). On the node renderer a recipe
// that brings no colour of its own drew white the same way (gameMaterials).

import { DoubleSide, NoColorSpace, SRGBColorSpace } from 'three';
import { BUDGETS } from '../../../../lib/device.js';
import { COLOUR_MAP_KEYS } from '../../../../lib/three/surface/families.js';
import { gltfLoader, ktx2Loader } from '../../../../lib/three/gltf.js';
import { anisotropyFor } from '../../../../lib/three/textures.js';
import { assetUrl, withFallback } from '../../../../lib/assetBase.js';
import { packUrl, splitTextures, tierTexture } from './levelPack.js';
import { applyVariation } from './levelVariations.js';
import { hasUv1, withBaked } from '../../../../lib/three/light/baked.js';
import { loadThree } from '../../../../lib/three/light/three.js';

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
  ['nea', (m) => m.nea],
  ['idMap', (m) => m.idMap],
];

// A pack map's anisotropy, the tier's (lib/device's BUDGETS: 16 on high and
// ultra, 4 on mid, 1 on low), under what the chip has: a pack's floors and
// walls are seen at a slant, and at 1 their maps smear a few metres out
// (the surfaces design's Q5, lane D2). Set once, on load, so every slot that
// shares the texture has it.
//   sharpenPack(tex, tier, renderer) → tex
export function sharpenPack(tex, tier, renderer = null) {
  if (!tex?.isTexture) return tex;
  const max = renderer?.capabilities?.getMaxAnisotropy?.() ?? renderer?.getMaxAnisotropy?.() ?? 16;
  const want = (BUDGETS[tier] ?? BUDGETS.high).aniso;
  const a = anisotropyFor(max, want);
  if (tex.anisotropy !== a) {
    tex.anisotropy = a;
    tex.needsUpdate = true;
  }
  return tex;
}

// the slots whose texture is a colour, in sRGB (the rest are data: normals, roughness and metal)
export const COLOUR_SLOTS = new Set(['map', 'emissiveMap']);

// DICE's colour suffixes (_cs, _c, _ca, _cw, numbered or not), a derived
// __orm or __normal map never one
const COLOUR_NAME = /_(cs|c|ca|cw)(_\d+)?$/i;
export const colourByName = (slug) => COLOUR_NAME.test(String(slug));

// The game's own word on a map, carried in the pack's `tex` row (`srgb`:
// true or false, from textures.jsonl, written by the pipeline): a texture
// so marked is read as the game reads it. A row without the word leaves the
// slot rules to decide (a colour slot sRGB whatever the file says, since many
// of the drop's files were tagged wrong). The one exception (the decision's
// 2026-10-11 amendment): a map whose name says colour, in a colour slot, is
// sRGB whatever the word, since a colour map the game stores UNORM (Theed's
// brick, t_naboo_bricks_05_cs) is decoded by its own shader and read linear
// here drew near black; the texture is marked so the slot rules know it.
export function gameWordOf(tex, sizes, path) {
  const slug = String(path).split('/').pop().replace(/\.ktx2$/, '');
  const said = sizes?.[slug]?.srgb;
  if (typeof said !== 'boolean' || !tex?.isTexture) return tex;
  tex.userData.gameSrgb = said;
  if (colourByName(slug)) tex.userData.colourName = true;
  const want = said ? SRGBColorSpace : NoColorSpace;
  if (tex.colorSpace !== want) {
    tex.colorSpace = want;
    tex.needsUpdate = true;
  }
  return tex;
}

// a texture a colour slot reads as sRGB: one without the game's word, or one
// whose name says colour (gameWordOf)
const slotColour = (tex) => typeof tex.userData?.gameSrgb !== 'boolean' || tex.userData.colourName === true;

// a colour map read as sRGB whatever its file says (bindSlot's rule, for a
// recipe's maps too: the crew's and a pack's emissive maps come this way),
// unless the pack's word says linear on a map no colour suffix names
export function asColour(tex, colour) {
  if (colour && tex?.isTexture && slotColour(tex) && tex.colorSpace !== SRGBColorSpace) {
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
  }
  return tex;
}

// a pack texture bound to a material's slot, the colour ones read as sRGB
// unless the pack's word says the game reads that map linear and its name
// does not say colour
export function bindSlot(mat, slot, tex) {
  if (COLOUR_SLOTS.has(slot) && slotColour(tex) && tex.colorSpace !== SRGBColorSpace) {
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

// The atlas on a GLB's game materials: each material all of whose meshes
// carry a second uv set, where the set has the GLB's chart
async function bakeMeshes(scene, glbPath, materials, baked, applyBaked) {
  const chart = baked?.chartOf?.(glbPath) ?? null;
  if (!chart) return;
  const ok = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || !materials.has(o.material)) return;
    ok.set(o.material, (ok.get(o.material) ?? true) && hasUv1(o.geometry));
  });
  for (const [m, all] of ok) if (all && m.isNodeMaterial) await applyBaked(m, chart);
}

// (a solid piece with no colour map of its own: a dark moss grey, not white,
// as a crown's branch cards and a hull plate both read under a canopy)
export const BARE = 0x575b4f;

// The GLB's own materials that named no colour map (`named`: the material
// indices that did; `indexOf`: a scene material's GLB index, the loader's
// copies included) and got none from a recipe: a two-sided card's meshes
// taken out of the scene, a solid piece's material made grey. Returns how many
// meshes were taken out.
export function bareGlb(scene, indexOf, named) {
  const out = [];
  scene.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || Array.isArray(m) || m.map || m.vertexColors) return;
    const i = indexOf(m);
    if (i == null || i < 0 || named.has(i)) return;
    if (m.side === DoubleSide) out.push(o);
    else m.color.setHex(BARE);
  });
  for (const o of out) {
    o.parent.remove(o);
    o.geometry.dispose();
  }
  return out.length;
}

// a failure as the evidence says it: its name, its reason where it has one
// (a WasmError's), and its words (a fetch's status)
const whyOf = (e) => (e instanceof Error ? `${e.name}${e.reason ? ` (${e.reason})` : ''}: ${e.message}` : String(e));

// (texTier: the video setting's texture quality, lib/video.js's textureTier, over the tier for the maps' sizes alone)
export function createLevelLoader({ world, tier, renderer, fetchBytes, sizes = {}, recipes = null, materialFor = null, mapKeys = null, variations = null, baked = null, applyBaked = null, texTier = null }) {
  applyBaked ??= async (m, chart) => withBaked(m, baked, { chart, three: await loadThree() });
  // (mapKeys: the recipe maps the tier draws; null, all of them)
  if (recipes?.tex) sizes = { ...sizes, ...recipes.tex };
  if (variations?.tex) sizes = { ...sizes, ...variations.tex };
  const mapsOf = { ...(recipes?.maps ?? {}), ...(variations?.maps ?? {}) };
  const textures = new Map(); // pack path → Promise<Texture | null>
  const meshes = new Map(); // glb path → Promise<{ scene } | null>
  let gone = false;
  // what the pack's maps came to (counts()), and what has been said of them
  const asked = new Set(); // every path asked
  const failing = new Set(); // the paths not had now
  let loaded = 0;
  let why = null;
  let told = null; // null, 'map' or 'transcoder'

  // A map that did not come: counted, its slot left empty (a colour map's
  // material goes bare, bind). The first of a world is said, in production
  // too, since a level drawn white with nothing in the console is what the
  // owner's desktop showed; as a warning, not an error (the site's browser
  // checks fail on those). The rest are counted quietly, but a KTX2 loader
  // that will not come up (every map then fails) is said once by its
  // error's name (a WasmError, the transcoder's), even after a map was.
  function missed(path, e, transcoder = false) {
    failing.add(path);
    why ??= whyOf(e);
    if (gone || told === 'transcoder' || (told && !transcoder)) return null;
    told = transcoder ? 'transcoder' : 'map';
    console.warn(
      transcoder
        ? `level ${world}: the KTX2 loader did not come up (its Basis transcoder, or the chip's formats), so no map of the level can be drawn (the first asked, ${path}): ${whyOf(e)}`
        : `level ${world}: a map did not load, ${path}: ${whyOf(e)}; drawn without it, and later misses counted, not said`,
    );
    return null;
  }

  // (a part's own maps say their sizes beside them: `own`)
  function texture(path, own = sizes) {
    // (after dispose nothing new is fetched, so nothing is left undisposed)
    if (gone) return Promise.resolve(null);
    if (!textures.has(path)) {
      asked.add(path);
      const local = packUrl(world, tierTexture(path, texTier ?? tier, own));
      const got = ktx2Loader({ renderer }).then(
        (k) =>
          withFallback((u) => k.loadAsync(u))(local)
            .then((t) => gameWordOf(t, sizes, path))
            .then((t) => sharpenPack(t, tier, renderer))
            .then((t) => {
              loaded++;
              failing.delete(path);
              if (!failing.size) why = null;
              return t;
            })
            .catch((e) => missed(path, e)),
        (e) => {
          // (the KTX2 loader's failure, not the map's: gltf.js lets that
          // loader go, so the next ask of this path tries it again)
          if (textures.get(path) === got) textures.delete(path);
          return missed(path, e, true);
        },
      );
      textures.set(path, got);
    }
    return textures.get(path);
  }

  // A GLB's maps bound from the cache, to each material and the loader's
  // copies of it in the scene: three's GLTFLoader copies a material as it
  // parses for a mesh without tangents or normals, or with vertex colours,
  // before any map is bound here, so a map bound to the parser's material
  // alone left the copy, the one drawn, white. Returns the GLB indices of
  // the materials whose colour map was named and did not come (bare, as
  // one that named none: load).
  async function bind(gltf, slots, glbPath) {
    const lost = new Set();
    const copies = new Map(); // GLB index → the scene's materials of it
    gltf.scene.traverse((o) => {
      const i = o.isMesh ? gltf.parser.associations.get(o.material)?.materials : undefined;
      if (i == null) return;
      if (!copies.has(i)) copies.set(i, new Set());
      copies.get(i).add(o.material);
    });
    await Promise.all(
      slots.map(async ({ material, slot, uri }) => {
        const [mat, tex] = await Promise.all([gltf.parser.getDependency('material', material), texture(inPack(glbPath, uri))]);
        if (gone) return;
        if (!tex) {
          if (slot === 'map') lost.add(material);
          return;
        }
        for (const m of new Set([mat, ...(copies.get(material) ?? [])])) bindSlot(m, slot, tex);
      }),
    );
    return lost;
  }

  // A material with no colour map (it named none, or its own was lost:
  // bind) whose recipe brings none drew white: the game material's base is
  // the GLB's colour, white, under no map (gameMaterial.js's compose and
  // hair.js's alike). So it goes bare as bareGlb would have it: a two-sided
  // card keeps the GLB's material, for bareGlb to take out; a solid piece's
  // GLB colour is made BARE before the game material copies it, which keeps
  // the recipe's other maps (normals, detail, grunge, lights) drawing.
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
        if (!glb.map && !glb.vertexColors && !maps.color) {
          if (glb.side === DoubleSide) return;
          glb.color.setHex(BARE);
        }
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
    if (baked) await bakeMeshes(gltf.scene, glbPath, new Set(swap.values()), baked, applyBaked);
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
            const lost = await bind(gltf, slots, glbPath);
            if (recipes && materialFor) await gameMaterials(gltf, glbPath);
            // (a colour map named and lost counts as none named)
            bareGlb(gltf.scene, (m) => gltf.parser.associations.get(m)?.materials, new Set(slots.filter((x) => x.slot === 'map' && !lost.has(x.material)).map((x) => x.material)));
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

  // one of the pack's Enlighten maps, as written (enlighten/<set>.<map>.ktx2)
  function atlas(path) {
    if (gone) return Promise.resolve(null);
    const key = `atlas:${path}`;
    if (!textures.has(key)) {
      textures.set(
        key,
        ktx2Loader({ renderer })
          .then((k) => withFallback((u) => k.loadAsync(u))(packUrl(world, path)))
          .then((t) => {
            t.colorSpace = NoColorSpace;
            t.needsUpdate = true;
            return t;
          })
          .catch(() => null),
      );
    }
    return textures.get(key);
  }

  return {
    load,
    texture,
    atlas,
    // (the remote name of a pack file, for the evidence)
    url: (path) => assetUrl(packUrl(world, path)),
    counts: () => ({ asked: asked.size, loaded, failed: failing.size, why }),
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
