// A Quaternius pack as the site's kit: one GLB a family (every birch in
// birch.glb, sharing its bark and its leaves) plus a manifest, into
// public/kit/<pack>/, from the pack as fetched into lab/assets/<pack>/ by
// scripts/assets-fetch.mjs (or a tilakverse-assets clone, --from). The
// loader (src/lib/three/kit.js) and the placers read them; the manual is
// scripts/kit/README.md, the design docs/superpowers/specs/2026-10-08-kit-worlds-design.md.
//
//   node scripts/kit/import.mjs <pack> [family …] [--from <dir>] [--out <dir>] [--dry]
//
// In each family file a model is a node named as the model, its meshes named
// so too, each primitive tagged `extras.part` ('bark', 'leaves' or 'main');
// beside it `<name>.lod1`, the same parts thinner (bark and solid parts
// simplified to a quarter, a tree's or a bush's leaf cards thinned to 40 %
// and grown to cover). A rigged model is a file of its own with its skin and
// clips, and no LOD1. The nature megakit's COLOR_0 is the wind weight it
// paints (0.03 to 0.14 at a trunk's foot, to 1 in the crown) and becomes
// `_WIND`, one normalised byte; every other COLOR_0 goes. A leaf (a material
// named for leaves or flowers, or one cut out by its map's alpha) is MASK at
// 0.3 and two-sided; everything else is opaque. Textures go to WebP q82 by role
// (bark and solid colour 1024, normals 1024, leaves 512 with their alpha, a
// palette atlas lossless at its own size). Then dedup, prune, meshopt. A
// family over 1.5 MiB goes into `<family>.glb`, `<family>-2.glb` … in model
// order, each as full as fits; only a model over it on its own has its bark
// colour halved, in every family that wears that bark.
//
//   SOURCES[pack] → { dirs, ext?, title, wind?, atlas? }
//   importPack({ pack, from, out, families, log, dry, cap }) → manifest   (cap: a file's bytes, BUDGET.file)

