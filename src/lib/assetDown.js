// Whether the asset base (the public bucket, lib/assetBase) is answering
// this visit, kept apart from the manifest: runtime/install.js reads it on
// every page, and through lib/assetBase it carried the whole manifest
// (77,510 entries, 9 MB of script, 1.4 MB gzipped, half a second of
// evaluation) into the site's first load, the classic home page's too
// (the every-chip-plays design, 2026-10-13). lib/assetBase re-exports all
// of it, so its callers read the one state.
//
// markDown(), isDown(), forgetDown() (a new visit; tests), answered(),
// markAnswered(), WAIT_MS, SLOW_RATE, waitFor(bytes) → ms

let down = false;
let heard = false; // (the bucket has given one file this visit: a slow one after is a big one, not a dead host)
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
export const answered = () => heard;
export const markAnswered = () => {
  heard = true;
};
export const forgetDown = () => {
  down = false;
  heard = false;
};
