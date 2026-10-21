// Does each of a world's figures work as a figure that walks and holds:
// its model on disk, its bones by role (hips, both hands, toes, head), the
// skin on each hand (40 vertices or more for held.js's grip frame), the
// locomotion clips it carries or borrows, and whether its walk's stride can
// be measured. The galaxy's own audit (galaxy-figures-audit.mjs, how each
// kind is drawn) stays; this is the one for hands and feet, for every world.
// (docs/superpowers/specs/2026-10-09-things-in-hand-design.md)
//
//   node scripts/cast-audit.mjs --world middleearth|rickmorty|galaxy [--json out] [--md out]
//
// Exit 1 on a figure whose file is missing, or one the world says holds
// something whose hand can't take it (under 40 vertices of skin and no
// forearm to fall back on; both hands for a two-handed kind).
//
//   figureOf(doc, skinStep) → { root, skins: [{ joints, counts }], clips }
//     (a GLB read by @gltf-transform, as three.js bones and clips; counts:
//     per joint, the vertices skinned to it at 0.6 or more, as held.js
//     reads a hand: every skinStep(n)th of a primitive's n, held.js's own
//     sample, so a hand that passes here gives a frame there; every one
//     when no skinStep is given)
//   rowOf(entry, got, lib) → a row: { name, file, bytes, bones, handSkin,
//     clips, stride, holds, warn }. entry: { name, file, holds?, clips? }
//     (clips: { idle, walk, run } the files beside it, if any); got: { doc,
//     bytes, clipDocs: { idle, walk, run } }, a doc null when the file's
//     missing; lib: { findBones, strideOf, HELD, skinStep } (held.js's)
//   failing(rows, lib) → [{ name, why }]: the rows that fail the audit
//   table(rows, world) → Markdown
//
// With no --world it prints the site’s cast table instead (src/lib/cast/
// bodies.js): every kind, whose body it is, its file and what could replace
// it, then the count by source and the site rows with a `could`, the number
// the Battlefront-by-default design moves (its decision 1).
//
//   node scripts/cast-audit.mjs [--md out]
//
//   castRows(BODIES, fileOf) → [{ kind, source, file, faces, could }]  (pure)
//   castCounts(rows) → { kinds, by: { [source]: n }, site, could }      (pure)
//   castTable(rows) → Markdown: the table, then the counts              (pure)

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = process.argv[1] === fileURLToPath(import.meta.url);
const args = MAIN ? process.argv.slice(2) : [];
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);

export const MIN_SKIN = 40;
const FIRM = 0.6; // a vertex's weight on a bone to count as that bone's
const LOCO = ['idle', 'walk', 'run'];
const sane = (n) => THREE.PropertyBinding.sanitizeNodeName(n ?? '');

// an accessor's values as floats (a normalised one scaled back)
function floats(acc) {
  const a = acc.getArray();
  if (!acc.getNormalized()) return a;
  const max = { Int8Array: 127, Uint8Array: 255, Int16Array: 32767, Uint16Array: 65535 }[a.constructor.name] ?? 1;
  return Float32Array.from(a, (v) => Math.max(v / max, -1));
}

export function figureOf(doc, skinStep = () => 1) {
  const root = new THREE.Group();
  const made = new Map();
  const skinned = new Set();
  for (const skin of doc.getRoot().listSkins()) for (const j of skin.listJoints()) skinned.add(j);
  const build = (node, parent) => {
    const o = skinned.has(node) ? new THREE.Bone() : new THREE.Object3D();
    o.name = sane(node.getName());
    o.position.fromArray(node.getTranslation());
    o.quaternion.fromArray(node.getRotation());
    o.scale.fromArray(node.getScale());
    parent.add(o);
    made.set(node, o);
    for (const c of node.listChildren()) build(c, o);
  };
  for (const scene of doc.getRoot().listScenes()) for (const n of scene.listChildren()) build(n, root);
  root.updateMatrixWorld(true);
  // the vertices on each joint, firmly
  const skins = [];
  for (const node of doc.getRoot().listNodes()) {
    const skin = node.getSkin();
    const mesh = node.getMesh();
    if (!skin || !mesh) continue;
    const joints = skin.listJoints().map((j) => made.get(j));
    const counts = new Array(joints.length).fill(0);
    for (const prim of mesh.listPrimitives()) {
      const J = prim.getAttribute('JOINTS_0');
      const W = prim.getAttribute('WEIGHTS_0');
      if (!J || !W) continue;
      const ji = J.getArray();
      const w = floats(W);
      const n = J.getCount();
      const step = skinStep(n);
      for (let i = 0; i < n; i += step) {
        const per = new Map();
        for (let k = 0; k < 4; k++) per.set(ji[i * 4 + k], (per.get(ji[i * 4 + k]) ?? 0) + w[i * 4 + k]);
        for (const [j, sum] of per) if (sum >= FIRM && j < counts.length) counts[j]++;
      }
    }
    skins.push({ joints, counts });
  }
  return { root, skins, clips: clipsOf(doc) };
}

