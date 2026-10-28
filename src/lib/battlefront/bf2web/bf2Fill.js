// What sits round BF2’s soldier tree for each bot, as bf2-web ported it from the retail binary (WebPort/ai/battleai-bf2-
// fill.{h,cpp}): SoldierKnowledge v36’s constructor, the soldier’s melee-creature byte, and TacticInfo, which tracks the
// bot’s current tactic, how long it has run and its time limit, and answers which settings the tactic moves, fires
// and throws with. bf2-web checks each against the retail function run in an emulator, and bf2Fill.test.js against
// the same digests. Pure.
//
//   constructKnowledge() → the knowledge as the constructor leaves a zeroed slot (bf2Tree.js’s object)
//   constructKnowledgeBytes(view, at): the constructor’s stores on a 0x13C-byte slot, in retail’s order
//   meleeCreature(soldierMeleeType) → 0 | 1
//   createTacticInfo(tactics, inVehicle) → info
//     tactics: { slot: [settings | null × 22], vehicleSuppressionDistance } | null
//     settings: { move, projectile, meleeProjectile, hideLimitMin, hideLimitMax, chargeDistance, berserkDistance, berserkFlag }
//   updateTacticInfo(info, act, tactic, rate, random?)   random(min, max) → s (drawn only for a new Hide with Hide settings)
//   moveSettings(info)   meleeProjectile(info)   projectile(info)   → the current tactic’s settings, or null

import { TACTIC, emptyKnowledge } from './bf2Tree.js';

const FLT_MAX = 3.4028234663852886e38;
const NO_LIMIT = 0xffffffff;

// TacticInfo’s settings slots, in retail order, and the tactic each holds
export const SLOT = {
  vehicle: 0, charge: 1, attack: 2, hide: 3, flee: 4, closeCombat: 5, closeRangeAttack: 6, berserk: 7, meleeCharge: 8, squadMovement: 9,
  squadEngage: 10, investigate: 11, combatInvestigate: 12, combatSearchArea: 13, searchArea: 14, executeIdleAction: 15, executeSearchAction: 16,
  executeCombatAction: 17, follow: 18, goToTarget: 19, goToAttackPoint: 20, evade: 21,
};
export const SLOT_COUNT = 22;
const T = TACTIC;
const SLOT_TACTIC = [T.vehicle, T.charge, T.attack, T.hide, T.flee, T.closeCombat, T.closeRangeAttack, T.berserk, T.meleeCharge, T.squadMovement,
  T.squadEngage, T.investigate, T.combatInvestigate, T.combatSearchArea, T.searchArea, T.executeIdleAction, T.executeSearchAction,
  T.executeCombatAction, T.follow, T.goToTarget, T.goToAttackPoint, T.evade];

// The constructor’s values on a zeroed slot: the scores −1, fire allowed, the target and its distances at FLT_MAX, the
// move settings’ fire distance 20, close combat in at 6 m (2 m high), out at 15 m, 2 s without sight, the projectile
// between 20 and 50 m, the melee projectile to 3 m, the vehicle suppression at 15 m. (+0x11, coverIsCommittable, is one
// of the bytes it never writes.)
export function constructKnowledge() {
  return {
    ...emptyKnowledge(),
    id: -1, coverScore: -1, alternateCoverScore: -1, allowFire: 1, guessCloseCombatAllowed: 1, tacticTimeActiveLimit: FLT_MAX,
    targetDistance: FLT_MAX, guessPathDistanceToTarget: FLT_MAX, targetHeightDifference: FLT_MAX, targetTimeSinceSeen: FLT_MAX, targetId: -1,
    targetAlive: 1, moveSettingsDistance: 20, guessMoveAimDistance: FLT_MAX, guessBerserkDistance: 20, chargeAllowedToChargeDistance: 20,
    closeCombatEnterDistance: 6, closeCombatHeightDifference: 2, closeCombatExitDistance: 15, closeCombatLostVisibilityTimeout: 2,
    guessCloseCombatEnabled: 1, guessMelee102: 1, projectileLowerRange: 20, projectileUpperRange: 50, guessMeleeProjectileUpperRange: 3,
    vehicleSuppressionDistance: 15,
  };
}

