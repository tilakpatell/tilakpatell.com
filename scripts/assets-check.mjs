// Holds the public bucket to the manifests before a deploy: every file
// src/data/galaxyAssets.json (the game-derived files) and
// src/data/assets-manifest.json (the heavy-asset mirror) name is asked for at
// its published URL, with no key, one byte of it (a HEAD there always says
// `no-cache`, whatever the object holds): it must answer 206, its whole size
// (content-range) the manifest's bytes, and a year's cache. A manifest and a
// bucket out of step (an upload that crashed before its manifest, or the
// reverse) fails here, not on a visitor's phone.
//
//   node scripts/assets-check.mjs [--base <url>] [--galaxy-only]
//
// The base: --base, else ASSET_BASE or VITE_ASSET_BASE, else the project's
// (SUPABASE_URL) site-assets. One line a failure, one summary line; exit 1 on
// any failure, 0 with nothing to check.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { publishedPath, readManifest } from './lib/asset-manifest.mjs';
import { createPool } from './lib/pool.mjs';
import { galaxyPath } from './assets-manifest.mjs';
import { manifestPath } from './assets-upload.mjs';

const YEAR = /max-age=31536000\b/;

// what one answer says about one entry: null when it's right, else why not
export function verdict(entry, got) {
  if (got.status === 'missing') return `not in the bucket (HTTP ${got.http})`;
  if (got.status !== 'fetched') return got.error ?? 'failed';
  // (an empty file has no first byte to give: the range is refused, and the answer names its size, 0)
  if (got.http === 416 && entry.bytes === 0 && got.headers.get('content-range') === 'bytes */0') return null;
  if (got.http !== 206 && got.http !== 200) return `HTTP ${got.http}`;
  const range = got.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : Number(got.headers.get('content-length'));
  if (total !== entry.bytes) return `${total} bytes, the manifest says ${entry.bytes}`;
  const cache = got.headers.get('cache-control') ?? '';
  if (!YEAR.test(cache)) return `cache-control ${cache || 'none'}, not a year`;
  return null;
}

export async function check({ base, entries, pool, log = console.log }) {
  const bad = [];
  await Promise.all(
    Object.entries(entries).map(async ([path, e]) => {
      const url = `${base.replace(/\/+$/, '')}/${publishedPath(path, e.hash)}`;
      const why = verdict(e, await pool.run({ url, headers: { range: 'bytes=0-0' } }));
      if (why) {
        bad.push(path);
        log(`  ${path}: ${why}`);
      }
    }),
  );
  return bad;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const project = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const base = (typeof args.base === 'string' && args.base) || process.env.ASSET_BASE || process.env.VITE_ASSET_BASE || (project ? `${project}/storage/v1/object/public/site-assets` : '');
  const galaxy = readManifest(galaxyPath(root));
  const mirror = args.galaxyOnly ? {} : readManifest(manifestPath(root));
  const entries = { ...mirror, ...galaxy };
  const n = Object.keys(entries).length;
  if (!n) {
    console.log('assets-check: nothing published (both manifests empty)');
    return 0;
  }
  if (!base) {
    console.error('assets-check: no base (--base, ASSET_BASE, VITE_ASSET_BASE or SUPABASE_URL)');
    return 2;
  }
  const pool = createPool({ size: 8, missing: [400, 404] });
  const bad = await check({ base, entries, pool });
  const s = pool.stats();
  console.log(`assets-check: ${n - bad.length} of ${n} right (${Object.keys(galaxy).length} game-derived, ${Object.keys(mirror).length} mirrored) · ${s.retried} retried · ${s.seconds.toFixed(1)} s · ${base}`);
  return bad.length ? 1 : 0;
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

