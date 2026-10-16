#!/usr/bin/env node
// The terrain's own holes into a level pack (docs/superpowers/HANDOFF-hoth-map.md
// step 3). The game's detail heightmap reads 0 where the ground has a hole:
// Hoth's 7,502 half-metre pixels are the hangar mouths and the trench
// tunnels (bf2-re findings/11), where the floor is the base's or the
// trench's own meshes. The pack builder fills them (their rim's lowest, for a
// walker that knew only the heightmap) and writes no mask, so the site drew
// flat plates over the tunnels and across the mouths. This writes the mask
// into the pack's level.json as `terrain.holes`: the detail map's grid in
// the pack's frame and, per row, the runs of hole pixels (git keeps
// level.json; the bucket's heightmaps stay as they are).
//
//   node scripts/bf2017-holes.mjs <world> [--root <export>] [--book maps/<key>.json] [--dry]
//   holeRuns(data, w, h, hole = 0) → { rows: { [j]: [[i, n], …] }, count }   (pure)

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng16 } from '../src/lib/level/png16.js';
import { parseArgs } from './lib/args.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function holeRuns(data, w, h, hole = 0) {
  const rows = {};
  let count = 0;
  for (let j = 0; j < h; j++) {
    let run = null;
    for (let i = 0; i <= w; i++) {
      const isHole = i < w && data[j * w + i] === hole;
      if (isHole) {
        count++;
        if (run) run[1]++;
        else run = [i, 1];
      } else if (run) {
        (rows[j] ??= []).push(run);
        run = null;
      }
    }
  }
  return { rows, count };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const world = args._[0];
  if (!world) throw new Error('usage: bf2017-holes.mjs <world> [--root <export>] [--book maps/<key>.json]');
  const root = typeof args.root === 'string' ? args.root : 'C:/Users/tilak/Downloads/BF2_Extract/web';
  const packFile = join(ROOT, 'public/models/galaxy/bf2017/levels', world, 'level.json');
  const pack = JSON.parse(await readFile(packFile, 'utf8'));
  const book = typeof args.book === 'string' ? args.book : `maps/${world}.json`;
  const record = JSON.parse(await readFile(join(ROOT, 'src/data/bf2017', book), 'utf8')).rows.terrain;
  const d = record?.detail;
  if (!d?.file || !(d.holePixels > 0)) {
    console.log(`${world}: the terrain has no detail map with holes; nothing written`);
    return;
  }
  // (a turned pack's grid would not be the map's: none is turned yet)
  if (pack.yaw) throw new Error(`${world}: a pack turned by ${pack.yaw} rad; holes in a turned frame are not written`);
  const png = await decodePng16(await readFile(join(root, d.file)));
  const { rows, count } = holeRuns(png.data, png.w, png.h, 0);
  const [ox, , oz] = pack.origin ?? [0, 0, 0];
  pack.terrain.holes = {
    metresPerPixel: d.metresPerPixel,
    min: [d.minX - ox, d.minZ - oz],
    size: [png.w, png.h],
    count,
    rows,
    _source: `${d.file} (${record.name}: the detail map's 0 = a hole, ${d.holePixels} pixels)`,
  };
  console.log(`${world}: ${count} hole pixels (the record says ${d.holePixels}) in ${Object.keys(rows).length} rows`);
  if (!args.dry) await writeFile(packFile, JSON.stringify(pack));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
