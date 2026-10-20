import { describe, expect, it } from 'vitest';
import { CUE_NAMES, INSTRUMENTS, crackle, createKit, cue, hz, impulse, noise, note, patter, pluck } from './instruments';
import { RANGE } from './score';
import { fakeAudio } from './fixtures/audio';

const RATE = 8000;
const rms = (d, a, b) => {
  let s = 0;
  for (let i = a; i < b; i++) s += d[i] * d[i];
  return Math.sqrt(s / Math.max(1, b - a));
};
const bounded = (d, max = 1) => d.every((v) => Number.isFinite(v) && Math.abs(v) <= max);

describe('the bakers', () => {
  it('plucks a string that is finite, bounded and dies away', () => {
    const { data, tune } = pluck(hz(57), RATE, { seconds: 2 });
    expect(data.length).toBe(2 * RATE);
    expect(bounded(data, 0.9 + 1e-6)).toBe(true);
    expect(rms(data, 0, RATE / 4)).toBeGreaterThan(rms(data, RATE, RATE * 2) * 2);
    // (the whole-sample delay is put right at playback, never far)
    expect(Math.abs(tune - 1)).toBeLessThan(0.05);
    // the same each time
    expect(pluck(hz(57), RATE, { seconds: 0.1 }).data).toEqual(pluck(hz(57), RATE, { seconds: 0.1 }).data);
  });

  it('dies faster up high than down low', () => {
    const decay = (m) => {
      const { data } = pluck(hz(m), RATE, { seconds: 1.5 });
      return rms(data, RATE, RATE * 1.5) / rms(data, 0, RATE / 4);
    };
    expect(decay(84)).toBeLessThan(decay(48));
  });

  it('makes a hall’s tail: stereo, finite, bounded and fading', () => {
    const [l, r] = impulse(RATE, { seconds: 2.5 });
    expect(l.length).toBe(2.5 * RATE);
    expect(r.length).toBe(l.length);
    expect(bounded(l) && bounded(r)).toBe(true);
    expect(l).not.toEqual(r);
    const n = l.length;
    expect(rms(l, n * 0.9, n)).toBeLessThan(rms(l, 0, n * 0.1) * 0.1);
    expect(l[0]).toBe(0);
  });

  it('bakes the fire, the rain and the noise bounded', () => {
    for (const d of [crackle(RATE, 2), patter(RATE, 2), noise(RATE, 1)]) {
      expect(d.length).toBeGreaterThan(0);
      expect(bounded(d)).toBe(true);
      expect(rms(d, 0, d.length)).toBeGreaterThan(0.01);
    }
  });
});

describe('on a context', () => {
  it('plays a note on every instrument, each started and stopped', () => {
    const { ctx, bus } = fakeAudio({ rate: RATE });
    const kit = createKit(ctx);
    for (const inst of INSTRUMENTS) {
      const midi = Math.round((RANGE[inst][0] + RANGE[inst][1]) / 2);
      const v = note(ctx, kit, { inst, t: 1, midi, dur: 0.8, vel: 0.6, grace: true }, bus);
      expect(v.end, inst).toBeGreaterThan(1);
      expect(v.sources.length, inst).toBeGreaterThan(0);
      for (const s of v.sources) expect(s.started && s.stopped, inst).toBe(true);
    }
    // a harp’s pitch is baked once and kept
    note(ctx, kit, { inst: 'harp', t: 2, midi: 60, dur: 1, vel: 0.5 }, bus);
    note(ctx, kit, { inst: 'harp', t: 3, midi: 60, dur: 1, vel: 0.5 }, bus);
    expect(kit.plucked).toBe(2);
  });

  it('plays every one of the book’s sounds', () => {
    const { ctx, bus } = fakeAudio({ rate: RATE });
    const kit = createKit(ctx);
    for (const name of CUE_NAMES) {
      const v = cue(ctx, kit, name, 0.5, bus);
      expect(v.end, name).toBeGreaterThan(0.5);
      for (const s of v.sources) expect(s.started && s.stopped, name).toBe(true);
    }
    expect(cue(ctx, kit, 'nothing', 0, bus)).toBeNull();
  });
});
