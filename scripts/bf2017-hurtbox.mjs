#!/usr/bin/env node
// Writes the hurtbox rulebook (src/data/bf2017/physics/hurtbox.json): the
// damage multiplier a bolt's material takes against each of the soldier's
// bone materials, as a material pair of the level's grid (bf2-re finding
// 20): the blaster bolt is material 6, the heavy bolt 7; the trooper's head
// capsule carries material 9 (`MaterialPair.Packed >> 22`), the body and
// arms 8, the forearms 70, the lower legs 69, a hero's 123, an AI's 76. The
// grid pair's `MaterialRelationDamageData.DamageProtectionMultiplier` is the
// multiplier (head 1.9× for the blaster, 1.0× everywhere else, no limb
// reduction), `DamageProtectionThreshold` the floor under which a hit does
// nothing. Every level's grid repeats these rows; Hoth's is read.
//
//   node scripts/bf2017-hurtbox.mjs --root <export dir> [--level Hoth_01] [--dry]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const opt = parseArgs(process.argv.slice(2));
if (typeof opt.root !== 'string') {
  console.error('Give --root <export dir>.');
  process.exit(2);
}
const level = opt.level ?? 'Hoth_01';
const GRID = `Levels/MP/${level}/${level}/materialgrid_win32`;
const grid = JSON.parse(readFileSync(join(opt.root, 'web', 'data', `${GRID}.json`), 'utf8'));
const bones = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/physics/bones.json'), 'utf8'));

const data = grid.objects.find((o) => o.$type === 'MaterialGridData');
const deref = (v) => (v && v.$ref != null ? grid.objects[v.$ref] : v);
const map = data.MaterialIndexMap;
const pairOf = (a, b) => {
  const item = data.InteractionGrid[map[a]]?.Items[map[b]];
  const dmg = (item?.PhysicsPropertyProperties ?? []).map(deref).find((p) => p?.$type === 'MaterialRelationDamageData');
  const at = `${GRID}#MaterialGridData.InteractionGrid[${map[a]}].Items[${map[b]}].MaterialRelationDamageData`;
  // (a pair with no damage record is the grid's default: 1× with no floor)
  return { multiplier: dmg?.DamageProtectionMultiplier ?? 1, multiplier_source: `${at}.DamageProtectionMultiplier${dmg ? '' : ' (none: the default)'}`, threshold: dmg?.DamageProtectionThreshold ?? 0, threshold_source: `${at}.DamageProtectionThreshold${dmg ? '' : ' (none: the default)'}` };
};

// The bolts' materials (finding 20: the blaster bolt's row is 6, the heavy's 7).
const BOLT_SOURCE = 'derived: bf2-re finding 20 (the material grid row the blaster bolt and the heavy bolt strike with, from the bolts’ impact rows)';
const BOLTS = { blaster: 6, blaster_source: BOLT_SOURCE, heavy: 7, heavy_source: BOLT_SOURCE };
// the soldier set's bone materials
const set = bones.sets.find((s) => s.id === 'defaultsoldierbonecollision');
const SET = set.source ?? set._source ?? 'Gameplay/Characters/DefaultSoldierBoneCollision';
const parts = {};
for (const b of set.bones) {
  const id = b.material >>> 22;
  parts[b.bone] ??= { material: id, material_source: `${SET}${b.material_source} >> 22` };
}
const materials = [...new Set(Object.values(parts).map((p) => p.material))].sort((a, b) => a - b);
const pairs = {};
for (const bolt of ['blaster', 'heavy']) {
  pairs[bolt] = { material: BOLTS[bolt], material_source: BOLT_SOURCE };
  for (const m of materials) pairs[bolt][m] = pairOf(BOLTS[bolt], m);
}
const out = { _from: { export: GRID, date: new Date().toISOString().slice(0, 10), script: 'scripts/bf2017-hurtbox.mjs' }, rows: { bolts: BOLTS, parts, pairs } };
console.log(`blaster (${BOLTS.blaster}) × head (${parts.Head.material}) = ${pairs.blaster[parts.Head.material].multiplier}; × spine (${parts.Spine.material}) = ${pairs.blaster[parts.Spine.material].multiplier}; heavy × head = ${pairs.heavy[parts.Head.material].multiplier} (threshold ${pairs.heavy[parts.Head.material].threshold})`);
if (opt.dry) process.exit(0);
const file = join(ROOT, 'src/data/bf2017/physics/hurtbox.json');
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${file}`);
