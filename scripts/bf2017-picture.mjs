#!/usr/bin/env node
// A world's painted sky, fog gradient and cloud-shadow texture for lane Q6's
// picture (src/lib/three/light/grade.js), from the bf2017-assets bucket:
//
//   NODE_USE_ENV_PROXY=1 node scripts/bf2017-picture.mjs hoth
//
// For each weather in src/data/bf2017/light/<world>.json (lane G's), the
// weather's VisualEnvironment records (its `source`, later ones winning)
// name the textures; each is fetched as the desktop encoded it
// (web/<file>.ktx2, UASTC), copied beside the world's LUTs as
// public/textures/galaxy/bf2017/light/<world>/<weather>.<panorama|gradient|clouds>.ktx2,
// the cloud maps at CLOUD_SIZE (their top mips dropped: a 2,048 px map
// over the record's 8,192 m tile is 4 m a texel, and the shadow's blobs are
// soft), and the panorama's horizon row (its foot, linear 0…1) measured off the
// decoded texture for sky.js's gain. The manifest goes to
// src/data/bf2017/light/<world>.picture.json: per weather { record, lut, panorama:
// { url, name, horizon, size }, gradient: { url, name }, cloudShadow: { url, name } },
// the shape applyGameLight's `picture` takes (urls without the base) and the
// record's picture fields by name (`record`: grade.js's withPicture lays them
// over an entry that lacks them); a panorama or gradient lane W's desktop
// job has made HDR (scripts/desktop/bf2017-panoramas.mjs) gains `hdr: { url,
// widths, format }`. A
// texture the bucket lacks prints `missing:` and is left out; a weather whose
// record names no panorama (an interior under a ceiling, a space level) says
// so with `panorama: null`, and applyGameLight keeps the model's sky.
//
// The LUT is the game's whole 33³ (<weather>.lut33.png, a 1,089 × 33 strip:
// bf2017-light.mjs keeps every other point, 17³, for the classic surface's
// grade; the picture's LUT reads after a linear tonemap, where the upper
// tones the game lifts sit between the 17³'s points).
//
// The textures are published by hash (scripts/assets-publish.mjs, the
// manifest src/data/galaxyAssets.json), so git keeps none of them.
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (lib/bucket.mjs) from the environment.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { bucketFile } from './lib/bf2017-bucket.mjs';
import sharp from 'sharp';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { lutStrip } from './lib/bf2017-light.mjs';
import { hdrOf, pictureFields, picturedNames, recordOf, rowMean } from './lib/bf2017-picture.mjs';
import { gradeOf } from '../src/lib/three/light/grade.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLOUD_SIZE = 1024; // px: a cloud map's served width
const CACHE = join(ROOT, 'lab/assets/bf2017');
const world = process.argv[2];
if (!world) {
  console.error('usage: node scripts/bf2017-picture.mjs <world>');
  process.exit(2);
}
const light = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/light', `${world}.json`), 'utf8'));
const manifest = new Map(
  readFileSync(await bucketFile(CACHE, 'web/textures.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((t) => [t.name.toLowerCase(), t]),
);

// three's Basis transcoder, read and run for its factory (its file is a browser script)
const require = createRequire(import.meta.url);
const dir = dirname(require.resolve('three/examples/jsm/libs/basis/basis_transcoder.js'));
const src = readFileSync(join(dir, 'basis_transcoder.js'), 'utf8');
const BASIS = new Function('module', 'exports', '__filename', '__dirname', 'require', `${src}\nreturn BASIS;`)(undefined, undefined, join(dir, 'basis_transcoder.js'), dir, require);
const basis = await BASIS({ wasmBinary: readFileSync(join(dir, 'basis_transcoder.wasm')) });
basis.initializeBasis();
const decode = (buf) => {
  const k = new basis.KTX2File(new Uint8Array(buf));
  if (!k.isValid() || !k.startTranscoding()) throw new Error('not a KTX2 the transcoder reads');
  const RGBA32 = 13;
  const out = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
  k.transcodeImage(out, 0, 0, 0, RGBA32, 0, -1, -1);
  const r = { width: k.getWidth(), height: k.getHeight(), rgba: out };
  k.close();
  k.delete();
  return r;
};

// The record's grading LUT, all 33 slices (textures.jsonl's volume), as
// one strip beside the 17³; null where the bucket has no cube by that name
async function fullLut(w, name) {
  const t = manifest.get(name.toLowerCase());
  if (t?.type !== 'volume' || t.width !== t.height || t.depth !== t.width) {
    console.log(`  ${w}: the LUT ${name} is not a cube in the bucket`);
    return null;
  }
  const n = t.width;
  const slices = [];
  for (const f of t.files) {
    const { data } = await sharp(readFileSync(await bucketFile(CACHE, `web/${f}`)))
      .raw({ depth: 'ushort' })
      .toBuffer({ resolveWithObject: true });
    slices.push(new Uint16Array(data.buffer, data.byteOffset, data.length / 2));
  }
  const fname = `${w}.lut${n}.png`;
  await sharp(Buffer.from(lutStrip(slices, n)), { raw: { width: n * n, height: n, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(join(out, fname));
  return { url: site(fname), size: n, name, _source: { size: `textures.jsonl: ${name} is a ${n}³ volume, kept whole` } };
}

const out = join(ROOT, 'public/textures/galaxy/bf2017/light', world);
mkdirSync(out, { recursive: true });
const site = (f) => `textures/galaxy/bf2017/light/${world}/${f}`;
const SUFFIX = { panorama: 'panorama', gradient: 'gradient', cloudShadow: 'clouds' };
const published = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'src/data/galaxyAssets.json'), 'utf8'));
  } catch {
    return {};
  }
})();
const hasHdr = (path) => existsSync(join(ROOT, 'public', path)) || Boolean(published[path]);
const weathers = {};
for (const [w, e] of Object.entries(light.weathers ?? {})) {
  const raws = [];
  for (const name of e.source ?? []) {
    try {
      raws.push(JSON.parse(gunzipSync(readFileSync(await bucketFile(CACHE, `data/${name}.json.gz`))).toString('utf8')));
    } catch {
      console.log(`  missing: data/${name}.json.gz`);
    }
  }
  const record = recordOf(...raws);
  const names = picturedNames(record);
  // (the record's picture fields, for a site whose entry has the numbers but not the names)
  const row = { record: pictureFields(record) };
  const lutName = gradeOf(record)?.lut?.name ?? null;
  const lut = lutName ? await fullLut(w, lutName) : null;
  if (lut) row.lut = lut;
  else if (e.grading?.lut) row.lut = { url: e.grading.lut, size: e.grading.lutSize, _source: { size: `${world}.json's 17³ (bf2017-light.mjs): the record's 33³ was not in the bucket` } };
  if (!names.panorama) {
    row.panorama = null;
    row._panorama = 'the record names no PanoramicTexture: applyGameLight keeps the model’s sky';
  }
  for (const [kind, name] of Object.entries(names)) {
    if (!name) continue;
    const t = manifest.get(name.toLowerCase());
    if (!t) {
      console.log(`  ${w}: missing: ${name} (not in textures.jsonl)`);
      continue;
    }
    const ktx = `web/${t.file.replace(/\.png$/i, '.ktx2')}`;
    let file;
    try {
      file = await bucketFile(CACHE, ktx);
    } catch {
      console.log(`  ${w}: missing: ${ktx}`);
      continue;
    }
    // (a texture two weathers share is one file: named by the first weather that has it)
    const prior = Object.values(weathers).find((r) => r[kind]?.name === name);
    const fname = prior ? prior[kind].url.split('/').pop() : `${w}.${SUFFIX[kind]}.ktx2`;
    if (!prior && kind === 'cloudShadow') {
      const buf = readFileSync(file);
      writeFileSync(join(out, fname), dropMips(buf, mipsToFit(ktx2Info(buf).width, CLOUD_SIZE)));
    } else if (!prior) copyFileSync(file, join(out, fname));
    const entry = { url: site(fname), name };
    if (kind === 'panorama') {
      const img = decode(readFileSync(file));
      Object.assign(entry, {
        horizon: rowMean(img.rgba, img.width, img.height - 1),
        size: [img.width, img.height],
        _source: { horizon: `measured: the mean of the decoded ${ktx}'s foot row, linear 0…1 (rowMean)`, size: `${ktx}'s own (the desktop's UASTC encode)` },
      });
    }
    // (lane W's HDR copy, when the desktop has made it: the sky above white kept)
    const hdr = kind === 'cloudShadow' ? null : hdrOf(name, hasHdr);
    if (hdr) entry.hdr = hdr;
    row[kind] = entry;
    console.log(`  ${w}: ${kind} ${name} → ${fname}${entry.horizon ? ` (horizon ${entry.horizon.join(', ')})` : ''}`);
  }
  weathers[w] = row;
}
const json = { _from: `scripts/bf2017-picture.mjs ${world}: the weathers' VE records (src/data/bf2017/light/${world}.json's sources) in the bf2017-assets bucket, their textures' KTX2 (web/<file>.ktx2) as the desktop encoded them`, world, weathers };
writeFileSync(join(ROOT, 'src/data/bf2017/light', `${world}.picture.json`), `${JSON.stringify(json, null, 2)}\n`);
console.log(`wrote src/data/bf2017/light/${world}.picture.json${existsSync(out) ? ` and ${Object.values(weathers).reduce((n, r) => n + ['panorama', 'gradient', 'cloudShadow'].filter((k) => r[k]).length, 0)} texture entries under ${site('')}` : ''}`);
