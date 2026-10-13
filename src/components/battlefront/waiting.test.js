import { describe, expect, it } from 'vitest';
import { ADAPT_S, DARKROOM_EV, QUIET_S, SHADER_WAIT_S, VARIANTS, WIPE, arrivalExposure, loadLine, pickVariant, readiness, stopsFrom } from './waiting.js';

describe('the rules of the way in', () => {
  it('keeps the game’s numbers: the darkroom’s EV, the wipe’s three delays, the adaptation', () => {
    expect(DARKROOM_EV).toBe(8);
    expect(WIPE.delay + WIPE.down + WIPE.up).toBeCloseTo(0.75);
    expect(ADAPT_S).toBe(0.25);
  });

  it('picks the day by the game’s coin: the sunset 70, the clear day 30', () => {
    expect(VARIANTS.map((v) => v.id)).toEqual(['sunset', 'sunny']);
    expect(pickVariant(() => 0)).toBe('sunset');
    expect(pickVariant(() => 0.69)).toBe('sunset');
    expect(pickVariant(() => 0.7)).toBe('sunny');
    expect(pickVariant(() => 0.999)).toBe('sunny');
    let sunsets = 0;
    for (let i = 0; i < 1000; i++) if (pickVariant(() => i / 1000) === 'sunset') sunsets++;
    expect(sunsets).toBe(700);
  });

  it('fills the bar with the stream, then the shaders, and is ready only once nothing has built for a moment', () => {
    const streaming = readiness({ loaded: false, progress: 0.5 });
    expect(streaming.ready).toBe(false);
    expect(streaming.value).toBeCloseTo(0.425);
    expect(streaming.line).toContain('50 per cent');
    const building = readiness({ loaded: true, progress: 1, pending: 4, held: 2, peak: 12 });
    expect(building.ready).toBe(false);
    expect(building.value).toBeGreaterThan(0.85);
    expect(building.value).toBeLessThan(0.93);
    expect(building.line).toContain('6 to go');
    const chain = readiness({ loaded: true, progress: 1, building: 1, peak: 12 });
    expect(chain.ready).toBe(false);
    const settling = readiness({ loaded: true, progress: 1, quietFor: QUIET_S / 2 });
    expect(settling.ready).toBe(false);
    expect(settling.line).toBe('Settling');
    const ready = readiness({ loaded: true, progress: 1, quietFor: QUIET_S });
    expect(ready).toEqual({ value: 1, ready: true, line: 'Ready' });
  });

  // (the pipeline guard keeps any frame from waiting on a shader: what is
  // still building appears as it lands, so the door no longer waits for it,
  // past the level's arrival and SHADER_WAIT_S; a laptop compiling every
  // pipeline through D3D12 waited minutes, the owner's 2026-10-13 report)
  it('says in one line where the way in spent its time', () => {
    const line = loadLine({ now: 23400, marks: { madeAt: 6100, levelAt: 18200 }, level: { stream: { bytes: 31.04e6 }, maps: { loaded: 412 } }, shaders: { pending: 4, held: 8, building: 0 }, machine: { backend: 'webgpu', tier: 'T0' }, detail: 'low' });
    expect(line).toBe('[battlefront] in at 23.4 s: the world made at 6.1 s, the level in at 18.2 s (31.0 MB, 412 maps), 12 shaders still building; webgpu, T0, low');
    expect(loadLine({ now: 1000, marks: {}, level: {}, shaders: {}, machine: {} })).toBe('[battlefront] in at 1.0 s: the world made at ?, the level in at ? (0.0 MB, 0 maps), 0 shaders still building; ?, ?, ?');
  });

  it('opens SHADER_WAIT_S after the level is in, whatever is still building', () => {
    expect(SHADER_WAIT_S).toBe(5);
    expect(readiness({ loaded: true, progress: 1, pending: 3, held: 40, peak: 60, waited: 4.9 }).ready).toBe(false);
    expect(readiness({ loaded: true, progress: 1, pending: 3, held: 40, peak: 60, waited: SHADER_WAIT_S })).toEqual({ value: 1, ready: true, line: 'Ready' });
    expect(readiness({ loaded: true, progress: 1, building: 1, waited: 6 }).ready).toBe(true);
    // (never before the level itself is in)
    expect(readiness({ loaded: false, progress: 0.9, waited: 60 }).ready).toBe(false);
  });

  it('adapts the exposure from the darkroom’s stops to the day’s over a quarter second', () => {
    expect(stopsFrom(11)).toBe(3);
    expect(stopsFrom(9.5)).toBe(1.5);
    expect(stopsFrom(null)).toBe(0);
    expect(arrivalExposure(0, { stops: 3 })).toBe(8);
    expect(arrivalExposure(ADAPT_S / 2, { stops: 2 })).toBeCloseTo(2);
    expect(arrivalExposure(ADAPT_S, { stops: 3 })).toBe(1);
    expect(arrivalExposure(1, { stops: 3 })).toBe(1);
  });

  it('keeps the rules of the way in and none of the old screen’s lines', async () => {
    const m = await import('./waiting.js');
    for (const gone of ['recommend', 'machineLine', 'recommendationLine', 'COIN']) expect(m[gone]).toBeUndefined();
    for (const kept of ['readiness', 'pickVariant', 'WIPE', 'arrivalExposure', 'stopsFrom']) expect(m[kept]).toBeDefined();
  });
});
