// Who flies what, in which war: the one table that says which of the
// galaxy's sides (sides.js) may fly each ship kind in each of its wars, as
// what, with which guns, and the colour of each side's bolts. Every table
// that picks a ship for a side (battles.js's lines and fighters,
// battlesWars.js, warEffects.js's OWNERS, roamRules.js, hunted.js, the
// interdiction's pack, the systems' scenery) reads it or is held to it by
// rosterAudit.js. Pure, tested. The design:
// docs/superpowers/specs/2026-10-09-space-battles-design.md, piece 1.
//
// The canon it keeps: the Clone Wars are the Republic's Venators,
// Acclamators and ARC-170s against the droids' Providences, Lucrehulks and
// Munificents; the Civil War is the Empire against the Rebellion; the
// Remnant War is the New Republic, flying the Rebellion's ships, against
// what's left of the Empire (no Executor, no Vader's TIE Advanced, no
// Thrawn's Defenders). No sequel trilogy ship, place or name; after Episode
// 6 only The Mandalorian and Ahsoka. A ship of more than one war is in each
// (the CR90 is the Republic's in Episode 3; the BTL-B Y-wing flew in the
// Clone Wars). The Hutts fly theirs in every war.
//
// SHIPS: { [kind]: { sides: [side id | null] | null, wars: [war id], class,
//   guns?, tail? } }. `sides: null` is anyone's (civilians, bounty
//   hunters); a `null` among the sides is a ship nobody's sworn may fly (the
//   Falcon). class: 'capital' | 'frigate' | 'transport' | 'shuttle' |
//   'fighter' | 'interceptor' | 'bomber' | 'hero' | 'civil'.
// allowed(kind, war, side) → whether that side flies it in that war (an
//   unknown kind: no); rosterOf(war, side, cls) → its kinds of that class;
// RUNNERS / runnerOf(battleKind, side): who runs an evacuation or a
//   blockade, by side; battleKindIn(kind, war) → the kind of battle a
//   system's is in that war (an interdiction needs an Interdictor: a war
//   whose raider has none, the Clone Wars, fights it as a siege); LOOKS / lookOf(side): { laser, turbo } (RGB, hot
//   enough to bloom: the fighters' bolts and the batteries').

import { WARS } from './sides';

const C = ['clone'];
const G = ['gcw'];
const R = ['remnant'];
const GR = ['gcw', 'remnant'];
const ALL = ['clone', 'gcw', 'remnant'];
const REB = ['rebel', 'newrepublic'];
const IMP = ['empire', 'remnant'];

