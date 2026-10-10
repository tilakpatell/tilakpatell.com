// The galaxy's far-off ships: one small, one-piece model for each of the
// models the galaxy flies (galaxy/models.js's MODELS), made offline from the
// GLB already here. A distant fighter then costs one draw instead of one per
// part, and a few thousand triangles instead of tens of thousands.
//
//   node scripts/galaxy-lod.mjs            every kind
//   node scripts/galaxy-lod.mjs xwing n1   just these
//   node scripts/galaxy-lod.mjs hq/moncal  a capital's close-up cut
//                                          (public/models/galaxy/hq/, to lod/hq/)
//   node scripts/galaxy-lod.mjs space/endor-isd
//                                          a space level's capital or dock (lane Q:
//                                          public/models/galaxy/space/, to its own
//                                          .far.glb beside it, published with it)
//
// For each kind it reads the GLB (meshopt-compressed, as they all are), puts
// every primitive where its node puts it, and bakes its look into vertex
// colours: the base colour (factor, times the texture at the vertex's UV, times
// any vertex colour), plus the emissive (factor times texture times strength),
// clamped to 1. The primitives become one mesh, welded, and simplified with
// meshoptimizer to 1,500 triangles for a fighter or 4,000 for anything bigger.
// UVs, normals and textures are dropped (the page works the normals out again
// when it loads one), and it's written quantized and meshopt-compressed to
// public/models/galaxy/lod/<kind>.glb. One line per kind says what it made.
//
// The kinds and their files are read from galaxy/models.js and
// universe/glbFleet.js as written, so a ship added there is picked up here.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const FIGHTERS = new Set(['tiedefender', 'tiestriker', 'vwing', 'eta2', 'hyena', 'fang', 'xwing', 'interceptor', 'awing', 'ywing', 'bwing', 'uwing', 'vulture', 'trifighter', 'delta7', 'arc170', 'n1', 'slave1', 'tie', 'tiebomber', 'tieadvanced']);
const TARGET = { fighter: 1500, other: 4000, space: 6000 };
const OUT = 'public/models/galaxy/lod';
const SAMPLE = 256; // textures are read at this size: a far ship's colour is the average of a patch, not one texel

