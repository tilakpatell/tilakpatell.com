// A level pack's variations (lane colour: docs/superpowers/specs/
// 2026-10-10-bf2017-accuracy-design.md, §3 "Lane colour"): the game's own
// colour-to-texture map, from the level's mesh variation databases and the
// object variations they name (scripts/bf2017-variations.mjs writes
// variations.json beside the pack). Each mesh the game varies on this
// level (Hoth's lit lamps, a red container, a snowed crate) is drawn in its
// variation: its recipes (Q1) take the variation's own colour and normal
// maps where they differ from the default the GLB wears, its vectors and
// conditionals (read by the game material through the recipe's parameter
// names: src/lib/three/surface/variation.js), and snow for a snow variation.
//
//   variationsIndex(pack, json) → { forGlb(glbPath) → variation | null, maps: { ktx2 → 'tex/x.ktx2' | null }, tex: sizes } | null
//   variationFor(json, meshName, { groupIndex }) → { name, materials, defaults } | null
//     (an instance group's own variation first, else the mesh's `use`: by
//     its instances or the level's rule; a mesh whose instances disagree has none)
//   applyVariation(recipe, variation, materialIndex) → recipe (a copy with
//     `variation` and maps.color / maps.normal, or the recipe itself)

import { COLOR_SLOTS, familyOf } from '../../../../lib/three/surface/families.js';

const NORMAL_SLOT = /^_?(NAM|NA|NM|NW|NMR|N|Normals?)(_texcoord\d)?$/i;
const COLOUR = new Set(COLOR_SLOTS);
const SNOW = /SnowMask/i;

const meshOf = (name) =>
  String(name ?? '')
    .replace(/^models\//, '')
    .replace(/\.glb$/, '')
    .toLowerCase();

export function variationFor(json, meshName, { groupIndex = null } = {}) {
  const row = json?.meshes?.[meshOf(meshName)];
  if (!row) return null;
  let name = row.use ?? null;
  if (groupIndex != null) {
    const hit = (json.instances ?? []).find(([g]) => g === groupIndex);
    if (typeof hit?.[1] === 'string') name = hit[1];
  }
  const v = name && name !== 'default' ? row.variations?.[name] : null;
  return v ? { name, materials: v.materials ?? [], defaults: row.default ?? [] } : null;
}

export function applyVariation(recipe, variation, i) {
  const m = variation?.materials?.[i];
  if (!recipe || !m) return recipe;
  // (the default's textures, whatever slot names them: a variation's shader
  // may call the same map _BaseColor where the default's calls it _CS)
  const def = new Set(Object.values(variation.defaults?.[i]?.textures ?? {}).filter(Boolean));
  const maps = {};
  for (const [slot, path] of Object.entries(m.textures ?? {})) {
    // (a map the bucket lacks is skipped; one the default binds the GLB wears)
    if (!path || def.has(path)) continue;
    if (COLOUR.has(slot)) maps.color ??= path;
    else if (NORMAL_SLOT.test(slot)) maps.normal ??= path;
  }
  const snow = SNOW.test(m.shader ?? '') || /_Snow$/i.test(variation.name);
  const vectors = m.vectors && Object.keys(m.vectors).length ? m.vectors : null;
  const conditionals = m.conditionals && Object.keys(m.conditionals).length ? m.conditionals : null;
  if (!Object.keys(maps).length && !vectors && !conditionals && !snow) return recipe;
  let family = recipe.family;
  if (family === 'glb') {
    // (a material the dump left to the GLB: the variation database binds its
    // slots, so it has a family the game material draws)
    const slots = Object.keys(m.textures ?? {}).filter((k) => m.textures[k]);
    family = familyOf(m.shader ?? recipe.shader, slots);
    if (family === 'glb') family = 'instance';
  }
  return {
    ...recipe,
    family,
    maps: { ...recipe.maps, ...maps },
    variation: { name: variation.name, ...(vectors && { vectors }), ...(conditionals && { conditionals }), ...(snow && { snow }) },
  };
}

export function variationsIndex(pack, json) {
  if (!json?.meshes) return null;
  const byGlb = new Map();
  for (const m of pack.meshes ?? []) {
    const v = variationFor(json, m.name);
    if (v) for (const glb of m.glb ?? []) if (glb) byGlb.set(glb, v);
  }
  return { forGlb: (path) => byGlb.get(path) ?? null, maps: json.maps ?? {}, tex: json.tex ?? {} };
}
