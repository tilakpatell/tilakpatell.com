// The records bf2-web's gate feeds the BF2 tree and the retail think alike
// (WebPort/tests/battleai-bf2-tree.mjs, generateRecords and
// generateEvaluateRecords, copied line for line onto a DataView), and the
// knowledge read out of a record by the C struct's offsets. The digests are
// the ones bf2-web recorded from the retail think run in an emulator
// (WebPort/tests/battleai-bf2-retail.json).
//
//   generateRecords() → Uint8Array ("BF2R", count, 420-byte records)
//   generateEvaluateRecords() → Uint8Array ("BF2E", count, 292-byte team states)
//   knowledgeOf(view, offset) → the knowledge object bf2Tree.js takes
//   RETAIL: the digests

export const RETAIL = {
  records: '2157762410f937bbe1a8c54bdc101be650f59dfad505cded61e23dfa4617cd1b',
  results: '8028ccba5ceefa048b1550cbfbdc4d697459271cc56d0414f611a5a35de466ba',
  evaluateRecords: '67a342e5e74e42e863e0ebe269ff45e2c902a96d4da348ee8cfa5ea55b4d6bc6',
  evaluateResults: '539b761032dd61a7e358559ebd97a775df1d9f84fa081c6834f65af4713b2247',
};
export const RECORD = 420;
export const RESULT = 320;
export const EVAL_RECORD = 292;

const FLT_MAX = 3.4028234663852886e38;
const bools = [0x10, 0x11, 0x12, 0x14, ...Array.from({ length: 0x66 - 0x4c }, (_, i) => 0x4c + i), 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0xb0, 0xb1,
  0xc4, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xf0, 0xf1, 0x100, 0x101, 0x102, 0x103, 0x104, 0x105, 0x106, 0x108, 0x109, 0x10a, 0x10c, 0x120, 0x121, 0x122,
  ...Array.from({ length: 11 }, (_, i) => 0x130 + i)];
const floats = {
  0x04: [0, 1, 2, 2.5, 5], 0x30: [-1, 0, 0.5], 0x38: [-1, 0, 0.5], 0x7c: [0, 1, 2.9, 3, 3.1, 5], 0x80: [-1, 0, 2.5, FLT_MAX],
  0x94: [0, 0.4, 0.5, 0.6, 1, 1.5, 2, 6, 10, 15, 19, 20, 21, 40, 41, 50, 1000], 0x98: [0, 5, 10, 19, 20, 21, 30], 0x9c: [0, 1, 2, 3],
  0xa0: [0, 1, 2, 3], 0xa4: [0, 19, 20, 21], 0xa8: [0, 89, 90, 91, 94, 95, 96], 0xc8: [0, 10, 20, 1000], 0xcc: [0, 10, 20, 1000, FLT_MAX],
  0xd8: [0, 10, 20, 30], 0xdc: [0, 10, 20, 30], 0xe0: [0, 6, 10], 0xe4: [0, 2, 3], 0xe8: [10, 15, 20], 0xec: [0, 2, 3], 0xf4: [0, 3, 6, 14, 15, 16],
  0x110: [0, 10, 20], 0x114: [1, 40, 50], 0x124: [0, 0.5], 0x128: [0, 1, 2], 0x12c: [10, 15, 20],
};
const tacticBias = [0, 0, 0, 1, 2, 3, 3, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
  const below = (n) => next() % n;
  return { next, below, chance: (p) => below(1000) < p * 1000, pick: (a) => a[below(a.length)] };
}
const header = (bytes, magic, count) => {
  for (let i = 0; i < 4; i++) bytes[i] = magic.charCodeAt(i);
  new DataView(bytes.buffer).setUint32(4, count, true);
};

