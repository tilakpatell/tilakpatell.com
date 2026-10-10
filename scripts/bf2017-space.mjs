// The game's space levels as the space layer's set pieces (lane Q of the
// fifth design): each system's `SB_*` map (scripts/lib/bf2017-space.mjs's
// SPACE) read, its pieces gathered, each model made one file and the system's
// pack written. A capital's kit (the Star Destroyer's hull and its eighty
// parts) becomes one model in its hull's frame; the Fondor dry dock one about
// its middle; a corvette, a satellite, a piece of the Death Star's debris a
// model of its own. Every file is the game's: its parts at the first LOD the
// whole fits its cap in (CAPS), else its lightest and simplified to the cap,
// its maps the game's own KTX2 with their top levels dropped (the native
// rule), nothing re-encoded but a map the bucket has no KTX2 for. The far
// copy of a capital or a dock is scripts/galaxy-lod.mjs's (`space/<slug>`).
//
//   node scripts/bf2017-space.mjs <system|all> [--dry] [--only <slug>,…] [--root lab/assets/bf2017]
//
//   writes public/models/galaxy/space/<slug>.glb (published: scripts/assets-
//   publish.mjs walks the folder; the level's credit `space-<system>`) and
//   src/data/galaxy/space/<system>.json:
//     { system, map, title, centre, radius, models: { slug: { kind, as, size, url, far, from, tris } }, pieces }
//   then: node scripts/galaxy-lod.mjs space/<slug>… for the capitals and docks
//   --dry: the pieces and the cuts it would take, nothing fetched or written
//   --fleet <slug> --out <file>: that model alone at the fleet's cut (FLEET_CUT:
//   the war flies it at every quality level), to <file>, nothing else written
//   (scripts/bf2017-fleet.mjs's `space` rows)
//
// The map, its parts and their maps are fetched by scripts/bf2017-fetch.mjs
// (the keys from the environment, never printed). The import goes through
// bf2017-import.mjs's own readers (readLod, nativeMaps): lane O's
// bf2017-library-import.mjs was not on main when this was written.

import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, flatten, join, mergeDocuments, meshopt, metalRough, prune, textureCompress, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join as path, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { parseArgs } from './lib/args.mjs';
import { PERMISSION, nativeMaps, readLod } from './bf2017-import.mjs';
import { readMap } from './lib/bf2017-level.mjs';
import { readManifest } from './lib/bf2017-manifest.mjs';
import { inBucket, localPath } from './lib/bf2017-paths.mjs';
import { SPACE, piecesOf } from './lib/bf2017-space.mjs';
import { channelsOf } from './lib/bf2017-level-tracks.mjs';
import { atlasUVs } from './lib/bf2017-uv.mjs';
import { dressed } from './lib/bf2017-dressing.mjs';
import { writeCredit } from './lib/catalog-write.mjs';
import { bareWhereUntextured, simplified, triangles, unskinned } from './lib/surface-model.mjs';

