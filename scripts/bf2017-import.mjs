// Brings a model from the Star Wars Battlefront II (2017) drop into the
// galaxy's worlds (EA DICE's, used with permission on this non-commercial fan
// project: docs/decisions/2026-10-10-battlefront-2017-assets.md). It reads a
// model fetched by scripts/bf2017-fetch.mjs into lab/assets/bf2017/ by its
// manifest name and writes the site's files: the plain cut, and the light
// (`.lod1`) and ultra cuts where the model has them, each picked from the
// drop's own LOD chain rather than simplified (DICE already cut it at up to
// six levels: scripts/lib/bf2017-manifest.mjs). Its textures, which the
// GLBs name outside the file as KTX2, are found on disk as PNG (raw, or
// rebuilt from DICE's packing by the manifest's recipe) or unpacked from the
// KTX2, then made WebP at the site's sizes; the model is grounded (upright,
// facing +z, standing on y = 0, in metres) by scripts/lib/surface-model.mjs
// and meshopt-compressed, the way every surface model is. The catalogue row
// goes into src/components/galaxy/surface/catalog/bf2017.js and the credit
// into src/data/modelCredits.json; with --crew the file goes to
// galaxy/crew/ and the CREW row is printed instead.
//
//   node scripts/bf2017-import.mjs <manifest name> --kind <kind> --as '<what it is>'
//     [--root lab/assets/bf2017] [--metres <m> | --asis] [--along y|x|z|max] [--yaw <rad>] [--up y|z|-z|x|-x|-y]
//     [--rig] [--crew] [--hero] [--ultra] [--cuts lod1=<n>,plain=<n>,ultra=<n>] [--tex 1024] [--maps 512] [--quality 82] [--maps-quality 80]
//     [--parts '<glob>,…'] [--grip <node>] [--out public/models/galaxy]
//     [--vehicle] [--far] [--bind <skeleton>] [--hull-frame [<hull name>]] [--light-maps <px>]
//     [--full] [--join] (--cuts also far=<n>, with --full) [--lod1-tex 1024] [--lod1-maps 512]
//
//   name       the model's `name` in the manifest (bf2017-fetch.mjs --list finds it)
//   kind       the catalogue kind: one already in another group is taken over
//   as         for the credit ('Luke’s lightsaber hilt')
//   metres     how big along `along` (y: tall); --asis (the default) keeps
//              the manifest's own height, which is right for everything sampled
//   rig        keep the skin and the whole 2017 rig as DICE made it (fingers,
//              face, cloth physics, weapon sockets, about 250 joints a
//              person), for a person or a beast to be posed and to take the
//              game's own clips; without it the model is a statue. Nothing
//              is pruned or renamed: the site learns the game's skeleton
//   crew       a person for crewList.js's CREW (galaxy/crew/<kind>.glb)
//   hero       the 4 MB file cap instead of 2.5 MB (a cut over its cap
//              stops the import: overCaps)
//   ultra      an .ultra.glb from LOD0, at 2048 colour and 1024 maps
//              (--ultra-tex, --ultra-maps: a hero's full 2048 maps at ultra)
//   cuts       which LODs, by number, instead of the triangle budgets
//              (light ≤ 2,500; plain ≤ 12,000, or 8,000 with --rig)
//   tex, maps  the colour and other maps' size (the light cut takes half)
//   quality, maps-quality  their WebP quality (82 and 80 by default)
//   eyes       the hero's own eye map (characters/heads/_shared/eyes/t_eyes_luke_c.ktx2)
//   parts      globs over the model's folder for the parts that go with it
//              ('*_cape_mesh,*_hands_mesh'), each at the same LOD, one file
//   grip       the node the site holds it by (by default Wep_Root, the
//              game's weapon socket, on a rig in the right hand; a rig
//              without one falls back to IK_Joint_RightHand): a `grip` node
//              is put there, under it on a rig so DICE's own names all stay;
//              without either, at the model's own origin, which is DICE's hold
//   full       phase 2's full fidelity (phase 1's native settings): the
//              plain cut is the game's LOD0, never simplified, every map
//              the game's own KTX2 at up to 2048 (AVIF q90 for one the
//              bucket has only as PNG); it goes to the bucket
//              (assets-publish.mjs), not the repo. The `.lod1` is the first
//              LOD under 1,500 triangles (a soldier's LOD4) at colour 1024
//              and the rest 512, WebP. The row says `full: true`
//   far        with --full, a figure's `.far` cut from the chain's last LOD,
//              colour 256 and the rest 128, halved until under 150 KB: the
//              squads past the level's `mid` (without --full, lane V's below)
//   join       a figure's parts (body, helmet, backpack) that share a
//              material drawn as one (rig-parts.mjs's joinSkinned)
//   (every cut: an opaque material's colour map loses its alpha, the
//   game's smoothness, which the ORM map carries)
//   vehicle    a vehicle's budgets (lane V): plain ≤ 25,000, light ≤ 7,000
//   far        a .far.glb as well: the chain's first cut under 1,000
//              triangles (else its last), its colour maps alone at 256, no
//              skin, for the fleets and the horizon
//   bind       skin a rigid model to the game's own skeleton for it (the
//              AT-ST's, whose clips are on Cinematics/Objects/ATST/ATST_Ske01):
//              the skeleton is read at rest from one of its clips on disk
//              (bf2017-rigclips.mjs fetches them), every bone kept, each
//              vertex to one bone (scripts/lib/rig-bind.mjs)
//   light-maps  the light cut's maps other than colour at this size (a model
//              with many maps whose light cut is over its cap: the AT-TE's)
//   hull-frame  stand it where the manifest's bounds of the model (or of
//              <hull name>) put it, not by its own cut's: a cockpit and its
//              hull share their frame, so the seat sits in the hull
//   sub        the folder under models/galaxy (surface by default; the object
//              library's surface/game: scripts/bf2017-library-import.mjs),
//              the credit `<sub with dashes>-<kind>`
//   lod1-tex, lod1-maps  the light cut's map sizes without --full as well
//   far-tex    the far cut's colour (256; the library's small objects 128,
//              their KTX2 a mip further down, to keep under the far cap)
//   keep-origin  not grounded: the model keeps the game's own origin, axes
//              and metres (a hilt or a blaster, modelled for the Wep_Root
//              socket with its grip at the origin and its barrel up +y)
//
// It refuses the sequel era (the site shows none of it). Look at what came
// out with node scripts/glb-shot.mjs <file> out.png three, through the dev
// server (npx vite --port 5188 --strictPort --host 127.0.0.1).

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, dequantize, flatten, join, listTextureSlots, mergeDocuments, meshopt, metalRough, prune, textureCompress, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join as path, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overCaps } from './lib/bf2017-caps.mjs';
import { parseArgs } from './lib/args.mjs';
import { isSequel, cutsFor, fullCuts, partsOf, readManifest } from './lib/bf2017-manifest.mjs';
import { glbJson, imagePath, inBucket, localPath, mapPath } from './lib/bf2017-paths.mjs';
import { resolveImage } from './lib/bf2017-textures.mjs';
import { BASIS_LZ, dropLevels, ktx2Info } from './lib/ktx2-levels.mjs';
import { writeCatalogueLine, writeCredit } from './lib/catalog-write.mjs';
import { joinSkinned, shareSkins } from './lib/rig-parts.mjs';
import { glbTextures } from '../src/lib/glbTextures.js';
import { KEPT, decalOf, dressed } from './lib/bf2017-dressing.mjs';
import { atlasUVs } from './lib/bf2017-uv.mjs';
import { bindVertices, bonesOf, HELPERS } from './lib/rig-bind.mjs';
import { bareWhereUntextured, bounds, dims, grounded, invert4, simplified, triangles, unskinned } from './lib/surface-model.mjs';

