import { describe, expect, it, vi } from 'vitest';
import { STEPS, createPace } from '../lib/three/pace';
import { mipBias, setMipBias, setMipState } from '../lib/three/mipBias';
import { STEPS as DYNRES_STEPS } from './dynres';
import { RESOLUTION_STEPS, UHD, createQuality, headroomAt, stepsAt } from './quality';

// a stand-in pace: `levels` is what each frame() call returns, in turn
const fakePace = (levels, last = STEPS.length - 1) => {
  let i = 0;
  const pace = { level: 0, scale: 1, reset: vi.fn() };
  pace.frame = () => {
    const l = levels[Math.min(i++, levels.length - 1)];
    if (l === null) return null;
    pace.level = l;
    pace.scale = STEPS[Math.min(l, last)];
    return pace.scale;
  };
  return pace;
};

describe('createQuality', () => {
  it('starts at the tier budget, sharpest', () => {
    const q = createQuality({ tier: 'mid', pace: fakePace([null]) });
    expect(q.tier).toBe('mid');
    expect(q.budget.ratio).toBe(1.5);
    expect(q.level).toBe(0);
    expect(q.scale).toBe(1);
    expect(q.ratio).toBe(1.5);
  });

  // This pinned 1 at a 1× screen on the high tier. But every world on the
  // runtime really drew at 1.25 there: the WebGL backend's resize went
  // through lib/three/renderer's own ratio, which keeps the budget's least
  // (lib/device's minRatio). Now the runtime alone sets the ratio, so it
  // keeps that least itself, or every world would draw softer than it
  // always has on a 1× screen.
  it("draws the screen's own pixels, and at least the budget's least, never past its most nor a module's cap", () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 1 });
    expect(q.ratio).toBe(1.25);
    expect(q.ratioUnder(1.5)).toBe(1.25);
    expect(q.ratioUnder(1.1)).toBe(1.1); // (a module's cap is under it all)
    const mid = createQuality({ tier: 'mid', pace: fakePace([null]), dpr: 1 });
    expect(mid.ratio).toBe(1); // (no least on the mid tier: a 1× screen draws at 1)
    // a strong card (lib/device's ultra row) draws one and a half pixels for each of a 1× screen's
    const ultra = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 1, minRatio: 1.5 });
    expect(ultra.ratioUnder(1.5)).toBe(1.5);
    expect(ultra.ratio).toBe(1.5);
    const sharp = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 3 });
    expect(sharp.ratio).toBe(2);
    expect(sharp.ratioUnder(1.5)).toBe(1.5);
    expect(sharp.ratioUnder(undefined)).toBe(2);
    // and the pace's scale comes off whatever that is, unless asked for without it
    const softer = createQuality({ tier: 'high', pace: fakePace([2]), dpr: 2 });
    softer.frame(0);
    expect(softer.ratioUnder(1.5)).toBeCloseTo(1.5 * STEPS[2]);
    expect(softer.ratioUnder(1.5, { unscaled: true })).toBe(1.5);
  });

  it('follows the pace down and tells listeners once per change', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null, 1, null, 1, 0]) });
    const seen = [];
    q.on((l) => seen.push(l));
    expect(q.frame(0)).toBe(null);
    expect(q.frame(16)).toBe(1);
    expect(q.ratio).toBeCloseTo(2 * STEPS[1]);
    expect(q.frame(32)).toBe(null);
    expect(q.frame(48)).toBe(null); // the same level again: no change
    expect(q.frame(64)).toBe(0);
    expect(seen).toEqual([1, 0]);
    expect(q.ratio).toBe(2);
  });

  it('floors once when the last step still misses', () => {
    const last = STEPS.length - 1;
    const pace = fakePace([last, ...Array(400).fill(null)]);
    // (the stand-in now says it's still late at its softest: the floor
    // waits for that, where it used to come on a clock alone)
    pace.stuck = 1;
    const q = createQuality({ tier: 'low', pace, floorAfter: 2500 });
    const seen = [];
    q.on((l) => seen.push(l));
    expect(q.frame(0)).toBe(last);
    let now = 0;
    let floored = null;
    for (let i = 1; i < 300 && floored === null; i++) {
      now += 16;
      const r = q.frame(now);
      if (r !== null) floored = { r, now };
    }
    expect(floored.r).toBe(STEPS.length);
    expect(floored.now).toBeGreaterThanOrEqual(2500);
    expect(q.level).toBe(STEPS.length);
    expect(q.scale).toBe(STEPS[last]); // the picture is no softer than the last step
    for (let i = 0; i < 200; i++) expect(q.frame((now += 16))).toBe(null); // once
    expect(seen).toEqual([last, STEPS.length]);
    q.reset();
    expect(q.level).toBe(0);
  });

  it('sits at the last step without flooring while frames there come on time, and floors once they are late', () => {
    const last = STEPS.length - 1;
    const pace = fakePace([last, ...Array(800).fill(null)]);
    pace.stuck = 0;
    const q = createQuality({ tier: 'high', pace, floorAfter: 2500 });
    q.frame(0);
    let now = 0;
    for (let i = 0; i < 400; i++) expect(q.frame((now += 16))).toBe(null); // 6 s at the last step, keeping up
    expect(q.level).toBe(last);
    pace.stuck = 2; // (late again there)
    expect(q.frame((now += 16))).toBe(STEPS.length);
    for (let i = 0; i < 100; i++) expect(q.frame((now += 16))).toBe(null); // once
  });

  it('a hold lets frames go by unjudged from the first one after it, then judges them again', () => {
    const pace = fakePace([1]);
    pace.frame = vi.fn(pace.frame);
    const q = createQuality({ tier: 'high', pace });
    q.hold(3000);
    expect(q.frame(1000)).toBe(null); // (the hold runs from here)
    expect(q.frame(2500)).toBe(null);
    expect(q.frame(3990)).toBe(null);
    expect(pace.frame).not.toHaveBeenCalled(); // (late or not, nothing goes to the pace)
    expect(q.frame(4010)).toBe(1);
  });

  it('a reset and a hold give a new world a clean start', () => {
    const pace = fakePace([2, null]);
    const q = createQuality({ tier: 'high', pace, dpr: 2 });
    q.frame(0);
    expect(q.level).toBe(2);
    q.reset();
    q.hold(3000);
    expect(pace.reset).toHaveBeenCalled();
    expect(q.level).toBe(0);
    expect(q.ratioUnder(1.5)).toBe(1.5);
    expect(q.frame(10000)).toBe(null);
  });

  // An arrival on a strong graphics card (8 ms frames at 60 Hz) with six
  // hitches of 50 to 80 ms in its first second (models parsed, uploaded and
  // linked): the real pace under the governor stepped down at 0.7 s and back
  // up at 5.2 s, two blinks and three sharpnesses in five seconds, for
  // frames that were fine from then on. Held for the arrival, nothing moves.
  it("a world's first three seconds held: an arrival's hitches move nothing", () => {
    const trace = (held) => {
      const q = createQuality({ tier: 'high', dpr: 2, pace: createPace({ onFloor: () => {} }) });
      if (held) q.hold(3000);
      const beat = 1000 / 60;
      const changes = [];
      let t = 1000;
      q.frame(t);
      for (let i = 0; t < 1000 + 40000; i++) {
        const cost = t - 1000 < 1000 && i % 3 === 0 ? 50 + (i % 4) * 10 : 8;
        t += Math.ceil(cost / beat - 1e-6) * beat; // (on the next vsync)
        const l = q.frame(t);
        if (l !== null) changes.push({ at: Math.round(t - 1000), l });
      }
      return changes;
    };
    const free = trace(false);
    expect(free.length).toBeGreaterThan(0);
    expect(free[0].at).toBeLessThan(3000);
    expect(trace(true)).toEqual([]);
  });

  it('a listener can leave', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([1, 2]) });
    const fn = vi.fn();
    const off = q.on(fn);
    q.frame(0);
    off();
    q.frame(16);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('a quality level changed while a world is up', () => {
  it('takes the new level’s budget', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 2 });
    q.retune('low');
    expect(q.budget.ratio).toBe(1);
    expect(q.ratio).toBe(1);
    q.retune('ultra');
    expect(q.budget.samples).toBe(8);
    q.retune('nonsense');
    expect(q.budget.ratio).toBe(2);
  });

  // (a world built after the change reads the tier for its chain, its cut
  // and its boot: Low picked mid-visit built High's level until 2026-10-13)
  it('moves its tier with the level, ultra being the high tier', () => {
    const q = createQuality({ tier: 'high', detail: 'high', pace: fakePace([null]) });
    q.retune('low');
    expect(q.tier).toBe('low');
    q.retune('mid');
    expect(q.tier).toBe('mid');
    q.retune('ultra');
    expect(q.tier).toBe('high');
    q.retune('nonsense');
    expect(q.tier).toBe('high');
  });

  it('takes its tier from a level given alone (a held Low on a laptop whose device tier is high)', () => {
    expect(createQuality({ detail: 'low', pace: fakePace([null]) }).tier).toBe('low');
    expect(createQuality({ detail: 'ultra', pace: fakePace([null]) }).tier).toBe('high');
  });

  it('draws sharper or softer by the sharpness, never past the level’s ratio', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 1, sharp: 1.5 });
    expect(q.ratio).toBe(1.5);
    q.setSharpness(0.5);
    expect(q.ratio).toBe(0.5);
    q.setSharpness(9);
    expect(q.ratio).toBe(2);
    expect(q.ratioUnder(1)).toBe(1);
  });
});

