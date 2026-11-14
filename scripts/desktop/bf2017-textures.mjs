// Lane W's `textures` job (the picture-everywhere design, §7; the plan's
// task 4): the textures the coverage ledger has as `not-uploaded` (the
// export indexes them, the bucket has none of their files: 4,149 rows on
// 2026-10-11), encoded with the export's own encoder and sent with its own
// uploader, as lane D's pass sent the rest. The Enlighten atlases among them
// are the `atlases` job's and are left to it.
//
//   ledger rows (docs/superpowers/evidence/bf2017-coverage/ledger.json.gz,
//   state not-uploaded, part textures) → the export's index (web/textures.jsonl)
//   → tool/ktx2_encode.py --list (ETC1S colour, UASTC the rest, at most 2,048)
//   → scripts/bucket-put.mjs → the ledger made again from the uploader's record
//
//   node scripts/desktop/bf2017-textures.mjs [--dry] [--only fx/decals] [--limit N] [--no-pr]
//
// A texture the ledger has as used and the bucket has no file of goes too:
// the ledger counts a map a used model binds as used by that model's
// consumer whether or not its file went up, so a map no pass sent, or one
// R2's copy of the Supabase bucket left behind, is in no bucket and no pack
// (the Lucrehulk's hull maps, the Star Destroyer's panel normal, 2026-10-25),
// and nothing but this asks for it. What the bucket has is asked of R2
// itself (docs/stack/cloudflare.md: a listing of web/textures/, with the
// runner's keys); without keys, of the uploader's record (web_opt/
// upload_state.tsv), which still lists what only Supabase held. A map is
// had when any of its files is, its derived ones (__normal, __orm_…) as the
// ledger counts them: a normal-packed map went up as those alone. The dry
// run says how many there are and whose word it took; --only names the few
// a change needs (lucrehulkclass_droidbattleship, stardestroyer_paneltile_01_n).
//
// The dry run says how many of them have an owner waiting (scripts/lib/
// bf2017-owners.mjs) once they land, and how many would land unowned: the
// coverage check fails on an unowned row, so those need a lane first.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isSequel } from '../lib/bf2017-manifest.mjs';
import { ownerOf } from '../lib/bf2017-coverage.mjs';
import { bucketEnv, list } from '../lib/bucket.mjs';
import { LANES, OWNERS } from '../lib/bf2017-owners.mjs';
import { encodeAndUpload, encodeClass, jsonLines, ledgerAgain, runCli, textureIndexFile } from './bf2017-desk.mjs';
import { atlasKind } from './bf2017-atlases.mjs';

export const LEDGER = 'docs/superpowers/evidence/bf2017-coverage/ledger.json.gz';
export const MAX = 2048;

export const ledgerRows = (root) => JSON.parse(gunzipSync(readFileSync(join(root, LEDGER))).toString('utf8'));

// The rows to send: not uploaded, textures, not an atlas, not the sequel
// era's; and a used one the bucket has no file of, where `unsent` can say
export const wanted = (rows, { unsent = null } = {}) =>
  rows.filter((r) => r.part === 'textures' && !atlasKind(r.name) && !isSequel(r.name) && (r.state === 'not-uploaded' || (r.state === 'used' && Boolean(unsent?.(r.name)))));

// A bucket path or an index file as one map: lowercase, '/', under web/ no
// more, no extension, no derived suffix (the coverage ledger's own reading)
export const stemOf = (path) =>
  String(path)
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/^web\//, '')
    .replace(/(\.gz)?$/, '')
    .replace(/\.(ktx2|png|dds|tga|exr|hdr)$/, '')
    .replace(/__(normal|orm_[0-9a-z]+)$/, '');

// The paths the uploader's record lists (a bucket path a line, then its bytes)
export const recordPaths = (text) =>
  String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.split('\t')[0].trim())
    .filter(Boolean);

// Whether the bucket has no file of a texture, by its name in the index,
// given the paths it has (R2's listing, or the record's); null where there's
// no listing or no index
export function unsentBy(paths, index) {
  if (!paths || !index) return null;
  const had = new Set([...paths].map(stemOf));
  const files = new Map(index.map((t) => [t.name.toLowerCase(), t.file]));
  return (name) => {
    const file = files.get(name.toLowerCase());
    return Boolean(file) && !had.has(stemOf(file));
  };
}

// What the bucket has under web/textures/: R2's listing with the keys, else
// the uploader's record, else nothing ({ paths, from })
export async function bucketTextures(d, env, { listBucket = list } = {}) {
  const bucket = bucketEnv(env ?? {});
  if (bucket) {
    try {
      const { files } = await listBucket(bucket.fetch, 'bf2017-assets', 'web/textures/');
      return { paths: files.map((f) => f.key), from: `R2's listing of bf2017-assets/web/textures/ (${files.length} objects)` };
    } catch (e) {
      // (the record, said so, where R2 can't be listed)
      const record = join(d.webOpt, 'upload_state.tsv');
      if (existsSync(record)) return { paths: recordPaths(readFileSync(record, 'utf8')), from: `the uploader's record (R2's listing failed: ${e.message})` };
      return { paths: null, from: `nothing (R2's listing failed: ${e.message}; no uploader's record)` };
    }
  }
  const record = join(d.webOpt, 'upload_state.tsv');
  if (existsSync(record)) return { paths: recordPaths(readFileSync(record, 'utf8')), from: "the uploader's record (no R2 keys here: it still lists what only Supabase held)" };
  return { paths: null, from: null };
}