export function generateRecords({ seed = 0x5eedbf2, count = 40000 } = {}) {
  const { next, below, chance, pick } = rng(seed);
  const out = new Uint8Array(8 + count * RECORD);
  header(out, 'BF2R', count);
  const v = new DataView(out.buffer);
  for (let i = 0; i < count; i++) {
    const r = 8 + i * RECORD;
    const k = r + 4;
    out[r] = below(4);
    out[r + 1] = (i < 4 || chance(0.02) ? 1 : 0) | (i % 3 === 0 ? 2 : 0);
    // the bytes the tree never reads stay random: neither side may read them
    for (let j = 0; j < 0x13c; j++) out[k + j] = below(256);
    for (const off of bools) out[k + off] = chance(off === 0x59 || off === 0x5a ? 0.05 : off === 0x55 || off === 0x8c ? 0.75 : 0.3) ? 1 : 0;
    for (const [off, values] of Object.entries(floats)) v.setFloat32(k + Number(off), pick(values), true);
    v.setInt32(k, i % 4, true);
    v.setUint32(k + 0x20, pick(tacticBias), true);
    v.setUint32(k + 0x2c, below(3), true);
    v.setUint32(k + 0x34, below(3), true);
    v.setUint32(k + 0x3c, below(3), true);
    v.setUint32(k + 0x40, chance(0.3) ? 6 : below(19), true);
    v.setUint32(k + 0x70, pick([0, 0, 1, 3]), true);
    v.setUint32(k + 0x78, chance(0.3) ? 0x7fffff : next() & 0x7fffff, true);
    v.setUint32(k + 0x84, pick(tacticBias), true);
    v.setUint32(k + 0x88, chance(0.8) ? 0 : pick(tacticBias), true);
    v.setUint32(k + 0x118, below(8), true);
    // a third on Arcade combat: no override branches, alerted with a target, often in settled cover with a projectile
    if (i % 3 === 1) {
      for (const off of [0x4c, 0x4d, 0x4e, 0x59, 0x5a, 0x63, 0x130, 0x133, 0x135, 0x136, 0x139]) out[k + off] = 0;
      out[k + 0x55] = 1;
      out[k + 0x8c] = 1;
      out[k + 0x57] = chance(0.1) ? 1 : 0;
      out[k + 0x12] = chance(0.7) ? 1 : 0;
      v.setUint32(k + 0x2c, chance(0.8) ? 1 : 0, true);
      v.setUint32(k + 0x34, chance(0.8) ? 1 : below(3), true);
      v.setFloat32(k + 0x04, pick([0, 2.5, 5]), true);
      for (const off of [0x108, 0x10a, 0x10c, 0x5d, 0x8d, 0x52]) out[k + off] = chance(0.7) ? 1 : 0;
      out[k + 0x109] = chance(0.15) ? 1 : 0;
      v.setFloat32(k + 0x110, pick([10, 20]), true);
      v.setFloat32(k + 0x114, pick([40, 50]), true);
      v.setFloat32(k + 0x94, pick([15, 19, 21, 30, 45]), true);
    }
    for (let t = 0; t < 23; t++) v.setInt32(k + 0x13c + 4 * t, chance(0.1) ? -1 : chance(0.3) ? below(3) : 32, true);
    for (let t = 0; t < 8; t++) out[k + 0x13c + 92 + t] = chance(0.5) ? 1 : 0;
  }
  return out;
}

export function generateEvaluateRecords({ seed = 0xe7a1, count = 2000 } = {}) {
  const { below, chance, pick } = rng(seed);
  const out = new Uint8Array(8 + count * EVAL_RECORD);
  header(out, 'BF2E', count);
  const v = new DataView(out.buffer);
  for (let i = 0; i < count; i++) {
    const r = 8 + i * EVAL_RECORD;
    for (let t = 0; t < 23; t++) v.setInt32(r + 4 * t, pick([-1, 0, 1, 2, 31, 32, 49, 50, 51, 0x7fffffff]), true);
    const now = pick([0, 1, 2, 30, 1000, 0xffffffff, below(5000)]);
    v.setUint32(r + 92, now, true);
    const n = i < 8 ? i * 2 : below(17);
    v.setUint32(r + 96, n, true);
    for (let j = 0; j < n; j++) {
      const e = r + 100 + 12 * j;
      v.setInt32(e, chance(0.5) ? 1 : below(23), true);
      v.setInt32(e + 4, pick([1, 1, 1, 2, 3, -1, 0x7fffffff]), true);
      v.setUint32(e + 8, (now + pick([-2, -1, 0, 1, 2, 30]) + 0x100000000) % 0x100000000, true);
    }
  }
  return out;
}