describe('the renderer row a quality level starts from', () => {
  it('starts an ultra level on ultra’s row, its tier still high', () => {
    const q = createQuality({ tier: 'high', detail: 'ultra', pace: fakePace([null]) });
    expect(q.tier).toBe('high');
    expect(q.budget.samples).toBe(8);
    expect(q.budget.shadowMap).toBe(4096);
  });

  it('keeps high on high’s row', () => {
    const q = createQuality({ tier: 'high', detail: 'high', pace: fakePace([null]) });
    expect(q.budget.samples).toBe(4);
  });
});

describe('headroomAt (lane U)', () => {
  it('steps the internal resolution down before shedding a pass', () => {
    expect(RESOLUTION_STEPS).toEqual([1, 0.77, 0.67, 0.5]);
    expect([0, 1, 2, 3].map((l) => headroomAt(l))).toEqual([1, 0.77, 0.67, 0.5].map((scale) => ({ scale, shed: 0 })));
    expect(headroomAt(4)).toEqual({ scale: 0.5, shed: 1 });
    expect(headroomAt(7)).toEqual({ scale: 0.5, shed: 4 });
  });
  it('starts ultra at 0.77 and high at 0.67 on a 4K buffer, nothing else', () => {
    expect(headroomAt(0, { tier: 'ultra', pixels: UHD })).toEqual({ scale: 0.77, shed: 0 });
    expect(headroomAt(1, { tier: 'ultra', pixels: UHD })).toEqual({ scale: 0.67, shed: 0 });
    expect(headroomAt(0, { tier: 'high', pixels: UHD })).toEqual({ scale: 0.67, shed: 0 });
    expect(headroomAt(2, { tier: 'high', pixels: UHD })).toEqual({ scale: 0.5, shed: 1 });
    expect(headroomAt(0, { tier: 'ultra', pixels: 2560 * 1440 })).toEqual({ scale: 1, shed: 0 });
    expect(headroomAt(0, { tier: 'mid', pixels: UHD })).toEqual({ scale: 1, shed: 0 });
  });
});