// (the sharp glTF-Transform's ndarray-pixels loads: see battlefront-import.mjs)
const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
export const PERMISSION = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
const MISSING = '__missing';
const NATIVE = 'ktx2:';
const SLOTS = ['BaseColor', 'Normal', 'Occlusion', 'MetallicRoughness', 'Emissive'];

// an eye map with its white lifted outside the iris (radius 0.18 of the
// map, eased over 0.04), the iris and pupil as the game drew them
async function liftSclera(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = Math.hypot(x / w - 0.5, y / h - 0.5);
      const k = 1 + 1.4 * Math.min(1, Math.max(0, (r - 0.18) / 0.04));
      for (let i = 0; i < 3; i++) data[(y * w + x) * c + i] = Math.min(255, data[(y * w + x) * c + i] * k);
    }
  return sharp(data, { raw: { width: w, height: h, channels: c } }).png().toBuffer();
}

// ── one LOD's GLB as a document, its textures found on disk ──

// The GLB's JSON is rewritten before it is read: each image points at the
// PNG found for it (or, when none is there, a placeholder whose texture is
// taken off the material after), and the textures' KHR_texture_basisu
// source becomes their plain source, so glTF-Transform never goes looking
// for a KTX2 itself.
// --textures: a map a material's shader graph binds, which the drop's GLB
// never names (the AT-AT's head is `SS_ATAT_Head`, its maps inside the
// graph; the desktop's shader-depot probe lists them), given by hand:
//   'ATAT_Head_Layered=color:Gameplay/…/T_ATATHead_01_CW,normal:Gameplay/…/T_ATATHead_01_N;Other=…'
// parseTextures(text) → { [material]: [{ slot: 'color' | 'normal' | 'emissive', name }] }
export function parseTextures(text) {
  const out = {};
  for (const part of String(text ?? '').split(';')) {
    const [material, list] = part.split('=');
    if (!material?.trim() || !list) continue;
    out[material.trim()] = list.split(',').map((s) => {
      const [slot, ...rest] = s.split(':');
      const name = rest.join(':').trim();
      if (!['color', 'normal', 'emissive'].includes(slot.trim()) || !name) throw new Error(`--textures: '${s}' is not <color|normal|emissive>:<texture name>`);
      return { slot: slot.trim(), name };
    });
  }
  return out;
}

// the bucket path of a named map in the slot's form: a normal map as the
// pipeline's derived `__normal` (its z rebuilt; the KTX2 under that name)
export const overridePath = (name, slot) => (slot === 'normal' ? mapPath(name).replace(/\.png$/, '__normal.ktx2') : mapPath(name).replace(/\.png$/, '.ktx2'));

