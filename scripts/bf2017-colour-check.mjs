// Holds the game's textures on the site to their colour spaces: every KTX2
// under the published packs (public/models/galaxy/bf2017/**/tex/) and any
// folder named must say what it is (scripts/lib/ktx2-colour.mjs: a colour map
// sRGB, a data map linear, by DICE's suffixes), and every surface role made
// from the game (public/textures/galaxy/bf2017/<role>/) must have its three
// maps and its index row. A map tagged wrong is read wrong by every loader
// that trusts the file (three's KTX2Loader does), and came out washed pale.
//
//   node scripts/bf2017-colour-check.mjs [--check] [--fix] [--formats <textures.jsonl>] [--packs] [--published [--base <url>]] [folder …]
//
//   check     exit 1 on any map tagged wrong, or a role short of a map
//   fix       stamp the right transfer function into each wrong file in
//             place (a byte; nothing re-encoded) and say how many
//   formats   the bucket's web/textures.jsonl (fetched: `node scripts/bf2017-fetch.mjs --raw textures.jsonl`):
//             each map's own `srgb` flag (the game's word) decides ahead of
//             the suffix rule, and a map the rule calls unknown gets its
//             answer from here; without the flag, lab/assets/bf2017/web/
//             textures.jsonl is read when it is there
//   packs     write the game's word into each level pack's level.json and
//             recipes.json `tex` rows (`srgb: true | false` per slug), which
//             the loader obeys (levelGltf.js); with --fix the files too
//   published the KTX2 files src/data/galaxyAssets.json names (the crew's maps,
//             the published packs), each asked for its first kilobyte at its
//             public URL (the DFD is in the header), audited the same way;
//             --base the bucket (else VITE_ASSET_BASE / ASSET_BASE, else the
//             project's site-assets from SUPABASE_URL). Read-only: a wrong
//             published file is re-made by its writer and published again
//
// One line a folder (files, colour sRGB/linear, data linear/sRGB, unknown,
// wrong), one a wrong file, one summary; exit 1 only with --check.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { auditKtx2, gameWord, loadGameWord, summarise, wantedTransfer, withTransfer } from './lib/ktx2-colour.mjs';
import { readManifest } from './lib/asset-manifest.mjs';
import { remotePath } from '../src/lib/assetPath.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PACKS = 'public/models/galaxy/bf2017';
const ROLES = 'public/textures/galaxy/bf2017';
const ROLE_MAPS = ['color.webp', 'normal.webp'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.ktx2')) out.push(p);
  }
  return out;
}

// the game's own word on a map, from textures.jsonl (ktx2-colour.mjs's gameWord), as 'srgb' | 'linear'
export function formatsOf(jsonl) {
  return new Map([...gameWord(jsonl)].map(([k, v]) => [k, v ? 'srgb' : 'linear']));
}

// The game's word written into a pack: each `tex` row gains `srgb` (true or
// false) from textures.jsonl by its slug, a derived map false, a slug the
// game does not list by the suffix rule, an unknown left without. The
// loader reads it (levelGltf.js). Returns the counts.
export function stampPackRows(tex, word) {
  const n = { srgb: 0, linear: 0, unknown: 0, game: 0 };
  for (const [slug, row] of Object.entries(tex ?? {})) {
    if (!row || typeof row !== 'object') continue;
    const want = wantedTransfer(slug, { word });
    if (want == null) {
      n.unknown++;
      continue;
    }
    if (word?.has(slug.replace(/__(normal|orm_[0-9a-f]+)$/, '').replace(/_\d+$/, ''))) n.game++;
    row.srgb = want === 'srgb';
    n[want]++;
  }
  return n;
}

export function auditFolder(dir, { formats = null, fix = false } = {}) {
  const rows = [];
  let fixed = 0;
  for (const file of walk(dir)) {
    const buf = readFileSync(file);
    const name = relative(ROOT, file);
    const row = auditKtx2(name, buf, { word: formats });
    if (!row.ok && fix) {
      writeFileSync(file, withTransfer(buf, row.wanted));
      row.transfer = row.wanted;
      row.ok = true;
      row.fixed = true;
      fixed++;
    }
    rows.push(row);
  }
  return { rows, fixed, summary: summarise(rows) };
}

// every role in the index has its maps on disk, and every folder its row
export function auditRoles(dir) {
  const problems = [];
  const indexFile = join(dir, 'index.json');
  if (!existsSync(indexFile)) return { roles: 0, problems: [`${relative(ROOT, dir)}: no index.json`] };
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  for (const [role, row] of Object.entries(index)) {
    for (const m of [...ROLE_MAPS, ...(row.arm ? ['arm.webp'] : [])]) if (!existsSync(join(dir, role, m))) problems.push(`${role}: ${m} missing`);
    if (row.license !== 'permission' || !row.authors?.includes('EA DICE')) problems.push(`${role}: not credited as EA DICE’s, used with permission`);
    if (!(row.metres > 0) || !(row.mean > 0 && row.mean <= 1)) problems.push(`${role}: metres or mean out of range`);
  }
  for (const f of readdirSync(dir)) {
    if (f === 'index.json' || f === 'light' || !statSync(join(dir, f)).isDirectory()) continue;
    if (!index[f]) problems.push(`${f}: a folder with no index row`);
  }
  return { roles: Object.keys(index).length, problems };
}

