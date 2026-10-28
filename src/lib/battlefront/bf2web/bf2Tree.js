// BF2’s own soldier mind, as bf2-web reconstructed it from the retail binary node by node (WebPort/ai/battleai-bf2-tree.
// {h,cpp}): the Mindcraft tree that decides, each think, what a bot does (its act bits, its move, its tactic, cover and
// the projectile) from what it knows (SoldierKnowledge v36) and what its team allows (the tactic tokens and the grenade
// pool). bf2-web checks it byte for byte against the retail think run in an emulator on 40,000 fuzzed records, and so
// does bf2Tree.test.js against the same records’ recorded digest. Each node keeps the retail form of its comparison
// (`x <= 0 && x != 0` rather than `x < 0`) so a NaN goes where retail sends it; the retail addresses are in bf2-web.
// The knowledge is a plain object with the C struct’s field names (emptyKnowledge()); the mind’s 200-byte stack is the
// bot’s and persists between thinks, as Mindcraft’s does. Pure.
//
//   createBot() → bot (the mind’s stack, reset)      resetBot(bot)
//   createTeam() → team ({ tactics: Int32Array(23), tokenFree: Uint8Array(8), pending: [] })
//   think(bot, knowledge, team) → { status, decision, leaf, selection }
//     decision: { act, move, tactic, commitToAlternateCover, coverEnabled, suppressed, blinded, fireProjectile, guessMeleeAttack }
//   evaluateTactics(team, nowTick) → status   (the team’s tokens refilled, every AISystem tick, before its bots think)
//   queueToken(team, tactic, count, releaseTick) → status
//   TACTIC, MOVE, ACT, STATUS   tacticName(t)   moveName(m)

export const TACTICS_COUNT = 23;
export const TOKEN_TYPES = 8;
export const STACK_SIZE = 200;
export const PENDING_CAPACITY = 16;

export const TACTIC = {
  none: 0, vehicle: 1, charge: 2, attack: 3, hide: 4, flee: 5, closeCombat: 6, berserk: 7, closeRangeAttack: 8, squadMovement: 9,
  squadEngage: 10, investigate: 11, combatInvestigate: 12, combatSearchArea: 13, searchArea: 14, executeIdleAction: 15,
  executeSearchAction: 16, executeCombatAction: 17, follow: 18, goToTarget: 19, evade: 20, meleeCharge: 21, goToAttackPoint: 22,
};
// The moves the tree writes: 0 to 4 keep the source’s names, 6 is MoveToVehicle, the rest are named after the leaf
// that writes them (bf2-web’s GUESS names)
export const MOVE = {
  none: 0, stayStill: 1, selectedCover: 2, followScriptedPath: 3, chaseTarget: 4, berserk: 5, toVehicle: 6, investigate: 8,
  combatInvestigate: 9, combatSearchArea: 10, searchArea: 11, executeIdleAction: 12, executeSearchAction: 13, executeCombatAction: 14,
  evade: 15, goToTarget: 16, meleeCharge: 17, goToAttackPoint: 18,
};
// the act bits, as the source names them
export const ACT = { idle: 1, aim: 2, attack: 4, engage: 8, scripted: 0x10, ordered: 0x20, enterVehicle: 0x40 };
export const STATUS = { ok: 0, nullArgument: -1, botNotReset: -2, badTokenType: -3, badTactic: -4, pendingFull: -5 };

const FAIL = 0;
const WAIT = 2;
const T = TACTIC;
const M = MOVE;

// SoldierKnowledge v36, every field zero (the fields the tree reads, by the C struct’s names)
export function emptyKnowledge() {
  return {
    id: 0, coverTimeInCover: 0, coverTimeCompromised: 0, coverIsCompromised: 0, coverIsCommittable: 0, coverIsInCover: 0, coverIsFlanked: 0,
    coverIsProtective: 0, coverTactic: 0, coverSetAtTick: 0, coverId: 0, coverScore: 0, alternateCoverId: 0, alternateCoverScore: 0,
    moveResultStatus: 0, moveResultId: 0, hasOrderActive: 0, hasScriptedAnimation: 0, hasScriptedPath: 0, hasScriptedTargets: 0,
    hasScriptedVehicle: 0, guessScriptedAnimationBlocked: 0, allowFire: 0, allowFireWhileScripted: 0, aimWhileScripted: 0, isAlerted: 0,
    guessFollowCoverMode: 0, onHumanSquad: 0, inVehicle: 0, isDead: 0, isInteracting: 0, isInsideArea: 0, hasBookedVehicle: 0,
    guessHasHumanTarget: 0, hide: 0, panic: 0, blinded: 0, guessFollowBlocked: 0, meleeCreature: 0, guessGoToAttackPoint: 0,
    guessCloseCombatAllowed: 0, suppressionTicks: 0, teamMemberCount: 0, tacticAvailable: 0, tacticTimeActive: 0, tacticTimeActiveLimit: 0,
    tacticCurrent: 0, tacticScripted: 0, targetValid: 0, targetCanSee: 0, targetLineOfFire: 0, targetLineOfSight: 0, targetAlerted: 0,
    targetInVehicle: 0, guessHasValidPathToTarget: 0, targetDistance: 0, guessPathDistanceToTarget: 0, targetHeightDifference: 0,
    targetTimeSinceSeen: 0, targetDestinationAngle: 0, targetMovementToTargetDirectionAngle: 0, targetId: 0, targetAlive: 0, guessTargetB1: 0,
    moveSettingsFire: 0, moveSettingsDistance: 0, guessMoveAimDistance: 0, friendlyBoundToFriendlyArea: 0, friendlyBoundToFollowArea: 0,
    friendlySuppress: 0, friendlyEnterVehicle: 0, guessBerserkBlocked: 0, guessBerserkDistance: 0, chargeAllowedToChargeDistance: 0,
    closeCombatEnterDistance: 0, closeCombatHeightDifference: 0, closeCombatExitDistance: 0, closeCombatLostVisibilityTimeout: 0,
    guessCloseCombatEnabled: 0, guessCloseCombatWithoutLineOfFire: 0, closeCombatDistanceToExtrapolatedTargetPos: 0, guessMelee100: 0,
    guessMelee101: 0, guessMelee102: 0, guessMeleeTargetBlocked103: 0, guessMeleeTargetBlocked104: 0, guessMeleeChargeIssue: 0, guessMelee106: 0,
    projectileFires: 0, projectileContinuous: 0, projectileAllowGrenade: 0, projectileAllowChargeGrenade: 0, projectileLowerRange: 0,
    projectileUpperRange: 0, projectileTokenType: 0, guessMeleeProjectileFires: 0, guessMeleeProjectileContinuous: 0,
    guessMeleeProjectileAllowed: 0, guessMeleeProjectileLowerRange: 0, guessMeleeProjectileUpperRange: 0, vehicleSuppressionDistance: 0,
    investigateTrigger: 0, combatInvestigateTrigger: 0, combatSearchAreaTrigger: 0, searchAreaTrigger: 0, executeActionTrigger: 0,
    followTrigger: 0, guessFollowNoCover: 0, guessFollowMoveToCover: 0, evadeTrigger: 0, goToTargetTrigger: 0,
  };
}