// the constructor’s stores, word by word as retail makes them (little-endian, the untouched bytes left as they were)
const FLT_MAX_BITS = 0x7f7fffff;
const MINUS_ONE = 0xbf800000;
const F20 = 0x41a00000;
const F6 = 0x40c00000;
const F2 = 0x40000000;
const F15 = 0x41700000;
const F3 = 0x40400000;
const F50 = 0x42480000;
const STORES = [
  [32, 0x00, 0xffffffff], [64, 0x04, 0], [32, 0x0c, 0], [8, 0x10, 0], [32, 0x12, 0], [16, 0x16, 0], [32, 0x18, 0], [8, 0x1c, 0], [64, 0x20, 0], [64, 0x28, 0],
  [32, 0x30, MINUS_ONE], [32, 0x34, 0], [32, 0x38, MINUS_ONE], [64, 0x3c, 0], [8, 0x44, 0], [64, 0x48, 0], [16, 0x58, 0], [8, 0x5a, 0], [64, 0x5c, 0],
  [64, 0x74, 0], [64, 0x50, 0x10000], [16, 0x64, 0x100], [32, 0x68, FLT_MAX_BITS], [64, 0x6c, FLT_MAX_BITS], [32, 0x7c, 0], [64, 0x88, 0],
  [64, 0x80, FLT_MAX_BITS], [16, 0x90, 0], [8, 0x92, 0], [32, 0xa8, 0], [32, 0x94, FLT_MAX_BITS], [32, 0x98, FLT_MAX_BITS], [32, 0x9c, FLT_MAX_BITS],
  [64, 0xa0, FLT_MAX_BITS], [32, 0xac, 0xffffffff], [16, 0xb0, 1], [64, 0xb4, 0], [64, 0xbc, 0], [8, 0xc4, 0], [32, 0xc8, F20], [64, 0xcc, FLT_MAX_BITS],
  [8, 0xd4, 0], [32, 0xd8, F20], [32, 0xdc, F20], [32, 0xf4, 0], [32, 0xe0, F6], [32, 0xe4, F2], [32, 0xe8, F15], [32, 0xec, F2], [16, 0xf0, 1],
  [16, 0xf8, 0], [16, 0x104, 0], [8, 0x106, 0], [32, 0xfc, 0xffffffff], [32, 0x100, 0x10000], [32, 0x108, 0], [8, 0x10c, 0], [8, 0x11c, 0],
  [32, 0x110, F20], [64, 0x114, F50], [16, 0x120, 0], [8, 0x122, 0], [32, 0x124, 0], [32, 0x128, F3], [64, 0x12c, F15], [32, 0x134, 0], [16, 0x138, 0],
  [8, 0x13a, 0],
];
export function constructKnowledgeBytes(view, at) {
  for (const [bits, off, value] of STORES) {
    if (bits === 8) view.setUint8(at + off, value);
    else if (bits === 16) view.setUint16(at + off, value, true);
    else if (bits === 32) view.setUint32(at + off, value, true);
    else {
      // every 64-bit store’s value fits its low word
      view.setUint32(at + off, value, true);
      view.setUint32(at + off + 4, 0, true);
    }
  }
}

// AISystem::addSoldier: SoldierMeleeType == Creature (2)
export const meleeCreature = (soldierMeleeType) => (soldierMeleeType >>> 0 === 2 ? 1 : 0);

// TacticInfo’s constructor: the settings by slot, the bits of the tactics they hold, and the Vehicle tactic for a bot
// added in a vehicle
export function createTacticInfo(tactics, inVehicle = false) {
  const info = { slot: Array(SLOT_COUNT).fill(null), vehicleSuppressionDistance: null, current: 0, ticksActive: 0, limitTicks: NO_LIMIT, available: 0 };
  if (!tactics) return info;
  if (inVehicle) info.current = T.vehicle;
  let bits = 0;
  for (let s = 0; s < SLOT_COUNT; s++) {
    info.slot[s] = tactics.slot[s] ?? null;
    if (info.slot[s]) bits |= 1 << SLOT_TACTIC[s];
  }
  info.vehicleSuppressionDistance = tactics.vehicleSuppressionDistance;
  info.available = bits >>> 0;
  return info;
}

