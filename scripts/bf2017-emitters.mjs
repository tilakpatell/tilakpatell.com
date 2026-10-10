#!/usr/bin/env node
// The game's effects read into the site's effect tables (fidelity lane X):
// each `EffectBlueprint` and its emitter documents to
// `src/data/bf2017/fx/<Effect>.json` (scripts/lib/bf2017-emitters.mjs says
// how each field is read), the textures they name to
// `src/data/bf2017/fx/_textures.json`, and what the reader kept under `raw`
// to stdout, for the PR.
//
//   node scripts/bf2017-emitters.mjs <effect name>… | --level hoth [--map levels/mp/hoth_01]
//     [--root C:/Users/tilak/Downloads/BF2_Extract] [--bucket] [--out src/data/bf2017/fx] [--dry]
//     [--sheets [--sheets-out public/models/galaxy/bf2017/fx]]
//
// An effect is named as the export names it (`FX/Ambient/Snow/FX_Snow_
// FallingSnow_01_Hoth`) or by its last part. --level reads the map's extras
// (`web/maps/<map>/<name>.extras.json`, `effects[]`) and takes every effect
// it spawns.
//
// Where it reads: --root, the export on the desktop (`web/data.tsv` and the
// files it lists under `web/`, or the bucket's layout fetched into
// lab/assets/bf2017: `data.tsv` and `data/<Name>.json.gz`); else --bucket,
// the private bf2017-assets bucket itself (`data/<Name>.json.gz`, the
// records by name; `data.tsv`, for the EmitterGraphs' replacements), with SUPABASE_URL and
// BF2017_KEY (or SUPA_KEY) from .env.local or the environment, never
// printed. The fixtures: --root scripts/fixtures/bf2017/fx.
//
// --sheets (with --root): each texture the effects name, from the export's
// master PNG or its KTX2 unpacked (phase 0's bf2017-textures.mjs), as WebP
// sprite sheets at 512, 1024 and 2048 across (src/lib/three/particles/
// sheets.js names them), each under 256 KB (the quality stepped down until
// it is; a size that will not fit is left out and said), and `fx.json`
// beside them; the set the effects read weighs under 6 MB per tier or the
// script says by how much. Then scripts/assets-upload.mjs --dry for the
// bucket's side.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { effectJson, emitterRefs, fileName, nearestDocument, rawReport, readIndex, sheetSizes, sheetSources } from './lib/bf2017-emitters.mjs';
import { SET_CAP, SHEET_CAP, SHEET_SIZE, setWeight, sheetFile } from '../src/lib/three/particles/sheets.js';
import { dataPath, objectUrl } from './lib/bf2017-paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'bf2017-assets';
const argv = process.argv.slice(2);
const arg = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const stop = (why, code = 2) => {
  console.error(why);
  process.exit(code);
};
const flagged = new Set(['level', 'map', 'root', 'out', 'sheets-out'].flatMap((k) => [arg(k)]).filter(Boolean));
const names = argv.filter((a) => !a.startsWith('--') && !flagged.has(a));
const level = arg('level');
if (!names.length && !level) stop('usage: node scripts/bf2017-emitters.mjs <effect>… | --level <world> [--map levels/mp/<map>] [--root <export>] [--bucket] [--out dir] [--dry]');
const dry = argv.includes('--dry');
const outDir = arg('out') ?? join(ROOT, 'src/data/bf2017/fx');

// ── where the records are ──
function keys() {
  const file = join(ROOT, '.env.local');
  let from = 'the environment';
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    from = '.env.local';
  }
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) stop(`no export and no bucket key: pass --root <export>, or set SUPABASE_URL and BF2017_KEY in .env.local (read: ${from})`);
  console.log(`keys from ${from}`);
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

