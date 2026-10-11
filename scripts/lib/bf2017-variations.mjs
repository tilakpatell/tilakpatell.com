// A level's variations: the game's own colour-to-texture map for its meshes
// (lane colour: docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md,
// §1.1 and §3 "Lane colour"). The level bundle's MeshVariationDatabase
// records (the level's own and its sub-levels') bind each mesh's material
// textures by parameter name, once for the default (VariationAssetNameHash
// 0) and once per variation; each variation entry names an ObjectVariation
// whose MeshMaterialVariation (by guid, the entry's MaterialVariation class)
// carries a shader preset, plain-named vectors, bools and conditionals. The
// static model groups' members (the level records' StaticModelGroupEntityData)
// carry each instance's variation as the same hash (djb2-xor of the
// variation's lower-cased path: scripts/lib/bf2017-shader-names.mjs). Pure.
//
//   ktx2Of(name, has) → 'textures/<name>.ktx2' (or its __normal) | null
//   variationsOf({ mvdbs: [{ sub, record }], variations: [record], listing: (path) → bool, use? })
//     → { format: 1, meshes, missing, usedDefaults, instances: null, counts }
//     meshes[<mesh asset, lower case>] = { default: [material], variations: { <short name>: { asset, hash, materials } },
//       use: <short name> | null, by: 'instances' | 'rule' | 'mixed' | null, uses?: { name: instances }, _source }
//     (a mixed mesh draws its default: a pack draws one material a mesh;
//     `instances` keeps each group's list for a split by instance)
//     material = { textures: { slot: ktx2 | null }, missing?: { slot: name }, shader?, vectors?, bools?, conditionals? }
//   levelRule(meshes, usedDefaults) → { <mesh>: <short name> }
//   meshBindings(records, mesh) → [[{ slot, name, parameter }]] | null: a mesh's
//     default entry, each material's maps as glTF slots (bf2017-textures.mjs's
//     slotOfParameter; a parameter it does not know is left out), for the import
//   instanceUse({ groups, meshes, members, names }) → { instances: [[groupIndex, name | [names]]], byMesh: { <mesh>: { name: count } } }
//
// The rule, for a mesh no instance names (a placed blueprint, not a static
// group member): a mesh whose MVDBs carry exactly one variation and whose
// default no sub-level apart from the level's own names takes it.

import { slotOfParameter } from './bf2017-textures.mjs';

const short = (asset) => String(asset).split('/').pop();
const meshKey = (asset) => String(asset).toLowerCase();

export function ktx2Of(name, has) {
  const base = `textures/${String(name).toLowerCase()}`;
  for (const p of [`${base}.ktx2`, `${base}__normal.ktx2`]) if (has(p)) return p;
  return null;
}

const vec4 = (v) => [v?.x ?? 0, v?.y ?? 0, v?.z ?? 0, v?.w ?? 0];

// an ObjectVariation record's MeshMaterialVariations by guid, and its name
function readVariation(record) {
  const objects = record?.objects ?? [];
  const head = objects.find((o) => o.$type === 'ObjectVariation');
  const byGuid = new Map();
  for (const o of objects) if (o.$type === 'MeshMaterialVariation') byGuid.set(String(o.$guid).toLowerCase(), o.Shader ?? {});
  return { name: head?.Name ?? record?.name, hash: head?.NameHash ?? null, byGuid };
}

// one MVDB material's bindings, and its MeshMaterialVariation's when it has one
function materialOf(m, listing, shaderOf, missingAll) {
  const textures = {};
  const missing = {};
  const bind = (slot, name) => {
    const path = name ? ktx2Of(name, listing) : null;
    textures[slot] = path;
    if (name && !path) {
      missing[slot] = name;
      missingAll.add(name);
    } else delete missing[slot];
  };
  for (const t of m.TextureParameters ?? []) bind(t.ParameterName, t.Value?.$asset);
  const out = { textures };
  const v = m.MaterialVariation ? shaderOf(m.MaterialVariation) : null;
  if (v) {
    if (v.Shader?.$asset) out.shader = v.Shader.$asset;
    for (const t of v.TextureParameters ?? []) bind(t.ParameterName, t.Value?.$asset);
    const vectors = Object.fromEntries((v.VectorParameters ?? []).map((p) => [p.ParameterName, vec4(p.Value)]));
    const bools = Object.fromEntries((v.BoolParameters ?? []).map((p) => [p.ParameterName, !!p.Value]));
    const conditionals = Object.fromEntries((v.ConditionalParameters ?? []).map((p) => [short(p.ConditionalAsset?.$asset), p.Value]));
    if (Object.keys(vectors).length) out.vectors = vectors;
    if (Object.keys(bools).length) out.bools = bools;
    if (Object.keys(conditionals).length) out.conditionals = conditionals;
  }
  if (Object.keys(missing).length) out.missing = missing;
  return out;
}

