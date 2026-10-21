// The heavy assets to the public bucket on R2 (tilak-assets; site-assets on Supabase until 2026-10-21), by content hash: each
// file under REMOTE of a heavy kind and 64 KB or more goes to
// `<hash12>/<path>` once, with a year's cache, never overwritten (a changed
// file is a new path, so a visitor on the old build still gets the old one),
// and src/data/assets-manifest.json says which paths the bucket holds. The
// site reads that manifest through src/lib/assetBase.js; the build keeps only
// the entries whose file on disk still has that hash (freshManifest), so a
// file changed and not uploaded again is served locally, never stale.
// Old paths go only with --prune, after the deploy that stopped naming them.
//
//   node --env-file=.env.local scripts/assets-upload.mjs [--dry] [--prune]
//
// The keys are R2's (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: lib/bucket.mjs),
// the owner's, from their shell or .env.local; never printed. The script
// refuses to run in CI. `public/` stays whole: the site still serves every
// file, and the bucket is where the site asks first when VITE_ASSET_BASE is
// set. (Until 2026-10-21 the bucket was on Supabase Storage.)

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_KEYS, assetBase, bucketEnv, list, put, remove } from './lib/bucket.mjs';

// (the site's one public bucket: the game-derived files are published there
// too, by scripts/assets-publish.mjs, so one ASSET_BASE serves both)
export const BUCKET = 'tilak-assets';
// (textures/galaxy/bf2017/<role>/ and textures/galaxy/sky/: lane W's, the
// game's ground and trim maps and the levels' skies, mirrored once they land;
// textures/galaxy/planets/: lane K's planet skins)
// (the level packs under models/galaxy/bf2017/ are published by
// scripts/assets-publish.mjs, not mirrored here: lane E0)
export const REMOTE = ['hq/models', 'hq/tex', 'cc0/galaxy', 'models/gen3d', 'kit', 'textures/galaxy/bf2017', 'textures/galaxy/sky', 'textures/galaxy/planets'];
// (each one whole in itself: a .gltf's sidecars would not sit beside it under one hash)
export const KINDS = { '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.hdr': 'image/vnd.radiance', '.exr': 'image/x-exr' };
const MIN_BYTES = 64 * 1024;
export const MANIFEST = 'src/data/assets-manifest.json';
// (a year, never changed: the path is the hash; assets-publish.mjs sends the same)
const CACHE = 'public, max-age=31536000, immutable';

export const hashOf = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);
export const keyOf = (f) => `${f.hash}/${f.path}`;

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);
const heavy = (abs) => Boolean(KINDS[extname(abs).toLowerCase()]);

// every file that goes, sorted by path: { path, bytes, hash }
export function remoteFiles(publicDir) {
  return REMOTE.flatMap((dir) => walk(join(publicDir, dir)))
    .filter((abs) => heavy(abs) && statSync(abs).size >= MIN_BYTES)
    .map((abs) => {
      const buf = readFileSync(abs);
      return { path: abs.slice(publicDir.length + 1).split('\\').join('/'), bytes: buf.length, hash: hashOf(buf) };
    })
    .sort((a, b) => (a.path < b.path ? -1 : 1));
}

// what the bucket lacks, what it has, and what nothing names any more:
// neither the files on disk nor the manifest the live site was built with. Pure.
export function planUpload(files, stored, deployed = {}) {
  const have = new Set(stored);
  const want = new Set([...files.map(keyOf), ...Object.entries(deployed ?? {}).map(([path, e]) => keyOf({ path, hash: e.hash }))]);
  return {
    upload: files.filter((f) => !have.has(keyOf(f))),
    keep: files.filter((f) => have.has(keyOf(f))),
    prune: [...have].filter((k) => !want.has(k)).sort(),
  };
}

