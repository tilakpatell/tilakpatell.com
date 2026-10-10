// The asset manifest as the bundle sees it (vite.config.js): with
// VITE_ASSET_BASE set, src/data/assets-manifest.json less the entries whose
// file in public/ has changed since its upload (scripts/assets-upload.mjs's
// freshManifest), so a model edited and not uploaded again is fetched from
// the site, never stale from the bucket; without a base, empty, so a build
// that asks nothing remote carries none of it.
//
// With a base, the game-derived files the bucket alone holds
// (src/data/galaxyAssets.json, scripts/assets-publish.mjs) are added: each
// is taken on the manifest's word when it isn't on disk (git ignores them),
// and dropped when the file here has another hash (made again, not published
// yet: the site's copy wins). GALAXY_MANIFEST names another for a check.

import { join } from 'node:path';
import { MANIFEST, freshManifest, manifestPath, readManifest } from './assets-upload.mjs';
import { MANIFEST as GALAXY, freshGalaxy } from './lib/asset-manifest.mjs';

// the game-derived files' manifest, the committed one or a check's
export const galaxyPath = (root, env = process.env) => (env.GALAXY_MANIFEST ? env.GALAXY_MANIFEST : join(root, GALAXY));

// what the loaders may ask the bucket for: the mirrored heavy files and the
// published game-derived ones, each as { hash, bytes }
export function bundledManifest(root, publicDir, env = process.env) {
  const galaxy = freshGalaxy(readManifest(galaxyPath(root, env)), publicDir);
  return { ...freshManifest(readManifest(manifestPath(root, env)), publicDir), ...Object.fromEntries(Object.entries(galaxy).map(([k, e]) => [k, { hash: e.hash, bytes: e.bytes }])) };
}

const slashed = (p) => String(p).replace(/\\/g, '/');

export default function assetManifest() {
  let file = null;
  let root = null;
  let publicDir = null;
  let base = '';
  return {
    name: 'asset-manifest',
    enforce: 'pre',
    configResolved(c) {
      root = c.root;
      file = join(c.root, MANIFEST);
      publicDir = c.publicDir;
      base = c.env?.VITE_ASSET_BASE ?? '';
    },
    // (JSON text, which Vite's own JSON plugin then makes a module of; the id
    // Vite asks with has forward slashes whatever the platform, and node's
    // join gives Windows its backslashes, so both are read the one way: on a
    // Windows checkout the plugin never answered and the bundle carried an
    // empty manifest, every bucket file asked of the site instead)
    load(id) {
      if (slashed(id.split('?')[0]) !== slashed(file)) return null;
      return base ? JSON.stringify(bundledManifest(root, publicDir)) : '{}';
    },
  };
}
