// A soldier's outfit as the 2017 game's records give it (EA DICE's Battlefront
// II). A multiplayer kit's `Appearances` name a VisualUnlockRootAsset (MPVUR);
// its `SkinInfos` are its skins, each a whole look with a third-person bundle
// (the stormtrooper's default, Hoth and Scarif skins; a Rebel's skins are its
// heads, `SelectSkinMethod_RandomIgnoreCommon`: one at random). The root's own
// bundle (`<mpvur>_bpb`) holds the parts every skin wears (SkinId 0) and the
// common skin's (the SkinInfo with no bundle, never shown); a skin's bundle
// (`<bundle>_dccb`, its DataContainerCollectionBlueprint) holds its own. A part
// (VisualUnlockPartAsset) is an ObjectBlueprint, whose SkinnedMeshAssets are
// the meshes it wears, or a MeshAndVariationPair in the same record: a mesh and
// an ObjectVariation (the sandtrooper's helmet: the stormtrooper's mesh in the
// Mos Eisley variation). A skin with parts of its own wears those and the
// common ones; a skin without (the Scarif stormtrooper: textures only) wears
// the common skin's. The maps: each bundle's MeshVariationDatabase
// (`<bundle>/MeshVariationDb_Win32`) binds a mesh's materials by the shader's
// parameter names, the default entry (VariationAssetNameHash 0) or the
// variation's (its ObjectVariation's NameHash). First-person parts (`_1p`) are
// left out. Pure: `read(path)` is the record reader (any case, null if none).
//
//   outfitOf(read, mpvur) → { name, pick: 'default' | 'random', defaultSkin,
//     skins: [{ id, name, ui, default, parts: [{ mesh, variation, from }],
//       maps: { [mesh]: [[{ parameter, texture }]] } }], missing: [path] } | null
//   meshesOf(record, start?) → [mesh asset, lower case]: the meshes a
//     blueprint wears (from its first object, or `start`, through its $refs)
//   skinName(debugId) → 'hoth' (MPVUR_D_Assault_Orig_01_Skin2_Hoth), 'default', …

const lower = (s) => String(s ?? '').toLowerCase();
const isFirstPerson = (path) => /_1p(_|$)/i.test(String(path ?? ''));
const MESH_TYPES = new Set(['SkinnedMeshAsset', 'RigidMeshAsset', 'CompositeMeshAsset']);

export function meshesOf(record, start = 0) {
  const objects = record?.objects ?? [];
  const out = new Set();
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v.$ref === 'number') {
      if (seen.has(v.$ref)) return;
      seen.add(v.$ref);
      return walk(objects[v.$ref]);
    }
    if (typeof v.$asset === 'string') {
      if (MESH_TYPES.has(v.$assetType)) out.add(lower(v.$asset));
      return;
    }
    for (const k of Object.keys(v)) walk(v[k]);
  };
  seen.add(start);
  walk(objects[start]);
  return [...out];
}

// 'MPVUR_D_Assault_Orig_01_Skin2_Hoth' → 'hoth'; '…_Skin1_Default' → 'default'
export const skinName = (id) => {
  const m = /_skin\d+_(.+)$/i.exec(String(id ?? ''));
  return m ? m[1].toLowerCase() : null;
};

// the third-person parts a record holds, each { skin, mesh, variation, from }
function partsIn(read, rec, missing) {
  const objects = rec?.objects ?? [];
  const out = [];
  for (const o of objects) {
    if (o?.$type !== 'VisualUnlockPartAsset' || o.RenderIn1p === true) continue;
    const skin = Number(o.SkinId ?? 0);
    const bp = o.OutObjectBlueprint;
    if (typeof bp?.$ref === 'number') {
      const pair = objects[bp.$ref];
      if (pair?.$type === 'MeshAndVariationPair' && pair.MeshAsset?.$asset) out.push({ skin, mesh: lower(pair.MeshAsset.$asset), variation: pair.Variation?.$asset ?? null, from: rec.name });
      else for (const mesh of meshesOf(rec, bp.$ref)) out.push({ skin, mesh, variation: null, from: rec.name });
      continue;
    }
    const path = bp?.$asset;
    if (!path || isFirstPerson(path)) continue;
    const b = read(path);
    if (!b) {
      missing.add(path);
      continue;
    }
    for (const mesh of meshesOf(b)) out.push({ skin, mesh, variation: null, from: path });
  }
  return out;
}

// a bundle: its parts (a BlueprintBundle's dccb, or a VisualUnlockBlueprintBundle's
// own objects), its skin assets and its MVDB
function bundleOf(read, name, missing) {
  const mvdb = read(`${name}/MeshVariationDb_Win32`);
  const rec = read(name);
  if (!rec) {
    if (!mvdb) missing.add(name);
    return { parts: [], skins: [], mvdb };
  }
  const recs = [rec];
  const head = rec.objects?.[0];
  if (head?.Blueprint?.$asset) {
    const dccb = read(head.Blueprint.$asset);
    if (dccb) recs.push(dccb);
    else missing.add(head.Blueprint.$asset);
  }
  const parts = recs.flatMap((r) => partsIn(read, r, missing));
  const skins = recs.flatMap((r) => (r.objects ?? []).filter((o) => o?.$type === 'VisualUnlockSkinAsset').map((o) => ({ id: Number(o.SkinId), debug: o.DebugUnlockId ?? null })));
  return { parts, skins, mvdb };
}

