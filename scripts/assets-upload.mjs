// The heavy assets to the Supabase Storage bucket, by content hash: each
// file under REMOTE of a heavy kind and 64 KB or more goes to
// `<hash12>/<path>` once, with a year's cache, never overwritten (a changed
// file is a new path, so a visitor on the old build still gets the old one),
// and src/data/assets-manifest.json says which paths the bucket holds. The
// site reads that manifest through src/lib/assetBase.js; the build keeps only
// the entries whose file on disk still has that hash (freshManifest), so a
// file changed and not uploaded again is served locally, never stale.
// Old paths go only with --prune, after the deploy that stopped naming them.
//
//   SUPABASE_SERVICE_ROLE_KEY=… node scripts/assets-upload.mjs [--dry] [--prune]
//
// The key is the owner's, read from their shell and from nowhere else (no
// file, no workflow); it is never printed. The script refuses to run in CI.
// The project's URL is read from .env.local's VITE_SUPABASE_URL (or the
// shell's). `public/` stays whole: GitHub Pages still serves every file,
// and the bucket is where the site asks first when VITE_ASSET_BASE is set.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// (the site's one public bucket: the game-derived files are published there
// too, by scripts/assets-publish.mjs, so one ASSET_BASE serves both)
export const BUCKET = 'site-assets';
// (textures/galaxy/bf2017/<role>/ and textures/galaxy/sky/: lane W's, the
// game's ground and trim maps and the levels' skies, mirrored once they land;
// textures/galaxy/planets/: lane K's planet skins)
// (the level packs under models/galaxy/bf2017/ are published by
// scripts/assets-publish.mjs, not mirrored here: lane E0)
export const REMOTE = ['hq/models', 'hq/tex', 'cc0/galaxy', 'models/gen3d', 'kit', 'textures/galaxy/bf2017', 'textures/galaxy/sky', 'textures/galaxy/planets'];
// (each one whole in itself: a .gltf's sidecars would not sit beside it under one hash)
export const KINDS = { '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.hdr': 'image/vnd.radiance', '.exr': 'image/x-exr' };
export const MIN_BYTES = 64 * 1024;
export const MANIFEST = 'src/data/assets-manifest.json';
const YEAR = '31536000';

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

// every key in the bucket (its listing is one folder deep a call, 1,000 at most)
async function storedKeys(bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`couldn't list ${prefix || 'the bucket'}: ${error.message}`);
    for (const e of data) {
      const at = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id) out.push(at);
      else out.push(...(await storedKeys(bucket, at)));
    }
    if (data.length < 1000) return out;
  }
}

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
  const plan = planUpload(files, await storedKeys(bucket), { ...(deployed ?? {}), ...published });
  log(`remote: ${files.length} files, ${mb(sum(files))} (${plan.upload.length} to upload, ${mb(sum(plan.upload))}; ${plan.keep.length} there already)`);
  log(`local: ${all.length - files.length} files, ${mb(all.reduce((s, f) => s + statSync(f).size, 0) - sum(files))}`);
  if (dry) {
    if (prune) log(`would prune ${plan.prune.length}`);
    return 0;
  }
  for (const f of plan.upload) {
    const body = readFileSync(join(publicDir, f.path));
    const { error } = await bucket.upload(keyOf(f), body, { cacheControl: YEAR, upsert: false, contentType: KINDS[extname(f.path).toLowerCase()] });
    // (there already, from a run cut off after the upload: the same bytes by hash)
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`couldn't upload ${f.path}: ${error.message}`);
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
    for (let i = 0; i < plan.prune.length; i += 100) {
      const { error } = await bucket.remove(plan.prune.slice(i, i + 100));
      if (error) throw new Error(`couldn't prune: ${error.message}`);
    }
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { projectFrom } = await import('./supabase-check.mjs');
  const url = (process.env.VITE_SUPABASE_URL || projectFrom(join(root, '.env.local'))?.url || '').replace(/\/$/, '');
  if (!key || !url) {
    console.log('set SUPABASE_SERVICE_ROLE_KEY in your shell (never in a file), and VITE_SUPABASE_URL in .env.local');
    return 2;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage;
  if (!process.argv.includes('--dry')) {
    const { error } = await storage.getBucket(BUCKET);
    if (error) {
      const made = await storage.createBucket(BUCKET, { public: true });
      if (made.error) throw new Error(`couldn't make the bucket: ${made.error.message}`);
      console.log(`made the public bucket ${BUCKET}`);
    }
  }
  // what the live site was built with: main's manifest
  const shown = spawnSync('git', ['show', `origin/main:${MANIFEST}`], { cwd: root, encoding: 'utf8' });
  const deployed = shown.status === 0 ? JSON.parse(shown.stdout) : null;
  const code = await run({ root, argv: process.argv.slice(2), bucket: storage.from(BUCKET), deployed });
  console.log(`VITE_ASSET_BASE (the repository variable ASSET_BASE): ${url}/storage/v1/object/public/${BUCKET}`);
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
