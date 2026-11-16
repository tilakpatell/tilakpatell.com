// The files of a build's ui-data folder that go up, as paths relative to the folder with forward slashes, sorted: the rulebooks at its root
// and the menu backdrop's manifest, stills and tone data in backdrop/ (bf2-web's frontend/ui/backdrop.js reads /ui-data/backdrop/backdrop.json
// and, by naming, each still's <name>.tone.bin). Until 16 Nov 2026 only .json and .png went up, and every backdrop *.tone.bin was a 404 on live
// (the blurred panels lost their tone source) with nothing saying so. A file of another kind (a stray notes.txt) is still left out, as the
// publish contract has it (scripts/desktop/bf2web-publish.test.mjs), but no longer in silence: uiDataLeftOut names each, and the uploader and
// the fill print them.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// (the kinds a build's ui-data holds for the page: the rulebooks and manifests, the stills, the tone data)
export const UI_DATA_KINDS = ['json', 'png', 'bin'];

function walk(root, rel = '', out = { files: [], leftOut: [] }) {
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.isDirectory()) walk(root, `${rel}${e.name}/`, out);
    else (UI_DATA_KINDS.includes(/\.([a-z0-9]+)$/i.exec(e.name)?.[1]?.toLowerCase()) ? out.files : out.leftOut).push(`${rel}${e.name}`);
  }
  return out;
}

export function uiDataFiles(root) {
  return walk(root).files.sort();
}

// the files of the folder that do not go up, named so the uploader can say so
export function uiDataLeftOut(root) {
  return walk(root).leftOut.sort();
}

// What a published build's bucket prefix lacks of its ui-data folder (scripts/bf2web-ui-data-fill.mjs): local [{ path, size }], remote
// [{ key, size }] relative to sites/<build>/ui-data/. A file the bucket has at another size means the folder is not this build's.
export function fillPlan(local, remote) {
  const have = new Map(remote.map((r) => [r.key, r.size]));
  const mismatched = local.filter((f) => have.has(f.path) && have.get(f.path) !== f.size);
  return { missing: local.filter((f) => !have.has(f.path)), mismatched };
}