// a MeshVariationDatabase's entries: mesh → hash → materials' maps
function entriesOf(mvdb, into = new Map()) {
  for (const e of mvdb?.objects?.[0]?.Entries ?? []) {
    const mesh = lower(e.Mesh?.$asset);
    if (!mesh) continue;
    if (!into.has(mesh)) into.set(mesh, new Map());
    const maps = (e.Materials ?? []).map((m) => (m.TextureParameters ?? []).filter((t) => t.Value?.$asset).map((t) => ({ parameter: t.ParameterName, texture: t.Value.$asset })));
    into.get(mesh).set(Number(e.VariationAssetNameHash ?? 0), maps);
  }
  return into;
}

// an ObjectVariation's NameHash, read from its record
const hashOf = (read, variation) => {
  const head = (read(variation)?.objects ?? []).find((o) => o?.$type === 'ObjectVariation');
  return head?.NameHash == null ? null : Number(head.NameHash);
};

export function outfitOf(read, mpvur) {
  const rec = read(mpvur);
  const root = rec?.objects?.[0];
  if (!root || root.$type !== 'VisualUnlockRootAsset') return null;
  const missing = new Set();
  const own = new Set((root.ThirdPersonBundles ?? []).map((b) => lower(b.Name)));
  // (the root's bundles' parts: SkinId 0 for all, else the common skin's)
  const base = [];
  const entries = new Map();
  for (const b of root.ThirdPersonBundles ?? []) {
    const got = bundleOf(read, b.Name, missing);
    base.push(...got.parts);
    entriesOf(got.mvdb, entries);
  }
  if (!base.length) base.push(...partsIn(read, rec, missing));
  const ids = new Set((root.SkinInfos ?? []).filter((s) => s.ThirdPersonBundle?.Name).map((s) => Number(s.Identifier)));
  const all = base.filter((p) => p.skin === 0);
  const common = base.filter((p) => p.skin !== 0 && !ids.has(p.skin));
  const skins = [];
  // (an outfit of one look, no skin bundles, or one whose default is its
  // common skin, the SkinInfo with no bundle: the root bundle's parts, as
  // the default skin, 'common')
  const infos = (root.SkinInfos ?? []).filter((s) => s.ThirdPersonBundle?.Name);
  const commonIsDefault = (root.SkinInfos ?? []).some((s) => !s.ThirdPersonBundle?.Name && Number(s.Identifier) === Number(root.DefaultSkin));
  if (!infos.length || commonIsDefault) {
    const byMesh = new Map([...all, ...common].map((p) => [p.mesh, p]));
    const parts = [...byMesh.values()];
    const maps = {};
    for (const p of parts) {
      const byHash = entries.get(p.mesh);
      const h = p.variation ? hashOf(read, p.variation) : 0;
      const got = byHash?.get(h ?? -1) ?? (p.variation ? null : byHash?.get(0));
      if (got) maps[p.mesh] = got;
    }
    if (parts.length) skins.push({ id: commonIsDefault ? Number(root.DefaultSkin) : 0, name: infos.length ? 'common' : 'default', ui: !infos.length, default: true, parts, maps });
  }
  for (const info of infos) {
    const name = info.ThirdPersonBundle.Name;
    const id = Number(info.Identifier);
    const local = new Map(entries);
    const mine = [];
    let debug = null;
    for (const p of [...(info.ThirdPersonBundle.Parents ?? []).map((x) => x.Name).filter((x) => x && !own.has(lower(x))), name]) {
      const got = bundleOf(read, p, missing);
      mine.push(...got.parts.filter((x) => x.skin === id || x.skin === 0));
      debug ??= got.skins.find((s) => s.id === id)?.debug ?? null;
      for (const [mesh, byHash] of entriesOf(got.mvdb)) local.set(mesh, new Map([...(local.get(mesh) ?? []), ...byHash]));
    }
    mine.push(...base.filter((x) => x.skin === id));
    const wears = [...all, ...(mine.length ? mine : common)];
    // (one row a mesh: a later part of the same mesh, a variation, wins)
    const byMesh = new Map();
    for (const p of wears) byMesh.set(p.mesh, p);
    const parts = [...byMesh.values()];
    const maps = {};
    for (const p of parts) {
      const byHash = local.get(p.mesh);
      if (!byHash) continue;
      const h = p.variation ? hashOf(read, p.variation) : 0;
      const got = byHash.get(h ?? -1) ?? (p.variation ? null : byHash.get(0));
      if (got) maps[p.mesh] = got;
      else if (p.variation) missing.add(`${p.variation}#${h}`);
    }
    skins.push({ id, name: skinName(debug) ?? skinName(name.replace(/_bpb$/i, '')) ?? String(id), ui: info.VisibleInUI !== false, default: id === Number(root.DefaultSkin), parts, maps });
  }
  return { name: root.Name ?? rec.name, pick: /random/i.test(root.SelectSkinMethod ?? '') ? 'random' : 'default', defaultSkin: Number(root.DefaultSkin ?? 0), skins, missing: [...missing] };
}
