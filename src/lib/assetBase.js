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
// to the site; an abort (its world left) is passed on, never a fallback. A
// busy answer (a 429, or a 5xx) is the bucket up and loaded: that file is
// asked again after a wait (BUSY_WAITS), and only if it is still busy after
// them all is it asked of the site, the bucket kept for every other (one
// 429 among a level's first ninety files sent Kamino's every cell to a site
// that has no copy of them, 2026-10-21). Only a failure with no answer at
// all (blocked, the network gone, a timeout) is the bucket down.
//
// assetUrl(path, { base, manifest }) → the URL to fetch
// withFallback(load, { base, manifest, wait, waits }) → (path) => load(remote), else load(path) once
//   (the remote given `wait` ms until the bucket has answered once this visit;
//   `waits`, the ms between asks of a busy one)
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

// (the ms between asks of a busy bucket, and how many there are)
export const BUSY_WAITS = [500, 1500, 4000];
// the HTTP status a failure carries (ours, `status`; three's loaders', the response's), or null: no answer at all
const statusOf = (e) => e?.status ?? e?.response?.status ?? null;
const busy = (status) => status === 429 || status >= 500;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export function withFallback(load, opts) {
  return (path) => {
    const url = assetUrl(path, opts);
    if (url === path) return load(path);
    const wait = opts?.wait ?? WAIT_MS;
    const waits = opts?.waits ?? BUSY_WAITS;
    const asked = Promise.resolve().then(() => load(url));
    let timer = null;
    const timed = answered()
      ? asked
      : Promise.race([asked, new Promise((_, no) => (timer = setTimeout(() => no(new Error('the asset base did not answer')), wait)))]).finally(() => clearTimeout(timer));
    // (a busy bucket asked again, `waits` apart, before the site is)
    const again = (e, i) => (busy(statusOf(e)) && i < waits.length ? pause(waits[i]).then(() => load(url).catch((e2) => (e2?.name === 'AbortError' ? Promise.reject(e2) : again(e2, i + 1)))) : Promise.reject(e));
    return timed
      .catch((e) => (e?.name === 'AbortError' ? Promise.reject(e) : again(e, 0)))
      .then((got) => {
        markAnswered();
        return got;
      })
      .catch((e) => {
        // (a world left mid-load: stopped, not failed, and nothing local asked)
        if (e?.name === 'AbortError') throw e;
        // (a file the bucket lacks, a 404 on its hashed URL, or one it was
        // too busy to give, is this file's miss, not the bucket down: the
        // site's copy, and the bucket stays on)
        if (!e?.missing && statusOf(e) == null) markDown();
        return load(path);
      });
  };
}