export const createBot = () => ({ stack: new Uint8Array(STACK_SIZE), thinks: 0 });
export function resetBot(bot) {
  bot.stack.fill(0);
  bot.thinks = 0;
}
export const createTeam = () => ({ tactics: new Int32Array(TACTICS_COUNT), tokenFree: new Uint8Array(TOKEN_TYPES), pending: [] });

const emptyDecision = () => ({ act: 0, move: 0, tactic: 0, commitToAlternateCover: 0, coverEnabled: 0, suppressed: 0, blinded: 0, fireProjectile: 0, guessMeleeAttack: 0 });

// evalSelection (Mindcraft’s Core/MindcraftInternal.h): a child is run on its slot of the stack; a different running
// selection there moves the child to the branch stack, copied back over the normal one if the child waits. (Inside the
// branch stack every slot is 0, so the move only ever starts from the normal stack.)
function evalSelection(selection, child, c, sp) {
  const old = sp.buf[sp.off];
  const changeStack = !(old === selection || old === 0);
  const chosen = changeStack ? { buf: c.branch, off: 0 } : sp;
  chosen.buf[chosen.off] = selection;
  const r = child(c, { buf: chosen.buf, off: chosen.off + 1 });
  if (r === WAIT) {
    if (!c.leaf) {
      c.leaf = child;
      c.leafSelection = selection;
    } else if (!c.parent) c.parent = child;
    if (changeStack) for (let i = 0; i < STACK_SIZE - sp.off; i++) sp.buf[sp.off + i] = c.branch[i];
  } else chosen.buf[chosen.off] = 0;
  return r;
}

// useTactic (SoldierBehaviorInterface.h), with BF2’s “limit > 0”: a scripted tactic is always allowed; one past its
// time limit isn’t; a new one needs its bit in the available mask and a team token, which it takes
function useTactic(s, t, k) {
  if (k.tacticScripted === t) return true;
  if (k.tacticCurrent === t && k.tacticTimeActiveLimit > 0 && k.tacticTimeActiveLimit < k.tacticTimeActive) return false;
  const tokens = s.tactics[t];
  if (tokens < 0 || k.tacticCurrent !== t) {
    if (((k.tacticAvailable >>> (t & 31)) & 1) === 0) return false;
    if (tokens < 1) return false;
    s.tactics[t] = tokens - 1;
  }
  return true;
}

// the cover predicates as retail inlines them
const alternateValid = (k) => k.alternateCoverId !== 0 && !(k.alternateCoverScore <= 0 && k.alternateCoverScore !== 0);
const coverValid = (k) => k.coverId !== 0 && !(k.coverScore <= 0 && k.coverScore !== 0);
const coverRequestUpdated = (k) => k.coverId !== k.alternateCoverId && alternateValid(k);
const moveToCover = (k) => coverRequestUpdated(k) || (!k.coverIsInCover && k.coverId !== 0);
const attackElseAim = (k) => (k.allowFire ? 4 : 2);
const notInCover = (k) => (k.coverIsInCover ? 0 : 1);
const bit = (b) => (b ? 1 : 0);

// the melee-projectile decision in its two retail forms, which differ only for a NaN distance
function meleeA(k) {
  const d = k.targetDistance;
  if (!k.guessMeleeProjectileFires || (!k.guessHasHumanTarget && !k.hasScriptedTargets) || !k.guessMeleeProjectileAllowed || !k.targetCanSee ||
    d < k.guessMeleeProjectileLowerRange || d === k.guessMeleeProjectileLowerRange || k.guessMeleeProjectileUpperRange <= d) return 0;
  return k.projectileContinuous ? 1 : bit(k.guessMeleeProjectileContinuous);
}
function meleeB(k) {
  const d = k.targetDistance;
  if (k.guessMeleeProjectileFires && (k.guessHasHumanTarget || k.hasScriptedTargets) && k.guessMeleeProjectileAllowed && k.targetCanSee &&
    k.guessMeleeProjectileLowerRange <= d && d !== k.guessMeleeProjectileLowerRange && d < k.guessMeleeProjectileUpperRange) {
    return k.projectileContinuous ? 1 : bit(k.guessMeleeProjectileContinuous);
  }
  return 0;
}

