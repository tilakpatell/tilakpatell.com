// The game's own clips, packed for the site: Star Wars Battlefront II
// (2017)'s animations, one glTF per clip in the bf2017-assets bucket
// (web/anims/, listed in web/anims.jsonl), all on the one humanoid
// skeleton every 2017 person shares (Walrus_HumanMale), gathered into one
// GLB per pack under the site's own clip names: a generic humanoid pack
// everyone walks on, and one per hero with its strikes, blocks, staggers,
// dodges and its own walk. Packs, not per-figure bakes: the clips are the
// game's, made on the game's rig, so they play on any 2017 body by bone
// name as they are, with nothing retargeted (src/lib/three/walrus.js). The
// names are src/lib/three/walrusClips.js's map.
//
// Each clip is resampled to --fps (24: the site's animator steps a tenth of
// a second at most, and 24 holds a stroke's arc), its root motion taken off
// (the game moves the figure by AITrajectory, the node above the hips; the
// site moves it itself, so the clip plays in place) and kept instead as
// `root` ([[t, dx, dz]…], metres, +z ahead and +x to the figure's left,
// ual-bake.mjs's rootTravel) with `rootHips` (the hips' height over the
// toes it was measured at), and a stroke's `contact` ([t0, t1]: the window
// the stroke tables time it by, scripts/lib/bf2017-strokes.mjs's measure, on
// the game's clip as it comes, before the resample, at the measure's own 30
// a second whatever --fps is: the blade's tip a metre up the Wep_Root
// socket's +y, carried by the root's travel, counted only before the hips
// along +z and never inside the clip's first key, the guard's snap) put in
// the animation's extras, which the site reads as clip.userData. The
// channels of the game's camera and trajectory helpers go, and so does a
// bone's that holds the skeleton's rest all through (a third of each clip's:
// the loader puts rest back for any bone another clip of the pack moves, so
// none is left where the last clip put it); a bone held anywhere else is two
// keys. A clip's channels share its times. Then meshopt, with its animation
// quantisation.
//
//   node scripts/bf2017-clips.mjs <pack> [--fps 24] [--only <site name>,…]
//   node scripts/bf2017-clips.mjs --scene <id> [--cast <role>=<game clip>,…]   (scenes/<id>.glb)
//   node scripts/bf2017-clips.mjs --census   (docs/superpowers/evidence/bf2017-coverage/clips.md)
//     [--out public/models/galaxy/bf2017] [--root lab/assets/bf2017] [--skeleton public/models/galaxy/bf2017/walrus.glb]
//
//   pack      a key of walrusClips.js's PACKS (humanoid, luke, vader, obiwan…,
//             or an own rig's: b1, b2, droideka, ewok, astromech, probe,
//             tauntaun, whose clips come from that rig's skeleton alone and
//             whose skeleton is read from its imported body's light cut)
//   only      just these site names (a test's, or a re-pack of a few)
//   root      where the fetch keeps the bucket (a clip not there is fetched,
//             with SUPABASE_URL and BF2017_KEY or SUPA_KEY in the environment)
//
// It prints each clip's site name, the game's, its frames and bytes, the
// pack's total, and every site name the game had nothing for (the loader
// plays walrusRig.js's CLIP_FALLBACK for those). It refuses a sequel-era pack.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { OWN_RIGS, PACKS, PACK_OPTS, candidates } from '../src/lib/three/walrusClips.js';
import { parseArgs } from './lib/args.mjs';
import { RIGS } from '../src/lib/three/rigSets.js';
import { EVENT_RIGS } from '../src/lib/three/walrusSets/events.js';
import { animEntry, animPath } from './lib/bf2017-anims.mjs';
import { censusMarkdown, censusRows } from './lib/bf2017-clip-census.mjs';
import { isSequel, readManifest } from './lib/bf2017-manifest.mjs';
import { clipOf, measure, rigOf } from './lib/bf2017-strokes.mjs';
import { rootTravel } from './ual-bake.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// the game's helpers no site code reads: the trajectory the game moves the
// figure by (measured, then dropped), its cameras, its ground and aim targets
const DROP = /^(AITrajectory|Trajectory|TrajectoryEnd|CameraBase|CameraJoint|Camera3pDefPos_Rig|Camera3p_Rig|TrajChildDummy|TrajChildDummyCam|Wep_Aim_Target_Rig|Connect|ConnectEnd|Ground)$/;
const TRAJ = 'AITrajectory';
// the skeletons a pack takes clips from: the humanoid's, and the cinematics'
// (the same rig at the same rest, with a few more physics bones; it holds
// Luke's block swings, which the humanoid's set hasn't), never the first
// person's or another rig's
const SKELETONS = /\/(Walrus_HumanMale|Walrus_NIS_S0800_Skeleton)$/;
// the skeleton a pack's clips must be on: an own rig's (walrusClips.js's
// OWN_RIGS: the B1's D_Assault_Preq_01_Ske…) for its pack, else the humanoid's
export const skeletonsFor = (pack) => (PACK_OPTS[pack]?.skeletons ? new RegExp(PACK_OPTS[pack].skeletons) : OWN_RIGS[pack] ? new RegExp(`/${OWN_RIGS[pack].skeleton}$`) : SKELETONS);
// the file a pack reads its skeleton from: the humanoid's own, or an own
// rig's body as imported (its light cut, which is committed; its meshes are
// taken off before the pack is written)
// (a small creature's light cut may not exist: its plain one, then)
export const skeletonFileFor = (pack, root) => {
  if (!OWN_RIGS[pack]) return join(root, 'public', 'models', 'galaxy', 'bf2017', 'walrus.glb');
  const crew = join(root, 'public', 'models', 'galaxy', 'bf2017', 'crew', OWN_RIGS[pack].body);
  return existsSync(`${crew}.lod1.glb`) || !existsSync(`${crew}.glb`) ? `${crew}.lod1.glb` : `${crew}.glb`;
};
// the game's clips a pack takes: an additive one only into a pack made of them
export const takes = (pack, e) => Boolean(e) && !isSequel(e.name) && skeletonsFor(pack).test(e.skeleton ?? '') && Boolean(e.additive) === Boolean(PACK_OPTS[pack]?.additive);

