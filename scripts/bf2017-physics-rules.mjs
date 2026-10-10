// Writes the physics rulebooks from the Battlefront II (2017) records
// (scripts/lib/bf2017-physics-rules.mjs) into src/data/bf2017/physics/.
// Until lane 0's `scripts/bf2017-data.mjs` is on main this is its own CLI;
// then it folds in there as a `physics` command.
//
//   node scripts/bf2017-physics-rules.mjs soldier --root <export> [--out src/data/bf2017/physics/soldier.json]
//   node scripts/bf2017-physics-rules.mjs death --root <export> [--out src/data/bf2017/physics/death.json]
//     (the soldier blueprints' WSSoldierHealthComponentData: the corpse time
//     the Battlefront world's ragdolls lie for; fetch the four DEATH_RECORDS
//     with `node scripts/bf2017-fetch.mjs data <name>` first)
//
//   root  the export's root, holding data/<Name>.json or .json.gz (the owner's
//         C:\Users\tilak\Downloads\BF2_Extract\web, or lab/assets/bf2017 after a fetch)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { DEATH_RECORDS, checkSources, deathRow, loadAsset, soldierRulebook } from './lib/bf2017-physics-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const [what] = args._;
const root = args.root ?? process.env.BF2_ROOT;

if (!['soldier', 'death'].includes(what) || !root) {
  console.error('usage: node scripts/bf2017-physics-rules.mjs soldier|death --root <export> [--out <file>]');
  process.exit(2);
}

if (what === 'death') {
  const rows = {};
  for (const name of DEATH_RECORDS) {
    const row = deathRow(loadAsset(root, name));
    if (row) rows[row.id] = row;
    else console.log(`missing: ${name}`);
  }
  const bad = checkSources(rows);
  if (bad.length) {
    console.error(`numbers without a source: ${bad.join(', ')}`);
    process.exit(1);
  }
  const lines = Object.entries(rows).map(([id, row]) => `  ${JSON.stringify(id)}: ${JSON.stringify(row)}`);
  const text = `{\n "_from": "scripts/bf2017-physics-rules.mjs death",\n "default": "stormtroopershared",\n "rows": {\n${lines.join(',\n')}\n }\n}\n`;
  JSON.parse(text);
  const out = args.out ?? join(ROOT, 'src/data/bf2017/physics/death.json');
  writeFileSync(out, text);
  console.log(`${lines.length} rows → ${out}`);
  process.exit(0);
}

const book = soldierRulebook(root);
const out = args.out ?? join(ROOT, 'src/data/bf2017/physics/soldier.json');
const unsourced = checkSources(book.rows);
for (const name of book.missing) console.log(`missing: ${name}`);
for (const name of book.refused) console.log(`refused (sequel era): ${name}`);
if (unsourced.length) {
  console.error(`numbers without a source: ${unsourced.join(', ')}`);
  process.exit(1);
}
// (a row a line: thirteen lines of numbers and their sources, about 14 KB gzipped)
const lines = Object.entries(book.rows).map(([id, row]) => `  ${JSON.stringify(id)}: ${JSON.stringify(row)}`);
const text = `{\n "_from": "scripts/bf2017-physics-rules.mjs soldier",\n "default": ${JSON.stringify(book.default)},\n "rows": {\n${lines.join(',\n')}\n }\n}\n`;
JSON.parse(text);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(`${Object.keys(book.rows).length} rows → ${out}`);
