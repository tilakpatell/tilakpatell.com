// Uploads an exported bf2-web play site to the private bucket as sites/<build>/ (docs/decisions/2026-10-28-bf2web-
// pipeline.md). A file the previous build has byte for byte (the manifests' sha256) is copied inside R2, not sent
// again: a new build of the engine is some 100 MB to send, not the whole 2.2 GB. A file already there at its size is
// skipped, so an upload cut off is run again from where it stopped. The manifest goes last: its presence is what says
// the build is whole (scripts/bf2web-adopt.mjs). The site's rulebooks, when the export has them beside it, go to
// sites/<build>/ui-data/.
//
//   node --env-file=.env.local scripts/bf2web-upload.mjs <site dir> --build <id> [--previous <id>] [--ui-data <dir>] [--dry]
//     --previous: the build to copy from (default: the one src/data/bf2web/play.json names)

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePath, objectUrl } from './lib/bucket.mjs';
import { BUCKET, open } from './lib/bf2web-r2.mjs';
import { contractProblems, uploadPlan } from './lib/bf2web-site.mjs';
import { attemptUpload, completeUploadResponse } from './lib/bf2web-upload-response.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const dir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const id = option('--build');
const dry = args.includes('--dry');
if (!dir || !id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('usage: bf2web-upload.mjs <site dir> --build <id> [--previous <id>] [--ui-data <dir>] [--dry]');

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const problems = contractProblems(manifest);
if (problems.length) throw new Error(`the site at ${dir} breaks the contract:\n  - ${problems.join('\n  - ')}`);

const r2 = open();
const previousId = option('--previous') ?? JSON.parse(readFileSync(join(ROOT, 'src/data/bf2web/play.json'), 'utf8')).build;
const previous = previousId && previousId !== id ? await r2.json(`sites/${previousId}/manifest.json`) : null;
const prefix = `sites/${id}/`;
const plan = uploadPlan(manifest, { prefix, previous, previousPrefix: previous ? `sites/${previousId}/` : null, existing: await r2.files(prefix) });
const uiDir = option('--ui-data');
if (uiDir && existsSync(uiDir)) for (const f of readdirSync(uiDir).filter((n) => n.endsWith('.json'))) plan.splice(-1, 0, { action: 'put', key: `${prefix}ui-data/${f}`, file: join(uiDir, f) });

const count = (a) => plan.filter((p) => p.action === a).length;
const bytesOf = (p) => manifest.entries.find((e) => e.path === p.path)?.bytes ?? 0;
console.log(`${id}: ${count('put')} to send (${Math.round(plan.filter((p) => p.action === 'put').reduce((n, p) => n + bytesOf(p), 0) / 1e6)} MB), ${count('copy')} copied from ${previousId ?? 'none'}, ${count('skip')} already there`);
if (dry) process.exit(0);

async function send(p) {
  if (p.action === 'skip') return;
  const url = objectUrl(BUCKET, p.key);
  const init =
    p.action === 'copy'
      ? { method: 'PUT', headers: { 'x-amz-copy-source': `/${BUCKET}/${encodePath(p.from)}` } }
      : (() => {
          const body = readFileSync(p.file ?? join(dir, p.path));
          return { method: 'PUT', body, headers: { 'content-md5': createHash('md5').update(body).digest('base64'), 'content-type': 'application/octet-stream' } };
        })();
  await attemptUpload(`${p.action} ${p.key}`, async () => {
    const r = await r2.fetch(url, init);
    await completeUploadResponse(r, { copy: p.action === 'copy' });
  });
}

const last = plan.pop();
let done = 0;
const queue = [...plan];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      await send(p);
      if (++done % 250 === 0) console.log(`  ${done} of ${plan.length}`);
    }
  }),
);
await send(last);
console.log(`${id}: uploaded, its manifest last`);
