// The walkers' and the droideka's own clips, packed for the site: Star Wars
// Battlefront II (2017)'s animations for the rigs that are not a person's
// (the AT-AT, AT-ST, AT-TE, AT-RT and droideka, each its own skeleton), one
// GLB per rig under public/models/galaxy/bf2017/clips-<rig>.glb, holding
// exactly the clips src/lib/three/rigSets.js names for it. The game's clips
// play on the game's rig as they are: nothing is retargeted, no bone is
// renamed or pruned (src/lib/three/ownRig.js loads both).
//
// (Phase 1's scripts/bf2017-clips.mjs packs the people's clips on the shared
// humanoid; it was not on main when this lane began, so this is the rigs'
// --skeleton form beside it, to be folded into it: docs/superpowers/
// HANDOFF-bf2017.md, lane V.)
//
// Each clip is resampled to --fps (24), played in place (the trajectory's
// travel taken off and kept as `travel`, metres a cycle; its turn folded into
// the bones under it: scripts/lib/rig-clips.mjs), its helper channels dropped
// (the game's cameras, trajectory and future-foot targets), a channel that
// never leaves the skeleton's rest dropped and one held elsewhere two keys,
// then meshopt-compressed. The animation is named by the game's clip; its
// extras carry the site's name, `loop`, `travel`, `duration`, `fps`,
// `additive` and the game's `timeScale`.
//
//   node scripts/bf2017-rigclips.mjs --pack <rig> [--skeleton <skeleton path>] [--fps 24]
//     [--root lab/assets/bf2017] [--out public/models/galaxy/bf2017] [--anims <anims.jsonl>]
//
//   pack       a key of rigSets.js's RIGS (atat, atst, atte, atrt, droideka)
//   skeleton   the rig's skeleton in web/anims.jsonl (checked against RIGS)
//   root       where the fetch keeps the bucket: a clip not there is fetched,
//              with SUPABASE_URL and BF2017_KEY (or SUPA_KEY) in the environment
//
// It prints each clip's site name, the game's, its keys and the pack's bytes.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RIGS } from '../src/lib/three/rigSets.js';
import { parseArgs } from './lib/args.mjs';
import { isSequel, readManifest } from './lib/bf2017-manifest.mjs';
import { localPath, objectUrl } from './lib/bf2017-paths.mjs';
import { channelFate, folded, resample, travel } from './lib/rig-clips.mjs';
import { EVENT_RIGS } from '../src/lib/three/walrusSets/events.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRAJ = 'AITrajectory';
// the game's helpers no site code reads: the trajectory (measured, folded,
// dropped), its cameras, the IK's future-foot and connect targets
const DROP = /^(Reference|AITrajectory|Trajectory|TrajectoryEnd|CameraBase|CameraJoint|Connect|ConnectEnd|.*FootFuture|.*FutureFoot)$/;
const SIZE = { rotation: 4, translation: 3, scale: 3 };
const IDENTITY = {
  rotation: [0, 0, 0, 1],
  translation: [0, 0, 0],
  scale: [1, 1, 1],
};

async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
}

