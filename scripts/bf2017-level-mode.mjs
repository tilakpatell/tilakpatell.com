#!/usr/bin/env node
// A mode's part's own records beside its pack (scripts/bf2017-level.mjs
// --part): mode.json, what each of its meshes is in the game (a door's leaf
// and its rule, a gate's, a wreck shown once its vehicle is destroyed, a
// pickup, a charge, mode art that only stands) and the mode's invisible
// collision; the README gains a section saying so. The reading is
// scripts/lib/bf2017-level-mode.mjs's (pure); this finds the records in the
// export (Downloads/BF2_Extract/web: data/ and maps/) and writes. git keeps
// mode.json (a pack's JSON stays: lib/asset-manifest.mjs's PACK_KEPT).
//
//   node scripts/bf2017-level-mode.mjs <pack> [--root <export web>] [--sub FantasyBattle]
//     [--layers GameModes_CollisionPass,Gamemode_Shared,FantasyBattle_Collision] [--dry]
//
//   pack    the part's pack under public/models/galaxy/bf2017/levels/ (hoth/ga)
//   sub     the mode's sub-world, beside the map's level (FantasyBattle: Galactic Assault)
//   layers  the layers whose OBBCollisionEntityData are the mode's walls (the
//           sub-world's own collision layer and the GameModes sub-world's two,
//           which every mode of the map loads)

import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { follow } from './lib/bf2017-ebx.mjs';
import { NEVER, STILL_SKINNED } from './lib/bf2017-level.mjs';
import { fromManifest, readMode } from './lib/bf2017-level-mode.mjs';
import { spawnLogic } from './lib/bf2017-rulebook-spawnlogic.mjs';
import { fieldHash as H } from './lib/bf2017-abilities.mjs';

// PF_InteractGate_Hoth_01's field that switches its leaves (its two ObjectReferences' Enabled)
const LEAVES_ENABLED = -1756439259;

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SECTION = '<!-- mode -->';

// the manifest's instances of one sub-level: { mesh, world, i } in the export's frame
// (the pack's own: what the builder's NEVER rule and its actors' rule leave in)
export function instancesOf(manifest, subName) {
  const sub = manifest.subworlds.findIndex((s) => s.toLowerCase() === subName.toLowerCase());
  if (sub < 0) throw new Error(`${subName}: not a sub-level of ${manifest.level}`);
  const out = [];
  let i = 0;
  for (const g of manifest.groups) {
    const file = manifest.meshes[g.mesh].file;
    const kept = g.sub === sub && !NEVER.test(file) && (g.kind !== 'actor' || STILL_SKINNED.test(file));
    for (let k = 0; k < g.count; k++, i++) if (kept) out.push({ mesh: file, world: fromManifest(g.t, k * 12), i, kind: g.kind });
  }
  return out;
}

const count = (xs) => xs.reduce((n, x) => n + x, 0);

export function readmeSection(mode, cmd) {
  const n = (p) => count(p.parts.map((x) => x.instances.length));
  const kinds = {};
  for (const p of mode.props) kinds[p.kind] = (kinds[p.kind] ?? 0) + n(p);
  return [
    SECTION,
    '## The mode',
    '',
    `What each mesh is in the game (\`${cmd}\`, scripts/lib/bf2017-level-mode.mjs; bf2-re findings/61): mode.json.`,
    '',
    '| | count | the rule |',
    '| --- | --- | --- |',
    `| doors | ${mode.doors.length} (${count(mode.doors.map((d) => d.leaves.length))} leaves) | PF_AutomaticDoor_Controller: the trigger box of the door's team, ${mode.controller?.curve} ${mode.controller?.mode} over the door's duration |`,
    `| gates | ${mode.gates.length} (${count(mode.gates.map((d) => d.leaves.length))} leaves) | the same controller, opened at the panel (the main session's gates.js) |`,
    ...Object.entries(kinds).map(([k, c]) => `| ${k} | ${c} | ${{ wreck: 'shown once its vehicle is destroyed, until it spawns again', gateRuin: 'shown once its gate is destroyed', pickup: 'the HH-12 shown while the pickup is enabled (the level graph); its crate stands', charge: 'shown while armed, until it goes off', walker: 'a walker’s destruction stages and its fall’s dressing: hidden, played where the walker falls (its own rows)', static: 'stands (the end of round’s room inside the mode prefab never drawn)' }[k] ?? ''} |`),
    `| walls | ${mode.boxes.length} (${mode.boxes.filter((b) => b.layer === 'character').length} soldiers only) | OBBCollisionEntityData, fixed |`,
    `| unmatched | ${mode.unmatched.length} | |`,
    '',
  ].join('\n');
}