// a file's animations as three.js clips, on its nodes' names
function clipsOf(doc) {
  const path = { rotation: 'quaternion', translation: 'position', scale: 'scale' };
  return doc
    .getRoot()
    .listAnimations()
    .map((a) => {
      const tracks = [];
      for (const ch of a.listChannels()) {
        const s = ch.getSampler();
        const p = path[ch.getTargetPath()];
        const node = ch.getTargetNode();
        if (!p || !node || !s) continue;
        const Track = p === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
        tracks.push(new Track(`${sane(node.getName())}.${p}`, Array.from(floats(s.getInput())), Array.from(floats(s.getOutput()))));
      }
      return new THREE.AnimationClip(a.getName(), -1, tracks);
    });
}

// the skin on a bone, over every mesh it moves
const skinOn = (fig, bone) => (bone ? fig.skins.reduce((n, s) => n + (s.joints.includes(bone) ? s.counts[s.joints.indexOf(bone)] : 0), 0) : 0);

// a walk's stride, measured on the figure (locomotion.js's), or null
function strideFrom(fig, walk, toes, strideOf) {
  if (!walk || !toes[0] || !toes[1]) return null;
  const mixer = new THREE.AnimationMixer(fig.root);
  const action = mixer.clipAction(walk);
  action.play();
  try {
    return strideOf(fig.root, mixer, [action], action, toes);
  } finally {
    mixer.stopAllAction();
  }
}

export function rowOf(entry, got, { findBones, strideOf, skinStep }) {
  const row = { name: entry.name, file: entry.file, bytes: got.bytes ?? 0, bones: { hips: false, handR: false, handL: false, toes: false, head: false }, handSkin: { r: 0, l: 0 }, forearm: { r: false, l: false }, clips: { own: [], borrowed: false }, stride: false, holds: entry.holds ?? null, warn: [] };
  if (!got.doc) {
    row.warn.push('missing file');
    return row;
  }
  const fig = figureOf(got.doc, skinStep);
  const { bones } = findBones(fig.root);
  row.bones = { hips: Boolean(bones.hips), handR: Boolean(bones.handR), handL: Boolean(bones.handL), toes: Boolean(bones.toeL && bones.toeR), head: Boolean(bones.head) };
  row.handSkin = { r: skinOn(fig, bones.handR), l: skinOn(fig, bones.handL) };
  row.forearm = { r: Boolean(bones.foreR), l: Boolean(bones.foreL) };
  // its clips: in its own file, or beside it, else borrowed (a Meshy skeleton's, from the library or a lead's)
  const own = new Map(fig.clips.map((c) => [c.name, c]));
  for (const c of LOCO) {
    const beside = got.clipDocs?.[c];
    if (beside && !own.has(c)) {
      const clip = clipsOf(beside)[0];
      if (clip) own.set(c, clip);
    }
  }
  row.clips.own = [...own.keys()];
  const loco = LOCO.filter((c) => own.has(c));
  row.clips.borrowed = loco.length < LOCO.length && Boolean(bones.hips);
  const walk = own.get('walk') ?? fig.clips.find((c) => /walk/i.test(c.name)) ?? null;
  row.stride = Boolean(strideFrom(fig, walk, [bones.toeL, bones.toeR], strideOf)?.speed > 0);
  if (!row.bones.handR || !row.bones.handL) row.warn.push('no hand bone');
  if (row.bones.handR && row.handSkin.r < MIN_SKIN) row.warn.push(`right hand skin ${row.handSkin.r}`);
  if (row.bones.handL && row.handSkin.l < MIN_SKIN) row.warn.push(`left hand skin ${row.handSkin.l}`);
  if (!row.bones.toes) row.warn.push('no toes');
  if (!loco.length) row.warn.push(row.clips.borrowed ? 'locomotion borrowed' : 'no locomotion');
  if (walk && !row.stride) row.warn.push('stride not measured');
  return row;
}