// attackWhileMoving, with BF2’s aim distance: past it a scripted bot only aims, any other idles
function attackWhileMoving(k) {
  if (!k.targetValid || k.targetDistance <= k.guessMoveAimDistance) {
    if (!k.allowFire) return 2;
    if ((!k.onHumanSquad || k.targetAlerted) && k.moveSettingsFire && k.targetDistance <= k.moveSettingsDistance && k.moveSettingsDistance !== k.targetDistance) return 4;
  } else if (!k.hasScriptedTargets || !k.aimWhileScripted) return 1;
  return 2;
}

// canFireProjectile: BF2 asks its grenade-token pool in place of the source’s grenade state
function canFireProjectile(k, s) {
  const d = k.targetDistance;
  if (!k.projectileFires || (!k.guessHasHumanTarget && !k.hasScriptedTargets) || d < k.projectileLowerRange || d === k.projectileLowerRange ||
    k.projectileUpperRange <= d) return false;
  if (k.projectileContinuous) return true;
  if (!k.projectileAllowGrenade) return false;
  const inCover = k.coverId !== 0 && !!k.coverIsInCover;
  const settled = inCover && k.coverTimeInCover > 2;
  return !!s.tokenFree[k.projectileTokenType] && inCover && settled;
}

// useChargeGrenade: the pool’s type 5
function useChargeGrenade(k, s) {
  const d = k.targetDistance;
  if (!k.allowFire || !k.projectileFires) return false;
  if ((!k.guessHasHumanTarget && !k.hasScriptedTargets) || d < k.projectileLowerRange || d === k.projectileLowerRange || k.projectileUpperRange <= d) return false;
  if (k.projectileContinuous) return true;
  if (!k.projectileAllowChargeGrenade || !k.guessHasHumanTarget) return false;
  const inCover = k.coverId !== 0 && !!k.coverIsInCover;
  const settled = inCover && !(k.coverTimeInCover <= 2);
  return !!s.tokenFree[5] && inCover && settled;
}

// isCloseCombatValid, with BF2’s gates (the follow trigger, the allowed byte, the melee range, the enabled bytes, panic)
function isCloseCombatValid(k) {
  if (k.followTrigger || !k.guessCloseCombatAllowed) return false;
  if (k.guessTargetB1 && k.guessMeleeProjectileFires) {
    const r = Math.fround(1 + k.guessMeleeProjectileUpperRange);
    if (k.targetDistance <= r && r !== k.targetDistance) return false;
  }
  const unprotectiveCover = k.coverId !== 0 && !k.coverIsProtective;
  const visibility = k.onHumanSquad ? k.targetLineOfSight : k.targetCanSee;
  if (k.tacticCurrent !== T.closeCombat) {
    const fail = k.targetMovementToTargetDirectionAngle >= 90 || (!k.targetLineOfFire && !k.guessCloseCombatWithoutLineOfFire) || !visibility ||
      k.targetInVehicle || k.hasScriptedTargets ||
      k.closeCombatEnterDistance < k.closeCombatDistanceToExtrapolatedTargetPos || k.closeCombatEnterDistance === k.closeCombatDistanceToExtrapolatedTargetPos ||
      k.closeCombatHeightDifference <= k.targetHeightDifference;
    const movingToGoodCover = k.coverId !== 0 && !k.coverIsCompromised && k.coverIsCommittable;
    if (k.panic) return false;
    if (movingToGoodCover) return false;
    if (!k.guessCloseCombatEnabled) return false;
    return !fail;
  }
  if (k.tacticTimeActive <= 3 && k.tacticTimeActive !== 3) return true;
  const destinationOk = !unprotectiveCover || (k.targetDestinationAngle <= 20 && k.targetDestinationAngle !== 20);
  const visibilityPassed = !visibility
    ? !(k.closeCombatLostVisibilityTimeout < k.targetTimeSinceSeen || k.closeCombatLostVisibilityTimeout === k.targetTimeSinceSeen)
    : !!k.targetLineOfFire;
  return !k.panic && destinationOk &&
    k.closeCombatDistanceToExtrapolatedTargetPos <= k.closeCombatExitDistance && k.closeCombatExitDistance !== k.closeCombatDistanceToExtrapolatedTargetPos &&
    visibilityPassed && k.targetMovementToTargetDirectionAngle <= 95 && k.targetMovementToTargetDirectionAngle !== 95;
}

function isMeleeChargeValid(k) {
  const charging = k.tacticCurrent === T.meleeCharge && k.guessMeleeChargeIssue;
  const blocked = !k.targetAlive || k.guessMeleeTargetBlocked103 || k.guessMeleeTargetBlocked104;
  return !((!charging || blocked) && k.tacticScripted !== T.meleeCharge && !k.guessMeleeChargeIssue);
}

// ---- the leaves (each waits, as every generated leaf does) ----

