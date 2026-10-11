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
// markDown(), isDown(), forgetDown() (a new visit; tests)

import MANIFEST from '../data/assets-manifest.json';
import { remotePath } from './assetPath';

let down = false;
let answered = false; // (the bucket has given one file this visit: a slow one after is a big one, not a dead host)
// how long the first ask may go unanswered: a network that drops the bucket's
// packets silently would otherwise hold every load for the browser's own timeout
export const WAIT_MS = 12000;
// and for a big first file, as long as it takes at a slow link's rate
// (half a megabyte a second): the wait is the whole download, so a 21.6 MB
// ultra cut asked first, the Star Destroyer's (`_source`: src/data/
// galaxyAssets.json), took more than 12 s in a cloud container and marked a
// healthy bucket down, every later file then asked of a site that has no copy
// (lane S1, 2026-10-11)
export const SLOW_RATE = 0.5e6;
export const waitFor = (bytes) => Math.max(WAIT_MS, ((bytes ?? 0) / SLOW_RATE) * 1000);

export const markDown = () => {
  if (!down && import.meta.env?.DEV) console.warn('asset base unreachable: local files for this visit');
  down = true;
};
export const isDown = () => down;
export const forgetDown = () => {
  down = false;
  answered = false;
};

export function assetUrl(path, { base = import.meta.env?.VITE_ASSET_BASE, manifest = MANIFEST } = {}) {
  return down ? path : remotePath(path, base, manifest);
}

export function withFallback(load, opts) {
  return (path) => {
    const url = assetUrl(path, opts);
    if (url === path) return load(path);
    const wait = opts?.wait ?? WAIT_MS;
    const asked = Promise.resolve().then(() => load(url));
    let timer = null;
    const timed = answered
      ? asked
      : Promise.race([asked, new Promise((_, no) => (timer = setTimeout(() => no(new Error('the asset base did not answer')), wait)))]).finally(() => clearTimeout(timer));
    return timed
      .then((got) => {
        answered = true;
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