// every game clip the site's packs carry: each site name's first spelling
// the drop has on the pack's skeleton (as makePack picks it), and every
// walker's and droid's (rigSets.js, bf2017-rigclips.mjs's packs)
export function usedSources(anims) {
  const used = new Set();
  for (const [pack, map] of Object.entries(PACKS))
    for (const site of Object.keys(map)) {
      const e = candidates(map, site)
        .map((g) => animEntry(anims, g))
        .find((x) => takes(pack, x));
      if (e) used.add(e.name);
    }
  for (const r of [...Object.values(RIGS), ...Object.values(EVENT_RIGS)]) for (const g of Object.values(r.set)) if (animEntry(anims, g)) used.add(animEntry(anims, g).name);
  return used;
}

async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// ── a channel at another rate ──

// a channel's values at `fps` from 0 to its end (the end itself always a
// key): linear for positions, slerp for turns, the last value held past
// the channel's end; a constant channel two keys
export function resampleChannel(times, values, size, fps, end) {
  // (up, so an end between two frames is still a key: rounded down, the last half frame went)
  const n = Math.max(1, Math.ceil(end * fps - 1e-6));
  const out = { times: [], values: [] };
  const constant = values.every((v, i) => Math.abs(v - values[i % size]) < 1e-6);
  const at = constant ? [0, end] : Array.from({ length: n + 1 }, (_, i) => Math.min(end, i / fps));
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  for (const t of at) {
    let k = 0;
    while (k < times.length - 2 && times[k + 1] < t) k++;
    const t0 = times[k];
    const t1 = times[Math.min(k + 1, times.length - 1)];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    const a = values.slice(k * size, k * size + size);
    const b = values.slice(Math.min(k + 1, times.length - 1) * size, Math.min(k + 1, times.length - 1) * size + size);
    out.times.push(t);
    if (size === 4) {
      qa.fromArray(a).slerp(qb.fromArray(b), f);
      out.values.push(qa.x, qa.y, qa.z, qa.w);
    } else out.values.push(...a.map((v, i) => v + (b[i] - v) * f));
  }
  return out;
}

const SIZES = { translation: 3, rotation: 4, scale: 3 };

// the hips' height over the toes at rest (game metres)
function restHips(skel) {
  const { scene, objs } = skel;
  // (a rig with no toes by those names, a droid's or a beast's: none)
  if (!objs.get('Hips') || !objs.get('LeftToeBase') || !objs.get('RightToeBase')) return null;
  scene.updateMatrixWorld(true);
  const y = (n) => objs.get(n).getWorldPosition(new THREE.Vector3()).y;
  return +(y('Hips') - Math.min(y('LeftToeBase'), y('RightToeBase'))).toFixed(4);
}

