// Hoth's snow maps into its level pack (the terrain study's finding 35: the
// base snow is three normal octaves, a smoothness brightness map, a soot
// mask, a sparkle map and the blowing snow's streak and flow maps over one
// flat colour; src/lib/three/ground/snow.js draws them). Each map is read
// from the owner's export as the drop's PNG, encoded as the site's KTX2
// (scripts/ktx2.mjs: UASTC, mipmapped; the _N and _RGBM maps linear, the _C
// maps sRGB), and written at each tier's size as the level factory writes
// its rows (tex/<slug>.<size>.ktx2, the bigger file's mips dropped, nothing
// encoded twice), with a `tex` row in level.json saying the sizes and the
// colour space. Then the owner publishes the new files to the bucket
// (scripts/assets-publish.mjs --only 'models/galaxy/bf2017/levels/hoth/tex/*',
// the key from their shell), which registers them by hash in
// src/data/galaxyAssets.json; until then the site's copy serves them.
//
//   node scripts/bf2017-snow.mjs [hoth] [--from <export's web folder>] [--force]
//
// The _N maps stay packed (R, G the normal, B the displacement height, A a
// mask) as the pack's other ground rows are (lane Q2's), so one sample
// gives the shader the normal and the height: three octaves, three samples.

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeImage } from './ktx2.mjs';
import { parseArgs } from './lib/args.mjs';
import { dropMips, ktx2Info, mipsToFit } from './lib/ktx2-mips.mjs';
import { SNOW_MAPS } from '../src/lib/three/ground/snowMaps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = 'C:/Users/tilak/Downloads/BF2_Extract/web';

async function main(args) {
  const world = args._[0] ?? 'hoth';
  const from = args.from ?? EXPORT;
  const pack = join(ROOT, 'public/models/galaxy/bf2017/levels', world);
  const level = JSON.parse(await readFile(join(pack, 'level.json'), 'utf8'));
  const index = new Map();
  for (const line of (await readFile(join(from, 'textures.jsonl'), 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    index.set(r.name.split('/').pop().toLowerCase(), r);
  }
  await mkdir(join(pack, 'tex'), { recursive: true });
  let total = 0;
  for (const [slug, m] of Object.entries(SNOW_MAPS)) {
    const row = index.get(slug);
    if (!row) throw new Error(`textures.jsonl names no ${slug}`);
    const src = join(from, row.file);
    const sizes = Object.fromEntries(Object.entries(m.sizes).map(([t, s]) => [t, Math.min(s, row.width)]));
    const want = [...new Set(Object.values(sizes))];
    const have = want.every((s) => existsSync(join(pack, 'tex', `${slug}.${s}.ktx2`)));
    if (!have || args.force) {
      const role = m.srgb ? 'color' : m.kind === 'normal' ? 'normal' : 'other';
      const { ktx2 } = await encodeImage(await readFile(src), { role });
      const info = ktx2Info(ktx2);
      for (const s of want) await writeFile(join(pack, 'tex', `${slug}.${s}.ktx2`), dropMips(ktx2, Math.min(mipsToFit(info.width, s), info.levels - 1)));
    }
    const bytes = {};
    for (const s of want) bytes[s] = (await stat(join(pack, 'tex', `${slug}.${s}.ktx2`))).size;
    total += Object.values(bytes).reduce((a, b) => a + b, 0);
    level.tex[slug] = { ...sizes, srgb: Boolean(m.srgb) };
    console.log(`${slug.padEnd(52)} ${row.width} px ${row.format.padEnd(10)} → ${want.map((s) => `${s}: ${(bytes[s] / 1024).toFixed(0)} KB`).join(', ')}`);
  }
  await writeFile(join(pack, 'level.json'), `${JSON.stringify(level)}\n`);
  console.log(`${world}: ${Object.keys(SNOW_MAPS).length} maps, ${(total / 1048576).toFixed(2)} MB over every tier row; level.json's tex rows written`);
}

main(parseArgs(process.argv.slice(2))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
