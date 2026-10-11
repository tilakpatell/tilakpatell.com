// A level pack's variations: the game's own colour-to-texture map for its
// meshes (the colour lane: docs/superpowers/plans/2026-10-10-bf2017-accuracy-
// lane-colour.md, task 2). Three records make it: the level's mesh variation
// databases (MeshVariationDatabase: per mesh and variation, each material's
// textures by parameter name and the MeshMaterialVariation it takes), the
// ObjectVariation records those name (each material variation's shader
// preset, vectors, switches and conditionals), and the export's material dump
// (web/materials.jsonl: what the GLB already draws). Pure.
//
//   entriesOf(mvdbs) → [{ mesh, variation, hash, db, path, materials: [{ textures, guid, shaderId }] }]
//   indexVariations(records) → Map(material variation guid → { name, shader, vectors, bools, conditionals })
//   swapsFor(oldTexture, newTexture, slugs) → { swaps: { 'tex/a.ktx2': 'tex/b.ktx2' }, missing: [name], wanted: [{ slug, like, file }] }
//   variationsOf({ mvdbs, records, materials, slugs, meshes }) → variations.json, and `fetch`:
//     the maps a chosen variation swaps to that the pack has not got, each
//     with the slug it replaces (`like`: its sizes) and its file in the
//     bucket (the writer's --fetch adds them; `fetch` is not written)
//   levelRule(meshes) → { mesh: variation name }
//
// variations.json: { format: 1, meshes: { <mesh asset, lower case>: { dbs: { <db>: [variation names] },
//   variations: { <name>: { _source: { mvdb, variation }, materials: [{ swaps, recipe, maps, vectors, bools, missing }] } } } },
//   rule, instances: null, counts, tex? }. `tex` (the writer's) sizes the
//   maps it added to the pack for the swaps, as level.json's rows do. A material's `swaps` move the GLB's
//   own maps to the variation's (the loader's bind); its `recipe` is lane
//   Q1's, made by recipeOf from the dump's row with the variation's shader,
//   textures and parameters on top (null where the variation changes
//   nothing the recipe reads); `maps` resolves that recipe's map names in
//   the pack; `missing` names each texture the variation binds that the pack
//   has not got (the override skipped, the rest still applied).
//
// The level's own rule (no per-instance hashes yet: the desktop's §4): a
// mesh with exactly one variation in the level's databases takes it, unless
// one of them names the mesh's default alone (plain ones stand there too).
// A database always lists the default beside a variation, so a default
// beside one says nothing.

import { recipeOf } from './bf2017-recipes.mjs';

// a shader preset that lays snow by a mask (SS_…_TextureArray_SnowMask_01):
// the weather's snow is let on for it (weather.js's gateOf); which channel of
// its _RGB mask is the snow's the records do not say, so the whole face
export const SNOW_MASK_RE = /_SnowMask_/i;

const lc = (s) => String(s ?? '').toLowerCase();
const base = (asset) => lc(asset).split('/').pop();
const dbOf = (path) => {
  const parts = String(path).split('/');
  return parts.length > 1 ? parts.at(-2) : parts[0];
};

export function entriesOf(mvdbs) {
  const out = [];
  for (const { path, record } of mvdbs) {
    const db = dbOf(path);
    for (const o of record?.objects ?? []) {
      if (o.$type !== 'MeshVariationDatabase') continue;
      for (const e of o.Entries ?? []) {
        const hash = e.VariationAssetNameHash ?? 0;
        const named = (e.Materials ?? []).find((m) => m.MaterialVariation?.$asset)?.MaterialVariation.$asset;
        out.push({
          mesh: lc(e.Mesh?.$asset),
          variation: hash === 0 ? 'default' : (named ?? `hash:${hash}`),
          hash,
          db,
          path,
          materials: (e.Materials ?? []).map((m) => ({
            textures: Object.fromEntries((m.TextureParameters ?? []).filter((t) => t.Value?.$asset).map((t) => [t.ParameterName, t.Value.$asset])),
            guid: m.MaterialVariation?.$class ?? null,
            shaderId: m.SurfaceShaderId ?? null,
          })),
        });
      }
    }
  }
  return out;
}

const vec4 = (v) => (v && typeof v === 'object' ? [v.x ?? 0, v.y ?? 0, v.z ?? 0, v.w ?? 0] : v);

