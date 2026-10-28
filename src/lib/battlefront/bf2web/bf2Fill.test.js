import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RETAIL_TACTICS, TACTICS_RECORD, TACTICS_RESULT, generateTacticsRecords, knowledgeOf } from './fixtures/bf2Fuzz.js';
import { SLOT, SLOT_COUNT, constructKnowledge, constructKnowledgeBytes, createTacticInfo, meleeCreature, meleeProjectile, moveSettings, projectile, updateTacticInfo } from './bf2Fill.js';
import { TACTIC } from './bf2Tree.js';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const SLOT_BYTES = 0x13c;

// bf2-web's driver (WebPort/ai/battleai-bf2-driver.cpp), played through the JavaScript, for the constructor, the melee
// byte and TacticInfo
function construct() {
  const out = new Uint8Array(8 + 2 * SLOT_BYTES);
  out.set([66, 70, 50, 75]);
  const v = new DataView(out.buffer);
  v.setUint32(4, 2, true);
  [0x00, 0xcd].forEach((fill, i) => {
    out.fill(fill, 8 + i * SLOT_BYTES, 8 + (i + 1) * SLOT_BYTES);
    constructKnowledgeBytes(v, 8 + i * SLOT_BYTES);
  });
  return out;
}

function melee() {
  const out = new Uint8Array(16);
  out.set([66, 70, 50, 77]);
  new DataView(out.buffer).setUint32(4, 8, true);
  [0, 1, 2, 3, 4, 0x80000002, 0x7fffffff, 0xffffffff].forEach((t, i) => (out[8 + i] = meleeCreature(t)));
  return out;
}

function tactics(records) {
  const view = new DataView(records.buffer);
  const count = view.getUint32(4, true);
  const out = new Uint8Array(8 + count * TACTICS_RESULT);
  out.set([66, 70, 50, 74]);
  const o = new DataView(out.buffer);
  o.setUint32(4, count, true);
  for (let i = 0; i < count; i++) {
    const r = 8 + i * TACTICS_RECORD;
    const [slots, moves, projectiles, melees] = [0, 4, 8, 12].map((k) => view.getUint32(r + k, true));
    const [hideMin, hideMax] = [view.getFloat32(r + 20, true), view.getFloat32(r + 24, true)];
    const rate = view.getUint32(r + 28, true);
    const move = Array.from({ length: SLOT_COUNT }, () => ({}));
    const proj = Array.from({ length: SLOT_COUNT }, () => ({}));
    const mel = Array.from({ length: SLOT_COUNT }, () => ({}));
    const slot = Array.from({ length: SLOT_COUNT }, (_, s) => ((slots >>> s) & 1
      ? { move: (moves >>> s) & 1 ? move[s] : null, projectile: (projectiles >>> s) & 1 ? proj[s] : null, meleeProjectile: (melees >>> s) & 1 ? mel[s] : null, hideLimitMin: hideMin, hideLimitMax: hideMax }
      : null));
    const info = createTacticInfo({ slot, vehicleSuppressionDistance: 0 }, records[r + 16] !== 0);
    const slotOf = (x, all) => (x ? all.indexOf(x) : -1);
    const getters = (at) => {
      o.setInt32(at, slotOf(moveSettings(info), move), true);
      o.setInt32(at + 4, slotOf(meleeProjectile(info), mel), true);
      o.setInt32(at + 8, slotOf(projectile(info), proj), true);
    };
    const at0 = 8 + i * TACTICS_RESULT;
    o.setUint32(at0, info.current, true);
    o.setUint32(at0 + 4, info.ticksActive, true);
    o.setUint32(at0 + 8, info.limitTicks, true);
    o.setUint32(at0 + 12, info.available, true);
    getters(at0 + 16);
    for (let step = 0; step < 8; step++) {
      const e = r + 32 + step * 12;
      const rnd = { value: view.getFloat32(e + 8, true), called: 0, min: 0, max: 0 };
      updateTacticInfo(info, view.getUint32(e, true), view.getUint32(e + 4, true), rate, (min, max) => {
        Object.assign(rnd, { called: 1, min, max });
        return rnd.value;
      });
      const at = at0 + 28 + step * 36;
      o.setUint32(at, info.current, true);
      o.setUint32(at + 4, info.ticksActive, true);
      o.setUint32(at + 8, info.limitTicks, true);
      getters(at + 12);
      o.setUint32(at + 24, rnd.called, true);
      o.setFloat32(at + 28, rnd.min, true);
      o.setFloat32(at + 32, rnd.max, true);
    }
  }
  return out;
}

describe('the soldier state round BF2’s tree, against the retail functions', () => {
  it('constructs the knowledge as retail does, on a slot of zeros and one of 0xCD', () => {
    expect(sha256(construct())).toBe(RETAIL_TACTICS.construct);
  });

  it('sets the melee-creature byte for SoldierMeleeType 2 alone', () => {
    expect(sha256(melee())).toBe(RETAIL_TACTICS.melee);
  });

  it('runs TacticInfo, its updates and getters as retail does, on 3,000 bots of 8 decisions', () => {
    const records = generateTacticsRecords();
    expect(sha256(records)).toBe(RETAIL_TACTICS.records);
    expect(sha256(tactics(records))).toBe(RETAIL_TACTICS.results);
  });

  it('builds the same knowledge object as the constructor’s bytes on a zeroed slot', () => {
    const v = new DataView(new ArrayBuffer(SLOT_BYTES));
    constructKnowledgeBytes(v, 0);
    expect(constructKnowledge()).toEqual(knowledgeOf(v, 0));
  });
});

describe('TacticInfo, by hand', () => {
  const settings = { move: { fire: 1 }, projectile: { lower: 10 }, meleeProjectile: null, hideLimitMin: 2, hideLimitMax: 4 };
  const assault = () => createTacticInfo({ slot: Object.assign(Array(SLOT_COUNT).fill(null), { [SLOT.attack]: settings, [SLOT.hide]: settings }), vehicleSuppressionDistance: 15 });

  it('makes the tactics its settings hold available', () => {
    expect(assault().available).toBe((1 << TACTIC.attack) | (1 << TACTIC.hide));
  });

  it('counts the ticks of a tactic, limits a Hide by its draw, and clears on a scripted act', () => {
    const info = assault();
    updateTacticInfo(info, 4, TACTIC.attack, 30);
    updateTacticInfo(info, 4, TACTIC.attack, 30);
    expect(info).toMatchObject({ current: TACTIC.attack, ticksActive: 1, limitTicks: 0xffffffff });
    updateTacticInfo(info, 4, TACTIC.hide, 30, (min, max) => (min + max) / 2);
    expect(info.limitTicks).toBe(90);
    updateTacticInfo(info, 0x10, TACTIC.attack, 30);
    expect(info).toMatchObject({ current: 0, ticksActive: 0 });
  });

  it('answers the attack’s move and projectile settings', () => {
    const info = assault();
    updateTacticInfo(info, 4, TACTIC.attack, 30);
    expect(moveSettings(info)).toBe(settings.move);
    expect(projectile(info)).toBe(settings.projectile);
    expect(meleeProjectile(info)).toBeNull();
  });
});
