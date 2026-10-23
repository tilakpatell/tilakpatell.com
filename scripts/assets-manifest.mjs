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
// (with a base, the manifest is a module of its own whose default is one
// JSON.parse of its text: V8 evaluated the 77,510 entries as Vite's object
// literal in 525 ms, as JSON.parse in 220 to 275; the every-chip-plays
// design, 2026-10-13. Vite 8 keeps a JSON module an object literal
// whatever json.stringify says, so the text is served as script here.)
const VIRTUAL = '\0tp-asset-manifest.js';

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
    async resolveId(source, importer, opts) {
      if (!base || !String(source).endsWith('assets-manifest.json')) return null;
      const got = await this.resolve(source, importer, { ...opts, skipSelf: true });
      return got && slashed(got.id.split('?')[0]) === slashed(file) ? VIRTUAL : null;
    },
    load(id) {
      if (id === VIRTUAL) {
        // (the dev server reloads it when the manifest is written again)
        this?.addWatchFile?.(file);
        return `export default JSON.parse(${JSON.stringify(JSON.stringify(bundledManifest(root, publicDir)))});`;
      }
      if (slashed(id.split('?')[0]) !== slashed(file)) return null;
      return base ? JSON.stringify(bundledManifest(root, publicDir)) : '{}';
    },
    // (the bucket is another origin, its own domain on Cloudflare: the page
    // opens the connection as its head is read, so the first heavy file a
    // world asks for doesn't wait on a DNS look-up and a TLS handshake after
    // the bundle has come. `crossorigin`: three's loaders ask it with CORS,
    // and a connection opened without is not the one they'd use)
    transformIndexHtml() {
      let origin = null;
      try {
        origin = /^https?:/.test(base) ? new URL(base).origin : null;
      } catch {
        origin = null;
      }
      return origin ? [{ tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head' }] : [];
    },
  };
}