import { Document, Logger, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compressTexture, dedup, dequantize, meshopt, mergeDocuments, prune, resample, simplifyPrimitive, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { familyOf, kindOf, thinCards, windFromColor } from './lib.mjs';
import { BUDGET, buildManifest, byName, checkManifest, sortByName } from './manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Where each pack keeps its glTF (folders under lab/assets/<pack>/; the FBX
// packs' are converted beside it by scripts/kit/fbx.mjs), what it is called
// in the credit, and how it is read: `wind` turns COLOR_0 into the wind
// weight, `sway` bends a pack's trees and bushes that paint none by their
// height alone (the loader gives such a part a weight of one a vertex),
// `atlas` names the one palette material every model wears.
export const SOURCES = {
  naturemega: { dirs: ['glTF'], ext: ['.gltf'], title: 'Stylized Nature MegaKit', wind: true },
  nature: { dirs: ['glTF'], ext: ['.gltf'], title: 'Stylized Nature Pack', sway: true },
  space: { dirs: ['Characters/GLTF', 'Environment/GLTF', 'Items/GLTF', 'Vehicles/GLTF'], ext: ['.gltf'], title: 'Ultimate Space Kit', atlas: 'Atlas' },
  city: { dirs: ['Exports/glTF (Godot)'], title: 'Downtown City MegaKit' },
  farm: { dirs: ['../farm-glb'], ext: ['.glb'], title: 'Farm Animals' },
  street: { dirs: ['../street-glb'], ext: ['.glb'], title: 'Street Pack' },
  furniture: { dirs: ['../furniture-glb'], ext: ['.glb'], title: 'Furniture Pack' },
};

// A material is a leaf by its name, or by being cut out in the source (MASK
// or BLEND) by a map that really is see-through somewhere (every map in the
// nature packs is RGBA, the bark's too, opaque to the last texel).
const LEAF = /^(Leaves|Leaf|Flowers)/;
const SEE_THROUGH = 250;
const CUTOFF = 0.3;
// the texture sizes by role, and their WebP quality
const SIZE = { bark: 1024, normal: 1024, leaf: 512, main: 1024, halved: 512 };
const QUALITY = 82;
// LOD1: what share of a solid part simplify aims for, within what error (a
// share of the part's size), and the share of leaf cards kept
const LOD = { ratio: 0.25, error: 0.05, keep: 0.4 };
const CROWNED = new Set(['tree', 'bush']);
// meshopt as the other imports have it, but normals in a byte a component
// (half a degree, under a Lambert): a family is mostly its geometry, and
// that is a sixth of it (the nature megakit 12.8 → 11.0 MiB)
const MESHOPT = { level: 'medium', quantizeNormal: 8 };

const hash = (bytes) => (bytes ? createHash('sha1').update(bytes).digest('hex') : '');
// a seed from a name (FNV-1a), so a crown thins the same way every import
const seedOf = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
// a name as a RegExp matches it, every character as itself
const literally = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const trisOf = (prim) => (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;

// (bark UVs tile past 0..1, which quantize keeps as floats, saying so for
// every trunk)
class Quiet extends Logger {
  warn(text) {
    if (!/out of \[0,1\] range/.test(text)) super.warn(text);
  }
}
const quiet = () => new Quiet(Logger.Verbosity.WARN);

function createIO() {
  return new NodeIO()
    .setLogger(quiet())
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// The model files of a pack: every .gltf/.glb in its folders, named by file.
function listModels(base, source) {
  const ext = source.ext ?? ['.gltf', '.glb'];
  const found = [];
  for (const d of source.dirs) {
    const dir = join(base, d);
    if (!existsSync(dir)) throw new Error(`no ${dir}: fetch the pack first (node scripts/assets-fetch.mjs <pack>) or pass --from`);
    for (const f of readdirSync(dir).sort(byName)) {
      if (ext.includes(extname(f).toLowerCase())) found.push({ name: f.slice(0, -extname(f).length), path: join(dir, f) });
    }
  }
  return found;
}

// Every node, mesh-bearing or not, under (and including) `node`, parents first.
const subtree = (node) => [node, ...node.listChildren().flatMap(subtree)];
const primsOf = (node) => subtree(node).flatMap((n) => n.getMesh()?.listPrimitives() ?? []);

// A model read and made ready to merge: one root node named as the model
// (its scene's roots gathered under one when there are several, or when the
// one is named otherwise), its meshes named so, COLOR_0 made the wind weight
// or dropped.
async function readModel(io, { name, path }, source) {
  const doc = await io.read(path);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  let root = scene.listChildren()[0];
  if (scene.listChildren().length !== 1 || root.getName() !== name) {
    root = doc.createNode(name);
    for (const n of scene.listChildren()) {
      scene.removeChild(n);
      root.addChild(n);
    }
    scene.addChild(root);
  }
  for (const n of subtree(root)) n.getMesh()?.setName(name);
  for (const prim of primsOf(root)) {
    const color = prim.getAttribute('COLOR_0');
    if (!color) continue;
    if (source.wind) {
      // (floats on the trees, normalised shorts on the ground cover: read
      // either as 0..1)
      const n = color.getElementSize();
      const floats = new Float32Array(color.getCount() * n);
      const el = [];
      for (let i = 0; i < color.getCount(); i++) floats.set(color.getElement(i, el), i * n);
      const wind = doc.createAccessor('_WIND').setType('SCALAR').setArray(windFromColor(floats, n)).setNormalized(true).setBuffer(color.getBuffer());
      prim.setAttribute('_WIND', wind);
    }
    prim.setAttribute('COLOR_0', null);
  }
  return { name, doc, root, rigged: doc.getRoot().listSkins().length > 0, kind: kindOf(name, source.pack) };
}

const decode = async (image) => {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8Array(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
};

// The pack's materials, decided once for every file: whether each is a leaf,
// and its name. Materials are shared by name across the family files, so two
// that share a name but not their maps or their colour (the space kit's
// atlases, which differ a few texels file to file; the farm animals' flat
// colours, one `Brown` darker than another) become `Name`, `Name_2`… by how
// many models wear each. Each material is set up as the kit draws it.
async function settleMaterials(models, source) {
  const seen = new Map(); // base name → maps' and colour's key → { count, models, materials, image, cut }
  for (const m of models) {
    for (const mat of m.doc.getRoot().listMaterials()) {
      const base = source.atlas ?? mat.getName();
      const image = mat.getBaseColorTexture()?.getImage();
      const key = `${hash(image)}|${hash(mat.getNormalTexture()?.getImage())}|${mat.getBaseColorFactor().map((x) => x.toFixed(4))}`;
      const byKey = seen.get(base) ?? seen.set(base, new Map()).get(base);
      const entry = byKey.get(key) ?? byKey.set(key, { count: 0, materials: [], image, cut: false, models: new Set() }).get(key);
      if (!entry.models.has(m.name)) entry.count++;
      entry.models.add(m.name);
      entry.materials.push(mat);
      entry.cut ||= mat.getAlphaMode() !== 'OPAQUE';
    }
  }
  const defs = {};
  const alphaOf = new Map();
  for (const [base, byKey] of seen) {
    const ranked = [...byKey.values()].sort((a, b) => b.count - a.count);
    for (const [i, entry] of ranked.entries()) {
      const name = i ? `${base}_${i + 1}` : base;
      let leaf = LEAF.test(base);
      if (!leaf && entry.cut && entry.image) {
        const k = hash(entry.image);
        if (!alphaOf.has(k)) {
          const { rgba } = await decode(entry.image);
          let least = 255;
          for (let p = 3; p < rgba.length; p += 4) least = Math.min(least, rgba[p]);
          alphaOf.set(k, least);
        }
        leaf = alphaOf.get(k) < SEE_THROUGH;
      }
      defs[name] = { leaf, wind: false, worn: [], maps: {}, pixels: leaf && entry.image ? await decode(entry.image) : undefined };
      for (const mat of entry.materials) {
        mat.setName(name);
        if (leaf) mat.setAlphaMode('MASK').setAlphaCutoff(CUTOFF).setDoubleSided(true);
        else mat.setAlphaMode('OPAQUE').setAlphaCutoff(0.5);
      }
    }
  }
  // each primitive's part, which materials carry the wind weight, and what
  // kinds of model wear each (all of the pack's, imported now or not)
  for (const m of models) {
    for (const prim of primsOf(m.root)) {
      const def = defs[prim.getMaterial()?.getName()];
      const part = def?.leaf ? 'leaves' : CROWNED.has(m.kind) && !m.rigged ? 'bark' : 'main';
      prim.setExtras({ ...prim.getExtras(), part });
      if (!def) continue;
      if (prim.getAttribute('_WIND') || (source.sway && CROWNED.has(m.kind) && !m.rigged)) def.wind = true;
      def.worn = [...new Set([...def.worn, m.rigged ? 'character' : m.kind])].sort(byName);
    }
  }
  return defs;
}

// A leaf part's LOD1: its cards thinned (thinCards), every attribute
// gathered by the kept vertices.
function thinned(doc, prim, seed) {
  const buffer = doc.getRoot().listBuffers()[0];
  const indices = Uint32Array.from(prim.getIndices().getArray());
  const t = thinCards(prim.getAttribute('POSITION').getArray(), indices, LOD.keep, seed);
  const out = doc.createPrimitive().setMode(prim.getMode()).setMaterial(prim.getMaterial()).setExtras({ ...prim.getExtras() });
  for (const semantic of prim.listSemantics()) {
    const src = prim.getAttribute(semantic);
    const n = src.getElementSize();
    const from = src.getArray();
    let array = t.positions;
    if (semantic !== 'POSITION') {
      array = new from.constructor(t.map.length * n);
      for (let v = 0; v < t.map.length; v++) for (let k = 0; k < n; k++) array[v * n + k] = from[t.map[v] * n + k];
    }
    out.setAttribute(semantic, doc.createAccessor().setType(src.getType()).setNormalized(src.getNormalized()).setArray(array).setBuffer(buffer));
  }
  const index = t.map.length < 65535 ? Uint16Array.from(t.indices) : t.indices;
  return out.setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(buffer));
}

// A solid part's LOD1: a copy simplified toward a quarter (or null when
// nothing is left of it). The packs' bark is cut into hundreds of UV islands
// whose every edge is a seam the simplifier will not cross, so on its own it
// stops at 80-96 %; let across seams ('Permissive', an error of 0.1-0.4 %
// of the tree's size there) it reaches the quarter. Through gltf-transform's
// simplifyPrimitive, which passes meshopt no flags but LockBorder.
const PERMISSIVE = { ...MeshoptSimplifier, simplify: (i, p, s, n, e, flags = []) => MeshoptSimplifier.simplify(i, p, s, n, e, [...flags, 'Permissive']) };
function simplified(prim) {
  const out = prim.clone();
  simplifyPrimitive(out, { simplifier: PERMISSIVE, ratio: LOD.ratio, error: LOD.error, lockBorder: false });
  if (out.getIndices().getCount() >= 3) return out;
  out.dispose();
  return null;
}

// A model's LOD1 beside it: its node tree again (`<node>.lod1`, the same
// transforms), each mesh `<name>.lod1` with its parts thinner. Returns the
// LOD1 parts' triangles in the order of the model's parts.
function addLod1(doc, scene, model) {
  const tris1 = [];
  let part = 0;
  const copy = (node, name) => {
    const lod = doc.createNode(name).setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale());
    const mesh = node.getMesh();
    if (mesh) {
      const out = doc.createMesh(`${model.name}.lod1`);
      for (const prim of mesh.listPrimitives()) {
        const leafy = prim.getExtras().part === 'leaves' && CROWNED.has(model.kind);
        const p = leafy ? thinned(doc, prim, seedOf(model.name) + part) : simplified(prim);
        part++;
        tris1.push(p ? trisOf(p) : 0);
        if (p) out.addPrimitive(p);
      }
      if (out.listPrimitives().length) lod.setMesh(out);
      else out.dispose();
    }
    for (const child of node.listChildren()) if (primsOf(child).length) lod.addChild(copy(child, `${child.getName()}.lod1`));
    return lod;
  };
  scene.addChild(copy(model.node, `${model.name}.lod1`));
  return tris1;
}

// Every vertex of a model where it stands (its nodes' transforms applied),
// for its footprint; or only its parts that `keep` says (its bark, for its trunk).
function positionsOf(node, keep = () => true) {
  const out = [];
  for (const n of subtree(node)) {
    const m = n.getWorldMatrix();
    for (const prim of (n.getMesh()?.listPrimitives() ?? []).filter(keep)) {
      const pos = prim.getAttribute('POSITION');
      const v = [];
      for (let i = 0; i < pos.getCount(); i++) {
        const [x, y, z] = pos.getElement(i, v);
        out.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
    }
  }
  return new Float32Array(out);
}

// A rig's size: its bones and each clip's length in seconds.
function rigOf(doc) {
  const bones = Math.max(...doc.getRoot().listSkins().map((s) => s.listJoints().length));
  const clips = {};
  for (const anim of doc.getRoot().listAnimations()) {
    clips[anim.getName()] = Number(Math.max(0, ...anim.listSamplers().map((s) => s.getInput().getMax([])[0])).toFixed(3));
  }
  return { bones, clips };
}

// One family file (or one rigged model's): the models merged into one
// document, their materials one per name, dequantized and welded, LOD1s added, textures
// compressed by role (bark colour at `halve`'s size for the materials
// named in it), then dedup, prune, meshopt. Returns the GLB's bytes and
// what the manifest needs.
async function buildFile(io, group, defs, source, halve) {
  const doc = new Document().setLogger(quiet());
  doc.createBuffer();
  const scene = doc.createScene();
  doc.getRoot().setDefaultScene(scene);
  for (const model of group.models) {
    const map = mergeDocuments(doc, model.doc);
    for (const s of model.doc.getRoot().listScenes()) {
      const merged = map.get(s);
      for (const n of merged.listChildren()) {
        merged.removeChild(n);
        scene.addChild(n);
      }
      merged.dispose();
    }
    model.node = map.get(model.root);
  }
  const named = new Map();
  for (const mat of doc.getRoot().listMaterials()) {
    const first = named.get(mat.getName());
    if (!first) named.set(mat.getName(), mat);
    else {
      for (const parent of mat.listParents()) if (parent.propertyType === PropertyType.PRIMITIVE) parent.swap(mat, first);
      mat.dispose();
    }
  }
  // (a source that comes quantized is read back to floats, for the LOD1's
  // arithmetic; never the wind byte or the rig's)
  await doc.transform(unpartition(), dequantize({ pattern: /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+)$/ }), dedup({ propertyTypes: [PropertyType.TEXTURE] }), weld());

  const models = [];
  for (const model of group.models) {
    const prims = primsOf(model.node);
    const tris1 = model.rigged ? [] : addLod1(doc, scene, model);
    models.push({
      name: model.name,
      positions: positionsOf(model.node),
      bark: positionsOf(model.node, (p) => p.getExtras().part === 'bark'),
      parts: prims.map((p, i) => ({ part: p.getExtras().part, material: p.getMaterial().getName(), tris: trisOf(p), tris1: model.rigged ? undefined : tris1[i] })),
      ...(model.rigged ? { rig: rigOf(doc) } : {}),
    });
  }

  // textures by role
  const roles = new Map();
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  for (const mat of named.values()) {
    const def = defs[mat.getName()];
    const barky = prims.some((p) => p.getMaterial() === mat && p.getExtras().part === 'bark');
    const colour = source.atlas ? 'atlas' : def.leaf ? 'leaf' : !barky ? 'main' : halve.has(mat.getName()) ? 'halved' : 'bark';
    const slots = { colour: mat.getBaseColorTexture(), normal: mat.getNormalTexture() };
    for (const [slot, tex] of Object.entries(slots)) if (tex) roles.set(tex, slot === 'normal' ? 'normal' : colour);
    for (const tex of [mat.getMetallicRoughnessTexture(), mat.getOcclusionTexture(), mat.getEmissiveTexture()]) if (tex && !roles.has(tex)) roles.set(tex, 'main');
  }
  for (const [tex, role] of roles) {
    if (role === 'atlas') await compressTexture(tex, { encoder: sharp, targetFormat: 'webp', lossless: true });
    else await compressTexture(tex, { encoder: sharp, targetFormat: 'webp', resize: [SIZE[role], SIZE[role]], quality: QUALITY });
  }
  const bark = [...named.values()].filter((mat) => ['bark', 'halved'].includes(roles.get(mat.getBaseColorTexture()))).map((mat) => mat.getName());
  const maps = {};
  for (const mat of named.values()) {
    maps[mat.getName()] = Object.fromEntries(
      Object.entries({ colour: mat.getBaseColorTexture(), normal: mat.getNormalTexture() })
        .filter(([, t]) => t)
        .map(([slot, t]) => [slot, t.getSize()]),
    );
  }

  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE, PropertyType.MATERIAL, PropertyType.SKIN], keepUniqueNames: true }),
    prune(),
    ...(group.models.some((m) => m.rigged) ? [resample()] : []),
    meshopt({ encoder: MeshoptEncoder, ...MESHOPT }),
  );
  return { bytes: await io.writeBinary(doc), models, maps, bark };
}