export function failing(rows, { HELD = {} } = {}) {
  const out = [];
  for (const r of rows) {
    if (r.warn.includes('missing file')) {
      out.push({ name: r.name, why: `missing ${r.file}` });
      continue;
    }
    if (!r.holds) continue;
    const kind = HELD[r.holds];
    const first = kind?.hand === 'left' ? 'l' : 'r';
    const sides = kind?.hands === 2 ? [first, first === 'r' ? 'l' : 'r'] : [first];
    for (const side of sides) {
      const hand = side === 'r' ? r.bones.handR : r.bones.handL;
      if (!hand || (r.handSkin[side] < MIN_SKIN && !r.forearm[side])) out.push({ name: r.name, why: `holds ${r.holds}, but its ${side === 'r' ? 'right' : 'left'} hand can’t take it (${hand ? `${r.handSkin[side]} vertices, no forearm` : 'no hand bone'})` });
    }
  }
  return out;
}

const yes = (b) => (b ? 'yes' : '—');
export function table(rows, world = '') {
  const lines = [`# The cast audit${world ? `: ${world}` : ''}`, '', `${rows.length} figures. Hand skin is the vertices skinned to each hand at ${FIRM} or more (${MIN_SKIN} gives a grip frame).`, ''];
  lines.push('| figure | KB | hips | hands | toes | head | hand skin (R / L) | clips | borrows | stride | holds | warnings |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const hands = r.bones.handR && r.bones.handL ? 'both' : r.bones.handR ? 'right' : r.bones.handL ? 'left' : '—';
    lines.push(`| ${r.name} | ${(r.bytes / 1024).toFixed(0)} | ${yes(r.bones.hips)} | ${hands} | ${yes(r.bones.toes)} | ${yes(r.bones.head)} | ${r.handSkin.r} / ${r.handSkin.l} | ${r.clips.own.join(', ') || '—'} | ${yes(r.clips.borrowed)} | ${yes(r.stride)} | ${r.holds ?? '—'} | ${r.warn.join('; ') || '—'} |`);
  }
  return lines.join('\n') + '\n';
}

// ── the cast table: whose body each kind is ──

export const castRows = (BODIES, fileOf) =>
  Object.entries(BODIES).map(([kind, row]) => ({ kind, source: row.source ?? null, file: fileOf(row), faces: row.faces?.length ?? 0, could: row.could ?? null }));

export function castCounts(rows) {
  const by = {};
  for (const r of rows) by[r.source] = (by[r.source] ?? 0) + 1;
  const site = rows.filter((r) => r.source === 'site');
  return { kinds: rows.length, by, site: site.length, could: site.filter((r) => typeof r.could === 'string').length };
}

// the game’s first, then the mods’, then the site’s, as the table ranks them
const order = (s) => (s === 'game' ? 0 : String(s).startsWith('mod:') ? 1 : 2);
export function castTable(rows) {
  const c = castCounts(rows);
  const cell = (s) => String(s).replace(/\|/g, '\\|');
  const lines = ['# The cast table', '', 'Every Star Wars figure kind the site draws (`src/lib/cast/bodies.js`), whose body it is, and what could replace a site’s body.', ''];
  lines.push('| kind | source | file | could |', '|---|---|---|---|');
  for (const r of rows) {
    const file = r.faces ? `${r.file} and ${r.faces} more ${r.faces === 1 ? 'face' : 'faces'}` : r.file;
    const could = r.source === 'site' ? (r.could ?? '— (none has it)') : '';
    lines.push(`| ${r.kind} | ${r.source} | ${cell(file)} | ${cell(could)} |`);
  }
  const by = Object.entries(c.by)
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([s, n]) => `${n} ${s}`)
    .join(', ');
  lines.push('', `${c.kinds} kinds: ${by}.`, `Site rows with a \`could\`: ${c.could} of ${c.site}.`);
  return lines.join('\n') + '\n';
}

// ── the worlds' manifests (through Vite: they import as the site does) ──

// what Middle-earth's toys carry, by who plays them (the towns' looks' `item`)
const ME_HOLDS = { gandalf: 'staff', gandalfwhite: 'white-staff', saruman: 'white-staff', aragorn: 'sword', gimli: 'axe', legolas: 'bow', boromir: 'horn', elf: 'bow' };

