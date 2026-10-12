import { describe, expect, it } from 'vitest';
import { ADAPT_S, DARKROOM_EV, QUIET_S, VARIANTS, WIPE, arrivalExposure, machineLine, pickVariant, readiness, recommend, recommendationLine, stopsFrom } from './waiting.js';

describe('the waiting screen’s rules', () => {
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

  it('adapts the exposure from the darkroom’s stops to the day’s over a quarter second', () => {
    expect(stopsFrom(11)).toBe(3);
    expect(stopsFrom(9.5)).toBe(1.5);
    expect(stopsFrom(null)).toBe(0);
    expect(arrivalExposure(0, { stops: 3 })).toBe(8);
    expect(arrivalExposure(ADAPT_S / 2, { stops: 2 })).toBeCloseTo(2);
    expect(arrivalExposure(ADAPT_S, { stops: 3 })).toBe(1);
    expect(arrivalExposure(1, { stops: 3 })).toBe(1);
  });

  it('recommends the sharpest step whose predicted frame fits, from the chip’s time at the scale it was measured', () => {
    // the owner's desk: 9.2 ms measured at 0.77 on ultra (the 2026-10-12 shader-guard note)
    const desk = recommend({ level: 'ultra', gpuMs: 9.2, scale: 0.77, steps: [0.77, 0.67, 0.5] });
    expect(desk).toMatchObject({ level: 'ultra', scale: 0.77 });
    expect(desk.ms).toBeCloseTo(9.2);
    // a chip with room at the sharpest step goes a level up
    expect(recommend({ level: 'high', gpuMs: 5, scale: 1 })).toMatchObject({ level: 'ultra', scale: 1 });
    // one over the budget at every step goes a level down at the softest
    expect(recommend({ level: 'ultra', gpuMs: 70, scale: 1 })).toMatchObject({ level: 'high', scale: 0.5 });
    // one that fits only under the screen stays at its level there
    expect(recommend({ level: 'ultra', gpuMs: 20, scale: 1 })).toMatchObject({ level: 'ultra', scale: 0.77 });
    expect(recommend({ level: 'ultra', gpuMs: null })).toMatchObject({ level: 'ultra', measuring: true });
    expect(recommendationLine(recommend({ level: 'ultra', gpuMs: null }))).toContain('measuring');
    expect(recommendationLine(desk)).toBe('recommended: ultra at 77 % · 9.2 ms a frame on the chip');
  });

  it('names the machine in one line, the chip’s name cleaned of the driver’s suffixes', () => {
    const line = machineLine({ detail: 'ultra', tier: 'T2', renderer: 'NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11', width: 2560, height: 720, dpr: 2, backend: 'webgpu' });
    expect(line).toBe('your machine: ultra tier (T2), NVIDIA GeForce RTX 5090, 5,120 × 1,440 on WebGPU');
    expect(machineLine({})).toBe('your machine: high tier, an unnamed chip, an unknown size');
  });
});
