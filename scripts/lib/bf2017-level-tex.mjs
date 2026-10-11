// A level pack's textures the bucket had not got when the pack was built
// (the desktop uploads the drop's maps over days: web_opt/_surfaces_list.tsv),
// found again once it has them. The pack's GLBs name each map as
// `../tex/<slug>.ktx2`; level.json's `tex` has a row for each one written, so
// a slug a GLB names and `tex` lacks is a gap, and its mesh draws white. Theed's
// far LODs are the plainest: their stand-in materials (M_LowerLODs_01,
// simplewindow) wear the facades' atlases (t_nab_01_a_combined_01_cs), which
// came after Naboo's pack. Pure; scripts/bf2017-level-tex.mjs fetches.
//
//   texGaps(meshes, glbOf, tex) → Map(slug → { radius, materials, dirs })
//     meshes: level.json's (radius, glb paths); glbOf(path) → its GLB's JSON
//     or null; tex: level.json's rows. `radius` the biggest wearer's (the
//     factory sizes a map by it: lod.js's texSizeFor), `materials` the GLB
//     material names that wear it, `dirs` the bucket folders the GLBs' own
//     material extras say its source map was in
//   textureDirs(rows) → Map(lower-case leaf → [bucket folder]): the drop's
//     maps by name (web/textures.jsonl's rows: { name, file })
//   bucketPathOf(slug, dirs, index) → the KTX2's path under web/, or null:
//     beside its source map (a derived __normal or __orm_<hash> too), in the
//     folder the GLB names, else the index's one folder for it; two folders
//     and no word from the GLB is no guess

const IMAGE = /^\.\.\/tex\/(.+)\.ktx2$/;
// the source map a derived map is made from (the uploader's __normal, __orm_<hash>)
const sourceOf = (slug) => slug.replace(/__(normal|orm_[0-9a-f]+)$/, '');
const leafOf = (path) => path.split('/').pop().replace(/\.[a-z0-9]+$/i, '').toLowerCase();
const dirOf = (path) => path.slice(0, path.lastIndexOf('/'));

export function texGaps(meshes, glbOf, tex) {
  const gaps = new Map();
  for (const mesh of meshes) {
    for (const path of mesh.glb ?? []) {
      if (!path) continue;
      const json = glbOf(path);
      if (!json) continue;
      // (each image's wearers, and where the material's extras say its maps came from)
      const wearers = new Map();
      const from = new Map();
      for (const m of json.materials ?? []) {
        const pbr = m.pbrMetallicRoughness ?? {};
        for (const t of [pbr.baseColorTexture, pbr.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture, m.emissiveTexture]) {
          const tx = t && json.textures?.[t.index];
          const img = tx?.extensions?.KHR_texture_basisu?.source ?? tx?.source;
          if (img == null) continue;
          if (!wearers.has(img)) wearers.set(img, new Set());
          wearers.get(img).add(m.name);
        }
        for (const p of Object.values(m.extras?.textures ?? {})) if (typeof p === 'string') from.set(leafOf(p), dirOf(p));
      }
      (json.images ?? []).forEach((image, i) => {
        const slug = IMAGE.exec(image.uri ?? '')?.[1];
        if (!slug || tex?.[slug]) return;
        const g = gaps.get(slug) ?? { radius: 0, materials: [], dirs: [] };
        g.radius = Math.max(g.radius, mesh.radius ?? 0);
        for (const name of wearers.get(i) ?? []) if (!g.materials.includes(name)) g.materials.push(name);
        const dir = from.get(sourceOf(slug));
        if (dir && !g.dirs.includes(dir)) g.dirs.push(dir);
        gaps.set(slug, g);
      });
    }
  }
  return gaps;
}

export function textureDirs(rows) {
  const index = new Map();
  for (const r of rows) {
    if (!r?.file) continue;
    const k = leafOf(r.file);
    if (!index.has(k)) index.set(k, []);
    const d = dirOf(r.file);
    if (!index.get(k).includes(d)) index.get(k).push(d);
  }
  return index;
}

export function bucketPathOf(slug, dirs, index) {
  const known = index.get(sourceOf(slug)) ?? [];
  const dir = dirs.find((d) => !known.length || known.includes(d)) ?? (known.length === 1 ? known[0] : null);
  return dir ? `${dir}/${slug}.ktx2` : null;
}