// SoldierKnowledge v36's fields the tree reads, by their offsets (WebPort/ai/battleai-bf2-tree.h), one read each
export function knowledgeOf(v, at) {
  return {
    id: v.getInt32(at + 0x00, true),
    coverTimeInCover: v.getFloat32(at + 0x04, true),
    coverTimeCompromised: v.getFloat32(at + 0x08, true),
    coverIsCompromised: v.getUint8(at + 0x10),
    coverIsCommittable: v.getUint8(at + 0x11),
    coverIsInCover: v.getUint8(at + 0x12),
    coverIsFlanked: v.getUint8(at + 0x13),
    coverIsProtective: v.getUint8(at + 0x14),
    coverTactic: v.getUint32(at + 0x20, true),
    coverSetAtTick: v.getUint32(at + 0x24, true),
    coverId: v.getUint32(at + 0x2c, true),
    coverScore: v.getFloat32(at + 0x30, true),
    alternateCoverId: v.getUint32(at + 0x34, true),
    alternateCoverScore: v.getFloat32(at + 0x38, true),
    moveResultStatus: v.getUint32(at + 0x3c, true),
    moveResultId: v.getUint32(at + 0x40, true),
    hasOrderActive: v.getUint8(at + 0x4c),
    hasScriptedAnimation: v.getUint8(at + 0x4d),
    hasScriptedPath: v.getUint8(at + 0x4e),
    hasScriptedTargets: v.getUint8(at + 0x4f),
    hasScriptedVehicle: v.getUint8(at + 0x50),
    guessScriptedAnimationBlocked: v.getUint8(at + 0x51),
    allowFire: v.getUint8(at + 0x52),
    allowFireWhileScripted: v.getUint8(at + 0x53),
    aimWhileScripted: v.getUint8(at + 0x54),
    isAlerted: v.getUint8(at + 0x55),
    guessFollowCoverMode: v.getUint8(at + 0x56),
    onHumanSquad: v.getUint8(at + 0x57),
    inVehicle: v.getUint8(at + 0x58),
    isDead: v.getUint8(at + 0x59),
    isInteracting: v.getUint8(at + 0x5a),
    isInsideArea: v.getUint8(at + 0x5b),
    hasBookedVehicle: v.getUint8(at + 0x5c),
    guessHasHumanTarget: v.getUint8(at + 0x5d),
    hide: v.getUint8(at + 0x5e),
    panic: v.getUint8(at + 0x5f),
    blinded: v.getUint8(at + 0x60),
    guessFollowBlocked: v.getUint8(at + 0x62),
    meleeCreature: v.getUint8(at + 0x63),
    guessGoToAttackPoint: v.getUint8(at + 0x64),
    guessCloseCombatAllowed: v.getUint8(at + 0x65),
    suppressionTicks: v.getUint32(at + 0x70, true),
    teamMemberCount: v.getUint32(at + 0x74, true),
    tacticAvailable: v.getUint32(at + 0x78, true),
    tacticTimeActive: v.getFloat32(at + 0x7c, true),
    tacticTimeActiveLimit: v.getFloat32(at + 0x80, true),
    tacticCurrent: v.getUint32(at + 0x84, true),
    tacticScripted: v.getUint32(at + 0x88, true),
    targetValid: v.getUint8(at + 0x8c),
    targetCanSee: v.getUint8(at + 0x8d),
    targetLineOfFire: v.getUint8(at + 0x8e),
    targetLineOfSight: v.getUint8(at + 0x8f),
    targetAlerted: v.getUint8(at + 0x90),
    targetInVehicle: v.getUint8(at + 0x91),
    guessHasValidPathToTarget: v.getUint8(at + 0x92),
    targetDistance: v.getFloat32(at + 0x94, true),
    guessPathDistanceToTarget: v.getFloat32(at + 0x98, true),
    targetHeightDifference: v.getFloat32(at + 0x9c, true),
    targetTimeSinceSeen: v.getFloat32(at + 0xa0, true),
    targetDestinationAngle: v.getFloat32(at + 0xa4, true),
    targetMovementToTargetDirectionAngle: v.getFloat32(at + 0xa8, true),
    targetId: v.getInt32(at + 0xac, true),
    targetAlive: v.getUint8(at + 0xb0),
    guessTargetB1: v.getUint8(at + 0xb1),
    moveSettingsFire: v.getUint8(at + 0xc4),
    moveSettingsDistance: v.getFloat32(at + 0xc8, true),
    guessMoveAimDistance: v.getFloat32(at + 0xcc, true),
    friendlyBoundToFriendlyArea: v.getUint8(at + 0xd0),
    friendlyBoundToFollowArea: v.getUint8(at + 0xd1),
    friendlySuppress: v.getUint8(at + 0xd2),
    friendlyEnterVehicle: v.getUint8(at + 0xd3),
    guessBerserkBlocked: v.getUint8(at + 0xd4),
    guessBerserkDistance: v.getFloat32(at + 0xd8, true),
    chargeAllowedToChargeDistance: v.getFloat32(at + 0xdc, true),
    closeCombatEnterDistance: v.getFloat32(at + 0xe0, true),
    closeCombatHeightDifference: v.getFloat32(at + 0xe4, true),
    closeCombatExitDistance: v.getFloat32(at + 0xe8, true),
    closeCombatLostVisibilityTimeout: v.getFloat32(at + 0xec, true),
    guessCloseCombatEnabled: v.getUint8(at + 0xf0),
    guessCloseCombatWithoutLineOfFire: v.getUint8(at + 0xf1),
    closeCombatDistanceToExtrapolatedTargetPos: v.getFloat32(at + 0xf4, true),
    guessMelee100: v.getUint8(at + 0x100),
    guessMelee101: v.getUint8(at + 0x101),
    guessMelee102: v.getUint8(at + 0x102),
    guessMeleeTargetBlocked103: v.getUint8(at + 0x103),
    guessMeleeTargetBlocked104: v.getUint8(at + 0x104),
    guessMeleeChargeIssue: v.getUint8(at + 0x105),
    guessMelee106: v.getUint8(at + 0x106),
    projectileFires: v.getUint8(at + 0x108),
    projectileContinuous: v.getUint8(at + 0x109),
    projectileAllowGrenade: v.getUint8(at + 0x10a),
    projectileAllowChargeGrenade: v.getUint8(at + 0x10c),
    projectileLowerRange: v.getFloat32(at + 0x110, true),
    projectileUpperRange: v.getFloat32(at + 0x114, true),
    projectileTokenType: v.getUint32(at + 0x118, true),
    guessMeleeProjectileFires: v.getUint8(at + 0x120),
    guessMeleeProjectileContinuous: v.getUint8(at + 0x121),
    guessMeleeProjectileAllowed: v.getUint8(at + 0x122),
    guessMeleeProjectileLowerRange: v.getFloat32(at + 0x124, true),
    guessMeleeProjectileUpperRange: v.getFloat32(at + 0x128, true),
    vehicleSuppressionDistance: v.getFloat32(at + 0x12c, true),
    investigateTrigger: v.getUint8(at + 0x130),
    combatInvestigateTrigger: v.getUint8(at + 0x131),
    combatSearchAreaTrigger: v.getUint8(at + 0x132),
    searchAreaTrigger: v.getUint8(at + 0x133),
    executeActionTrigger: v.getUint8(at + 0x135),
    followTrigger: v.getUint8(at + 0x136),
    guessFollowNoCover: v.getUint8(at + 0x137),
    guessFollowMoveToCover: v.getUint8(at + 0x138),
    evadeTrigger: v.getUint8(at + 0x139),
    goToTargetTrigger: v.getUint8(at + 0x13a),
  };
}