// a channel that holds its node's rest all through (nothing to send)
const REST = { translation: (n) => n.getTranslation(), rotation: (n) => n.getRotation(), scale: (n) => n.getScale() };
export function atRest(node, path, values) {
  const rest = REST[path](node);
  const size = rest.length;
  for (let i = 0; i < values.length; i += size) {
    // (a turn and its negation are the same turn)
    const d = (sign) => Math.max(...rest.map((r, k) => Math.abs(values[i + k] - sign * r)));
    if (Math.min(d(1), size === 4 ? d(-1) : Infinity) > 1e-4) return false;
  }
  return true;
}

// an additive channel that adds nothing all through (the identity turn, no move)
export function atIdentity(path, values) {
  const size = SIZES[path];
  const id = size === 4 ? [0, 0, 0, 1] : [0, 0, 0];
  for (let i = 0; i < values.length; i += size) {
    const d = (sign) => Math.max(...id.map((r, k) => Math.abs(values[i + k] - sign * r)));
    if (Math.min(d(1), size === 4 ? d(-1) : Infinity) > 1e-4) return false;
  }
  return true;
}

// ── one clip, read ──

// its channels by node name, the trajectory's kept apart; `timed`, the clip
// as the stroke tables read it (lib/bf2017-strokes.mjs's clipOf), for a
// stroke's window
async function readClip(rw, file) {
  const doc = await rw.read(file);
  const [anim] = doc.getRoot().listAnimations();
  if (!anim) throw new Error(`${file}: no animation`);
  const channels = [];
  let traj = null;
  let end = 0;
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode()?.getName();
    const path = ch.getTargetPath();
    if (!node || !SIZES[path]) continue;
    const s = ch.getSampler();
    const times = Array.from(s.getInput().getArray());
    const values = Array.from(s.getOutput().getArray());
    end = Math.max(end, times[times.length - 1] ?? 0);
    const c = { node, path, times, values };
    if (node === TRAJ && path === 'translation') traj = c;
    if (!DROP.test(node)) channels.push(c);
  }
  return { name: anim.getName(), channels, traj, end, extras: anim.getExtras(), timed: clipOf(anim) };
}

// ── the pack ──