// a stand-in for lane G1's clock (lib/three/gpuTime's face): `times` is what
// `last` reads after each frame(), in turn
const fakeClock = (times, available = true) => {
  let i = 0;
  const clock = { available, last: null, median: null, p95: null };
  // (each frame a new reading, as a fresh object would be: equal numbers are new readings here)
  clock.frame = vi.fn(() => {
    clock.last = times[Math.min(i++, times.length - 1)] + i * 1e-9;
  });
  return clock;
};

describe('the GPU clock as the source (lane N2)', () => {
  it('falls back to the pace silently when there is no GPU time', () => {
    const pace = fakePace([1]);
    const q = createQuality({ tier: 'high', pace, source: 'gpu', gpuTime: { available: false } });
    expect(q.source).toBe('cpu');
    expect(q.frame(16)).toBe(1);
    expect(createQuality({ tier: 'high', pace, source: 'gpu' }).source).toBe('cpu');
  });

  it('steps the level by the GPU time, never the pace, and keeps the canvas’s scale at 1', () => {
    const pace = fakePace([3]);
    const clock = fakeClock([30]);
    const q = createQuality({ tier: 'high', pace, source: 'gpu', gpuTime: clock });
    expect(q.source).toBe('gpu');
    const seen = [];
    q.on((l) => seen.push(l));
    const got = [1, 2, 3].map((t) => q.frame(t * 16));
    expect(got).toEqual([null, null, 1]);
    expect(clock.frame).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([1]);
    expect(q.level).toBe(1);
    // (the output size never changes: only the chain's internal scale moves)
    expect(q.scale).toBe(1);
    expect(q.internal).toBe(0.77);
  });

  it('switches per world: the classic renderer keeps the pace, and a world’s start puts the controller back at 1', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]) });
    expect(q.source).toBe('cpu');
    q.setSource('gpu', { gpuTime: fakeClock([30]) });
    expect(q.source).toBe('gpu');
    for (let t = 1; t <= 3; t++) q.frame(t * 16);
    expect(q.level).toBe(1);
    q.reset();
    expect(q.level).toBe(0);
    expect(q.internal).toBe(1);
    q.setSource('cpu');
    expect(q.source).toBe('cpu');
  });

  it('counts each reading of the clock once: `last` stays until the next resolve lands', () => {
    // (lane G1's clock resolves one frame at a time: its `last` repeats on the frames between)
    const clock = { available: true, last: null, frame: vi.fn() };
    const q = createQuality({ tier: 'high', pace: fakePace([null]), source: 'gpu', gpuTime: clock });
    clock.last = 30;
    for (let t = 1; t <= 3; t++) q.frame(t * 16);
    // (one reading over budget, seen three times: no panic)
    expect(q.level).toBe(0);
    clock.last = 31;
    q.frame(64);
    clock.last = 30;
    q.frame(80);
    expect(q.level).toBe(1);
  });

  it('takes lane G1’s renderer tier when the runtime has one: T0 budgets 33.3 ms', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]) });
    q.setSource('gpu', { gpuTime: fakeClock([25]), tier: 'T0' });
    for (let t = 1; t <= 40; t++) q.frame(t * 33);
    expect(q.level).toBe(0);
  });

  it('a hold lets the GPU’s frames go by too', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), source: 'gpu', gpuTime: fakeClock([30]) });
    q.hold(100);
    for (let t = 1; t <= 6; t++) expect(q.frame(t * 16)).toBe(null);
    expect(q.level).toBe(0);
  });

  it('a calibrated step does not move the GPU’s controller (the clock measures the chip itself)', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), source: 'gpu', gpuTime: fakeClock([5]) });
    q.setLevel(3);
    expect(q.level).toBe(0);
  });

  it('a budget of 33.3 ms for a visitor who pins 30', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), source: 'gpu', gpuTime: fakeClock([25]), fps: 30 });
    for (let t = 1; t <= 40; t++) q.frame(t * 33);
    expect(q.level).toBe(0);
  });

  it('steps through the same list the world’s headroomAt reads at its drawing buffer: level 1 at 4K on ultra is 0.67 for both', () => {
    expect(stepsAt({ tier: 'ultra', pixels: UHD })).toEqual([0.77, 0.67, 0.5]);
    expect(stepsAt()).toEqual(RESOLUTION_STEPS);
    const q = createQuality({ tier: 'high', detail: 'ultra', pace: fakePace([null]) });
    q.setSource('gpu', { gpuTime: fakeClock([30]), pixels: UHD });
    expect(q.internal).toBe(0.77);
    for (let t = 1; t <= 3; t++) q.frame(t * 16);
    expect(q.level).toBe(1);
    expect(q.internal).toBe(headroomAt(1, { tier: 'ultra', pixels: UHD }).scale);
    expect(q.internal).toBe(0.67);
  });

  it('uses the same steps headroomAt does', () => {
    expect(DYNRES_STEPS).toEqual(RESOLUTION_STEPS);
  });
});

describe('the mip bias following the scale (lane N2)', () => {
  it('sets −0.5 at native under TRAA, log2(scale) − 1 as the controller steps down, 0 on the classic renderer', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]) });
    setMipState({ temporal: true }); // (webgpu.js, building a chain with TRAA)
    q.setSource('gpu', { gpuTime: fakeClock([30]) });
    expect(mipBias()).toBe(-0.5);
    for (let t = 1; t <= 3; t++) q.frame(t * 16);
    expect(mipBias()).toBeCloseTo(Math.log2(0.77) - 1, 6);
    q.setSource('classic');
    expect(mipBias()).toBe(0);
  });

  it('follows the pace’s level through headroomAt on a node world without the GPU clock', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([2]) });
    setMipState({ temporal: false });
    q.setSource('cpu');
    expect(mipBias()).toBe(0);
    q.frame(16);
    expect(mipBias()).toBeCloseTo(Math.log2(0.67) - 1, 6);
    setMipBias(0);
  });
});