export async function readLod(io, file, { root, derived, unpackDir, said, eyes = null, textures = null }) {
  const glb = await readFile(localPath(root, inBucket(file)));
  // (the GLB read by hand: glTF-Transform's own reader will not open one whose
  // images are outside it; chunk 0 is the JSON, chunk 1 the binary buffer)
  const json = glbJson(glb);
  const at0 = 20 + glb.readUInt32LE(12);
  const resources = { '@glb.bin': new Uint8Array(glb.buffer, glb.byteOffset + at0 + 8, glb.readUInt32LE(at0)) };
  for (const [i, img] of (json.images ?? []).entries()) {
    const at = imagePath(img.uri, inBucket(file));
    if (!at) continue;
    const found = await resolveImage(at, { root, derived, unpackDir });
    const uri = `image${i}.png`;
    if (found) {
      resources[uri] = new Uint8Array(found.png);
      said.found.add(`${at.split('/').pop()} ← ${found.from}`);
      // (where the game's own map is, for a cut that takes it as it is: --native)
      img.name = `${NATIVE}${at}`;
    } else {
      resources[uri] = new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#808080' } }).png().toBuffer());
      img.name = MISSING;
      said.missing.add(at);
    }
    img.uri = uri;
    img.mimeType = 'image/png';
  }
  for (const tex of json.textures ?? []) {
    const basisu = tex.extensions?.KHR_texture_basisu;
    if (!basisu) continue;
    tex.source ??= basisu.source;
    delete tex.extensions.KHR_texture_basisu;
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) if (json[key]) json[key] = json[key].filter((e) => e !== 'KHR_texture_basisu');
  const doc = await io.readJSON({ json, resources });
  // a map not there yet: the material goes without it rather than wear grey
  for (const m of doc.getRoot().listMaterials()) {
    for (const slot of SLOTS) if (m[`get${slot}Texture`]()?.getName() === MISSING) m[`set${slot}Texture`](null);
    const shader = String(m.getExtras()?.shader ?? '');
    // a hair preset's colour map carries its strands' cut-out in alpha
    // (Chewbacca's cards, a hero's hair planes), whatever glTF was told
    if (/hair/i.test(shader) && m.getBaseColorTexture()) m.setAlphaMode('MASK').setAlphaCutoff(0.35).setDoubleSided(true);
    // the game's eye shader reads shared maps the model doesn't name: the
    // hero's own (`--eyes`) when the bucket has it, else a dark iris, never white
    if (/eye/i.test(shader) && !m.getBaseColorTexture()) {
      const png = eyes ? await resolveImage(eyes, { root, derived: [], unpackDir }).catch(() => null) : null;
      if (png) {
        // (the game's map is dark: its eye shader lifts the white, which the
        // map holds at about 0.33 grey round an iris of a fifth of its width;
        // so the white is lifted toward 0.8 outside that circle, the iris kept)
        const lifted = await liftSclera(png.png);
        m.setBaseColorTexture(doc.createTexture('eyes').setImage(new Uint8Array(lifted)).setMimeType('image/png'));
        said.found.add(`${eyes.split('/').pop()} ← ${png.from} (eyes)`);
      } else m.setBaseColorFactor([0.16, 0.12, 0.1, 1]);
      m.setRoughnessFactor(0.15).setMetallicFactor(0);
    }
    // (Frostbite's shader preset and source maps: nothing the site reads but
    // a decal's, which lib/bf2017-dressing.mjs draws as the game does)
    m.setExtras(decalOf(shader) ? { decal: decalOf(shader) } : {});
    // a map the material's shader graph binds, given by --textures: found as
    // any other (the PNG, else unpacked), named for the native pass
    for (const { slot, name } of textures?.[m.getName()] ?? []) {
      const at = overridePath(name, slot);
      const found = await resolveImage(at, { root, derived, unpackDir });
      if (!found) {
        said.missing.add(at);
        continue;
      }
      const t = doc.createTexture(`${NATIVE}${at}`).setImage(new Uint8Array(found.png)).setMimeType('image/png');
      if (slot === 'color') m.setBaseColorTexture(t);
      else if (slot === 'normal') m.setNormalTexture(t);
      else m.setEmissiveTexture(t).setEmissiveFactor([1, 1, 1]);
      said.found.add(`${at.split('/').pop()} ← ${found.from} (--textures ${m.getName()})`);
    }
  }
  for (const t of doc.getRoot().listTextures()) if (t.getName() === MISSING) t.dispose();
  return doc;
}

// A model and its parts, each at the same LOD (or a part's nearest), as one
// document with one scene; parts on the body's skeleton share its skin.
async function readCut(io, entry, parts, lod, opts) {
  const doc = await readLod(io, lod.file, { ...opts, derived: entry.derived });
  for (const part of parts) {
    const pl = part.lods.find((l) => l.lod === lod.lod) ?? part.lods[part.lods.length - 1];
    mergeDocuments(doc, await readLod(io, pl.file, { ...opts, derived: part.derived }));
  }
  const [scene, ...more] = doc.getRoot().listScenes();
  for (const s of more) {
    for (const child of s.listChildren()) scene.addChild(child);
    s.dispose();
  }
  doc.getRoot().setDefaultScene(scene);
  if (parts.length) {
    // (floats before the parts' vertices move into the body's bind space)
    await doc.transform(unpartition(), dequantize());
    if (opts.rig) shareSkins(doc, (line) => console.log(`  ${line}`));
  }
  return doc;
}

const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);

// ── a rigid model bound to the game's skeleton for it (--bind) ──

