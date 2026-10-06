// Brings Cybertron's robots, vehicles and landmarks into the site, the
// Aligned continuity's: High Moon Studios' War for Cybertron and Fall of
// Cybertron for Iacon at war, Transformers: Prime for Team Prime's base and
// Jasper. Each is downloaded with the site owner's Sketchfab token
// (SKETCHFAB_API_TOKEN, never kept), cut down the way the galaxy's surface
// models are (scripts/sketchfab-surface.mjs: metal-roughness materials, the
// parts that share a material merged, simplified to a triangle budget, WebP
// maps, meshopt), and set on the ground: upright, facing +z, scaled to its
// size in metres, stood on y = 0 with the middle of its footprint at the
// origin. A model that came with a skeleton keeps it and its clips (`rig`).
// It's written to public/models/cybertron/<kind>.glb, and who made it, its
// licence and its source go into src/data/modelCredits.json (as
// `cybertron-<kind>`), which the Cybertron page shows.
//
// The catalogue is src/components/cybertron/game/catalog.js (the game reads
// it too). An entry: { uid, as, metres, along, yaw, up, tris, tex, maps,
// gain, drop, colours, rig, node, pose, also, skinnedOnly, file, role, era }, as in
// sketchfab-surface.mjs, plus `node` (a RegExp source: keep only the scene's
// nodes whose name, or an ancestor's, matches, for a file that holds several
// robots side by side), `pose` (a still model from a rigged one: its bones as
// its first clip has them that many seconds in), `also` (other pages that
// show it, for its credit) and what the game wants to know (file, role, era).
//
//   NODE_USE_ENV_PROXY=1 node scripts/sketchfab-cybertron.mjs [kind …]
//       the catalogue's models (all, or those named), with their credits
//   … --inspect <uid> [--kind name]
//       what's in a download as it comes: its nodes, meshes, materials,
//       maps, skins and clips, size and which way is up (as JSON)
//   … --spec '<json>' --kind <name>
//       one model from a spec given here, for trying settings: written to
//       public/models/cybertron/<name>.glb, no credit, catalogue untouched
//
// The downloads stay out of the repo, in /tmp/sketchfab-cybertron/ (fetched
// once, kept for the next run).

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, dequantize, flatten, join, meshopt, metalRough, prune, resample, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join as path } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path(ROOT, 'public', 'models', 'cybertron');
const CATALOG = path(ROOT, 'src', 'components', 'cybertron', 'game', 'catalog.js');
const CREDITS = path(ROOT, 'src', 'data', 'modelCredits.json');
const CACHE = '/tmp/sketchfab-cybertron';
const API = 'https://api.sketchfab.com/v3/models';

const token = process.env.SKETCHFAB_API_TOKEN;
const LICENCES = { by: 'CC-BY-4.0', 'by-sa': 'CC-BY-SA-4.0', 'by-nc': 'CC-BY-NC-4.0', 'by-nc-sa': 'CC-BY-NC-SA-4.0' };

const json = async (url, headers = {}) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

// the download, fetched once
async function download(kind, uid) {
  const file = path(CACHE, `${uid}.glb`);
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
async function credit(kind, uid, as, also) {
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
    where: 'cybertron',
    ...(also ? { also } : {}),
    as,
    file: `/models/cybertron/${kind}.glb`,
  };
}

const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// (4×4 matrices, column-major, as glTF keeps them)
const mul4 = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function invert4(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inv3 = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const o = [inv3[0], inv3[1], inv3[2], 0, inv3[3], inv3[4], inv3[5], 0, inv3[6], inv3[7], inv3[8], 0, 0, 0, 0, 1];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * t[0] + o[4 + r] * t[1] + o[8 + r] * t[2]);
  return o;
}

