// The Skirmish (Instant Action) bots' abilities, as the game's AI ability
// logic runs them (`AI/BattleAI/Prefabs/Skirmish/PF_Skirmish_AI_Ability_Logic`
// and one prefab an ability, ai.json's `skirmish.logic`). The logic is a
// graph; what is data in it is read: the poll (its auto-starting random
// delay, 3 to 6 s), each ability's own gap between uses (a delay of 5 s or
// more: the scan pistol's 60 to 120 s, the sentry's 5 to 6), the shield's
// health threshold (0.5) and the sentry's range (50 m). A bot with a seen
// enemy, at each poll, presses the first of its three abilities that has a
// charge, its gap over and its condition met (`abilities.js`'s recharge is
// the cooldown rule). Which prefab drives which of the class's abilities is
// read from their names, by hand (`ABILITY_LOGIC`, NOTES.md), as are the
// grenades' throw (`THROW`). Pure.
//
//   abilitiesFor(rb, cls) → ability rows for newSoldier: the roll, then the class's three by slot
//   skirmishRole(cls) → the Skirmish template a class plays ('heavy')
//   pollEvery(skirmish) → [min, max] seconds          pressAbility(b, { target, now }) → { slot, id } | null
//     b: { s, rand, role, skirmish, abilityAt?, gaps? }; target: the brain's belief (visible, at)

import { abilityOf } from '../rulebook.js';
import { ROLL, charges, press } from '../abilities.js';

// The class's abilities → the AI logic prefab that drives each (by name).
export const ABILITY_LOGIC = {
  DefaultAbility_Assault_ThermalDetonator: 'Grenade',
  DefaultAbility_Heavy_ImpactGrenade: 'Grenade',
  DefaultAbility_Officer_SplitterGrenade: 'Grenade',
  DefaultAbility_Specialist_ShockGrenade: 'Grenade',
  DefaultAbility_Heavy_Sentry: 'Sentry',
  DefaultAbility_Heavy_CombatShield: 'Shield',
  DefaultAbility_Officer_BattleCommand: 'Battle_Command',
  DefaultAbility_Officer_BlasterTurret: 'Turret',
  DefaultAbility_Specialist_Infiltration: 'Infiltration02',
  DefaultAbility_Assault_ScanDart: 'ScanPistol',
};
// The farthest a bot throws a grenade at, metres, by hand.
export const THROW = 25;
const SLOTS = { left: 1, middle: 2, right: 3 };

export function abilitiesFor(rb, cls) {
  const rows = (cls.abilities ?? []).map((a, i) => ({ ...abilityOf(rb, a.asset.slice(a.asset.lastIndexOf('/') + 1)), slot: SLOTS[a.slot] ?? i + 1 }));
  return [{ ...ROLL, slot: 0 }, ...rows.sort((a, b) => a.slot - b.slot)];
}

export const skirmishRole = (cls) => cls.cls ?? 'assault';

export function pollEvery(skirmish) {
  const auto = skirmish?.logic?.base?.delays?.find((d) => d.auto);
  return auto ? [auto.min, auto.max] : [3, 6];
}

// an ability's own gap between uses, its range and its health condition, from its prefab
function ruleOf(skirmish, logic, b) {
  const row = skirmish?.logic?.[logic] ?? {};
  const gap = (row.delays ?? []).find((d) => d.min >= 5) ?? null;
  const big = (row.compares ?? []).filter((c) => c >= 10);
  const role = b.role ? b.role[0].toUpperCase() + b.role.slice(1) : '';
  const weapon = skirmish?.weapons?.[`AI_${role}_Ability_PvE`];
  let range = big.length ? Math.max(...big) : logic === 'Grenade' ? THROW : (weapon?.WeaponRange ?? THROW);
  if (logic === 'Shield') range = Infinity;
  const below = logic === 'Shield' ? ((row.compares ?? []).find((c) => c > 0 && c < 1) ?? 0.5) : null;
  return { gap, range, below };
}

export function pressAbility(b, { target, now }) {
  if (now < (b.abilityAt ?? -Infinity)) return null;
  const [lo, hi] = pollEvery(b.skirmish);
  b.abilityAt = now + lo + b.rand() * (hi - lo);
  if (!target?.visible) return null;
  const s = b.s;
  const d = Math.hypot(target.at.x - s.at[0], target.at.z - s.at[2]);
  b.gaps ??= {};
  for (const a of s.abilities.list) {
    const logic = ABILITY_LOGIC[a.row.id];
    if (!logic || charges(s.abilities, a.slot) < 1 || now < (b.gaps[a.slot] ?? -Infinity)) continue;
    const rule = ruleOf(b.skirmish, logic, b);
    if (d > rule.range) continue;
    if (rule.below != null && s.hp / s.hpMax >= rule.below) continue;
    if (!press(s.abilities, a.slot, now).fired) continue;
    if (rule.gap) b.gaps[a.slot] = now + rule.gap.min + b.rand() * (rule.gap.max - rule.gap.min);
    return { slot: a.slot, id: a.row.id };
  }
  return null;
}
