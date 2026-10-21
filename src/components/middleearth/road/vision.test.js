import { describe, expect, it } from 'vitest';
import { newVision, stepVision } from './vision';
import { chainFor } from './hooks';

const run = (v, seconds, on, dt = 1 / 60) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) v = stepVision(v, dt, { on });
  return v;
};

describe('the Ring vision', () => {
  it('comes on within 0.4 s and goes off as fast', () => {
    const on = run(newVision(), 0.4, true);
    expect(on.amount).toBeGreaterThanOrEqual(0.9);
    const off = run(on, 0.4, false);
    expect(off.amount).toBeLessThanOrEqual(0.1);
    expect(run(newVision(), 3, true).amount).toBe(1);
    expect(run(newVision(), 3, false).amount).toBe(0);
  });

  it('pulses at half a hertz within ±1, and its wind turns slowly', () => {
    let v = newVision();
    let lo = 0;
    let hi = 0;
    const start = v.wind;
    for (let i = 0; i < 240; i++) {
      v = stepVision(v, 1 / 60, { on: true });
      lo = Math.min(lo, v.pulse);
      hi = Math.max(hi, v.pulse);
      expect(Math.abs(v.pulse)).toBeLessThanOrEqual(1);
    }
    expect(hi).toBeGreaterThan(0.95);
    expect(lo).toBeLessThan(-0.95);
    expect(Math.abs(v.wind - start)).toBeGreaterThan(0);
    expect(Math.abs(v.wind - start)).toBeLessThan(2);
  });

  it('a gentler rate takes longer', () => {
    expect(run(newVision(), 0.4, true, 1 / 60).amount).toBeGreaterThan(stepVision(newVision(), 0.4, { on: true, rate: 1 }).amount);
  });
});

describe('the chain by tier and backend', () => {
  const kinds = (passes) => passes.map((p) => p.kind);

  it('low is the render, the bloom and the output', () => {
    expect(kinds(chainFor('low', 'webgpu'))).toEqual(['render', 'bloom', 'output']);
  });

  it('mid adds SMAA', () => {
    expect(kinds(chainFor('mid', 'webgpu'))).toEqual(['render', 'bloom', 'smaa', 'output']);
  });

  it('high is AO, the bloom, the grade and SMAA, the same on WebGPU as on WebGL 2', () => {
    const grade = () => null;
    expect(kinds(chainFor('high', 'webgpu', { grade }))).toEqual(['render', 'ao', 'bloom', 'grade', 'smaa', 'output']);
    expect(kinds(chainFor('high', 'nodes-webgl', { grade }))).toEqual(['render', 'ao', 'bloom', 'grade', 'smaa', 'output']);
  });

  it('draws no tier temporally: the wind’s grass and the still hills both shimmered under TRAA', () => {
    for (const tier of ['low', 'mid', 'high', 'ultra']) for (const backend of ['webgpu', 'nodes-webgl']) expect(kinds(chainFor(tier, backend, { grade: () => null }))).not.toContain('traa');
  });

  it('ultra adds the depth of field, and god rays only with a sun that casts shadows', () => {
    expect(kinds(chainFor('ultra', 'webgpu'))).toContain('dof');
    expect(kinds(chainFor('ultra', 'webgpu'))).not.toContain('godrays');
    expect(kinds(chainFor('ultra', 'webgpu', { sun: { castShadow: true } }))).toContain('godrays');
  });

  it('the render pass carries the scene and camera, the grade the node it was given', () => {
    const scene = {};
    const camera = {};
    const grade = () => null;
    const passes = chainFor('high', 'webgpu', { scene, camera, grade });
    expect(passes[0]).toMatchObject({ kind: 'render', scene, camera });
    expect(passes.find((p) => p.kind === 'grade').node).toBe(grade);
    // (no grade given: no grade pass)
    expect(kinds(chainFor('high', 'webgpu', { grade: null }))).not.toContain('grade');
  });
});
