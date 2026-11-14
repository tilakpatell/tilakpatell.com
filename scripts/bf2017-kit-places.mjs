// A capital's kit as the space level stands it, for the war's ship to be
// drawn from the level pack's own parts (src/components/galaxy/capitalKit.js):
// every part round the kit's hull, in the hull's frame (scripts/lib/
// bf2017-space.mjs's piecesOf, the same reading bf2017-space.mjs builds the
// kit's cut from), the pack's mesh for each, how many LODs the pack has of
// it, and the size rows of the maps the parts wear (level.json's `tex`). The
// cut the space layer flies took every part at its lightest LOD, its maps at
// a 1,024 and the two UV sets of most of its parts swapped; the pack keeps
// each part whole at six LODs, both UV sets, its tangents and the game's
// 2,048 maps.
//
//   node scripts/bf2017-kit-places.mjs <system> <kit slug> [--map <file without .json/.bin>] [--maps <regex>] [--root lab/assets/bf2017]
//     e.g. endor endor-isd; fondor fondor-isd
//
//   writes src/data/galaxy/kits/<kit slug>.json:
//     { level, from, anchor, parts: [[mesh, at, quaternion, scale], …], lods: { mesh: n }, tex: { slug: { low, mid, high, ultra } } }
//   (the anchor, the hull, left out of `parts`: capitalHull.js draws it; its
//   LODs listed, for what its GLB holds beside it; `n`, the LODs from the
//   first the pack has without a gap)
//   --maps <regex>: the map rows the kit's parts wear, by their slug (the
//   Star Destroyer's own sheets, ^t_stardestroyer, by default)
//   --fallback <pack,…>: the packs a part the kit's own hasn't got is taken
//   from (the same game mesh: Fondor's pack left out the Star Destroyer's
//   domes, Endor's has them), its entry naming its pack, `[mesh, at,
//   quaternion, scale, pack]`
//   --map: the space map's local copy (the drop's web/maps/<map>, fetched by
//   scripts/bf2017-fetch.mjs with the bucket's keys)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { readMap } from './lib/bf2017-level.mjs';
import { localPath } from './lib/bf2017-paths.mjs';
import { SPACE, piecesOf } from './lib/bf2017-space.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const last = (file) => String(file).split('/').pop().replace(/\.glb$/, '');
const round = (v, k) => Math.round(v * k) / k + 0;

// the space level's pack a map's kit is drawn from: the system's sb_ pack
export const packOf = (map) => `sb_${String(map).split('/').pop().replace(/^sb_|_\d+$/g, '')}`;

// The kit file from piecesOf's model and the pack's level.json. Pure.
//   model: { parts: [{ file, at, quaternion, scale }] } (the anchor at the origin, first)
//   level: level.json ({ meshes: [{ name, glb }], tex })
//   fallbacks: [{ pack, level }], the packs a part the kit's own hasn't got is taken from
export function kitOf(model, level, { pack, from, maps = /^t_stardestroyer/, fallbacks = [] }) {
  // (a kit gathered round an anchor, its first part at the origin; an area's, the dry dock's, has none to draw round)
  const [anchor] = model.parts;
  if (!model.kit || !anchor || anchor.at.some((v) => v !== 0)) throw new Error(`${from}: not a kit round an anchor`);
  const packs = [{ pack, level }, ...fallbacks].map((x) => ({ ...x, byName: new Map(x.level.meshes.map((m) => [last(m.name), m])) }));
  // (the LODs from the first without a gap: a LOD past a missing one isn't asked for)
  const lodsOf = (glb = []) => {
    const n = glb.findIndex((g) => !g);
    return n < 0 ? glb.length : n;
  };
  const parts = [];
  const lods = {};
  const missing = [];
  const used = new Set([pack]);
  for (const p of model.parts) {
    const mesh = last(p.file);
    const from = packs.find((x) => lodsOf(x.byName.get(mesh)?.glb) > 0);
    if (!from) {
      missing.push(mesh);
      continue;
    }
    used.add(from.pack);
    lods[mesh] = lodsOf(from.byName.get(mesh).glb);
    const entry = [mesh, p.at.map((v) => round(v, 1000)), p.quaternion.map((v) => round(v, 1e4)), p.scale.map((v) => round(v, 1000))];
    if (from.pack !== pack) entry.push(from.pack);
    if (p !== anchor) parts.push(entry);
  }
  const tex = {};
  for (const x of packs.filter((x) => used.has(x.pack)).reverse()) for (const [slug, row] of Object.entries(x.level.tex ?? {})) if (maps.test(slug)) tex[slug] = { low: row.low, mid: row.mid, high: row.high, ultra: row.ultra };
  return { kit: { level: pack, from, anchor: last(anchor.file), parts, lods, tex: Object.fromEntries(Object.entries(tex).sort(([a], [b]) => (a < b ? -1 : 1))) }, missing };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [system, slug] = args._;
  const space = SPACE[system];
  if (!space || !slug) {
    console.log('node scripts/bf2017-kit-places.mjs <system> <kit slug> [--map <file>] [--maps <regex>] [--root lab/assets/bf2017]');
    return 1;
  }
  const base = typeof args.map === 'string' ? args.map : localPath(typeof args.root === 'string' ? args.root : join(ROOT, 'lab/assets/bf2017'), `web/maps/${space.map}`);
  const map = readMap(JSON.parse(readFileSync(`${base}.json`, 'utf8')), readFileSync(`${base}.bin`));
  const { models } = piecesOf(map, { system });
  const model = models[slug];
  if (!model) {
    console.log(`${slug}: not a model of ${system} (${Object.keys(models).join(', ')})`);
    return 1;
  }
  const pack = packOf(space.map);
  const levelOf = (p) => JSON.parse(readFileSync(join(ROOT, 'public/models/galaxy/bf2017/levels', p, 'level.json'), 'utf8'));
  const fallbacks = (typeof args.fallback === 'string' ? args.fallback.split(',') : []).map((p) => ({ pack: p, level: levelOf(p) }));
  const { kit, missing } = kitOf(model, levelOf(pack), { pack, from: slug, fallbacks, ...(typeof args.maps === 'string' ? { maps: new RegExp(args.maps) } : {}) });
  const out = join(ROOT, 'src/data/galaxy/kits', `${slug}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(kit)}\n`);
  console.log(`${slug}: ${kit.parts.length} parts of ${new Set(kit.parts.map((p) => p[0])).size} meshes round ${kit.anchor}, ${Object.keys(kit.tex).length} maps → ${out}`);
  for (const m of missing) console.log(`  not in ${pack}: ${m}`);
  return missing.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main());
