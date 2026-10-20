import { describe, expect, it } from 'vitest';
import { TUNING, barAt, landed, newSkip, skipReadout, skipsFor, stepSkip } from './skip';

const DT = 1 / 60;
// steps the game for `s` seconds without a press
const wait = (g, s, input = {}) => {
  for (let i = 0; i < Math.ceil(s / DT - 1e-6); i++) g = stepSkip(g, input, DT);
  return g;
};

describe('skipping a stone', () => {
  it('swings the bar up to full and back down, over and over', () => {
    expect(barAt(0)).toBe(0);
    expect(barAt(TUNING.swing)).toBeCloseTo(1, 9);
    expect(barAt(TUNING.swing * 1.5)).toBeCloseTo(0.5, 9);
    expect(barAt(TUNING.swing * 2)).toBeCloseTo(0, 9);
    expect(barAt(TUNING.swing * 2.5)).toBeCloseTo(0.5, 9);
  });

  it('skips five or more in the sweet band, fewer under it, and plunks over it', () => {
    const [lo, hi] = TUNING.sweet;
    for (let i = 0; i <= 18; i++) {
      const p = lo + ((hi - lo) * i) / 18;
      expect(skipsFor(p), p.toFixed(3)).toBeGreaterThanOrEqual(TUNING.need);
    }
    expect(skipsFor((lo + hi) / 2)).toBe(7);
    for (let p = 0; p < lo; p += 0.05) expect(skipsFor(p), p.toFixed(2)).toBeLessThan(TUNING.need);
    expect(skipsFor(0)).toBe(0);
    expect(skipsFor(1)).toBeLessThan(2);
    // (more power under the band is never fewer skips)
    for (let p = 0.05; p < lo; p += 0.05) expect(skipsFor(p)).toBeGreaterThanOrEqual(skipsFor(p - 0.05));
  });

  it('picks a stone up on the first press and throws it on the second, with the bar where it was', () => {
    let g = stepSkip(newSkip(), { press: true });
    expect(g.phase).toBe('aim');
    expect(g.events).toEqual([{ type: 'pick' }]);
    g = wait(g, TUNING.swing * 0.8);
    const power = g.power;
    expect(power).toBeGreaterThan(0.7);
    g = stepSkip(g, { press: true }, DT);
    expect(g.phase).toBe('thrown');
    expect(g.events[0].type).toBe('throw');
    expect(g.events[0].n).toBe(skipsFor(g.events[0].power));
    // (another press while it's in the air does nothing)
    expect(stepSkip(g, { press: true }, DT).phase).toBe('thrown');
    g = wait(g, TUNING.flight);
    expect(g.phase).toBe('idle');
    expect(g.best).toBe(g.n);
  });

  it('says when the stone lands, and keeps the best', () => {
    let g = stepSkip(newSkip(), { press: true });
    g = wait(g, TUNING.swing * 0.81);
    g = stepSkip(g, { press: true }, DT);
    let landedAt = null;
    for (let t = 0; t < TUNING.flight + 0.1; t += DT) {
      g = stepSkip(g, {}, DT);
      if (g.events.some((e) => e.type === 'land')) landedAt = g.events.find((e) => e.type === 'land');
    }
    expect(landedAt.n).toBeGreaterThanOrEqual(TUNING.need);
    expect(landed(landedAt.n).done).toBe(true);
    expect(landed(2).done).toBe(false);
    expect(landed(1, { power: 0.97 }).text).toMatch(/Too hard/);
  });

  it('drops the stone if Morty walks off while aiming', () => {
    let g = stepSkip(newSkip(), { press: true });
    g = stepSkip(g, { away: true }, DT);
    expect(g.phase).toBe('idle');
    expect(g.events).toEqual([{ type: 'drop' }]);
  });

  it('shows the bar on the meter only while aiming, red outside the band', () => {
    expect(skipReadout(newSkip()).on).toBe(false);
    let g = stepSkip(newSkip(), { press: true });
    g = wait(g, TUNING.swing * 0.3);
    const r = skipReadout(g);
    expect(r.on).toBe(true);
    expect(r.vitals.low).toBe(true);
    g = wait(g, TUNING.swing * 0.51);
    expect(skipReadout(g).vitals.low).toBe(false);
  });
});
