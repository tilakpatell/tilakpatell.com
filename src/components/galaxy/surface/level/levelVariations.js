// A level pack's variations (the colour lane: scripts/bf2017-variations.mjs
// writes variations.json beside level.json): each mesh drawn in the game's
// own variation of it, its maps and its shader's parameters, through lane
// Q1's game material. A pack without the file draws as before.
//
//   variationFor(json, mesh) → { name, materials } | null
//     (the instance's own variation first, when the map carries them; else
//     the level's rule; else none)
//   variationsIndex(pack, json) → null | { forGlb(glbPath) → { name, materials } | null, chosen, tex }
//     (tex: the sizes of the maps the writer added for the swaps, as level.json's rows)
//   applyVariation(recipe, material, name) → the recipe the material draws with
//   swapped(path, material) → the pack path the GLB's map is read from
//
// A variation's material carries the recipe the writer made with recipeOf
// from the dump's row and the variation on top (its shader, its vectors in
// linear light, its switches), so the game material reads its tints where it
// reads every recipe's; `swaps` move the GLB's own maps to the variation's.

const meshKey = (name) => String(name).toLowerCase().replace(/^models\//, '').replace(/\.glb$/, '');

export function variationFor(json, mesh) {
  const at = json?.meshes?.[mesh];
  if (!at) return null;
  // (per-instance hashes are the desktop's to add: `instances` is null until then)
  const name = json.instances?.[mesh] ?? json.rule?.[mesh] ?? null;
  const v = name ? at.variations?.[name] : null;
  return v ? { name, materials: v.materials ?? [] } : null;
}

export function variationsIndex(pack, json) {
  if (!json?.meshes) return null;
  const byGlb = new Map();
  let chosen = 0;
  for (const m of pack?.meshes ?? []) {
    const v = variationFor(json, meshKey(m.name));
    if (!v) continue;
    chosen++;
    for (const glb of m.glb ?? []) if (glb) byGlb.set(glb, v);
  }
  return { forGlb: (path) => byGlb.get(path) ?? null, chosen, tex: json.tex ?? {} };
}

export function applyVariation(recipe, material, name) {
  if (!material?.recipe) return recipe;
  return { ...material.recipe, variation: { name, vectors: material.vectors ?? {}, bools: material.bools ?? {} } };
}

export const swapped = (path, material) => material?.swaps?.[path] ?? path;
