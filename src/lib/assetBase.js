// Where a heavy asset is fetched from. scripts/assets-upload.mjs puts the
// big models and textures in a Supabase Storage bucket by content hash and
// writes src/data/assets-manifest.json; with VITE_ASSET_BASE set at build,
// a path the manifest names is asked of the bucket (its CDN, a year's cache),
// anything else of the site as before. The build keeps only the entries whose
// file on disk still has that hash (scripts/assets-manifest.mjs), so the bytes
// are the same either way and nothing drawn changes. The first remote failure
// (the bucket down, or blocked by a network or an extension) sends that load
// and every later one to the local file for the rest of the visit, so a
// visitor who can't reach the bucket sees the site as it was. A 404 on one
// hashed URL (the manifest and the bucket out of step) sends that file alone
// to the site; an abort (its world left) is passed on, never a fallback.
//
// assetUrl(path, { base, manifest }) → the URL to fetch
// withFallback(load, { base, manifest, wait }) → (path) => load(remote), else load(path) once
//   (the remote given `wait` ms until the bucket has answered once this visit)
// markDown(), isDown(), forgetDown() (a new visit; tests): lib/assetDown's, re-exported

import MANIFEST from '../data/assets-manifest.json';
import { remotePath } from './assetPath';

import { WAIT_MS, answered, isDown, markAnswered, markDown } from './assetDown';

// (the bucket's up-or-down state lives in lib/assetDown, with no manifest;
// re-exported here, so a caller of either reads the one state)
export { SLOW_RATE, WAIT_MS, answered, forgetDown, isDown, markAnswered, markDown, waitFor } from './assetDown';

export function assetUrl(path, { base = import.meta.env?.VITE_ASSET_BASE, manifest = MANIFEST } = {}) {
  return isDown() ? path : remotePath(path, base, manifest);
}

export function withFallback(load, opts) {
  return (path) => {
    const url = assetUrl(path, opts);
    if (url === path) return load(path);
    const wait = opts?.wait ?? WAIT_MS;
    const asked = Promise.resolve().then(() => load(url));
    let timer = null;
    const timed = answered()
      ? asked
      : Promise.race([asked, new Promise((_, no) => (timer = setTimeout(() => no(new Error('the asset base did not answer')), wait)))]).finally(() => clearTimeout(timer));
    return timed
      .then((got) => {
        markAnswered();
        return got;
      })
      .catch((e) => {
        // (a world left mid-load: stopped, not failed, and nothing local asked)
        if (e?.name === 'AbortError') throw e;
        // (a file the bucket lacks, a 404 on its hashed URL, is this file's
        // miss, not the bucket down: the site's copy, and the bucket stays on)
        if (!e?.missing) markDown();
        return load(path);
      });
  };
}
