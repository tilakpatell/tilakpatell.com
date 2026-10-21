// The site's game-derived files to the public bucket `site-assets`, by
// content hash, and the manifest that says so (src/data/galaxyAssets.json).
// The files are what the 2017 pipeline made (scripts/bf2017-import.mjs: a
// kind's GLB and its .lod1, .far and .ultra cuts, credited to the game, the
// clip packs under models/galaxy/bf2017/, and the films scripts/bf2017-ui.mjs
// cuts under films/bf2017/); nothing raw from the drop is
// ever published, and nothing from Meshy, Sketchfab or Quaternius (those stay
// committed). Each goes to `<hash12>/<path>` once, with a year's cache and
// its content type; a hash the bucket already holds is not sent
// again. The manifest is written last, after every upload has landed, so a
// run cut off midway leaves the manifest naming only what is there; then
// .gitignore's marked block is rewritten (scripts/assets-ignore.mjs), so the
// published files leave git.
//
//   node scripts/assets-publish.mjs [--dry] [--only '<glob over site paths>'] [--bucket site-assets]
//     [--manifest <file>] [--files '<glob>']
//
//   dry       what would go, and nothing sent
//   only      just the files whose path matches one of these globs,
//             comma-separated (a star crosses folders)
//   manifest  another manifest to write (a check's, not the site's)
//   files     publish these paths under public/ (globs, comma-separated) instead of the game's
//             (a check that wants something in the bucket before phase 1's
//             heroes are there; never for the site's manifest)
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (R2's S3 keys,
// lib/bucket.mjs) from the environment, never printed. The bucket is made by
// hand on R2 and is public through its own domain (docs/stack/cloudflare.md);
// whether a hash is up there is asked of R2 itself, so no "not there" is ever
// left in the CDN's cache. Then: node scripts/assets-check.mjs, and commit the
// manifest and .gitignore.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { globMatch } from './lib/bf2017-paths.mjs';
import { MANIFEST, diff, gameFiles, hashOf, publishedPath, readManifest, writeManifest } from './lib/asset-manifest.mjs';
import { KINDS } from './assets-upload.mjs';
import { NO_KEYS, assetBase, bucketEnv, objectUrl } from './lib/bucket.mjs';
import { createPool } from './lib/pool.mjs';

export const BUCKET = 'site-assets';
// A year, and never changed: the path's hash is what makes the file
// immutable. R2 keeps the header as it is sent and answers with it. (Until
// 2026-10-21 Supabase kept only the max-age and served `public,
// max-age=31536000`; assets-check.mjs holds both to the year.)
export const CACHE = 'public, max-age=31536000, immutable';
const TYPES = { ...KINDS, '.json': 'application/json', '.bin': 'application/octet-stream', '.webm': 'video/webm', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg' };

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const sum = (fs) => fs.reduce((s, f) => s + f.bytes, 0);

// --only's globs, comma-separated: a file goes when any matches (a lane
// publishes its own full cuts and nothing of another's)
export const onlyMatch = (only) => {
  const ms = String(only).split(',').filter(Boolean).map(globMatch);
  return (path) => ms.some((m) => m(path));
};

// The bucket is there (R2's HeadBucket): made by hand, with its domain and
// its CORS, which the S3 calls can't make or show.
export async function ensureBucket(bucket = BUCKET, fetch = globalThis.fetch) {
  const had = await fetch(objectUrl(bucket, '').replace(/\/$/, ''), { method: 'HEAD' });
  if (had.status === 404) throw new Error(`the bucket ${bucket} isn't on R2: make it there first (docs/stack/cloudflare.md)`);
  if (!had.ok) throw new Error(`the bucket ${bucket}: HTTP ${had.status}`);
}

// The work, with the network handed in (a pool, or a test's stand-in).
//   files: [{ path, bytes, hash, from, tier }]; manifest: what is published
// → { sent, there, failed, manifest }: the new manifest has every file that
//   is in the bucket now and every earlier entry not touched (a checkout
//   without the files keeps what was published before)
//   fetch: the one that signs (lib/bucket.mjs), handed to each of the pool's jobs
export async function publish({ files, manifest, pool, fetch, bucket = BUCKET, publicDir, log = console.log }) {
  const { add, change, same } = diff(manifest, files);
  const next = { ...manifest };
  const failed = [];
  let sent = 0;
  let there = 0;
  for (const f of same) next[f.path] = { hash: f.hash, bytes: f.bytes, from: f.from, tier: f.tier };
  await Promise.all(
    [...add, ...change].map(async (f) => {
      const key = publishedPath(f.path, f.hash);
      // (a hash already up there, from a run cut off before its manifest, is not sent again)
      const head = await pool.run({ url: objectUrl(bucket, key), method: 'HEAD', fetch });
      if (head.status === 'fetched' && Number(head.headers.get('content-length')) === f.bytes) {
        there++;
      } else {
        const body = readFileSync(join(publicDir, f.path));
        const up = await pool.run({
          url: objectUrl(bucket, key),
          method: 'PUT',
          headers: { 'content-type': TYPES[extname(f.path).toLowerCase()] ?? 'application/octet-stream', 'cache-control': CACHE },
          body,
          fetch,
        });
        if (up.status !== 'fetched') {
          failed.push({ ...f, error: up.error ?? up.status });
          log(`  failed ${key}: ${up.error ?? up.status}`);
          return;
        }
        sent++;
        log(`  up ${key}  ${mb(f.bytes)}`);
      }
      next[f.path] = { hash: f.hash, bytes: f.bytes, from: f.from, tier: f.tier };
    }),
  );
  return { sent, there, failed, manifest: next };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const publicDir = join(ROOT, 'public');
  const bucket = typeof args.bucket === 'string' ? args.bucket : BUCKET;
  const manifestFile = typeof args.manifest === 'string' ? resolve(args.manifest) : join(ROOT, MANIFEST);
  const ours = manifestFile === join(ROOT, MANIFEST);
  if (args.files && ours) {
    console.error('assets-publish: --files is for a check’s manifest (--manifest), never the site’s');
    return 1;
  }
  let files = typeof args.files === 'string' ? anyFiles(publicDir, args.files) : gameFiles(JSON.parse(readFileSync(join(ROOT, 'src/data/modelCredits.json'), 'utf8')), publicDir);
  if (typeof args.only === 'string') files = files.filter((f) => onlyMatch(args.only)(f.path));
  const manifest = readManifest(manifestFile);
  const plan = diff(manifest, files);
  console.log(`game-derived: ${files.length} files, ${mb(sum(files))} (${plan.add.length} new, ${plan.change.length} changed, ${mb(sum([...plan.add, ...plan.change]))}; ${plan.same.length} published already; ${plan.gone.length} published and not here, kept)`);
  if (args.dry) {
    for (const f of [...plan.add, ...plan.change]) console.log(`  would send ${publishedPath(f.path, f.hash)}  ${mb(f.bytes)}`);
    return 0;
  }
  const env = bucketEnv();
  if (!env) {
    console.error(NO_KEYS);
    return 2;
  }
  await ensureBucket(bucket, env.fetch);
  const pool = createPool({ size: 4 });
  const r = await publish({ files, manifest, pool, fetch: env.fetch, bucket, publicDir });
  // (last: the manifest names only what is in the bucket now)
  writeManifest(manifestFile, r.manifest);
  console.log(`sent ${r.sent} · there already ${r.there} · failed ${r.failed.length} · wrote ${ours ? MANIFEST : manifestFile}`);
  if (ours) {
    const { ignoreFile } = await import('./assets-ignore.mjs');
    ignoreFile(ROOT);
  }
  console.log(`VITE_ASSET_BASE (the repository variable ASSET_BASE): ${assetBase()}`);
  return r.failed.length ? 1 : 0;
}

// any files under public/ by a glob over their paths, for a check
function anyFiles(publicDir, glob) {
  // (a comma list of globs or paths)
  const tests = String(glob).split(',').filter(Boolean).map(globMatch);
  const match = (path) => tests.some((t) => t(path));
  const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);
  return walk(publicDir)
    .map((abs) => abs.slice(publicDir.length + 1).split('\\').join('/'))
    .filter(match)
    .sort()
    .map((path) => {
      const buf = readFileSync(join(publicDir, path));
      return { path, bytes: buf.length, hash: hashOf(buf), from: path, tier: 'check' };
    });
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

