// A published build's ui-data files its bucket prefix lacks, sent without a republish (16 Nov 2026: every /ui-data/backdrop/*.tone.bin was
// a 404 on live because the uploader sent only .json and .png; scripts/lib/bf2web-ui-files.mjs now sends every file). Only keys absent under
// sites/<build>/ui-data/ are put: nothing is overwritten or deleted. The folder must be this build's: every file the bucket already has
// for it must be present here at the same size, else nothing is sent.
//   node --env-file=.env.local scripts/bf2web-ui-data-fill.mjs --build <id> --ui-data <dir> [--dry]
// Prints what is missing and what was sent; exit 0 when the prefix then holds every file of the folder, 1 otherwise, 2 on a usage error.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { objectUrl } from './lib/bucket.mjs';
import { BUCKET, open } from './lib/bf2web-r2.mjs';
import { fillPlan, uiDataFiles, uiDataLeftOut } from './lib/bf2web-ui-files.mjs';

const args = process.argv.slice(2);
const option = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const id = option('--build'), dir = option('--ui-data'), dry = args.includes('--dry');
if (!id || !/^[A-Za-z0-9._-]+$/.test(id) || !dir || !existsSync(dir)) {
  console.error('usage: bf2web-ui-data-fill.mjs --build <id> --ui-data <dir> [--dry]');
  process.exit(2);
}

const prefix = `sites/${id}/ui-data/`;
const r2 = open();
for (const f of uiDataLeftOut(dir)) console.log(`ui-data left out (not a kind that goes up): ${f}`);
const local = uiDataFiles(dir).map((path) => ({ path, size: statSync(join(dir, path)).size }));
const remote = (await r2.files(prefix)).map((f) => ({ key: f.key.slice(prefix.length), size: f.size }));
const { missing, mismatched } = fillPlan(local, remote);
console.log(`${id}: ${local.length} ui-data files here, ${remote.length} in the bucket, ${missing.length} missing`);
if (mismatched.length) {
  console.error(`not this build's ui-data: ${mismatched.length} file(s) differ in size from the bucket's, e.g. ${mismatched[0].path}; nothing sent`);
  process.exit(1);
}
for (const f of missing) console.log(`  ${dry ? 'would send' : 'send'} ${f.path} (${f.size} B)`);
if (dry) process.exit(missing.length ? 1 : 0);
for (const f of missing) {
  const body = readFileSync(join(dir, f.path));
  const r = await r2.fetch(objectUrl(BUCKET, prefix + f.path), {
    method: 'PUT', body, headers: { 'content-type': 'application/octet-stream', 'content-md5': createHash('md5').update(body).digest('base64') },
  });
  if (!r.ok) { console.error(`put ${prefix}${f.path}: HTTP ${r.status}`); process.exit(1); }
}
const after = new Set((await r2.files(prefix)).map((f) => f.key.slice(prefix.length)));
const still = local.filter((f) => !after.has(f.path));
console.log(`${id}: sent ${missing.length}; ${still.length ? still.length + ' still missing' : 'every ui-data file is in the bucket'}`);
process.exit(still.length ? 1 : 0);
