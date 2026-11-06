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
import { existsSync, readFileSync } from 'node:fs';
import { uiDataFiles } from './lib/bf2web-ui-files.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePath, objectUrl } from './lib/bucket.mjs';
import { BUCKET, open } from './lib/bf2web-r2.mjs';
import { contractProblems, uploadPlan } from './lib/bf2web-site.mjs';
import { attemptUpload, completeUploadResponse, copyUploadHeaders } from './lib/bf2web-upload-response.mjs';

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
// (BF2WEB_PREVIOUS: the workflow's publish input previous, for a re-publish of a build whose files are mostly up already)
const previousId = option('--previous') || process.env.BF2WEB_PREVIOUS || JSON.parse(readFileSync(join(ROOT, 'src/data/bf2web/play.json'), 'utf8')).build;
const previous = previousId && previousId !== id ? await r2.json(`sites/${previousId}/manifest.json`) : null;
const prefix = `sites/${id}/`;
const previousPrefix = previous ? `sites/${previousId}/` : null;
const [existing, previousExisting] = await Promise.all([r2.files(prefix), previousPrefix ? r2.files(previousPrefix) : []]);
const plan = uploadPlan(manifest, { prefix, previous, previousPrefix, existing, previousExisting });
const uiDir = option('--ui-data');
if (uiDir && existsSync(uiDir)) for (const f of uiDataFiles(uiDir)) plan.splice(-1, 0, { action: 'put', key: `${prefix}ui-data/${f}`, file: join(uiDir, f) });

const count = (a) => plan.filter((p) => p.action === a).length;
const bytesOf = (p) => manifest.entries.find((e) => e.path === p.path)?.bytes ?? 0;
console.log(`${id}: ${count('put')} to send (${Math.round(plan.filter((p) => p.action === 'put').reduce((n, p) => n + bytesOf(p), 0) / 1e6)} MB), ${count('copy')} copied from ${previousId ?? 'none'}, ${count('skip')} already there`);
if (dry) process.exit(0);

// A large file goes up as an S3 multipart upload in 16 MB parts, each part with attemptUpload's tries: one 188 MB PUT
// (r1057's cooked-programs.json) had its connection reset on every attempt, sent alone or among the pool's streams.
const PART = 5 * 1024 * 1024;
async function sendMultipart(p) {
  const url = objectUrl(BUCKET, p.key);
  const body = readFileSync(p.file ?? join(dir, p.path));
  const created = await attemptUpload(`create ${p.key}`, async () => {
    const r = await r2.fetch(`${url}?uploads`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' } });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0, 200)}`);
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(text)?.[1];
    if (!uploadId) throw new Error('CreateMultipartUpload returned no UploadId');
    return uploadId;
  });
  const parts = [];
  for (let n = 1, at = 0; at < body.length; n++, at += PART) {
    const chunk = body.subarray(at, Math.min(at + PART, body.length));
    const etag = await attemptUpload(`part ${n} of ${p.key}`, async () => {
      const r = await r2.fetch(`${url}?partNumber=${n}&uploadId=${encodeURIComponent(created)}`, {
        method: 'PUT', body: chunk, headers: { 'content-md5': createHash('md5').update(chunk).digest('base64') },
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0, 200)}`);
      const e = r.headers.get('etag');
      if (!e) throw new Error('UploadPart returned no ETag');
      return e;
    });
    parts.push(`<Part><PartNumber>${n}</PartNumber><ETag>${etag}</ETag></Part>`);
    if (n % 8 === 0) console.log(`  ${p.key}: part ${n} of ${Math.ceil(body.length / PART)} sent`);
  }
  await attemptUpload(`complete ${p.key}`, async () => {
    const r = await r2.fetch(`${url}?uploadId=${encodeURIComponent(created)}`, {
      method: 'POST', body: `<CompleteMultipartUpload>${parts.join('')}</CompleteMultipartUpload>`, headers: { 'content-type': 'application/xml' },
    });
    const text = await r.text();
    if (!r.ok || /<Error>/.test(text)) throw new Error(`HTTP ${r.status} ${text.slice(0, 200)}`);
  });
}

async function send(p) {
  if (p.action === 'skip') return;
  const url = objectUrl(BUCKET, p.key);
  const init =
    p.action === 'copy'
      ? { method: 'PUT', headers: copyUploadHeaders(`/${BUCKET}/${encodePath(p.from)}`, p.replaceMetadata) }
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
// Large files go first, one at a time with the rest of the link to themselves: sent among 7 other streams, a 100+ MB
// PUT has its connection reset (r1057's 188 MB cooked-programs.json, UND_ERR_SOCKET on every try), and one file that
// fails its attempts ends the run. Each gets up to three rounds of attemptUpload's tries.
const LARGE = 6e6;
const sizeOf = (p) => (p.action === 'put' ? (p.path ? bytesOf(p) : 0) : 0);
for (const p of plan.filter((q) => sizeOf(q) > LARGE)) {
  for (let round = 1; ; round++) {
    try { await sendMultipart(p); break; } catch (error) { if (round === 10) throw error; await new Promise((r) => setTimeout(r, 5000 * round)); console.log(`  ${p.key}: ${error.message}, again`); }
  }
  done++;
  console.log(`  large ${p.key} (${Math.round(sizeOf(p) / 1e6)} MB) sent`);
}
const queue = plan.filter((q) => !(sizeOf(q) > LARGE));
await Promise.all(
  // Four streams, each file with up to three rounds of attemptUpload's tries: r1057's run lost a 1 MB file to
  // three resets in a row once the large ones were up.
  Array.from({ length: 4 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      for (let round = 1; ; round++) {
        try { await send(p); break; } catch (error) { if (round === 6) throw error; await new Promise((r) => setTimeout(r, 3000 * round)); console.log(`  ${p.key}: ${error.message}, again`); }
      }
      if (++done % 250 === 0) console.log(`  ${done} of ${plan.length}`);
    }
  }),
);
await send(last);
console.log(`${id}: uploaded, its manifest last`);