const pub = (url) => join(ROOT, 'public', url.replace(/^\//, ''));

async function manifest(world, load) {
  if (world === 'middleearth') {
    const { CAST } = await load('/src/components/middleearth/castRules.js');
    const dir = '/models/middleearth/cast';
    return CAST.map((name) => ({ name, file: `${dir}/${name}.glb`, holds: ME_HOLDS[name] ?? null, clips: Object.fromEntries(LOCO.map((c) => [c, `${dir}/${name}-${c}.glb`])) }));
  }
  if (world === 'rickmorty') {
    const { MESHY, BASE, assetUrl } = await load('/src/components/rickmorty/portal/meshyCast.js');
    const { BODIES } = await load('/src/components/rickmorty/wardrobe/looks.js');
    const out = new Map();
    const add = (name, asset, holds) => {
      const file = assetUrl(asset);
      if ([...out.values()].some((e) => e.file === file)) return;
      const clips = asset.startsWith('/') ? {} : Object.fromEntries(LOCO.map((c) => [c, `${BASE}/${asset}-${c}.glb`]));
      out.set(name, { name, file, holds, clips });
    };
    for (const [name, m] of Object.entries(MESHY)) add(name, m.a, null);
    // (the wardrobe's hand slot: any body can be given the portal gun)
    for (const b of Object.values(BODIES).flat()) add(b.id, b.asset, 'portalgun');
    return [...out.values()];
  }
  if (world === 'galaxy') {
    const { CREW, fileOf } = await load('/src/components/galaxy/surface/crewList.js');
    const { HEROES } = await load('/src/components/galaxy/heroes.js');
    const { MODELS } = await load('/src/components/galaxy/surface/catalog/people.js');
    const out = new Map();
    const add = (name, file, holds) => {
      if (!file || [...out.values()].some((e) => e.file === file)) return;
      out.set(name, { name, file, holds, clips: {} });
    };
    for (const h of HEROES) add(h.id, h.src?.url, h.weapon ?? null);
    for (const [name, c] of Object.entries(CREW)) add(name, fileOf(c), null);
    for (const kind of Object.keys(MODELS)) add(kind, `/models/galaxy/surface/${kind}.glb`, null);
    return [...out.values()];
  }
  throw new Error(`no world ${world}: middleearth, rickmorty or galaxy`);
}

// the cast table needs no Vite: the file imports nothing
async function castMain() {
  const { BODIES, fileOf } = await import('../src/lib/cast/bodies.js');
  const md = castTable(castRows(BODIES, fileOf));
  const out = opt('--md');
  if (out) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, md);
  }
  console.log(md);
}

async function main() {
  const world = opt('--world');
  if (!world) return castMain();
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const read = async (url) => (url && existsSync(pub(url)) ? io.read(pub(url)) : null);
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const load = (p) => vite.ssrLoadModule(p);
    const { findBones } = await load('/src/lib/three/rig.js');
    const { strideOf } = await load('/src/lib/three/locomotion.js');
    const { HELD, skinStep } = await load('/src/lib/three/held.js');
    const lib = { findBones, strideOf, HELD, skinStep };
    const rows = [];
    for (const e of await manifest(world, load)) {
      const doc = await read(e.file);
      const bytes = doc ? (await stat(pub(e.file))).size : 0;
      const clipDocs = {};
      if (doc) for (const [c, url] of Object.entries(e.clips ?? {})) clipDocs[c] = await read(url);
      rows.push(rowOf(e, { doc, bytes, clipDocs }, lib));
    }
    const md = table(rows, world);
    for (const [flag, body] of [
      ['--md', md],
      ['--json', JSON.stringify(rows, null, 1) + '\n'],
    ]) {
      const out = opt(flag);
      if (!out) continue;
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, body);
    }
    if (!opt('--md') && !opt('--json')) console.log(md);
    const bad = failing(rows, lib);
    for (const b of bad) console.error(`${b.name}: ${b.why}`);
    console.log(`${rows.length} figures, ${rows.filter((r) => r.warn.length).length} with warnings, ${bad.length} failing`);
    process.exitCode = bad.length ? 1 : 0;
  } finally {
    await vite.close();
  }
}

if (MAIN) await main();
