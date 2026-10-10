import { describe, expect, it } from 'vitest';
import { BLOOM } from '../bloom';
import { COC, NODE_PASSES, ORDER, SSGI, arrange, dofParams, motionBlurOf, passesFor, raysLight, shed } from './post';
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
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', refs))).toEqual(['render', 'ssgi', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output']);
    expect(kinds(passesFor('high', hoth.sunny, 'webgpu', refs))).toEqual(['render', 'ssgi', 'denoise', 'ao', 'ssr', 'bloom', 'motionBlur', 'lut', 'smaa', 'output']);
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
  it('on the node renderer over WebGL 2: no SSR, SMAA for TRAA, and SSGI denoised in TRAA’s absence', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'nodes-webgl', refs))).toEqual(['render', 'ssgi', 'denoise', 'ao', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'smaa', 'output']);
    expect(kinds(passesFor('high', hoth.sunny, 'nodes-webgl', refs))).toEqual(['render', 'ssgi', 'denoise', 'ao', 'bloom', 'motionBlur', 'lut', 'smaa', 'output']);
  });
  it('no light and no LUT given: ultra goes without god rays and the grade', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', { scene: {}, camera: {} }))).toEqual(['render', 'ssgi', 'ao', 'ssr', 'bloom', 'lensflare', 'motionBlur', 'traa', 'output']);
  });
});

describe('volumes', () => {
  it('on ultra and high after SSR and before the bloom, when a level’s volumetrics are given; never on mid, low or the classic renderer', () => {
    const vols = { pass: () => null };
    const with_ = { ...refs, volumetrics: vols };
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', with_))).toEqual(['render', 'ssgi', 'ao', 'ssr', 'volumes', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output']);
    expect(kinds(passesFor('high', hoth.sunny, 'nodes-webgl', with_))).toEqual(['render', 'ssgi', 'denoise', 'ao', 'volumes', 'bloom', 'motionBlur', 'lut', 'smaa', 'output']);
    expect(passesFor('ultra', hoth.sunny, 'webgpu', with_).find((p) => p.kind === 'volumes').volumetrics).toBe(vols);
    expect(kinds(passesFor('mid', hoth.sunny, 'webgpu', with_))).not.toContain('volumes');
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgl', with_))).not.toContain('volumes');
  });
});

describe('fog with media', () => {
  it('Hoth’s interior and sunset (forward scattering on) take the fog pass on ultra and high after the volumes; its day does not', () => {
    expect(kinds(passesFor('ultra', hoth.interior, 'webgpu', refs))).toEqual(['render', 'ssgi', 'ao', 'ssr', 'fog', 'bloom', 'godrays', 'lensflare', 'lut', 'traa', 'output']);
    expect(kinds(passesFor('high', hoth.sunset, 'nodes-webgl', refs))).toContain('fog');
    expect(kinds(passesFor('mid', hoth.interior, 'webgpu', refs))).not.toContain('fog');
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', refs))).not.toContain('fog');
    const fog = passesFor('high', hoth.interior, 'webgpu', refs).find((p) => p.kind === 'fog');
    expect(fog).toMatchObject({ mode: 'volume', steps: 16 });
    expect(fog.media.forward.presence).toBe(0.714);
    expect(fog.fog.curve).toHaveLength(4);
  });
});

describe('the record’s sun flare and the rays’ light', () => {
  it('Hoth’s day’s lensflare takes its ghosts from the record’s five elements and carries them for the alpha', () => {
    const lf = passesFor('ultra', hoth.sunny, 'webgpu', refs).find((p) => p.kind === 'lensflare');
    expect(lf).toMatchObject({ ghostSamples: 2, ghostSpacing: 0.45 });
    expect(lf.flare.elements).toHaveLength(5);
    expect(lf.sunDir).toHaveLength(3);
    // a weather without the record keeps lane R's ghosts
    expect(passesFor('ultra', hoth.interior, 'webgpu', refs).find((p) => p.kind === 'lensflare')).toEqual({ kind: 'lensflare', threshold: 0.5, ghostSamples: 4, ghostSpacing: 0.25 });
  });
  it('B2: the rays helper when there is one; a plain DirectionalLight sun with its own shadow; never a CSMShadowNode sun', () => {
    const rays = { isDirectionalLight: true };
    expect(raysLight({ rays, light: {} })).toBe(rays);
    const plain = { isDirectionalLight: true, castShadow: true, shadow: {} };
    expect(raysLight({ rays: null, light: plain })).toBe(plain);
    expect(raysLight({ rays: null, light: { ...plain, shadow: { shadowNode: { isCSMShadowNode: true } } } })).toBe(null);
    expect(raysLight({ rays: null, light: { isSunLight: true, castShadow: true } })).toBe(null);
  });
});

