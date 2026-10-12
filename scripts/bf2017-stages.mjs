#!/usr/bin/env node
// Rewrites a level's Galactic Assault stage file's spawn sets from the
// export's wiring (scripts/lib/bf2017-stages.mjs): which spawn areas and
// spawn points each stage enables, read from the mode prefab's six
// stage-enable ports through the `<Mode>_Spawns` gates, in place of the
// hand Z bands NOTES.md describes. The objectives and the rest of the file
// are kept as they are.
//
//   node scripts/bf2017-stages.mjs --root <export dir> [--level Hoth_01] [--file src/data/bf2017/maps/hoth.stages.json] [--dry]
//
// root: the export (C:\Users\…\Downloads\BF2_Extract), with web/data/Levels/MP/<level>/*.json.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { GA_PORTS, buildGraph, findPrefab, stageSets } from './lib/bf2017-stages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const opt = parseArgs(process.argv.slice(2));
if (typeof opt.root !== 'string') {
  console.error('Give --root <export dir>.');
  process.exit(2);
}
const level = opt.level ?? 'Hoth_01';
const file = join(ROOT, opt.file ?? `src/data/bf2017/maps/${level.toLowerCase().replace(/_01$/, '')}.stages.json`);
const dir = join(opt.root, 'web', 'data', 'Levels', 'MP', level);
const mode = 'FantasyBattle';
const read = (name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));

const sub = read(mode);
const layers = {};
for (const suffix of ['Logic', 'Shapes', 'Spawns', 'Gameplay', 'Spawns_Automation', 'Automation']) {
  const name = `${mode}_${suffix}`;
  if (existsSync(join(dir, `${name}.json`))) layers[name] = read(name);
}
const graph = buildGraph(sub, layers);
const prefab = findPrefab(layers);
if (!prefab) throw new Error(`${level}: no PF_GameMode_Conquest_Staged in its ${mode} layers`);

const book = JSON.parse(readFileSync(file, 'utf8'));
const teams = book.attackers === 'light' ? { attack: 1, defend: 2 } : { attack: 2, defend: 1 };
const sets = stageSets(graph, { prefab: prefab.guid, ports: GA_PORTS, stages: book.stages.length, teams });
const source = `Levels/MP/${level}/${mode}#PropertyConnections from ${prefab.id} (${Object.values(GA_PORTS).flat().join(', ')}) through ${mode}_Spawns into Enabled (2662400)`;
book.stages.forEach((st, k) => {
  const s = sets[k];
  st.spawns = { attack: s.areas.attack, defend: s.areas.defend, gated: s.areas.gated, _source: source };
  st.points = { attack: s.points.attack, defend: s.points.defend, gated: s.points.gated, _source: source };
});
book.spawnsSource = 'wired';
book.notes = 'NOTES.md says how each objective id was chosen; three stages, as the stage strings name them. The spawn sets are the wiring’s (scripts/bf2017-stages.mjs): `gated` lists the ones a run-time trigger or event-set Bool also holds.';

for (const [k, st] of book.stages.entries()) console.log(`stage ${k + 1} ${st.id}: areas attack ${st.spawns.attack.length} defend ${st.spawns.defend.length} (gated ${st.spawns.gated.length}); points attack ${st.points.attack.length} defend ${st.points.defend.length}`);
if (opt.dry) process.exit(0);
writeFileSync(file, `${JSON.stringify(book, null, 2)}\n`);
console.log(`wrote ${file}`);
