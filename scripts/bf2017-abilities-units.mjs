#!/usr/bin/env node
// The heroes' and reinforcements' abilities as the Battlefront world's sim
// plays them: src/data/bf2017/unitKit.json. For each hero and reinforcement
// the rulebooks list (heroes.json, reinforcements.json), each of its three
// abilities' effect read from its prefab, weapon and projectiles
// (scripts/lib/bf2017-abilities-units.mjs), every affector those apply with
// its numbers, and the weapon each unit carries and each weapon ability
// swaps to (the rulebook's weaponRow: a row weapons.json lacks is kept
// here). Every number keeps the record it came from.
//
//   node scripts/bf2017-abilities-units.mjs --root C:/Users/tilak/Downloads/BF2_Extract/web [--out src/data/bf2017/unitKit.json]

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { UNIT_KIND, affectorRow, effectOf } from './lib/bf2017-abilities-units.mjs';
import { checkSources, weaponRow } from './lib/bf2017-rulebook.mjs';

const EXPORT = 'build 489592';
const args = parseArgs(process.argv.slice(2));
if (typeof args.root !== 'string') throw new Error('--root <export dir> is required');
const root = args.root;
const out = args.out ?? 'src/data/bf2017/unitKit.json';
const read = (f) => JSON.parse(readFileSync(join('src/data/bf2017', f), 'utf8'));
const rows = read('abilities.json').rows;
const known = read('weapons.json').rows;
const units = [...Object.values(read('heroes.json').rows).map((r) => ({ ...r, unit: 'hero' })), ...Object.values(read('reinforcements.json').rows).map((r) => ({ ...r, unit: 'reinforcement' }))];

// a weapon ability's or a unit's primary as the rulebook reads it: weapons.json's id where that row is this blueprint's,
// else the row kept whole here under its blueprint's name (two blueprints can end in the same word: W_DL44_HanSolo, W_DemolitionGrenade_HanSolo)
const weapons = {};
function weaponOf(asset) {
  const w = asset ? weaponRow(root, asset) : null;
  if (!w || w._missing?.length) return null;
  if (known[w.id]?.blueprint === w.blueprint) return w.id;
  const key = w.blueprint.split('/').pop();
  weapons[key] ??= { ...w, id: key };
  return key;
}

const abilities = {};
const affectors = {};
const kits = {};
for (const u of units) {
  kits[u.id] = { unit: u.unit, primary: weaponOf(u.primaryAsset), abilities: u.abilities.map((a) => a.id) };
  for (const a of u.abilities) {
    if (abilities[a.id]) continue;
    const row = rows[a.id];
    const kind = UNIT_KIND[a.id] ?? null;
    if (!kind) console.error(`${a.id}: no kind`);
    const fx = effectOf(root, a.asset, row?.identifier ?? null);
    for (const ap of fx.applies) affectors[ap.affector] ??= affectorRow(root, ap.affector);
    abilities[a.id] = { kind, ...fx, ...(row?.kind === 'weapon' ? { weapon: weaponOf(a.asset) } : {}) };
  }
}
// (outputs keyed by hash: the role and where it goes, no number of their own)
const head = readFileSync(join(root, 'data.tsv')).subarray(0, 65536);
const json = { _from: { export: EXPORT, date: new Date().toISOString().slice(0, 10), root: createHash('sha1').update(head).digest('hex') }, kits, abilities, affectors, weapons };
const bad = checkSources(json);
if (bad.length) {
  console.error(`${bad.length} numbers without a source, first ${bad.slice(0, 5).join(', ')}`);
  process.exit(1);
}
const text = `${JSON.stringify(json)}\n`;
writeFileSync(out, text);
console.log(`${out}: ${Object.keys(kits).length} units, ${Object.keys(abilities).length} abilities, ${Object.keys(affectors).length} affectors, ${Object.keys(weapons).length} weapons, ${(text.length / 1024).toFixed(1)} KB`);
