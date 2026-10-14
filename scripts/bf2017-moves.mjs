#!/usr/bin/env node
// The heroes' and reinforcements' moves as the soldier state machine times
// them: src/data/bf2017/moves.json. For each character-state ability the
// units carry (unitKit.json's kits, abilities.json's rows: `activeWhen
// CurrentAbility = n`) and each kit's evade, the move that keys that
// CurrentAbility on the unit's own animation names (scripts/lib/bf2017-moves.mjs
// says how it is picked and read): how long it holds the ability Active, when
// its prefab lays its affectors (TriggerAffectorEnum) and for how long, its
// hyper-armour, the ticks its ability, evade and movement branches open, and
// the game's clip it plays (named through bf2-re's ANT summary). Every number
// keeps the node it came from.
//
//   node scripts/bf2017-moves.mjs --web C:/Users/tilak/Downloads/BF2_Extract/web [--out src/data/bf2017/moves.json]
//
// It reads <web>/data/Gameplay/SoldierStateMachine/DefaultSoldierStateMachine.json (119 MB) and
// <web>/ant/ebx_state_machine.json (bf2-re tools/ant-tuning.py: the clip controllers' ANT clip names, in the
// machine's object order).

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { indexMachine, movesFor, pickMove, summary } from './lib/bf2017-moves.mjs';
import { checkSources } from './lib/bf2017-rulebook.mjs';

const EXPORT = 'build 489592';
const args = parseArgs(process.argv.slice(2));
if (typeof args.web !== 'string') throw new Error('--web <export web dir> is required');
const out = args.out ?? 'src/data/bf2017/moves.json';
const MACHINE = 'Gameplay/SoldierStateMachine/DefaultSoldierStateMachine';
const read = (f) => JSON.parse(readFileSync(join('src/data/bf2017', f), 'utf8'));
const rows = read('abilities.json').rows;
const kits = read('unitKit.json').kits;

// each unit's names in the machine's nodes and flows (the animators' spellings: Anakin's are "Martin"'s, the
// Emperor's Palpatine's; the jump packs' node is the shared Physics.JumpPack)
const NAMES = {
  luke: ['Luke'],
  leia: ['Leia'],
  hansolo: ['Han'],
  chewbacca: ['Chewbacca'],
  lando: ['Lando'],
  yoda: ['Yoda'],
  obiwan: ['ObiWan'],
  anakin: ['Anakin', 'Martin'],
  bobafett: ['Boba'],
  bossk: ['Bossk'],
  darthvader: ['Vader'],
  emperor: ['Palpatine'],
  maul: ['Maul'],
  iden: ['Iden'],
  grievous: ['Grievous'],
  dooku: ['Dooku'],
  WookieWarrior: ['Wookie'],
  RebelJumpTrooper: ['JumpPack'],
  JumpTrooper: ['JumpPack'],
  EwokRebel: ['Ewok'],
  DeathTrooper: ['DeathTrooper'],
  ISBAgent: ['ISB'],
};

// (the units that carry a pistol: their dodge is the pistol stance's)
const PISTOLS = new Set(['leia', 'hansolo', 'lando', 'ISBAgent']);

const t0 = Date.now();
const objects = JSON.parse(readFileSync(join(args.web, 'data', `${MACHINE}.json`), 'utf8')).objects;
const ant = JSON.parse(readFileSync(join(args.web, 'ant', 'ebx_state_machine.json'), 'utf8')).machines.DefaultSoldierStateMachine.clipControllers;
const m = indexMachine(
  objects,
  ant.map((c) => Object.assign(c.clips.map((x) => x.controller?.$name ?? null), { self: c.controller?.$class === 'ClipControllerAsset' ? c.controller.$name : null })),
);
console.error(`machine: ${objects.length} objects, ${ant.length} clip controllers, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const valueOf = (row) => (row?.activeWhen ?? []).find((c) => c.channel === 'CurrentAbility')?.values.find((v) => v !== 0) ?? null;
const moves = {};
const missing = [];
for (const [unit, kit] of Object.entries(kits)) {
  const names = NAMES[unit] ?? [unit];
  const asks = kit.abilities.map((id) => ({ id, row: rows[id] }));
  if (kit.evade) asks.push({ id: `${unit}:evade`, row: kit.evade });
  for (const { id, row } of asks) {
    const value = valueOf(row);
    if (value == null) continue;
    // (an evade is the unit's own dodge, or the shared pistol's or rifle's by the gun it carries)
    const evade = value === 17;
    const own = evade ? names.map((n) => `${n}.Dodge`) : names;
    const pick = pickMove(movesFor(m, value, own)) ?? (evade ? pickMove(movesFor(m, value, [PISTOLS.has(unit) ? 'A.Pistol.Dodge' : 'A.Rifle.Dodge'])) : null);
    if (!pick) {
      missing.push(`${unit} ${id}: CurrentAbility ${value}`);
      continue;
    }
    const s = summary(m, pick);
    (moves[unit] ??= {})[row.id === id || id.endsWith(':evade') ? (id.endsWith(':evade') ? 'evade' : id) : id] = { value, ...s, _source: `${MACHINE}#${s.flow ? `${s.flow}/` : ''}${s.node}` };
  }
}
// the classes' roll (Ability_<Class>_CombatRoll_CharacterState, CurrentAbility 17): the rifle's dodge, the heavy's the gunner's
for (const [cls, names] of [['trooper', ['A.Rifle.Dodge']], ['heavy', ['A.Gunner.Dodge']]]) {
  const pick = pickMove(movesFor(m, 17, names));
  if (pick) {
    const s = summary(m, pick);
    (moves[cls] ??= {}).evade = { value: 17, ...s, _source: `${MACHINE}#${s.node}` };
  } else missing.push(`${cls} roll`);
}
for (const x of missing) console.error(`no move: ${x}`);
const head = readFileSync(join(args.web, 'data.tsv')).subarray(0, 65536);
const json = { _from: { export: EXPORT, date: new Date().toISOString().slice(0, 10), root: createHash('sha1').update(head).digest('hex'), ticks: 60 }, moves };
const bad = checkSources(json);
if (bad.length) {
  console.error(`${bad.length} numbers without a source, first ${bad.slice(0, 5).join(', ')}`);
  process.exit(1);
}
const text = `{"_from": ${JSON.stringify(json._from)}, "moves": {\n${Object.entries(moves)
  .map(([k, r]) => `${JSON.stringify(k)}: ${JSON.stringify(r)}`)
  .join(',\n')}\n}}\n`;
writeFileSync(out, text);
console.log(`${out}: ${Object.values(moves).reduce((n, r) => n + Object.keys(r).length, 0)} moves of ${Object.keys(moves).length} units, ${missing.length} not found, ${(text.length / 1024).toFixed(1)} KB`);
