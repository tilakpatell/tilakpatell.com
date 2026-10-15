// Hoth's terrain layer maps into its level pack (the terrain study's
// findings 35 and 58: the game's tile shader blends nine layers, each with
// its own normal, colour and data maps at fixed tilings;
// src/lib/three/ground/snow.js draws them, snowMaps.js names them). The
// maps of one size and colour space are packed as the layers of one KTX2
// array (snowMaps.js's SNOW_FILES: a WebGPU stage binds 16 textures, and the
// shader reads 18 maps): each read from the owner's export as the drop's
// PNG (the _N maps packed as the game's, R G the normal, B a height, A a
// mask), made the array's size (the packed smoothness, 2048, down to 1024;
// the detail and the sparkle, 512, up; the flow map decoded from sRGB to
// linear for the linear array), encoded as the site's KTX2 (UASTC,
// mipmapped; _N and _RGBM linear, _C sRGB) and written at each size its
// tiers read (tex/<slug>.<size>.ktx2, the bigger file's mips dropped), with
// a `tex` row in level.json saying the sizes and the colour space. A file
// the bucket holds already at every size asked (the flow map) is left as it
// is, not made again.
//
// Then the owner publishes the new files (the key from the environment):
//
//   node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/hoth/tex/hoth_snow_*,models/galaxy/bf2017/levels/hoth/terrain/masks.*'
//
// which registers them by hash in src/data/galaxyAssets.json and rewrites
// .gitignore's block: commit both. Until then the published site draws the
// ground in its flat colour (ground.js asks only for what the manifest
// names); a checkout that ran this script reads its own copy.
//
//   node scripts/bf2017-snow.mjs [hoth] [--from <export's web folder>] [--force]

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { basisuPath, encodeArgs, encodeImage } from './ktx2.mjs';
import { parseArgs } from './lib/args.mjs';
import { MANIFEST, readManifest } from './lib/asset-manifest.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { mapsFor } from '../src/lib/three/ground/snow.js';
import { SNOW_FILES } from '../src/lib/three/ground/snowMaps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = 'C:/Users/tilak/Downloads/BF2_Extract/web';

// sRGB bytes to linear ones (the GPU's decode, done before the pack: RGB, not alpha)
export function linearise(rgba) {
  const lut = Uint8Array.from({ length: 256 }, (_, v) => {
    const c = v / 255;
    return Math.round(255 * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  });
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) for (let k = 0; k < 3; k++) out[i + k] = lut[out[i + k]];
  return out;
}

// the export's maps as one KTX2 array of side × side layers (each made that size)
async function encodeArray(files, side, { srgb, linear = [] }) {
  const tmp = await mkdtemp(join(tmpdir(), 'snow-'));
  try {
    const args = [];
    for (const [i, file] of files.entries()) {
      const png = join(tmp, `l${i}.png`);
      const img = sharp(await readFile(file)).ensureAlpha();
      const meta = await img.metadata();
      const sized = meta.width === side ? img : img.resize(side, side, { kernel: 'lanczos3' });
      if (linear[i]) {
        const { data, info } = await sized.raw().toBuffer({ resolveWithObject: true });
        await sharp(linearise(data), { raw: { width: info.width, height: info.height, channels: 4 } })
          .png()
          .toFile(png);
      } else await sized.png().toFile(png);
      args.push('-file', png);
    }
    const out = join(tmp, 'out.ktx2');
    execFileSync(basisuPath(), [...encodeArgs({ role: srgb ? 'color' : 'other' }), '-tex_type', '2darray', ...args, '-output_file', out], { stdio: 'ignore' });
    return await readFile(out);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function main(args) {
  const world = args._[0] ?? 'hoth';
  const from = args.from ?? EXPORT;
  const pack = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const site = (slug, size) => `models/galaxy/bf2017/levels/${world}/tex/${slug}.${size}.ktx2`;
  const level = JSON.parse(await readFile(join(pack, 'level.json'), 'utf8'));
  const published = readManifest(join(ROOT, MANIFEST));
  const index = new Map();
  for (const line of (await readFile(join(from, 'textures.jsonl'), 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    index.set(r.name.split('/').pop().toLowerCase(), r);
  }
  const rowOf = (map) => {
    const row = index.get(map);
    if (!row) throw new Error(`textures.jsonl names no ${map}`);
    return row;
  };
  await mkdir(join(pack, 'tex'), { recursive: true });
  const bytes = {};
  let made = 0;
  for (const [slug, m] of Object.entries(SNOW_FILES)) {
    const rows = (m.layers ?? [slug]).map(rowOf);
    const top = Math.max(...Object.values(m.sizes));
    const side = Math.min(top, Math.max(...rows.map((r) => r.width)));
    const sizes = Object.fromEntries(Object.entries(m.sizes).map(([t, s]) => [t, Math.min(s, side)]));
    const want = [...new Set(Object.values(sizes))];
    const file = (s) => join(pack, 'tex', `${slug}.${s}.ktx2`);
    const inBucket = want.every((s) => published[site(slug, s)]);
    const here = want.every((s) => existsSync(file(s)));
    if (!inBucket && (!here || args.force)) {
      const linear = (m.layers ?? []).map((map) => Boolean(m.linearised?.includes(map)));
      const ktx2 = m.layers ? await encodeArray(rows.map((r) => join(from, r.file)), side, { srgb: m.srgb, linear }) : (await encodeImage(await readFile(join(from, rows[0].file)), { role: m.srgb ? 'color' : 'other' })).ktx2;
      const info = ktx2Info(ktx2);
      for (const s of want) await writeFile(file(s), dropMips(ktx2, Math.min(mipsToFit(info.width, s), info.levels - 1)));
      made += want.length;
    }
    bytes[slug] = {};
    for (const s of want) bytes[slug][s] = inBucket ? published[site(slug, s)].bytes : (await stat(file(s))).size;
    level.tex[slug] = { ...sizes, srgb: Boolean(m.srgb) };
    console.log(`${slug.padEnd(28)} ${(m.layers ?? [slug]).length} × ${side} px → ${want.map((s) => `${s}: ${(bytes[slug][s] / 1e6).toFixed(2)} MB`).join(', ')}${inBucket ? ' (in the bucket already)' : ''}`);
  }
  await writeFile(join(pack, 'level.json'), `${JSON.stringify(level)}\n`);
  // what a tier downloads: the files its material reads, at its sizes
  const tierMB = (tier) => (mapsFor(tier).reduce((n, slug) => n + bytes[slug][level.tex[slug][tier]], 0) / 1e6).toFixed(2);
  console.log(`${world}: ${Object.keys(SNOW_FILES).length} files, ${made} written; a tier's download: mid ${tierMB('mid')} MB, high ${tierMB('high')} MB, ultra ${tierMB('ultra')} MB; level.json's tex rows written`);
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
