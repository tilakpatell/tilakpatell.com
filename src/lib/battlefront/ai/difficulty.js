// A difficulty as the game's settings hold it (`Gameplay/Settings/
// GameDifficultySettings`, ai.json's `difficulties`, keyed `<game type>:<name>`):
// what a bot does with it.
//
//   aim       the accuracy penalties (`AccuracyPenaltySettings`): the aim box
//             widened by these when the target crouches, lies prone, sprints or
//             drives; and `scale`, the sprint penalty over the Medium row's (a
//             difficulty's one number for a mode's aim lever: rookie 1.5, normal 1,
//             expert 0.7; by hand, NOTES.md)
//   reaction  seconds from first seeing a target to the first shot, by distance
//             (`FiringDelayAfterAquiringTarget`), and `reacquire` after losing it
//   settle    seconds until the aim box has shrunk to its least, by distance
//             (`TimeUntilAccurateFromStartOfFirstDamage`)
//   damage    a bot's damage to a human player (`BucketDamageAiVsHuman.DamageMultiplier`)
//   health    the human player's health (`HumanHealthModifier`)
//
// Every curve is read clamped to its MinX..MaxX (`curve.js`), never past it. Pure.
//
//   difficultyFor(name, ai) → { key, name, aim, reaction(d), reacquire(d), settle(d), damage, health, curves, row }
//     name: 'rookie' | 'normal' | 'medium' | 'expert' | 'default' (multiplayer), or a full key; null: DEFAULT
//   DEFAULT       the game's multiplayer row       DIFFICULTIES: the multiplayer names

import { curveAt } from './curve.js';

export const DEFAULT = 'multiplayer:default';
export const DIFFICULTIES = ['rookie', 'normal', 'medium', 'expert'];
// The row the aim scale is measured from.
const REFERENCE = 'multiplayer:medium';

const keyOf = (name) => (name == null ? DEFAULT : name.includes(':') ? name : `multiplayer:${name}`);
const penalties = (row) => row?.targeting?.accuracyPenaltySettings ?? {};

export function difficultyFor(name, ai) {
  const key = keyOf(name);
  const row = ai.difficulties?.[key];
  if (!row) throw new Error(`difficulty ${name}: not in the rulebook (${Object.keys(ai.difficulties ?? {}).join(', ')})`);
  const p = penalties(row);
  const ref = penalties(ai.difficulties[REFERENCE]).sprintMultiplier;
  const t = row.targeting ?? {};
  const curves = { reaction: t.firingDelayAfterAquiringTarget ?? null, reacquire: t.firingDelayAfterReaquiringTarget ?? null, settle: t.timeUntilAccurateFromStartOfFirstDamage ?? null };
  const at = (c, fallback) => (d) => (c ? curveAt(c, d) : fallback);
  return {
    key,
    name: row.name ?? key,
    aim: {
      crouch: p.crouchMultiplier ?? 1,
      prone: p.proneMultiplier ?? 1,
      sprint: p.sprintMultiplier ?? 1,
      movingVehicle: p.movingVehicleMultiplier ?? 1,
      vehicleStill: p.vehicleStillMultiplier ?? 1,
      scale: p.sprintMultiplier && ref ? p.sprintMultiplier / ref : 1,
    },
    reaction: at(curves.reaction, 0),
    reacquire: at(curves.reacquire, 0),
    settle: at(curves.settle, null),
    damage: row.bucketDamageAiVsHuman?.damageMultiplier ?? 1,
    health: row.humanHealthModifier ?? 1,
    curves,
    row,
  };
}
