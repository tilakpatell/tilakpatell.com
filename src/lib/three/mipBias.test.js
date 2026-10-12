import { describe, expect, it, vi } from 'vitest';
import { MIP_BIAS, biasFor, mipBias, onMipBias, setMipBias, setMipState } from './mipBias';

describe('biasFor', () => {
  it('is log2(scale) − 1 under an upscaler', () => {
    expect(biasFor(0.5)).toBeCloseTo(-2, 6);
    expect(biasFor(0.77)).toBeCloseTo(Math.log2(0.77) - 1, 6);
    expect(biasFor(0.67, { temporal: true })).toBeCloseTo(Math.log2(0.67) - 1, 6);
  });
  it('is −0.5 at native under TRAA, and 0 at native without it or on the classic renderer', () => {
    expect(biasFor(1, { temporal: true })).toBe(-0.5);
    expect(biasFor(1)).toBe(0);
    expect(biasFor(0.5, { classic: true })).toBe(0);
    expect(MIP_BIAS._source).toMatch(/FSR2/);
  });
  it('stays native under a scale that nothing upscales: the pace’s own step, or the 4K start with no upscale pass', () => {
    expect(biasFor(0.77, { upscaled: false })).toBe(0);
    expect(biasFor(0.77, { upscaled: false, temporal: true })).toBe(-0.5);
    expect(biasFor(0.77, { upscaled: true })).toBeCloseTo(Math.log2(0.77) - 1, 6);
  });
});

describe('setMipBias', () => {
  it('holds one value and tells whoever listens when it changes', () => {
    const fn = vi.fn();
    const off = onMipBias(fn);
    setMipBias(-1.5);
    expect(mipBias()).toBe(-1.5);
    setMipBias(-1.5);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    setMipBias(0);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mipBias()).toBe(0);
  });
  it('takes nothing that is not a number as 0', () => {
    setMipBias(NaN);
    expect(mipBias()).toBe(0);
  });
});

describe('setMipState', () => {
  it('keeps each part from where it was last given', () => {
    setMipState({ scale: 1, temporal: true, classic: false, upscaled: true });
    expect(mipBias()).toBe(-0.5);
    setMipState({ scale: 0.5 });
    expect(mipBias()).toBeCloseTo(-2, 6);
    setMipState({ classic: true });
    expect(mipBias()).toBe(0);
    setMipState({ scale: 1, temporal: false, classic: false, upscaled: false });
    expect(mipBias()).toBe(0);
  });
  it('starts with no upscaler: a scale under 1 biases nothing until a chain with an upscale pass says so', () => {
    setMipState({ scale: 0.77, temporal: true, classic: false, upscaled: false });
    expect(mipBias()).toBe(-0.5);
    setMipState({ upscaled: true });
    expect(mipBias()).toBeCloseTo(Math.log2(0.77) - 1, 6);
    setMipState({ scale: 1, temporal: false, upscaled: false });
    expect(mipBias()).toBe(0);
  });
});
