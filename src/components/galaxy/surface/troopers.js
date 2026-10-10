// The 2017 game's four trooper classes as people you can deploy as (the
// flow design's decision 2): Assault, Heavy, Officer and Specialist, for
// each side of a world's war, in the body of that side's trooper here (the
// crew list's kind: a Rebel or, on the ice, a Hoth trooper; a stormtrooper
// or a snowtrooper; a clone; a battle droid), with the class's own gun. The
// health and the game's weapon are src/data/bf2017/classes.json's (the
// Original Trilogy era's: the export's Hoth level fields no other), held to
// it by troopers.test.js rather than imported, so the deploy screen doesn't
// carry the rulebook; the site's gun for each game weapon, the abilities on
// G and V and the Clone Wars rows are by hand (`source: 'hand'`).
//
//   CLASSES                  [{ cls, name, icon, health, game: { light, dark } (the game's weapon ids), guns: { light, dark } (weaponRules.js kinds), abilities }]
//   SIDE_ICONS               side id → the game's faction emblem
//   sidesOf(era)             the two sides of an era's war: [{ id, name, short, stance, icon }]
//   trooperKind(side, sys)   the crew list's kind a side's trooper is here
//   trooperId(side, cls)     a class pick's hero id ('trooper-rebel-assault')
//   TROOPERS                 every side's four, as heroes.js's roster rows: { id, name, tall, src, rig?, weapon, bolt, abilities, blurb, side: 'class', lean, trooper: { side, cls } }
//   troopersFor(side, sys)   that side's four here (the world's own trooper)

import { CREW } from './crewList';
import { SIDES, WARS } from '../sides';

const ICONS = '/battlefront/icons/UI/SVG';
export const CLASSES = [
  { cls: 'assault', name: 'Assault', icon: `${ICONS}/Classes/Class_Troopers_Assault_01.svg`, health: 150, game: { light: 'a280', dark: 'e11' }, guns: { light: 'a280', dark: 'rifle', republic: 'dc15', separatists: 'e5' }, abilities: { power: 'detonator', second: 'sprint' }, about: 'The all-rounder: a rifle, a detonator and a burst of speed.' },
  { cls: 'heavy', name: 'Heavy', icon: `${ICONS}/Classes/Class_Troopers_Heavy_01.svg`, health: 200, game: { light: 'rt97c', dark: 'dlt19' }, guns: { light: 'dlt19', dark: 'dlt19', republic: 'dlt19', separatists: 'e5' }, abilities: { power: 'detonator', second: 'overcharge' }, about: 'A repeater and more health: holds a line.' },
  { cls: 'officer', name: 'Officer', icon: `${ICONS}/Classes/Class_Troopers_Officer_01.svg`, health: 150, game: { light: 'dh17', dark: 'rk3' }, guns: { light: 'blaster', dark: 'blaster', republic: 'blaster', separatists: 'e5' }, abilities: { power: 'detonator', second: 'medpack' }, about: 'A pistol and a medpack: keeps the squad going.' },
  { cls: 'specialist', name: 'Specialist', icon: `${ICONS}/Classes/Class_Troopers_Specialist_01.svg`, health: 150, game: { light: 'dlt20a', dark: 'dlt19x' }, guns: { light: 'ee3', dark: 'ee3', republic: 'ee3', separatists: 'e5' }, abilities: { power: 'sprint', second: 'overcharge' }, about: 'A scoped rifle from a long way off.' },
];

export const SIDE_ICONS = {
  rebel: `${ICONS}/Factions/Icon_RebelAlliance.svg`,
  newrepublic: `${ICONS}/Factions/Icon_RebelAlliance.svg`,
  empire: `${ICONS}/Factions/Icon_GalacticEmpire.svg`,
  remnant: `${ICONS}/Factions/Icon_GalacticEmpire.svg`,
  republic: `${ICONS}/Factions/Icon_GalacticRepublic.svg`,
  separatists: `${ICONS}/Factions/Icon_Separatists.svg`,
};

export function sidesOf(era) {
  const war = Object.values(WARS).find((w) => w.era === era) ?? WARS.gcw;
  return [war.liberator, war.raider].map((id) => ({ ...SIDES[id], icon: SIDE_ICONS[id] }));
}

// (the world's own: on the ice, the cold-weather kit)
const KINDS = { rebel: 'rebel', newrepublic: 'rebel', empire: 'stormtrooper', remnant: 'stormtrooper', republic: 'clone', separatists: 'battledroid' };
const ICE = { rebel: 'hothtrooper', empire: 'snowtrooper' };
export const trooperKind = (side, sys = null) => (sys === 'hoth' && ICE[side]) || KINDS[side] || 'rebel';

export const trooperId = (side, cls) => `trooper-${side}-${cls}`;
const BOLT = { light: '#ff3b30', dark: '#ff3b30', republic: '#4aa8ff', separatists: '#ff3b30' };

function row(side, cls, sys = null) {
  const c = CLASSES.find((x) => x.cls === cls);
  const s = SIDES[side];
  const kind = trooperKind(side, sys);
  const body = CREW[kind];
  const key = s.stance === 'light' ? 'light' : 'dark';
  const gun = c.guns[side] ?? c.guns[key];
  return {
    id: trooperId(side, cls),
    name: `${s.short} ${c.name}`,
    tall: body.tall,
    src: { url: body.url },
    ...(body.rig === 'walrus' ? { rig: 'walrus', pack: null } : {}),
    weapon: gun,
    bolt: BOLT[side] ?? BOLT[key],
    abilities: c.abilities,
    blurb: c.about,
    side: 'class',
    lean: key,
    trooper: { side, cls, kind },
  };
}

const ALL_SIDES = Object.keys(KINDS);
// (every side's four, in their usual kit: what a kept pick is read back as)
export const TROOPERS = ALL_SIDES.flatMap((side) => CLASSES.map((c) => row(side, c.cls)));
export const troopersFor = (side, sys = null) => CLASSES.map((c) => row(side, c.cls, sys));