// the published KTX2 files, each audited from its header: get(url) → Buffer
// of its first bytes (a range request), or null when it cannot be had
export async function auditPublished(manifest, base, get, { at = 8 } = {}) {
  const rows = [];
  const missing = [];
  const paths = Object.keys(manifest).filter((p) => p.endsWith('.ktx2'));
  for (let i = 0; i < paths.length; i += at) {
    await Promise.all(
      paths.slice(i, i + at).map(async (path) => {
        const url = remotePath(path, base, manifest);
        const head = await get(url).catch(() => null);
        if (!head) {
          missing.push(path);
          return;
        }
        try {
          rows.push(auditKtx2(path, head));
        } catch (e) {
          missing.push(`${path} (${e.message})`);
        }
      }),
    );
  }
  return { rows, missing, summary: summarise(rows) };
}

const headBytes = async (url) => {
  const res = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const formats = args.formats ? gameWord(readFileSync(resolve(args.formats), 'utf8')) : loadGameWord(join(ROOT, 'lab', 'assets', 'bf2017'));
  if (formats) console.log(`the game's word: ${formats.size} maps (textures.jsonl)`);
  if (args.packs) {
    for (const dir of readdirSync(join(ROOT, PACKS, 'levels'))) {
      for (const f of ['level.json', 'recipes.json']) {
        const file = join(ROOT, PACKS, 'levels', dir, f);
        if (!existsSync(file)) continue;
        const json = JSON.parse(readFileSync(file, 'utf8'));
        const n = stampPackRows(json.tex, formats);
        writeFileSync(file, `${JSON.stringify(json)}\n`);
        console.log(`${relative(ROOT, file).padEnd(40)} tex rows: sRGB ${n.srgb} linear ${n.linear} unknown ${n.unknown} (${n.game} by the game's word)`);
      }
    }
  }
  const folders = args._.length ? args._.map((f) => resolve(f)) : [join(ROOT, PACKS)];
  let wrong = 0;
  for (const dir of folders) {
    const { summary: s, fixed, rows } = auditFolder(dir, { formats, fix: Boolean(args.fix) });
    console.log(`${relative(ROOT, dir).padEnd(40)} ${String(s.files).padStart(5)} files  colour sRGB ${s.colour.srgb} linear ${s.colour.linear}  data linear ${s.data.linear} sRGB ${s.data.srgb}  unknown ${s.unknown}  wrong ${s.wrong.length}${fixed ? `  fixed ${fixed}` : ''}`);
    for (const r of rows.filter((x) => !x.ok)) console.log(`  wrong  ${r.name}: ${r.kind} tagged ${r.transfer}, wants ${r.wanted}`);
    wrong += s.wrong.length;
  }
  if (args.published) {
    const base = args.base ?? process.env.VITE_ASSET_BASE ?? process.env.ASSET_BASE ?? (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/storage/v1/object/public/site-assets` : null);
    if (!base) {
      console.error('No base for the published files: --base, VITE_ASSET_BASE, ASSET_BASE or SUPABASE_URL.');
      process.exit(2);
    }
    const { summary: s, missing, rows } = await auditPublished(readManifest(join(ROOT, 'src/data/galaxyAssets.json')), base, headBytes);
    console.log(`${'published (galaxyAssets.json)'.padEnd(40)} ${String(s.files).padStart(5)} files  colour sRGB ${s.colour.srgb} linear ${s.colour.linear}  data linear ${s.data.linear} sRGB ${s.data.srgb}  unknown ${s.unknown}  wrong ${s.wrong.length}  unreachable ${missing.length}`);
    for (const r of rows.filter((x) => !x.ok)) console.log(`  wrong  ${r.name}: ${r.kind} tagged ${r.transfer}, wants ${r.wanted} (re-make it with its writer and publish)`);
    for (const m of missing) console.log(`  unreachable  ${m}`);
    wrong += s.wrong.length + missing.length;
  }
  const roles = auditRoles(join(ROOT, ROLES));
  console.log(`${ROLES.padEnd(40)} ${String(roles.roles).padStart(5)} roles  ${roles.problems.length ? roles.problems.length + ' problems' : 'whole'}`);
  for (const p of roles.problems) console.log(`  ${p}`);
  const bad = wrong + roles.problems.length;
  console.log(bad ? `${bad} wrong${args.fix ? ' (after the fix: the unknown ones, which --formats decides)' : ''}` : 'every map says what it is');
  if (args.check && bad) process.exit(1);
}