export const manifestOf = (files) => Object.fromEntries([...files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((f) => [f.path, { hash: f.hash, bytes: f.bytes }]));
// the committed manifest, or another for a check (sw-check.mjs --bucket names one in ASSET_MANIFEST)
export const manifestPath = (root, env = process.env) => (env.ASSET_MANIFEST ? resolve(env.ASSET_MANIFEST) : join(root, MANIFEST));
export const readManifest = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
export function writeManifest(file, m) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(manifestOf(Object.entries(m).map(([path, e]) => ({ path, ...e }))), null, 2)}\n`);
}

// the entries a build may use: the file is still on disk with that hash
export function freshManifest(manifest, publicDir) {
  return Object.fromEntries(
    Object.entries(manifest).filter(([path, e]) => {
      const abs = join(publicDir, path);
      return existsSync(abs) && statSync(abs).size === e.bytes && hashOf(readFileSync(abs)) === e.hash;
    }),
  );
}

// The bucket as run() asks of it: every key it holds, one upload (an S3 PUT
// with its type and a year's cache), and a prune of some keys.
export const r2Bucket = (fetch, bucket = BUCKET) => ({
  keys: async () => (await list(fetch, bucket, '')).files.map((f) => f.key),
  upload: (key, body, type) => put(fetch, bucket, key, body, { type, cache: CACHE }),
  remove: (keys) => Promise.all(keys.map((k) => remove(fetch, bucket, k))),
});

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const sum = (fs) => fs.reduce((s, f) => s + f.bytes, 0);

// the work, with the bucket passed in (main makes the real one)
// (deployed: the manifest main has, which the live site was built with; null when it can't be read)
export async function run({ root, argv, bucket, deployed = null, log = console.log }) {
  const dry = argv.includes('--dry');
  const prune = argv.includes('--prune');
  const publicDir = join(root, 'public');
  const files = remoteFiles(publicDir);
  const all = walk(publicDir);
  // (the game-derived files share the bucket, src/data/galaxyAssets.json's:
  // never pruned from here, whatever the mirror names)
  const published = readManifest(join(root, 'src/data/galaxyAssets.json'));
  const plan = planUpload(files, await bucket.keys(), { ...(deployed ?? {}), ...published });
  log(`remote: ${files.length} files, ${mb(sum(files))} (${plan.upload.length} to upload, ${mb(sum(plan.upload))}; ${plan.keep.length} there already)`);
  log(`local: ${all.length - files.length} files, ${mb(all.reduce((s, f) => s + statSync(f).size, 0) - sum(files))}`);
  if (dry) {
    if (prune) log(`would prune ${plan.prune.length}`);
    return 0;
  }
  for (const f of plan.upload) {
    const body = readFileSync(join(publicDir, f.path));
    // (a key the bucket lacks: never one it holds, so nothing is overwritten)
    await bucket.upload(keyOf(f), body, KINDS[extname(f.path).toLowerCase()]);
    log(`  up ${keyOf(f)}`);
  }
  writeManifest(join(root, MANIFEST), manifestOf(files));
  log(`wrote ${MANIFEST}`);
  // (a prune is its own run, after the deploy of the last upload's manifest is
  // live: never with an upload, never from a checkout missing the files,
  // never without knowing what the live site names)
  const refuse = !prune ? null : plan.upload.length ? 'this run uploaded; prune after its manifest is deployed' : !files.length ? 'no files on disk' : !deployed ? 'no deployed manifest (git show origin/main)' : null;
  if (refuse) log(`not pruning: ${refuse}`);
  else if (prune && plan.prune.length) {
    for (let i = 0; i < plan.prune.length; i += 100) await bucket.remove(plan.prune.slice(i, i + 100));
    log(`pruned ${plan.prune.length}`);
  }
  return 0;
}

async function main() {
  if (process.env.CI) {
    console.error('assets-upload: not in CI; the upload runs from the owner’s shell, with their key');
    return 1;
  }
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const env = bucketEnv();
  if (!env) {
    console.log(NO_KEYS);
    return 2;
  }
  // what the live site was built with: main's manifest
  const shown = spawnSync('git', ['show', `origin/main:${MANIFEST}`], { cwd: root, encoding: 'utf8' });
  const deployed = shown.status === 0 ? JSON.parse(shown.stdout) : null;
  const code = await run({ root, argv: process.argv.slice(2), bucket: r2Bucket(env.fetch), deployed });
  console.log(`VITE_ASSET_BASE (the repository variable ASSET_BASE): ${assetBase()}`);
  return code;
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