// The bones set as the model's first clip has them `at` seconds in (a still
// model taken from a rigged one: the High Moon robots' rest is a T, their
// clips stand them as the games did), for unskinned() to bake.
const posed = (at) => (doc) => {
  const clip = doc.getRoot().listAnimations()[0];
  if (at == null || !clip) return;
  for (const ch of clip.listChannels()) {
    const node = ch.getTargetNode();
    const sampler = ch.getSampler();
    const prop = ch.getTargetPath();
    if (!node || !sampler || !['translation', 'rotation', 'scale', 'weights'].includes(prop)) continue;
    const times = sampler.getInput().getArray();
    const out = sampler.getOutput();
    // (a morph's weights: one number a key for each of its targets)
    const size = prop === 'weights' ? (node.getMesh()?.listPrimitives()[0]?.listTargets().length ?? 0) : out.getElementSize();
    if (!size) continue;
    // (a cubic spline keeps an in-tangent, the value and an out-tangent per key)
    const cubic = sampler.getInterpolation() === 'CUBICSPLINE';
    const value = (i) => (prop === 'weights' ? Array.from({ length: size }, (_, j) => out.getScalar((cubic ? i * 3 + 1 : i) * size + j)) : out.getElement(cubic ? i * 3 + 1 : i, []));
    let i = 0;
    while (i < times.length - 1 && times[i + 1] <= at) i++;
    const a = value(i);
    const b = value(Math.min(i + 1, times.length - 1));
    const span = times[i + 1] - times[i];
    const k = sampler.getInterpolation() === 'STEP' || !(span > 0) ? 0 : Math.min(1, Math.max(0, (at - times[i]) / span));
    // (a rotation: the shorter way round, normalised after)
    const sign = prop === 'rotation' && a.reduce((s, x, j) => s + x * b[j], 0) < 0 ? -1 : 1;
    let v = a.map((x, j) => x + (sign * b[j] - x) * k);
    if (prop === 'rotation') {
      const l = Math.hypot(...v) || 1;
      v = v.map((x) => x / l);
    }
    if (size !== v.length) continue;
    if (prop === 'translation') node.setTranslation(v);
    else if (prop === 'rotation') node.setRotation(v);
    else if (prop === 'scale') node.setScale(v);
    else node.setWeights(v);
  }
};

// A model that never moves, held in a skeleton anyway: each skinned part
// baked as its bones hold it, back into its own node's frame, a plain mesh
// after (as scripts/sketchfab-galaxy.mjs does); its animations go too.
const unskinned = () => (doc) => {
  const root = doc.getRoot();
  // (the animations' samplers too: their keyframes would stay in the file)
  for (const a of root.listAnimations()) {
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  // (morph targets first, as a renderer would: each part as its weights blend it)
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const weights = node.getWeights().length ? node.getWeights() : mesh.getWeights();
    for (const prim of mesh.listPrimitives()) {
      const targets = prim.listTargets();
      for (const semantic of ['POSITION', 'NORMAL']) {
        const base = prim.getAttribute(semantic);
        if (!base || !targets.length) continue;
        const A = new Float32Array(base.getCount() * 3);
        const v = [];
        const d = [];
        for (let i = 0; i < base.getCount(); i++) {
          base.getElement(i, v);
          targets.forEach((t, k) => {
            const delta = t.getAttribute(semantic);
            if (!weights[k] || !delta) return;
            delta.getElement(i, d);
            for (let r = 0; r < 3; r++) v[r] += weights[k] * d[r];
          });
          if (semantic === 'NORMAL') {
            const l = Math.hypot(...v) || 1;
            for (let r = 0; r < 3; r++) v[r] /= l;
          }
          A.set(v, i * 3);
        }
        prim.setAttribute(semantic, doc.createAccessor().setType('VEC3').setArray(A).setBuffer(base.getBuffer()));
      }
      for (const t of targets) {
        prim.removeTarget(t);
        t.dispose();
      }
    }
    mesh.setWeights([]);
    node.setWeights([]);
  }
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
      if (!joints || !weights) continue;
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
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(pos.getBuffer()));
      if (nor) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(nor.getBuffer()));
      for (const name of prim.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(name)) prim.setAttribute(name, null);
    }
    node.setSkin(null);
  }
};