export function indexVariations(records) {
  const idx = new Map();
  for (const r of records) {
    const name = r?.objects?.find((o) => o.$type === 'ObjectVariation')?.Name ?? r?.name;
    for (const o of r?.objects ?? []) {
      if (o.$type !== 'MeshMaterialVariation') continue;
      const s = o.Shader ?? {};
      idx.set(o.$guid, {
        name,
        shader: s.Shader?.$asset ?? null,
        vectors: Object.fromEntries((s.VectorParameters ?? []).map((p) => [p.ParameterName, vec4(p.Value)])),
        bools: Object.fromEntries((s.BoolParameters ?? []).map((p) => [p.ParameterName, !!p.Value])),
        conditionals: Object.fromEntries((s.ConditionalParameters ?? []).filter((p) => p.ConditionalAsset?.$asset).map((p) => [p.ConditionalAsset.$asset, String(p.Value)])),
      });
    }
  }
  return idx;
}

// the pack's slugs a map made: its own, and the ones derived from it (`__normal`, `__orm_<hash>`)
const slugsOf = (b, slugs) => [...slugs].filter((s) => s === b || s.startsWith(`${b}__`));
const inPack = (asset, slugs) => slugsOf(base(asset), slugs).length > 0;

export function swapsFor(from, to, slugs) {
  const B = base(from);
  const N = base(to);
  const out = { swaps: {}, missing: [], wanted: [] };
  if (!from || B === N) return out;
  for (const s of slugsOf(B, slugs)) {
    const suffix = s.slice(B.length);
    // (a packed ORM is named by a hash of its sources: any of the new map's;
    // one the pack lacks cannot be named, so it is never fetched)
    const orm = suffix.startsWith('__orm_');
    const target = orm ? [...slugs].find((x) => x.startsWith(`${N}__orm_`)) : slugs.has(N + suffix) ? N + suffix : null;
    if (target) out.swaps[`tex/${s}.ktx2`] = `tex/${target}.ktx2`;
    else {
      if (!out.missing.includes(to)) out.missing.push(to);
      if (!orm) out.wanted.push({ slug: N + suffix, like: s, file: `web/textures/${lc(to)}${suffix}.ktx2` });
    }
  }
  return out;
}

// a recipe map's name in the pack: its own slug, else its derived normal, else any derived
function packPath(name, slugs) {
  const b = base(name);
  const hit = slugs.has(b) ? b : slugs.has(`${b}__normal`) ? `${b}__normal` : slugsOf(b, slugs)[0];
  return hit ? `tex/${hit}.ktx2` : null;
}

// the variation's recipe: the dump's material with the variation's shader,
// textures and parameters on top, through recipeOf; each leaf it took from
// the variation or the database says so in its _source
function variationRecipe({ mesh, i, row, mat, v, path }) {
  const own = row?.materials?.[i];
  const changes = v && (v.shader || Object.keys(v.vectors).length || Object.keys(v.bools).length || Object.keys(v.conditionals).length);
  const textures = { ...(own?.textures ?? {}), ...mat.textures };
  const retextured = Object.entries(mat.textures).some(([k, t]) => lc(own?.textures?.[k]) !== lc(t));
  if (!changes && !retextured) return null;
  const shader = v?.shader ?? own?.shader ?? null;
  const m = {
    name: own?.name ?? 'MeshMaterial',
    shader,
    textures,
    vectors: { ...(own?.vectors ?? {}), ...(v?.vectors ?? {}) },
    bools: { ...(own?.bools ?? {}), ...(v?.bools ?? {}) },
    conditionals: { ...(own?.conditionals ?? {}), ...(v?.conditionals ?? {}) },
  };
  const materials = [...(row?.materials ?? [])];
  materials[i] = m;
  const recipe = recipeOf({ mesh, materials }, i);
  const fromVariation = new Set([...Object.keys(v?.vectors ?? {}), ...Object.keys(v?.bools ?? {}), ...Object.keys(v?.conditionals ?? {}).map((k) => k.split('/').pop()), ...(v?.shader ? ['shader'] : [])]);
  const fromDb = new Set(Object.keys(mat.textures));
  for (const [k, src] of Object.entries(recipe._source)) {
    const leaf = String(src).split('.').pop();
    if (fromVariation.has(leaf) && !fromDb.has(leaf)) recipe._source[k] = `variation:${v.name}#${i}.${leaf}`;
    else if (fromDb.has(leaf) && String(src).startsWith('materials.jsonl:')) recipe._source[k] = `mvdb:${path}#${i}.${leaf}`;
  }
  if (shader && SNOW_MASK_RE.test(shader)) {
    recipe.params.weather = { ...(recipe.params.weather ?? {}), snow: true };
    recipe._source['params.weather.snow'] = v?.shader ? `variation:${v.name}#${i}.shader` : `materials.jsonl:${mesh}#${i}.shader`;
    if (recipe.family === 'glb') recipe.family = 'props';
  }
  return recipe;
}

