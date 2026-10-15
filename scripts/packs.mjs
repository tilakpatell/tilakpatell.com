// After `vite build`: each world's pack as a manifest the install reads
// (src/runtime/install.js): its page's JS and CSS chunks (from the bundler's
// dist/.vite/manifest.json, every chunk the page can import, now or later)
// and the files its pack.js names under public/, each with its size and a
// content hash, and `v`, a hash over them all, so a deploy that changes one
// file is a new version and an old install is not served for it. Writes
// dist/packs/<slug>.json and dist/packs/index.json ({ [to]: { slug, bytes, v } }).
// A Vite plugin (vite.config.js), and a CLI to run again over a dist/.
// Fails the build when a world's source names an asset its pack misses
// (scripts/pack-check.mjs).
//
// A file the asset bucket holds (VITE_ASSET_BASE and src/data/assets-manifest.json)
// is listed by its remote URL and the upload's hash, with `local`, its path here.
//
// A game-derived file the bucket alone holds (src/data/galaxyAssets.json; git
// ignores the file) is listed the same way from the manifest's hash and bytes,
// when the build has a base; without one the site can't load it either.
//
// buildManifest(pack, { dist, publicDir, chunksOf, remote }) → { v, id, bytes, files: [{ url, bytes, hash, local? }] }

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globRe, missing, undeclared } from './pack-check.mjs';
import { readManifest } from './assets-upload.mjs';
import { bundledManifest, galaxyPath } from './assets-manifest.mjs';
import { remotePath } from '../src/lib/assetPath.js';

export const slugOf = (to) => to.replace(/\//g, '-').replace(/^-/, '');
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);

// the chunks a page module can reach, static and dynamic imports both, from the bundler's manifest
export function chunksFrom(manifest, pages) {
  const urls = new Set();
  const seen = new Set();
  const visit = (key) => {
    const c = manifest[key];
    if (!c || seen.has(key)) return;
    seen.add(key);
    for (const f of [c.file, ...(c.css ?? []), ...(c.assets ?? [])]) if (f) urls.add(`/${f}`);
    // (not through the app's entry: it can import every page, and is loaded anyway)
    if (c.isEntry) return;
    for (const k of [...(c.imports ?? []), ...(c.dynamicImports ?? [])]) visit(k);
  };
  for (const p of pages) visit(p);
  return [...urls];
}

export async function buildManifest(pack, { dist, publicDir, chunksOf = () => [], remote = null }) {
  const disk = walk(publicDir).map((f) => `/${relative(publicDir, f).split('\\').join('/')}`);
  // (and the files the bucket alone holds, which no checkout has)
  const onDisk = new Set(disk);
  const pub = [...disk, ...(remote?.base ? Object.keys(remote.manifest).map((k) => `/${k}`).filter((u) => !onDisk.has(u)) : [])];
  const res = (pack.globs ?? []).map(globRe);
  const urls = new Set([...(pack.urls ?? []), ...pub.filter((u) => res.some((re) => re.test(u))), ...chunksOf(pack.id)]);
  const files = [...urls].sort().flatMap((url) => {
    const path = [join(dist, url), join(publicDir, url)].find((p) => existsSync(p) && statSync(p).isFile());
    if (!path) {
      const far = remote?.base ? remotePath(url, remote.base, remote.manifest) : url;
      // (`remoteOnly`: the site has no copy, so the installer keeps asking the bucket)
      return far === url ? [] : [{ url: far, bytes: remote.manifest[url.slice(1)].bytes, hash: remote.manifest[url.slice(1)].hash, local: url, remoteOnly: true }];
    }
    const buf = readFileSync(path);
    // (a file the bucket holds: fetched from there, by the hash in its path,
    // and the site's own path kept for the install's fallback)
    const far = remote ? remotePath(url, remote.base, remote.manifest) : url;
    if (far !== url) return [{ url: far, bytes: buf.length, hash: remote.manifest[url.slice(1)].hash, local: url }];
    return [{ url, bytes: buf.length, hash: sha(buf) }];
  });
  const v = sha(files.map((f) => `${f.url} ${f.hash}`).join('\n'));
  return { v, id: pack.id, bytes: files.reduce((s, f) => s + f.bytes, 0), files };
}

// every world's manifest and the index, into dist/packs; throws when a pack is out of step
async function writePacks(root, dist = join(root, 'dist'), log = console.log, base = process.env.VITE_ASSET_BASE ?? '') {
  const publicDir = join(root, 'public');
  // the files the bucket holds, as the bundle's manifest has them (scripts/assets-manifest.mjs)
  const remote = base ? { base, manifest: bundledManifest(root, publicDir) } : null;
  const published = Object.keys(readManifest(galaxyPath(root))).map((k) => `/${k}`);
  const { PACKS } = await import(pathToFileURL(join(root, 'src/components/worlds/packs.js')).href);
  const bad = Object.values(PACKS).flatMap((p) => [...undeclared((p.src ?? []).map((s) => join(root, s)), p), ...missing(p, publicDir, published)].map((r) => `${p.id}: ${r}`));
  if (bad.length) throw new Error(`packs: not in step with the source (node scripts/pack-check.mjs):\n  ${bad.join('\n  ')}`);
  const bundled = join(dist, '.vite/manifest.json');
  if (!existsSync(bundled)) throw new Error('packs: no dist/.vite/manifest.json (vite.config.js build.manifest)');
  const manifest = JSON.parse(readFileSync(bundled, 'utf8'));
  await mkdir(join(dist, 'packs'), { recursive: true });
  const index = {};
  for (const pack of Object.values(PACKS)) {
    const m = await buildManifest(pack, { dist, publicDir, chunksOf: () => chunksFrom(manifest, pack.pages ?? []), remote });
    const slug = slugOf(pack.id);
    await writeFile(join(dist, 'packs', `${slug}.json`), JSON.stringify(m));
    index[pack.id] = { slug, bytes: m.bytes, v: m.v };
    log(`  ${(m.bytes / 1048576).toFixed(1).padStart(7)} MB  ${String(m.files.length).padStart(5)} files  ${pack.id}`);
  }
  await writeFile(join(dist, 'packs', 'index.json'), JSON.stringify(index));
  return index;
}

// the build's own step (vite.config.js), so `vite build` alone writes the packs
export default function packs() {
  let root = process.cwd();
  let outDir = 'dist';
  let base = '';
  let failed = false;
  return {
    name: 'world-packs',
    apply: 'build',
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
      base = c.env?.VITE_ASSET_BASE ?? '';
    },
    buildStart() {
      failed = false;
    },
    buildEnd(error) {
      if (error) failed = true;
    },
    renderError() {
      failed = true;
    },
    async closeBundle(error) {
      if (error || failed) return;
      const index = await writePacks(root, outDir, () => {}, base);
      console.log(`packs: ${Object.keys(index).length} worlds written to dist/packs`);
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const index = await writePacks(root);
    console.log(`packs: ${Object.keys(index).length} worlds written to dist/packs`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
