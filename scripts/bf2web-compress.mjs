// Brotli copies of a bf2-web build's binary files, for the Worker to send to a browser that takes brotli
// (docs/decisions/2026-10-28-bf2web-pipeline.md, cloudflare/play.js). Cloudflare compresses the engine and the JSON on
// its own; the textures, the scene data and the collision it sends as they are, and they are most of a first visit
// (2026-10-28, main-da7a51b3: about 2.07 GB on the wire, some 1.57 with these). Each copy is <key>.br beside its file,
// kept only when it saves a tenth; one there already is skipped, so a run cut off is run again from where it stopped;
// encodings.json, listing them, goes last, and the Worker serves none until it is there.
//
//   node --env-file=.env.local scripts/bf2web-compress.mjs [--build <id>] [--quality 9] [--pool 4] [--dry]
//     --build: default the one src/data/bf2web/play.json names

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { contentType } from '../cloudflare/play.js';
import { objectUrl } from './lib/bucket.mjs';
import { BUCKET, open } from './lib/bf2web-r2.mjs';
import { compressible, encodingsOf } from './lib/bf2web-site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const id = option('--build', JSON.parse(readFileSync(join(ROOT, 'src/data/bf2web/play.json'), 'utf8')).build);
const quality = Number(option('--quality', 9));
const pool = Number(option('--pool', 4));
const brotli = promisify(brotliCompress);
if (!/^[A-Za-z0-9._-]+$/.test(id ?? '')) throw new Error('usage: bf2web-compress.mjs [--build <id>] [--quality 9] [--pool 4] [--dry]');

const r2 = open();
const prefix = `sites/${id}/`;
const manifest = await r2.json(prefix + 'manifest.json');
if (!manifest) throw new Error(`${id}: no manifest.json in the bucket`);
const there = new Map((await r2.files(prefix)).map((f) => [f.key, f.size]));
const todo = compressible(manifest, contentType);
const raw = todo.reduce((n, e) => n + e.bytes, 0);
const sizes = new Map();
for (const e of todo) if (there.has(prefix + e.path + '.br')) sizes.set(e.path, there.get(prefix + e.path + '.br'));
console.log(`${id}: ${todo.length} binary files, ${Math.round(raw / 1e6)} MB; ${sizes.size} copies there already`);
if (args.includes('--dry')) process.exit(0);

async function attempt(what, fn) {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (error) {
      if (n === 3) throw new Error(`${what}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 4 ** (n - 1)));
    }
  }
}

let done = 0;
let kept = 0;
const queue = todo.filter((e) => !sizes.has(e.path));
const total = queue.length;
await Promise.all(
  Array.from({ length: pool }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const body = await attempt(`get ${e.path}`, async () => {
        const r = await r2.fetch(objectUrl(BUCKET, prefix + e.path));
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      });
      const br = await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: quality, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } });
      // (a copy that saves less than a tenth isn't worth a second object)
      if (br.length <= body.length * 0.9) {
        await attempt(`put ${e.path}.br`, async () => {
          const r = await r2.fetch(objectUrl(BUCKET, prefix + e.path + '.br'), { method: 'PUT', body: br, headers: { 'content-md5': createHash('md5').update(br).digest('base64'), 'content-type': 'application/octet-stream' } });
          if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
        });
        sizes.set(e.path, br.length);
        kept++;
      }
      if (++done % 100 === 0) console.log(`  ${done} of ${total}`);
    }
  }),
);
const encodings = encodingsOf(sizes, quality);
const body = JSON.stringify(encodings);
await attempt('put encodings.json', async () => {
  const r = await r2.fetch(objectUrl(BUCKET, prefix + 'encodings.json'), { method: 'PUT', body, headers: { 'content-type': 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
});
const saved = [...sizes].reduce((n, [p, size]) => n + (todo.find((e) => e.path === p)?.bytes ?? 0) - size, 0);
console.log(`${id}: ${kept} copies made, ${sizes.size} listed; a first visit ${Math.round(saved / 1e6)} MB smaller`);