describe('motion blur and depth of field as data', () => {
  it('the weather’s record: Hoth’s day on at scale 1; a weather without the component, or with it off, none', () => {
    expect(motionBlurOf(hoth.sunny)).toEqual({ enabled: true, scale: 1 });
    expect(motionBlurOf(hoth.interior)).toEqual({ enabled: false, scale: 0 });
    expect(motionBlurOf({ record: { MotionBlurComponentData: [{ MotionBlurEnable: false, MotionBlurScale: 1 }] } }).enabled).toBe(false);
    // lighting.json's row (MotionBlurEnable not among its numbers)
    expect(motionBlurOf({ motionBlur: { MotionBlurScale: 0.5 } })).toEqual({ enabled: true, scale: 0.5 });
  });
  it('on ultra and high after the flare, before the grade; never on mid or low', () => {
    const ultra = passesFor('ultra', hoth.sunny, 'webgpu', refs);
    expect(ultra.find((p) => p.kind === 'motionBlur')).toMatchObject({ scale: 1, samples: 16 });
    expect(kinds(passesFor('mid', hoth.sunny, 'webgpu', refs))).not.toContain('motionBlur');
    expect(kinds(passesFor('ultra', hoth.interior, 'webgpu', refs))).not.toContain('motionBlur');
  });
  it('depth of field only when a cinematic camera asks: the thin lens’s range round its focus', () => {
    expect(kinds(passesFor('ultra', hoth.sunny, 'webgpu', refs))).not.toContain('dof');
    // the deploy cameras: 35 mm, f/8, focused at 1,000 m (everything sharp); a close-up at 3 m, 50 mm, f/2
    const d = dofParams({ focus: 3, aperture: 2, focalLength: 50, maxblur: 4 });
    expect(d).toEqual({ focusDistance: 3, range: expect.closeTo((2 * COC * 9) / 0.0025, 6), bokehScale: 4 });
    expect(d.range).toBeCloseTo(0.216, 3);
    expect(dofParams({ focus: 0.5, aperture: 1.4, focalLength: 85 }).range).toBe(0.1);
    const cine = passesFor('mid', hoth.sunny, 'webgpu', { ...refs, dof: { focus: 3, aperture: 2, focalLength: 50, maxblur: 4 } });
    expect(kinds(cine)).toEqual(['render', 'ao', 'bloom', 'dof', 'smaa', 'output']);
    expect(cine.find((p) => p.kind === 'dof')).toMatchObject({ focusDistance: 3, bokehScale: 4 });
  });
});

describe('shed', () => {
  it('drops SSGI, then SSR, then god rays and flare, then AO', () => {
    const ultra = passesFor('ultra', hoth.sunny, 'webgpu', refs);
    expect(kinds(shed(ultra, 0))).toEqual(kinds(ultra));
    expect(kinds(shed(ultra, 1))).toEqual(['render', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output']);
    expect(kinds(shed(ultra, 2))).toEqual(['render', 'ao', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'lut', 'traa', 'output']);
    expect(kinds(shed(ultra, 3))).toEqual(['render', 'ao', 'bloom', 'motionBlur', 'lut', 'traa', 'output']);
    expect(kinds(shed(ultra, 4))).toEqual(['render', 'bloom', 'motionBlur', 'lut', 'traa', 'output']);
    // (high's denoise goes with its SSGI)
    expect(kinds(shed(passesFor('high', hoth.sunny, 'webgpu', refs), 1))).not.toContain('denoise');
  });
});