const leafWait = () => WAIT;
const leafIdleStayStill = (c) => {
  c.out.act = 1;
  c.out.move = 1;
  return WAIT;
};
function squadAttackWhileScripted(k, add) {
  if (k.friendlySuppress) return 0x0c | add;
  if (!k.targetAlerted && !k.hasScriptedTargets) return (k.aimWhileScripted ? 2 : 1) | add;
  return (k.allowFire && k.allowFireWhileScripted ? 4 : 2) | add;
}
const set = (c, fields) => {
  Object.assign(c.out, fields);
  return WAIT;
};
const friendlyOrder = (c) => set(c, { act: squadAttackWhileScripted(c.in, 0x20) });
const friendlyScripted = (c) => set(c, { move: 1, act: squadAttackWhileScripted(c.in, 0x10) });
const friendlyScriptedPath = (c) => set(c, { move: 3, act: squadAttackWhileScripted(c.in, 0x10) });
const friendlyEnterVehicle = (c) => set(c, { act: 0x40 });
const friendlyEngageFromVehicle = (c) => set(c, { act: 8 });
const friendlyAttackFromVehicle = (c) => set(c, { act: attackElseAim(c.in) });
const friendlyEngageInOpen = (c) => set(c, { move: 1, act: 8, tactic: T.squadEngage });
const friendlyBlinded = (c) => set(c, { blinded: 1 });
const friendlyCloseCombat = (c) => set(c, { act: 4, move: 1, tactic: T.closeCombat });
const friendlySuppressed = (c) => set(c, { suppressed: 1 });
const leafMoveToSelectedCoverCommit = (c) => set(c, { move: 2, commitToAlternateCover: bit(coverRequestUpdated(c.in)) });
const leafStayUnlessInCover = (c) => set(c, { move: notInCover(c.in) });
const friendlyFire = (c) => set(c, { act: !c.in.isAlerted ? 1 : attackElseAim(c.in), move: notInCover(c.in) });
const leafMoveToCoverWhileMoving = (c) => set(c, { move: 2, act: attackWhileMoving(c.in), commitToAlternateCover: bit(coverRequestUpdated(c.in)) });
const leafFireWithProjectile = (c) => set(c, { act: attackElseAim(c.in), fireProjectile: bit(canFireProjectile(c.in, c.shared)), move: notInCover(c.in) });
const leafAttackMoveToCover = (c) => set(c, { move: 2, act: attackWhileMoving(c.in), commitToAlternateCover: bit(coverRequestUpdated(c.in)), guessMeleeAttack: meleeA(c.in) });
const leafAttackFire = (c) => set(c, {
  act: attackElseAim(c.in), fireProjectile: bit(canFireProjectile(c.in, c.shared) || useChargeGrenade(c.in, c.shared)),
  guessMeleeAttack: meleeA(c.in), move: notInCover(c.in),
});
const leafBerserkMove = (c) => set(c, { move: M.berserk, act: attackWhileMoving(c.in), guessMeleeAttack: meleeA(c.in), fireProjectile: bit(canFireProjectile(c.in, c.shared)) });
const leafBerserkFire = (c) => set(c, { act: attackElseAim(c.in), guessMeleeAttack: meleeA(c.in), move: M.berserk });
const leafAttackOrScriptedAim = (c) => set(c, { act: c.in.allowFire ? 4 : c.in.targetValid && c.in.hasScriptedTargets && c.in.aimWhileScripted ? 2 : 1 });
const combatCloseCombat = (c) => set(c, { act: 4, move: 1, tactic: T.closeCombat, guessMeleeAttack: meleeB(c.in) });
const attackWhileScripted = (k, base) => (!k.isAlerted ? base | 1 : k.allowFire && k.allowFireWhileScripted ? base | 4 : base | 2);
const combatScriptedPath = (c) => set(c, { move: 3, act: attackWhileScripted(c.in, 0x10) });
const combatExecuteCombatAction = (c) => set(c, { move: M.executeCombatAction, tactic: T.executeCombatAction, act: 4 });
const combatFire = (c) => set(c, { act: attackElseAim(c.in), move: notInCover(c.in) });
const combatGoToTarget = (c) => set(c, { move: M.goToTarget, tactic: T.goToTarget, act: 1 });
const combatInvestigate = (c) => set(c, { move: M.combatInvestigate, tactic: T.combatInvestigate, act: 1 });
const combatSearchArea = (c) => set(c, { move: M.combatSearchArea, tactic: T.combatSearchArea, act: 1 });
const meleeChargeMove = (c) => set(c, { act: 4, move: M.meleeCharge, guessMeleeAttack: meleeB(c.in) });
const meleeChargeFire = (c) => set(c, { act: attackElseAim(c.in), guessMeleeAttack: meleeB(c.in) });
const meleeChargeMoveAim = (c) => set(c, { move: M.meleeCharge, guessMeleeAttack: meleeA(c.in), act: 2 });
const vehicleMoveToVehicle = (c) => set(c, { move: M.toVehicle, act: attackWhileMoving(c.in) });
const vehicleFire = (c) => set(c, { act: !c.in.inVehicle ? 0x40 : attackElseAim(c.in) });
const goToAttackPointMove = (c) => set(c, { fireProjectile: 0, move: M.goToAttackPoint });
const goToAttackPointFire = (c) => set(c, { act: attackElseAim(c.in), fireProjectile: bit(canFireProjectile(c.in, c.shared)), guessMeleeAttack: 0, move: 1 });
const scriptedAim = (k) => (k.targetValid && k.hasScriptedTargets && k.aimWhileScripted ? 2 : 1);
const leafStayScriptedAim = (c) => set(c, { move: 1, act: scriptedAim(c.in) });
const enemyOrder = (c) => set(c, { move: 1, act: attackWhileScripted(c.in, 0x20) });
const enemyScripted = (c) => set(c, { move: 1, act: attackWhileScripted(c.in, 0x10) });
const enemyEvade = (c) => set(c, { act: 4, move: M.evade, tactic: T.evade });
const enemyInvestigate = (c) => set(c, { move: M.investigate, tactic: T.investigate, act: 1 });
const enemyExecuteIdleAction = (c) => set(c, { move: M.executeIdleAction, tactic: T.executeIdleAction, act: 1 });
const enemyScriptedPath = (c) => set(c, { move: 3, act: 0x10 });
const enemyExecuteSearchAction = (c) => set(c, { move: M.executeSearchAction, tactic: T.executeSearchAction });
const enemySearchAreaMove = (c) => set(c, { move: M.searchArea, tactic: T.searchArea, act: 1 });
const idleMoveToVehicle = (c) => set(c, { move: M.toVehicle });
const idleInVehicle = (c) => set(c, { act: c.in.inVehicle ? 1 : 0x40, suppressed: bit(!c.in.allowFire) });
const followScriptedAim = (c) => set(c, { move: M.chaseTarget, act: scriptedAim(c.in) });
const followCoverMoveIdle = (c) => set(c, { move: 2, commitToAlternateCover: bit(coverRequestUpdated(c.in)), act: 1 });
const followChaseAim = (c) => set(c, { move: M.chaseTarget, act: 2 });
const followChaseWhileMoving = (c) => set(c, { move: M.chaseTarget, tactic: T.follow, act: attackWhileMoving(c.in) });
function followFire(c) {
  const k = c.in;
  set(c, { act: attackElseAim(k), fireProjectile: bit(canFireProjectile(k, c.shared) || useChargeGrenade(k, c.shared)), guessMeleeAttack: meleeA(k) });
  c.out.move = k.coverIsInCover && k.guessFollowMoveToCover ? 2 : notInCover(k);
  return WAIT;
}

