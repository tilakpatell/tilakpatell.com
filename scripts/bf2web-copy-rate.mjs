// The copy pool's rate test (bf2web-upload.mjs BF2WEB_COPY_STREAMS): server-side copies of a released build's small objects into a scratch
// prefix nothing serves, at each stream count, the way the uploader copies them (copyUploadHeaders, attemptUpload, completeUploadResponse).
// For each count: copies a second, retries, throttling answers (429 / 503 / SlowDown), and every copy checked against the source's
// manifest (size) and the source object (ETag). Then every scratch object is removed (lib/bucket.mjs remove) and the scratch prefix listed
// empty. What it writes: only scratch/copy-rate-<run>/<streams>/<path>; it reads sites/<from>/; play.json, the pointer and every sites/
// prefix are untouched. Exit 1 on any failed copy, mismatch, throttling answer or leftover.
//   node scripts/bf2web-copy-rate.mjs --from <build id> [--count 600] [--streams 8,16,32]
import { list, objectUrl, encodePath, remove } from './lib/bucket.mjs';
import { BUCKET, open } from './lib/bf2web-r2.mjs';
import { attemptUpload, completeUploadResponse, copyUploadHeaders } from './lib/bf2web-upload-response.mjs';

const args = process.argv.slice(2);
const option = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const from = option('--from') || process.env.BF2WEB_PREVIOUS;
if (!from || !/^[A-Za-z0-9._-]+$/.test(from)) { console.error('--from <build id>'); process.exit(2); }
const count = Number(option('--count', '600')), streams = String(option('--streams', '8,16,32')).split(',').map(Number);
const r2 = open();
const scratch = `scratch/copy-rate-${process.env.GITHUB_RUN_ID || Date.now()}/`;
if (!scratch.startsWith('scratch/') || scratch.startsWith('sites/')) throw new Error('scratch prefix');
const manifest = await r2.json(`sites/${from}/manifest.json`);
if (!manifest) throw new Error(`no manifest for ${from}`);
// ([c5]: a '..', '.' or empty segment would be normalised by the URL and could land outside scratch/: refused for any build)
for (const e of manifest.entries) if (String(e.path).split('/').some((s) => s === '..' || s === '.' || !s)) throw new Error(`manifest path refused: ${e.path}`);
const small = manifest.entries.filter((e) => e.bytes > 0 && e.bytes < 6e6);
if (small.length < count * streams.length) throw new Error(`only ${small.length} small objects`);
const etagOf = async (key) => { const r = await r2.fetch(objectUrl(BUCKET, key), { method: 'HEAD' }); return r.ok ? r.headers.get('etag') : null; };

const results = [];
let offset = 0, failed = false;
for (const s of streams) {
  const items = small.slice(offset, offset + count); offset += count;
  const queue = [...items], throttled = [], errors = [];
  let tries = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: s }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const key = `${scratch}${s}/${e.path}`;
      try {
        await attemptUpload(`copy ${key}`, async () => {
          tries++;
          const r = await r2.fetch(objectUrl(BUCKET, key), { method: 'PUT', headers: copyUploadHeaders(`/${BUCKET}/${encodePath(`sites/${from}/${e.path}`)}`) });
          // (a throttling answer: HTTP 429/503, or SlowDown inside a 200 or an error body; counted, then retried as the uploader retries)
          try { await completeUploadResponse(r, { copy: true }); } catch (error) { if (/HTTP (429|503)|SlowDown/.test(error.message)) throttled.push(error.message.slice(0, 60)); throw error; }
        });
      } catch (error) { errors.push(`${e.path}: ${error.message}`); }
    }
  }));
  const seconds = (Date.now() - t0) / 1000;
  // every copy: its size by the manifest, its ETag the source's
  const listed = new Map((await list(r2.fetch, BUCKET, `${scratch}${s}/`)).files.map((f) => [f.key, f.size]));
  const mismatched = [];
  for (let i = 0; i < items.length; i += 16) {
    await Promise.all(items.slice(i, i + 16).map(async (e) => {
      const key = `${scratch}${s}/${e.path}`;
      if (listed.get(key) !== e.bytes) { mismatched.push(`${e.path}: size ${listed.get(key)} not ${e.bytes}`); return; }
      const [a, b] = await Promise.all([etagOf(`sites/${from}/${e.path}`), etagOf(key)]);
      if (!a || a !== b) mismatched.push(`${e.path}: etag ${b} not ${a}`);
    }));
  }
  const row = { streams: s, objects: items.length, seconds: Math.round(seconds * 10) / 10, perSecond: Math.round(items.length / seconds * 10) / 10,
    retries: tries - items.length, throttled: throttled.length, errors: errors.length, mismatched: mismatched.length, sample: [...errors, ...mismatched].slice(0, 3) };
  results.push(row);
  console.log(JSON.stringify(row));
  if (errors.length || mismatched.length || throttled.length) failed = true;
}
// the scratch prefix removed, then listed empty
const left = (await list(r2.fetch, BUCKET, scratch)).files;
for (let i = 0; i < left.length; i += 16) await Promise.all(left.slice(i, i + 16).map((f) => remove(r2.fetch, BUCKET, f.key)));
const after = (await list(r2.fetch, BUCKET, scratch)).files.length;
console.log(JSON.stringify({ from, scratch, removed: left.length, leftover: after, results }));
if (after) failed = true;
process.exit(failed ? 1 : 0);