async function main(args) {
  const [pack] = args._;
  if (!pack) {
    console.error('usage: node scripts/bf2017-level-mode.mjs <pack> [--root <export web>] [--sub FantasyBattle] [--layers a,b] [--dry]');
    process.exit(1);
  }
  const root = typeof args.root === 'string' ? args.root : 'C:/Users/tilak/Downloads/BF2_Extract/web';
  const out = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', ...pack.split('/'));
  const level = JSON.parse(await readFile(join(out, 'level.json'), 'utf8'));
  const mapDir = join(root, 'maps', ...level.map.split('/'));
  const file = [join(mapDir, `${level.map.split('/').pop()}.json`)].find(existsSync);
  if (!file) throw new Error(`${level.map}: no manifest under ${mapDir}`);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const dir = manifest.level.slice(0, manifest.level.lastIndexOf('/') + 1);
  const subName = typeof args.sub === 'string' ? args.sub : 'FantasyBattle';
  const layers = (typeof args.layers === 'string' ? args.layers : `GameModes_CollisionPass,Gamemode_Shared,${subName}_Collision`).split(',').map((l) => `${dir}${l}`);
  const load = (name) => (name ? follow(root, name) : null);
  const instances = instancesOf(manifest, `${dir}${subName}`);
  const mode = readMode(load, { sub: `${dir}${subName}`, instances, origin: level.origin, layers });
  // (what the level's graph decides, read back through it the way the spawn records' Enabled is,
  // for the page to run with lib/battlefront/spawnLogic.js: the pickups' Enabled, the gates'
  // leaves' Enabled and their ruins' IsDestroyed, the doors' OpenDoor and CloseDoor)
  const live = (v) => v && typeof v === 'object';
  const targets = [
    ...mode.props.filter((p) => p.kind === 'pickup' && live(p.enabled)).map((p) => p.id),
    ...mode.props.filter((p) => p.kind === 'gateRuin').map((p) => ({ id: p.id, field: H('IsDestroyed') })),
    ...mode.gates.filter((g) => live(g.leavesEnabled)).map((g) => ({ id: g.id, field: LEAVES_ENABLED })),
    ...mode.doors.flatMap((d) => [{ id: d.id, event: H('OpenDoor') }, { id: d.id, event: H('CloseDoor') }]),
  ];
  mode.logic = targets.length ? spawnLogic(root, dir, subName, { targets }) : null;
  const cmd = `node scripts/bf2017-level-mode.mjs ${process.argv.slice(2).join(' ')}`;
  const json = { _from: { map: level.map, sub: `${dir}${subName}`, manifest: `web/maps/${level.map}/${level.map.split('/').pop()}.json`, frame: 'the pack’s: the export’s minus level.json’s origin' }, ...mode };
  console.log(`${pack}: ${mode.doors.length} doors, ${mode.gates.length} gates, ${mode.props.length} props, ${mode.boxes.length} walls, ${mode.unmatched.length} meshes unmatched`);
  if (args.dry) {
    console.log(JSON.stringify(json, null, 1).slice(0, 4000));
    return;
  }
  await writeFile(join(out, 'mode.json'), `${JSON.stringify(json)}\n`);
  const readme = await readFile(join(out, 'README.md'), 'utf8').catch(() => '');
  const head = readme.split(SECTION)[0].replace(/\n*$/, '\n\n');
  await writeFile(join(out, 'README.md'), `${head}${readmeSection(mode, cmd)}`);
  console.log(`wrote ${pack}/mode.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(parseArgs(process.argv.slice(2)));
