// The tactics’ own rules as the game’s AI source has them, written again in the
// site’s words for the soldier brain (`soldierBrain.js`): which tactics a bot
// has, when close combat is entered, held and left, what sends a bot to hide
// and for how long, and which firing patterns it draws and how they pull the
// trigger. The source is
// BattleAI’s soldier (an earlier build than the 2017 game’s;
// `docs/superpowers/evidence/bf-ai-source/README.md` sets every rule against
// it): the numbers are the tactics rows’ (ai.json), and the few the
// code holds as constants are named here with the file and function they come
// from (NOTES.md, “The bots’ minds against the AI source”). Pure.
//
//   available(tactics, kind) → bool      kind: 'closeCombat' | 'hide' | 'flee' (a row key)
//   closeCombat(row, k) → bool           enter, hold or leave close combat; row: the tactics row’s closeCombat
//     k: { since, now, inCover, toCover, seen, lineOfFire, sinceSeen, ahead, height, turn, inVehicle }
//   aheadOf(at, vel, seen) → [x, y, z]   the target’s place close combat measures to
//   turnFrom(vel, to) → degrees          the angle between the way a bot moves and the way to its target
//   validAgainst(kind, target) → bool    whether an AI weapon can hurt a target (not: the bot hides)
//   hideHold(row, rand) → seconds        hideClock(clock, …)     stillHiding(clock, …) → bool
//   patternWeapon(aiWeapon) → the patterns’ weapon name | null
//   intensityFor({ fired, attacking, tactics }) → 'High' | 'Medium'
//   TICK                                 seconds a pattern bit lasts
//   pulls(pattern, bit, held) → bool     whether a bit asks the gun for a shot

// A tactic is open to a bot only where its template’s tactics row holds its
// settings (`Reason/Tactics.cpp`, `TacticInfo`’s constructor sets a tactic’s
// bit from its settings being there): the Skirmish rows have no hide and no
// close combat, `Melee_Tactics` no hide, the grunt rows no flee.
export const available = (tactics, kind) => !!tactics?.[kind];

// `Mindcraft/SoldierBehaviorInterface.h`, `isCloseCombatValid`: held this long
// before anything may end it, s.
export const CLOSE_HOLD = 3;
// `Brain/AISystem.cpp` (the knowledge update): close combat measures to where
// the target will be this far on along its velocity while it is in sight, s.
export const CLOSE_AHEAD = 1.5;
// `isCloseCombatValid`: entered only by a bot not moving more than this far
// from the way to its target, and kept with five degrees more, °.
export const CLOSE_TURN_IN = 90;
export const CLOSE_TURN_STAY = 95;

// The source’s close combat test, both halves. Entering: the target seen, a
// line of fire to it, where it will be nearer than the row’s `Distance`, its
// height apart under `HeightDistance`, the bot not moving away from it, not on
// a vehicle, and the bot not on its way to a cover that still serves. Held:
// at least CLOSE_HOLD s, then while where the target will be stays inside
// `DistanceLimit`, it is seen with a line of fire or unseen for under
// `LostVisibilityTimeout`, and the bot is not moving away. A bot in cover
// never does it (`combat_Tactics` asks that first).
export function closeCombat(row, k) {
  if (!row || k.inCover) return false;
  if (k.since != null) {
    if (k.now - k.since < CLOSE_HOLD) return true;
    const sight = (k.seen && k.lineOfFire) || (!k.seen && k.sinceSeen < row.LostVisibilityTimeout);
    return k.ahead < row.DistanceLimit && sight && k.turn < CLOSE_TURN_STAY;
  }
  return !!k.seen && !!k.lineOfFire && !k.inVehicle && !k.toCover && k.ahead < row.Distance && k.height < row.HeightDistance && k.turn < CLOSE_TURN_IN;
}

export const aheadOf = (at, vel, seen) => (seen && vel ? [at[0] + vel[0] * CLOSE_AHEAD, at[1] + (vel[1] ?? 0) * CLOSE_AHEAD, at[2] + vel[2] * CLOSE_AHEAD] : [...at]);

