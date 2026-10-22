// Hogwarts’ hero models cut for the site (the list and what each is:
// src/components/hogwarts/world/heroes.js). Each is read from where it was
// made (Meshy’s raw model and its remeshes, the desktop’s bake, a Sketchfab
// download, all in scripts/gen3d/cache/, git-ignored), the parts it drops
// left out, set to its size in metres on y = 0 with its front toward +z,
// then each tier cut as scripts/gen3d/web.mjs cuts the desktop’s models
// (welded, simplified to the tier’s triangles, WebP maps at the tier’s size
// and the others at half, meshopt) into public/models/hogwarts/<group>/.
// Its credit goes in public/games/credits.json (made here or with Meshy)
// or src/data/modelCredits.json (someone else’s, under its licence), and
// public/models/hogwarts/models.json says what came out: each cut’s
// triangles and bytes, and whether it is over COMMIT_BYTES and so goes to
// the bucket (scripts/assets-publish.mjs) instead of git.
//
//   node scripts/hogwarts-models.mjs [name …]
//
// A Sketchfab download’s credit is read from the model’s page (its
// title, author and licence), so nothing here is typed by hand.

import { getBounds, metalRough, prune } from '@gltf-transform/functions';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEROES, COMMIT_BYTES, fileOf, placement } from '../src/components/hogwarts/world/heroes.js';
import { io, webReady } from './gen3d/web.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', 'gen3d', 'cache');
const GAMES = join(ROOT, 'public', 'games', 'credits.json');
const MODELS = join(ROOT, 'src', 'data', 'modelCredits.json');
const MANIFEST = join(ROOT, 'public', 'models', 'hogwarts', 'models.json');
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };

// the model a tier is cut from
export function sourceOf(spec, tier) {
  if (spec.made === 'meshy') return join(CACHE, 'meshy', spec.from[tier]);
  // (a bare model is its shape alone: the raw mesh, stood up, not the bake,
  // whose rays left holes in the Willow’s thin limbs)
  if (spec.made === 'gen3d') return join(CACHE, spec.from, spec.bare ? 'upright.glb' : 'baked.glb');
  return join(CACHE, 'sketchfab', spec.from);
}

// A bare model’s paint and UVs let go (the world paints it, a bark or a
// stone by world position), so the simplifier is free of the atlas’s seams.
function bare(doc, colour) {
  const root = doc.getRoot();
  const mat = doc.createMaterial('bare').setBaseColorFactor([...colour, 1]).setRoughnessFactor(0.95).setMetallicFactor(0);
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) if (sem !== 'POSITION' && sem !== 'NORMAL') prim.setAttribute(sem, null);
      prim.setMaterial(mat);
    }
  for (const t of root.listTextures()) t.dispose();
}

// Triangles wholly under `share` of the model’s height let go: its own
// plinth or patch of ground, where the world’s ground will be.
function trimBelow(doc, share) {
  const root = doc.getRoot();
  let lo = Infinity;
  let hi = -Infinity;
  const y = (pos, i) => pos.getElement(i, [0, 0, 0])[1];
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) {
        lo = Math.min(lo, y(pos, i));
        hi = Math.max(hi, y(pos, i));
      }
    }
  const cut = lo + (hi - lo) * share;
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      if (!idx) continue;
      const a = idx.getArray();
      const keep = [];
      for (let t = 0; t < a.length; t += 3) if (Math.max(y(pos, a[t]), y(pos, a[t + 1]), y(pos, a[t + 2])) > cut) keep.push(a[t], a[t + 1], a[t + 2]);
      idx.setArray(new Uint32Array(keep));
    }
}

// the scene’s children under one node that sets the model to its size
function place(doc, at) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { s, offset } = at;
  const top = doc.createNode('placed').setMatrix([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, ...offset, 1]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    top.addChild(child);
  }
  scene.addChild(top);
}

async function prepared(nio, spec, tier) {
  const doc = await nio.read(sourceOf(spec, tier));
  const root = doc.getRoot();
  // (lines and points: nothing the world draws)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  if (spec.drop) for (const node of root.listNodes()) if (node.getMesh() && spec.drop.test(node.getName())) node.setMesh(null);
  // (older uploads are specular-glossiness, which three no longer reads)
  await doc.transform(metalRough(), prune());
  if (spec.bare) bare(doc, spec.bare);
  if (spec.below) trimBelow(doc, spec.below);
  await doc.transform(prune());
  return doc;
}

