// Holds the public bucket to the manifests before a deploy: every file
// src/data/galaxyAssets.json (the game-derived files) and
// src/data/assets-manifest.json (the heavy-asset mirror) name is asked for at
// its published URL, with no key, one byte of it (a HEAD there always says
// `no-cache`, whatever the object holds): it must answer 206, its whole size
// (content-range) the manifest's bytes, and a year's cache. A manifest and a
// bucket out of step (an upload that crashed before its manifest, or the
// reverse) fails here, not on a visitor's phone.
//
//   node scripts/assets-check.mjs [--base <url>] [--galaxy-only] [--since <git ref>]
//
// The base: --base, else ASSET_BASE or VITE_ASSET_BASE, else the project's
// (SUPABASE_URL) site-assets. One line a failure, one summary line; exit 1 on
// any failure, 0 with nothing to check.
//
// With --since, only the entries the manifests gained or changed since that
// commit are asked for (`git show <ref>:<manifest>`; a manifest not there
// then counts as empty, so everything is asked): the rest were held to the
// bucket by the deploy that carried them, and a bucket path is never
// overwritten. The deploy passes the last deploy that went out. Without it,
// every file: 77,545 of them on 2026-10-15, half an hour a deploy, and, if
// the CDN counts a one-byte range as the whole file, the bucket's 14 GB of
// egress a deploy (that month's 28 deploys and its 387 GB of cached egress
// are that sum). The body of an answer is never read (the pool's `peek`),
// so a CDN that answers the range with a 200 and the whole file sends none
// of it; the summary counts those answers.

import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { publishedPath, readManifest } from './lib/asset-manifest.mjs';
import { createPool } from './lib/pool.mjs';
import { galaxyPath } from './assets-manifest.mjs';
import { manifestPath } from './assets-upload.mjs';

const YEAR = /max-age=31536000\b/;

// what one answer says about one entry: null when it's right, else why not
export function verdict(entry, got) {
  // (an empty file has no first byte to give: the range is refused, and the answer names its size, 0;
  // the pool calls that 416 failed, so it is read first)
  if (got.http === 416 && entry.bytes === 0 && got.headers?.get('content-range') === 'bytes */0') return null;
  if (got.status === 'missing') return `not in the bucket (HTTP ${got.http})`;
  if (got.status !== 'fetched') return got.error ?? 'failed';
  if (got.http !== 206 && got.http !== 200) return `HTTP ${got.http}`;
  const range = got.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : Number(got.headers.get('content-length'));
  if (total !== entry.bytes) return `${total} bytes, the manifest says ${entry.bytes}`;
  const cache = got.headers.get('cache-control') ?? '';
  if (!YEAR.test(cache)) return `cache-control ${cache || 'none'}, not a year`;
  return null;
}

// the entries `entries` has that `old` (the manifest as it was) hasn't, or
// has with another hash or size
export function changedSince(entries, old) {
  const out = {};
  for (const [path, e] of Object.entries(entries)) {
    const was = old?.[path];
    if (!was || was.hash !== e.hash || was.bytes !== e.bytes) out[path] = e;
  }
  return out;
}

// a manifest as a commit had it, or empty when it wasn't there (or the ref isn't here)
export function manifestAt(ref, file, root) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:${relative(root, file).split('\\').join('/')}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256e6 }));
  } catch {
    return {};
  }
}

// `tally.whole` counts the answers that gave the whole file (a 200) to the
// one-byte range: the body is let go unread, but the CDN may still bill it
export async function check({ base, entries, pool, log = console.log, tally = {} }) {
  const bad = [];
  tally.whole = 0;
  await Promise.all(
    Object.entries(entries).map(async ([path, e]) => {
      const url = `${base.replace(/\/+$/, '')}/${publishedPath(path, e.hash)}`;
      const got = await pool.run({ url, headers: { range: 'bytes=0-0' }, peek: true });
      if (got.http === 200) tally.whole++;
      const why = verdict(e, got);
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
  const galaxyFile = galaxyPath(root);
  const mirrorFile = manifestPath(root);
  let galaxy = readManifest(galaxyFile);
  let mirror = args.galaxyOnly ? {} : readManifest(mirrorFile);
  const all = Object.keys(galaxy).length + Object.keys(mirror).length;
  if (!all) {
    console.log('assets-check: nothing published (both manifests empty)');
    return 0;
  }
  const since = typeof args.since === 'string' && args.since ? args.since : '';
  if (since) {
    galaxy = changedSince(galaxy, manifestAt(since, galaxyFile, root));
    mirror = changedSince(mirror, manifestAt(since, mirrorFile, root));
  }
  const entries = { ...mirror, ...galaxy };
  const n = Object.keys(entries).length;
  if (!n) {
    console.log(`assets-check: nothing new since ${since} (${all} entries as that deploy held them)`);
    return 0;
  }
  if (!base) {
    console.error('assets-check: no base (--base, ASSET_BASE, VITE_ASSET_BASE or SUPABASE_URL)');
    return 2;
  }
  const pool = createPool({ size: 8, missing: [400, 404] });
  const tally = {};
  const bad = await check({ base, entries, pool, tally });
  const s = pool.stats();
  const scope = since ? `, ${all - n} unchanged since ${since.slice(0, 8)} not asked` : '';
  const whole = tally.whole ? ` · ${tally.whole} answered the one-byte range with the whole file (200)` : '';
  console.log(`assets-check: ${n - bad.length} of ${n} right (${Object.keys(galaxy).length} game-derived, ${Object.keys(mirror).length} mirrored${scope}) · ${s.retried} retried${whole} · ${s.seconds.toFixed(1)} s · ${base}`);
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

