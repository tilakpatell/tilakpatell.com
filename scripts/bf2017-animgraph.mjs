// The soldiers' animation graph from the 2017 drop's clips: writes
// src/data/bf2017/animgraph.json (scripts/lib/bf2017-animgraph.mjs builds
// it), each state of src/lib/battlefront/animgraph.js's machine as the
// game's clip per skeleton and stance, every locomotion clip's travel read
// from its own AITrajectory and every jump's take-off and landing from its
// own Hips, so the blend space plays each cycle at the speed it was made
// for. It reads the clips' files under --root (web/anims/, uncompressed on
// the owner's machine); nothing is fetched.
//
//   node scripts/bf2017-animgraph.mjs --root C:/Users/tilak/Downloads/BF2_Extract/web [--out src/data/bf2017/animgraph.json]
//
// Then the clips no published pack carries are packed (bf2017-clips.mjs
// --graph graph and graph-add) and published (assets-publish.mjs --only
// 'models/galaxy/bf2017/clips-graph*.glb').

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, PACK_OPTS } from '../src/lib/three/walrusClips.js';
import { parseArgs } from './lib/args.mjs';
import { RIGS, SLOTS, buildGraph, carriersOf, jumpMarkers, needsMeasure, pick, travelOf } from './lib/bf2017-animgraph.mjs';
import { readManifest } from './lib/bf2017-manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

// the skeletons a pack's clips are on (bf2017-clips.mjs's skeletonsFor, without its imports)
const HUMAN = /\/(Walrus_HumanMale|Walrus_NIS_S0800_Skeleton)$/;
const OWN = { b1: /\/D_Assault_Preq_01_Ske$/, b2: /\/B2_01_Ske$/ };

async function measurer(root) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return async (e) => {
    const file = join(root, e.file.replace(/^web\//, ''));
    if (!existsSync(file)) return null;
    const doc = await io.read(file);
    const [anim] = doc.getRoot().listAnimations();
    if (!anim) return null;
    let traj = null;
    let hips = null;
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode()?.getName();
      if (ch.getTargetPath() !== 'translation') continue;
      const t = ch.getSampler().getInput().getArray();
      const v = ch.getSampler().getOutput().getArray();
      if (node === 'AITrajectory') traj = Array.from(t, (x, i) => [x, v[i * 3], v[i * 3 + 2]]);
      if (node === 'Hips') hips = Array.from(t, (x, i) => [x, v[i * 3 + 1]]);
    }
    const m = travelOf(traj) ?? {};
    return { ...m, markers: jumpMarkers(hips) };
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? join(ROOT, 'lab', 'assets', 'bf2017', 'web'));
  const out = resolve(args.out ?? join(ROOT, 'src', 'data', 'bf2017', 'animgraph.json'));
  const anims = readManifest(await readFile(join(root, 'anims.jsonl'), 'utf8'));
  const soldier = await readJson('src/data/bf2017/physics/soldier.json');
  const weapons = (await readJson('src/data/bf2017/weapons.json')).rows;
  const abilities = (await readJson('src/data/bf2017/abilities.json')).rows;
  const held = (await readJson('src/data/bf2017/held.json')).rows;

  // the published packs a figure loads, as the packer took them
  const packs = {};
  for (const [pack, set] of Object.entries(PACKS)) {
    if (!['humanoid', 'npc', 'stance-t', 'stance-p', 'stance-l', 'additive', 'b1', 'b2'].includes(pack)) continue;
    packs[pack] = { set, skeletons: OWN[pack] ?? HUMAN, additive: Boolean(PACK_OPTS[pack]?.additive) };
  }
  const carriers = carriersOf(packs, anims);

  // the clips measured: every cycle's travel, every jump's marks
  const measure = await measurer(root);
  const measured = new Map();
  for (const [rig, R] of Object.entries(RIGS))
    for (const st of R.stances)
      for (const slot of Object.keys(SLOTS)) {
        if (!needsMeasure(slot)) continue;
        const e = pick(anims, slot, rig, st);
        if (e && !measured.has(e.name)) measured.set(e.name, await measure(e));
      }

  const heroSets = Object.fromEntries(['luke', 'vader', 'obiwan', 'anakin', 'maul', 'dooku', 'palpatine', 'chewie', 'bobafett', 'bossk', 'han', 'leia', 'lando'].map((h) => [h, PACKS[h]]));
  const graph = buildGraph({
    anims,
    measure: (e) => measured.get(e.name) ?? null,
    records: { physics: soldier.rows[soldier.default], weapons, abilities, heroSets, stanceOf: (id) => held[id]?.stance ?? 't' },
    carriers,
    date: new Date().toISOString().slice(0, 10),
  });
  await writeFile(out, `${JSON.stringify(graph, null, 1)}\n`);
  const count = (o) => Object.keys(o).length;
  for (const [rig, sk] of Object.entries(graph.skeletons)) console.log(`${rig}: ${Object.entries(sk.stances).map(([st, s]) => `${st} ${count(s.states)} states`).join(', ')}`);
  console.log(`packs: graph ${count(graph.packs.graph)} clips, graph-add ${count(graph.packs['graph-add'])}; weapons ${count(graph.weapons)}, abilities ${count(graph.abilities)}`);
  if (graph.missing.length) console.log(`no clip for: ${graph.missing.join(', ')}`);
  console.log(`${relative(ROOT, out)}: ${(JSON.stringify(graph).length / 1024).toFixed(1)} KB`);
}
