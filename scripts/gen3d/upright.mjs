// A model stood up: trellis.cpp's Pixal3D writes Z up (a figure comes out
// lying on its back, its face to the sky), and glTF and the site are Y up.
// The vertices themselves are turned (not a node's rotation), so a rig made
// from it later (Meshy's, from a URL) sees it standing.
//
//   node scripts/gen3d/upright.mjs IN.glb OUT.glb [--x 90]   (degrees about X; 90 takes Z up to Y up)
//   upright(doc, { x }) → doc

import { dequantize, meshopt, transformMesh } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { io } from './web.mjs';

// a turn of `deg` about X, column-major: +90 takes +Z to +Y (and +Y to −Z… so a face to the sky looks forward, +Z)
export function aboutX(deg) {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
}

export async function upright(doc, { x = 90 } = {}) {
  await doc.transform(dequantize());
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, aboutX(x));
  return doc;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--x');
  const x = i >= 0 ? Number(args.splice(i, 2)[1]) : 90;
  const [inp, out] = args;
  if (!inp || !out) throw new Error('usage: node scripts/gen3d/upright.mjs IN.glb OUT.glb [--x 90]');
  const nio = await io();
  const doc = await upright(await nio.read(resolve(inp)), { x });
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await nio.write(resolve(out), doc);
  console.log(`${out}: turned ${x}° about X`);
}