// ---- the composites ----

// a decorator that sets a field, runs its children, and restores the field unless a child waits
function decorate(c, fields, run) {
  const old = Object.fromEntries(Object.keys(fields).map((k) => [k, c.out[k]]));
  Object.assign(c.out, fields);
  const r = run();
  if (r !== WAIT) Object.assign(c.out, old);
  return r;
}
// a two-child selection: the first when its test passes and it doesn’t fail, else the second
function pair(c, sp, first, test, second) {
  let r = FAIL;
  if (test) r = evalSelection(1, first, c, sp);
  if (r === FAIL) r = evalSelection(2, second, c, sp);
  return r;
}

// the tactic decorators whose child is the inlined MoveToCover/Fire selection
const tacticCover = (tactic, move, fire) => (c, sp) => decorate(c, { tactic }, () => pair(c, sp, move, moveToCover(c.in), fire));
const combatAttack = tacticCover(T.attack, leafAttackMoveToCover, leafAttackFire);
const combatCharge = tacticCover(T.charge, leafMoveToCoverWhileMoving, leafFireWithProjectile);
const combatCloseRangeAttack = tacticCover(T.closeRangeAttack, leafMoveToCoverWhileMoving, leafFireWithProjectile);
const combatFlee = tacticCover(T.flee, leafMoveToCoverWhileMoving, leafAttackOrScriptedAim);
const combatHide = tacticCover(T.hide, leafMoveToCoverWhileMoving, leafAttackOrScriptedAim);
const friendlySquadMovement = tacticCover(T.squadMovement, leafMoveToCoverWhileMoving, friendlyFire);

const combatBerserk = (c, sp) => decorate(c, { tactic: T.berserk }, () =>
  pair(c, sp, leafBerserkMove, c.in.tacticCurrent === T.berserk && !(c.in.targetDistance <= 0.5), leafBerserkFire));

// the MeleeCharge decorators (combat’s and the enemy melee’s differ in their first child)
function meleeChargeSelection(c, sp, move) {
  const k = c.in;
  const closeEnough = k.guessMelee106 || (k.targetDistance <= k.guessMeleeProjectileUpperRange && k.guessMeleeProjectileAllowed && !k.guessMelee100);
  return decorate(c, { tactic: T.meleeCharge }, () => pair(c, sp, move, !closeEnough, meleeChargeFire));
}
const combatMeleeCharge = (c, sp) => meleeChargeSelection(c, sp, meleeChargeMove);
const enemyMeleeCharge = (c, sp) => meleeChargeSelection(c, sp, meleeChargeMoveAim);

const notMovingToVehicle = (k) => !k.inVehicle && !(k.moveResultStatus === 1 && k.moveResultId === M.toVehicle);
const combatVehicle = (c, sp) => decorate(c, { tactic: T.vehicle }, () => pair(c, sp, vehicleMoveToVehicle, notMovingToVehicle(c.in), vehicleFire));

// a selection over its children in order: the first whose gate passes and that doesn’t fail decides
function select(c, sp, rows) {
  for (let i = 0; i < rows.length; i++) {
    const [gate, node] = rows[i];
    if (!gate()) continue;
    const r = evalSelection(i + 1, node, c, sp);
    if (r !== FAIL) return r;
  }
  return FAIL;
}

