// A raw generated GLB made ready for the site, the same way the Meshy models
// were (scripts/meshy-import.mjs): welded, simplified to a triangle budget,
// textures to WebP at a set size, meshopt-compressed, into public/models/gen3d/,
// and credited in public/games/credits.json. Refuses to ship a model over its
// budget or over 4 MB.
//
//   node scripts/gen3d/web.mjs BAKED.glb NAME --what "an X-wing starfighter" [--match OLD.glb] [--across-seams]
//   three cuts (budget.mjs TIERS): NAME.hq.glb, NAME.glb, NAME.lo.glb; --tris N --tex N makes one custom cut instead
//   webReady(doc, { tris, tex }) → { before, after }   (the transform, on a gltf-transform Document)

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TIERS, check, triangles } from './budget.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = join(ROOT, 'public', 'models', 'gen3d');

export async function io() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

export async function webReady(doc, { tris, tex, acrossSeams = false }) {
  const { default: sharp } = await import('sharp'); // only when a model is made: the budget check needs no native module
  const before = triangles(doc);
  await doc.transform(dequantize(), weld());
  // a generated mesh carries far more detail than a Meshy one: the simplifier
  // stops at its error bound, so the bound loosens a step at a time until the
  // budget is met (meshy-import's 0.01 first)
  for (const error of [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1]) {
    const now = triangles(doc);
    if (now <= tris * 1.05) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, tris / now), error, lockBorder: false }));
    console.log(`simplify error ${error}: ${Math.round(now)} → ${Math.round(triangles(doc))} triangles`);
  }
  // across UV seams only when asked: it reaches any budget, but smears the texture at the seams
  if (acrossSeams && triangles(doc) > tris * 1.05) await doc.transform(permissive(tris));
  // colour at full size; the normal and metal-rough maps (a baked model's) at
  // half, where the eye can't tell and WebP charges most for their noise
  const half = Math.round(tex / 2);
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 85, slots: /baseColor|emissive/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [half, half], quality: 75, slots: /normal|metallicRoughness|occlusion/ }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  return { before, after: triangles(doc) };
}

// What a generated mesh's UV seams block (an atlas of thousands of charts
// locks their edges): meshoptimizer's own simplify, allowed to collapse
// across seams, straight on each primitive's indices.
export const permissive = (tris) => async (doc) => {
  const total = triangles(doc);
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      if (!idx || !pos) continue;
      const share = idx.getCount() / 3 / total;
      const [out] = MeshoptSimplifier.simplify(new Uint32Array(idx.getArray()), pos.getArray(), 3, Math.round(tris * share) * 3, 1, ['Permissive']);
      idx.setArray(out);
    }
  }
  console.log(`simplify across seams: ${Math.round(total)} → ${Math.round(triangles(doc))} triangles`);
};

// The three cuts of a model (budget.mjs's TIERS) from the baked GLB, each
// simplified from it, stood up first when `stand` (Pixal3D writes Z up), its
// brightness matched to an old model's first when `match` names one
// (colour.mjs); credited once. Returns the first cut's
// numbers, and every cut's under `cuts`.
export async function publish(raw, name, { what, engine = 'TRELLIS.2', acrossSeams = false, match, tiers = Object.keys(TIERS), tris, tex, stand = false }) {
  const nio = await io();
  await mkdir(OUT, { recursive: true });
  const cuts = tris ? { custom: { suffix: '', faces: tris, tex: tex ?? 2048, bytes: TIERS.mid.bytes } } : Object.fromEntries(tiers.map((t) => [t, TIERS[t]]));
  const results = {};
  let said = false;
  for (const [tier, cut] of Object.entries(cuts)) {
    const doc = await nio.read(raw);
    if (stand) await (await import('./upright.mjs')).upright(doc); // Pixal3D's Z up, to the site's Y up (upright.mjs imports this file)
    if (match) {
      const { matchColour } = await import('./colour.mjs');
      const m = await matchColour(doc, await nio.read(match));
      if (m && !said) console.log(`brightness ×${m.scale.toFixed(2)} to match ${match}`);
      said = true;
    }
    const { before, after } = await webReady(doc, { tris: cut.faces, tex: cut.tex, acrossSeams });
    const bytes = (await nio.writeBinary(doc)).byteLength;
    const problems = check({ tris: cut.faces, after, bytes, max: cut.bytes });
    if (problems.length) throw new Error(`${name} (${tier}): ${problems.join('; ')}`);
    const out = join(OUT, `${name}${cut.suffix}.glb`);
    await nio.write(out, doc);
    results[tier] = { out, before, after, bytes };
  }
  const creditsFile = join(ROOT, 'public', 'games', 'credits.json');
  const credits = JSON.parse(await readFile(creditsFile, 'utf8'));
  credits[`gen3d/${name}`] = { source: 'https://github.com/microsoft/TRELLIS.2', name: `${what}, made for this site with ${engine} on the site owner's machine (scripts/gen3d)`, authors: ['Tilak Patel, with Microsoft TRELLIS.2'], license: 'Generated for this site; TRELLIS.2 is MIT' };
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
  return { ...Object.values(results)[0], cuts: results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const [tris, tex, match] = [flag('tris'), flag('tex'), flag('match')];
  const opts = { tris: tris && Number(tris), tex: tex && Number(tex), what: flag('what', ''), engine: flag('engine', 'TRELLIS.2'), match: match && resolve(match), acrossSeams: args.includes('--across-seams') };
  const [raw, name] = args;
  if (!raw || !name) throw new Error('usage: node scripts/gen3d/web.mjs BAKED.glb NAME [--what "…"] [--match OLD.glb] [--tris N --tex N for one custom cut]');
  const r = await publish(resolve(raw), name, opts);
  for (const [t, c] of Object.entries(r.cuts)) console.log(`${name} ${t}: ${Math.round(c.before)} → ${Math.round(c.after)} triangles, ${(c.bytes / 1024).toFixed(0)} KB → ${c.out}`);
}
