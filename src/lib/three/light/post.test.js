import { describe, expect, it } from 'vitest';
import { BLOOM } from '../bloom';
import { NODE_PASSES, ORDER, SSGI, arrange, passesFor, shed } from './post';
import hoth from './fixtures/hoth.ve.json';

const kinds = (ps) => ps.map((p) => p.kind);
const refs = { scene: {}, camera: {}, light: { isDirectionalLight: true }, lut: { isData3DTexture: true, image: { width: 32 } } };

describe('the order', () => {
  it('a chain given out of order is put in it', () => {
    const out = arrange([{ kind: 'output' }, { kind: 'bloom' }, { kind: 'traa' }, { kind: 'render' }, { kind: 'ao' }]);
    expect(kinds(out)).toEqual(['render', 'ao', 'bloom', 'traa', 'output']);
    for (const k of kinds(out)) expect(ORDER).toContain(k);
  });
  it('ssgi without traa gains denoise and the non-temporal preset; with traa it is temporal', () => {
    const plain = arrange([{ kind: 'render' }, { kind: 'ssgi', preset: 'high', temporal: true }, { kind: 'smaa' }]);
    expect(kinds(plain)).toEqual(['render', 'ssgi', 'denoise', 'smaa']);
    expect(plain[1]).toMatchObject({ temporal: false, ...SSGI.plain.high });
    const temporal = arrange([{ kind: 'render' }, { kind: 'traa' }, { kind: 'ssgi', preset: 'high', temporal: false }]);
    expect(kinds(temporal)).toEqual(['render', 'ssgi', 'traa']);
    expect(temporal[1]).toMatchObject({ temporal: true, ...SSGI.temporal.high });
  });
  it('traa beats smaa; no bloom, no flare; no light, no god rays; no LUT, no grade', () => {
    expect(kinds(arrange([{ kind: 'render' }, { kind: 'smaa' }, { kind: 'traa' }]))).toEqual(['render', 'traa']);
    expect(kinds(arrange([{ kind: 'render' }, { kind: 'lensflare' }]))).toEqual(['render']);
    expect(kinds(arrange([{ kind: 'render' }, { kind: 'godrays', light: null }, { kind: 'lut', texture: null }]))).toEqual(['render']);
  });
  it('does not touch the chain it was given', () => {
    const ssgi = { kind: 'ssgi', preset: 'high', temporal: true };
    arrange([{ kind: 'render' }, ssgi]);
    expect(ssgi.temporal).toBe(true);
  });
});

describe('passesFor', () => {
  it('the tiers’ chains, as the design gives them', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', refs))).toEqual(['render', 'ssgi', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'lut', 'traa', 'output']);
    expect(kinds(passesFor('high', hoth.sunny, 'webgpu', refs))).toEqual(['render', 'ssgi', 'denoise', 'ao', 'ssr', 'bloom', 'lut', 'smaa', 'output']);
    expect(kinds(passesFor('mid', hoth.sunny, 'webgpu', refs))).toEqual(['render', 'ao', 'bloom', 'smaa', 'output']);
    expect(kinds(passesFor('low', hoth.sunny, 'webgpu', refs))).toEqual(['render', 'bloom', 'output']);
  });
  it('ultra’s SSGI is the high temporal preset; the passes carry the record’s numbers', () => {
    const ultra = passesFor('ultra', hoth.sunny, 'webgpu', refs);
    expect(ultra.find((p) => p.kind === 'ssgi')).toMatchObject({ temporal: true, slices: 3, steps: 16 });
    expect(ultra.find((p) => p.kind === 'bloom').strength).toBeCloseTo(BLOOM.strength);
    expect(passesFor('ultra', hoth.interior, 'webgpu', refs).find((p) => p.kind === 'bloom').strength).toBeCloseTo(BLOOM.strength / 2);
    expect(ultra.find((p) => p.kind === 'render').camera).toBe(refs.camera);
  });
  it('a backend that cannot build a pass drops it: the classic renderer keeps render, bloom, output', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgl', refs))).toEqual(['render', 'bloom', 'output']);
    for (const k of NODE_PASSES) expect(kinds(passesFor('ultra', hoth.sunny, 'webgl', refs))).not.toContain(k);
  });
  it('on the node renderer over WebGL 2: no SSR, no SSGI (lane S’s shot), and SMAA for TRAA', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'nodes-webgl', refs))).toEqual(['render', 'ao', 'bloom', 'godrays', 'lensflare', 'lut', 'smaa', 'output']);
    expect(kinds(passesFor('high', hoth.sunny, 'nodes-webgl', refs))).toEqual(['render', 'ao', 'bloom', 'lut', 'smaa', 'output']);
  });
  it('no light and no LUT given: ultra goes without god rays and the grade', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', { scene: {}, camera: {} }))).toEqual(['render', 'ssgi', 'ao', 'ssr', 'bloom', 'lensflare', 'traa', 'output']);
  });
});

describe('shed', () => {
  it('drops SSGI, then SSR, then god rays and flare, then AO', () => {
    const ultra = passesFor('ultra', hoth.sunny, 'webgpu', refs);
    expect(kinds(shed(ultra, 0))).toEqual(kinds(ultra));
    expect(kinds(shed(ultra, 1))).toEqual(['render', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'lut', 'traa', 'output']);
    expect(kinds(shed(ultra, 2))).toEqual(['render', 'ao', 'bloom', 'godrays', 'lensflare', 'lut', 'traa', 'output']);
    expect(kinds(shed(ultra, 3))).toEqual(['render', 'ao', 'bloom', 'lut', 'traa', 'output']);
    expect(kinds(shed(ultra, 4))).toEqual(['render', 'bloom', 'lut', 'traa', 'output']);
    // (high's denoise goes with its SSGI)
    expect(kinds(shed(passesFor('high', hoth.sunny, 'webgpu', refs), 1))).not.toContain('denoise');
  });
});
