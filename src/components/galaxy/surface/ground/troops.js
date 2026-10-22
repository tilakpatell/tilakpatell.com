// One table of troops for everyone who fights on the ground: each kind's
// health, gun, senses, pace and nerve, the kinds each side fields, and the
// soldier a spec becomes. The old tables that named the same kinds
// (activity.js's ARMS, garrison.js's FAMILIES, needs.js's SOLDIERS) are
// kept here, with their values, and re-exported under their names. Pure,
// tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 5.
//
// TROOPS[kind] → { hp, weapon (weaponRules.js's WEAPONS key, or null), range,
//   speed, cone (cos of the half-angle it sees across), nerve (how much its
//   squad's confidence moves it: a droid never breaks), tall, shield?,
//   template (the game's AI template its mind plays: ai.json's `templates`),
//   tactics (that template's tactics table), source ('game' where the hp and
//   the gun's damage are the game's, 'hand' where the game has no such
//   soldier: NOTES.md), game? ({ cls, special, hp, gun }: the records it
//   was read from) };
// GAME_GUNS[id] → the game's gun (weapons.json's family, rate and damage);
// KINDS_OF_SIDE[side] → [kind]; kindFor(side, rand); newSoldier(spec, rand)
// → Soldier; damageOf(weapon, dist, s?) (a soldier of a kind the game has:
// its gun's damage at that distance); falloff(damage, dist); onYou(s,
// damage) → that damage on your health; hurt(s, damage) → 'hurt' | 'down';
// hpOf(spec) → a quest spec's hp on this scale.

import { weaponOf } from '../weaponRules';

// The game's guns the ground's soldiers carry (weapons.json: the family its
// AI weapon and firing patterns are read by, the rate of fire, the damage
// and its falloff), copied here so the galaxy's chunk carries these few
// numbers and not the record; troops.test.js holds each to the record.
const RIFLE_DAMAGE = { start: 36, end: 19, startDistance: 20, endDistance: 40 };
export const GAME_GUNS = {
  e11: { family: 'rifle', rof: 300, damage: RIFLE_DAMAGE },
  a280: { family: 'rifle', rof: 300, damage: RIFLE_DAMAGE },
  e11d: { family: 'special', rof: 300, damage: { start: 40, end: 25, startDistance: 20, endDistance: 40 } },
};
// The game's soldiers for the kinds it has: the class (classes.json, the
// Original Trilogy's assault classes, whose look the troopers of each world
// are) or the special (reinforcements.json), its health and its gun. The
// game has no class for the Clone Wars, the droids, the Hutts' men or the
// walkers: those rows stay the galaxy's own (`source: 'hand'`, NOTES.md).
const IMPERIAL = { cls: 'd-orig-assault', hp: 150, gun: 'e11' };
const REBEL = { cls: 'l-orig-assault', hp: 150, gun: 'a280' };

const T = (hp, weapon, o = {}) => ({ hp, weapon, range: 48, speed: 3.2, cone: 0.3, nerve: 1, tall: 1.8, template: 'rifleman', tactics: 'Rifleman_Tactics', source: 'hand', ...o });
// a row on the game's numbers: its hp the record's, its template the class's
const G = (game, weapon, o = {}) => T(game.hp, weapon, { source: 'game', game, ...o });
const HEAVY = { template: 'heavy', tactics: 'Heavy_Tactics' };
const CLOSE = { template: 'closerange', tactics: 'CloseRange_Tactics' };
export const TROOPS = {
  stormtrooper: G(IMPERIAL, 'rifle'),
  sandtrooper: G(IMPERIAL, 'rifle'),
  snowtrooper: G(IMPERIAL, 'rifle'),
  // (the scout's pistol is the galaxy's: the game's scout is its specialist, a long rifle's)
  scouttrooper: T(90, 'blaster', { speed: 3.6 }),
  deathtrooper: G({ special: 'DeathTrooper', hp: 320, gun: 'e11d' }, 'rifle', { range: 56, nerve: 0.5 }),
  shoretrooper: G(IMPERIAL, 'rifle'),
  probe: T(40, null, { range: 60, cone: 0.1, nerve: 0, speed: 2, tall: 2.2 }),
  rebel: G(REBEL, 'a280', { range: 52 }),
  hothtrooper: G(REBEL, 'a280', { range: 52 }),
  clone: T(100, 'dc15', { range: 52 }),
  clonephase1: T(100, 'dc15', { range: 52 }),
  battledroid: T(60, 'e5', { range: 40, speed: 2.6, nerve: 0, cone: 0.4 }),
  superdroid: T(160, 'rifle', { range: 44, speed: 2.4, nerve: 0, ...HEAVY }),
  droideka: T(120, 'e5', { range: 44, speed: 2, nerve: 0, shield: 3, tall: 1.4, ...HEAVY }),
  dwarfspider: T(200, 'dlt19', { range: 50, speed: 2, nerve: 0, tall: 1.6, ...HEAVY }),
  mercenary: T(90, 'westar', { range: 40, speed: 3.4, nerve: 1.3, ...CLOSE }),
  weequay: T(90, 'westar', { range: 40, speed: 3.4, nerve: 1.3, ...CLOSE }),
  // (the walkers stay actors.js's: the rows are here so every kind has one)
  atst: T(800, 'dlt19', { range: 80, speed: 2.2, nerve: 0, tall: 8.6, ...HEAVY }),
  atrt: T(300, 'dlt19', { range: 60, speed: 3, nerve: 0, tall: 3.2, ...HEAVY }),
  atap: T(700, 'dlt19', { range: 80, speed: 1.6, nerve: 0, tall: 6, ...HEAVY }),
  atte: T(1200, 'dlt19', { range: 90, speed: 1.4, nerve: 0, tall: 6, ...HEAVY }),
};

