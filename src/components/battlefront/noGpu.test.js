import { describe, expect, it } from 'vitest';
import { NO_GPU, isNoGpu, noGpuRatio } from './noGpu.js';

describe('isNoGpu', () => {
  it('is the low tier on a software rasteriser, and nothing else', () => {
    expect(isNoGpu({ tier: 'low', why: ['software'] })).toBe(true);
    expect(isNoGpu({ tier: 'low', why: ['software', 'cores'] })).toBe(true);
    // (a weak phone or a small machine has a chip: the low tier as it is)
    expect(isNoGpu({ tier: 'low', why: ['memory'] })).toBe(false);
    expect(isNoGpu({ tier: 'low', why: [] })).toBe(false);
  });
  it('leaves a level the visitor picked above low as asked', () => {
    expect(isNoGpu({ tier: 'mid', why: ['software'] })).toBe(false);
    expect(isNoGpu({ tier: 'high', why: ['software'] })).toBe(false);
  });
  it('takes nothing for no', () => {
    expect(isNoGpu()).toBe(false);
    expect(isNoGpu({ tier: 'low', why: null })).toBe(false);
  });
});

describe('noGpuRatio', () => {
  const pixels = (w, h) => Math.round(w * noGpuRatio(w, h)) * Math.round(h * noGpuRatio(w, h));
  it('draws 640 × 360 whatever the window', () => {
    expect(noGpuRatio(1280, 720)).toBeCloseTo(0.5);
    expect(pixels(1280, 720)).toBe(NO_GPU.pixels);
    expect(noGpuRatio(1920, 1080)).toBeCloseTo(1 / 3);
    expect(pixels(1920, 1080)).toBe(NO_GPU.pixels);
  });
  it('is never sharper than the window, nor under a quarter of it a side', () => {
    expect(noGpuRatio(480, 270)).toBe(1);
    expect(noGpuRatio(5120, 1440)).toBe(NO_GPU.minRatio);
    expect(noGpuRatio(0, 0)).toBe(1);
  });
});