export async function makePack(pack, { fps = 24, only = null, out, root, skeleton, fetchClip = null, log = console.log } = {}) {
  if (isSequel(pack)) throw new Error(`${pack} is sequel-era; the site shows none of it`);
  const map = PACKS[pack];
  if (!map) throw new Error(`${pack}: no such pack (${Object.keys(PACKS).join(', ')})`);
  const additive = Boolean(PACK_OPTS[pack]?.additive);
  const rw = await io();
  const anims = readManifest(await readFile(join(root, 'web', 'anims.jsonl'), 'utf8'));
  const doc = await rw.read(skeleton);
  // (an own rig's skeleton comes in its body: the meshes go, the bones stay)
  for (const n of doc.getRoot().listNodes()) n.setMesh(null).setSkin(null);
  for (const x of [...doc.getRoot().listMeshes(), ...doc.getRoot().listSkins(), ...doc.getRoot().listMaterials(), ...doc.getRoot().listTextures()]) x.dispose();
  const skel = rigOf(doc);
  const rootHips = restHips(skel);
  const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const names = Object.keys(map).filter((n) => !only || only.includes(n));
  const made = [];
  const none = [];
  // (a game clip two site names share is packed once; the other is an alias,
  // in the scene's extras, which the loader reads)
  const aliases = {};
  const packed = new Map(); // game name → site name
  for (const site of names) {
    // the first spelling the game has, on disk or fetched
    let file = null;
    let game = null;
    for (const g of candidates(map, site)) {
      const e = animEntry(anims, g);
      if (!takes(pack, e)) continue;
      const f = join(root, animPath(e));
      if (!existsSync(f) && fetchClip) await fetchClip(e.name);
      if (existsSync(f)) {
        file = f;
        game = e.name;
        break;
      }
    }
    if (!file) {
      none.push(site);
      continue;
    }
    if (packed.has(game)) {
      aliases[site] = packed.get(game);
      continue;
    }
    packed.set(game, site);
    const clip = await readClip(rw, file);
    const end = clip.end;
    const anim = doc.createAnimation(site);
    let keys = 0;
    // (one input a key count: every channel is on the same grid, or two keys)
    const inputs = new Map();
    const inputOf = (times) => {
      if (!inputs.has(times.length)) inputs.set(times.length, doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer));
      return inputs.get(times.length);
    };
    for (const c of clip.channels) {
      const node = nodes.get(c.node);
      if (!node) continue;
      const r = resampleChannel(c.times, c.values, SIZES[c.path], fps, end);
      if (additive ? atIdentity(c.path, r.values) : atRest(node, c.path, r.values)) continue;
      keys += r.times.length;
      const input = inputOf(r.times);
      const output = doc
        .createAccessor()
        .setType(SIZES[c.path] === 4 ? 'VEC4' : 'VEC3')
        .setArray(new Float32Array(r.values))
        .setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(c.path).setSampler(sampler));
    }
    // (`source` the game's own name for the clip, exactly, for the combat
    // that reads the game's logic by it; the credit is the pack's, in
    // public/games/credits.json)
    const extras = { source: game, fps, loop: Boolean(clip.extras?.loop) };
    // (an additive's deltas are laid over a pose, never played as one: lib/three/additiveLayer.js)
    if (additive) extras.additive = true;
    if (clip.traj && !additive) {
      const rows = clip.traj.times.map((t, i) => ({ t, at: clip.traj.values.slice(i * 3, i * 3 + 3) }));
      // (at the pack's rate: a row every 1/fps)
      const step = Math.max(1, Math.round(rows.length / Math.max(1, end * fps)));
      const travel = rootTravel(rows.filter((_, i) => i % step === 0 || i === rows.length - 1));
      if (travel.some(([, x, z]) => Math.hypot(x, z) > 0.01)) {
        extras.root = travel;
        if (rootHips != null) extras.rootHips = rootHips;
      }
    }
    // (timed as the stroke tables are, on the game's own keys at the
    // measure's own rate, not --fps's: a pack's window is its table's)
    if (!additive && site.startsWith('sword.') && !site.endsWith('.rec')) extras.contact = measure(clip.timed, skel).contact;
    anim.setExtras(extras);
    made.push({ site, game, frames: Math.round(end * fps) + 1, keys, duration: end });
  }
  doc.getRoot().listScenes()[0].setExtras({ pack, aliases });
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  // (a scene's to scenes/<id>.glb: lib/three/scenePlayer.js's scenePath)
  const scene = PACK_OPTS[pack]?.scene;
  const file = scene ? join(out, 'scenes', `${scene}.glb`) : join(out, `clips-${pack}.glb`);
  await mkdir(dirname(file), { recursive: true });
  await rw.write(file, doc);
  const bytes = (await stat(file)).size;
  for (const m of made) log(`${m.site.padEnd(22)} ${m.game.padEnd(50)} ${String(m.frames).padStart(4)} frames`);
  for (const [a, b] of Object.entries(aliases)) log(`${a.padEnd(22)} = ${b}`);
  log(`${relative(ROOT, file)}: ${made.length} clips at ${fps} fps, ${(bytes / 1024).toFixed(1)} KB`);
  if (none.length) log(`nothing in the game for: ${none.join(', ')} (the loader's fallback plays for these)`);
  return { file, bytes, made, none, aliases };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [pack] = args._;
  if (args.census) {
    const { writeFile } = await import('node:fs/promises');
    const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
    const anims = readManifest(await readFile(join(root, 'web', 'anims.jsonl'), 'utf8'));
    const rows = censusRows(anims, usedSources(anims));
    const file = join(ROOT, 'docs', 'superpowers', 'evidence', 'bf2017-coverage', 'clips.md');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, censusMarkdown(rows, { date: new Date().toISOString().slice(0, 10) }));
    console.log(`${relative(ROOT, file)}: ${Object.entries(rows.totals).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    process.exit(0);
  }
  // --scene <id> [--cast role=clip,…]: a scene's pack (walrusSets/scenes.js's, or one cast here)
  if (typeof args.scene === 'string') {
    if (typeof args.cast === 'string') {
      PACKS[`scene-${args.scene}`] = Object.fromEntries(args.cast.split(',').map((rc) => rc.split('=')));
      PACK_OPTS[`scene-${args.scene}`] = { scene: args.scene };
    }
    args._[0] = `scene-${args.scene}`;
  }
  if (!args._[0]) {
    console.error(`usage: node scripts/bf2017-clips.mjs <pack> [--fps 24] [--only a,b] (packs: ${Object.keys(PACKS).join(', ')})`);
    process.exit(1);
  }
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  // (the network only for a clip not on disk: the fetch's, keys from the environment)
  const fetchClip = async (name) => {
    const { anims } = await import('./bf2017-fetch.mjs');
    const manifest = readManifest(await readFile(join(root, 'web', 'anims.jsonl'), 'utf8'));
    await anims.fetch(null, root, manifest, name);
  };
  await makePack(args._[0], {
    fps: Number(args.fps ?? 24),
    only: typeof args.only === 'string' ? args.only.split(',') : null,
    out: resolve(args.out ?? join(ROOT, 'public', 'models', 'galaxy', 'bf2017')),
    root,
    skeleton: resolve(args.skeleton ?? skeletonFileFor(pack, ROOT)),
    fetchClip,
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