export function variationsOf({ mvdbs = [], variations = [], listing = () => false, use = null }) {
  const byName = new Map();
  const byHash = new Map();
  for (const r of variations) {
    const v = readVariation(r);
    byName.set(String(v.name).toLowerCase(), v);
    if (v.hash != null) byHash.set(v.hash, v);
  }
  // a MaterialVariation reference → its MeshMaterialVariation's shader block
  const shaderOf = (ref) => byName.get(String(ref.$asset).toLowerCase())?.byGuid.get(String(ref.$class).toLowerCase()) ?? null;
  const meshes = {};
  const missing = new Set();
  const usedDefaults = new Set();
  mvdbs.forEach(({ record }, k) => {
    const name = record?.name ?? `mvdb ${k}`;
    for (const db of (record?.objects ?? []).filter((o) => o.$type === 'MeshVariationDatabase')) {
      for (const e of db.Entries ?? []) {
        const mesh = meshKey(e.Mesh?.$asset);
        const row = (meshes[mesh] ??= { default: null, variations: {}, use: null, by: null, _source: { mvdb: [], variations: {} } });
        if (!row._source.mvdb.includes(name)) row._source.mvdb.push(name);
        const hash = e.VariationAssetNameHash ?? 0;
        if (!hash) {
          if (k > 0) usedDefaults.add(mesh);
          row.default ??= (e.Materials ?? []).map((m) => materialOf(m, listing, shaderOf, missing));
          continue;
        }
        const ref = (e.Materials ?? []).find((m) => m.MaterialVariation)?.MaterialVariation;
        const asset = ref?.$asset ?? byHash.get(hash)?.name ?? null;
        const key = asset ? short(asset) : `hash:${hash}`;
        if (row.variations[key]) continue;
        row.variations[key] = { asset, hash, materials: (e.Materials ?? []).map((m) => materialOf(m, listing, shaderOf, missing)) };
        if (asset) row._source.variations[key] = asset;
      }
    }
  });
  const rule = levelRule(meshes, usedDefaults);
  const counts = { meshes: 0, withVariations: 0, byInstances: 0, byRule: 0, mixed: 0, missingTextures: missing.size };
  for (const [mesh, row] of Object.entries(meshes)) {
    counts.meshes++;
    if (Object.keys(row.variations).length) counts.withVariations++;
    const seen = use?.[mesh];
    const names = seen ? Object.keys(seen) : [];
    if (seen) row.uses = seen;
    if (names.length === 1 && names[0] !== 'default' && row.variations[names[0]]) {
      row.use = names[0];
      row.by = 'instances';
      counts.byInstances++;
    } else if (names.length > 1) {
      row.by = 'mixed';
      counts.mixed++;
    } else if (!names.length && rule[mesh]) {
      row.use = rule[mesh];
      row.by = 'rule';
      counts.byRule++;
    }
  }
  return { format: 1, meshes, missing: [...missing].sort(), usedDefaults, instances: null, counts };
}

export function levelRule(meshes, usedDefaults = new Set()) {
  const out = {};
  for (const [mesh, row] of Object.entries(meshes)) {
    const names = Object.keys(row.variations);
    if (names.length === 1 && !usedDefaults.has(mesh)) out[mesh] = names[0];
  }
  return out;
}

// The map's static groups (scripts/lib/bf2017-level.mjs's readMap: { mesh,
// sub, kind, count }) against the level records' members, per sub-level in
// order, each group taking the first unused member of its mesh and count.
//   members: { <sub index>: MemberDatas[] }, names: Map(hash → short name)
export function instanceUse({ groups = [], meshes = [], members = {}, names = new Map() }) {
  const used = new Set();
  const instances = [];
  const byMesh = {};
  groups.forEach((g, i) => {
    if (g.kind !== 'static') return;
    const asset = meshKey(
      String(meshes[g.mesh]?.file ?? '')
        .replace(/^models\//, '')
        .replace(/\.glb$/, ''),
    );
    const list = members[g.sub] ?? [];
    const j = list.findIndex((m, k) => !used.has(`${g.sub}:${k}`) && meshKey(m.MeshAsset?.$asset) === asset && m.InstanceCount === g.count);
    if (j < 0) return;
    used.add(`${g.sub}:${j}`);
    const hashes = list[j].InstanceObjectVariation ?? [];
    if (!hashes.length) return;
    const each = hashes.map((h) => (h ? (names.get(h) ?? `hash:${h}`) : 'default'));
    const tally = (byMesh[asset] ??= {});
    for (const n of each) tally[n] = (tally[n] ?? 0) + 1;
    instances.push([i, each.every((n) => n === each[0]) ? each[0] : each]);
  });
  return { instances, byMesh };
}

export function meshBindings(records, mesh) {
  const want = meshKey(mesh);
  for (const r of records) {
    for (const db of (r?.objects ?? []).filter((o) => o.$type === 'MeshVariationDatabase')) {
      const e = (db.Entries ?? []).find((x) => meshKey(x.Mesh?.$asset) === want && !x.VariationAssetNameHash);
      if (!e) continue;
      return (e.Materials ?? []).map((m) =>
        (m.TextureParameters ?? []).flatMap((t) => {
          const slot = slotOfParameter(t.ParameterName);
          return slot && t.Value?.$asset ? [{ slot, name: t.Value.$asset, parameter: t.ParameterName }] : [];
        }),
      );
    }
  }
  return null;
}