// What a pose hides, gone: a High Moon robot keeps its vehicle's panels
// folded to a point inside it while it stands (and a part with no size
// spoils the file's compression and its bounds)
const unseen = () => (doc) => {
  const spans = [];
  for (const node of doc.getRoot().listNodes()) {
    const m = node.getMesh();
    if (!m) continue;
    for (const prim of m.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      const p = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);
        for (let r = 0; r < 3; r++) {
          lo[r] = Math.min(lo[r], p[r]);
          hi[r] = Math.max(hi[r], p[r]);
        }
      }
      const s = node.getWorldMatrix();
      const scale = Math.max(Math.hypot(s[0], s[1], s[2]), Math.hypot(s[4], s[5], s[6]), Math.hypot(s[8], s[9], s[10]));
      spans.push([prim, Math.max(...hi.map((x, r) => x - lo[r])) * scale]);
    }
  }
  const most = Math.max(0, ...spans.map(([, s]) => s));
  for (const [prim, s] of spans) if (!(s > most * 1e-3)) prim.dispose();
};

// Its materials made for daylight on a world: nothing more than half metal
// (a fully metal hull, with nothing round it to reflect, comes out black),
// its colours brightened by `gain`, and anything in `drop` left off.
// (and `colours`: a model that came without maps painted here, a list of
// [material name pattern, '#rrggbb', metalness, roughness])
const relit = ({ gain = 1, drop = null, colours = null }) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (drop?.test(prim.getMaterial()?.getName() ?? '')) prim.dispose();
  const paint = (colours ?? []).map(([pattern, hex, metal = 0.4, rough = 0.5]) => [new RegExp(pattern, 'i'), [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2), metal, rough]);
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.5));
    const [r, g, b, a] = m.getBaseColorFactor();
    m.setBaseColorFactor([...[r, g, b].map((c) => Math.min(1, c * gain)), a]);
    const hit = paint.find(([re]) => re.test(m.getName()));
    if (hit) {
      m.setBaseColorFactor([...hit[1], a]);
      m.setMetallicFactor(hit[2]);
      m.setRoughnessFactor(hit[3]);
    }
  }
};

// Parts with no maps don't need their UVs or tangents (so the simplifier can
// fold across what were seams).
const bareWhereUntextured = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const mapped = m && [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].some(Boolean);
      for (const name of prim.listSemantics()) if (name === 'TANGENT' || (!mapped && name.startsWith('TEXCOORD_'))) prim.setAttribute(name, null);
    }
};

// The simplifier, each mesh its share of the budget, a step rougher each time
// it stops short (as scripts/sketchfab-galaxy.mjs does it).
const simplified = (tris) => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getIndices());
  const all = prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  if (all <= tris * 1.1) return;
  for (const prim of prims) {
    const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
    let indices = new Uint32Array(prim.getIndices().getArray());
    const target = Math.max(3, Math.floor((indices.length * tris) / all / 3) * 3);
    const steps = [
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.01, ['Prune'])[0],
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.03, ['Prune', 'Permissive'])[0],
      (ix) => MeshoptSimplifier.simplifySloppy(ix, positions, 3, null, target, 0.02)[0],
    ];
    for (const step of steps) if (indices.length > target * 1.15) indices = step(indices);
    if (!indices.length) {
      prim.dispose();
      continue;
    }
    prim.setIndices(doc.createAccessor().setArray(indices).setBuffer(buffer));
    compactPrimitive(prim);
  }
};

// (quaternions, [x, y, z, w])
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const about = (axis, angle) => {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
};
const UP = {
  y: [0, 0, 0, 1],
  z: about([1, 0, 0], -Math.PI / 2), // its +z (up as made) to +y
  '-z': about([1, 0, 0], Math.PI / 2),
  x: about([0, 0, 1], Math.PI / 2), // its +x to +y
  '-x': about([0, 0, 1], -Math.PI / 2),
  '-y': about([1, 0, 0], Math.PI), // upside down
};