// combat’s tactics (the source’s combat_Tactics), in BF2’s order
function combatTactics(c, sp) {
  const k = c.in;
  const s = c.shared;
  const use = (t) => useTactic(s, t, k);
  // isFleeValid: not “failed to find cover”, not “completed”
  const failedToFindCover = !(k.panic || k.coverTimeInCover <= 2 || k.coverTactic === T.flee);
  const completed = !(!k.coverIsInCover || k.coverTimeInCover <= 2 || k.coverTactic !== T.flee ||
    (k.hide && (!k.guessHasHumanTarget || k.targetDistance <= k.vehicleSuppressionDistance)));
  // isChargeValid, with the path to the target
  const charging = k.tacticCurrent === T.charge;
  const chargeIssue = !(charging || k.inVehicle || !k.guessHasValidPathToTarget ||
    k.chargeAllowedToChargeDistance < k.guessPathDistanceToTarget || k.chargeAllowedToChargeDistance === k.guessPathDistanceToTarget);
  const chargeAbort = !(k.coverTimeInCover <= 2 || k.coverTactic !== T.charge);
  // Berserk: the same shape with its own distance and block
  const berserk = k.tacticCurrent === T.berserk;
  const berserkIssue = !(berserk || k.inVehicle || !k.guessHasValidPathToTarget ||
    k.guessBerserkDistance < k.guessPathDistanceToTarget || k.guessBerserkDistance === k.guessPathDistanceToTarget || k.guessBerserkBlocked);
  const berserkAbort = !(k.coverTimeInCover <= 2 || k.coverTactic !== T.berserk);
  return select(c, sp, [
    [() => isMeleeChargeValid(k) && use(T.meleeCharge), combatMeleeCharge],
    [() => !k.coverIsInCover && !k.inVehicle && k.allowFire && isCloseCombatValid(k) && use(T.closeCombat), combatCloseCombat],
    [() => k.hasScriptedPath, combatScriptedPath],
    [() => (k.hasScriptedVehicle || k.hasBookedVehicle) && (k.hasScriptedVehicle || use(T.vehicle)), combatVehicle],
    [() => !failedToFindCover && !completed && ((k.panic && !k.inVehicle) || k.tacticCurrent === T.flee || k.tacticScripted === T.flee) && use(T.flee), combatFlee],
    [() => k.executeActionTrigger && use(T.executeCombatAction), combatExecuteCombatAction],
    [() => k.goToTargetTrigger && use(T.goToTarget), combatGoToTarget],
    [() => (k.hide || k.tacticCurrent === T.hide || k.tacticScripted === T.hide) && use(T.hide), combatHide],
    [() => k.combatInvestigateTrigger && use(T.combatInvestigate), combatInvestigate],
    [() => k.combatSearchAreaTrigger && use(T.combatSearchArea), combatSearchArea],
    [() => ((charging && !chargeAbort) || k.tacticScripted === T.charge || chargeIssue) && use(T.charge), combatCharge],
    [() => ((berserk && !berserkAbort) || k.tacticScripted === T.berserk || berserkIssue) && use(T.berserk), combatBerserk],
    [() => use(T.closeRangeAttack), combatCloseRangeAttack],
    [() => use(T.attack), combatAttack],
    [() => true, combatFire],
  ]);
}

const enemyCombat = (c, sp) => decorate(c, { coverEnabled: 1 }, () => combatTactics(c, sp));

// Follow
const followCoverSelection = (c, sp) => select(c, sp, [[() => moveToCover(c.in), followCoverMoveIdle], [() => true, leafStayUnlessInCover]]);
const followCovered = (c, sp) => select(c, sp, [[() => coverValid(c.in) || alternateValid(c.in), followCoverSelection], [() => true, followChaseAim]]);
const followAttackSelection = (c, sp) => select(c, sp, [[() => moveToCover(c.in), leafAttackMoveToCover], [() => true, followFire]]);
const followAttack = (c, sp) => select(c, sp, [[() => coverValid(c.in) || alternateValid(c.in), followAttackSelection], [() => true, followChaseWhileMoving]]);
const followAlerted = (c, sp) => decorate(c, { coverEnabled: bit(!c.in.guessFollowNoCover) }, () => pair(c, sp, followCovered, c.in.guessFollowCoverMode, followAttack));
const enemyFollow = (c, sp) => decorate(c, { tactic: T.follow }, () => pair(c, sp, followScriptedAim, !c.in.isAlerted, followAlerted));

const enemySearchArea = (c, sp) => select(c, sp, [
  [() => c.in.executeActionTrigger && useTactic(c.shared, T.executeSearchAction, c.in), enemyExecuteSearchAction],
  [() => true, enemySearchAreaMove],
]);

const enemyGoToAttackPoint = (c, sp) => decorate(c, { tactic: T.goToAttackPoint, guessMeleeAttack: 0 }, () => {
  const k = c.in;
  let r = FAIL;
  if (k.guessGoToAttackPoint && useTactic(c.shared, T.goToAttackPoint, k)) r = evalSelection(1, goToAttackPointMove, c, sp);
  if (r === FAIL) {
    if (k.isAlerted && k.targetValid) r = evalSelection(2, goToAttackPointFire, c, sp);
    if (r === FAIL) r = evalSelection(3, leafStayScriptedAim, c, sp);
  }
  return r;
});
const enemyMelee = (c, sp) => decorate(c, { coverEnabled: 0 }, () => {
  const k = c.in;
  return pair(c, sp, enemyMeleeCharge, k.isAlerted && k.targetValid && isMeleeChargeValid(k) && useTactic(c.shared, T.meleeCharge, k), enemyGoToAttackPoint);
});

const idleVehicle = (c, sp) => select(c, sp, [[() => notMovingToVehicle(c.in), idleMoveToVehicle], [() => true, idleInVehicle]]);
const enemyIdle = (c, sp) => select(c, sp, [[() => c.in.inVehicle || c.in.hasScriptedVehicle, idleVehicle], [() => true, leafStayScriptedAim]]);

