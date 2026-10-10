// The space layer's fleets on the game's ships: the files galaxy/models.js
// already names for its fighters and capitals (each with the way its nose
// comes, `nose`), written again from Star Wars Battlefront II (2017)'s
// models, so every row, rule and test of the space layer stands as it is and
// only what it draws changes. A fighter takes its light cut (the import's
// .lod1: the game's LOD under 7,000 triangles, maps at half size), a capital
// the cut the row's size asks; each turned so the row's `nose` brings it to
// +z, and its credit made the game's. The far-off copies are then made from
// the new files by scripts/galaxy-lod.mjs, as every ship's is.
//
//   node scripts/bf2017-fleet.mjs [file,file…] [--dry]
//
// The close-up Star Destroyer and Nebulon-B (galaxy/models.js's HQ) stay
// Daniel Andersson's, about 100,000 triangles each against the game's 16,000
// backdrop ships, and the Mon Calamari cruiser its Sketchfab one, against the
// game's smooth backdrop MC80: the sheet shows the game's the poorer
// (all four are the space battles' far backdrops in the game)
// (docs/superpowers/evidence/bf2017-vehicles/fleet.webp). The corvette and
// the interceptor are the galaxy's Meshy remakes, whose
// test (galaxy/models.test.js's REMADE) holds them to Meshy, so they stay;
// the X-wing the galaxy flies is gen3d's, its MADE row, likewise.

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { PERMISSION } from './bf2017-import.mjs';
import { writeCredit } from './lib/catalog-write.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';

// [the galaxy's file (under public/models/galaxy/), its row's nose, the
// credit's key, the source: a lane V surface kind's light cut, or a model
// of the drop's with the cut to take]
export const FLEET = [
  ['tie', 0, 'galaxy-tie', { kind: 'tiefighter' }],
  ['tiebomber', 0, 'galaxy-tiebomber', { kind: 'tiebomber' }],
  ['tieadvanced', 0, 'galaxy-tieadvanced', { kind: 'tieadvanced' }],
  ['awing', 0, 'galaxy-awing', { kind: 'awing' }],
  ['ywing', 0, 'galaxy-ywing', { kind: 'ywing' }],
  ['uwing', Math.PI, 'galaxy-uwing', { kind: 'uwing' }],
  ['n1', 0, 'galaxy-n1', { kind: 'n1fighter' }],
  ['arc170', Math.PI, 'galaxy-arc170', { kind: 'arc170' }],
  ['vulture', Math.PI, 'galaxy-vulture', { kind: 'vulture' }],
  ['trifighter', 0, 'galaxy-trifighter', { kind: 'trifighter' }],
  ['cloudcar', -Math.PI / 2, 'galaxy-cloudcar', { kind: 'cloudcar' }],
  ['nebulon', 0, 'galaxy-nebulon', { name: 'objects/props/landmarks/_rebelalliance/bd_frigatenebulonb_01/frigatenebulonb_01_mesh', as: 'the Nebulon-B frigates', cut: 2 }],
  // (lane Q: a capital the space levels assemble from its kit, at the fleet's
  // cut: scripts/bf2017-space.mjs --fleet; `turn` brings the kit's nose, along
  // its −z as the game's capitals are, to +z)
  ['lucrehulk', 0, 'galaxy-lucrehulk', { space: 'naboo', model: 'naboo-lucrehulk', as: 'the Lucrehulk-class droid control ships', turn: Math.PI }],
  ['lightcruiser', -Math.PI / 2, 'galaxy-lightcruiser', { space: 'fondor', model: 'fondor-arquitens', as: 'the Arquitens-class light cruisers', turn: Math.PI }],
];

// the turn a file is written with so that the row's `nose` turn brings it
// back to +z: its nose at −nose about y
export const writtenTurn = (nose) => [0, Math.sin(-nose / 2), 0, Math.cos(-nose / 2)];

async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// the source file: a surface kind's light cut, or the drop's model imported
// at its cut into lab/ (the import's own scratch: its row and credit go there)
async function source([file, , , from]) {
  if (from.space) {
    const out = join(ROOT, 'lab/bf2017-fleet', `${file}.glb`);
    execFileSync('node', ['scripts/bf2017-space.mjs', from.space, '--fleet', from.model, '--out', out], { cwd: ROOT, stdio: 'inherit' });
    return { path: out, title: `${from.as} (${from.model}: its kit as the space level places it)`, as: from.as, turn: from.turn };
  }
  if (from.kind) return { path: join(ROOT, 'public/models/galaxy/surface', `${from.kind}.lod1.glb`), title: SURFACE_FROM(from.kind), as: null };
  const out = join(ROOT, 'lab/bf2017-fleet', file.replace('/', '-'));
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'cat.js'), 'export const MODELS = {};\n');
  await writeFile(join(out, 'credits.json'), '{}\n');
  const kind = file.replace(/[^a-z0-9]/g, '');
  execFileSync('node', ['scripts/bf2017-fetch.mjs', from.name], { cwd: ROOT, stdio: 'ignore' });
  execFileSync('node', ['scripts/bf2017-import.mjs', from.name, '--kind', kind, '--as', from.as, '--asis', '--native', '--cuts', `plain=${from.cut}`, '--tex', String(from.tex ?? 1024), '--maps', String(from.tex ?? 1024), '--out', out, '--catalog', join(out, 'cat.js'), '--credits', join(out, 'credits.json')], { cwd: ROOT, stdio: 'inherit' });
  return { path: join(out, 'surface', `${kind}.glb`), title: from.name, as: from.as };
}
let SURFACE_FROM = () => null;

export async function writeFleet(rows) {
  const reader = await io();
  const credits = JSON.parse(await readFile(join(ROOT, 'src/data/modelCredits.json'), 'utf8'));
  const { MODELS } = await import('../src/components/galaxy/surface/catalog/bf2017-vehicles.js');
  SURFACE_FROM = (kind) => MODELS[kind]?.from ?? null;
  for (const row of rows) {
    const [file, nose, key] = row;
    const src = await source(row);
    if (!existsSync(src.path)) {
      console.log(`${file}: no ${src.path} (import its kind first: node scripts/bf2017-vehicles.mjs)`);
      continue;
    }
    const doc = await reader.read(src.path);
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    // (a kit's own nose turned to +z first, then the row's)
    const turn = doc.createNode('nose').setRotation(writtenTurn(nose + (src.turn ?? 0)));
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      turn.addChild(child);
    }
    scene.addChild(turn);
    const out = join(ROOT, 'public/models/galaxy', `${file}.glb`);
    await reader.write(out, doc);
    const was = credits[key] ?? {};
    await writeCredit(join(ROOT, 'src/data/modelCredits.json'), key, {
      title: `Star Wars Battlefront II (2017): ${src.title ?? row[3].kind}`,
      author: 'EA DICE',
      authorUrl: GAME,
      license: 'permission',
      licenseUrl: GAME,
      source: GAME,
      where: was.where ?? 'galaxy',
      as: src.as ?? was.as ?? file,
      file: `/models/galaxy/${file}.glb`,
      also: was.also ?? ['galaxy'],
      permission: PERMISSION,
    });
    console.log(`${file}.glb ${((await stat(out)).size / 1024).toFixed(1)} KB from ${src.title}, written nose ${nose.toFixed(2)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const only = args._[0] ? new Set(String(args._[0]).split(',')) : null;
  const rows = FLEET.filter((r) => !only || only.has(r[0]));
  if (args.dry) for (const r of rows) console.log(r[0], r[3]);
  else await writeFleet(rows);
}