// a file from the bucket to disk, when it is not there yet
async function fetched(root, bucketPath) {
  const file = localPath(root, bucketPath);
  if (existsSync(file)) return file;
  const base = process.env.SUPABASE_URL;
  const key = process.env.BF2017_KEY || process.env.SUPA_KEY;
  if (!base || !key) throw new Error(`${bucketPath} is not on disk, and SUPABASE_URL and BF2017_KEY are not set to fetch it`);
  for (let i = 0; ; i++) {
    const res = await fetch(objectUrl(base, 'bf2017-assets', bucketPath), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).catch(() => null);
    if (res?.ok) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      return file;
    }
    if (res && res.status < 500) throw new Error(`${bucketPath}: missing from the bucket (${res.status})`);
    if (i >= 3) throw new Error(`${bucketPath}: the bucket did not answer`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
}

const restOf = (node, path) => (path === 'rotation' ? node.getRotation() : path === 'translation' ? node.getTranslation() : node.getScale());

// one clip's channels, in place and resampled: [{ node, path, times, values }]
export function clipChannels(anim, { fps, additive }) {
  const channels = anim.listChannels();
  const end = Math.max(...channels.map((c) => c.getSampler().getInput().getMax([])[0]));
  const traj = channels.find((c) => c.getTargetNode().getName() === TRAJ && c.getTargetPath() === 'rotation');
  const trajNode = channels.map((c) => c.getTargetNode()).find((n) => n.getName() === TRAJ);
  // (the trajectory's turn at its first key; additive clips are deltas and keep theirs)
  const q = !additive && traj ? Array.from(traj.getSampler().getOutput().getArray().slice(0, 4)) : [0, 0, 0, 1];
  const turned = Math.abs(q[3]) < 0.99999;
  const moved = channels.find((c) => c.getTargetNode().getName() === TRAJ && c.getTargetPath() === 'translation');
  const out = [];
  const seen = new Set();
  for (const c of channels) {
    const node = c.getTargetNode();
    const path = c.getTargetPath();
    if (DROP.test(node.getName()) || !SIZE[path]) continue;
    const s = c.getSampler();
    let values = s.getOutput().getArray();
    const under = trajNode && node.getParentNode?.() === trajNode;
    if (turned && under) values = folded(path, values, q);
    seen.add(`${node.getName()}.${path}`);
    out.push({
      node: node.getName(),
      path,
      ...resample(Array.from(s.getInput().getArray()), values, SIZE[path], fps, end),
    });
  }
  // a child of the turned trajectory with no channel of its own still needs
  // the turn: its rest, folded, held all through
  if (turned && trajNode)
    for (const child of trajNode.listChildren()) {
      if (DROP.test(child.getName())) continue;
      for (const path of ['rotation', 'translation']) {
        if (seen.has(`${child.getName()}.${path}`)) continue;
        const v = Array.from(folded(path, restOf(child, path), q));
        out.push({
          node: child.getName(),
          path,
          times: [0, end],
          values: [...v, ...v],
        });
      }
    }
  return {
    channels: out,
    end,
    travel: moved ? travel(moved.getSampler().getOutput().getArray()) : 0,
  };
}

export async function packRig(rig, { fps = 24, root, out, anims }) {
  // (a walker's, or a world's set piece: walrusSets/events.js)
  const spec = RIGS[rig] ?? EVENT_RIGS[rig];
  if (!spec) throw new Error(`--pack: ${rig}? (${[...Object.keys(RIGS), ...Object.keys(EVENT_RIGS)].join(', ')})`);
  if (isSequel(spec.skeleton)) throw new Error(`${spec.skeleton} is sequel-era; the site shows none of it`);
  const reader = await io();
  const byName = new Map([...anims.values()].map((e) => [e.name, e]));
  let pack = null;
  let bones = null;
  const said = [];
  for (const [site, game] of Object.entries(spec.set)) {
    const e = byName.get(game);
    if (!e) throw new Error(`${rig} ${site}: ${game} is not in web/anims.jsonl`);
    if (e.skeleton !== spec.skeleton) throw new Error(`${rig} ${site}: ${game} is on ${e.skeleton}, not ${spec.skeleton}`);
    const doc = await reader.read(await fetched(root, `web/${e.file}`));
    const anim = doc.getRoot().listAnimations()[0];
    const additive = Boolean(e.additive);
    const { channels, end, travel: metres } = clipChannels(anim, { fps, additive });
    if (!pack) {
      // the first clip's document is the pack: its nodes are the skeleton at
      // rest, which every clip of the rig shares
      pack = doc;
      anim.dispose();
      for (const a of pack.getRoot().listAnimations()) a.dispose();
      bones = new Map(
        pack
          .getRoot()
          .listNodes()
          .map((n) => [n.getName(), n]),
      );
    }
    const buffer = pack.getRoot().listBuffers()[0] ?? pack.createBuffer();
    const a = pack.createAnimation(game);
    let keys = 0;
    for (const ch of channels) {
      const node = bones.get(ch.node);
      if (!node) continue;
      const size = SIZE[ch.path];
      const rest = additive ? IDENTITY[ch.path] : restOf(node, ch.path);
      const fate = channelFate(ch.values, size, rest);
      if (fate === 'drop') continue;
      const times = fate === 'hold' ? [0, end] : ch.times;
      const values = fate === 'hold' ? [...ch.values.slice(0, size), ...ch.values.slice(0, size)] : ch.values;
      const input = pack.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
      const output = pack
        .createAccessor()
        .setType(size === 4 ? 'VEC4' : 'VEC3')
        .setArray(new Float32Array(values))
        .setBuffer(buffer);
      const sampler = pack.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
      a.addSampler(sampler).addChannel(pack.createAnimationChannel().setTargetNode(node).setTargetPath(ch.path).setSampler(sampler));
      keys += times.length;
    }
    a.setExtras({
      site,
      loop: /^(C|L|P)_/.test(game) || /^(idle|walk|run|strafe|roll|shock|fire)$/.test(site),
      travel: Number(metres.toFixed(3)),
      duration: Number(end.toFixed(4)),
      fps,
      additive,
      timeScale: e.timeScale ?? 1,
    });
    said.push(`  ${site.padEnd(14)} ${game.padEnd(44)} ${String(a.listChannels().length).padStart(3)} channels ${String(keys).padStart(5)} keys${metres ? `, ${metres.toFixed(2)} m` : ''}`);
  }
  // (the skeleton's own extras and the dropped helpers' nodes stay: the clips
  // name bones, and a figure's bones are its own file's)
  pack.getRoot().listScenes()[0].setName(`clips-${rig}`);
  await pack.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const file = join(out, `clips-${rig}.glb`);
  await mkdir(out, { recursive: true });
  await reader.write(file, pack);
  const bytes = (await stat(file)).size;
  for (const l of said) console.log(l);
  console.log(`${relative(ROOT, file)}  ${Object.keys(spec.set).length} clips, ${(bytes / 1024).toFixed(1)} KB`);
  return { file, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const rig = args.pack;
  if (typeof rig !== 'string') {
    console.error(`usage: node scripts/bf2017-rigclips.mjs --pack <${Object.keys(RIGS).join('|')}> [--skeleton <path>] [--fps 24]`);
    process.exit(1);
  }
  if (typeof args.skeleton === 'string' && RIGS[rig] && args.skeleton !== RIGS[rig].skeleton) {
    console.error(`--skeleton ${args.skeleton}: rigSets.js has ${rig} on ${RIGS[rig].skeleton}`);
    process.exit(1);
  }
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017'));
  const animsFile = resolve(args.anims ?? localPath(root, 'web/anims.jsonl'));
  if (!existsSync(animsFile)) await fetched(root, 'web/anims.jsonl');
  packRig(rig, {
    fps: Number(args.fps ?? 24),
    root,
    out: resolve(args.out ?? join(ROOT, 'public', 'models', 'galaxy', 'bf2017')),
    anims: readManifest(await readFile(animsFile, 'utf8')),
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
