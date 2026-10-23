// A bucket's files, by name, from addresses that answer them to a bucket on
// R2: for the move off Supabase Storage, whose S3 address answered the copy
// with 429s on 2026-10-21 and could not list a large bucket at all on
// 2026-10-22, while its CDN answered a file at once
// (.github/workflows/assets-to-r2.yml runs it). The names are the site's
// manifests (src/data/galaxyAssets.json and src/data/assets-manifest.json,
// at `<hash12>/<path>`), or a list (`--list`): a line a file, its key, its
// bytes and, for a private bucket, a signed address to fetch it at.
//
//   node scripts/assets-mirror.mjs --from <public base> [--bucket tilak-assets] [--pool 32] [--limit N]
//   node scripts/assets-mirror.mjs --list <file> [--from <public base>] --bucket <r2 bucket> [--cache none] [--check]
//
//   from    where the files are now (https://<ref>.supabase.co/storage/v1/object/public/site-assets),
//           for a file with no address of its own
//   list    key<TAB>bytes[<TAB>address] lines, in place of the manifests
//   bucket  the R2 bucket they go to (the public one by default)
//   cache   the Cache-Control each is put with (a year and immutable by
//           default; `none` for a bucket whose files are rewritten in place)
//   check   send nothing: hold R2 to the names (one listing of the bucket),
//           and say what is missing or at another size
//   pool    how many files at once (each fetched and put through
//           lib/pool.mjs, retried on a fault, a 429 or a 5xx, a Retry-After kept)
//   limit   the first N, for a try
//
// R2 is listed first, once: a file there at its size is left alone, so a
// second run sends only what the first missed.
// A fetched body is held to the bytes the names give, then put with its type
// and the cache. The keys: R2_ACCESS_KEY_ID and
// R2_SECRET_ACCESS_KEY (lib/bucket.mjs), never printed. One line a failure,
// a line a minute, one summary; exit 1 when any failed.
//
// plan(manifests) → [{ key, bytes }], by key, each once
// readList(text) → [{ key, bytes, url? }], by key, each once
// compare(items, held) → { missing: [item], other: [item] } (held: Map of key → bytes on R2)
// mirror({ items, from, pool, fetch, bucket, log, at, cache }) → { sent, there, failed: [{ key, error }], bytes }
//   (`at` files at once, each asked, fetched and put before the next is
//   taken, so no more than `at` bodies are held)

import { readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { NO_KEYS, bucketEnv, list, objectUrl } from './lib/bucket.mjs';
import { createPool } from './lib/pool.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MANIFESTS = ['src/data/galaxyAssets.json', 'src/data/assets-manifest.json'];
// (assets-publish.mjs's and assets-upload.mjs's own header for a new file)
const CACHE = 'public, max-age=31536000, immutable';
const TYPES = { '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.hdr': 'image/vnd.radiance', '.exr': 'image/x-exr', '.json': 'application/json', '.bin': 'application/octet-stream', '.webm': 'video/webm', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg' };

export function plan(manifests) {
  const out = new Map();
  for (const m of manifests) for (const [path, e] of Object.entries(m)) out.set(`${e.hash}/${path.replace(/^\/+/, '')}`, e.bytes);
  return [...out].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, bytes]) => ({ key, bytes }));
}