const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const ROOT = path(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';

// a model's cap in triangles by its kind, its colour maps' and other maps'
// size, and whether it has a far copy (galaxy-lod.mjs's)
export const CAPS = {
  capital: { tris: 60000, tex: 512, maps: 256, far: true },
  dock: { tris: 90000, tex: 512, maps: 256, far: true },
  station: { tris: 12000, tex: 512, maps: 256, far: false },
  backdrop: { tris: 6000, tex: 512, maps: 256, far: false },
  rock: { tris: 600, tex: 256, maps: 256, far: false },
};

// the war's capitals are loaded at every quality level: lighter
export const FLEET_CUT = { tris: 24000, tex: 256, maps: 128, far: false };

// (a capital's cap by its length: the Star Destroyer's 1,600 m the whole
// 60,000, a corvette's 130 m no less than 8,000)
export const capOf = (model) => (model.kind === 'capital' ? { ...CAPS.capital, tris: Math.round(Math.min(1, Math.max(8000 / 60000, model.size / 1600)) * 60000) } : CAPS[model.kind]);

// the LOD the whole model takes: the first whose parts together fit the
// cap, else the lightest (and simplified after)
export function lodFor(parts, entries, cap) {
  const levels = Math.max(...parts.map((p) => entries.get(p.file)?.lods.length ?? 1));
  const at = (L) => parts.reduce((t, p) => t + (lodOf(entries.get(p.file), L)?.triangles ?? 0), 0);
  for (let L = 0; L < levels; L++) if (at(L) <= cap) return { lod: L, tris: at(L) };
  return { lod: levels - 1, tris: at(levels - 1) };
}
const lodOf = (entry, L) => (entry ? (entry.lods.find((l) => l.lod === L) ?? entry.lods[entry.lods.length - 1]) : null);
const nameOf = (file) => file.replace(/^models\//, '').replace(/\.glb$/, '');

async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

const fetch = (args) => execFileSync('node', ['scripts/bf2017-fetch.mjs', ...args], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });

// one model: each distinct part read once (its maps found, its UV set and
// decals the game's), then placed wherever the model has it
async function build(reader, model, entries, cut, cap, opts, file = path(ROOT, 'public/models/galaxy/space', `${model.slug}.glb`)) {
  const out = new Document();
  const scene = out.createScene(model.slug);
  out.getRoot().setDefaultScene(scene);
  const said = { found: new Set(), missing: new Set() };
  const templates = new Map(); // file → [{ mesh, matrix }]
  for (const file of new Set(model.parts.map((p) => p.file))) {
    const entry = entries.get(file);
    const lod = lodOf(entry, cut);
    if (!lod || !existsSync(localPath(opts.root, inBucket(lod.file)))) {
      console.log(`  not fetched: ${file} LOD${cut}`);
      continue;
    }
    const doc = await readLod(reader, lod.file, { root: opts.root, derived: entry.derived, unpackDir: path(opts.root, 'unpacked'), said });
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();
    await doc.transform(atlasUVs(), dressed({ sharp }), dequantize(), unskinned(), metalRough(), prune(), bareWhereUntextured(), weld(), flatten(), join({ keepNamed: false }));
    const map = mergeDocuments(out, doc);
    const list = [];
    for (const s of doc.getRoot().listScenes()) {
      const theirs = map.get(s);
      theirs.traverse((n) => {
        if (n.getMesh()) list.push({ mesh: n.getMesh(), matrix: new THREE.Matrix4().fromArray(n.getWorldMatrix()) });
      });
      for (const c of theirs.listChildren()) c.dispose();
      theirs.dispose();
    }
    templates.set(file, list);
  }
  const m = new THREE.Matrix4();
  for (const part of model.parts) {
    m.compose(new THREE.Vector3(...part.at), new THREE.Quaternion(...part.quaternion), new THREE.Vector3(...part.scale));
    for (const t of templates.get(part.file) ?? []) {
      const node = out.createNode().setMesh(t.mesh).setMatrix(m.clone().multiply(t.matrix).toArray());
      scene.addChild(node);
    }
  }
  await out.transform(unpartition(), dedup(), flatten(), join({ keepNamed: false }), weld(), prune());
  if (triangles(out) > cap.tris * 1.1) await out.transform(simplified(cap.tris));
  const native = await nativeMaps(out, { root: opts.root, tex: cap.tex, maps: cap.maps });
  await out.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', formats: /png|jpeg|webp/, slots: /baseColor|emissive/, resize: [cap.tex, cap.tex], quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', formats: /png|jpeg|webp/, slots: /normal|occlusion|metallicRoughness/, resize: [cap.maps, cap.maps], quality: 80 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16 }),
  );
  await mkdir(dirname(file), { recursive: true });
  await reader.write(file, out);
  for (const f of said.missing) console.log(`  missing: ${f}`);
  return { file, bytes: (await stat(file)).size, tris: Math.round(triangles(out)), native, maps: out.getRoot().listTextures().length, draws: out.getRoot().listMeshes().reduce((n, x) => n + x.listPrimitives().length, 0) };
}