// kind → url, from the two files that list them: MODELS spreads GLB's in
// first and its own entries win over them, as they do here, so a kind
// models.js gives a file of its own (the galaxy's corvette, over the
// universe map's) has its far-off copy made from the file the galaxy loads
function kinds() {
  const list = new Map();
  const models = readFileSync('src/components/galaxy/models.js', 'utf8');
  const at = models.indexOf('export const HQ = {');
  for (const text of [readFileSync('src/components/universe/glbFleet.js', 'utf8'), at < 0 ? models : models.slice(0, at)]) {
    for (const m of text.matchAll(/^\s+(\w+): \{ url: '([^']+\.glb)'/gm)) list.set(m[1], m[2]);
  }
  list.delete('deathstar'); // (a sphere far off is a sphere: the world draws its own)
  // (and the capitals' close-up cuts, galaxy/models.js's HQ: their own far-off copies)
  const hq = at < 0 ? '' : models.slice(at, models.indexOf('\n};', at));
  for (const m of hq.matchAll(/^\s+(\w+): \{ url: '([^']+\.glb)'/gm)) list.set(`hq/${m[1]}`, m[2]);
  return list;
}

// The 2017 drop's maps as scripts/bf2017-import.mjs unpacked them (PNG beside
// each KTX2, by its file name), for a native file's colours
const UNPACKED = 'lab/assets/bf2017/unpacked';
let unpacked = null;
function unpackedPng(name) {
  if (!unpacked) {
    unpacked = new Map();
    if (existsSync(UNPACKED)) for (const f of readdirSync(UNPACKED, { recursive: true })) if (String(f).endsWith('.png')) unpacked.set(basename(String(f), '.png'), join(UNPACKED, String(f)));
  }
  const at = unpacked.get(basename(name ?? '', '.ktx2'));
  return at ? readFileSync(at) : null;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// a texture as linear RGB floats at SAMPLE², read once (its alpha isn't
// wanted: a ship far off is opaque)
const pixels = new Map();
async function readTexture(tex) {
  if (pixels.has(tex)) return pixels.get(tex);
  let got = null;
  const mime = tex.getMimeType();
  // (the game's own KTX2, which sharp can't read: its pixels from the game's
  // map as the 2017 import unpacked it, found by its name)
  const image = /ktx2/.test(mime) ? unpackedPng(tex.getName()) : tex.getImage();
  if (/png|jpe?g|webp/.test(mime) || image !== tex.getImage()) {
    try {
      if (!image) throw new Error(`no unpacked copy of ${tex.getName()} under ${UNPACKED}`);
      // (to sRGB first: some come as grey, or grey and alpha, which sharp can't resize to raw as they are)
      const { data, info } = await sharp(Buffer.from(image)).toColourspace('srgb').removeAlpha().resize(SAMPLE, SAMPLE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const f = new Float32Array(info.width * info.height * 3);
      for (let i = 0, j = 0; i < f.length; i += 3, j += info.channels) for (let k = 0; k < 3; k++) f[i + k] = toLinear(data[j + Math.min(k, info.channels - 1)] / 255);
      got = { f, w: info.width, h: info.height };
    } catch (e) {
      console.warn(`  (a ${mime} texture wouldn't decode, ${e.message}: its factor alone is used)`);
    }
  } else console.warn(`  (a ${mime} texture can't be read here: its factor alone is used)`);
  pixels.set(tex, got);
  return got;
}

// the texture at a UV, repeating, through KHR_texture_transform if it has one
function sample(img, info, u, v, out) {
  const tt = info?.getExtension?.('KHR_texture_transform');
  if (tt) {
    const [sx, sy] = tt.getScale();
    const r = tt.getRotation();
    const [ox, oy] = tt.getOffset();
    const x = u * sx;
    const y = v * sy;
    u = Math.cos(r) * x + Math.sin(r) * y + ox;
    v = -Math.sin(r) * x + Math.cos(r) * y + oy;
  }
  u -= Math.floor(u);
  v -= Math.floor(v);
  const px = Math.min(img.w - 1, Math.floor(u * img.w));
  const py = Math.min(img.h - 1, Math.floor(v * img.h));
  const i = (py * img.w + px) * 3;
  out[0] = img.f[i];
  out[1] = img.f[i + 1];
  out[2] = img.f[i + 2];
  return out;
}

const transform = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

// every triangle in the model's default scene, placed, coloured: flat arrays
async function bake(doc) {
  const pos = [];
  const col = [];
  const idx = [];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const nodes = [];
  scene.traverse((n) => nodes.push(n));
  const p = [0, 0, 0];
  const uv = [0, 0];
  const c = [1, 1, 1, 1];
  const t = [1, 1, 1];
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // (triangles only: no lines or points on a ship)
      const P = prim.getAttribute('POSITION');
      if (!P) continue;
      const mat = prim.getMaterial();
      const base = mat?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const emis = mat?.getEmissiveFactor() ?? [0, 0, 0];
      const strength = mat?.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1;
      const baseInfo = mat?.getBaseColorTextureInfo();
      const emisInfo = mat?.getEmissiveTextureInfo();
      const baseImg = mat?.getBaseColorTexture() ? await readTexture(mat.getBaseColorTexture()) : null;
      const emisImg = mat?.getEmissiveTexture() ? await readTexture(mat.getEmissiveTexture()) : null;
      const baseUV = prim.getAttribute(`TEXCOORD_${baseInfo?.getTexCoord() ?? 0}`);
      const emisUV = prim.getAttribute(`TEXCOORD_${emisInfo?.getTexCoord() ?? 0}`);
      const C = prim.getAttribute('COLOR_0');
      const start = pos.length / 3;
      const n = P.getCount();
      for (let i = 0; i < n; i++) {
        pos.push(...transform(world, P.getElement(i, p)));
        let r = base[0];
        let g = base[1];
        let b = base[2];
        if (baseImg && baseUV) {
          baseUV.getElement(i, uv);
          sample(baseImg, baseInfo, uv[0], uv[1], t);
          r *= t[0];
          g *= t[1];
          b *= t[2];
        }
        if (C) {
          C.getElement(i, c);
          r *= c[0];
          g *= c[1];
          b *= c[2];
        }
        let er = emis[0] * strength;
        let eg = emis[1] * strength;
        let eb = emis[2] * strength;
        if (emisImg && emisUV && (er || eg || eb)) {
          emisUV.getElement(i, uv);
          sample(emisImg, emisInfo, uv[0], uv[1], t);
          er *= t[0];
          eg *= t[1];
          eb *= t[2];
        }
        col.push(Math.min(1, r + er), Math.min(1, g + eg), Math.min(1, b + eb));
      }
      const I = prim.getIndices();
      if (I) for (let i = 0; i < I.getCount(); i++) idx.push(start + I.getScalar(i));
      else for (let i = 0; i < n; i++) idx.push(start + i);
    }
  }
  return { pos: Float32Array.from(pos), col: Float32Array.from(col), idx: Uint32Array.from(idx) };
}

// vertices at the same place made one (their colours averaged), so the
// simplifier sees one surface, not hundreds of loose pieces
function weld({ pos, col, idx }) {
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], pos[i + k])), (hi[k] = Math.max(hi[k], pos[i + k]));
  const step = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1e-5 || 1e-6;
  const at = new Map();
  const remap = new Uint32Array(pos.length / 3);
  const P = [];
  const sum = [];
  const count = [];
  for (let v = 0; v < remap.length; v++) {
    const key = `${Math.round(pos[v * 3] / step)},${Math.round(pos[v * 3 + 1] / step)},${Math.round(pos[v * 3 + 2] / step)}`;
    let j = at.get(key);
    if (j === undefined) {
      j = count.length;
      at.set(key, j);
      P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      sum.push(0, 0, 0);
      count.push(0);
    }
    for (let k = 0; k < 3; k++) sum[j * 3 + k] += col[v * 3 + k];
    count[j]++;
    remap[v] = j;
  }
  const C = new Float32Array(sum.length);
  for (let j = 0; j < count.length; j++) for (let k = 0; k < 3; k++) C[j * 3 + k] = sum[j * 3 + k] / count[j];
  // (and the triangles that welding folded flat dropped)
  const out = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = remap[idx[i]];
    const b = remap[idx[i + 1]];
    const c = remap[idx[i + 2]];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  return { pos: Float32Array.from(P), col: C, idx: Uint32Array.from(out) };
}

