// A level's navmesh.bin cut to one mesh and a box, for the tests (the bytes
// themselves are in the site-assets bucket, not in git: scripts/lib/bf2017-navmesh-cut.mjs).
//
//   node scripts/bf2017-navmesh-cut.mjs --in public/models/galaxy/bf2017/levels/hoth/navmesh.bin
//     --out scripts/fixtures/bf2017/navmesh/hoth-playthrough.bin --mesh playthrough --box x0,z0,x1,z1
//
//   box  in the game's frame (the level's), x and z; the cut takes the pack's box round its corners

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { cutNavmesh } from './lib/bf2017-navmesh-cut.mjs';
import { decodeNavmesh, encodeNavmesh, load } from '../src/lib/battlefront/navmesh.js';

const args = parseArgs(process.argv.slice(2));
const bytes = readFileSync(args.in);
const mesh = String(args.mesh ?? 'playthrough');
const [gx0, gz0, gx1, gz1] = String(args.box).split(',').map(Number);
const loaded = load(bytes, { mesh });
const corners = [
  [gx0, 0, gz0],
  [gx1, 0, gz0],
  [gx0, 0, gz1],
  [gx1, 0, gz1],
].map((c) => loaded.toPack(c));
const box = [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[2])), Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[2]))];
const out = encodeNavmesh(cutNavmesh(decodeNavmesh(bytes), { mesh, box }));
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, out);
const cut = decodeNavmesh(out);
console.log(`${args.out}: ${out.length} bytes, ${cut.meshes[0].polyEdges.length} polygons, ${cut.links.length} links`);
