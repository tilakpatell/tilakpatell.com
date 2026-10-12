// Hoth's snow maps into its level pack (the terrain study's finding 35: the
// base snow is three normal octaves over one flat colour, the blowing
// snow's wisps slid through a flow map, and a sparkle on the near pass;
// src/lib/three/ground/snow.js draws them, snowMaps.js names them). Each
// map is read from the owner's export as the drop's PNG, encoded as the
// site's KTX2 (scripts/ktx2.mjs: UASTC, mipmapped; the _N and _RGBM maps
// linear, the _C maps sRGB), and written at each size its tiers read
// (tex/<slug>.<size>.ktx2, the bigger file's mips dropped, nothing encoded
// twice), with a `tex` row in level.json saying the sizes and the colour
// space. A map the bucket holds already at every size asked (the sparkle:
// lane Q2's /roam ground published it) is left as it is, not made again.
//
// Then the owner publishes the new files (the key from their shell):
//
//   node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/hoth/tex/t_arcticbase_snow*,models/galaxy/bf2017/levels/hoth/tex/t_blowingsnowflowmap*'
//
// which registers them by hash in src/data/galaxyAssets.json and rewrites
// .gitignore's block: commit both. Until then the published site draws the
// ground in its flat colour (ground.js asks only for what the manifest
// names); a checkout that ran this script reads its own copy.
//
//   node scripts/bf2017-snow.mjs [hoth] [--from <export's web folder>] [--force]
//
// The _N maps stay packed (R, G the normal, B a height, A a mask) as the
// pack's other ground rows are (lane Q2's), so one sample gives the shader
// the normal and the height: three octaves, three samples.

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeImage } from './ktx2.mjs';
import { parseArgs } from './lib/args.mjs';
import { MANIFEST, readManifest } from './lib/asset-manifest.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { mapsFor } from '../src/lib/three/ground/snow.js';
import { SNOW_MAPS } from '../src/lib/three/ground/snowMaps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = 'C:/Users/tilak/Downloads/BF2_Extract/web';

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
  await mkdir(join(pack, 'tex'), { recursive: true });
  const bytes = {};
  let made = 0;
  for (const [slug, m] of Object.entries(SNOW_MAPS)) {
    const row = index.get(slug);
    if (!row) throw new Error(`textures.jsonl names no ${slug}`);
    const sizes = Object.fromEntries(Object.entries(m.sizes).map(([t, s]) => [t, Math.min(s, row.width)]));
    const want = [...new Set(Object.values(sizes))];
    const file = (s) => join(pack, 'tex', `${slug}.${s}.ktx2`);
    const inBucket = want.every((s) => published[site(slug, s)]);
    const here = want.every((s) => existsSync(file(s)));
    if (!inBucket && (!here || args.force)) {
      const role = m.srgb ? 'color' : m.kind === 'normal' ? 'normal' : 'other';
      const { ktx2 } = await encodeImage(await readFile(join(from, row.file)), { role });
      const info = ktx2Info(ktx2);
      for (const s of want) await writeFile(file(s), dropMips(ktx2, Math.min(mipsToFit(info.width, s), info.levels - 1)));
      made += want.length;
    }
    bytes[slug] = {};
    for (const s of want) bytes[slug][s] = inBucket ? published[site(slug, s)].bytes : (await stat(file(s))).size;
    level.tex[slug] = { ...sizes, srgb: Boolean(m.srgb) };
    console.log(`${slug.padEnd(52)} ${row.width} px ${row.format.padEnd(10)} → ${want.map((s) => `${s}: ${(bytes[slug][s] / 1024).toFixed(0)} KB`).join(', ')}${inBucket ? ' (in the bucket already)' : ''}`);
  }
  await writeFile(join(pack, 'level.json'), `${JSON.stringify(level)}\n`);
  // what a tier downloads: the maps its material reads, at its sizes
  const tierMB = (tier) => (mapsFor(tier).reduce((n, slug) => n + bytes[slug][level.tex[slug][tier]], 0) / 1e6).toFixed(2);
  console.log(`${world}: ${Object.keys(SNOW_MAPS).length} maps, ${made} files written; a tier's download: mid ${tierMB('mid')} MB, high ${tierMB('high')} MB, ultra ${tierMB('ultra')} MB; level.json's tex rows written`);
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
