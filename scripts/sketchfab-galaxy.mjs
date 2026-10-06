// Brings the galaxy's Sketchfab ships into the site: each one downloaded with
// the site owner's Sketchfab token (SKETCHFAB_API_TOKEN, never kept), cut
// down to what it's seen at (a fighter a few dozen pixels across, a capital
// ship a screen wide at the most) and written to public/models/galaxy/<kind>.glb,
// where galaxy/models.js loads it in place of the ship it built in code. Its
// materials are made metal-roughness (three.js no longer reads the old
// specular-glossiness ones), its parts that share a material merged into one
// mesh (one draw each), simplified to a triangle budget, its maps WebPs at a
// set size and the whole of it meshopt-compressed. Who made each one, its
// licence and where it came from are read from Sketchfab and kept in
// src/data/modelCredits.json, which the galaxy's panel shows
// (components/ModelCredits.jsx). The downloads stay out of the repo, in
// /tmp/sketchfab-galaxy/ (fetched once, kept for the next run).
//
// (scripts/sketchfab-batch.mjs does the same for models downloaded by hand,
// packed onto one sheet; this one keeps each model's own materials.)
//
//   SKETCHFAB_API_TOKEN=… NODE_USE_ENV_PROXY=1 node scripts/sketchfab-galaxy.mjs [kind …]

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, dequantize, flatten, join, meshopt, metalRough, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join as path } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'galaxy');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const CACHE = '/tmp/sketchfab-galaxy';
const API = 'https://api.sketchfab.com/v3/models';

// kind (galaxy/fleet.js's name for it) → uid: the Sketchfab model; tris:
// triangles to keep; tex: its colour and glow maps' size (its other maps
// half that, or `maps`); gain: its colours brightened (a model made for
// Sketchfab's bright viewer comes out near black under one sun); drop: its
// materials to leave off, by name; as: what it is in the galaxy (for the
// credits)
// (Tried and left built: the Hammerhead corvette, 8ca35cee5f614c289a1ff069556fef98,
// a generated model that doesn't read as one; the second Death Star,
// 17ccca0dbb6b4e338fa999202f9e6685, a cage of plating all round rather than
// the half-built one; the Munificent, 966265e37e61433b919ba640a12a33f5, whose
// paint is tiled maps that don't survive, leaving it near black; Naboo's royal
// starship, f72431e7a97e4bf994dd8b1f3f288d7c, whose maps are black.)
export const MODELS = {
  // the Rebellion's
  moncal: { uid: '9b5e5e5192f64a7faad93a3bfd2efaf2', tris: 40000, tex: 1024, as: 'the Mon Calamari cruisers' },
  nebulon: { uid: '1986f7b0dee647b3b2374eb80dbd1faf', tris: 30000, tex: 1024, as: 'the Nebulon-B frigates' },
  awing: { uid: '15d7370b56c04c2e86b16e50bf931a02', tris: 13000, tex: 512, as: 'the A-wings' },
  ywing: { uid: 'b8bb6476b1b14ba48987c7efc7b7087a', tris: 14000, tex: 512, as: 'the Y-wings' },
  bwing: { uid: '08293253519a455483970295430b3a73', tris: 14000, tex: 512, as: 'the B-wings' },
  uwing: { uid: '8d7539ceba7142c2ab5ce296659c026d', tris: 14000, tex: 1024, as: 'the U-wings' },
  ghost: { uid: '8740b94179ba43a7ac6476973ca0c577', tris: 30000, tex: 1024, as: 'the Ghost' },
  // the Empire's
  executor: { uid: '0e4cbb98a2ba43f2a11498061b3f21d8', tris: 50000, tex: 1024, as: 'the Executor' },
  tie: { uid: '79d9403f15334c129ea5454daffe6b5c', tris: 8000, tex: 512, as: 'the TIE fighters' },
  tiebomber: { uid: '03c30934651e4f5798b67e74049ec6bc', tris: 8000, tex: 512, as: 'the TIE bombers' },
  tieadvanced: { uid: '0b3825de4fa542a893c9f9344b7e5f31', tris: 8000, tex: 512, as: 'Vader’s TIE Advanced' },
  shuttle: { uid: '9d160e16845a4b518a2d30a7c716f20d', tris: 12000, tex: 1024, as: 'the Imperial shuttles' },
  lightcruiser: { uid: '5a5d6adf2e0444d5be94323938f6d329', tris: 5000, tex: 1024, as: 'Moff Gideon’s light cruisers' },
  gozanti: { uid: '6a587e545b1c48bea95480b49458ac63', tris: 20000, tex: 1024, as: 'the Gozanti cruisers' },
  // the Separatists'
  lucrehulk: { uid: '8bb11e0ad31e4b23b1783e10242c5115', tris: 20000, tex: 1024, as: 'the droid control ships' },
  coreship: { uid: '0d829115bb4d472da5d05cdf529b6694', tris: 20000, tex: 1024, as: 'the Separatist core ships' },
  vulture: { uid: '5542f951834e4032b229ebdee12d3310', tris: 10000, tex: 512, as: 'the vulture droids' },
  trifighter: { uid: '9c06ba9b24144221aa80f56192f485b6', tris: 10000, tex: 512, as: 'the droid tri-fighters' },
  munificent: { uid: '44d5db77bb1342e5a6e58c24a0dcb256', tris: 25000, tex: 1024, as: 'the Munificent frigates' },
  providence: { uid: '8d27764a7d254fd7948557daf6d7ccdc', tris: 10000, tex: 1024, as: 'the Invisible Hand' },
  // the Republic's
  acclamator: { uid: 'e6a2171be5c34bb68a05aba657fd8fa8', tris: 30000, tex: 1024, as: 'the Acclamators' },
  delta7: { uid: 'b4a8ad8a1e8b4e5b961cf4726d8a8646', tris: 12000, tex: 512, as: 'the Jedi starfighters' },
  arc170: { uid: 'b9407262cdf34d37b0720ca6b70469be', tris: 14000, tex: 512, as: 'the ARC-170s' },
  n1: { uid: '3cf69f6c85234aac8844e845e74ac75b', tris: 12000, tex: 512, as: 'the Naboo N-1 starfighters' },
  nubian: { uid: 'f631077977754b5591298ecfa201380b', tris: 20000, tex: 1024, as: 'the Naboo royal starship' },
};