// Each wanted row with its file in the index, or why it has none; and the
// lane that takes it once it lands (null: it would land unowned).
export function withFiles(rows, index, owners = OWNERS) {
  const byName = new Map((index ?? []).map((t) => [t.name.toLowerCase(), t]));
  return rows.map((r) => {
    const t = byName.get(r.name.toLowerCase());
    const owner = ownerOf({ part: 'textures', name: r.name, files: t ? [t.file] : [] }, owners)?.lane ?? null;
    return { name: r.name, file: t?.file ?? null, size: t ? `${t.width}×${t.height}` : null, format: t?.format ?? null, srgb: t?.srgb ?? false, class: t ? encodeClass(t) : null, owner, top: r.name.split('/').slice(0, 2).join('/') };
  });
}

// How many by a key, the largest first: [[key, n]]
export const countBy = (items, key) =>
  Object.entries(items.reduce((m, i) => ({ ...m, [i[key] ?? '(none)']: (m[i[key] ?? '(none)'] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

export const spec = {
  job: 'textures',
  title: 'The not-uploaded textures in the bucket',
  vram: 2048,
  columns: ['name', 'size', 'format', 'class', 'owner'],
  needs: (d) => [
    { name: 'the export', file: d.root, fix: 'set BF2_EXPORT to the export folder (BF2_Extract)' },
    { name: "the export's texture index", file: join(d.web, 'textures.jsonl'), fix: 'the export writes web/textures.jsonl' },
    { name: 'python', cmd: d.python, fix: 'Python 3 on PATH (or set PYTHON)' },
    { name: "the export's encoder", file: join(d.tool, 'ktx2_encode.py'), fix: 'the export keeps tool/ktx2_encode.py' },
    { name: "the uploader's record", file: join(d.webOpt, 'upload_state.tsv'), fix: 'the uploader keeps web_opt/upload_state.tsv (the ledger is made again from it)' },
    { name: "the bucket's keys", keys: true, fix: "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (R2's S3 keys) in the runner's .env (~\\actions-runner\\.env), then restart the runner" },
  ],
  async plan({ root, d, env }) {
    const file = textureIndexFile(d, root);
    const index = file ? jsonLines(file) : null;
    const had = await bucketTextures(d, env);
    const unsent = unsentBy(had.paths, index);
    const ledger = ledgerRows(root);
    const rows = wanted(ledger, { unsent });
    const items = withFiles(rows, index);
    const usedUnsent = rows.filter((r) => r.state === 'used').length;
    const unowned = items.filter((i) => !i.owner).length;
    const merged = new Set(LANES.filter((l) => l.merged).map((l) => l.lane));
    const stale = items.filter((i) => merged.has(i.owner));
    return {
      items,
      notes: [
        `${rows.length - usedUnsent} rows not uploaded (${LEDGER}, less the atlases and the sequel era's)`,
        unsent ? `${usedUnsent} used by a pack's model with no file in the bucket, by ${had.from}${usedUnsent > 100 ? ': many, so --only the ones a change needs' : ''}` : "no R2 keys nor uploader's record here: the used maps the bucket hasn't got are found on the desktop",
        file ? `${items.filter((i) => i.file).length} have a file in the index (${file}); ${items.filter((i) => !i.file).length} have none` : 'no texture index here (web/textures.jsonl): the files are found on the desktop',
        `once uploaded: ${items.length - unowned} owned (${countBy(items.filter((i) => i.owner), 'owner')
          .slice(0, 6)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}), ${unowned} with no lane, ${stale.length} owned by a lane that has merged (${countBy(stale, 'owner')
          .map(([k, n]) => `${k} ${n}`)
          .join(', ') || 'none'}): the coverage check fails on both kinds until \`scripts/lib/bf2017-owners.mjs\` names a lane that will use them`,
        `the most, by folder: ${countBy(items, 'top')
          .slice(0, 6)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}`,
      ],
    };
  },
  async run(items, { root, d, env, log }) {
    const sendable = items.filter((i) => i.file);
    const { made, failed } = encodeAndUpload(sendable, { d, env, log, list: 'textures', max: MAX });
    const check = ledgerAgain(root, d, { env, log });
    const dir = join(root, 'docs/superpowers/evidence/bf2017-picture/w/textures');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'made.json'), `${JSON.stringify({ _source: "scripts/desktop/bf2017-textures.mjs on the owner's desktop: the export's encoder and uploader on the ledger's not-uploaded textures", at: new Date().toISOString(), uploaded: made.length, failed: failed.map((t) => t.name), noFile: items.filter((i) => !i.file).map((i) => i.name) }, null, 1)}\n`);
    const report = [`Encoded and uploaded ${made.length} of ${items.length}${failed.length ? `; **${failed.length} failed** (made.json)` : ''}${items.length - sendable.length ? `; ${items.length - sendable.length} have no file in the index` : ''}.`, check].join('\n\n');
    return { files: ['docs/superpowers/evidence/bf2017-coverage'], report, failed: failed.length > 0 && !made.length };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