// A group's files: the whole family in one when it fits under `cap`, else
// split in model order, each file as full as fits (`<family>.glb`,
// `<family>-2.glb` …). Materials keep their names across the files; the kit
// shares them by name.
async function filesOf(io, group, defs, source, halve, cap) {
  const build = (models) => buildFile(io, { ...group, models }, defs, source, halve);
  const whole = await build(group.models);
  if (whole.bytes.byteLength <= cap || group.models.length === 1) return [{ ...whole, file: group.file, count: group.models.length }];
  const out = [];
  let held = [];
  let last = null;
  for (const m of group.models) {
    const next = await build([...held, m]);
    if (held.length && next.bytes.byteLength > cap) {
      out.push({ ...last, count: held.length });
      held = [m];
      last = await build(held);
    } else {
      held.push(m);
      last = next;
    }
  }
  out.push({ ...last, count: held.length });
  return out.map((b, i) => ({ ...b, file: i ? `${group.family}-${i + 1}.glb` : group.file }));
}

// The pack's models gathered into files: one a family, or one a rigged model.
function groupsOf(models, families) {
  const groups = new Map();
  for (const m of models) {
    const family = familyOf(m.name);
    if (families.length && !families.includes(family)) continue;
    const file = m.rigged ? `${m.name.toLowerCase()}.glb` : `${family}.glb`;
    const g = groups.get(file) ?? groups.set(file, { family, file, models: [] }).get(file);
    g.models.push(m);
  }
  return [...groups.values()].sort((a, b) => byName(a.file, b.file));
}