// Where the model is, as drawn: each part's corners through its node, or
// for a skinned part (whose node glTF ignores) through its bones as they
// hold it at rest.
function bounds(doc, scene) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const add = (x) => {
    for (let r = 0; r < 3; r++) {
      min[r] = Math.min(min[r], x[r]);
      max[r] = Math.max(max[r], x[r]);
    }
  };
  const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const skin = node.getSkin();
    const ibm = skin?.getInverseBindMatrices();
    const bones = skin?.listJoints().map((joint, i) => mul4(joint.getWorldMatrix(), ibm ? ibm.getElement(i, []) : id));
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      const p = [];
      const j = [];
      const w = [];
      // (every vertex of a small part, every few of a big one)
      const step = Math.max(1, Math.floor(pos.getCount() / 20000));
      for (let v = 0; v < pos.getCount(); v += step) {
        pos.getElement(v, p);
        if (!bones || !joints || !weights) {
          add(apply(world, p));
          continue;
        }
        joints.getElement(v, j);
        weights.getElement(v, w);
        const out = [0, 0, 0];
        for (let k = 0; k < 4; k++) if (w[k]) apply(bones[j[k]], p).forEach((c, r) => (out[r] += w[k] * c));
        add(out);
      }
    }
  });
  return { min, max };
}

// On the ground: everything in the scene under one node that turns it
// upright and round to face +z, scales it to `metres` along `along`, and
// stands it on y = 0 with the middle of its footprint at the origin.
const grounded = ({ metres, along = 'y', yaw = 0, up = 'y' }) => (doc) => {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  if (!UP[up]) throw new Error(`up: '${up}'? (y, z, -z, x, -x, -y)`);
  const ground = doc.createNode('ground');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    ground.addChild(child);
  }
  scene.addChild(ground);
  ground.setRotation(qmul(about([0, 1, 0], yaw), UP[up]));
  const { min, max } = bounds(doc, scene);
  const size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  const measured = along === 'max' ? Math.max(size.x, size.z) : size[along];
  if (!(measured > 0)) throw new Error(`along: '${along}'? (y, x, z or max)`);
  const k = metres / measured;
  ground.setScale([k, k, k]);
  ground.setTranslation([(-k * (min[0] + max[0])) / 2, -k * min[1], (-k * (min[2] + max[2])) / 2]);
};

const dims = (doc) => {
  const root = doc.getRoot();
  const { min, max } = bounds(doc, root.getDefaultScene() ?? root.listScenes()[0]);
  return [0, 1, 2].map((i) => max[i] - min[i]);
};

