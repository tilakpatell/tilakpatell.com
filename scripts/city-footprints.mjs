// The footprints of the buildings a galaxy city is filled with
// (galaxy/surface/sites/city.js): each made model's ground plan and height
// in metres, read off its file's bounds (the surface's files are in metres,
// stood on y = 0: scripts/meshy-galaxy-buildings.mjs), into
// src/components/galaxy/surface/sites/footprints.json, which a city's kit
// and its keep-outs read so a lot is filled by what fits it.
//
//   node scripts/city-footprints.mjs [kind …]   (the kinds already in the
//                                                table, and any named)

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'src/components/galaxy/surface/sites/footprints.json';
const fileOf = (kind) => `public/models/galaxy/surface/${kind}.glb`;

export async function footprintOf(io, file) {
  const doc = await io.read(file);
  const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
  const r = (v) => Math.round(v * 10) / 10;
  return [r(max[0] - min[0]), r(max[2] - min[2]), r(max[1] - min[1])];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const was = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  const kinds = [...new Set([...Object.keys(was), ...process.argv.slice(2)])].sort();
  const out = {};
  for (const kind of kinds) {
    if (!existsSync(fileOf(kind))) {
      console.warn(`${kind}: no ${fileOf(kind)}, left out`);
      continue;
    }
    out[kind] = await footprintOf(io, fileOf(kind));
    console.log(kind.padEnd(16), out[kind].join(' × '));
  }
  writeFileSync(OUT, `${JSON.stringify(out, null, 0).replace(/\],/g, '],\n ').replace('{', '{\n ').replace(/\]\}$/, ']\n}')}\n`);
}
