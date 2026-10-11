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
// Lane V kept the close-up Star Destroyer, Nebulon-B and MC80 as Daniel
// Andersson's and the Sketchfab one, the game's backdrop ships looking the
// poorer on a sheet made before the space lane's kits existed
// (docs/superpowers/evidence/bf2017-vehicles/fleet.webp). Lane S1 (the
// galaxy-in-space design, decision 1) puts the kits in their place: every
// capital is its kit at the fleet's cut, with its ultra cut beside it
// (`<file>.ultra.glb`, the capital's cap and the game's 1,024 maps, to the
// bucket: scripts/assets-publish.mjs), and the close-up Nebulon-B (the HQ row)
// is the game's own frigate at its first LOD with its engine and lights
// (docs/superpowers/evidence/bf2017-space/s1/fleet-2017.webp, the sheet
// re-shot). The corvette and the Providence follow from their Meshy remakes.

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
// credit's key, the source: a lane V surface kind's light cut, a model of the
// drop's with the cut to take (`parts`: the globs of the parts beside it), or
// a space level's kit (`space`, `model`; `ultra`: its ultra cut written too)]
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
  // (the sixth design's lane fighters: Starfighter Assault's Clone Wars kits
  // over their Meshy stand-ins, and the T-65 the mode flies, `xwing65`, beside
  // the galaxy's gen3d X-wing, which its hunters and wingmen keep)
  ['vwing', Math.PI / 2, 'galaxy-vwing', { kind: 'vwing' }],
  ['hyena', Math.PI / 2, 'galaxy-hyena', { kind: 'hyena' }],
  ['xwing65', 0, 'galaxy-xwing65', { kind: 'xwing' }],
  ['nebulon', 0, 'galaxy-nebulon', { name: 'objects/props/landmarks/_rebelalliance/bd_frigatenebulonb_01/frigatenebulonb_01_mesh', as: 'the Nebulon-B frigates', cut: 2 }],
  // (lane S1: the close-up Nebulon-B is the game's own at its first LOD,
  // 16,029 triangles with its engine and its lights, over Daniel Andersson's;
  // `_source`: lab/assets/bf2017/web/models.jsonl)
  // (lane S1: the Falcon in flight, gear up: the landmark Falcon at the plain
  // cut lane V took (its LOD2, 48,567 triangles; LOD1 is 101,207), its details' maps bound as
  // lane V's row binds them, and its landing legs, a material of their own in
  // the drop (`Legs_Shader`), left out; the surfaces keep lane V's, gear down)
  ['falcon', 0, 'galaxy-falcon', { name: 'gameplay/vehicles/air/millenniumfalcon/landmark/millenniumfalcon_01_landmark_mesh', as: 'the Millennium Falcon in flight', cut: 2, drop: /^Legs_Shader/, textures: 'Details_Shader1=color:Gameplay/Vehicles/Air/MillenniumFalcon/T_MillenniumFalconDetails_01_CS,normal:Gameplay/Vehicles/Air/MillenniumFalcon/T_MillenniumFalcon_01_N' }],
  ['hq/nebulon', 0, 'galaxy-nebulonhq', { name: 'objects/props/landmarks/_rebelalliance/bd_frigatenebulonb_01/frigatenebulonb_01_mesh', as: 'the Nebulon-B frigates, close up', cut: 0, parts: '*_engine_01_mesh,*_emissive_01_mesh' }],
  // (lane Q: a capital the space levels assemble from its kit, at the fleet's
  // cut: scripts/bf2017-space.mjs --fleet; `turn` brings the kit's nose, along
  // its −z as the game's capitals are, to +z)
  ['lucrehulk', 0, 'galaxy-lucrehulk', { space: 'naboo', model: 'naboo-lucrehulk', as: 'the Lucrehulk-class droid control ships', turn: Math.PI }],
  ['lightcruiser', -Math.PI / 2, 'galaxy-lightcruiser', { space: 'fondor', model: 'fondor-arquitens', as: 'the Arquitens-class light cruisers', turn: Math.PI }],
  // (lane S1: the war's other capitals from the kits, each with its ultra
  // cut beside it (`ultra`: the capital cap and the game's 1,024 maps, to
  // the bucket), over Daniel Andersson's close-up Star Destroyer and MC80,
  // ForkyForklift's Venator and the Meshy CR90 and Providence. Each kit's
  // nose is where its hull mesh has it, not one way: the Star Destroyer's
  // and the corvette's along +z, the Venator's along −z, the Providence's
  // along +x, each read off a shot of the written file, 2026-10-11;
  // `turn` brings it to +z)
  ['destroyer', 0, 'galaxy-destroyer', { space: 'endor', model: 'endor-isd', as: 'the Imperial Star Destroyers', turn: 0, ultra: true }],
  ['moncal', 0, 'galaxy-moncal', { space: 'endor', model: 'endor-mc80', as: 'the Mon Calamari cruisers', turn: Math.PI, ultra: true }],
  ['venator', 0, 'galaxy-venator', { space: 'kamino', model: 'kamino-venator', as: 'the Venator-class Star Destroyers', turn: Math.PI, ultra: true }],
  ['corvette', 0, 'galaxy-corvette', { space: 'endor', model: 'corvettecr90-01', as: 'the CR90 corvettes', turn: 0, ultra: true }],
  ['providence', 0, 'galaxy-providence', { space: 'kamino', model: 'providenceclassdreadnaught-01', as: 'the Providence-class dreadnoughts', turn: Math.PI / 2, ultra: true }],
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
async function source([file, , , from], { ultra = false } = {}) {
  if (from.space) {
    const out = join(ROOT, 'lab/bf2017-fleet', `${file}${ultra ? '.ultra' : ''}.glb`);
    execFileSync('node', ['scripts/bf2017-space.mjs', from.space, '--fleet', from.model, '--out', out, ...(ultra ? ['--ultra'] : [])], { cwd: ROOT, stdio: 'inherit' });
    return { path: out, title: `${from.as} (${from.model}: its kit as the space level places it)`, as: from.as, turn: from.turn };
  }
  if (from.kind) return { path: join(ROOT, 'public/models/galaxy/surface', `${from.kind}.lod1.glb`), title: SURFACE_FROM(from.kind), as: null };
  const out = join(ROOT, 'lab/bf2017-fleet', file.replace('/', '-'));
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'cat.js'), 'export const MODELS = {};\n');
  await writeFile(join(out, 'credits.json'), '{}\n');
  const kind = file.replace(/[^a-z0-9]/g, '');
  execFileSync('node', ['scripts/bf2017-fetch.mjs', from.name, ...(from.parts ? ['--parts', from.parts] : [])], { cwd: ROOT, stdio: 'ignore' });
  execFileSync('node', ['scripts/bf2017-import.mjs', from.name, '--kind', kind, '--as', from.as, '--asis', '--native', '--cuts', `plain=${from.cut}`, '--tex', String(from.tex ?? 1024), '--maps', String(from.tex ?? 1024), ...(from.parts ? ['--parts', from.parts] : []), ...(from.textures ? ['--textures', from.textures] : []), '--out', out, '--catalog', join(out, 'cat.js'), '--credits', join(out, 'credits.json')], { cwd: ROOT, stdio: 'inherit' });
  return { path: join(out, 'surface', `${kind}.glb`), title: from.name, as: from.as };
}
let SURFACE_FROM = () => null;