export function readList(text) {
  const out = new Map();
  for (const line of String(text).split('\n')) {
    const [key, bytes, url] = line.replace(/\r$/, '').split('\t');
    if (key && bytes !== undefined) out.set(key, { key, bytes: Number(bytes), ...(url ? { url } : {}) });
  }
  return [...out.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

export function compare(items, held) {
  const missing = [];
  const other = [];
  for (const it of items) {
    if (!held.has(it.key)) missing.push(it);
    else if (held.get(it.key) !== it.bytes) other.push(it);
  }
  return { missing, other };
}

export async function mirror({ items, from = '', pool, fetch, bucket, log = console.log, at = 32, cache = CACHE }) {
  const base = from.replace(/\/+$/, '');
  const out = { sent: 0, there: 0, failed: [], bytes: 0 };
  const fail = (key, error) => {
    out.failed.push({ key, error });
    log(`  failed ${key}: ${error}`);
  };
  const one = async ({ key, bytes, url }) => {
    const head = await pool.run({ url: objectUrl(bucket, key), method: 'HEAD', fetch });
    if (head.status === 'fetched' && Number(head.headers.get('content-length')) === bytes) {
      out.there++;
      return;
    }
    // (an empty file: a body of nothing is what it is, and the source is never asked)
    const got = bytes === 0 ? { status: 'fetched', body: Buffer.alloc(0), headers: new Headers() } : await pool.run({ url: url ?? `${base}/${key.split('/').map(encodeURIComponent).join('/')}`, bytes, size: bytes });
    if (got.status !== 'fetched') return fail(key, got.error ?? `${got.status} at the source${got.http ? ` (HTTP ${got.http})` : ''}`);
    if (got.body.length !== bytes) return fail(key, `${got.body.length} bytes at the source, the list says ${bytes}`);
    const type = got.headers.get('content-type') || TYPES[extname(key).toLowerCase()] || 'application/octet-stream';
    const up = await pool.run({ url: objectUrl(bucket, key), method: 'PUT', headers: { 'content-type': type, ...(cache ? { 'cache-control': cache } : {}) }, body: got.body, fetch, size: bytes });
    if (up.status !== 'fetched') return fail(key, up.error ?? up.status);
    out.sent++;
    out.bytes += bytes;
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(at, items.length) }, async () => {
      while (next < items.length) await one(items[next++]);
    }),
  );
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const listed = typeof args.list === 'string';
  if (typeof args.from !== 'string' && !listed) {
    console.error('usage: node scripts/assets-mirror.mjs --from <public base> | --list <file> [--from <base>] [--bucket tilak-assets] [--cache none] [--check] [--pool 32] [--limit N]');
    return 2;
  }
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    return 2;
  }
  let items = listed ? readList(readFileSync(args.list, 'utf8')) : plan(MANIFESTS.map((f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))));
  if (args.limit) items = items.slice(0, Number(args.limit));
  const bucket = typeof args.bucket === 'string' ? args.bucket : 'tilak-assets';
  const cache = args.cache === 'none' ? null : typeof args.cache === 'string' ? args.cache : CACHE;
  const bytes = items.reduce((s, it) => s + it.bytes, 0);
  // (what R2 holds, one listing: the files there at their size are left alone)
  const t0 = Date.now();
  const held = new Map((await list(env.fetch, bucket, '')).files.map((f) => [f.key, f.size]));
  const { missing, other } = compare(items, held);
  console.log(`${items.length} files (${(bytes / 1e9).toFixed(2)} GB) ${listed ? `in ${args.list}` : 'the manifests give'}; ${bucket} holds ${held.size}: ${missing.length} missing, ${other.length} at another size · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (args.check) {
    for (const it of [...missing, ...other].slice(0, 20)) console.log(`  ${held.has(it.key) ? `${held.get(it.key)} bytes, the list says ${it.bytes}` : 'missing'}  ${it.key}`);
    return missing.length + other.length ? 1 : 0;
  }
  items = [...missing, ...other];
  const at = Math.max(1, Number(args.pool) || 32);
  const pool = createPool({ size: at, retries: 6, waits: [2000, 5000, 10000, 20000, 40000, 60000] });
  console.log(`${items.length} to send, from ${listed ? 'their own addresses' : args.from} to ${bucket}`);
  const t1 = Date.now();
  const tick = setInterval(() => {
    const s = pool.stats();
    console.log(`  ${Math.round((Date.now() - t1) / 60000)} min: ${s.done} answered, ${s.missing} missing, ${s.failed} failed, ${s.retried} retried, ${(s.bytes / 1e9).toFixed(2)} GB fetched`);
  }, 60000);
  const r = await mirror({ items, from: typeof args.from === 'string' ? args.from : '', pool, fetch: env.fetch, bucket, at, cache });
  clearInterval(tick);
  console.log(`sent ${r.sent} (${(r.bytes / 1e9).toFixed(2)} GB) · there already ${r.there} · failed ${r.failed.length} · ${((Date.now() - t1) / 60000).toFixed(1)} min`);
  return r.failed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}