// (0 for a bot standing: the source measures the way it is going, none when it is not)
export function turnFrom(vel, to) {
  const v = Math.hypot(vel?.[0] ?? 0, vel?.[2] ?? 0);
  const t = Math.hypot(to[0], to[1]);
  if (v < 0.1 || t < 1e-6) return 0;
  const c = ((vel[0] / v) * to[0] + (vel[2] / v) * to[1]) / t;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

// What makes a bot hide (`Brain/AISystem.cpp`, the knowledge update, from
// `Gather/AiProperties.cpp`’s `canDamageTarget`): a target its AI weapon is
// not valid against (`Reason/TargetInfo.cpp`, `TargetInfo::isWeaponValidAgainst`);
// health and suppression are read by no tactic. Every AI weapon row in the
// records is valid against all (26 of 26, `AI/BattleAI/Weapons/**`
// `#AIWeaponData.ValidAgainst`; ai.json drops the field), so in this game a
// soldier is never sent to hide by it; a row with its own `validAgainst` is
// read where one has it.
//   target: { inVehicle, shielded } (an entity on foot is neither)
export function validAgainst(kind = 'All', { inVehicle = false, shielded = false } = {}) {
  switch (kind) {
    case 'Nothing':
      return false;
    case 'Soldiers':
      return !inVehicle;
    case 'SoldiersAndUnshieldedVehicles':
      return !inVehicle || !shielded;
    case 'UnshieldedVehicles':
      return inVehicle && !shielded;
    case 'ShieldedVehicles':
      return inVehicle && shielded;
    case 'AllVehicles':
      return inVehicle;
    default:
      return true;
  }
}

// A hide draws its hold between the row’s `MinimumTimeActive` and
// `MaximumTimeActive` as it begins (`Reason/Tactics.cpp`, `TacticInfo::set`);
// `Brain/AISystem.cpp` pushes the limit on for as long as the cause holds, and
// `useTactic` drops the tactic once past it: so a bot hides while its cause
// holds and the drawn hold more.
//   hideClock(clock, { cause, was, now, row, rand })     stillHiding(clock, { cause, was, now }) → bool
export const hideHold = (row, rand) => {
  const lo = row?.MinimumTimeActive ?? 0;
  const hi = row?.MaximumTimeActive ?? lo;
  return lo + rand() * (hi - lo);
};

export function hideClock(clock, { cause, was, now, row, rand }) {
  if (!was) clock.hold = hideHold(row, rand);
  if (cause) clock.until = now + clock.hold;
}

export const stillHiding = (clock, { cause, was, now }) => !!cause || (!!was && now <= (clock.until ?? -Infinity));

// The patterns a bot fires are its AI weapon row’s own class
// (`Reason/WeaponFiringInfo.cpp`, `getWeaponFiringInfo`): `AI_Rifle` is an
// SMG, `AI_SMG` an assault rifle, `AI_Heavy` a machine gun.
export const patternWeapon = (aiWeapon) => (typeof aiWeapon?.class === 'string' ? aiWeapon.class.replace(/^WeaponClass_/, '') : null);

// The attack rows whose `CombatIntensity` is set (the records:
// `AI/BattleAI/Tactics/<row>#AttackSettings.CombatIntensity`, transcribed
// because ai.json drops the field); every other row’s is none.
export const ATTACK_INTENSITY = {
  Heavy_Tactics: 'High',
  Imperial_Grunt_Heavy_Tactics: 'High',
  Assault_PvE_Tactics: 'High',
  Heavy_PvE_Tactics: 'High',
  Officer_PvE_Tactics: 'High',
  Specialist_PvE_Tactics: 'High',
};

// The intensity a bot’s next pattern is drawn from: High until it has fired
// once (`getWeaponFiringInfo`); then the attack row’s own while it attacks
// (`Brain/AISystem.cpp`), else its combat group’s, Medium while alerted
// (`Reason/CombatIntensity.cpp`, `updateCombatIntensity`; a bot with a target
// is alerted).
export function intensityFor({ fired, attacking, tactics }) {
  if (!fired) return 'High';
  return (attacking && ATTACK_INTENSITY[tactics]) || 'Medium';
}

// A pattern’s bit is one AI tick: `Shared/FiringPatternData.ddf` gives its
// delay in ticks of a thirtieth of a second, and `Execute/WeaponControl.cpp`,
// `updateWeaponControlState`, steps one bit a tick.
export const TICK = 1 / 30;

// What a bit does (`updateWeaponControlState`): it holds the trigger down for
// its tick, and the pattern sets the weapon’s fire logic, single fire for a
// pattern marked single and automatic for the rest. So a single pattern fires
// once at each press however long its bits hold the trigger, and an automatic
// one fires at the gun’s own rate for as long as they hold it. → the trigger
// asks for a shot this tick?
export const pulls = (pattern, bit, held) => !!bit && (!pattern?.single || !held);
