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
// With the uploader's record here (the desktop's), a texture the ledger has
// as used and the record never sent goes too: the ledger counts a map a used
// model binds as used by that model's consumer whether or not its file went
// up, so a map no pass sent is in no bucket and no pack (the Lucrehulk's hull
// maps and the Star Destroyer's panel normal, 2026-10-25), and nothing but
// this asks for it.
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
import { LANES, OWNERS } from '../lib/bf2017-owners.mjs';
import { encodeAndUpload, encodeClass, jsonLines, ktxOf, ledgerAgain, runCli, textureIndexFile } from './bf2017-desk.mjs';
import { atlasKind } from './bf2017-atlases.mjs';

export const LEDGER = 'docs/superpowers/evidence/bf2017-coverage/ledger.json.gz';
export const MAX = 2048;

export const ledgerRows = (root) => JSON.parse(gunzipSync(readFileSync(join(root, LEDGER))).toString('utf8'));

// The rows to send: not uploaded, textures, not an atlas, not the sequel
// era's; and a used one the uploader never sent, where `unsent` can say
export const wanted = (rows, { unsent = null } = {}) =>
  rows.filter((r) => r.part === 'textures' && !atlasKind(r.name) && !isSequel(r.name) && (r.state === 'not-uploaded' || (r.state === 'used' && Boolean(unsent?.(r.name)))));

// Whether the uploader's record (web_opt/upload_state.tsv: a bucket path
// under web/ a line, then its bytes) lacks a texture's file, its KTX2 or
// itself, by its name in the index; null where there's no record or index
export function unsentBy(state, index) {
  if (!state || !index) return null;
  const sent = new Set(
    state
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t')[0].trim().replace(/^web\//, '').toLowerCase()),
  );
  const files = new Map(index.map((t) => [t.name.toLowerCase(), t.file]));
  return (name) => {
    const file = files.get(name.toLowerCase());
    return Boolean(file) && !sent.has(ktxOf(file).toLowerCase()) && !sent.has(file.toLowerCase());
  };
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
  async plan({ root, d }) {
    const file = textureIndexFile(d, root);
    const index = file ? jsonLines(file) : null;
    const record = join(d.webOpt, 'upload_state.tsv');
    const unsent = unsentBy(existsSync(record) ? readFileSync(record, 'utf8') : null, index);
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
        unsent ? `${usedUnsent} used by a pack's model and never sent (the uploader's record has no file of them)` : "no uploader's record here (web_opt/upload_state.tsv): the used maps it never sent are found on the desktop",
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
