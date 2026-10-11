// How much of what a level pack draws is bound as the game binds it (lane
// colour: docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md, §3
// "Lane colour", the gate). Per drawn material: the slots the level's mesh
// variation databases bind (its variations.json, scripts/lib/
// bf2017-variations.mjs), in the variation the pack applies or the default,
// against what the pack draws: the GLB's maps (the material dump's slots:
// web/materials.jsonl, which the export bound) and the variation's own maps
// where the pack has them. Pure.
//
//   auditPack({ meshes: [{ name, mats }], dump: Map(mesh → materials.jsonl row), variations }) → rows
//     row = { mesh, material, state, slots?, variation? }
//     state: 'bound'           every slot the database binds is drawn with its texture
//            'default-only'    the game varies the mesh on this level and the pack draws its default
//                              (its instances disagree, or none says which)
//            'missing-texture' a texture the database binds is not in the bucket, nor baked
//                              into the GLB (the dump binds another, or none)
//            'unbound'         a slot is drawn with another texture, or not at all (slots names them)
//            'no-entry'        no database of the level lists the mesh: the recipe is the dump's
//   summarise(rows) → { materials, bound, 'default-only', 'missing-texture', unbound, 'no-entry', share }

const STATES = ['bound', 'default-only', 'missing-texture', 'unbound', 'no-entry'];

const meshOf = (name) =>
  String(name)
    .replace(/^models\//, '')
    .replace(/\.glb$/, '')
    .toLowerCase();
// a texture as one key whether a game name or the bucket's KTX2
const keyOf = (t) =>
  String(t ?? '')
    .toLowerCase()
    .replace(/^textures\//, '')
    .replace(/\.ktx2$/, '')
    .replace(/__normal$/, '');

function stateOf(row, i, dumpMaterial, maps) {
  const varied = Object.keys(row.variations ?? {}).length > 0;
  const uses = row.uses ? Object.keys(row.uses) : null;
  const allDefault = uses?.length === 1 && uses[0] === 'default';
  if (varied && !row.use && !allDefault) return { state: 'default-only' };
  const applied = row.use ? row.variations[row.use] : null;
  const m = applied ? applied.materials?.[i] : row.default?.[i];
  if (!m) return { state: 'no-entry' };
  // (the default's textures and the dump's, whatever slot names them: a
  // variation's shader may call the default's map _BaseColor, not _CS)
  const def = new Set(Object.values(row.default?.[i]?.textures ?? {}).filter(Boolean));
  const drawn = dumpMaterial?.textures ?? {};
  const drawnKeys = new Set(Object.values(drawn).map(keyOf));
  // (a texture the bucket has no KTX2 of is still drawn where the dump binds
  // it: the export baked it into the GLB, an _MSW into its ORM)
  const lost = Object.entries(m.missing ?? {}).filter(([slot, name]) => keyOf(drawn[slot]) !== keyOf(name));
  if (lost.length) return { state: 'missing-texture', slots: lost.map(([slot, name]) => `${slot} ${name}`) };
  const slots = [];
  for (const [slot, path] of Object.entries(m.textures ?? {})) {
    if (!path) continue;
    // (the variation's own map, in the pack; else the GLB's, the dump's binding)
    const own = applied && !def.has(path);
    const ok = own ? !!maps[path] : keyOf(drawn[slot]) === keyOf(path) || (!!applied && drawnKeys.has(keyOf(path)));
    if (!ok) slots.push(slot);
  }
  const out = slots.length ? { state: 'unbound', slots } : { state: 'bound' };
  if (applied) out.variation = row.use;
  return out;
}

export function auditPack({ meshes = [], dump = new Map(), variations = {} }) {
  const rows = [];
  const maps = variations.maps ?? {};
  for (const m of meshes) {
    const mesh = meshOf(m.name);
    const row = variations.meshes?.[mesh];
    const d = dump.get(mesh);
    const count = m.mats ?? d?.materials?.length ?? row?.default?.length ?? 1;
    for (let i = 0; i < count; i++) {
      rows.push({ mesh, material: i, ...(row ? stateOf(row, i, d?.materials?.[i], maps) : { state: 'no-entry' }) });
    }
  }
  return rows;
}

export function summarise(rows) {
  const out = { materials: rows.length };
  for (const s of STATES) out[s] = rows.filter((r) => r.state === s).length;
  out.share = rows.length ? Math.round((out.bound / rows.length) * 1e4) / 1e4 : 0;
  return out;
}