const token = process.env.SKETCHFAB_API_TOKEN;
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };

const json = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

// the download, fetched once
async function download(kind, uid) {
  const file = path(CACHE, `${kind}.glb`);
  if (existsSync(file)) return file;
  if (!token) throw new Error('SKETCHFAB_API_TOKEN is not set');
  const { glb } = await json(`${API}/${uid}/download`, { Authorization: `Token ${token}` });
  if (!glb?.url) throw new Error(`${kind}: no .glb to download`);
  const r = await fetch(glb.url);
  if (!r.ok) throw new Error(`${kind}: download ${r.status}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

// who made it, from the model's public page
async function credit(kind, uid, as) {
  const m = await json(`${API}/${uid}`);
  const license = LICENCES[m.license?.slug];
  if (!license) throw new Error(`${kind}: its licence (${m.license?.label}) isn't one the site can use`);
  return {
    title: m.name,
    author: m.user.displayName || m.user.username,
    authorUrl: m.user.profileUrl,
    license,
    licenseUrl: m.license.url,
    source: m.viewerUrl,
    where: 'galaxy',
    as,
    file: `/models/galaxy/${kind}.glb`,
    also: ['galaxy'],
  };
}

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// Some exports wrap a ship that never moves in a skeleton (a root bone or
// two, doing nothing but holding it as it stands, or holding the scale the
// compression left there). Copies of a skinned part would all stay bound to
// the first one's bones, wherever they were placed, so each skinned part is
// baked as its bones hold it, back into its own node's frame, and is a plain
// mesh after; the animations go too (a ship here is posed by the scene).
const mul4 = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function invert4(m) {
  // (a node's world matrix: rotation, scale and translation, so its inverse
  // by the adjugate of the 3x3 and the translation carried back)
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inv3 = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const o = [inv3[0], inv3[1], inv3[2], 0, inv3[3], inv3[4], inv3[5], 0, inv3[6], inv3[7], inv3[8], 0, 0, 0, 0, 1];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * t[0] + o[4 + r] * t[1] + o[8 + r] * t[2]);
  return o;
}
const unskinned = () => (doc) => {
  const root = doc.getRoot();
  for (const a of root.listAnimations()) a.dispose();
  for (const node of root.listNodes()) {
    const skin = node.getSkin();
    if (!skin || !node.getMesh()) continue;
    const ibm = skin.getInverseBindMatrices();
    const back = invert4(node.getWorldMatrix());
    const bones = skin.listJoints().map((joint, i) => mul4(back, mul4(joint.getWorldMatrix(), ibm ? ibm.getElement(i, []) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      const p = [];
      const n = [];
      const j = [];
      const w = [];
      const P = new Float32Array(pos.getCount() * 3);
      const N = nor ? new Float32Array(nor.getCount() * 3) : null;
      for (let v = 0; v < pos.getCount(); v++) {
        pos.getElement(v, p);
        if (nor) nor.getElement(v, n);
        joints.getElement(v, j);
        weights.getElement(v, w);
        const out = [0, 0, 0];
        const outN = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
          if (!w[k]) continue;
          const m = bones[j[k]];
          for (let r = 0; r < 3; r++) {
            out[r] += w[k] * (m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
            if (nor) outN[r] += w[k] * (m[r] * n[0] + m[4 + r] * n[1] + m[8 + r] * n[2]);
          }
        }
        P.set(out, v * 3);
        if (nor) {
          const l = Math.hypot(...outN) || 1;
          N.set(outN.map((x) => x / l), v * 3);
        }
      }
      // (new accessors: the old ones may be shared with other parts)
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(pos.getBuffer()));
      if (nor) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(nor.getBuffer()));
      for (const name of prim.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(name)) prim.setAttribute(name, null);
    }
    node.setSkin(null);
  }
};