function source() {
  const root = arg('root');
  if (root) {
    // (the export's index at web/data.tsv, or data.tsv at the root as the
    // bucket's layout has it; a record as .json or .json.gz)
    const tsvFile = [join(root, 'web/data.tsv'), join(root, 'data.tsv')].find(existsSync);
    if (!tsvFile) stop(`no web/data.tsv or data.tsv under ${root}`);
    const base = dirname(tsvFile);
    const index = readIndex(readFileSync(tsvFile, 'utf8'));
    const open = (p) => {
      for (const f of [join(base, p), join(base, `${p}.gz`), join(base, 'data', `${p}.json`), join(base, 'data', `${p}.json.gz`)]) {
        if (!existsSync(f)) continue;
        const buf = readFileSync(f);
        return JSON.parse((f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
      }
      return null;
    };
    return {
      index,
      from: root,
      async record(name) {
        const row = index.get(name.toLowerCase()) ?? [...index.values()].find((r) => r.name.toLowerCase().endsWith(`/${name.toLowerCase()}`));
        return row ? open(row.path) : open(name);
      },
      async extras(map) {
        const p = join(root, 'web/maps', map, `${map.split('/').pop()}.extras.json`);
        return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
      },
    };
  }
  if (!argv.includes('--bucket')) stop('say where the export is: --root <export> on the desktop, or --bucket with the key');
  const env = keys();
  const fetchKey = async (path) => {
    const res = await fetch(objectUrl(env.base, BUCKET, path), { headers: env.headers });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  };
  // The bucket's keys are case-sensitive, but a folder keeps one spelling
  // (`FX/Impacts`) where the index and the records may write another
  // (`FX/impacts`, `fx/impacts`): a miss is retried along the real
  // spelling, found folder by folder by listing (cached)
  const listed = new Map();
  const list = async (prefix) => {
    if (!listed.has(prefix)) {
      const res = await fetch(`${env.base.replace(/\/+$/, '')}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: { ...env.headers, 'content-type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000 }) });
      listed.set(prefix, res.ok ? (await res.json()).map((o) => o.name) : []);
    }
    return listed.get(prefix);
  };
  const spelled = async (path) => {
    let at = '';
    for (const part of path.split('/')) {
      const names = await list(at ? `${at}/` : '');
      const hit = names.find((n) => n === part) ?? names.find((n) => n.toLowerCase() === part.toLowerCase());
      if (!hit) return null;
      at = at ? `${at}/${hit}` : hit;
    }
    return at;
  };
  const get = async (path) => {
    const got = await fetchKey(path);
    if (got) return got;
    const real = await spelled(path);
    return real && real !== path ? fetchKey(real) : null;
  };
  return (async () => {
    const tsvCached = join(ROOT, 'lab/assets/bf2017/data.tsv');
    const tsv = existsSync(tsvCached) ? readFileSync(tsvCached) : ((await get('data.tsv')) ?? (await get('web/data.tsv')));
    const index = tsv ? readIndex(tsv.toString('utf8')) : new Map();
    // (an effect named by its last part, as a map's extras name them: the blueprint of that name)
    const byLast = new Map();
    for (const row of index.values()) if (row.type === 'EffectBlueprint') byLast.set(row.name.split('/').pop().toLowerCase(), row);
    if (!tsv) console.log('no data.tsv in the bucket: EmitterGraphs will be listed as missing');
    return {
      index,
      from: `the bucket ${BUCKET}`,
      // (by the index's path, whose case the bucket's keys keep: the records
      // name their emitters in lower case), kept under lab/assets/bf2017 as
      // bf2017-fetch.mjs lays it, so a second run and the fixtures read it there
      async record(name) {
        const row = index.get(name.toLowerCase()) ?? byLast.get(name.toLowerCase());
        const path = row ? `${row.path}.gz` : dataPath(name);
        const cached = join(ROOT, 'lab/assets/bf2017', path);
        let gz = existsSync(cached) ? readFileSync(cached) : await get(path);
        if (!gz) return null;
        if (!existsSync(cached)) {
          mkdirSync(dirname(cached), { recursive: true });
          writeFileSync(cached, gz);
        }
        return JSON.parse(gunzipSync(gz).toString('utf8'));
      },
      async extras(map) {
        const buf = await get(`web/maps/${map}/${map.split('/').pop()}.extras.json`);
        return buf ? JSON.parse(buf.toString('utf8')) : null;
      },
    };
  })();
}

const src = await source();
console.log(`reading from ${src.from}`);
let wanted = names;
if (level) {
  const map = arg('map') ?? `levels/mp/${level}_01`;
  const extras = await src.extras(map);
  if (!extras) stop(`no extras for ${map}`, 1);
  const counts = {};
  for (const e of extras.effects ?? []) {
    const n = e.blueprint ?? e.Blueprint ?? e.name ?? e.effect;
    if (n) counts[n] = (counts[n] ?? 0) + 1;
  }
  wanted = Object.keys(counts);
  console.log(`${map}: ${extras.effects?.length ?? 0} effect spawns of ${wanted.length} effects`);
}

// the documents an effect names, each read once
const docs = new Map();
const effects = [];
const notFound = [];
for (const name of wanted) {
  const bp = await src.record(name);
  if (!bp || (bp.type ?? bp.objects?.[0]?.$type) !== 'EffectBlueprint') {
    notFound.push(name);
    continue;
  }
  for (const ref of emitterRefs(bp)) {
    const key = ref.toLowerCase();
    if (!docs.has(key)) docs.set(key, await src.record(ref));
    if (docs.get(key)?.type === 'EmitterGraph') {
      const near = nearestDocument(src.index, ref);
      if (near && !docs.has(near.name.toLowerCase())) docs.set(near.name.toLowerCase(), await src.record(near.name));
    }
  }
  for (const [k, v] of docs) if (!v) docs.delete(k);
  effects.push(effectJson(bp, docs, src.index));
}

const graphs = effects.filter((fx) => fx.graph).map((fx) => `${fx.name} (${fx.emitters.filter((e) => e.graph).map((e) => `${e.graphOf.split('/').pop()} → ${e.name.split('/').pop()}`).join(', ')})`);
const textures = {};
for (const fx of effects) for (const t of fx.textures) (textures[t] ??= []).push(fx.name);
console.log(`${effects.length} effects read, ${effects.reduce((n, fx) => n + fx.emitters.length, 0)} emitters, ${Object.keys(textures).length} textures`);
if (notFound.length) console.log(`not found: ${notFound.join(', ')}`);
const missing = effects.flatMap((fx) => fx.missing);
if (missing.length) console.log(`emitters missing: ${[...new Set(missing)].join(', ')}`);
console.log(`graph: true (${graphs.length}): ${graphs.join('; ') || 'none'}`);
console.log('kept under raw:');
for (const [k, v] of Object.entries(rawReport(effects))) console.log(`  ${k}: ${v.length} effect${v.length === 1 ? '' : 's'}`);
if (dry) process.exit(0);
mkdirSync(outDir, { recursive: true });
for (const fx of effects) writeFileSync(join(outDir, fileName(fx.path)), `${JSON.stringify(fx)}\n`);
writeFileSync(join(outDir, '_textures.json'), `${JSON.stringify(textures, null, 1)}\n`);
console.log(`wrote ${effects.length} effects and _textures.json to ${outDir}`);

if (argv.includes('--sheets')) await writeSheets(textures, effects);

// ── the sheets ──
async function writeSheets(textures, effects) {
  const root = arg('root');
  if (!root) stop('--sheets reads the export: pass --root');
  const { sharpOf, unpackKtx2 } = await import('./lib/bf2017-textures.mjs');
  const sharp = sharpOf();
  const dir = arg('sheets-out') ?? join(ROOT, 'public/models/galaxy/bf2017/fx');
  const scratch = join(ROOT, 'lab/assets/bf2017/fx-unpacked');
  const manifestFile = join(dir, 'fx.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : { format: 1, sheets: {} };
  const additive = new Set(effects.flatMap((fx) => fx.emitters.filter((e) => e.additive).map((e) => e.texture)));
  const grids = new Map(effects.flatMap((fx) => fx.emitters.map((e) => [e.texture, e.uv.grid])));
  mkdirSync(dir, { recursive: true });
  const absent = [];
  for (const texture of Object.keys(textures)) {
    const found = sheetSources(texture).find((p) => existsSync(join(root, p)));
    if (!found) {
      absent.push(texture);
      continue;
    }
    const png = found.endsWith('.png') ? join(root, found) : await unpackKtx2(join(root, found), scratch);
    const { width, height } = await sharp(png).metadata();
    // (the longer side to the size: a 4 by 1 strip stays a strip)
    const fit = (size) => (width >= height ? { width: size } : { height: size });
    const entry = { stem: sheetFile(texture, 0).replace(/\.0\.webp$/, ''), grid: grids.get(texture) ?? [1, 1], sizes: [], bytes: {}, additive: additive.has(texture), from: found };
    for (const size of sheetSizes(Math.max(width, height))) {
      let q = 86;
      let buf = null;
      while (q >= 40) {
        buf = await sharp(png).resize(fit(size)).webp({ quality: q, alphaQuality: Math.min(100, q + 8) }).toBuffer();
        if (buf.length <= SHEET_CAP) break;
        q -= 8;
      }
      if (buf.length > SHEET_CAP) {
        console.log(`  ${texture} at ${size}: ${(buf.length / 1024).toFixed(0)} KB even at quality 40, left out`);
        continue;
      }
      writeFileSync(join(dir, sheetFile(texture, size)), buf);
      entry.sizes.push(size);
      entry.bytes[size] = buf.length;
    }
    manifest.sheets[texture] = entry;
    console.log(`  ${texture}: ${entry.sizes.map((s) => `${s} ${(entry.bytes[s] / 1024).toFixed(0)} KB`).join(', ')} (from ${found})`);
  }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`);
  if (absent.length) console.log(`no source for ${absent.length}: ${absent.join(', ')}`);
  for (const tier of Object.keys(SHEET_SIZE)) {
    const { bytes, missing } = setWeight(manifest, Object.keys(textures), tier);
    console.log(`  the set at ${tier}: ${(bytes / 1048576).toFixed(2)} MB${bytes > SET_CAP ? ` — over the 6 MB cap by ${((bytes - SET_CAP) / 1048576).toFixed(2)} MB` : ''}${missing.length ? ` (${missing.length} without a sheet)` : ''}`);
  }
  console.log(`wrote ${manifestFile}; next: node scripts/assets-upload.mjs --dry`);
}
