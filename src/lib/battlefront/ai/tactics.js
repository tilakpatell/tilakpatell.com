// The tactics’ own rules as the game’s AI source has them, written again in the
// site’s words for the soldier brain (`soldierBrain.js`): which tactics a bot
// has, and when close combat is entered, held and left. The source is
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