export const SHIPS = {
  // the Clone Wars
  venator: { sides: ['republic'], wars: C, class: 'capital' },
  acclamator: { sides: ['republic'], wars: C, class: 'capital' },
  arc170: { sides: ['republic'], wars: C, class: 'fighter', guns: ['laser', 'torpedo'], tail: true },
  delta7: { sides: ['republic'], wars: C, class: 'interceptor', guns: ['laser'] },
  nubian: { sides: ['republic'], wars: C, class: 'transport' },
  providence: { sides: ['separatists'], wars: C, class: 'capital' },
  lucrehulk: { sides: ['separatists'], wars: C, class: 'capital' },
  munificent: { sides: ['separatists'], wars: C, class: 'capital' },
  coreship: { sides: ['separatists'], wars: C, class: 'transport' },
  vulture: { sides: ['separatists'], wars: C, class: 'fighter', guns: ['laser'] },
  trifighter: { sides: ['separatists'], wars: C, class: 'interceptor', guns: ['laser', 'discord'] },
  // more than one war
  corvette: { sides: ['republic', ...REB, 'hutt'], wars: ALL, class: 'frigate' },
  ywing: { sides: ['republic', ...REB], wars: ALL, class: 'bomber', guns: ['laser', 'ion', 'torpedo'] },
  n1: { sides: ['republic', null], wars: ['clone', 'remnant'], class: 'fighter', guns: ['laser'] },
  // the Empire, and what's left of it
  destroyer: { sides: IMP, wars: GR, class: 'capital' },
  executor: { sides: ['empire'], wars: G, class: 'capital' },
  interdictor: { sides: IMP, wars: GR, class: 'capital' },
  lightcruiser: { sides: IMP, wars: GR, class: 'capital' },
  gozanti: { sides: [...IMP, 'hutt'], wars: ALL, class: 'frigate' },
  shuttle: { sides: [...IMP, ...REB], wars: GR, class: 'shuttle' },
  tie: { sides: IMP, wars: GR, class: 'fighter', guns: ['laser'] },
  interceptor: { sides: IMP, wars: GR, class: 'interceptor', guns: ['laser'] },
  tiebomber: { sides: IMP, wars: GR, class: 'bomber', guns: ['laser', 'bomb'] },
  tieadvanced: { sides: ['empire'], wars: G, class: 'fighter', guns: ['laser', 'missile'] },
  tiestriker: { sides: ['empire'], wars: G, class: 'fighter', guns: ['laser'] },
  tiedefender: { sides: ['empire'], wars: G, class: 'interceptor', guns: ['laser', 'ion', 'missile'] },
  gunboat: { sides: IMP, wars: GR, class: 'fighter', guns: ['laser', 'missile'] },
  missileboat: { sides: IMP, wars: GR, class: 'fighter', guns: ['laser', 'missile'] },
  repairshuttle: { sides: IMP, wars: GR, class: 'shuttle' },
  // the Rebellion, and the New Republic after it
  moncal: { sides: REB, wars: GR, class: 'capital' },
  nebulon: { sides: REB, wars: GR, class: 'capital' },
  hammerhead: { sides: REB, wars: GR, class: 'frigate' },
  transport: { sides: REB, wars: GR, class: 'transport' },
  xwing: { sides: REB, wars: GR, class: 'fighter', guns: ['laser', 'torpedo'] },
  awing: { sides: REB, wars: GR, class: 'interceptor', guns: ['laser', 'missile'] },
  bwing: { sides: REB, wars: GR, class: 'bomber', guns: ['laser', 'ion', 'torpedo'] },
  uwing: { sides: REB, wars: GR, class: 'fighter', guns: ['laser'] },
  ghost: { sides: REB, wars: GR, class: 'hero', guns: ['laser'] },
  redleader: { sides: REB, wars: GR, class: 'hero', guns: ['laser', 'torpedo'] }, // (Wedge's X-wing, the hunters' ace)
  falcon: { sides: [...REB, null], wars: GR, class: 'hero', guns: ['laser'] },
  // the Hutts'
  skiff: { sides: ['hutt'], wars: ALL, class: 'fighter', guns: ['laser'] },
  // anyone's: freighters, bounty hunters, the shows' ships
  freighter: { sides: null, wars: ALL, class: 'civil' },
  slave1: { sides: null, wars: ALL, class: 'civil' },
  ig2000: { sides: null, wars: ALL, class: 'civil' },
  houndstooth: { sides: null, wars: ALL, class: 'civil' },
  punishingone: { sides: null, wars: ALL, class: 'civil' },
  cloudcar: { sides: null, wars: ALL, class: 'civil' },
  razorcrest: { sides: null, wars: R, class: 'civil' },
  gauntlet: { sides: null, wars: ALL, class: 'civil' },
};

export function allowed(kind, war, side) {
  const s = SHIPS[kind];
  return Boolean(s) && s.wars.includes(war) && (s.sides === null || s.sides.includes(side ?? null));
}

export const rosterOf = (war, side, cls) => Object.keys(SHIPS).filter((k) => SHIPS[k].class === cls && allowed(k, war, side));

// who runs the gauntlet: an evacuation's ships, a blockade's
export const RUNNERS = {
  evacuation: { republic: 'corvette', rebel: 'transport', newrepublic: 'transport', separatists: 'coreship', empire: 'gozanti', remnant: 'gozanti', hutt: 'gozanti' },
  blockade: { republic: 'corvette', rebel: 'corvette', newrepublic: 'corvette', separatists: 'coreship', empire: 'gozanti', remnant: 'gozanti', hutt: 'gozanti' },
};
export const runnerOf = (battleKind, side) => RUNNERS[battleKind]?.[side] ?? null;

export const battleKindIn = (kind, war) => (kind === 'interdiction' && !rosterOf(war, WARS[war]?.raider, 'capital').includes('interdictor') ? 'siege' : kind);

// each side's bolts: its fighters' (laser) and its batteries' (turbo). The
// Rebellion's and the Empire's are the universe map's own (universe/wars.js);
// the Republic's fighters fire red and its Venators blue, as in the films
const REBEL = { laser: [5.8, 0.75, 0.55], turbo: [6.5, 1.1, 0.6] };
const IMPERIAL = { laser: [0.5, 5.5, 0.9], turbo: [0.7, 6.5, 1.2] };
export const LOOKS = {
  republic: { laser: [5.8, 0.75, 0.55], turbo: [0.6, 2.2, 6.5] },
  separatists: { laser: [6.2, 0.7, 0.4], turbo: [6.2, 0.7, 0.4] },
  rebel: REBEL,
  empire: IMPERIAL,
  newrepublic: REBEL,
  remnant: IMPERIAL,
  hutt: { laser: [6.0, 3.0, 0.6], turbo: [6.5, 3.4, 0.8] },
};
export const lookOf = (side) => LOOKS[side] ?? REBEL;
