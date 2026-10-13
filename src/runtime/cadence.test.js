import { describe, expect, it } from 'vitest';
import { cadenceFor, CADENCE, createCadence, readFps } from './cadence';

const win = (search = '', kept = null) => ({ location: { search }, localStorage: { getItem: (k) => (k === 'tp-fps' ? kept : null) } });

describe('readFps', () => {
  it('reads a pinned 30 from the address, then from what was kept', () => {
    expect(readFps(win('?fps=30'))).toBe(30);
    expect(readFps(win('', '30'))).toBe(30);
    expect(readFps(win('?fps=60', '30'))).toBe(60);
  });
  it('takes nothing else, and no window, as no pin', () => {
    expect(readFps(win('?fps=24'))).toBe(null);
    expect(readFps(win())).toBe(null);
    expect(readFps(undefined)).toBe(null);
    expect(readFps({ location: { search: '' }, get localStorage() { throw new Error('blocked'); } })).toBe(null);
  });
});

describe('cadenceFor', () => {
  // (T0 starts at every beat since 2026-10-13: the owner's 30 to 60, as
  // near 60 as the chip holds; createCadence takes it to 30 when it cannot)
  it('draws every second beat when the visitor pins 30, else every beat, T0 too', () => {
    expect(cadenceFor({ fps: 30 })).toBe(2);
    expect(cadenceFor({ tier: 'T0' })).toBe(1);
    expect(cadenceFor({ tier: 'T0', fps: 60 })).toBe(1);
    expect(cadenceFor({ tier: 'low' })).toBe(1);
    expect(cadenceFor({})).toBe(1);
  });
});

// frames every `interval` ms for `ms`, from `t0`, each with its own work
const run = (c, { t0 = 0, ms, interval, cpuMs = 2, gpuMs = null, floored = false }) => {
  const changes = [];
  for (let t = t0; t < t0 + ms; t += interval) {
    const next = c.frame(t, { interval, cpuMs, gpuMs, floored });
    if (next !== null) changes.push([t, next]);
  }
  return changes;
};