export function levelRule(meshes) {
  const rule = {};
  for (const [mesh, m] of Object.entries(meshes)) {
    const names = Object.keys(m.variations ?? {});
    if (names.length !== 1) continue;
    const plain = Object.values(m.dbs ?? {}).some((list) => list.length === 1 && list[0] === 'default');
    if (!plain) rule[mesh] = names[0];
  }
  return rule;
}

export function variationsOf({ mvdbs, records = [], materials = new Map(), slugs = [], meshes = null }) {
  const slugSet = new Set(slugs);
  const idx = indexVariations(records);
  const wanted = meshes ? new Set(meshes.map(lc)) : null;
  const out = {};
  const seen = new Set();
  const missingAll = new Set();
  const wantedBy = new Map(); // mesh → [{ variation, slug, like, file }]
  for (const e of entriesOf(mvdbs)) {
    if (wanted && !wanted.has(e.mesh)) continue;
    seen.add(e.mesh);
    const row = materials.get(e.mesh) ?? null;
    const at = (out[e.mesh] ??= { dbs: {}, variations: {} });
    const list = (at.dbs[e.db] ??= []);
    if (!list.includes(e.variation)) list.push(e.variation);
    if (e.variation === 'default' || at.variations[e.variation]) continue;
    at.variations[e.variation] = {
      _source: { mvdb: e.path, variation: e.variation },
      materials: e.materials.map((mat, i) => {
        const v = mat.guid ? (idx.get(mat.guid) ?? null) : null;
        const own = row?.materials?.[i]?.textures ?? {};
        const swaps = {};
        const missing = new Set();
        for (const [param, tex] of Object.entries(mat.textures)) {
          const s = swapsFor(own[param], tex, slugSet);
          Object.assign(swaps, s.swaps);
          for (const w of s.wanted) (wantedBy.get(e.mesh) ?? wantedBy.set(e.mesh, []).get(e.mesh)).push({ variation: e.variation, ...w });
          for (const n of s.missing) missing.add(n);
          if (!inPack(tex, slugSet)) missing.add(tex);
        }
        const recipe = variationRecipe({ mesh: e.mesh, i, row, mat, v, path: e.path });
        const maps = {};
        for (const name of Object.values(recipe?.maps ?? {})) {
          if (typeof name !== 'string') continue;
          maps[name] = packPath(name, slugSet);
          if (!maps[name]) missing.add(name);
        }
        for (const n of missing) missingAll.add(n);
        return { swaps, recipe, maps, vectors: v?.vectors ?? {}, bools: v?.bools ?? {}, missing: [...missing].sort() };
      }),
    };
  }
  // (a mesh only ever named with its default carries nothing)
  for (const [mesh, m] of Object.entries(out)) if (!Object.keys(m.variations).length) delete out[mesh];
  const rule = levelRule(out);
  const total = wanted ? wanted.size : seen.size;
  const fetch = new Map();
  for (const [mesh, list] of wantedBy) for (const w of list) if (rule[mesh] === w.variation && !fetch.has(w.slug)) fetch.set(w.slug, { slug: w.slug, like: w.like, file: w.file });
  return {
    format: 1,
    meshes: out,
    rule,
    instances: null,
    counts: {
      meshes: total,
      inMvdb: seen.size,
      withVariations: Object.keys(out).length,
      variations: Object.values(out).reduce((n, m) => n + Object.keys(m.variations).length, 0),
      ruled: Object.keys(rule).length,
      missing: missingAll.size,
    },
    fetch: [...fetch.values()],
  };
}
