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
//   node --env-file=.env.local scripts/hogwarts-models.mjs [name …]   fetch (a Sketchfab
//     model not yet in the cache, with the owner's token), cut and credit
//   node scripts/hogwarts-models.mjs --sheet [name …]   each model's sheet
//
// A Sketchfab download’s credit is read from the model’s page (its
// title, author and licence), so nothing here is typed by hand.

import { flatten, getBounds, join as joinMeshes, metalRough, prune } from '@gltf-transform/functions';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEROES, COMMIT_BYTES, fileOf, placement } from '../src/components/hogwarts/world/heroes.js';
import { io, webReady } from './gen3d/web.mjs';
import { voxelDoc } from './hogwarts-castle.mjs';

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

// Each drawn primitive with a reader of its points in the scene's frame
// (a download's root node often turns it: Sketchfab's stands z up on its
// side), so a trim's "up" is the world's.
function placedPrims(doc) {
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const v = [0, 0, 0];
      const at = (i) => {
        pos.getElement(i, v);
        return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
      };
      out.push({ prim, count: pos.getCount(), at });
    }
  }
  return out;
}

const heights = (prims) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const { count, at } of prims)
    for (let i = 0; i < count; i++) {
      const y = at(i)[1];
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  return { lo, hi };
};

// each primitive's triangles kept where `keep(points)` says so
function keepTriangles(prims, keep) {
  for (const { prim, at } of prims) {
    const idx = prim.getIndices();
    if (!idx) continue;
    const a = idx.getArray();
    const kept = [];
    for (let t = 0; t < a.length; t += 3) if (keep([at(a[t]), at(a[t + 1]), at(a[t + 2])])) kept.push(a[t], a[t + 1], a[t + 2]);
    idx.setArray(new Uint32Array(kept));
  }
}

// Triangles wholly under `share` of the model’s height let go: its own
// plinth or patch of ground, where the world’s ground will be.
function trimBelow(doc, share) {
  const prims = placedPrims(doc);
  const { lo, hi } = heights(prims);
  const cut = lo + (hi - lo) * share;
  keepTriangles(prims, (p) => Math.max(p[0][1], p[1][1], p[2][1]) > cut);
}

// A scan's patch of ground let go: the stone's own footprint is read off
// its upper half (where nothing but the stone is), and every triangle low
// down with a corner outside that footprint, widened by `reach`, goes.
function trimGround(doc, { reach = 1.25, low = 0.45 } = {}) {
  const prims = placedPrims(doc);
  const { lo, hi } = heights(prims);
  const mid = lo + (hi - lo) / 2;
  let n = 0;
  let cx = 0;
  let cz = 0;
  for (const { count, at } of prims)
    for (let i = 0; i < count; i++) {
      const p = at(i);
      if (p[1] <= mid) continue;
      cx += p[0];
      cz += p[2];
      n++;
    }
  cx /= n;
  cz /= n;
  let r = 0;
  for (const { count, at } of prims)
    for (let i = 0; i < count; i++) {
      const p = at(i);
      if (p[1] > mid) r = Math.max(r, Math.hypot(p[0] - cx, p[2] - cz) * reach);
    }
  const cut = lo + (hi - lo) * low;
  keepTriangles(prims, (ps) => !ps.some((p) => p[1] < cut && Math.hypot(p[0] - cx, p[2] - cz) > r));
}

// What stands in the boxes, in the placed frame ([x0, z0, x1, z1] metres),
// let go: a stray of the source's that is no part of the model
function cutAway(doc, boxes) {
  const inBox = (x, z) => boxes.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d);
  keepTriangles(placedPrims(doc), (p) => !inBox((p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3));
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

// Bands of a material's atlas repainted (a livery): each pixel in a band
// takes the band's new colour, scaled by its brightness against the band's
// mean, so the wear, the panel lines and the lining stay.
async function recolour(doc, { material, bands }) {
  const { default: sharp } = await import('sharp');
  const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  for (const mat of doc.getRoot().listMaterials()) {
    const tex = material.test(mat.getName()) && mat.getBaseColorTexture();
    if (!tex) continue;
    const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    for (const { rows, to } of bands) {
      const [y0, y1] = rows.map((r) => Math.round(r * h));
      let mean = 0;
      for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) mean += lum(data, (y * w + x) * 4);
      mean /= (y1 - y0) * w;
      for (let y = y0; y < y1; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const k = lum(data, i) / mean;
          for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(to[c] * 255 * k));
        }
    }
    tex.setImage(await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
  }
}