// the skeleton at rest, read from one of its clips (a glTF of its nodes and
// one animation): its nodes as the glTF has them, and which are the roots
async function skeletonOf(root, skeleton) {
  const file = localPath(root, 'web/anims.jsonl');
  if (!existsSync(file)) throw new Error(`--bind: no ${file} (node scripts/bf2017-rigclips.mjs fetches it)`);
  const clip = [...readManifest(await readFile(file, 'utf8')).values()].find((e) => e.skeleton === skeleton && existsSync(localPath(root, `web/${e.file}`)));
  if (!clip) throw new Error(`--bind: no clip of ${skeleton} on disk (node scripts/bf2017-rigclips.mjs --pack <rig> fetches them)`);
  const json = glbJson(await readFile(localPath(root, `web/${clip.file}`)));
  return { nodes: json.nodes, roots: json.scenes[json.scene ?? 0].nodes };
}

// the joined statue's mesh skinned to that skeleton: the skeleton made as
// nodes beside it (all of them, the helpers too, by their game names), the
// vertices put in the model's frame and each given its bone
function bindTo(doc, { nodes, roots }) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene();
  const made = nodes.map((n) => doc.createNode(n.name).setTranslation(n.translation ?? [0, 0, 0]).setRotation(n.rotation ?? [0, 0, 0, 1]).setScale(n.scale ?? [1, 1, 1]));
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => made[i].addChild(made[c])));
  for (const r of roots) scene.addChild(made[r]);
  const rows = nodes.map((n, i) => ({ name: n.name, at: made[i].getWorldTranslation(), children: (n.children ?? []).map((c) => nodes[c].name) }));
  const bones = bonesOf(rows);
  const joints = bones.map((b) => made[nodes.findIndex((n) => n.name === b.name)]);
  const buffer = root.listBuffers()[0];
  const ibm = new Float32Array(joints.length * 16);
  joints.forEach((j, i) => ibm.set(invert4(j.getWorldMatrix()), i * 16));
  const skin = doc.createSkin('rig').setSkeleton(made[roots[0]]).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  for (const j of joints) skin.addJoint(j);
  let n = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const P = new Float32Array(pos.getCount() * 3);
      const p = [];
      for (let v = 0; v < pos.getCount(); v++) P.set(apply(world, pos.getElement(v, p)), v * 3);
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer));
      const nor = prim.getAttribute('NORMAL');
      if (nor) {
        const N = new Float32Array(nor.getCount() * 3);
        const turn = [...world.slice(0, 12), 0, 0, 0, 1];
        for (let v = 0; v < nor.getCount(); v++) {
          const q = apply(turn, nor.getElement(v, p));
          const l = Math.hypot(...q) || 1;
          N.set(
            q.map((x) => x / l),
            v * 3,
          );
        }
        prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer));
      }
      const index = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
      const bound = bindVertices(P, index, bones);
      const J = new Uint16Array(pos.getCount() * 4);
      const W = new Float32Array(pos.getCount() * 4);
      bound.forEach((b, v) => {
        J[v * 4] = b;
        W[v * 4] = 1;
      });
      prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(J).setBuffer(buffer));
      prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(W).setBuffer(buffer));
      n += pos.getCount();
    }
    node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    node.setSkin(skin);
  }
  return { joints: joints.length, nodes: nodes.length, vertices: n, helpers: nodes.filter((x) => HELPERS.test(x.name)).length };
}

// A colour map whose alpha is the game's smoothness (`_cs`), on a material
// that draws opaque: the alpha taken off before WebP, which otherwise drops
// the colour under every low-alpha texel (Luke's body map: 33.7 dB at any
// quality with it, 48.6 dB at WebP 90 without, and a twelfth the bytes).
const opaqueColour = () => async (doc) => {
  const keep = new Set();
  for (const m of doc.getRoot().listMaterials()) if (m.getAlphaMode() !== 'OPAQUE' && m.getBaseColorTexture()) keep.add(m.getBaseColorTexture());
  for (const m of doc.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture();
    if (!t || keep.has(t) || !/png|webp|jpeg/.test(t.getMimeType())) continue;
    const img = t.getImage();
    const meta = await sharp(img).metadata();
    if (meta.hasAlpha) t.setImage(new Uint8Array(await sharp(img).removeAlpha().png().toBuffer())).setMimeType('image/png');
  }
};

// Each map the game has as KTX2 on disk, in place of its decoded copy, at
// the cut's size (colour at `tex`, the rest at `maps`) by dropping whole
// mip levels. Returns how many it took.
export async function nativeMaps(doc, spec) {
  let n = 0;
  for (const t of doc.getRoot().listTextures()) {
    const name = t.getName();
    if (!name.startsWith(NATIVE)) continue;
    const file = localPath(spec.root, name.slice(NATIVE.length));
    if (!file.endsWith('.ktx2') || !existsSync(file)) continue;
    const bytes = new Uint8Array(await readFile(file));
    const { width, scheme } = ktx2Info(bytes);
    const want = listTextureSlots(t).some((s) => /baseColor|emissive/.test(s)) ? spec.tex : spec.maps;
    const drop = Math.max(0, Math.round(Math.log2(width / want)));
    // (an ETC1S map, BasisLZ, keeps codebooks across its levels, so its top
    // can't be taken off: whole where it fits, else the decoded image goes
    // through textureCompress like any other)
    if (scheme === BASIS_LZ && drop) continue;
    t.setImage(dropLevels(bytes, drop)).setMimeType('image/ktx2').setName(name.slice(NATIVE.length).split('/').pop());
    n++;
  }
  if (n) doc.createExtension(KHRTextureBasisu).setRequired(true);
  return n;
}

// (textureCompress skips a texture only when both its name and its URI fail
// the pattern: a made map has no URI, and the one character asks for one)
const NOT_KEPT = new RegExp(`^(?!${KEPT}).`);

