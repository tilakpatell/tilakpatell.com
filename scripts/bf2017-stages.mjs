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
const layerOf = (ids, what) => {
  const names = [...new Set(ids.map((id) => id.slice(0, id.lastIndexOf(':'))))];
  if (names.length > 1) throw new Error(`${level}: the ${what} sit in more than one layer (${names.join(', ')})`);
  return names[0] ?? null;
};
// number arrays on one line (the steps' lists)
const stringify = (v) => JSON.stringify(v, null, 2).replace(/\[\s+(-?\d[\d\s,-]*?)\s+\]/g, (m, body) => `[${body.replace(/\s+/g, ' ')}]`);
book.stages.forEach((st, k) => {
  const s = sets[k];
  st.spawns = { attack: s.areas.attack, defend: s.areas.defend, gated: s.areas.gated, _source: source };
  st.points = { attack: s.points.attack, defend: s.points.defend, gated: s.points.gated, _source: source };
  const layers = { areas: layerOf([...s.areas.attack, ...s.areas.defend], 'spawn areas'), points: layerOf([...s.points.attack, ...s.points.defend], 'spawn points') };
  delete st.steps;
  delete st.opening;
  // the sets a walker's progress switches inside the stage: the escort tracker's int through the selector's events
  if (s.steps) st.steps = { ...s.steps, layers, _source: `Levels/MP/${level}/${mode}#EventConnections from ${s.steps.selector} (SelectEventEntityData on ${s.steps.tracker}'s int) into ${mode}_Spawns' Bools; the waypoint triggers' LinkConnections into the paths` };
  // the rooms open only as the round starts: the prefab's start event through the layer's Delay
  if (s.opening) st.opening = { ...s.opening, layers, _source: `Levels/MP/${level}/${mode}#EventConnections from ${prefab.id} (-474851384) through ${mode}_Spawns#DelayEntityData.Delay into its Bools' SetFalse` };
});
book.spawnsSource = 'wired';
book.notes = 'NOTES.md says how each objective id was chosen; three stages, as the stage strings name them. The spawn sets are the wiring’s (scripts/bf2017-stages.mjs): `steps` the sets a walker’s progress switches inside a stage, `opening` the rooms open only as it starts, `gated` the ones another event-set Bool also holds.';

for (const [k, st] of book.stages.entries()) console.log(`stage ${k + 1} ${st.id}: areas attack ${st.spawns.attack.length} defend ${st.spawns.defend.length} (gated ${st.spawns.gated.length}); points attack ${st.points.attack.length} defend ${st.points.defend.length}${st.steps ? `; ${st.steps.areas.attack.length} steps` : ''}${st.opening ? `; opening ${st.opening.seconds} s` : ''}`);
if (opt.dry) process.exit(0);
writeFileSync(file, `${stringify(book)}\n`);
console.log(`wrote ${file}`);
