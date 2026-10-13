// A hero or a villain as the sim deploys one: the class row a soldier is
// made from (heroes.json's health and regen, the weapon heroKit.json names
// from weapons.json, or none for a saber hero), the drive, the body's height
// and the jump (heroKit.json, from the game's state machine), and the
// abilities: the hero's dodge (Ability_Evade_CharacterState, saber.json's)
// on slot 0, then its three from abilities.json on slots 1 to 3 (left,
// middle, right: Q, E, F), each carrying what it does (`hero`: its kind and
// numbers from bf2017Abilities.json, heroAbilities.js plays them). Pure.
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

export function heroAbilities(rb, id) {
  const k = kitOf(id);
  const fx = FX.heroes[k?.abilities]?.abilities ?? [];
  const rules = saberOf(k?.saber ?? 'luke');
  const evade = { id: 'Ability_Evade_CharacterState', kind: 'state', activation: 0, active: rules.evade.active, recharge: rules.evade.recharge, cost: rules.evade.cost, channels: [], slot: 0, hero: { kind: 'evade', taken: rules.evading.taken } };
  const rows = heroOf(rb, id).abilities.map((a, i) => {
    const row = abilityOf(rb, a.id);
    const f = fx.find((x) => x.asset === a.id) ?? null;
    // (its numbers; the times are abilities.json's own, and where each was read stays in bf2017Abilities.json)
    const nums = f ? Object.fromEntries(Object.entries(f).filter(([key]) => !TIMES.has(key))) : { kind: null };
    return { ...row, slot: SLOTS[a.slot] ?? i + 1, hero: nums };
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
    // (Leia's record names no regen affector: the side's class's, by hand)
    regen: h.regen ?? base.regen,
    weapon: k?.weapon ?? null,
    abilities: null,
    unit: 'hero',
    unitId: id,
    hero: id,
    drive: KIT.drives[k?.drive ?? 'saber'],
    blockDrive: KIT.drives.blocking,
    roll: { speed: KIT.drives.evade.speed, time: evade.active },
    height: body.height,
    eye: body.eye,
    jump: KIT.jumps[k?.jump ?? 'force'],
  };
}
