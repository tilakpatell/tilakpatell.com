// The galaxy's worlds' far-off buildings: for each surface model with more
// than 20,000 triangles, a light copy beside it
// (public/models/galaxy/surface/<kind>.lod1.glb) that the placer draws past
// three times the model's radius (placer.js: withLod). Unlike the space
// LODs (scripts/galaxy-lod.mjs, colours baked into a few thousand
// triangles), a building far off is still big on the screen, so it keeps
// its textures: a quarter of the triangles (meshoptimizer, borders free to
// move), its maps at half the size, meshopt-compressed like the rest.
//
//   node scripts/galaxy-surface-lod.mjs            every model in the catalogue
//   node scripts/galaxy-surface-lod.mjs theed hive just these
//
// A model under the line gets no LOD (and an old one is left for the
// catalogue test to catch). The catalogue entry wants `lod: true` for each
// one made: the line printed for it says so.

import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dequantize, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public', 'models', 'galaxy', 'surface');
export const LOD_OVER = 20000;
const WORTH = 0.65; // an LOD keeps at most this much of its model's triangles

const io = async () => {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
};

export function triangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const idx = p.getIndices();
      n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  return n;
}

// every primitive's triangles cut to `keep` of them, by meshoptimizer's
// sloppy simplifier (positions only)
function sloppy(doc, keep) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      const pos = p.getAttribute('POSITION');
      if (!idx || !pos || p.getMode() !== 4) continue;
      const indices = Uint32Array.from(idx.getArray());
      const target = Math.max(3, Math.floor((indices.length * keep) / 3) * 3);
      const [out] = MeshoptSimplifier.simplifySloppy(indices, Float32Array.from(pos.getArray()), 3, null, target, 0.02);
      idx.setArray(pos.getCount() > 65535 ? out : Uint16Array.from(out));
      compactPrimitive(p); // (the vertices no triangle uses any more, dropped)
    }
}

// one model's light copy: `from` → `to`; resolves to { tris, low, bytes }
// or null when the model is under the line
export async function makeLod(from, to, { ratio = 0.25, error = 0.05, over = LOD_OVER } = {}) {
  const node = await io();
  const doc = await node.read(from);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const tris = triangles(doc);
  if (tris <= over) return null;
  let size = 0;
  for (const t of doc.getRoot().listTextures()) size = Math.max(size, ...(t.getSize() ?? [0]));
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }), prune());
  if (size > 128) await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size / 2, size / 2], quality: 80 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  let low = triangles(doc);
  // (a model the careful simplifier can't take far, all UV seams as the
  // generated ones are, is cut down sloppily: topology ignored, seams and
  // all, which three times its radius away nobody sees)
  if (low > WORTH * tris) {
    await doc.transform(dequantize());
    sloppy(doc, (ratio * tris) / low);
    await doc.transform(prune());
    low = triangles(doc);
  }
  // (one that still won't come down isn't worth a second download)
  if (low > WORTH * tris) return { tris, low, bytes: 0, skipped: true };
  await node.write(to, doc);
  return { tris, low, bytes: statSync(to).size };
}

// the kinds kept rigged (people and beasts the actors move: never placed as
// buildings, so never drawn through an LOD), read from the catalogue as written
function rigged() {
  const dir = join(ROOT, 'src', 'components', 'galaxy', 'surface', 'catalog');
  const out = new Set();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && !f.includes('test')))
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/^\s+(\w+): \{[^\n]*\brig: true/gm)) out.add(m[1]);
  return out;
}

async function main() {
  const only = process.argv.slice(2);
  const skip = rigged();
  const files = readdirSync(DIR).filter((f) => f.endsWith('.glb') && !f.endsWith('.lod1.glb') && !skip.has(f.slice(0, -4)));
  for (const f of files) {
    const kind = f.slice(0, -4);
    if (only.length && !only.includes(kind)) continue;
    const to = join(DIR, `${kind}.lod1.glb`);
    const made = await makeLod(join(DIR, f), to);
    if (!made) {
      if (only.length) console.log(`${kind.padEnd(16)} under ${LOD_OVER} triangles: no LOD${existsSync(to) ? ' (an old one is there)' : ''}`);
      continue;
    }
    if (made.skipped) {
      if (existsSync(to)) rmSync(to);
      console.log(`${kind.padEnd(16)} ${made.tris} → ${made.low} triangles: not worth an LOD`);
      continue;
    }
    const full = statSync(join(DIR, f)).size;
    console.log(`${kind.padEnd(16)} ${made.tris} → ${made.low} triangles, ${(full / 1e6).toFixed(2)} → ${(made.bytes / 1e6).toFixed(2)} MB  (lod: true)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