// ── one cut, through the pipeline, to a file ──

async function makeCut(io, entry, parts, lod, spec, out) {
  const doc = await readCut(io, entry, parts, lod, spec);
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const root = doc.getRoot();
  const budget = lod.triangles + parts.reduce((n, p) => n + (p.lods.find((l) => l.lod === lod.lod) ?? p.lods[p.lods.length - 1]).triangles, 0);
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
  // (each map read through the UV set the game reads it through: lib/bf2017-uv.mjs;
  // the game's glass made glass, its decals blended by their own masks, its
  // weak points' covers dropped: lib/bf2017-dressing.mjs)
  await doc.transform(atlasUVs(), dressed({ sharp }));
  // where it is held, in the model's own frame, before anything moves
  const socket = spec.grip.map((g) => root.listNodes().find((n) => n.getName() === g)).find(Boolean);
  const hold = socket ? socket.getWorldTranslation() : [0, 0, 0];
  if (spec.rig && !spec.statue) await doc.transform(dequantize(), dedup(), metalRough(), prune(), bareWhereUntextured(), weld());
  else await doc.transform(dequantize(), unskinned(), dedup(), metalRough(), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }), weld());
  // (--join: a figure's parts that share a material drawn as one)
  if (spec.rig && !spec.statue && spec.join) {
    joinSkinned(doc);
    await doc.transform(prune());
  }
  // (the cut is the file, so this is only for parts that overshoot it)
  if (spec.simplify !== false && triangles(doc) > budget * 1.1) {
    console.log(`  ${Math.round(triangles(doc))} triangles against the cut's ${budget}: simplified`);
    await doc.transform(simplified(budget));
  }
  const bound = spec.skeleton && !spec.statue ? bindTo(doc, spec.skeleton) : null;
  if (bound) console.log(`  bound to its skeleton: ${bound.vertices} vertices to ${bound.joints} bones (${bound.nodes} nodes, ${bound.helpers} of them the game's helpers)`);
  // (--keep-origin: a weapon stays in the frame the game modelled it in, its
  // origin the grip the game's Wep_Root socket holds it by: never moved)
  if (!spec.keepOrigin) await doc.transform(grounded(spec));
  const ground = root.listNodes().find((n) => n.getName() === 'ground');
  // (in the frame the manifest's bounds give: a cockpit where its hull's put it)
  if (spec.frame && ground) {
    const [a, b] = [spec.frame.min, spec.frame.max];
    ground.setScale([1, 1, 1]).setTranslation([-(a[0] + b[0]) / 2, -a[1], -(a[2] + b[2]) / 2]);
  }
  const gripAt = ground ? apply(ground.getMatrix(), hold) : hold;
  const rigged = (spec.rig || bound) && !spec.statue;
  if (!rigged) await doc.transform(flatten());
  await doc.transform(dedup(), prune());
  // (on a rig, a child of the socket, so it moves with the hand and the
  // socket keeps its name for the game's clips)
  const held = rigged && socket && root.listNodes().includes(socket) ? socket : null;
  if (held) held.addChild(doc.createNode('grip'));
  else root.getDefaultScene().addChild(doc.createNode('grip').setTranslation(gripAt));
  // (a far cut wears the game's colour maps alone: its normals and smoothness
  // are under a pixel at the distance it's drawn)
  if (spec.colourOnly) {
    for (const m of root.listMaterials()) m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
    // (the maps alone: an empty node such as the grip stays)
    await doc.transform(prune({ propertyTypes: ['Texture'] }));
  }
  // the game's own maps, as the bucket holds them (zstd UASTC, full mips),
  // their top levels dropped to the cut's size: nothing re-encoded (--native,
  // and --full's plain cut); a map the bucket has no KTX2 for goes through
  // the encoder (AVIF on --full's plain cut, WebP on every other)
  const native = spec.native ? await nativeMaps(doc, spec) : 0;
  const format = spec.format ?? 'webp';
  await doc.transform(
    opaqueColour(),
    // (a map lib/bf2017-dressing.mjs made from the game's pixels is lossless already: left as it is)
    textureCompress({ encoder: sharp, targetFormat: format, formats: /png|jpeg|webp/, pattern: NOT_KEPT, slots: /baseColor|emissive/, resize: [spec.tex, spec.tex], quality: spec.quality }),
    textureCompress({ encoder: sharp, targetFormat: format, formats: /png|jpeg|webp/, pattern: NOT_KEPT, slots: /normal|occlusion|metallicRoughness|specular|sheen|clearcoat|transmission/, resize: [spec.maps, spec.maps], quality: spec.mapsQuality }),
    // (the game's own precision: half-float positions are 16 bits; a UV at
    // meshopt's default 12 bits is half a texel off on a 2048 map)
    meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16 }),
  );
  await mkdir(dirname(out), { recursive: true });
  await io.write(out, doc);
  const bytes = (await stat(out)).size;
  const [w, h, l] = dims(doc);
  const box = bounds(doc, root.getDefaultScene());
  return { out, bytes, box, native, tris: Math.round(triangles(doc)), draws: root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0), maps: root.listTextures().length, size: [w, h, l], socket: socket?.getName() ?? null, joints: new Set(root.listSkins().flatMap((s) => s.listJoints())).size };
}

// ── the arguments ──

