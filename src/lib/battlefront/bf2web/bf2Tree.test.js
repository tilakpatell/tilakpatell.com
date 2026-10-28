import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EVAL_RECORD, RECORD, RESULT, RETAIL, generateEvaluateRecords, generateRecords, knowledgeOf } from './fixtures/bf2Fuzz.js';
import { ACT, MOVE, STATUS, TACTIC, createBot, createTeam, emptyKnowledge, evaluateTactics, moveName, queueToken, resetBot, tacticName, think } from './bf2Tree.js';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// bf2-web's tree driver (WebPort/ai/battleai-bf2-driver.cpp) played through the JavaScript: eight bots, one team whose
// tokens persist unless a record sets them, each result the status, the decision's 23 bytes, the team's tokens and the
// bot's mind stack after the think
function thinkAll(records) {
  const view = new DataView(records.buffer);
  const count = view.getUint32(4, true);
  const out = new Uint8Array(8 + count * RESULT);
  out.set([66, 70, 50, 79]);
  const o = new DataView(out.buffer);
  o.setUint32(4, count, true);
  const bots = Array.from({ length: 8 }, createBot);
  const team = createTeam();
  for (let i = 0; i < count; i++) {
    const r = 8 + i * RECORD;
    const bot = bots[records[r] & 7];
    if (records[r + 1] & 1) resetBot(bot);
    if (records[r + 1] & 2) {
      for (let t = 0; t < 23; t++) team.tactics[t] = view.getInt32(r + 4 + 0x13c + 4 * t, true);
      for (let t = 0; t < 8; t++) team.tokenFree[t] = records[r + 4 + 0x13c + 92 + t];
    }
    const { status, decision: d } = think(bot, knowledgeOf(view, r + 4), team);
    const at = 8 + i * RESULT;
    o.setInt32(at, status, true);
    o.setUint32(at + 4, d.act, true);
    o.setUint32(at + 8, d.move, true);
    o.setUint32(at + 12, d.tactic, true);
    out[at + 16] = d.commitToAlternateCover;
    out[at + 17] = d.coverEnabled;
    out[at + 23] = d.suppressed;
    out[at + 24] = d.blinded;
    out[at + 25] = d.fireProjectile;
    out[at + 26] = d.guessMeleeAttack;
    for (let t = 0; t < 23; t++) o.setInt32(at + 28 + 4 * t, team.tactics[t], true);
    out.set(bot.stack, at + 120);
  }
  return out;
}

// the evaluate driver: each record a whole team state
function evaluateAll(records) {
  const view = new DataView(records.buffer);
  const count = view.getUint32(4, true);
  const out = new Uint8Array(8 + count * EVAL_RECORD);
  out.set([66, 70, 50, 70]);
  const o = new DataView(out.buffer);
  o.setUint32(4, count, true);
  for (let i = 0; i < count; i++) {
    const r = 8 + i * EVAL_RECORD;
    const team = createTeam();
    for (let t = 0; t < 23; t++) team.tactics[t] = view.getInt32(r + 4 * t, true);
    const now = view.getUint32(r + 92, true);
    const n = view.getUint32(r + 96, true);
    team.pending = Array.from({ length: n }, (_, j) => ({ tactic: view.getInt32(r + 100 + 12 * j, true), count: view.getInt32(r + 104 + 12 * j, true), releaseTick: view.getUint32(r + 108 + 12 * j, true) }));
    const status = evaluateTactics(team, now);
    const at = 8 + i * EVAL_RECORD;
    o.setInt32(at, status, true);
    for (let t = 0; t < 23; t++) o.setInt32(at + 4 + 4 * t, team.tactics[t], true);
    if (status === STATUS.ok) {
      o.setUint32(at + 96, team.pending.length, true);
      team.pending.forEach((e, j) => {
        o.setInt32(at + 100 + 12 * j, e.tactic, true);
        o.setInt32(at + 104 + 12 * j, e.count, true);
        o.setUint32(at + 108 + 12 * j, e.releaseTick, true);
      });
    }
  }
  return out;
}