// the kinds each side puts on the ground (figures.js draws every one; the
// first is warEffects.js's `troops` for the side)
export const KINDS_OF_SIDE = {
  empire: ['stormtrooper'],
  remnant: ['stormtrooper'],
  rebel: ['rebel'],
  newrepublic: ['rebel'],
  republic: ['clone'],
  separatists: ['battledroid'],
  hutt: ['mercenary'],
};
export const kindFor = (side, rand = Math.random) => {
  const kinds = KINDS_OF_SIDE[side] ?? [];
  return kinds.length ? kinds[Math.floor(rand() * kinds.length) % kinds.length] : null;
};

// a kind in a world's own uniform (a site's `uniforms`: Hoth's Empire in
// snow armour, its Rebels in parkas); the kind itself where it has none
export const dressOf = (kind, uniforms) => uniforms?.[kind] ?? kind;

// ── the old tables, one place ──
// what a quest's hostile carries in its hand, by kind (universe/gunplay.js's GUNS: activity.js)
export const ARMS = {
  tusken: 'sniper',
  jango: 'westar',
  greedo: 'blaster',
  aqualish: 'blaster',
  scouttrooper: 'blaster',
  stormtrooper: 'e11',
  sandtrooper: 'e11',
  snowtrooper: 'e11',
  shoretrooper: 'e11',
  deathtrooper: 'e11',
  clone: 'dc15',
  battledroid: 'e5',
  mercenary: 'rifle',
  hothtrooper: 'a280',
  rebel: 'a280',
};
// the troopers of each side's look, as the sites name them (garrison.js)
export const FAMILIES = {
  stormtrooper: ['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper'],
  rebel: ['rebel', 'hothtrooper'],
  clone: ['clone'],
  battledroid: ['battledroid', 'superdroid'],
  mercenary: ['mercenary'],
};
// the ones with a gun who stand their ground and raise it (needs.js)
export const SOLDIERS = new Set(['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper', 'shoretrooper', 'deathtrooper', 'tiepilot', 'officer', 'clone', 'rex', 'battledroid', 'superdroid', 'rebel', 'hothtrooper', 'wingguard', 'senateguard', 'bobafett', 'greedo', 'jango', 'mando', 'bokatan', 'fennec', 'caradune', 'ig11', 'greef']);

// ── soldiers ──
export const hpOf = (spec) => (spec?.hp ?? 10) * 10;

// a game gun's damage at a distance: its start out to the falloff's start,
// down to its end at the falloff's end, its end past it (the projectile's
// WSBulletEntityData, as the Battlefront world's weapons.js reads it)
export function falloff(damage, dist) {
  const { start, end, startDistance: a, endDistance: b } = damage;
  if (dist <= a) return start;
  if (dist >= b) return end;
  return +(start + ((end - start) * (dist - a)) / (b - a)).toFixed(3);
}

// a soldier of a kind the game has fires its gun's damage; the rest, and a
// shot with no soldier named, the galaxy's own (ten a point of the gun's,
// falling past two thirds of its range)
export function damageOf(weapon, dist, s = null) {
  if (!weapon) return 0;
  const gun = GAME_GUNS[TROOPS[s?.kind]?.game?.gun];
  if (gun) return falloff(gun.damage, dist);
  const w = weaponOf(weapon);
  const d = w.damage * 10;
  return dist > (w.range * 2) / 3 ? +(d * 0.6).toFixed(3) : d;
}

// Your health is the galaxy's 100 where the game's assault class has 150
// (classes.json): a shot of the game's damage lands on you scaled by the
// two, so it takes as many hits to put you down as it would a trooper in
// the game. The galaxy's own guns are on your scale already.
export const YOUR_SHARE = 100 / IMPERIAL.hp;
export const onYou = (s, damage) => (TROOPS[s?.kind]?.game ? +(damage * YOUR_SHARE).toFixed(3) : damage);

export function newSoldier(spec, rand = Math.random) {
  const t = TROOPS[spec.kind] ?? TROOPS.stormtrooper;
  const [x, z] = spec.at;
  return {
    id: spec.id,
    kind: spec.kind,
    side: spec.side,
    hp: t.hp,
    hpMax: t.hp,
    weapon: t.weapon,
    b: { x, z, yaw: spec.yaw ?? 0, to: null, wait: rand() * 2 },
    home: spec.home ?? [x, z],
    leash: spec.role === 'patrol' || spec.role === 'raid' ? 80 : 30,
    beat: spec.beat ?? null,
    role: spec.role,
    mode: spec.role === 'patrol' ? 'patrol' : 'post',
    mind: { phase: rand() * 0.4, think: 0, sense: rand() * 0.1 },
    beliefs: new Map(),
    squad: spec.squad,
    turf: spec.turf ?? null,
    shield: t.shield ?? 0,
    suppressed: 0,
    heat: 0,
    grudge: 0,
    alive: true,
  };
}

export function hurt(s, damage) {
  s.hp = Math.max(0, s.hp - damage);
  if (s.hp > 0) return 'hurt';
  s.alive = false;
  return 'down';
}

// a soldier's trigger: bursts of the gun's own (three where it says none),
// `gap` apart, a pause between; cadenceOf(weapon) → the seconds a shot, on
// average (bolts.js's farExchange fires by it)
export const BURST = { gap: 0.15, pause: [1.1, 2] };
export const burstOf = (weapon) => weaponOf(weapon).burst ?? 3;
export function cadenceOf(weapon) {
  const n = burstOf(weapon);
  return ((n - 1) * Math.max(BURST.gap, weaponOf(weapon).every) + (BURST.pause[0] + BURST.pause[1]) / 2) / n;
}
