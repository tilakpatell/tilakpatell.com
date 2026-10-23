// The worlds' pictures under their own hash, served by the site itself (the
// Worker's files, on Cloudflare's edge): each picture under PICTURES that
// the bucket doesn't hold is copied, at build, to `h/<hash12>/<path>` beside
// the build's files, and src/data/site-hashes.json (`{}` committed, filled
// at build) tells the loaders the hash, so lib/assetBase asks for that path.
// A path that is its content's hash never changes, so it's cached a year
// and never asked again (public/_headers' `/h/*`); a picture changed by a
// deploy gets a new path, so no visitor draws an old one. The bucket's way
// (scripts/assets-upload.mjs) does the same from R2 with the owner's keys;
// this needs none and runs on every build. The development server gives
// `{}`: every picture by its own path, as before.
//
//   siteHashes() → the Vite plugin
//   pictureHashes(publicDir, { skip }) → { [path]: hash12 } (`skip`: paths the bucket holds)

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { constants } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { hashOf } from './assets-upload.mjs';
import { bundledManifest } from './assets-manifest.mjs';

export const MANIFEST = 'src/data/site-hashes.json';
// (the folders of pictures a world's loaders ask through lib/assetLoad: its
// maps, the CC0 sets and the HDR skies)
export const PICTURES = ['textures', 'cc0', 'hdri'];
export const KINDS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif', '.ktx2', '.hdr', '.exr']);
// the folder they're served from (lib/assetBase's HERE)
export const UNDER = 'h';

const slashed = (p) => String(p).replace(/\\/g, '/');
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);

export function pictureHashes(publicDir, { skip = {} } = {}) {
  const out = {};
  for (const abs of PICTURES.flatMap((d) => walk(join(publicDir, d))).sort()) {
    if (!KINDS.has(extname(abs).toLowerCase())) continue;
    const path = slashed(abs.slice(publicDir.length + 1));
    if (skip[path]) continue; // (the bucket's: a year there already)
    out[path] = hashOf(readFileSync(abs));
  }
  return out;
}

const VIRTUAL = '\0tp-site-hashes.js';

export default function siteHashes() {
  let root = null;
  let file = null;
  let publicDir = null;
  let building = false;
  let base = '';
  let hashes = null;
  const made = () => (hashes ??= pictureHashes(publicDir, { skip: base ? bundledManifest(root, publicDir) : {} }));
  return {
    name: 'site-hashes',
    enforce: 'pre',
    configResolved(c) {
      root = c.root;
      file = join(c.root, MANIFEST);
      publicDir = c.publicDir;
      building = c.command === 'build';
      base = c.env?.VITE_ASSET_BASE ?? '';
    },
    // (one JSON.parse of the text, as the asset manifest is served: an object
    // literal of hundreds of entries is slower for the engine to take in)
    async resolveId(source, importer, opts) {
      if (!building || !String(source).endsWith('site-hashes.json')) return null;
      const got = await this.resolve(source, importer, { ...opts, skipSelf: true });
      return got && slashed(got.id.split('?')[0]) === slashed(file) ? VIRTUAL : null;
    },
    load(id) {
      if (id !== VIRTUAL) return null;
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(made()))});`;
    },
    // each picture copied under its hash, once the build's own files are out
    // (a reflink where the disk can: the same bytes, no second copy on it)
    writeBundle(options) {
      if (!building) return;
      const outDir = options.dir ?? join(root, 'dist');
      for (const [path, hash] of Object.entries(made())) {
        const to = join(outDir, UNDER, hash, path);
        if (existsSync(to)) continue;
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(join(publicDir, path), to, constants.COPYFILE_FICLONE);
      }
    },
  };
}