describe('BF2’s soldier tree, against the retail think', () => {
  const records = generateRecords();

  it('is fed bf2-web’s own 40,000 records', () => {
    expect(sha256(records)).toBe(RETAIL.records);
  });

  it('decides what the retail think decided on every one, byte for byte (decision, tokens and mind stack)', () => {
    expect(sha256(thinkAll(records))).toBe(RETAIL.results);
  });

  it('refills the team’s tokens as the retail evaluateTactics does, on 2,000 team states', () => {
    const evaluate = generateEvaluateRecords();
    expect(sha256(evaluate)).toBe(RETAIL.evaluateRecords);
    expect(sha256(evaluateAll(evaluate))).toBe(RETAIL.evaluateResults);
  });
});

describe('BF2’s soldier tree, by hand', () => {
  // an alerted bot with a target it can see and hit, out of cover, every tactic available, the team refilled
  function combat(over = {}) {
    const k = { ...emptyKnowledge(), isAlerted: 1, targetValid: 1, targetCanSee: 1, targetLineOfFire: 1, targetAlive: 1, allowFire: 1, tacticAvailable: 0x7fffff, targetDistance: 15, ...over };
    const team = createTeam();
    evaluateTactics(team, 1);
    return { k, team, bot: createBot() };
  }

  it('takes a close-range attack before the attack when it may, and fires', () => {
    const { k, team, bot } = combat();
    const r = think(bot, k, team);
    expect(r.decision).toMatchObject({ tactic: TACTIC.closeRangeAttack, act: ACT.attack, move: MOVE.stayStill, coverEnabled: 1 });
    expect(r.leaf).toBe('fireWithProjectile');
    expect(team.tactics[TACTIC.closeRangeAttack]).toBe(49);
  });

  it('moves to a cover it was given, firing while it moves when the target is within its fire distance', () => {
    const { k, team, bot } = combat({ coverId: 7, coverScore: 1, moveSettingsFire: 1, moveSettingsDistance: 30, guessMoveAimDistance: 100 });
    const r = think(bot, k, team);
    expect(r.decision).toMatchObject({ move: MOVE.selectedCover, act: ACT.attack });
    expect(r.leaf).toBe('moveToCoverWhileMoving');
  });

  it('just aims when it may not fire, and stands idle when it has no target', () => {
    const { k, team, bot } = combat({ allowFire: 0 });
    expect(think(bot, k, team).decision.act).toBe(ACT.aim);
    const idle = think(createBot(), emptyKnowledge(), team);
    expect(idle.decision).toMatchObject({ act: ACT.idle, move: MOVE.stayStill });
    expect(idle.leaf).toBe('enemyIdle_Default');
  });

  it('runs out of tokens and falls through to the plain fire', () => {
    const { k, team } = combat();
    for (let i = 0; i < 50; i++) think(createBot(), k, team);
    expect(team.tactics[TACTIC.closeRangeAttack]).toBe(0);
    expect(think(createBot(), k, team).decision.tactic).toBe(TACTIC.attack);
  });

  it('keeps the mind’s selection on its stack between thinks', () => {
    const { k, team, bot } = combat();
    think(bot, k, team);
    expect(bot.stack[0]).toBe(2);
    expect(bot.thinks).toBe(1);
  });

  it('refuses a projectile token type outside the pool and writes nothing', () => {
    const { k, team, bot } = combat({ projectileTokenType: 9 });
    expect(think(bot, k, team)).toMatchObject({ status: STATUS.badTokenType, decision: { act: 0 } });
    expect(bot.thinks).toBe(0);
  });

  it('releases a queued token once its tick has passed', () => {
    const team = createTeam();
    expect(queueToken(team, TACTIC.vehicle, 1, 10)).toBe(STATUS.ok);
    evaluateTactics(team, 10);
    expect(team.tactics[TACTIC.vehicle]).toBe(0);
    evaluateTactics(team, 11);
    expect(team.tactics[TACTIC.vehicle]).toBe(1);
    expect(team.pending).toHaveLength(0);
    expect(team.tactics[TACTIC.charge]).toBe(0);
    expect(team.tactics[TACTIC.berserk]).toBe(1);
  });

  it('names its tactics and moves as bf2-web does', () => {
    expect(tacticName(TACTIC.goToAttackPoint)).toBe('GoToAttackPointTactic');
    expect(moveName(MOVE.meleeCharge)).toBe('GuessMeleeCharge');
  });
});