export async function writeFleet(rows) {
  const reader = await io();
  const credits = JSON.parse(await readFile(join(ROOT, 'src/data/modelCredits.json'), 'utf8'));
  const { MODELS } = await import('../src/components/galaxy/surface/catalog/bf2017-vehicles.js');
  SURFACE_FROM = (kind) => MODELS[kind]?.from ?? null;
  // the file turned so the row's nose brings it to +z (a kit's own nose first, then the row's)
  const turned = async (src, nose, out, drop = null) => {
    const doc = await reader.read(src.path);
    // (a row's `drop`: the primitives of the materials it names left out, the Falcon's legs)
    if (drop) {
      for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (drop.test(prim.getMaterial()?.getName() ?? '')) prim.dispose();
      for (const m of doc.getRoot().listMaterials()) if (drop.test(m.getName())) m.dispose();
    }
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const turn = doc.createNode('nose').setRotation(writtenTurn(nose + (src.turn ?? 0)));
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      turn.addChild(child);
    }
    scene.addChild(turn);
    await mkdir(dirname(out), { recursive: true });
    await reader.write(out, doc);
    return (await stat(out)).size;
  };
  for (const row of rows) {
    const [file, nose, key] = row;
    const src = await source(row);
    if (!existsSync(src.path)) {
      console.log(`${file}: no ${src.path} (import its kind first: node scripts/bf2017-vehicles.mjs)`);
      continue;
    }
    const out = join(ROOT, 'public/models/galaxy', `${file}.glb`);
    await turned(src, nose, out, row[3].drop ?? null);
    // (the ultra cut beside it, the same turn: galaxy/models.js's ULTRA row, loaded at ultra alone)
    if (row[3].ultra) {
      const big = await source(row, { ultra: true });
      const bytes = await turned(big, nose, join(ROOT, 'public/models/galaxy', `${file}.ultra.glb`));
      console.log(`${file}.ultra.glb ${(bytes / 1024).toFixed(1)} KB`);
    }
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
