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
// The keys: SUPABASE_URL and SUPA_KEY (or BF2017_KEY) from the environment,
// for the uploads only, never printed; the bucket is read with no key at all.
// It makes the bucket (public) the first time. Then: node
// scripts/assets-check.mjs, and commit the manifest and .gitignore.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { globMatch } from './lib/bf2017-paths.mjs';
import { MANIFEST, diff, gameFiles, hashOf, publishedPath, readManifest, writeManifest } from './lib/asset-manifest.mjs';
import { KINDS } from './assets-upload.mjs';
import { createPool } from './lib/pool.mjs';

export const BUCKET = 'site-assets';
// A year. Supabase keeps only the max-age of what it is sent (an `immutable`
// is dropped) and serves `public, max-age=31536000` on a GET; the path's
// hash is what makes the file immutable. (A HEAD there always says
// no-cache, so assets-check.mjs asks for one byte instead.)
export const CACHE = 'max-age=31536000';
const TYPES = { ...KINDS, '.json': 'application/json', '.bin': 'application/octet-stream', '.webm': 'video/webm' };

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const sum = (fs) => fs.reduce((s, f) => s + f.bytes, 0);

// --only's globs, comma-separated: a file goes when any matches (a lane
// publishes its own full cuts and nothing of another's)
export const onlyMatch = (only) => {
  const ms = String(only).split(',').filter(Boolean).map(globMatch);
  return (path) => ms.some((m) => m(path));
};

export const publicBase = (url, bucket = BUCKET) => `${url.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}`;

// The bucket, made public if it isn't there: one POST, the service key's.
export async function ensureBucket(url, headers, bucket = BUCKET, fetch = globalThis.fetch) {
  const had = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
  if (had.ok) {
    const b = await had.json();
    if (!b.public) throw new Error(`the bucket ${bucket} is there but not public`);
    return false;
  }
  const made = await fetch(`${url}/storage/v1/bucket`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ id: bucket, name: bucket, public: true }) });
  if (!made.ok) throw new Error(`couldn't make the bucket ${bucket}: HTTP ${made.status} ${(await made.text()).slice(0, 200)}`);
  return true;
}

// The work, with the network handed in (a pool, or a test's stand-in).
//   files: [{ path, bytes, hash, from, tier }]; manifest: what is published
// → { sent, there, failed, manifest }: the new manifest has every file that
//   is in the bucket now and every earlier entry not touched (a checkout
//   without the files keeps what was published before)
export async function publish({ files, manifest, pool, url, bucket = BUCKET, headers, publicDir, log = console.log }) {
  const base = publicBase(url, bucket);
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
      const head = await pool.run({ url: `${base}/${key}`, method: 'HEAD' });
      if (head.status === 'fetched' && Number(head.headers.get('content-length')) === f.bytes) {
        there++;
      } else {
        const body = readFileSync(join(publicDir, f.path));
        const up = await pool.run({
          url: `${url}/storage/v1/object/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
          method: 'POST',
          headers: { ...headers, 'content-type': TYPES[extname(f.path).toLowerCase()] ?? 'application/octet-stream', 'cache-control': CACHE, 'x-upsert': 'true' },
          body,
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
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPA_KEY || process.env.BF2017_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPA_KEY (the project’s secret key, for the upload only) in the environment.');
    return 2;
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  if (await ensureBucket(url, headers, bucket)) console.log(`made the public bucket ${bucket}`);
  const pool = createPool({ size: 4, missing: [400, 404] });
  const r = await publish({ files, manifest, pool, url, bucket, headers, publicDir });
  // (last: the manifest names only what is in the bucket now)
  writeManifest(manifestFile, r.manifest);
  console.log(`sent ${r.sent} · there already ${r.there} · failed ${r.failed.length} · wrote ${ours ? MANIFEST : manifestFile}`);
  if (ours) {
    const { ignoreFile } = await import('./assets-ignore.mjs');
    ignoreFile(ROOT);
  }
  console.log(`VITE_ASSET_BASE (the repository variable ASSET_BASE): ${publicBase(url, bucket)}`);
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

