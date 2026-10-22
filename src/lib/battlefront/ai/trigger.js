// When a soldier bot may fire and where it aims, as the game’s AI code has it
// (BattleAI, an earlier build than the 2017 game’s; the sheet in
// docs/superpowers/evidence/bf-ai-source/README.md, the rows in NOTES.md, “The
// bots’ minds against the AI source”), written again in the site’s words for
// `soldierBrain.js`. Pure.
//
//   keepFiring(system) → s           how long a bot standing still fires on at a target out of sight
//   holdsFire({ seen, standing, sinceSeen, keep }) → bool      the trigger held for want of sight
//   STILL                            m/s under which a bot stands
//   reacquired(track, { id, seen, at, threshold, now }) → s   when the target was last spotted again away
//   weaponRange(aiWeapon) → m        the farthest the trigger allows
//   MOVE_FIRE                        each tactics row’s move settings’ fire rule, transcribed
//   firesOnTheMove(rule, dist) → bool
//   aimY(chestY, { eyeOverChest, offset }) → the height a bot aims at

// `Execute/WeaponControl.cpp`, `soldierAimAndShoot`: a bot standing still fires
// on at its target until it has been out of sight `KeepFiringAtPlayerTime`
// (4 s in multiplayer, 3 in PvE), whoever the target is (the AI target’s own
// `KeepFiringAtAITime` is commented out there); a moving bot fires only while
// it sees it.
export const keepFiring = (system) => system?.shooting?.keepFiringAtPlayerTime ?? 0;
export const holdsFire = ({ seen, standing, sinceSeen, keep }) => (standing ? sinceSeen > keep : !seen);
// (the same function’s “standing still”: the locomotion’s speed under this)
export const STILL = 0.1;

// `soldierAimAndShoot`, `holdFireDueToTargetMoved`, with `Reason/TargetInfo.cpp`,
// `TargetInfo::setInfo`: a target spotted again more than the difficulty’s
// `ReaquireTargetDistanceThreshold` from where it was last seen holds the
// trigger for `FiringDelayAfterReaquiringTarget` at its distance from then.
// A new target is the first shot’s delay’s, not this. → the time of the last
// such spotting (−∞ for none)
export function reacquired(track, { id, seen, at, threshold, now }) {
  if (track.id !== id) Object.assign(track, { id, seen: false, last: null, at: -Infinity });
  if (seen && !track.seen && track.last && Math.hypot(at[0] - track.last[0], at[1] - track.last[1], at[2] - track.last[2]) > threshold) track.at = now;
  if (seen) track.last = [...at];
  track.seen = !!seen;
  return track.at;
}

// `soldierAimAndShoot`: past the AI weapon row’s `WeaponRange` the trigger is
// held (a row’s −1 sets no limit).
export const weaponRange = (aiWeapon) => (aiWeapon?.WeaponRange >= 0 ? aiWeapon.WeaponRange : Infinity);

// `Mindcraft/SoldierBehaviorInterface.h`, `attackWhileMoving`: a bot on its way
// somewhere fires only where its tactic’s move settings say `Fire`, at a target
// inside their `FireTargetDistance`. The records’ rows (`AI/BattleAI/Tactics/
// <row>#…MoveSettings`), transcribed because ai.json drops the move settings;
// a row with none takes the source’s defaults (no fire, 20 m).
const rule = (fire, distance) => ({ fire, distance });
export const MOVE_FIRE = {
  attack: {
    AIRebelSoldierTactics: rule(true, 20),
    CloseRange_Tactics: rule(true, 25),
    Flametrooper_Tactics: rule(true, 10),
    Heavy_Tactics: rule(true, 30),
    Imperial_Grunt_Heavy_Tactics: rule(true, 100),
    Imperial_Grunt_Pistol_Tactics: rule(true, 40),
    Imperial_Grunt_Rifle_Tactics: rule(true, 40),
    Imperial_Grunt_Sniper_Tactics: rule(false, 20),
    Imperial_Jumptrooper_Tactics: rule(true, 80),
    Jumptrooper_Tactics: rule(true, 40),
    Launcher_Tactics: rule(false, 20),
    // (its attack has no move settings: the source's defaults)
    Melee_Tactics: rule(false, 20),
    Officer_Tactics: rule(false, 20),
    Rifleman_Tactics: rule(true, 40),
    Sniper_Tactics: rule(false, 20),
    Assault_PvE_Tactics: rule(true, 1000),
    Heavy_PvE_Tactics: rule(true, 1000),
    Officer_PvE_Tactics: rule(true, 1000),
    Specialist_PvE_Tactics: rule(true, 1000),
  },
  // (every multiplayer flee row: no; the Skirmish heavy’s: inside 30 m)
  flee: { Heavy_PvE_Tactics: rule(true, 30) },
};
export const DEFAULT_MOVE = rule(false, 20);
export const firesOnTheMove = (r, dist) => !!r?.fire && dist < r.distance;

// `Execute/WeaponControl.cpp`, `computeAimPositionAndOffset`, and
// `Reason/TargetInfo.cpp` (the target update): a soldier is aimed at its eye
// less `AimOffsetY` (0.25 m in both systems’ rows), where it is while seen and
// where it was last seen when not; no lead (the source leads explosive rounds
// alone, and a bot’s bolts are not). → the aim’s height, from the chest the
// senses hold and the target’s eye over its chest
export const aimY = (chestY, { eyeOverChest, offset }) => chestY + eyeOverChest + offset;
