// Whose galaxy you fly in, system by system: the side a star system is on
// (universe/sides.js's shape, so universe/director.js can run the galaxy as
// it runs the universe map), from who holds it (systems.js's `faction`:
// the Empire, the Separatists, the Imperial remnant, or nobody). Pure, so
// it's tested in Node; galaxy/roam.js wraps the director with it.
//
// The Empire's worlds: TIEs by the pack with Vader among them, a Star
// Destroyer now and then launching bombers and a gunboat, the bounty hunters
// (Fett, IG-88, Bossk, Dengar) after you alone. The remnant's: Moff
// Gideon's TIEs, his cruiser as the capital ship, and Fett (the only one of
// the four still at it). The Separatists': vulture droids and tri-fighters,
// no capital ship (the Confederacy's are a battle, not a drop-in), no bounty
// hunters. Nobody's (Dagobah, Alderaan's rubble, Sorgan): nothing hunts
// you, but a bounty hunter can still find you. Everywhere: Weequay pirates
// (Hondo's gang) after whoever's in distress, and the purrgil passing.
//
// And in the galaxy's wars, by who holds the system (warEffects.js's
// effects, when there are some): its holder's hunters if you're not on its
// side (the Rebellion's X-wings, the Republic's ARC-170s, the Hutts'
// nobody), a Mon Calamari cruiser or a Venator for the Star Destroyer,
// nothing of theirs if you are, but your side's wing to meet you (`escort`);
// the droids still on a Separatist world whoever holds it; and the bounty
// hunters twice as keen in Hutt space or after a deserter.
//
// galaxySide(sys, effects) → side | null (null without a system), the same
//   object for the same faction and effects, so a scene can keep what it
//   built for one.
// ROAM_EVENTS: the director's events the galaxy plays now (Phase 1,
//   "Outlaws": the hunt, the Star Destroyer and the bounty hunter; and your
//   side's escort).

import { EVENTS } from '../universe/director';
import { SIDES } from '../universe/sides';
import { FACTIONS as GALAXY_FACTIONS, KINDS as GALAXY_KINDS, NAMES as GALAXY_NAMES } from './hunted';

const SW = SIDES.starwars;
const NO_HUNT = Object.freeze([]);

export const ROAM_EVENTS = Object.freeze({ hunt: EVENTS.hunt, destroyer: EVENTS.destroyer, bounty: EVENTS.bounty, escort: { needs: 'escort', weight: 1.2, heat: 0 } });

// each faction's factions by role (the galaxy's hunted.js rows, which carry
// the universe map's Empire and bounty hunters)
export const ROLES = {
  empire: { hunt: ['empire'], capital: 'navy', capitalShip: 'destroyer', bounty: ['fett', 'ig88', 'bossk', 'dengar'], pieces: ['destroyer'] },
  remnant: { hunt: ['remnant'], capital: 'navy', capitalShip: 'destroyer', bounty: ['fett'], pieces: ['destroyer'] },
  separatists: { hunt: ['separatists'], capital: null, capitalShip: null, bounty: NO_HUNT, pieces: [] },
  none: { hunt: NO_HUNT, capital: null, capitalShip: null, bounty: ['fett', 'bossk', 'dengar'], pieces: [] },
  // (the war's other holders: warEffects.js's garrisons)
  rebellion: { hunt: ['rebellion'], capital: 'rebelnavy', capitalShip: 'moncal', bounty: ['fett', 'ig88', 'bossk', 'dengar'], pieces: ['destroyer'], escort: ['xwing', 'awing', 'ywing'] },
  newrepublic: { hunt: ['newrepublic'], capital: 'rebelnavy', capitalShip: 'moncal', bounty: ['fett'], pieces: ['destroyer'], escort: ['xwing', 'awing'] },
  republic: { hunt: ['republic'], capital: 'republicnavy', capitalShip: 'venator', bounty: NO_HUNT, pieces: ['destroyer'], escort: ['arc170', 'delta7'] },
  hutt: { hunt: NO_HUNT, capital: null, capitalShip: null, bounty: ['fett', 'ig88', 'bossk', 'dengar'], pieces: [] },
};
// your side's wing, where it has one of its own (else the holder's ROLES `escort`)
export const ESCORTS = { empire: ['tie', 'interceptor'], remnant: ['tie', 'interceptor'], separatists: ['vulture', 'trifighter'] };
const LABELS = { empire: 'The Empire’s space', remnant: 'The Imperial remnant’s space', separatists: 'The Separatists’ space', none: 'Open space', rebellion: 'The Rebellion’s space', newrepublic: 'The New Republic’s space', republic: 'The Republic’s space', hutt: 'Hutt space' };