// down to `tris` triangles: carefully, then less carefully, then (for a model
// of a great many loose parts) sloppily
function simplify({ pos, col, idx }, tris) {
  const want = tris * 3;
  if (idx.length <= want) return { pos, col, idx, how: 'as it was' };
  const weights = [0.4, 0.4, 0.4];
  let [out] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, col, 3, weights, null, want, 0.02);
  let how = 'careful';
  if (out.length > want * 1.1) {
    [out] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, col, 3, weights, null, want, 1, ['Prune']);
    how = 'pruned';
  }
  if (out.length > want * 1.25) {
    [out] = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, want, 1);
    how = 'sloppy';
  }
  // (only the vertices still used)
  const used = new Map();
  const P = [];
  const C = [];
  const I = new Uint32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    let j = used.get(out[i]);
    if (j === undefined) {
      j = used.size;
      used.set(out[i], j);
      P.push(pos[out[i] * 3], pos[out[i] * 3 + 1], pos[out[i] * 3 + 2]);
      C.push(col[out[i] * 3], col[out[i] * 3 + 1], col[out[i] * 3 + 2]);
    }
    I[i] = j;
  }
  return { pos: Float32Array.from(P), col: Float32Array.from(C), idx: I, how };
}

// one primitive: positions as 16-bit integers (the node's scale and offset put
// them back), colours as bytes, meshopt-compressed. Quantized here rather than
// with gltf-transform's functions, which load a second sharp (and with it a
// second libvips, which breaks the first's decoding in the same process)
async function write(kind, { pos, col, idx }, io, file = `${OUT}/${kind}.glb`) {
  const doc = new Document();
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const buffer = doc.createBuffer();
  const vertices = pos.length / 3;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) (lo[k] = Math.min(lo[k], pos[i + k])), (hi[k] = Math.max(hi[k], pos[i + k]));
  const mid = lo.map((l, k) => (l + hi[k]) / 2);
  const half = Math.max(...lo.map((l, k) => (hi[k] - l) / 2), 1e-9); // (one scale for all three, so the normals the page works out aren't skewed)
  const q = new Int16Array(pos.length);
  for (let i = 0; i < pos.length; i++) q[i] = Math.round(((pos[i] - mid[i % 3]) / half) * 32767);
  const c = new Uint8Array(vertices * 4);
  for (let v = 0; v < vertices; v++) {
    for (let k = 0; k < 3; k++) c[v * 4 + k] = Math.round(Math.min(1, Math.max(0, col[v * 3 + k])) * 255);
    c[v * 4 + 3] = 255;
  }
  const position = doc.createAccessor().setType('VEC3').setArray(q).setNormalized(true).setBuffer(buffer);
  const color = doc.createAccessor().setType('VEC4').setArray(c).setNormalized(true).setBuffer(buffer);
  const indices = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(vertices < 65536 ? Uint16Array.from(idx) : idx)
    .setBuffer(buffer);
  // (the page gives every one the same vertex-coloured material: this one's a placeholder)
  const material = doc.createMaterial(`${kind}-lod`).setRoughnessFactor(0.6).setMetallicFactor(0.3);
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setAttribute('COLOR_0', color).setIndices(indices).setMaterial(material);
  const node = doc
    .createNode(kind)
    .setMesh(doc.createMesh(kind).addPrimitive(prim))
    .setTranslation(mid)
    .setScale([half, half, half]);
  doc.createScene(kind).addChild(node);
  await io.write(file, doc);
  return { file, vertices, bytes: statSync(file).size };
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
mkdirSync(`${OUT}/hq`, { recursive: true });
const all = kinds();
const asked = process.argv.slice(2);
const made = [];
for (const kind of asked.length ? asked : [...all.keys()]) {
  // (a space level's model, by its slug: scripts/bf2017-space.mjs)
  const url = kind.startsWith('space/') ? `/models/galaxy/${kind}.glb` : all.get(kind);
  if (!url || (kind.startsWith('space/') && !existsSync(`public${url}`))) {
    console.log(`${kind}: not a kind the galaxy loads`);
    process.exitCode = 1;
    continue;
  }
  const baked = await bake(await io.read(`public${url}`));
  const target = FIGHTERS.has(kind) ? TARGET.fighter : kind.startsWith('space/') ? TARGET.space : TARGET.other; // (an hq/ cut is a capital: 'other')
  made.push({ kind, from: baked.idx.length / 3, lod: simplify(weld(baked), target) });
}
for (const { kind, from, lod } of made) {
  const { vertices, bytes } = await write(kind, lod, io, kind.startsWith('space/') ? `public/models/galaxy/${kind}.far.glb` : undefined);
  console.log(`${kind.padEnd(12)} ${String(from).padStart(7)} → ${String(lod.idx.length / 3).padStart(5)} triangles (${lod.how}), ${String(vertices).padStart(5)} vertices, ${(bytes / 1024).toFixed(1).padStart(6)} KB`);
}
