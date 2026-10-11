// The material audit (the colour lane's task 5): per world, how much of
// what is drawn is bound as the game binds it. Each drawn material of the
// pack (a mesh with a LOD file, each of its materials) against the level's
// mesh variation databases: the variation the pack draws it in (the level's
// rule, or an instance's), else its default entry. Pure.
//
//   auditPack({ meshes, entries, materials, variations }) → { rows, counts, share }
//     meshes: [{ key (the mesh asset, lower case), mats }] the pack draws
//     entries: bf2017-variations.mjs's entriesOf over the pack's databases
//     materials: Map(mesh → its web/materials.jsonl row): what the GLB binds
//     variations: the pack's variations.json
//
// A row's state: `bound` (every map the database names is the one drawn),
// `default-only` (the database has a variation of the mesh and none is
// drawn), `missing-texture` (the variation drawn names a map the pack has
// not got: its slots named), `unbound` (the GLB binds another map than the
// database names: its slots named), `no-entry` (the mesh is in no database
// of the level: the recipe is the dump's alone). `share` is bound's.

import { variationFor } from '../../src/components/galaxy/surface/level/levelVariations.js';

export const STATES = ['bound', 'default-only', 'missing-texture', 'unbound', 'no-entry'];

const lc = (s) => String(s ?? '').toLowerCase();

export function auditPack({ meshes, entries, materials, variations }) {
  const byMesh = new Map();
  for (const e of entries) (byMesh.has(e.mesh) ? byMesh : byMesh.set(e.mesh, [])).get(e.mesh).push(e);
  const rows = [];
  for (const { key, mats } of meshes) {
    const list = byMesh.get(key) ?? [];
    const def = list.find((e) => e.variation === 'default');
    const others = list.some((e) => e.variation !== 'default');
    const v = variationFor(variations, key);
    const row = materials.get(key);
    for (let i = 0; i < mats; i++) {
      const at = { mesh: key, material: i };
      if (!list.length) {
        rows.push({ ...at, state: 'no-entry' });
        continue;
      }
      if (v) {
        const entry = list.find((e) => e.variation === v.name)?.materials[i];
        const missing = new Set((v.materials[i]?.missing ?? []).map(lc));
        const slots = Object.entries(entry?.textures ?? {})
          .filter(([, t]) => missing.has(lc(t)))
          .map(([p]) => p);
        rows.push({ ...at, variation: v.name, state: slots.length ? 'missing-texture' : 'bound', ...(slots.length ? { slots } : {}) });
        continue;
      }
      const drawn = row?.materials?.[i]?.textures ?? {};
      const slots = Object.entries(def?.materials[i]?.textures ?? {})
        .filter(([p, t]) => lc(drawn[p]) !== lc(t))
        .map(([p]) => p);
      if (slots.length) rows.push({ ...at, state: 'unbound', slots });
      else rows.push({ ...at, state: others ? 'default-only' : 'bound' });
    }
  }
  const counts = Object.fromEntries(STATES.map((s) => [s, rows.filter((r) => r.state === s).length]));
  return { rows, counts, share: rows.length ? counts.bound / rows.length : 0 };
}
