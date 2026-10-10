// The site's published game-derived files (the Battlefront II (2017)
// pipeline's GLBs, their cuts and the clip packs), which live in the public
// bucket `site-assets` and not in git: eleven gigabytes cannot. The manifest
// src/data/galaxyAssets.json says what is there, { [site path]: { hash,
// bytes, from, tier } }, and is the only thing committed; scripts/
// assets-publish.mjs writes it, scripts/assets-check.mjs holds the bucket to
// it, and the build hands its entries to the loaders beside the mirrored
// heavy files' (scripts/assets-manifest.mjs, src/lib/assetBase.js).
//
// A file is published where the bucket's mirror already puts one, at
// `<hash12>/<path>` (scripts/assets-upload.mjs's keyOf), so the site's URL
// rule (src/lib/assetPath.js), the service worker and the installer need
// nothing new to read it.
//
// hashOf(buf) → 12 hex; publishedPath(path, hash) → '<hash>/<path>'
// readManifest(file) / writeManifest(file, entries): keys sorted
// diff(manifest, files) → { add, change, same, gone }
// gameFiles(credits, publicDir) → [{ path, bytes, hash, from, tier }]
// freshGalaxy(manifest, publicDir) → the entries a build may use
// ignoreBlock(gitignore, paths) → the text with its marked block rewritten
// bytesOf(path, { publicDir, manifest }) → a file's size, on disk or published
// onSite(path, { publicDir, manifest }) → whether the site has it, on disk or published
// KEPT: the published files git keeps as well

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashOf, keyOf, readManifest as readJson } from '../assets-upload.mjs';

export { hashOf };
export const MANIFEST = 'src/data/galaxyAssets.json';
// the game's page, as scripts/bf2017-import.mjs writes it into every credit
export const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
const TITLE = 'Star Wars Battlefront II (2017): ';
// the clip packs and anything else the pipeline makes outside a kind's file
const PACKS = 'models/galaxy/bf2017';
// the game's films (scripts/bf2017-ui.mjs): the WebM only, its poster and
// captions beside it stay committed
const FILMS = 'films/bf2017';
const CUTS = ['lod1', 'far', 'ultra'];

const bare = (path) => path.replace(/^\/+/, '');
export const publishedPath = (path, hash) => keyOf({ hash, path: bare(path) });

export const readManifest = (file) => readJson(file);
export function writeManifest(file, entries) {
  const sorted = Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((k) => [k, entries[k]]),
  );
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function diff(manifest, files) {
  const add = [];
  const change = [];
  const same = [];
  for (const f of files) {
    const had = manifest[f.path];
    if (!had) add.push(f);
    else if (had.hash !== f.hash) change.push(f);
    else same.push(f);
  }
  const here = new Set(files.map((f) => f.path));
  return { add, change, same, gone: Object.keys(manifest).filter((p) => !here.has(p)) };
}

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);
const measure = (publicDir, path) => {
  const buf = readFileSync(join(publicDir, path));
  return { bytes: buf.length, hash: hashOf(buf) };
};

// What the pipeline made from the game and is here to publish: every file a
// credit from the game names (crew or surface), each of its cuts beside it
// (.lod1, .far, .ultra), and everything under models/galaxy/bf2017 (the clip
// packs), and the game's films under films/bf2017. Meshy's, Sketchfab's and
// Quaternius's stay committed: their credits name another source. Sorted by
// path.
export function gameFiles(credits, publicDir) {
  const out = new Map();
  for (const c of Object.values(credits)) {
    if (c?.source !== GAME || !c.file) continue;
    const from = c.title?.startsWith(TITLE) ? c.title.slice(TITLE.length) : c.file;
    const plain = bare(c.file);
    const tier = plain.includes('/crew/') ? 'crew' : 'surface';
    const stem = plain.replace(/\.glb$/, '');
    for (const [path, t] of [[plain, tier], ...CUTS.map((cut) => [`${stem}.${cut}.glb`, cut === 'ultra' ? 'ultra' : tier])]) {
      if (existsSync(join(publicDir, path))) out.set(path, { path, ...measure(publicDir, path), from, tier: t });
    }
  }
  for (const abs of walk(join(publicDir, PACKS))) {
    const path = abs.slice(publicDir.length + 1).split('\\').join('/');
    if (!out.has(path)) out.set(path, { path, ...measure(publicDir, path), from: path, tier: 'pack' });
  }
  for (const abs of walk(join(publicDir, FILMS)).filter((f) => f.endsWith('.webm'))) {
    const path = abs.slice(publicDir.length + 1).split('\\').join('/');
    out.set(path, { path, ...measure(publicDir, path), from: path, tier: 'film' });
  }
  return [...out.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

// The entries a build may use. A published file is not in a checkout (git
// ignores it), so one that isn't here is taken on the manifest's word (and
// assets-check.mjs's); one that is here with another hash was made again and
// not published yet, so the site's own copy wins, never a stale one.
export function freshGalaxy(manifest, publicDir) {
  return Object.fromEntries(
    Object.entries(manifest).filter(([path, e]) => {
      const abs = join(publicDir, path);
      if (!existsSync(abs)) return true;
      return statSync(abs).size === e.bytes && hashOf(readFileSync(abs)) === e.hash;
    }),
  );
}

export const IGNORE_START = '# galaxy assets (published; scripts/assets-publish.mjs)';
export const IGNORE_END = '# end galaxy assets';
// The published files that stay in git too: the skeleton and the clip
// packs the tests read whole (walrusSocket, socket and bf2017-skeleton's:
// under 3 MB together), which a checkout without the bucket must still have
export const KEPT = new Set(['models/galaxy/bf2017/walrus.glb', 'models/galaxy/bf2017/clips-humanoid.glb', 'models/galaxy/bf2017/clips-luke.glb']);

export function ignoreBlock(text, paths) {
  const block = [IGNORE_START, ...[...paths].filter((p) => !KEPT.has(bare(p))).sort().map((p) => `/public/${bare(p)}`), IGNORE_END].join('\n');
  const a = text.indexOf(IGNORE_START);
  const b = text.indexOf(IGNORE_END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + IGNORE_END.length);
  return `${text.replace(/\n*$/, '\n')}\n${block}\n`;
}

// Whether the site has a file: in public/, or published (a checkout
// without the bucket's files, as CI's is, takes the manifest's word)
export const onSite = (path, { publicDir, manifest }) => existsSync(join(publicDir, bare(path))) || Boolean(manifest[bare(path)]);

// A file's size for a test that caps it: on disk where it is, else as
// published, else an error naming it (a test that can't measure a file says
// which).
export function bytesOf(path, { publicDir, manifest }) {
  const abs = join(publicDir, bare(path));
  if (existsSync(abs)) return statSync(abs).size;
  const e = manifest[bare(path)];
  if (e) return e.bytes;
  throw new Error(`${bare(path)}: not in public/ and not published (src/data/galaxyAssets.json)`);
}
