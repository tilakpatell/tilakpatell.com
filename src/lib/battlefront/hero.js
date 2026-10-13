// A hero or a villain as the sim deploys one: the class row a soldier is
// made from (heroes.json's health, regen and its own gun's row in
// weapons.json, or none for a saber hero), the drive, the body's height
// and the jump (heroKit.json, from the game's state machine), and the
// abilities: the hero's dodge (Ability_Evade_CharacterState, saber.json's)
// on slot 0, then its three from abilities.json on slots 1 to 3 (left,
// middle, right: Q, E, F), each carrying what it does (`hero`: its kind and
// numbers). A blaster hero's are the row's own `effect`, read from the
// game's records (heroBlaster.js plays them); a saber hero's are
// bf2017Abilities.json's (heroAbilities.js). Pure.
//
//   HERO_KIT                      heroKit.json
//   kitOf(id) → its row, or null  isSaberHero(id)
//   heroClass(rb, id, base) → the class row addSoldier takes (base: the side's first class, for what a hero shares)
//   heroAbilities(rb, id) → the ability rows, slot 0 the dodge

import KIT from '../../data/bf2017/heroKit.json';
import FX from '../../data/bf2017Abilities.json';
import { saberOf } from '../combat/saber2017.js';
import { abilityOf, heroOf } from './rulebook.js';

export const HERO_KIT = KIT;
const SLOTS = { left: 1, middle: 2, right: 3 };
const TIMES = new Set(['from', 'asset', 'slot', 'recharge', 'activation', 'active']);

export const kitOf = (id) => KIT.heroes[id] ?? null;
export const isSaberHero = (id) => Boolean(kitOf(id)?.saber);

// A blaster hero's ability row as the sim runs it: the record's times, with what its kind needs of them.
function blasterRow(row) {
  const fx = row.effect;
  const out = { ...row, hero: fx };
  // (a charge and a device wait for the second press, `RetriggerCooldown` after the first; the record's `InfiniteActiveTime`)
  if (fx.kind === 'charge') Object.assign(out, { active: Infinity, retrigger: { cooldown: fx.retrigger } });
  // (the Disabler's second press overcharges it, Sharp Shot's lets the flurry go: `RetriggerCooldown` after the first)
  if (fx.kind === 'reveal' || fx.kind === 'marks') out.retrigger = { cooldown: fx.retrigger };
  // (a swapped weapon stays in the hand until its heat ends it, or it is put away)
  if (fx.kind === 'weaponSwap') Object.assign(out, { active: Infinity, retrigger: { cooldown: 0 } });
  // (the record's ten seconds are how long Iden's droid may be held looking for its mark: by hand it finds it at the press)
  if (fx.hand?.activation != null) out.activation = fx.hand.activation;
  return out;
}

// Whom a hero's ability blocks, and when: its record's list and two flags (abilities.json's `blocking`), in place of
// the channel every hero ability shares, which the game does not read as "one at a time".
const blocksOf = (row) => ({ channels: [], blocks: row.blocking?.whom ?? [], blocksWhile: { activation: row.blocking?.activation ?? true, active: row.blocking?.active ?? true } });

export function heroAbilities(rb, id) {
  const k = kitOf(id);
  const fx = FX.heroes[k?.abilities]?.abilities ?? [];
  const rules = saberOf(k?.saber ?? 'luke');
  const evade = { id: 'Ability_Evade_CharacterState', kind: 'state', activation: 0, active: rules.evade.active, recharge: rules.evade.recharge, cost: rules.evade.cost, channels: [], slot: 0, hero: { kind: 'evade', taken: rules.evading.taken } };
  const rows = heroOf(rb, id).abilities.map((a, i) => {
    const row = abilityOf(rb, a.id);
    const slot = SLOTS[a.slot] ?? i + 1;
    if (row.effect) return { ...blasterRow(row), ...blocksOf(row), slot };
    const f = fx.find((x) => x.asset === a.id) ?? null;
    // (its numbers; the times are abilities.json's own, and where each was read stays in bf2017Abilities.json)
    const nums = f ? Object.fromEntries(Object.entries(f).filter(([key]) => !TIMES.has(key))) : { kind: null };
    return { ...row, ...blocksOf(row), slot, hero: nums };
  });
  return [evade, ...rows.sort((p, q) => p.slot - q.slot)];
}

export function heroClass(rb, id, base) {
  const h = heroOf(rb, id);
  const k = kitOf(id);
  const body = KIT.bodies[k?.body ?? 'DefaultHeroPhysics'];
  const evade = saberOf(k?.saber ?? 'luke').evade;
  return {
    ...base,
    id,
    cls: 'hero',
    health: h.health,
    // (its own regeneration; Leia's kit applies none on spawn, and the rulebook reads her own record for it)
    regen: h.regen ?? base.regen,
    // (a blaster hero's own gun: the weapons rulebook's row for its primary)
    weapon: h.weapon ?? null,
    abilities: null,
    unit: 'hero',
    unitId: id,
    hero: id,
    drive: KIT.drives[k?.drive ?? 'saber'],
    blockDrive: KIT.drives.blocking,
    roll: { speed: KIT.drives.evade.speed, time: evade.active },
    // (its physics row's height and eye; a hero's crouch does not shrink it: soldier.js's bodyOf)
    body: { stand: body.height, crouch: body.height, eye: body.eye },
    jump: KIT.jumps[k?.jump ?? 'force'],
  };
}