// enemy_Enemy: the root for a bot not on a human’s squad
function enemyEnemy(c, sp) {
  const k = c.in;
  const use = (t) => useTactic(c.shared, t, k);
  const t = k.tacticScripted !== 0 ? k.tacticScripted : k.tacticCurrent;
  const followable = !(((t - 11) >>> 0) < 4 || t === T.goToTarget);
  return select(c, sp, [
    [() => k.isDead, leafIdleStayStill],
    [() => k.isInteracting, leafIdleStayStill],
    [() => k.hasOrderActive, enemyOrder],
    [() => k.hasScriptedAnimation && !k.hasScriptedPath && !k.guessScriptedAnimationBlocked, enemyScripted],
    [() => k.evadeTrigger && use(T.evade), enemyEvade],
    [() => followable && k.followTrigger && !k.guessFollowBlocked && use(T.follow), enemyFollow],
    [() => k.isAlerted && k.targetValid && !k.meleeCreature, enemyCombat],
    [() => k.investigateTrigger && use(T.investigate), enemyInvestigate],
    [() => k.searchAreaTrigger && use(T.searchArea), enemySearchArea],
    [() => k.executeActionTrigger && use(T.executeIdleAction), enemyExecuteIdleAction],
    [() => k.hasScriptedPath, enemyScriptedPath],
    [() => k.meleeCreature, enemyMelee],
    [() => true, enemyIdle],
  ]);
}

// ---- friendly: a bot on a human’s squad ----

const friendlyInVehicle = (c, sp) => select(c, sp, [[() => c.in.friendlySuppress, friendlyEngageFromVehicle], [() => c.in.isAlerted, friendlyAttackFromVehicle], [() => true, leafWait]]);
const friendlyEngage = (c, sp) => decorate(c, { act: 8, tactic: T.squadEngage }, () => pair(c, sp, leafMoveToSelectedCoverCommit, moveToCover(c.in), leafStayUnlessInCover));
function friendlyTactics(c, sp) {
  const k = c.in;
  return select(c, sp, [
    [() => k.coverIsInCover && !coverRequestUpdated(k) && k.blinded, friendlyBlinded],
    [() => !k.coverIsInCover && !k.inVehicle && k.allowFire && k.isAlerted && isCloseCombatValid(k) && useTactic(c.shared, T.closeCombat, k), friendlyCloseCombat],
    [() => k.coverIsInCover && k.coverIsProtective && !coverRequestUpdated(k) && k.suppressionTicks !== 0, friendlySuppressed],
    [() => k.friendlySuppress && useTactic(c.shared, T.squadEngage, k), friendlyEngage],
    [() => true, friendlySquadMovement],
  ]);
}
const friendlySquadTactics = (c, sp) => decorate(c, { coverEnabled: 1 }, () => friendlyTactics(c, sp));
function friendly(c, sp) {
  const k = c.in;
  return select(c, sp, [
    [() => k.isInteracting, leafIdleStayStill],
    [() => k.hasOrderActive, friendlyOrder],
    [() => k.hasScriptedAnimation && !k.hasScriptedPath, friendlyScripted],
    [() => k.hasScriptedPath, friendlyScriptedPath],
    [() => !k.inVehicle && k.friendlyEnterVehicle, friendlyEnterVehicle],
    [() => k.inVehicle, friendlyInVehicle],
    [() => k.coverId === 0 && k.coverTactic === T.squadEngage && k.friendlySuppress && !k.coverIsInCover && k.targetCanSee && useTactic(c.shared, T.squadEngage, k), friendlyEngageInOpen],
    [() => true, friendlySquadTactics],
  ]);
}

