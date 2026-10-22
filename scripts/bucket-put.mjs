// Files from a folder to one of the R2 buckets (lib/bucket.mjs), for the
// desktop's jobs: the export's encoded textures and panoramas to the private
// bf2017-assets, under web/. Until 2026-10-21 the export's own uploader
// (tool/upload_supabase.py) sent them to Supabase Storage; this takes its
// arguments and keeps its record, web_opt/upload_state.tsv (the bucket path a
// line, then its bytes), which bf2017-coverage.mjs --root reads as the
// bucket's listing.
//
//   node scripts/bucket-put.mjs --root <dir> --list <file> [--bucket bf2017-assets] [--prefix web/] [--dry]
//
//   root    the folder the list's paths are under (the export's web_opt)
//   list    the paths to send, one a line, relative to root
//   prefix  what goes before each path in the bucket (web/)
//   dry     what would go, and nothing sent
//
// A file the bucket holds at its size already is not sent again (asked of R2
// itself, a HEAD); four at a time, each retried (lib/pool.mjs). The keys:
// R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY from the environment (the
// runner's .env), never printed. Exit 1 when any file failed.
//
// plan(paths, prefix) → [{ path, key }]; stateLines(text) → Set of the record's paths
// putAll({ root, items, pool, fetch, bucket, log }) → { sent, there, failed: [{ path, error }], lines }

import { existsSync, readFileSync, appendFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { NO_KEYS, bucketEnv, objectUrl } from './lib/bucket.mjs';
import { createPool } from './lib/pool.mjs';

const TYPES = { '.ktx2': 'image/ktx2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.hdr': 'image/vnd.radiance', '.exr': 'image/x-exr', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jsonl': 'application/x-ndjson', '.gz': 'application/gzip', '.txt': 'text/plain', '.tsv': 'text/tab-separated-values', '.md': 'text/markdown' };

export const plan = (paths, prefix = '') =>
  paths
    .map((p) => p.trim().replace(/\\/g, '/').replace(/^\/+/, ''))
    .filter(Boolean)
    .map((path) => ({ path, key: `${prefix}${path}` }));

export const stateLines = (text) => new Set(String(text).split('\n').filter(Boolean).map((l) => l.split('\t')[0]));

export async function putAll({ root, items, pool, fetch, bucket, log = console.log }) {
  const out = { sent: 0, there: 0, failed: [], lines: [] };
  await Promise.all(
    items.map(async ({ path, key }) => {
      const file = join(root, path);
      if (!existsSync(file)) {
        out.failed.push({ path, error: 'not on disk' });
        return;
      }
      const bytes = statSync(file).size;
      const url = objectUrl(bucket, key);
      const head = await pool.run({ url, method: 'HEAD', fetch });
      if (head.status === 'fetched' && Number(head.headers.get('content-length')) === bytes) out.there++;
      else {
        const up = await pool.run({ url, method: 'PUT', headers: { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' }, body: readFileSync(file), fetch });
        if (up.status !== 'fetched') {
          out.failed.push({ path, error: up.error ?? up.status });
          log(`  failed ${key}: ${up.error ?? up.status}`);
          return;
        }
        out.sent++;
        log(`  up ${key}  ${(bytes / 1e6).toFixed(1)} MB`);
      }
      out.lines.push(`${key}\t${bytes}`);
    }),
  );
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.root !== 'string' || typeof args.list !== 'string') {
    console.error('usage: node scripts/bucket-put.mjs --root <dir> --list <file> [--bucket bf2017-assets] [--prefix web/] [--dry]');
    return 2;
  }
  const root = resolve(args.root);
  const bucket = typeof args.bucket === 'string' ? args.bucket : 'bf2017-assets';
  const items = plan(readFileSync(args.list, 'utf8').split('\n'), typeof args.prefix === 'string' ? args.prefix : '');
  console.log(`${items.length} files to ${bucket}`);
  if (args.dry) {
    for (const i of items) console.log(`  would send ${i.key}`);
    return 0;
  }
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    return 2;
  }
  const r = await putAll({ root, items, pool: createPool({ size: 4 }), fetch: env.fetch, bucket });
  // (the record keeps one line a path: a file sent again isn't written twice)
  const record = join(root, 'upload_state.tsv');
  const had = existsSync(record) ? stateLines(readFileSync(record, 'utf8')) : new Set();
  const fresh = r.lines.filter((l) => !had.has(l.split('\t')[0])).sort();
  if (fresh.length) appendFileSync(record, `${fresh.join('\n')}\n`);
  console.log(`sent ${r.sent} · there already ${r.there} · failed ${r.failed.length} · ${fresh.length} new in upload_state.tsv`);
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
