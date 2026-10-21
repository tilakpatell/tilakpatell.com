// A light record's grading LUTs re-cut at the game's whole 33³ (lane D2:
// the picture-everywhere design §3.4), leaving every other number in the
// record as scripts/bf2017-light.mjs wrote it. Each weather's `source` is
// the VisualEnvironment records it was read from, in order; the last one
// that names a ColorGrading LUT is the weather's (mergeVE's rule), and its
// 33 slices become a 33² × 33 strip at the weather's `grading.lut`, with
// `lutSize: 33`.
//
//   node scripts/bf2017-lut.mjs <world>[,<world>…] | --all [--dry]
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs) from
// the environment, never printed. Behind a proxy, NODE_USE_ENV_PROXY=1.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { lutStrip, mergeVE, readVE, toComponents } from './lib/bf2017-light.mjs';
import { NO_KEYS, bucketEnv, objectUrl } from './lib/bucket.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'lab/assets/bf2017');
const BUCKET = 'bf2017-assets';
const RECORDS = join(ROOT, 'src/data/bf2017/light');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const worlds = args.includes('--all')
  ? readdirSync(RECORDS)
      .filter((f) => /^[a-z_]+\.json$/.test(f))
      .map((f) => f.replace(/\.json$/, ''))
  : (args.find((a) => !a.startsWith('--')) ?? '').split(',').filter(Boolean);
if (!worlds.length) {
  console.error('node scripts/bf2017-lut.mjs <world>[,<world>…] | --all [--dry]');
  process.exit(2);
}
const env = bucketEnv();
if (!env) {
  console.error(NO_KEYS);
  process.exit(2);
}

async function get(path) {
  const file = join(CACHE, path);
  if (existsSync(file)) return readFileSync(file);
  const url = objectUrl(BUCKET, path);
  for (let i = 0; i < 4; i++) {
    try {
      const res = await env.fetch(url);
      if (res.status >= 400 && res.status < 500) return null;
      if (res.ok) {
        const body = Buffer.from(await res.arrayBuffer());
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, body);
        return body;
      }
    } catch {
      // (a network fault: tried again below)
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`could not fetch ${path}`);
}
const record = async (name) => {
  const b = await get(`data/${name}.json.gz`);
  return b ? readVE(toComponents(JSON.parse(gunzipSync(b).toString('utf8')))) : null;
};

const manifest = (await get('web/textures.jsonl')).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byName = new Map(manifest.map((t) => [t.name.toLowerCase(), t]));
for (const world of worlds) {
  const file = join(RECORDS, `${world}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  let changed = 0;
  for (const [w, e] of Object.entries(json.weathers ?? {})) {
    if (!e.grading?.lut) continue;
    let read = null;
    for (const name of e.source ?? []) {
      const r = await record(name);
      if (r) read = read ? mergeVE(read, r) : r;
    }
    const t = read?.grading?.lut ? byName.get(read.grading.lut.toLowerCase()) : null;
    if (t?.type !== 'volume' || t.depth !== t.width || t.width !== t.height) {
      console.log(`${world} ${w}: no LUT cube in the bucket for ${read?.grading?.lut ?? 'its records'}; left as it was`);
      continue;
    }
    const n = t.width;
    const slices = [];
    for (const f of t.files) {
      const { data } = await sharp(await get(`web/${f}`)).raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true });
      slices.push(new Uint16Array(data.buffer, data.byteOffset, data.length / 2));
    }
    const png = await sharp(Buffer.from(lutStrip(slices, n)), { raw: { width: n * n, height: n, channels: 3 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    console.log(`${world} ${w}: ${t.name} ${n}³ (was ${e.grading.lutSize}³), ${(png.length / 1024).toFixed(1)} KB → ${e.grading.lut}`);
    if (!dry) writeFileSync(join(ROOT, 'public', e.grading.lut), png);
    e.grading.lutSize = n;
    changed++;
  }
  if (!dry && changed) writeFileSync(file, `${JSON.stringify(json, null, 1)}\n`);
}
