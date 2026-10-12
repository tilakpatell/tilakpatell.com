// The Battlefront world's sounds by name: src/data/bf2017/sounds.json, the
// index scripts/bf2017-sounds.mjs writes from the game's export (the set is
// scripts/lib/bf2017-sounds.mjs's), each name a row { files, bytes,
// seconds, stereo, loop, gain, asset }. Pure.
//
//   rowOf(name) → the row, or null
//   urlOf(file) → the site path of a take's file (the asset base resolves it: lib/assetBase)
//   pickTake(row, history, rng) → a take's index, never one of the last three played
//     (the game's VariationHistoryCount 3; `history` is the name's last picks, newest last)
//   gunOf(weaponId, team) → the blaster set's key ('e11' …), the side's rifle when the weapon has none
//   abilityCues(id, phase) → the names an ability's phase plays
//   totalBytes(index) → the set's bytes; NAMES: every name

import INDEX from '../../../data/bf2017/sounds.json';

export const DIR = `/${INDEX.dir ?? 'audio/galaxy/bf2017'}`;
export const ROWS = INDEX.rows ?? {};
export const NAMES = Object.keys(ROWS);
export const rowOf = (name) => ROWS[name] ?? null;
export const urlOf = (file) => `${DIR}/${file}`;
export const totalBytes = (index = INDEX) => Object.values(index.rows ?? {}).reduce((s, r) => s + (r.bytes ?? 0), 0);

export const HISTORY = 3;
export function pickTake(row, history = [], rng = Math.random) {
  const n = row?.files?.length ?? 0;
  if (n <= 1) return 0;
  const recent = new Set(history.slice(-Math.min(HISTORY, n - 1)));
  const open = [];
  for (let i = 0; i < n; i++) if (!recent.has(i)) open.push(i);
  return open[Math.min(open.length - 1, Math.floor(rng() * open.length))];
}

// the weapons whose takes the set holds (scripts/lib/bf2017-sounds.mjs's GUNS); another
// weapon takes its side's rifle (the Empire's E-11, the Rebellion's A280)
const GUNS = new Set(['e11', 'dlt19', 'rk3', 'dlt19x', 'a280', 'rt97c', 'dh17', 'dlt20a']);
export const gunOf = (weaponId, team = 2) => (weaponId && GUNS.has(weaponId) ? weaponId : team === 2 ? 'e11' : 'a280');

// the four kits' abilities (abilities.json ids) → the cues by phase
const ABILITIES = {
  DefaultAbility_Assault_ThermalDetonator: { start: ['ability.thermal.click', 'ability.thermal.beeps'], end: ['ability.explosion.close', 'ability.explosion.reflection'] },
  DefaultAbility_Assault_Vanguard: { start: ['ability.vanguard.start', 'ability.vanguard.pump'], end: ['ability.vanguard.stop'] },
  DefaultAbility_Assault_ScanDart: { start: ['ability.scanDart.shot'], active: ['ability.scanDart.ping'] },
  DefaultAbility_Heavy_ImpactGrenade: { start: ['ability.impact.beep'], end: ['ability.explosion.close', 'ability.explosion.reflection'] },
  DefaultAbility_Heavy_Sentry: { start: ['ability.sentry.start'], end: ['ability.sentry.stop'] },
  DefaultAbility_Heavy_CombatShield: { start: ['ability.shield.start'], end: ['ability.shield.stop'] },
  DefaultAbility_Officer_SplitterGrenade: { start: ['ability.thermal.click'], active: ['ability.splitter.split'], end: ['ability.explosion.close'] },
  DefaultAbility_Officer_BattleCommand: { start: ['ability.command.start'] },
  DefaultAbility_Officer_BlasterTurret: { start: ['ability.turret.chargeUp', 'ability.turret.beep'], end: ['ability.turret.stop'] },
  DefaultAbility_Specialist_ShockGrenade: { start: ['ability.shock.beep', 'ability.shock.charge'], end: ['ability.explosion.close'] },
  DefaultAbility_Specialist_Infiltration: { start: ['ability.infiltration.start'], end: ['ability.infiltration.stop'] },
  DefaultAbility_Specialist_ScoutBinoculars: {},
};
export const abilityCues = (id, phase) => ABILITIES[id]?.[phase] ?? [];
export const ABILITY_IDS = Object.keys(ABILITIES);