export async function makeSpace(system, opts) {
  const space = SPACE[system];
  if (!space) throw new Error(`${system}: not a system with a space map (${Object.keys(SPACE).join(', ')})`);
  const base = localPath(opts.root, `web/maps/${space.map}`);
  if (!existsSync(`${base}.bin`) && !opts.dry) fetch(['--folder', `maps/${dirname(space.map)}/*`]);
  const map = readMap(JSON.parse(await readFile(`${base}.json`, 'utf8')), await readFile(`${base}.bin`));
  const { centre, radius, models, pieces, dropped } = piecesOf(map, { system });
  const entries = new Map([...opts.manifest.values()].map((e) => [e.file, e]));
  console.log(`${system}: ${pieces.length} pieces of ${Object.keys(models).length} models about [${centre}], ${radius} units across the middle; left out ${JSON.stringify(dropped)}`);
  const reader = await io();
  if (opts.fleet) {
    const model = models[opts.fleet];
    if (!model) throw new Error(`${opts.fleet}: no such model in ${system}'s level (${Object.keys(models).join(', ')})`);
    const { lod } = lodFor(model.parts, entries, FLEET_CUT.tris);
    for (const file of new Set(model.parts.map((p) => p.file))) {
      const l = lodOf(entries.get(file), lod);
      if (l && !existsSync(localPath(opts.root, inBucket(l.file)))) fetch([nameOf(file), '--lod', String(l.lod)]);
    }
    const made = await build(reader, { ...model, slug: opts.fleet }, entries, lod, FLEET_CUT, opts, resolve(opts.out));
    console.log(`  ${opts.fleet} at the fleet's cut: ${(made.bytes / 1024).toFixed(0)} KB, ${made.tris} triangles → ${opts.out}`);
    return made;
  }
  const rows = {};
  for (const [slug, model] of Object.entries(models)) {
    const cap = capOf(model);
    const { lod, tris } = lodFor(model.parts, entries, cap.tris);
    const n = pieces.filter((p) => p.model === slug).length;
    const url = `/models/galaxy/space/${slug}.glb`;
    // (`from`: the drop's models it's made of, for the coverage ledger: scripts/bf2017-coverage.mjs)
    rows[slug] = { kind: model.kind, as: model.as ?? slug, size: model.size, url, far: cap.far ? `/models/galaxy/space/${slug}.far.glb` : null, from: [...new Set(model.parts.map((p) => nameOf(p.file)))].sort() };
    console.log(`  ${slug}: ${model.kind}, ${model.parts.length} parts, ×${n}, LOD${lod} ${tris} triangles${tris > cap.tris ? ` (simplified to ${cap.tris})` : ''}`);
    if (opts.dry || (opts.only && !opts.only.has(slug))) continue;
    for (const file of new Set(model.parts.map((p) => p.file))) {
      const l = lodOf(entries.get(file), lod);
      if (l && !existsSync(localPath(opts.root, inBucket(l.file)))) fetch([nameOf(file), '--lod', String(l.lod)]);
    }
    const made = await build(reader, { ...model, slug }, entries, lod, cap, opts);
    rows[slug].tris = made.tris;
    console.log(`    ${(made.bytes / 1024).toFixed(0)} KB, ${made.tris} triangles, ${made.draws} draws, ${made.maps} maps (${made.native} the game's KTX2)`);
  }
  if (opts.dry) return;
  // (one credit a level, for its folder: scripts/assets-publish.mjs publishes
  // what's under it, and the system's panel shows it)
  await writeCredit(path(ROOT, 'src/data/modelCredits.json'), `space-${system}`, {
    title: `Star Wars Battlefront II (2017): ${space.map.split('/').pop()}, its ${Object.values(models).filter((m) => m.kit).map((m) => m.as).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'set pieces'} and the rest it places`,
    author: 'EA DICE',
    authorUrl: GAME,
    license: 'permission',
    licenseUrl: GAME,
    source: GAME,
    where: 'galaxy',
    as: `${space.title}: the game's space level`,
    paths: ['public/models/galaxy/space/'],
    permission: PERMISSION,
  });
  const json = { system, map: space.map, title: space.title, centre, radius, models: rows, pieces };
  const out = path(ROOT, 'src/data/galaxy/space', `${system}.json`);
  await mkdir(dirname(out), { recursive: true });
  // (a piece a line: the debris field is two thousand of them)
  const text = JSON.stringify({ ...json, pieces: [] }, null, 1).replace('"pieces": []', `"pieces": [\n${pieces.map((p) => JSON.stringify(p)).join(',\n')}\n]`);
  await writeFile(out, `${text}\n`);
  console.log(`  ${out.slice(ROOT.length + 1)}`);
}

// the game's three asteroid tracks (the rocks turn on them: galaxy/
// rocksPlaced.js), by size: src/data/galaxy/space/tracks.json
export async function writeTracks(root) {
  const out = {};
  for (const size of ['large', 'medium', 'small']) {
    const dir = localPath(root, `web/animtracks/a3/objects/props/objectsets/_generic/asteroid_${size}_01/animtrackdata`);
    if (!existsSync(dir)) fetch(['web', 'animtracks/**']);
    const file = (await readdir(dir)).find((f) => f.endsWith('.json'));
    const track = JSON.parse(await readFile(path(dir, file), 'utf8'));
    out[size] = channelsOf(track.name, track.keys).map((c) => ({ ...c, loop: true }));
    (out.from ??= {})[size] = track.name;
  }
  const file = path(ROOT, 'src/data/galaxy/space/tracks.json');
  await mkdir(dirname(file), { recursive: true });
  const line = (c) => `  ${JSON.stringify(c)}`;
  const tracks = Object.entries(out).filter(([k]) => k !== 'from');
  await writeFile(file, `{\n${tracks.map(([k, cs]) => ` "${k}": [\n${cs.map(line).join(',\n')}\n ]`).join(',\n')},\n "from": ${JSON.stringify(out.from)}\n}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? path(ROOT, 'lab', 'assets', 'bf2017'));
  if (!existsSync(localPath(root, 'web/models.jsonl'))) fetch(['manifest']);
  const manifest = readManifest(await readFile(localPath(root, 'web/models.jsonl'), 'utf8'));
  const which = args._[0] === 'all' || !args._[0] ? Object.keys(SPACE) : String(args._[0]).split(',');
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  if (!args.dry && !args.fleet) await writeTracks(root);
  if (args.fleet && !args.out) throw new Error('--fleet <slug> --out <file>');
  for (const system of which) await makeSpace(system, { root, manifest, dry: Boolean(args.dry), only, fleet: args.fleet ? String(args.fleet) : null, out: args.out ? String(args.out) : null });
}
