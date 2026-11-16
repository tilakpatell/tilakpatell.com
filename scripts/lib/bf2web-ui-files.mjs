// The files of a build's ui-data folder that go up, as paths relative to the folder with forward slashes, sorted: the rulebooks at its root
// and the menu backdrop's manifest, stills and tone data in backdrop/ (bf2-web's frontend/ui/backdrop.js reads /ui-data/backdrop/backdrop.json
// and, by naming, each still's <name>.tone.bin). Until 16 Nov 2026 only .json and .png went up, and every backdrop *.tone.bin was a 404 on live
// (the blurred panels lost their tone source) with nothing saying so. A file of another kind (a stray notes.txt) is still left out, as the
// publish contract has it (scripts/desktop/bf2web-publish.test.mjs), but no longer in silence: uiDataLeftOut names each, and the uploader and
// the fill print them.
import { readdirSync } from 'node:fs';
import { brotliCompress, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { attemptUpload } from './bf2web-upload-response.mjs';

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

// Each missing file put with attemptUpload's tries (three, 1 s then 4 s apart): the first live fill (16 Nov, run 43922315104) sent 14 of
// 18 and ended on one connection reset ('other side closed'). put(file) resolves to a fetch Response; a non-2xx answer is tried again too.
export async function sendEach(files, put, { sleep } = {}) {
  for (const f of files) {
    await attemptUpload(`put ${f.path}`, async () => {
      const r = await put(f);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }, sleep ? { sleep } : undefined);
  }
}

// A ui-data file the Worker answers a br client with from its brotli copy <path>.br (cloudflare/play.js buildUiData): one of an
// octet-stream kind, which neither Cloudflare nor the Worker compresses (play.js contentType has no type for .bin), the backdrop's
// *.tone.bin (R10G10B10A2 grey, 8.3 MB a camera, 16.6 MB wide: q11 makes 2.7 and 2.2 MB). The rulebooks (json) Cloudflare compresses;
// the stills (png) are compressed already.
export const uiDataBrotli = (path) => /\.bin$/i.test(path);

// its brotli copy, at the quality a release uses (q11, a 16 MB window), or null when it would save less than a tenth (no copy
// is then put, and the Worker sends the file itself), as scripts/bf2web-compress.mjs has it for the build's own files
const brotli = promisify(brotliCompress);
export async function brotliCopy(body, quality = 11) {
  const br = await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: quality, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } });
  return br.length <= body.length * 0.9 ? br : null;
}
