#!/usr/bin/env node
// Writes src/data/bf2017/physics/impulses.json: each weapon's hit impulse
// (N·s), its projectile's WSBulletEntityData.ImpactImpulse, joined from the
// committed weapons.json and projectiles.json (scripts/lib/
// bf2017-physics-rules.mjs's impulseRows), so the Battlefront world's
// ragdolls read a few KB, not the 397 KB projectile book. No export needed.
//
//   node scripts/bf2017-impulses.mjs [--out src/data/bf2017/physics/impulses.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { checkSources, impulseRows } from './lib/bf2017-physics-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const book = impulseRows(read('src/data/bf2017/weapons.json'), read('src/data/bf2017/physics/projectiles.json'));
const bad = checkSources({ rows: book.rows, fallback: book.fallback });
if (bad.length || !book.fallback) {
  console.error(`numbers without a source: ${bad.join(', ') || 'the fallback'}`);
  process.exit(1);
}
for (const id of book.missing) console.log(`no projectile: ${id}`);
// (a weapon a line)
const lines = Object.entries(book.rows).map(([id, row]) => `  ${JSON.stringify(id)}: ${JSON.stringify(row)}`);
const text = `{\n "_from": "scripts/bf2017-impulses.mjs",\n "fallback": ${JSON.stringify(book.fallback)},\n "rows": {\n${lines.join(',\n')}\n }\n}\n`;
JSON.parse(text);
const out = args.out ?? join(ROOT, 'src/data/bf2017/physics/impulses.json');
writeFileSync(out, text);
console.log(`${lines.length} weapons → ${out}`);