// `friendly`: your side's space (no hunt, no capital ship, an escort);
// `droids`: the Separatists' leftovers hunt here too; `keen`: the bounty
// hunters come twice as often (Hutt space, a deserter)
const make = (key, { friendly = false, droids = false, keen = false } = {}) => {
  const base = ROLES[key];
  const hunt = [...(friendly ? NO_HUNT : base.hunt), ...(droids && !base.hunt.includes('separatists') ? ['separatists'] : [])];
  const r = { ...base, hunt, capital: friendly ? null : base.capital, capitalShip: friendly ? null : base.capitalShip, pieces: friendly ? [] : base.pieces };
  const escort = friendly ? (ESCORTS[key] ?? base.escort ?? []) : [];
  const factions = {};
  const add = (id, role) => {
    const f = GALAXY_FACTIONS[id];
    if (!f) throw new Error(`galaxy side: no faction ${id}`);
    factions[id] = { ...f, role, weight: (f.weight ?? 1) * (keen && role === 'bounty' ? 2 : 1), family: 'starwars' };
  };
  for (const id of r.hunt) add(id, 'hunt');
  if (r.capital) add(r.capital, 'capital');
  for (const id of r.bounty) add(id, 'bounty');
  add('weequay', 'pirates');
  const roles = new Set(Object.values(factions).map((f) => f.role));
  const side = {
    id: `galaxy-${key}${friendly ? '-friendly' : ''}${droids ? '-droids' : ''}${keen ? '-keen' : ''}`,
    label: LABELS[key],
    crews: [], // (every crew flies here: a crew's side is the universe map's, this is the system's)
    factions,
    kinds: GALAXY_KINDS,
    names: GALAXY_NAMES,
    allies: SW.allies,
    traffic: SW.traffic,
    civil: SW.civil,
    convoy: SW.convoy,
    distress: SW.distress,
    skirmish: r.hunt.length ? { ...SW.skirmish, faction: r.hunt[0] } : null,
    pieces: r.pieces,
    capital: r.capital,
    capitalShip: r.capitalShip,
    leviathan: SW.leviathan,
    troops: SW.troops,
    squads: SW.squads,
    ahead: {},
    escort,
    has: (need) => roles.has(need) || (need === 'escort' && escort.length > 0) || r.pieces.includes(need) || (need === 'pirates' && Boolean(SW.distress.pirates)) || (need === 'leviathan' && Boolean(SW.leviathan)),
  };
  return Object.freeze(side);
};
const BY_FACTION = { empire: make('empire'), remnant: make('remnant'), separatists: make('separatists'), none: make('none') };
// a system out of the war is its own faction's, if that faction's in the war
// you're in: the Empire's worlds are the Remnant's after it, and nobody's in
// the Clone Wars; the Separatists' are theirs only then
const FACTION_IN = { empire: { gcw: 'empire', remnant: 'remnant' }, remnant: { gcw: 'empire', remnant: 'remnant' }, separatists: { clone: 'separatists' } };
const factionIn = (faction, war) => (!war || !FACTION_IN[faction] ? (faction ?? 'none') : (FACTION_IN[faction][war] ?? 'none'));
const made = new Map();

export function galaxySide(sys, effects = null, war = null) {
  if (!sys) return null;
  if (!effects) return BY_FACTION[factionIn(sys.faction, war)] ?? BY_FACTION.none;
  // (unsworn, the holder's garrison comes for you as it always has; sworn,
  // only if you're not on its side)
  const opts = { friendly: effects.escort && !effects.hunt, droids: effects.droids, keen: effects.owner === 'hutt' || effects.deserter };
  const key = ROLES[effects.garrison] ? effects.garrison : 'none';
  const id = `${key}:${opts.friendly}:${opts.droids}:${opts.keen}`;
  if (!made.has(id)) made.set(id, make(key, opts));
  return made.get(id);
}
export const GALAXY_SIDES = BY_FACTION;

// the bounty hunter who comes: the one picked, or (Fett, while Slave I's
// model is still on its way) another of those who hunt here, or nobody this
// time; never the Empire's ace in his place
export function bountyFor(who, loaded, ids) {
  if (who !== 'fett' || loaded('slave1')) return who;
  return ids.find((id) => id !== 'fett') ?? null;
}