describe('createCadence: 60 where the chip holds it, an even 30 where it cannot', () => {
  it('starts at every beat, and waits out its warm-up', () => {
    const c = createCadence({ warmMs: 3000 });
    expect(c.every).toBe(1);
    expect(run(c, { ms: 2900, interval: 40, gpuMs: 38, floored: true })).toEqual([]);
  });

  it('takes every second beat after 2 s under 50 fps with the resolution at its floor', () => {
    const c = createCadence({ warmMs: 0 });
    const changes = run(c, { ms: 4000, interval: 25, cpuMs: 4, gpuMs: 22, floored: true });
    expect(changes.length).toBe(1);
    expect(changes[0][1]).toBe(2);
    expect(changes[0][0]).toBeGreaterThanOrEqual(CADENCE.dropMs);
    expect(c.every).toBe(2);
  });

  it('leaves a frame bound by the chip to the resolution while it can still come down', () => {
    const c = createCadence({ warmMs: 0 });
    expect(run(c, { ms: 6000, interval: 25, cpuMs: 4, gpuMs: 22, floored: false })).toEqual([]);
  });

  it('takes 30 for a frame bound by the main thread, which no resolution helps', () => {
    const c = createCadence({ warmMs: 0 });
    expect(run(c, { ms: 4000, interval: 25, cpuMs: 24, gpuMs: 5, floored: false }).map((x) => x[1])).toEqual([2]);
  });

  it('comes back to every beat after 3 s of work under 0.8 of the 60 fps budget', () => {
    const c = createCadence({ warmMs: 0 });
    run(c, { ms: 3000, interval: 25, cpuMs: 24, gpuMs: 5 });
    expect(c.every).toBe(2);
    const back = run(c, { t0: 3000, ms: 4000, interval: 33.3, cpuMs: 9, gpuMs: 10 });
    expect(back.map((x) => x[1])).toEqual([1]);
    expect(back[0][0] - 3000).toBeGreaterThanOrEqual(CADENCE.climbMs);
  });

  it('stays at 30 while the work is near the budget (no see-saw)', () => {
    const c = createCadence({ warmMs: 0 });
    run(c, { ms: 3000, interval: 25, cpuMs: 24, gpuMs: 5 });
    expect(run(c, { t0: 3000, ms: 8000, interval: 33.3, cpuMs: 15, gpuMs: 14 })).toEqual([]);
  });

  // (with no GPU clock, WebGL 2 and the classic renderer, the work at 30 is
  // only the main thread's: a frame bound by the chip looked light there,
  // climbed and dropped again every 6 s for as long as it ran)
  it('without a GPU clock, climbs back rarely, and more rarely after each failed climb', () => {
    const c = createCadence({ warmMs: 0 });
    const changes = [];
    for (let t = 0; t < 300000; ) {
      const interval = c.every === 1 ? 25 : 33.3;
      const next = c.frame(t, { interval, cpuMs: 6, gpuMs: null, floored: true });
      if (next !== null) changes.push([t, next]);
      t += interval;
    }
    expect(changes[0][1]).toBe(2);
    expect(changes.length).toBeLessThanOrEqual(8); // (stays of 30, 60 and 120 s, three probes of 60 between)
    // (each stay at 30 longer than the one before)
    const stays = [];
    for (let i = 0; i + 1 < changes.length; i += 2) stays.push(changes[i + 1][0] - changes[i][0]);
    for (let i = 1; i < stays.length; i++) expect(stays[i]).toBeGreaterThan(stays[i - 1] * 1.5);
    expect(stays[0]).toBeGreaterThanOrEqual(CADENCE.blindClimbMs);
  });

  it('with a clock, a climb that fails doubles the next wait', () => {
    const c = createCadence({ warmMs: 0 });
    run(c, { ms: 3000, interval: 25, cpuMs: 24, gpuMs: 5 });
    const up = run(c, { t0: 3000, ms: 5000, interval: 33.3, cpuMs: 9, gpuMs: 10 });
    expect(up.map((x) => x[1])).toEqual([1]);
    // (60 does not hold: down again within moments)
    const down = run(c, { t0: up[0][0], ms: 4000, interval: 25, cpuMs: 24, gpuMs: 5 });
    expect(down.map((x) => x[1])).toEqual([2]);
    const again = run(c, { t0: down[0][0], ms: 20000, interval: 33.3, cpuMs: 9, gpuMs: 10 });
    expect(again[0][0] - down[0][0]).toBeGreaterThanOrEqual(2 * CADENCE.climbMs);
  });

  // (on a 120 or 144 Hz screen every second beat is 60 or 72: the drop goes
  // to an even 60 first, then an even 30, by the display's own beat)
  it('on a 120 Hz screen steps a 40 fps frame down to an even 60, then an even 30', () => {
    const c = createCadence({ warmMs: 0 });
    const changes = [];
    for (let t = 0; t < 20000; t += 25) {
      const next = c.frame(t, { interval: 25, cpuMs: 4, gpuMs: 22, floored: true, beatMs: 1000 / 120 });
      if (next !== null) changes.push(next);
    }
    expect(changes).toEqual([2, 4]);
  });

  it('on a 144 Hz screen settles at every fifth beat, near 30', () => {
    const c = createCadence({ warmMs: 0 });
    const changes = [];
    for (let t = 0; t < 20000; t += 25) {
      const next = c.frame(t, { interval: 25, cpuMs: 4, gpuMs: 22, floored: true, beatMs: 1000 / 144 });
      if (next !== null) changes.push(next);
    }
    expect(changes.at(-1)).toBe(5);
  });

  it('on a 120 Hz screen leaves a frame that keeps every beat alone', () => {
    const c = createCadence({ warmMs: 0 });
    expect(run(c, { ms: 8000, interval: 8.3, cpuMs: 4, gpuMs: 5, floored: true })).toEqual([]);
  });

  it('lets a hitch go by', () => {
    const c = createCadence({ warmMs: 0 });
    const changes = [];
    for (let t = 0; t < 6000; t += 16.7) {
      const hitch = Math.round(t) % 1000 < 17;
      const next = c.frame(t, { interval: hitch ? 200 : 16.7, cpuMs: hitch ? 150 : 6, gpuMs: 8, floored: true });
      if (next !== null) changes.push(next);
    }
    expect(changes).toEqual([]);
  });

  it('holds a pin of 30 or 60 whatever the frames', () => {
    const thirty = createCadence({ fps: 30, warmMs: 0 });
    expect(thirty.every).toBe(2);
    expect(run(thirty, { ms: 6000, interval: 33.3, cpuMs: 2, gpuMs: 2 })).toEqual([]);
    const sixty = createCadence({ fps: 60, warmMs: 0 });
    expect(run(sixty, { ms: 6000, interval: 40, cpuMs: 38, gpuMs: 2, floored: true })).toEqual([]);
    expect(sixty.every).toBe(1);
  });

  it('holds a pinned 60 at 60 on a fast display, and a pinned 30 at 30', () => {
    const at = (hz, fps) => {
      const c = createCadence({ fps, warmMs: 0 });
      c.frame(0, { interval: 1000 / hz, beatMs: 1000 / hz });
      return c.every;
    };
    expect(at(120, 60)).toBe(2);
    expect(at(240, 60)).toBe(4);
    expect(at(60, 60)).toBe(1);
    expect(at(120, 30)).toBe(4);
    expect(at(144, 30)).toBe(5);
  });
});
