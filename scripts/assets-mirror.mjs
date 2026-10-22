// The public bucket's files, by the names the manifests give, from another
// public address to the bucket on R2: for the move off Supabase Storage,
// whose S3 address answered the copy with 429s on 2026-10-21 while its
// public CDN answered at once (.github/workflows/assets-to-r2.yml runs it).
// A file the site asks for is in src/data/galaxyAssets.json or
// src/data/assets-manifest.json, at `<hash12>/<path>`; the bucket's other
// files (a check's, an evidence picture) are the S3 copy's to bring.
//
//   node scripts/assets-mirror.mjs --from <public base> [--bucket tilak-assets] [--pool 32] [--limit N]
//
//   from    where the files are now (https://<ref>.supabase.co/storage/v1/object/public/site-assets)
//   bucket  the R2 bucket they go to (the public one)
//   pool    how many files at once (each asked, fetched and put through
//           lib/pool.mjs, retried on a fault, a 429 or a 5xx, a Retry-After kept)
//   limit   the first N, for a try
//
// R2 is asked first (a signed HEAD): a file there at the manifest's size is
// left alone, so a second run sends only what the first missed. A fetched
// body is held to the manifest's bytes, then put with its type and a year's
// cache, never changed: the path is the hash. The keys: R2_ACCESS_KEY_ID and
// R2_SECRET_ACCESS_KEY (lib/bucket.mjs), never printed. One line a failure,
// a line a minute, one summary; exit 1 when any failed.
//
// plan(manifests) → [{ key, bytes }], by key, each once
// mirror({ items, from, pool, fetch, bucket, log, at }) → { sent, there, failed: [{ key, error }], bytes }
//   (`at` files at once, each asked, fetched and put before the next is
//   taken, so no more than `at` bodies are held)

import { readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { NO_KEYS, bucketEnv, objectUrl } from './lib/bucket.mjs';
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

export async function mirror({ items, from, pool, fetch, bucket, log = console.log, at = 32 }) {
  const base = from.replace(/\/+$/, '');
  const out = { sent: 0, there: 0, failed: [], bytes: 0 };
  const fail = (key, error) => {
    out.failed.push({ key, error });
    log(`  failed ${key}: ${error}`);
  };
  const one = async ({ key, bytes }) => {
    const head = await pool.run({ url: objectUrl(bucket, key), method: 'HEAD', fetch });
    if (head.status === 'fetched' && Number(head.headers.get('content-length')) === bytes) {
      out.there++;
      return;
    }
    const got = await pool.run({ url: `${base}/${key.split('/').map(encodeURIComponent).join('/')}`, bytes, size: bytes });
    if (got.status !== 'fetched') return fail(key, got.error ?? `${got.status} at the source${got.http ? ` (HTTP ${got.http})` : ''}`);
    if (got.body.length !== bytes) return fail(key, `${got.body.length} bytes at the source, the manifest says ${bytes}`);
    const type = got.headers.get('content-type') || TYPES[extname(key).toLowerCase()] || 'application/octet-stream';
    const up = await pool.run({ url: objectUrl(bucket, key), method: 'PUT', headers: { 'content-type': type, 'cache-control': CACHE }, body: got.body, fetch, size: bytes });
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
  if (typeof args.from !== 'string') {
    console.error('usage: node scripts/assets-mirror.mjs --from <public base> [--bucket tilak-assets] [--pool 32] [--limit N]');
    return 2;
  }
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    return 2;
  }
  let items = plan(MANIFESTS.map((f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))));
  if (args.limit) items = items.slice(0, Number(args.limit));
  const bucket = typeof args.bucket === 'string' ? args.bucket : 'tilak-assets';
  const at = Math.max(1, Number(args.pool) || 32);
  const pool = createPool({ size: at, retries: 6, waits: [2000, 5000, 10000, 20000, 40000, 60000] });
  console.log(`${items.length} files the manifests give, from ${args.from} to ${bucket}`);
  const t0 = Date.now();
  const tick = setInterval(() => {
    const s = pool.stats();
    console.log(`  ${Math.round((Date.now() - t0) / 60000)} min: ${s.done} answered, ${s.missing} missing, ${s.failed} failed, ${s.retried} retried, ${(s.bytes / 1e9).toFixed(2)} GB fetched`);
  }, 60000);
  const r = await mirror({ items, from: args.from, pool, fetch: env.fetch, bucket, at });
  clearInterval(tick);
  console.log(`sent ${r.sent} (${(r.bytes / 1e9).toFixed(2)} GB) · there already ${r.there} · failed ${r.failed.length} · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
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
