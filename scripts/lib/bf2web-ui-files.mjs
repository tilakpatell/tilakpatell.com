// The files of a build's ui-data folder that go up: ALL of them, as paths relative to the folder with forward slashes, sorted. That is the
// rulebooks at its root and the menu backdrop's manifest, stills and tone data in backdrop/ (bf2-web's frontend/ui/backdrop.js reads
// /ui-data/backdrop/backdrop.json and, by naming, each still's <name>.tone.bin). Until 16 Nov 2026 only .json and .png went up, and every
// backdrop *.tone.bin was a 404 on live (the blurred panels lost their tone source) with nothing saying so. A file of a kind the
// page's server has no type for is refused by name, never dropped, so a new kind of ui-data stops the upload instead of breaking live.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// (the kinds a build's ui-data holds: the rulebooks and manifests, the stills, the tone data)
export const UI_DATA_KINDS = ['json', 'png', 'bin'];

export function uiDataFiles(root, rel = '') {
  return readdirSync(join(root, rel), { withFileTypes: true })
    .flatMap((e) => {
      if (e.isDirectory()) return uiDataFiles(root, `${rel}${e.name}/`);
      const kind = /\.([a-z0-9]+)$/i.exec(e.name)?.[1]?.toLowerCase();
      if (!UI_DATA_KINDS.includes(kind)) throw new Error(`ui-data file of a kind not uploaded: ${rel}${e.name} (kinds: ${UI_DATA_KINDS.join(', ')}; add it, or keep it out of ui-data)`);
      return [`${rel}${e.name}`];
    })
    .sort();
}

// What a published build's bucket prefix lacks of its ui-data folder (scripts/bf2web-ui-data-fill.mjs): local [{ path, size }], remote
// [{ key, size }] relative to sites/<build>/ui-data/. A file the bucket has at another size means the folder is not this build's.
export function fillPlan(local, remote) {
  const have = new Map(remote.map((r) => [r.key, r.size]));
  const mismatched = local.filter((f) => have.has(f.path) && have.get(f.path) !== f.size);
  return { missing: local.filter((f) => !have.has(f.path)), mismatched };
}