// BF2’s updateTacticInfo after a think: a Scripted act clears the tactic, its count and limit; the same tactic counts
// a tick; any other becomes current with no limit, but a Hide with Hide settings, which lasts rate × random(min, max)
// ticks (truncated)
export function updateTacticInfo(info, act, tactic, rate, random = null) {
  if ((act >>> 4) & 1) {
    info.current = 0;
    info.ticksActive = 0;
    info.limitTicks = NO_LIMIT;
    return;
  }
  if (info.current === tactic) {
    info.ticksActive = (info.ticksActive + 1) >>> 0;
    return;
  }
  info.current = tactic;
  info.ticksActive = 0;
  let limit = NO_LIMIT;
  const hide = info.slot[SLOT.hide];
  if (tactic === T.hide && hide && random) {
    const r = Math.fround(random(hide.hideLimitMin, hide.hideLimitMax));
    const x = Math.fround(Math.fround(rate >>> 0) * r);
    // cvttss2si to 64 bits, kept as 32 (a NaN or a value past 2⁶³ converts to 2⁶³, whose low word is 0)
    const whole = Number.isFinite(x) && Math.abs(x) < 2 ** 63 ? BigInt(Math.trunc(x)) : -(2n ** 63n);
    limit = Number(BigInt.asUintN(32, whole));
  }
  info.limitTicks = limit;
}

function slotOfTactic(info, t) {
  const s = info.slot;
  switch (t) {
    case T.vehicle: return s[SLOT.vehicle];
    case T.charge: return s[SLOT.charge];
    case T.attack: return s[SLOT.attack];
    case T.hide: return s[SLOT.hide];
    case T.flee: return s[SLOT.flee];
    case T.closeCombat: return s[SLOT.closeCombat];
    case T.berserk: return s[SLOT.berserk];
    case T.closeRangeAttack: return s[SLOT.closeRangeAttack];
    case T.squadMovement: return s[SLOT.squadMovement];
    case T.squadEngage: return s[SLOT.squadEngage];
    case T.investigate: case T.combatInvestigate: case T.combatSearchArea: case T.searchArea: case T.executeIdleAction:
    case T.executeSearchAction: case T.executeCombatAction: return s[SLOT.investigate + (t - T.investigate)];
    case T.follow: return s[SLOT.follow];
    // GoToTarget tests the Follow slot and reads GoToTarget’s (where retail would read a missing one, null)
    case T.goToTarget: return s[SLOT.follow] ? s[SLOT.goToTarget] : null;
    case T.evade: return s[SLOT.evade];
    case T.meleeCharge: return s[SLOT.meleeCharge];
    case T.goToAttackPoint: return s[SLOT.goToAttackPoint];
    default: return undefined;
  }
}

export function moveSettings(info) {
  const s = slotOfTactic(info, info.current);
  return s ? s.move ?? null : null;
}

// Attack, CloseCombat, Berserk and MeleeCharge have melee-projectile settings
export function meleeProjectile(info) {
  const t = info.current;
  if (t !== T.attack && t !== T.closeCombat && t !== T.berserk && t !== T.meleeCharge) return null;
  const s = slotOfTactic(info, t);
  return s ? s.meleeProjectile ?? null : null;
}

// Attack, Follow, GoToTarget and GoToAttackPoint throw with the Attack settings’ projectile, Berserk with its own
export function projectile(info) {
  const t = info.current >>> 0;
  if (t === T.berserk) return info.slot[SLOT.berserk]?.projectile ?? null;
  if (t !== T.attack && ((((t - 18) >>> 0) & 0xfffffffa) !== 0 || t === 23)) return null;
  return info.slot[SLOT.attack]?.projectile ?? null;
}
