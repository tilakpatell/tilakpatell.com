import { describe, expect, it } from 'vitest';
import { FIT_KEY, MIN_SCORE, readTry, starWarsFit } from './fit';

const angle = (vendor, name) => `ANGLE (${vendor}, ${name} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
const hw = (renderer) => ({ webgl: true, webgl2: true, renderer, software: false, ok: true });
const laptop = { why: [], memory: 16 };

// The Star Wars worlds' floor (the every-chip-plays addendum): a GPU that
// holds 30 fps at Low, the most compressed web settings, is lib/gpuGrade's
// score 10 by the worked model; two cores or 2 GB are a potato however good the chip
describe('whether this device can play the Star Wars worlds', () => {
  it('lets in the owner’s 740M, the 5090, Iris Xe, a UHD 620, Skylake’s HD 520 and any chip its name does not grade', () => {
    for (const r of [angle('AMD', 'AMD Radeon(TM) 740M Graphics'), angle('NVIDIA', 'NVIDIA GeForce RTX 5090'), angle('Intel', 'Intel(R) Iris(R) Xe Graphics'), angle('Intel', 'Intel(R) UHD Graphics 620'), angle('Intel', 'Intel(R) HD Graphics 520'), angle('AMD', 'AMD Radeon(TM) Graphics'), 'Apple GPU']) {
      expect(starWarsFit({ gpu: hw(r), device: laptop }), r).toEqual({ ok: true, why: null });
    }
    expect(MIN_SCORE).toBe(10);
  });

  it('turns away no GPU, software WebGL, an old Intel HD, two cores and 2 GB', () => {
    expect(starWarsFit({ gpu: { webgl: false, webgl2: false, renderer: '', software: false }, device: laptop, webgpu: false })).toEqual({ ok: false, why: 'none' });
    expect(starWarsFit({ gpu: { ...hw('Google SwiftShader'), software: true }, device: laptop })).toEqual({ ok: false, why: 'software' });
    expect(starWarsFit({ gpu: hw(angle('Intel', 'Intel(R) HD Graphics 4600')), device: laptop })).toEqual({ ok: false, why: 'weak' });
    expect(starWarsFit({ gpu: hw(angle('Intel', 'Intel(R) HD Graphics 5500')), device: laptop })).toEqual({ ok: false, why: 'weak' });
    expect(starWarsFit({ gpu: hw(angle('AMD', 'AMD Radeon(TM) 740M Graphics')), device: { why: ['cores'], memory: 8 } })).toEqual({ ok: false, why: 'cpu' });
    expect(starWarsFit({ gpu: hw(angle('AMD', 'AMD Radeon(TM) 740M Graphics')), device: { why: ['memory'], memory: 2 } })).toEqual({ ok: false, why: 'memory' });
  });

  it('takes WebGPU alone as a GPU where WebGL 2 is missing', () => {
    expect(starWarsFit({ gpu: { webgl: true, webgl2: false, renderer: '', software: false }, device: laptop, webgpu: true }).ok).toBe(true);
  });

  it('lets anything in when asked to try anyway (?software=on, or kept as tp-software)', () => {
    expect(FIT_KEY).toBe('tp-software');
    expect(starWarsFit({ gpu: { ...hw('Google SwiftShader'), software: true }, device: laptop, tryAnyway: true })).toEqual({ ok: true, why: null });
    expect(readTry('?software=on', '', null)).toBe(true);
    expect(readTry('', '#/battlefront/hoth?software=on', null)).toBe(true);
    expect(readTry('', '', 'on')).toBe(true);
    expect(readTry('', '', null)).toBe(false);
    expect(readTry('?software=off', '', 'on')).toBe(false);
  });
});