// a vehicle's cuts (lane V's budgets): the plain under 25,000 triangles, the
// light under 7,000, the far under 1,000 (else the chain's last)
export const VEHICLE = { plainMax: 25000, lod1Max: 7000, farMax: 1000 };
// a native vehicle's (the game's own maps, from the bucket: the native caps
// of lib/bf2017-caps.mjs): the plain the game's first LOD under 60,000
// triangles, which is its LOD0 for all but the biggest, and the ultra its
// LOD0 whatever it is, with every map at the game's own size
export const NATIVE_VEHICLE = { plainMax: 60000, lod1Max: 7000, farMax: 1000 };
export function vehicleCuts(entry, { native = false, ultra = false } = {}) {
  const caps = native ? NATIVE_VEHICLE : VEHICLE;
  const cuts = cutsFor(entry, { plainMax: caps.plainMax, lod1Max: caps.lod1Max, ultra });
  if (native && ultra) cuts.ultra = [...entry.lods].sort((a, b) => a.lod - b.lod)[0];
  return cuts;
}
export const farCut = (entry, max = VEHICLE.farMax) => {
  const lods = [...entry.lods].sort((a, b) => a.lod - b.lod);
  return lods.find((l) => l.triangles <= max) ?? lods[lods.length - 1];
};

// (--full's cuts, the vehicles', or the triangle budgets'; either way --cuts
// names a LOD for any of them: a kind whose light LODs wear maps the bucket
// hasn't yet, the Wookiee's `lodcaps` from LOD3, takes the last LOD whose
// maps are there)
function cutsOf(entry, opts, rig) {
  const cuts = opts.full ? fullCuts(entry) : opts.vehicle ? vehicleCuts(entry, { native: Boolean(opts.native), ultra: Boolean(opts.ultra) }) : cutsFor(entry, { plainMax: rig ? 8000 : 12000, ultra: Boolean(opts.ultra) });
  if (opts.far && !opts.full) cuts.far = farCut(entry);
  if (typeof opts.cuts === 'string')
    for (const part of opts.cuts.split(',')) {
      const [name, n] = part.split('=');
      if (!['lod1', 'plain', 'ultra', 'far'].includes(name)) throw new Error(`--cuts: ${name}? (lod1, plain, ultra, far)`);
      const lod = entry.lods.find((l) => l.lod === Number(n));
      if (!lod) throw new Error(`--cuts: ${entry.name} has no LOD ${n} (it has ${entry.lods.map((l) => l.lod).join(', ')})`);
      cuts[name] = lod;
    }
  return cuts;
}

export { overCaps } from './lib/bf2017-caps.mjs';
const MB = 1048576;