export async function importPack({ pack, from, out, families = [], log = console.log, dry = false, cap = BUDGET.file }) {
  if (!SOURCES[pack] && !from) throw new Error(`no pack "${pack}" (one of ${Object.keys(SOURCES).join(', ')}, or any name with --from <dir>)`);
  // (a pack not in SOURCES is read from --from itself, as the megakit is)
  const source = { pack, ...(SOURCES[pack] ?? { dirs: [''], title: pack, wind: true }) };
  const base = from ?? join(ROOT, 'lab', 'assets', pack);
  out ??= join(ROOT, 'public', 'kit', pack);
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = createIO();

  const files = listModels(base, source);
  if (!files.length) throw new Error(`no models in ${base}`);
  const models = [];
  for (const f of files) models.push(await readModel(io, f, source));
  const defs = await settleMaterials(models, source);
  const groups = groupsOf(models, families);
  if (!groups.length) throw new Error(`no family ${families.join(', ')} in ${pack}`);

  // build every group's files; a family over the cap is split. Only a model
  // over it on its own has its bark colour halved, and then every group that
  // wears that bark is built again so the bark is the same in each (a
  // partial import starts from the bark the manifest already has halved).
  const index = join(out, 'index.json');
  const old = families.length && existsSync(index) ? JSON.parse(await readFile(index, 'utf8')) : null;
  const halve = new Set(Object.entries(old?.materials ?? {}).flatMap(([name, m]) => (m.maps.colour && parseInt(m.maps.colour) <= SIZE.halved ? [name] : [])));
  const built = new Map(); // group file → { files, halved }
  let pending = groups;
  while (pending.length) {
    for (const g of pending) built.set(g.file, { files: await filesOf(io, g, defs, source, halve, cap), halved: new Set(halve) });
    for (const { files: list } of built.values()) for (const b of list) if (b.count === 1 && b.bytes.byteLength > cap) b.bark.forEach((n) => halve.add(n));
    pending = groups.filter((g) => built.get(g.file).files.some((b) => b.bark.some((n) => halve.has(n) && !built.get(g.file).halved.has(n))));
  }

  const written = groups.flatMap((g) => built.get(g.file).files.map((b) => ({ ...b, group: g })));
  const entries = written.map((b) => {
    const materials = {};
    for (const [name, wh] of Object.entries(b.maps)) materials[name] = { ...defs[name], maps: wh };
    const tris = b.models.reduce((n, m) => n + m.parts.reduce((k, p) => k + p.tris, 0), 0);
    const tris1 = b.models.reduce((n, m) => n + m.parts.reduce((k, p) => k + (p.tris1 ?? 0), 0), 0);
    const lod = b.models.some((m) => !m.rig) ? String(tris1) : '-';
    log(`${b.file.padEnd(34)} ${String(b.models.length).padStart(3)} models  ${String(tris).padStart(7)} → ${lod.padStart(6)} tris  ${(b.bytes.byteLength / 1048576).toFixed(2)} MiB`);
    return { family: b.group.family, file: b.file, models: b.models, materials };
  });
  const halved = [...halve].filter((n) => written.some((b) => b.bark.includes(n))).sort(byName);
  if (halved.length) log(`bark colour halved to ${SIZE.halved}: ${halved.join(', ')}`);
  let manifest = buildManifest(pack, entries, { title: source.title });

  if (dry) {
    for (const [name, m] of Object.entries(manifest.models)) {
      log(`  ${name.padEnd(30)} ${m.kind.padEnd(9)} ${m.parts.join('+').padEnd(16)} ${m.tris} → ${m.tris1 ?? '-'} tris${m.rig ? `  rig ${JSON.stringify(m.rig)}` : ''}`);
    }
    return manifest;
  }

  await mkdir(out, { recursive: true });
  for (const b of written) await writeFile(join(out, b.file), b.bytes);
  // (a family split before and not now, or into fewer, leaves no stale part)
  const parts = new Set(written.map((b) => b.file));
  for (const f of readdirSync(out)) {
    if (groups.some((g) => new RegExp(`^${literally(g.family)}-\\d+\\.glb$`).test(f)) && !parts.has(f)) await rm(join(out, f));
  }
  // a partial import keeps the other families' entries
  if (old) {
    const files = new Set(groups.map((g) => g.file));
    const models = Object.fromEntries(Object.entries(old.models).filter(([, m]) => !files.has(m.file) && !families.includes(m.family)));
    manifest = { ...manifest, models: sortByName({ ...models, ...manifest.models }), materials: sortByName({ ...old.materials, ...manifest.materials }) };
  }
  await writeFile(index, `${JSON.stringify(manifest, null, 2)}\n`);

  const sizes = {};
  for (const file of new Set(Object.values(manifest.models).map((m) => m.file))) {
    if (existsSync(join(out, file))) sizes[file] = (await stat(join(out, file))).size;
  }
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  log(`${Object.keys(manifest.models).length} models in ${Object.keys(sizes).length} files, ${(total / 1048576).toFixed(2)} MiB → ${out}`);
  for (const e of checkManifest(manifest, sizes)) log(`  over budget: ${e}`);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args.splice(i, 2)[1];
  };
  const from = flag('--from');
  const out = flag('--out');
  const dry = args.includes('--dry');
  const [pack, ...families] = args.filter((a) => a !== '--dry');
  if (!pack) {
    console.log('node scripts/kit/import.mjs <pack> [family …] [--from <dir>] [--out <dir>] [--dry]');
    process.exit(1);
  }
  await importPack({ pack, from: from && resolve(from), out: out && resolve(out), families: families.map((f) => f.toLowerCase()), dry });
}
