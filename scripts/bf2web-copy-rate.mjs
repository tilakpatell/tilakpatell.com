// The copy pool's rate test (bf2web-upload.mjs BF2WEB_COPY_STREAMS): server-side copies of a released build's small objects into a scratch
// prefix nothing serves, at each stream count, the way the uploader copies them (copyUploadHeaders, attemptUpload, completeUploadResponse).
// For each count: copies a second, transport resets (ECONNRESET / fetch failed, each retried as the uploader retries), throttling answers
// (429 / 503 / SlowDown), and every copy checked against the source's manifest (size) and the source object (ETag); the count's line is
// printed before the next count starts. In every case (finally), every object under scratch/copy-rate- is removed (lib/bucket.mjs remove:
// this run's and any an earlier run left) and the prefix listed empty. What it writes: only scratch/copy-rate-<run>/<streams>/<path>; it
// reads sites/<from>/; play.json, the pointer and every sites/ prefix are untouched. Exit 1 on any failed copy, mismatch, throttling answer,
// copy-side transport reset or leftover (a reset on a read of this script's own checks is retried and reported in the final line, not failed).
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
const SWEEP = 'scratch/copy-rate-';
const scratch = `${SWEEP}${process.env.GITHUB_RUN_ID || Date.now()}/`;
if (!scratch.startsWith(SWEEP) || scratch.startsWith('sites/')) throw new Error('scratch prefix');
const transport = (error) => /fetch failed|ECONNRESET|socket|UND_ERR|ETIMEDOUT|EPIPE/i.test(`${error?.message} ${error?.cause?.code ?? ''} ${error?.cause?.message ?? ''}`);
let resets = 0;
// (a read: HEAD, list or remove, with the uploader's attempt rule; a transport reset is counted and retried)
const read = (what, fn) => attemptUpload(what, async () => { try { return await fn(); } catch (error) { if (transport(error)) resets++; throw error; } });
const etagOf = (key) => read(`head ${key}`, async () => { const r = await r2.fetch(objectUrl(BUCKET, key), { method: 'HEAD' }); return r.ok ? r.headers.get('etag') : null; });
const listed = (prefix) => read(`list ${prefix}`, async () => (await list(r2.fetch, BUCKET, prefix)).files);

const results = [];
let failed = false, removed = 0, leftover = null;
try {
  const manifest = await read('manifest', () => r2.json(`sites/${from}/manifest.json`));
  if (!manifest) throw new Error(`no manifest for ${from}`);
  // ([c5]: a '..', '.' or empty segment would be normalised by the URL and could land outside scratch/: refused for any build)
  for (const e of manifest.entries) if (String(e.path).split('/').some((s) => s === '..' || s === '.' || !s)) throw new Error(`manifest path refused: ${e.path}`);
  const small = manifest.entries.filter((e) => e.bytes > 0 && e.bytes < 6e6);
  if (small.length < count * streams.length) throw new Error(`only ${small.length} small objects`);
  let offset = 0;
  for (const s of streams) {
    const items = small.slice(offset, offset + count); offset += count;
    const queue = [...items], throttled = [], errors = [];
    let tries = 0;
    const resetsBefore = resets, t0 = Date.now();
    await Promise.all(Array.from({ length: s }, async () => {
      for (let e = queue.shift(); e; e = queue.shift()) {
        const key = `${scratch}${s}/${e.path}`;
        try {
          await attemptUpload(`copy ${key}`, async () => {
            tries++;
            let r;
            try { r = await r2.fetch(objectUrl(BUCKET, key), { method: 'PUT', headers: copyUploadHeaders(`/${BUCKET}/${encodePath(`sites/${from}/${e.path}`)}`) }); }
            catch (error) { if (transport(error)) resets++; throw error; }
            // (a throttling answer: HTTP 429/503, or SlowDown inside a 200 or an error body; counted, then retried as the uploader retries)
            try { await completeUploadResponse(r, { copy: true }); } catch (error) { if (/HTTP (429|503)|SlowDown/.test(error.message)) throttled.push(error.message.slice(0, 60)); throw error; }
          });
        } catch (error) { errors.push(`${e.path}: ${error.message}`); }
      }
    }));
    const seconds = (Date.now() - t0) / 1000, copyResets = resets - resetsBefore;
    // every copy: its size by the manifest, its ETag the source's
    const mismatched = [];
    try {
      const sizes = new Map((await listed(`${scratch}${s}/`)).map((f) => [f.key, f.size]));
      for (let i = 0; i < items.length; i += 8) {
        await Promise.all(items.slice(i, i + 8).map(async (e) => {
          const key = `${scratch}${s}/${e.path}`;
          if (sizes.get(key) !== e.bytes) { mismatched.push(`${e.path}: size ${sizes.get(key)} not ${e.bytes}`); return; }
          const [a, b] = await Promise.all([etagOf(`sites/${from}/${e.path}`), etagOf(key)]);
          if (!a || a !== b) mismatched.push(`${e.path}: etag ${b} not ${a}`);
        }));
      }
    } catch (error) { mismatched.push(`check: ${error.message}`); }
    const row = { streams: s, objects: items.length, seconds: Math.round(seconds * 10) / 10, perSecond: Math.round(items.length / seconds * 10) / 10,
      retries: tries - items.length, resets: copyResets, throttled: throttled.length, errors: errors.length, mismatched: mismatched.length,
      sample: [...errors, ...mismatched].slice(0, 3) };
    results.push(row);
    console.log(JSON.stringify(row));
    if (errors.length || mismatched.length || throttled.length || copyResets) failed = true;
  }
} catch (error) {
  failed = true;
  console.log(JSON.stringify({ error: String(error?.message ?? error), cause: error?.cause?.code ?? null }));
} finally {
  // every object under scratch/copy-rate- (this run's and any an earlier run left), then the prefix listed empty
  try {
    // ([c5]: a key with a '..', '.' or empty segment would be normalised by the URL outside scratch/: never removed, reported as leftover)
    const left = (await listed(SWEEP)).filter((f) => f.key.startsWith(SWEEP) && !f.key.split('/').some((s) => s === '..' || s === '.' || !s));
    for (let i = 0; i < left.length; i += 8) await Promise.all(left.slice(i, i + 8).map((f) => read(`remove ${f.key}`, () => remove(r2.fetch, BUCKET, f.key))));
    removed = left.length;
    leftover = (await listed(SWEEP)).length;
  } catch (error) { console.log(JSON.stringify({ cleanup: String(error?.message ?? error) })); }
  console.log(JSON.stringify({ from, scratch, removed, leftover, resets, results }));
  if (leftover !== 0) failed = true;
  process.exit(failed ? 1 : 0);
}
