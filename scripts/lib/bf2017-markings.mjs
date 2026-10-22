// A figure's markings colour from the game's own records. The 2017 game
// draws its droids (the B1's SS_CharactersPreset_RobotMarkings) with a grey
// colour map that its shader multiplies by the colour an ObjectVariation
// gives it (`Color0_Base`, linear, as glTF's base colour factor is), and
// lays its marking masks' colours over that (`_Marking`, `Color1_R`…) only
// in the skins that bind one. So the B1 of the game's default skin
// (Characters/Markings/D_Preq/Troopers/Default/D_Assault_Preq_01_Default:
// 0.638, 0.565, 0.366, the films' tan) is its map times that colour, which
// the import sets as the material's factor: the map itself is the game's,
// untouched.
//
//   recordFile(root, name, exists) → the record's file under the drop's root:
//     data/<name>.json.gz where the bucket's fetch keeps it, else
//     web/data/<name>.json where the desktop's export does; null for neither
//   readRecord(root, name) → the record, parsed (gunzipped where it is)
//   markingsColour(records) → [r, g, b]: the one Color0_Base every
//     MeshMaterialVariation of the records gives (a record per part: the
//     body's, the backpack's); throws where they give none or disagree
//   MARKINGS: the shader presets that take it
//
// Pure but for readRecord.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const MARKINGS = /SS_CharactersPreset_RobotMarkings/i;

export function recordFile(root, name, exists = existsSync) {
  const clean = String(name).replace(/\.json(\.gz)?$/, '');
  for (const rel of [`data/${clean}.json.gz`, `web/data/${clean}.json`]) {
    const file = join(root, rel);
    if (exists(file)) return file;
  }
  return null;
}

export function readRecord(root, name) {
  const file = recordFile(root, name);
  if (!file) throw new Error(`${name}: no record under ${root} (data/<name>.json.gz or web/data/<name>.json)`);
  const buf = readFileSync(file);
  return JSON.parse((file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
}

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

export function markingsColour(records) {
  const colours = [];
  for (const r of records)
    for (const o of r?.objects ?? []) {
      if (o.$type !== 'MeshMaterialVariation') continue;
      const v = (o.Shader?.VectorParameters ?? []).find((p) => p.ParameterName === 'Color0_Base')?.Value;
      if (v) colours.push([v.x, v.y, v.z]);
    }
  if (!colours.length) throw new Error('no Color0_Base in the variations');
  if (!colours.every((c) => near(c, colours[0]))) throw new Error(`the variations’ Color0_Base differ (${colours.map((c) => c.map((v) => v.toFixed(3)).join(',')).join(' / ')})`);
  return colours[0].map((v) => +v.toFixed(6));
}