async function cut(nio, name) {
  const spec = HEROES[name];
  // the size from the plain cut, so every tier stands in the same place
  const scene = (d) => d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0];
  const at = placement(getBounds(scene(await prepared(nio, spec, 'mid'))), spec.size);
  const out = {};
  for (const [tier, { tris, tex }] of Object.entries(spec.cuts)) {
    const doc = await prepared(nio, spec, tier);
    place(doc, at);
    const { before, after } = await webReady(doc, { tris, tex });
    const file = join(ROOT, 'public', fileOf(name, tier));
    await mkdir(dirname(file), { recursive: true });
    await nio.write(file, doc);
    const bytes = (await stat(file)).size;
    const box = getBounds(scene(doc));
    out[tier] = { file: fileOf(name, tier), tris: Math.round(after), bytes, bucket: bytes > COMMIT_BYTES || undefined };
    console.log(`${name} ${tier}: ${Math.round(before)} → ${Math.round(after)} triangles, ${(bytes / 1e6).toFixed(2)} MB${bytes > COMMIT_BYTES ? ' (the bucket)' : ''}, ${box.max.map((v, i) => (v - box.min[i]).toFixed(1)).join(' × ')} m`);
    out.size = box.max.map((v, i) => +(v - box.min[i]).toFixed(2));
  }
  return out;
}

async function credit(name) {
  const spec = HEROES[name];
  if (spec.made === 'sketchfab') {
    const m = await (await fetch(`https://api.sketchfab.com/v3/models/${spec.uid}`)).json();
    const license = LICENCES[m.license?.slug];
    if (!license) throw new Error(`${name}: its licence (${m.license?.label}) isn’t one the site can use`);
    const credits = JSON.parse(await readFile(MODELS, 'utf8'));
    credits[`hogwarts-${name}`] = { title: m.name, author: m.user.displayName || m.user.username, authorUrl: m.user.profileUrl, license, licenseUrl: m.license.url, source: m.viewerUrl, where: 'hogwarts', as: spec.what.split(',')[0].split(':')[0], file: spec.url };
    // (added where it falls, the file never re-sorted: other lanes write it too)
    await writeFile(MODELS, `${JSON.stringify(credits, null, 2)}\n`);
    return { by: credits[`hogwarts-${name}`].author, license };
  }
  const credits = JSON.parse(await readFile(GAMES, 'utf8'));
  credits[`hogwarts/${name}`] =
    spec.made === 'meshy'
      ? { source: 'https://www.meshy.ai', name: `${spec.what}, generated for this site with Meshy AI from reference photographs`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' }
      : { source: 'https://github.com/microsoft/TRELLIS.2', name: `${spec.what}, made for this site with TRELLIS.2 on the site owner’s machine from reference photographs (scripts/gen3d)`, authors: ['Tilak Patel, with Microsoft TRELLIS.2'], license: 'Generated for this site; TRELLIS.2 is MIT' };
  await writeFile(GAMES, `${JSON.stringify(credits, null, 2)}\n`);
  return { by: 'made for this site', license: credits[`hogwarts/${name}`].license };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const asked = process.argv.slice(2);
  const names = asked.length ? asked : Object.keys(HEROES);
  const bad = names.filter((n) => !HEROES[n]);
  if (bad.length) throw new Error(`no model ${bad.join(', ')}`);
  const nio = await io();
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
  for (const name of names) {
    const spec = HEROES[name];
    const missing = Object.keys(spec.cuts).map((t) => sourceOf(spec, t)).filter((f) => !existsSync(f));
    if (missing.length) {
      console.log(`${name}: no ${[...new Set(missing)].join(', ')}`);
      continue;
    }
    const { size, ...cuts } = await cut(nio, name);
    const c = await credit(name);
    manifest[name] = { url: spec.url, group: spec.url.split('/')[3], what: spec.what, size, made: spec.made, by: c.by, license: c.license, cuts };
  }
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  await mkdir(dirname(MANIFEST), { recursive: true });
  await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`wrote ${MANIFEST}`);
}
