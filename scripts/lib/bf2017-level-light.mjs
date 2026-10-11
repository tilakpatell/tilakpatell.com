// A level pack's baked light rows (GPU-first lane N3, beside lane D2's rows
// in scripts/lib/bf2017-level.mjs, which re-exports these): the Enlighten
// sets the export holds for the level, and the far shadow cache as the
// sun's far cascade reads it. Pure; the CLI copies the maps
// (scripts/bf2017-level-parts.mjs).
//
//   enlightenRows(index) → [{ set, variant, size, irradiance, dirR, dirG, dirB,
//     skyVisibility, from: { <map>: [bucket paths, best first] }, uvSet, charts, _source }]
//     index: the export's texture index rows for the level (web/textures.jsonl)
//   farShadowRow(shadowCache) → { png, size, centre, right, up, forward, resolution,
//     tiles, variant, _source } | null
//
// Where the maps are (docs/superpowers/evidence/bf2017-picture/w/atlases/FORMAT.md,
// lane W's `atlases` job): the HDR irradiance at web/hdr/<export path>.<width>.ktx2
// (RGBA16F) when the exporter wrote its .dds, the encoder's UASTC of the 8-bit PNG
// (clamped to 1) at web/<export path>.ktx2 either way; the direction and sky maps
// at web/<export path>.ktx2. `from` lists them best first; the CLI keeps the first
// the bucket has, and a row whose irradiance it has not got is not written (the
// loader then keeps the level's probes).
//
// `charts` and `rects` are null: each instance's chart in the atlas lives in the level's
// Enlighten database, which the exporter never read (lane Q3's probe); until
// it is found, no game mesh looks the atlas up (light/baked.js's chartOf).
//
// The far shadow: lane E0 already writes the level's distant shadow cache as
// level.json's `shadowCache` (scripts/lib/bf2017-level-probes.mjs: the
// DistantShadowCacheVolumeEntityData's box and its 16-bit depth PNG), so the
// design's `farShadow` row is that row, read here into the far cache's shape.

import { MAX, atlasKind, fitSize, setOf } from '../desktop/bf2017-atlases.mjs';
import { bucketPath } from '../desktop/bf2017-panoramas.mjs';
import { isSequel } from './bf2017-manifest.mjs';

const KEY = { irradiance: 'irradiance', directionR: 'dirR', directionG: 'dirG', directionB: 'dirB', sky: 'skyVisibility' };
const FILE = { irradiance: 'irradiance', dirR: 'dirR', dirG: 'dirG', dirB: 'dirB', skyVisibility: 'sky' };
const SOURCE = "the export's texture index (web/textures.jsonl): the StaticEnlightenData set's five maps; paths as lane W's atlases job uploads them (scripts/desktop/bf2017-atlases.mjs)";
const ktx2 = (file) => String(file).replace(/\.[a-z0-9]+$/i, '.ktx2');
const lastOf = (p) => String(p).split('/').pop();

// a set's lighting setup from its name: EN_Hoth_01_Static_Sunset → Sunset,
// FL_Hoth_Cloudy_01_Static → Cloudy (the prefix, the level, the numbers and
// the word Static set aside)
function variantOf(set) {
  const words = lastOf(set).split('_').slice(2).filter((w) => !/^\d+$/.test(w) && !/^static$/i.test(w));
  return words.join('_') || null;
}

export function enlightenRows(index) {
  const sets = new Map();
  for (const t of index ?? []) {
    const kind = atlasKind(t?.name);
    if (!kind || isSequel(t.name)) continue;
    const set = setOf(t.name);
    if (!sets.has(set)) sets.set(set, {});
    sets.get(set)[KEY[kind]] = t;
  }
  const out = [];
  for (const [set, maps] of [...sets].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const irr = maps.irradiance;
    if (!irr) continue;
    const size = fitSize(irr.width, irr.height, MAX);
    const slug = lastOf(set).toLowerCase();
    const row = { set: lastOf(set), variant: variantOf(set), size: [size.width, size.height], uvSet: 1, charts: null, rects: null, from: {}, _source: SOURCE };
    for (const [key, t] of Object.entries(maps)) {
      row[key] = `enlighten/${slug}.${FILE[key]}.ktx2`;
      row.from[key] = key === 'irradiance' ? [bucketPath(t.file, size.width), ktx2(t.file)] : [ktx2(t.file)];
    }
    out.push(row);
  }
  return out;
}

const len2 = (v) => (Array.isArray(v) ? v.reduce((a, x) => a + x * x, 0) : 0);

export function farShadowRow(cache) {
  if (!cache?.png || !Array.isArray(cache.size)) return null;
  if (![cache.right, cache.up, cache.forward].every((v) => len2(v) > 0)) return null;
  const { png, size, centre, right, up, forward, resolution = null, tiles = null, variant = null } = cache;
  return { png, size, centre, right, up, forward, resolution, tiles, variant, _source: "level.json's shadowCache (lane E0: the DistantShadowCacheVolumeEntityData's box, its axes each the box's full size, and its 16-bit depth PNG)" };
}