// Its materials made for the galaxy's light: nothing more than half metal (a
// fully metal hull, with only the dark sky to reflect, comes out black), its
// colours brightened by `gain`, and any material in `drop` left off with its
// parts.
const relit = ({ gain = 1, drop = null }) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (drop?.test(prim.getMaterial()?.getName() ?? '')) prim.dispose();
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.5));
    const [r, g, b, a] = m.getBaseColorFactor();
    m.setBaseColorFactor([...[r, g, b].map((c) => Math.min(1, c * gain)), a]);
  }
};

// Parts with no maps on them don't need their UVs, or their tangents: without
// them, the corners either side of a UV seam are one corner again, and the
// simplifier can fold across them.
const bareWhereUntextured = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const mapped = m && [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].some(Boolean);
      for (const name of prim.listSemantics()) if (name === 'TANGENT' || (!mapped && name.startsWith('TEXCOORD_'))) prim.setAttribute(name, null);
    }
};

// The simplifier, on each merged mesh, its share of the budget at a time,
// a step rougher each time it stops short: first keeping to the mesh's seams
// and edges, then folding across its seams ('Permissive'), and last, for a
// model built of thousands of loose pieces that won't fold at all, the sloppy
// one, which merges corners on a grid. Bits too small to see go ('Prune').
const simplified = (tris) => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const all = prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  if (all <= tris * 1.1) return;
  for (const prim of prims) {
    const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
    let indices = new Uint32Array(prim.getIndices().getArray());
    const target = Math.floor((indices.length * tris) / all / 3) * 3;
    const steps = [
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.01, ['Prune'])[0],
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.03, ['Prune', 'Permissive'])[0],
      (ix) => MeshoptSimplifier.simplifySloppy(ix, positions, 3, null, target, 0.02)[0],
    ];
    for (const step of steps) if (indices.length > target * 1.15) indices = step(indices);
    // (a part that's gone altogether)
    if (!indices.length) {
      prim.dispose();
      continue;
    }
    prim.setIndices(doc.createAccessor().setArray(indices).setBuffer(buffer));
    compactPrimitive(prim);
  }
};

async function bring(io, kind, spec) {
  const src = await download(kind, spec.uid);
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const before = triangles(doc);
  // (lines and points: nothing seen at this size)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  await doc.transform(dequantize(), unskinned(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  await doc.transform(simplified(spec.tris));
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps ?? spec.tex / 2, spec.maps ?? spec.tex / 2], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path(OUT, `${kind}.glb`);
  await io.write(out, doc);
  const draws = root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0);
  const bytes = (await stat(out)).size;
  console.log(`${kind.padEnd(12)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${draws} draws, ${root.listTextures().length} maps, ${(bytes / 1024).toFixed(0)} KB`);
}

async function main() {
  const only = process.argv.slice(2);
  for (const k of only) if (!MODELS[k]) throw new Error(`no ${k} in MODELS`);
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  for (const kind of only.length ? only : Object.keys(MODELS)) {
    const spec = MODELS[kind];
    await bring(io, kind, spec);
    credits[`galaxy-${kind}`] = await credit(kind, spec.uid, spec.as);
  }
  const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
