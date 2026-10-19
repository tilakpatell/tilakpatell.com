import { describe, expect, it } from 'vitest';
import { BACK, PAUSE_AFTER_INPUT, RUN, WALK, newClock, rideSeconds, step } from './clock';
import { STAGES } from './stages/index';
import { total } from './line';

const TOTAL = 1000; // metres, for round numbers
const none = { walk: false, run: false, back: false, toggleAuto: false, next: false };
const ctx = (o = {}) => ({ total: TOTAL, holdAt: () => 0, nextBeat: () => null, ...o });
// run the clock for `seconds` at 60 a second, the same input every frame
const run = (state, seconds, input = none, c = ctx()) => {
  let s = state;
  for (let i = 0; i < Math.round(seconds * 60); i++) s = step(s, 1 / 60, input, c);
  return s;
};

describe('the clock', () => {
  it('a held walk moves the ride at a walk, Shift at a run, S back at a step', () => {
    const still = newClock({ s: 0.5, auto: false });
    expect(run(still, 1, { ...none, walk: true }).s).toBeCloseTo(0.5 + WALK / TOTAL, 9);
    expect(run(still, 1, { ...none, run: true }).s).toBeCloseTo(0.5 + RUN / TOTAL, 9);
    expect(run(still, 1, { ...none, back: true }).s).toBeCloseTo(0.5 - BACK / TOTAL, 9);
    expect(run(newClock({ s: 0, auto: false }), 1, { ...none, back: true }).s).toBe(0);
    expect(run(newClock({ s: 1, auto: false }), 1, { ...none, walk: true }).s).toBe(1);
    expect(run(still, 1, { ...none, run: true }).mode).toBe('run');
    expect(run(still, 1).mode).toBe('idle');
  });

  it('auto walks on its own, and a held W with it on is still a walk, not two', () => {
    const auto = newClock({ s: 0 });
    expect(auto.auto).toBe(true);
    expect(run(auto, 1).s).toBeCloseTo(WALK / TOTAL, 9);
    const held = step(auto, 1, { ...none, walk: true }, ctx());
    expect(held.speed).toBe(WALK);
    expect(held.s).toBeCloseTo(WALK / TOTAL, 9);
  });

  it('a hand on the keys pauses auto for a while, then it walks on', () => {
    let c = run(newClock({ s: 0.5 }), 0.5, { ...none, back: true });
    const after = c.s;
    c = run(c, PAUSE_AFTER_INPUT - 0.1);
    expect(c.s).toBeCloseTo(after, 9);
    c = run(c, 1);
    expect(c.s).toBeGreaterThan(after);
  });

  it('Space turns auto off and on', () => {
    const off = step(newClock({ s: 0 }), 1 / 60, { ...none, toggleAuto: true }, ctx());
    expect(off.auto).toBe(false);
    expect(run(off, 2).s).toBe(off.s);
    expect(step(off, 1 / 60, { ...none, toggleAuto: true }, ctx()).auto).toBe(true);
  });

  it('auto waits out a beat’s hold, then goes on; a visitor walking through does not wait', () => {
    const beat = 0.01; // 10 m in
    const c = ctx({ holdAt: (s) => (Math.abs(s - beat) < 1e-9 ? 10 : 0), nextBeat: (s) => (s < beat ? beat : null) });
    let a = run(newClock({ s: 0 }), 5, none, c); // 12.5 m of walk, the beat at 10
    expect(a.s).toBeCloseTo(beat, 9);
    expect(a.mode).toBe('hold');
    a = run(a, 9);
    expect(a.s).toBeCloseTo(beat, 9);
    a = run(a, 2);
    expect(a.mode).toBe('walk');
    expect(a.s).toBeGreaterThan(beat);
    const walked = run(newClock({ s: 0, auto: false }), 5, { ...none, walk: true }, c);
    expect(walked.s).toBeCloseTo(5 * WALK / TOTAL, 9);
  });

  it('reduced motion never walks on its own; Next steps to the next beat, a still', () => {
    const beats = [0.1, 0.2];
    const c = ctx({ nextBeat: (s) => beats.find((b) => b > s + 1e-9) ?? null });
    let r = newClock({ s: 0, reduced: true });
    expect(r.auto).toBe(false);
    r = run(r, 3, none, c);
    expect(r.s).toBe(0);
    r = step(r, 1 / 60, { ...none, toggleAuto: true }, c);
    expect(run(r, 3, none, c).s).toBe(0);
    r = step(r, 1 / 60, { ...none, next: true }, c);
    expect(r.s).toBe(0.1);
    expect(r.mode).toBe('still');
    r = step(r, 1 / 60, { ...none, next: true }, c);
    expect(r.s).toBe(0.2);
    expect(step(r, 1 / 60, { ...none, next: true }, c).s).toBe(1);
  });

  it('the ledger: a ride on auto is 20 to 30 minutes, each stage 1 to 2.5 (half a minute of holds a stage until the stages say theirs)', () => {
    const secs = rideSeconds(STAGES, () => 30);
    expect(secs).toBe(total(STAGES) / WALK + STAGES.length * 30);
    expect(secs).toBeGreaterThanOrEqual(1200);
    expect(secs).toBeLessThanOrEqual(1800);
    for (const st of STAGES) {
      const one = st.length / WALK + 30;
      expect(one).toBeGreaterThanOrEqual(60);
      expect(one).toBeLessThanOrEqual(150);
    }
  });
});