// the leaves’ names: the source’s where a retail leaf corresponds to one, else the port’s
const LEAF_NAMES = new Map([
  [leafWait, 'wait'], [friendlyOrder, 'friendly_Order'], [friendlyScripted, 'friendly_Scripted'], [friendlyScriptedPath, 'friendly_ScriptedPath'],
  [friendlyEnterVehicle, 'friendly_EnterVehicle'], [friendlyEngageFromVehicle, 'friendlyVehicle_Engage'], [friendlyAttackFromVehicle, 'friendlyVehicle_Attack'],
  [friendlyEngageInOpen, 'friendly_EngageInOpen'], [friendlyBlinded, 'friendly_Blinded'], [friendlyCloseCombat, 'friendly_CloseCombat'],
  [friendlySuppressed, 'friendly_Suppressed'], [leafMoveToSelectedCoverCommit, 'moveToCover'], [leafStayUnlessInCover, 'stayUnlessInCover'],
  [friendlyFire, 'friendly_Fire'], [leafMoveToCoverWhileMoving, 'moveToCoverWhileMoving'], [leafFireWithProjectile, 'fireWithProjectile'],
  [leafAttackMoveToCover, 'attack_MoveToCover'], [leafAttackFire, 'attack_Fire'], [leafBerserkMove, 'berserk_Move'], [leafBerserkFire, 'berserk_Fire'],
  [leafAttackOrScriptedAim, 'fireOrScriptedAim'], [combatCloseCombat, 'combat_CloseCombat'], [combatScriptedPath, 'combat_ScriptedPath'],
  [combatExecuteCombatAction, 'combat_ExecuteCombatAction'], [combatFire, 'combat_Fire'], [combatGoToTarget, 'combat_GoToTarget'],
  [combatInvestigate, 'combat_Investigate'], [combatSearchArea, 'combat_SearchArea'], [meleeChargeMove, 'meleeCharge_Move'],
  [meleeChargeFire, 'meleeCharge_Fire'], [meleeChargeMoveAim, 'meleeCharge_MoveAim'], [vehicleMoveToVehicle, 'vehicle_MoveToVehicle'],
  [vehicleFire, 'vehicle_Fire'], [goToAttackPointMove, 'goToAttackPoint_Move'], [goToAttackPointFire, 'goToAttackPoint_Fire'],
  [leafStayScriptedAim, 'enemyIdle_Default'], [enemyOrder, 'enemy_Order'], [enemyScripted, 'enemy_Scripted'], [enemyEvade, 'enemy_Evade'],
  [enemyInvestigate, 'enemy_Investigate'], [enemyExecuteIdleAction, 'enemy_ExecuteIdleAction'], [enemyScriptedPath, 'enemy_ScriptedPath'],
  [enemyExecuteSearchAction, 'enemy_ExecuteSearchAction'], [enemySearchAreaMove, 'enemySearchArea_Move'], [idleMoveToVehicle, 'idle_MoveToVehicle'],
  [idleInVehicle, 'idle_InVehicle'], [followScriptedAim, 'follow_ScriptedAim'], [followCoverMoveIdle, 'follow_MoveToCover'],
  [followChaseAim, 'follow_ChaseAim'], [followChaseWhileMoving, 'follow_Chase'], [followFire, 'follow_Fire'],
]);
function leafName(c) {
  // one retail leaf stands behind three selections
  if (c.leaf === leafIdleStayStill) return c.parent === friendly ? 'friendly_Interacting' : c.leafSelection === 1 ? 'enemy_Dead' : 'enemy_Interaction';
  return LEAF_NAMES.get(c.leaf) ?? '';
}

// One think (SoldierBehavior.inl’s root): a bot on a human’s squad thinks as a friend first, then as an enemy
export function think(bot, knowledge, team) {
  const decision = emptyDecision();
  if (!(knowledge.projectileTokenType >= 0 && knowledge.projectileTokenType < TOKEN_TYPES)) return { status: STATUS.badTokenType, decision, leaf: '', selection: 0 };
  decision.act = 1;
  const c = { in: knowledge, branch: new Uint8Array(STACK_SIZE), out: decision, shared: team, leaf: null, parent: null, leafSelection: 0 };
  const root = { buf: bot.stack, off: 0 };
  if (!knowledge.onHumanSquad || evalSelection(1, friendly, c, root) === FAIL) evalSelection(2, enemyEnemy, c, root);
  bot.thinks++;
  return { status: STATUS.ok, decision, leaf: leafName(c), selection: c.leafSelection };
}

// evaluateTactics: Charge 0, Berserk 1, every tactic but none and vehicle 50 (in retail’s store order); then each
// pending token whose release tick has passed adds its count (a 32-bit add) and leaves the list
export function evaluateTactics(team, nowTick) {
  const pending = team.pending;
  if (pending.length > PENDING_CAPACITY) return STATUS.pendingFull;
  if (pending.some((e) => e.tactic < 0 || e.tactic >= TACTICS_COUNT)) return STATUS.badTactic;
  const t = team.tactics;
  for (const i of [4, 5, 3, 6, 8, 18, 19]) t[i] = 50;
  t[7] = 1;
  t[2] = 0;
  for (const i of [21, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 22]) t[i] = 50;
  team.pending = pending.filter((e) => {
    if (!((e.releaseTick >>> 0) < (nowTick >>> 0))) return true;
    t[e.tactic] = (t[e.tactic] + e.count) | 0;
    return false;
  });
  return STATUS.ok;
}

export function queueToken(team, tactic, count, releaseTick) {
  if (tactic < 0 || tactic >= TACTICS_COUNT) return STATUS.badTactic;
  if (team.pending.length >= PENDING_CAPACITY) return STATUS.pendingFull;
  team.pending.push({ tactic, count, releaseTick: releaseTick >>> 0 });
  return STATUS.ok;
}

const TACTIC_NAMES = ['NoTactic', 'VehicleTactic', 'ChargeTactic', 'AttackTactic', 'HideTactic', 'FleeTactic', 'CloseCombatTactic', 'BerserkTactic',
  'CloseRangeAttackTactic', 'SquadMovementTactic', 'SquadEngageTactic', 'InvestigateTactic', 'CombatInvestigateTactic', 'CombatSearchAreaTactic',
  'SearchAreaTactic', 'ExecuteIdleActionTactic', 'ExecuteSearchActionTactic', 'ExecuteCombatActionTactic', 'FollowTactic', 'GoToTargetTactic',
  'EvadeTactic', 'MeleeChargeTactic', 'GoToAttackPointTactic'];
const MOVE_NAMES = ['None', 'StayStill', 'SelectedCover', 'FollowScriptedPath', 'ChaseTarget', 'GuessBerserk', 'MoveToVehicle', '?7', 'GuessInvestigate',
  'GuessCombatInvestigate', 'GuessCombatSearchArea', 'GuessSearchArea', 'GuessExecuteIdleAction', 'GuessExecuteSearchAction',
  'GuessExecuteCombatAction', 'GuessEvade', 'GuessGoToTarget', 'GuessMeleeCharge', 'GuessGoToAttackPoint'];
export const tacticName = (t) => TACTIC_NAMES[t] ?? '?';
export const moveName = (m) => MOVE_NAMES[m] ?? '?';
