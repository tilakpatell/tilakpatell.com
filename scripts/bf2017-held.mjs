#!/usr/bin/env node
// The class weapons as soldiers hold them: src/data/bf2017/held.json, one
// row a weapon that a class in classes.json carries (Hoth's eight), each
// from its blueprint in weapons.json by scripts/lib/bf2017-held.mjs (the
// 3P mesh, the muzzle bone in the weapon's frame, the flash offset, the
// stance pack). The Battlefront world's figures/held.js reads it.
//
//   node scripts/bf2017-held.mjs [--root lab/assets/bf2017] [--out src/data/bf2017/held.json]
//
// The records it reads (fetch them first):
//   NODE_USE_ENV_PROXY=1 node scripts/bf2017-fetch.mjs data 'Characters/Rigs/Weapon/WeaponSke01' 'Gameplay/Equipment/{Rifles/E11,…}/*'

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { heldRow } from './lib/bf2017-held.mjs';
import { checkSources } from './lib/bf2017-rulebook.mjs';

const EXPORT = 'build 489592';
const args = parseArgs(process.argv.slice(2));
const root = args.root ?? 'lab/assets/bf2017';
const out = args.out ?? 'src/data/bf2017/held.json';
const read = (f) => JSON.parse(readFileSync(join('src/data/bf2017', f), 'utf8'));
const classes = Object.values(read('classes.json').rows);
const weapons = read('weapons.json').rows;
const ids = [...new Set(classes.map((c) => c.weapon).filter(Boolean))];

const rows = {};
let missing = 0;
for (const id of ids) {
  const w = weapons[id];
  if (!w?.blueprint) {
    console.error(`${id}: no blueprint in weapons.json`);
    missing++;
    continue;
  }
  const row = heldRow(root, w.blueprint);
  for (const m of row._missing) console.error(`${id}: missing ${m}`);
  missing += row._missing.length;
  rows[id] = row;
}
const head = readFileSync(join(root, 'data.tsv')).subarray(0, 65536);
const json = { _from: { export: EXPORT, date: new Date().toISOString().slice(0, 10), root: createHash('sha1').update(head).digest('hex') }, rows };
const bad = checkSources(json);
if (bad.length) {
  console.error(`${bad.length} numbers without a source, first ${bad[0]}`);
  process.exit(1);
}
// (one row a line, as the physics rulebooks: a rebuild's diff reads row by row)
const text = `{"_from": ${JSON.stringify(json._from)}, "rows": {\n${Object.entries(rows)
  .map(([k, r]) => `${JSON.stringify(k)}: ${JSON.stringify(r)}`)
  .join(',\n')}\n}}\n`;
writeFileSync(out, text);
console.log(`${out}: ${Object.keys(rows).length} rows, ${missing} missing, ${(text.length / 1024).toFixed(1)} KB`);