async function bring(io, kind, spec) {
  const src = await download(kind, spec.uid);
  const doc = await io.read(src);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const before = triangles(doc);
  // (a file with several robots in it: only the one asked for)
  if (spec.node) {
    const keep = new RegExp(spec.node, 'i');
    const named = (n) => {
      for (let p = n; p; p = p.getParentNode()) if (keep.test(p.getName())) return true;
      return false;
    };
    for (const node of root.listNodes()) if (node.getMesh() && !named(node)) node.setMesh(null);
  }
  // (a robot whose file keeps its other form's loose parts beside it, wheels
  // and guns that hang from nothing: only what its skeleton moves)
  if (spec.skinnedOnly) for (const node of root.listNodes()) if (node.getMesh() && !node.getSkin()) node.setMesh(null);
  // (lines and points: nothing a world shows)
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  // (a rig's clips with the keyframes that change nothing taken out: a
  // High Moon robot's transformation is thousands of them)
  if (spec.rig) await doc.transform(dequantize(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), resample({ tolerance: 1e-4 }));
  else await doc.transform(dequantize(), posed(spec.pose), unskinned(), unseen(), dedup(), metalRough(), relit(spec), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  await doc.transform(simplified(spec.tris));
  await doc.transform(grounded(spec));
  // (a still model: its turn and scale baked into its parts)
  if (!spec.rig) await doc.transform(flatten());
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
  const [w, h, l] = dims(doc);
  const clips = root.listAnimations().map((a) => a.getName() || '(unnamed)');
  console.log(
    `${kind.padEnd(14)} ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${draws} draws, ${root.listTextures().length} maps, ${(bytes / 1024).toFixed(0)} KB;` +
      ` ${w.toFixed(1)} wide × ${h.toFixed(1)} tall × ${l.toFixed(1)} long (m)${clips.length ? `; clips: ${clips.join(', ')}` : ''}`,
  );
}

// What's in a download as it comes, for working out its catalogue entry
async function inspect(io, uid, kind) {
  const doc = await io.read(await download(kind ?? uid, uid));
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const round = (v) => v.map((x) => +x.toFixed(3));
  const box = (node) => {
    const { min, max } = bounds(doc, node);
    return min[0] === Infinity ? null : { min: round(min), max: round(max), size: round(max.map((x, i) => x - min[i])) };
  };
  const tree = (node, depth) => ({
    name: node.getName(),
    mesh: node.getMesh() ? node.getMesh().listPrimitives().length : 0,
    skin: !!node.getSkin(),
    ...(depth <= 1 ? { box: box(node) } : {}),
    ...(depth < 6 && node.listChildren().length ? { children: node.listChildren().slice(0, 30).map((c) => tree(c, depth + 1)) } : {}),
  });
  const whole = box(scene);
  const size = whole?.size ?? [0, 0, 0];
  const report = {
    uid,
    triangles: Math.round(triangles(doc)),
    bounds: whole,
    // the tallest side is usually up for a robot standing
    upGuess: ['x', 'y', 'z'][size.indexOf(Math.max(...size))],
    nodes: scene.listChildren().map((c) => tree(c, 1)),
    meshes: root.listMeshes().length,
    materials: root.listMaterials().map((m) => ({ name: m.getName(), color: !!m.getBaseColorTexture(), normal: !!m.getNormalTexture(), emissive: !!m.getEmissiveTexture(), factor: round(m.getBaseColorFactor()) })),
    textures: root.listTextures().map((t) => ({ name: t.getName() || t.getURI(), size: t.getSize(), type: t.getMimeType() })),
    skins: root.listSkins().map((sk) => ({ bones: sk.listJoints().length, names: sk.listJoints().slice(0, 60).map((j) => j.getName()) })),
    clips: root.listAnimations().map((a) => ({ name: a.getName(), channels: a.listChannels().length, seconds: +Math.max(0, ...a.listSamplers().map((sp) => sp.getInput()?.getMax([])?.[0] ?? 0)).toFixed(2) })),
    extensions: root.listExtensionsUsed().map((e) => e.extensionName),
  };
  console.log(JSON.stringify(report, null, 1));
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    const [, value] = args.splice(i, 2);
    return value;
  };
  const inspecting = flag('--inspect');
  const given = flag('--spec');
  const named = flag('--kind');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  if (inspecting) return inspect(io, inspecting, named);
  if (given) {
    if (!named) throw new Error('--spec needs --kind <name>');
    const spec = JSON.parse(given);
    if (spec.drop && typeof spec.drop === 'string') spec.drop = new RegExp(spec.drop, 'i');
    return bring(io, named, spec);
  }
  const { MODELS } = await import(pathToFileURL(CATALOG).href);
  for (const k of args) if (!MODELS[k]) throw new Error(`no ${k} in game/catalog.js`);
  const credits = JSON.parse(await readFile(CREDITS, 'utf8'));
  for (const kind of args.length ? args : Object.keys(MODELS)) {
    const spec = MODELS[kind];
    await bring(io, kind, { ...spec, drop: typeof spec.drop === 'string' ? new RegExp(spec.drop, 'i') : spec.drop });
    credits[`cybertron-${kind}`] = await credit(kind, spec.uid, spec.as, spec.also);
  }
  const sorted = Object.fromEntries(Object.keys(credits).sort().map((k) => [k, credits[k]]));
  await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