async function prepared(nio, spec, tier) {
  // (a voxel model is made by class, already at the tier's triangles)
  if (spec.voxel) return voxelDoc(nio, spec, spec.cuts[tier].tris);
  const doc = await nio.read(sourceOf(spec, tier));
  const root = doc.getRoot();
  // (lines and points: nothing the world draws)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  if (spec.drop) for (const node of root.listNodes()) if (node.getMesh() && spec.drop.test(node.getName())) node.setMesh(null);
  // (older uploads are specular-glossiness, which three no longer reads)
  await doc.transform(metalRough(), prune());
  if (spec.recolour) await recolour(doc, spec.recolour);
  if (spec.bare) {
    bare(doc, spec.bare);
    // (one paint now, so one mesh: a scan's tiles would be a draw each)
    await doc.transform(flatten(), joinMeshes({ keepNamed: false }));
  }
  if (spec.ground) trimGround(doc);
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
    if (spec.cutAway) {
      cutAway(doc, spec.cutAway);
      await doc.transform(prune());
    }
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

// A Sketchfab model not yet in the cache, downloaded with the owner's token
// (SKETCHFAB_API_TOKEN, never printed): the GLB and what its page says of it
// beside it. The download API is rate-limited, so a 429 waits a minute.
async function fetchFrom(spec) {
  if (spec.made !== 'sketchfab') return;
  const file = join(CACHE, 'sketchfab', spec.from);
  if (existsSync(file)) return;
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set: run with node --env-file=.env.local');
  const api = `https://api.sketchfab.com/v3/models/${spec.uid}`;
  let glb;
  for (let tries = 0; ; tries++) {
    const r = await fetch(`${api}/download`, { headers: { Authorization: `Token ${token}` } });
    if (r.ok) {
      ({ glb } = await r.json());
      break;
    }
    if (r.status !== 429 || tries >= 8) throw new Error(`${api}/download: ${r.status}`);
    await new Promise((res) => setTimeout(res, 60000));
  }
  const r = await fetch(glb.url);
  if (!r.ok) throw new Error(`${spec.from}: download ${r.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  const m = await (await fetch(api)).json();
  await writeFile(file.replace(/\.glb$/, '.json'), `${JSON.stringify({ uid: spec.uid, title: m.name, author: m.user?.displayName, license: m.license?.slug, source: m.viewerUrl, faces: m.faceCount }, null, 1)}\n`);
  console.log(`fetched ${spec.from} (${m.name}, ${m.license?.label})`);
}

// a credit left from when a model was made another way
async function forget(file, key) {
  const credits = JSON.parse(await readFile(file, 'utf8'));
  if (!(key in credits)) return;
  delete credits[key];
  await writeFile(file, `${JSON.stringify(credits, null, 2)}\n`);
}

async function credit(name) {
  const spec = HEROES[name];
  if (spec.made === 'sketchfab') {
    const m = await (await fetch(`https://api.sketchfab.com/v3/models/${spec.uid}`)).json();
    const license = LICENCES[m.license?.slug];
    if (!license) throw new Error(`${name}: its licence (${m.license?.label}) isn’t one the site can use`);
    const credits = JSON.parse(await readFile(MODELS, 'utf8'));
    await forget(GAMES, `hogwarts/${name}`);
    credits[`hogwarts-${name}`] = { title: m.name, author: m.user.displayName || m.user.username, authorUrl: m.user.profileUrl, license, licenseUrl: m.license.url, source: m.viewerUrl, where: 'hogwarts', as: spec.what.split(',')[0].split(':')[0], file: spec.url };
    // (added where it falls, the file never re-sorted: other lanes write it too)
    await writeFile(MODELS, `${JSON.stringify(credits, null, 2)}\n`);
    return { by: credits[`hogwarts-${name}`].author, license };
  }
  await forget(MODELS, `hogwarts-${name}`);
  const credits = JSON.parse(await readFile(GAMES, 'utf8'));
  credits[`hogwarts/${name}`] =
    spec.made === 'meshy'
      ? { source: 'https://www.meshy.ai', name: `${spec.what}, generated for this site with Meshy AI from ${spec.words ? 'a written description' : 'reference photographs'}`, authors: ['Tilak Patel, with Meshy AI'], license: 'Meshy paid-plan output, owned by the site owner' }
      : { source: 'https://github.com/microsoft/TRELLIS.2', name: `${spec.what}, made for this site with TRELLIS.2 on the site owner’s machine from reference photographs (scripts/gen3d)`, authors: ['Tilak Patel, with Microsoft TRELLIS.2'], license: 'Generated for this site; TRELLIS.2 is MIT' };
  await writeFile(GAMES, `${JSON.stringify(credits, null, 2)}\n`);
  return { by: 'made for this site', license: credits[`hogwarts/${name}`].license };
}

// Each cut of a model on one sheet (scripts/gen3d/judge.mjs: four views a
// row, its triangles and bytes written in), a WebP under docs/gen3d/hogwarts/
// to look at before the model ships; a cut over the bucket's size is shown
// from the cache's copy. Needs the dev server and a browser (judge.mjs's BASE, CHROME).
async function sheetOf(name) {
  const { sheet } = await import('./gen3d/judge.mjs');
  const spec = HEROES[name];
  const files = Object.keys(spec.cuts).reverse().map((t) => join(ROOT, 'public', fileOf(name, t))).filter(existsSync);
  const png = join(CACHE, 'stage', `${name}-sheet.png`);
  await sheet(png, files);
  const out = join(ROOT, 'docs', 'gen3d', 'hogwarts', `${name}.webp`);
  await (await import('sharp')).default(png).webp({ quality: 78 }).toFile(out);
  console.log(`${out}: ${((await stat(out)).size / 1e6).toFixed(2)} MB`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sheetOnly = process.argv.includes('--sheet');
  const asked = process.argv.slice(2).filter((a) => a !== '--sheet');
  if (sheetOnly) {
    for (const name of asked.length ? asked : Object.keys(HEROES)) await sheetOf(name);
    process.exit(0);
  }
  const names = asked.length ? asked : Object.keys(HEROES);
  const bad = names.filter((n) => !HEROES[n]);
  if (bad.length) throw new Error(`no model ${bad.join(', ')}`);
  const nio = await io();
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
  for (const name of names) {
    const spec = HEROES[name];
    await fetchFrom(spec);
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
