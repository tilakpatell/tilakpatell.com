#!/usr/bin/env node
// Writes the AutoPlayer rulebook (src/data/bf2017/ai.autoplayer.json) from
// the export's `Online/GameSettingsContainer` (scripts/lib/bf2017-autoplayer.mjs).
//
//   node scripts/bf2017-autoplayer.mjs --root <export dir> [--out src/data/bf2017/ai.autoplayer.json] [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { autoPlayerRows } from './lib/bf2017-autoplayer.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const opt = parseArgs(process.argv.slice(2));
if (typeof opt.root !== 'string') {
  console.error('Give --root <export dir>.');
  process.exit(2);
}
const container = JSON.parse(readFileSync(join(opt.root, 'web', 'data', 'Online', 'GameSettingsContainer.json'), 'utf8'));
const rows = autoPlayerRows(container);
if (rows._missing.length) console.warn(`missing: ${rows._missing.join(', ')}`);
const out = { _from: { export: 'Online/GameSettingsContainer', date: new Date().toISOString().slice(0, 10), script: 'scripts/bf2017-autoplayer.mjs' }, rows };
console.log(`aim noise blaster ${rows.aim.noise.blaster.instantAction} × scale ${rows.aim.scale.instantAction} (rookie ${rows.aim.scale.rookie}, normal ${rows.aim.scale.normal}, expert ${rows.aim.scale.expert}); LOF reaction ${rows.lof.reaction.default} s; waves pause attack ${rows.waves.pause.attack} / defend ${rows.waves.pause.defendByPhase.join(' ')}`);
if (opt.dry) process.exit(0);
const file = join(ROOT, opt.out ?? 'src/data/bf2017/ai.autoplayer.json');
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${file}`);