export async function importModel(name, opts) {
  const kind = opts.kind;
  if (!kind || !/^[a-z0-9]+$/.test(kind)) throw new Error('--kind: letters and digits, the catalogue’s way (hiltluke, vader…)');
  if (!opts.as) throw new Error('--as: what it is, for the credit (‘Luke’s lightsaber hilt’)');
  const root = resolve(opts.root ?? path(ROOT, 'lab', 'assets', 'bf2017'));
  const manifestFile = localPath(root, 'web/models.jsonl');
  if (!existsSync(manifestFile)) throw new Error(`no manifest at ${manifestFile}: node --env-file=.env.local scripts/bf2017-fetch.mjs manifest`);
  const manifest = readManifest(await readFile(manifestFile, 'utf8'));
  const entry = manifest.get(name);
  if (!entry) throw new Error(`${name}: not in the manifest (node scripts/bf2017-fetch.mjs --list '<glob>')`);
  const rig = Boolean(opts.rig);
  const parts = typeof opts.parts === 'string' ? partsOf(manifest, name, opts.parts.split(',')).filter((p) => !isSequel(p.name)) : [];
  const metres = opts.metres !== undefined && opts.metres !== true ? Number(opts.metres) : Number((entry.max[1] - entry.min[1]).toFixed(3));
  const tex = Number(opts.tex ?? 1024);
  const maps = Number(opts.maps ?? tex / 2);
  const spec = {
    root,
    unpackDir: resolve(opts.unpacked ?? path(root, 'unpacked')),
    metres,
    along: opts.along ?? 'y',
    yaw: Number(opts.yaw ?? 0),
    up: opts.up ?? 'y',
    rig,
    grip: typeof opts.grip === 'string' ? [opts.grip] : rig ? ['Wep_Root', 'IK_Joint_RightHand'] : ['Wep_Root'],
    keepOrigin: Boolean(opts.keepOrigin),
    // (the game's own KTX2 maps in every cut, trimmed to its size: --native)
    native: Boolean(opts.native),
    // (a hero's own eye map, under web/textures/, for the eye shader's material)
    eyes: typeof opts.eyes === 'string' ? `web/textures/${opts.eyes.replace(/^web\/textures\//, '')}` : null,
    // (maps a shader graph binds, by material name: --textures)
    textures: typeof opts.textures === 'string' ? parseTextures(opts.textures) : null,
    // (WebP quality: colour, then the rest; a hero at the game's full maps takes more)
    quality: Number(opts.quality ?? 82),
    mapsQuality: Number(opts.mapsQuality ?? opts.quality ?? 80),
    said: { found: new Set(), missing: new Set() },
    skeleton: typeof opts.bind === 'string' ? await skeletonOf(root, opts.bind) : null,
    frame: null,
  };
  if (opts.hullFrame) {
    const hull = typeof opts.hullFrame === 'string' ? manifest.get(opts.hullFrame) : entry;
    if (!hull) throw new Error(`--hull-frame: ${opts.hullFrame} is not in the manifest`);
    spec.frame = { min: hull.min, max: hull.max, name: hull.name };
  }
  // (--full: the game's LOD0 at its own maps, the light cut at LOD4 or so,
  // and with --far a figure's far cut from the chain's last)
  const full = Boolean(opts.full);
  const cuts = cutsOf(entry, { ...opts, full }, rig);
  const lastLod = [...entry.lods].sort((a, b) => a.lod - b.lod).pop();
  const farLod = full && opts.far ? (cuts.far ?? lastLod) : null;
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const outRoot = resolve(opts.out ?? path(ROOT, 'public', 'models', 'galaxy'));
  // (a 2017 person on the game's rig beside the crew's own, which other worlds and tools still load)
  // (--sub: another folder under models/galaxy, the object library's surface/game)
  const sub = typeof opts.sub === 'string' ? opts.sub : opts.crew ? (rig ? 'bf2017/crew' : 'crew') : 'surface';
  const dir = path(outRoot, sub);
  const made = [];
  spec.join = Boolean(opts.join);
  // (the full cut: every map at the game's own size, up to 2048, AVIF q90,
  // the mesh never simplified; positions at 16 bits)
  const plainSpec = full ? { ...spec, native: true, tex: 2048, maps: 2048, format: 'avif', quality: Number(opts.quality ?? 90), mapsQuality: Number(opts.quality ?? 90), simplify: false } : { ...spec, tex, maps };
  const plain = await makeCut(io, entry, parts, cuts.plain, plainSpec, path(dir, `${kind}.glb`));
  made.push(['plain', cuts.plain, plain]);
  let lod = false;
  if (cuts.lod1) {
    // (the light cut: half the colour, a quarter of the full maps at most
    // 512, at the usual quality; under --full, colour 1024 and the rest 512, WebP)
    // (--lod1-tex and --lod1-maps: a kind of many parts, the Hoth trooper's
    // seven, takes smaller maps on its light cut to keep a phone's world to
    // its 20 MB of models: the design's 'a smaller map, said in the PR')
    const lightSpec = full ? { ...spec, native: false, tex: Number(opts.lod1Tex ?? 1024), maps: Number(opts.lod1Maps ?? 512), quality: 82, mapsQuality: 80 } : { ...spec, tex: opts.lod1Tex ? Number(opts.lod1Tex) : tex / 2, maps: opts.lod1Maps ? Number(opts.lod1Maps) : opts.lightMaps ? Number(opts.lightMaps) : spec.native ? maps / 2 : Math.min(maps / 2, Math.max(256, maps / 4)), quality: 82, mapsQuality: 80 };
    const light = await makeCut(io, entry, parts, cuts.lod1, lightSpec, path(dir, `${kind}.lod1.glb`));
    if (light.bytes < 0.7 * plain.bytes) {
      made.push(['lod1', cuts.lod1, light]);
      lod = true;
    } else {
      await unlink(light.out);
      console.log(`  no .lod1: LOD${cuts.lod1.lod} came to ${light.bytes} bytes, not under 0.7 × the plain file's ${plain.bytes}`);
    }
  } else console.log('  no .lod1: the chain has no cut light enough below the plain one');
  let far = false;
  // (--full --far: the chain's last cut, colour at 256 and the rest at 128,
  // for the squads past the level's mid, a few dozen pixels tall there; a
  // figure of many parts, each with its maps, halves them until it fits)
  if (farLod) {
    let f = null;
    for (let t = 256; t >= 64; t /= 2) {
      f = await makeCut(io, entry, parts, farLod, { ...spec, native: false, tex: t, maps: t / 2, quality: 80, mapsQuality: 78 }, path(dir, `${kind}.far.glb`));
      if (f.bytes <= 150 * 1024) break;
      console.log(`  far at ${t}: ${(f.bytes / 1024).toFixed(0)} KB, over 150: halved`);
    }
    made.push(['far', farLod, f]);
    far = true;
  } else if (cuts.far) {
    const f = await makeCut(io, entry, parts, cuts.far, { ...spec, statue: true, colourOnly: true, tex: Number(opts.farTex ?? 256), maps: Number(opts.farTex ?? 256) }, path(dir, `${kind}.far.glb`));
    made.push(['far', cuts.far, f]);
    far = true;
    if (cuts.far.triangles > VEHICLE.farMax) console.log(`  the far cut is the chain's last, LOD${cuts.far.lod}: ${cuts.far.triangles} triangles, over the ${VEHICLE.farMax} it aims at`);
  }
  let ultra = null;
  if (cuts.ultra) {
    const ut = Number(opts.ultraTex ?? 2048);
    const u = await makeCut(io, entry, parts, cuts.ultra, { ...spec, tex: ut, maps: Number(opts.ultraMaps ?? 1024) }, path(dir, `${kind}.ultra.glb`));
    // (a native one the same mesh with the same maps, where the game's are
    // no bigger than the plain cut's, is no gain: not kept)
    if (spec.native && cuts.ultra.lod === cuts.plain.lod && u.bytes < 1.1 * plain.bytes) {
      await unlink(u.out);
      console.log(`  no .ultra: LOD${cuts.ultra.lod} at the game's own maps came to ${u.bytes} bytes, the plain file's ${plain.bytes}`);
    } else {
      made.push(['ultra', cuts.ultra, u]);
      ultra = { tris: u.tris, tex: ut };
    }
  }
  // (a file over its cap is not shipped: the import stops and says which)
  const over = overCaps(made.map(([cut, , r]) => [cut, r.bytes]), { hero: Boolean(opts.hero), native: Boolean(opts.native), full });
  if (over.length) throw new Error(`${kind}: ${over.join('; ')} (smaller --tex and --maps, or another --cuts)`);
  for (const f of spec.said.found) console.log(`  map ${f}`);
  for (const f of spec.said.missing) console.log(`  missing: ${f}`);
  if (!plain.socket) console.log(`  (no ${spec.grip.join(' or ')} in the file: grip made at the model's own origin)`);
  else console.log(`  grip at ${plain.socket}`);
  if (rig || spec.skeleton) console.log(`  rig kept whole: ${plain.joints} joints`);
  // (a cockpit's one check: it lies inside its hull, both stood as the hull's manifest bounds put it)
  if (spec.frame && spec.frame.name !== name) {
    const h = spec.frame;
    const hull = { min: [-(h.max[0] - h.min[0]) / 2, 0, -(h.max[2] - h.min[2]) / 2], max: [(h.max[0] - h.min[0]) / 2, h.max[1] - h.min[1], (h.max[2] - h.min[2]) / 2] };
    const inside = [0, 1, 2].every((i) => plain.box.min[i] >= hull.min[i] - 0.05 && plain.box.max[i] <= hull.max[i] + 0.05);
    console.log(`  inside ${h.name.split('/').pop()}: ${inside ? 'yes' : 'NO'} (${plain.box.min.map((v) => v.toFixed(2))} to ${plain.box.max.map((v) => v.toFixed(2))} in ${hull.min.map((v) => v.toFixed(2))} to ${hull.max.map((v) => v.toFixed(2))})`);
  }
  for (const [cut, l, r] of made) {
    const [w, h, d] = r.size;
    console.log(`${relative(ROOT, r.out).padEnd(48)} ${cut.padEnd(5)} LOD${l.lod}  ${r.tris} triangles, ${r.draws} draws, ${r.maps} maps, ${(r.bytes / 1024).toFixed(1)} KB; ${w.toFixed(2)} wide × ${h.toFixed(2)} tall × ${d.toFixed(2)} long (m)`);
  }
  const file = `/models/galaxy/${sub}/${kind}.glb`;
  // (the full cut's textures on the GPU, for the page's ledger: lib/three/walrusCuts.js)
  const fullMB = full ? Math.ceil(glbTextures(await readFile(plain.out)).gpuBytes / MB) : 0;
  // (and its download, for the same ledger)
  const fullDL = full ? Math.ceil(plain.bytes / MB) : 0;
  if (full) console.log(`  the full cut: ${fullDL} MB to download, its maps ${fullMB} MB on the GPU`);
  const more = `${lod ? ', lod: true' : ''}${far ? ', far: true' : ''}${full ? `, full: true, fullMB: ${fullMB}, fullDL: ${fullDL}` : ''}`;
  if (opts.crew) console.log(`the CREW row (src/components/galaxy/surface/crewList.js):\n  ${kind}: { url: '${file}', tall: ${metres}${rig ? `, rig: 'walrus'${opts.hero ? `, pack: '${kind}'` : ''}` : ''}${more} },`);
  // (catalog: false, the object library's: its row is the index's, catalog/bf2017-library.js)
  else if (opts.catalog !== false) {
    // (a vehicle's the file's own count, after its markers and normal-only decals are gone)
    const row = { made: 'bf2017', as: opts.as, metres, along: spec.along, yaw: 0, tris: opts.vehicle ? plain.tris : cuts.plain.triangles, tex };
    if (rig || spec.skeleton) row.rig = true;
    if (far) row.far = true;
    if (spec.frame && spec.frame.name !== name) row.hull = spec.frame.name;
    if (opts.hero) row.hero = true;
    // (the game's own maps, held to the native caps: scripts/lib/bf2017-caps.mjs)
    if (spec.native) row.native = true;
    if (lod) row.lod = true;
    if (full) Object.assign(row, { full: true, fullMB, fullDL });
    if (ultra) row.ultra = ultra;
    row.from = name;
    await writeCatalogueLine(resolve(opts.catalog ?? path(ROOT, 'src', 'components', 'galaxy', 'surface', 'catalog', 'bf2017.js')), kind, row);
  }
  await writeCredit(resolve(opts.credits ?? path(ROOT, 'src', 'data', 'modelCredits.json')), `${opts.crew ? (rig ? 'bf2017' : 'crew') : sub.replace(/\//g, '-')}-${kind}`, {
    title: `Star Wars Battlefront II (2017): ${name}`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy-surface',
    as: opts.as,
    file,
    also: ['galaxy'],
    permission: PERMISSION,
  });
  console.log(`next: node scripts/glb-shot.mjs ${relative(ROOT, plain.out)} /tmp/${kind}.png three   (with npx vite --port 5188 --strictPort --host 127.0.0.1 running)`);
  return made;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [name] = args._;
  if (!name) {
    console.error("usage: node scripts/bf2017-import.mjs <manifest name> --kind <kind> --as '<what it is>' [--asis | --metres <m>] [--rig] [--crew] [--hero] [--ultra] [--tex 1024] [--maps 512] [--parts '<glob>,…']");
    process.exit(1);
  }
  if (isSequel(name)) {
    console.error(`${name} is sequel-era; the site shows none of it (autopilot rules)`);
    process.exit(2);
  }
  importModel(name, args).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
