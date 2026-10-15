import { describe, expect, it } from 'vitest';
import { CONTROLS, EVENT, PRESETS, anisotropyOf, hdrWanted, presetValues, read, resolve, samplesFor, textureTier, write } from './video.js';

const fakeStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => Object.fromEntries(m) };
};

describe('the schema', () => {
  it('every control has a default for every preset, among its own values', () => {
    for (const c of CONTROLS) {
      for (const p of PRESETS) {
        expect(c.defaults, c.id).toHaveProperty(p);
        const v = c.defaults[p];
        if (c.kind === 'choice') expect(c.values.map(([x]) => x), `${c.id} ${p}`).toContain(v);
        else expect(v >= c.values.min && v <= c.values.max, `${c.id} ${p}`).toBe(true);
      }
      expect(typeof c.live).toBe('boolean');
      expect(typeof c.cost(c.defaults.ultra)).toBe('number');
    }
  });

  it('the presets draw what the code drew, but high takes TRAA', () => {
    expect(presetValues('high').aa).toBe('traa');
    expect(presetValues('mid').aa).toBe('smaa');
    expect(presetValues('low').aa).toBe('off');
    expect(presetValues('ultra')).toMatchObject({ shadows: 'ultra', shadowDistance: 140, gi: 'high', volumetric: 'high', fogQuality: 'high', godRays: 'on', lensFlare: 'on' });
    expect(presetValues('high')).toMatchObject({ shadows: 'medium', shadowDistance: 30, gi: 'medium', volumetric: 'low', godRays: 'off' });
    expect(presetValues('mid')).toMatchObject({ gi: 'ssao', shadows: 'low', contactShadows: 'off', cloudShadows: 'on', anisotropy: '4' });
    // (Low is the floor since 2026-10-13, the most compressed web settings: no bloom, as BUDGETS.low.bloom on the classic renderer)
    expect(presetValues('low')).toMatchObject({ gi: 'off', shadows: 'off', bloom: 'off', filmGrain: 'off', aberration: 'off', anisotropy: '1' });
    expect(presetValues('mid').bloom).toBe('on');
  });
});

describe('resolve', () => {
  it('an override above the ceiling is held at the ceiling and named', () => {
    const out = resolve({ preset: 'mid', overrides: { gi: 'high' } }, { ceiling: 'mid' });
    expect(out.values.gi).toBe('ssao');
    expect(out.held).toEqual({ gi: 'high' });
  });

  it('an override under the ceiling stands, and marks the picture custom', () => {
    const out = resolve({ preset: 'high', overrides: { gi: 'low' } }, { ceiling: 'ultra' });
    expect(out.values.gi).toBe('low');
    expect(out.custom).toBe(true);
    expect(out.held).toEqual({});
    expect(out.overridden).toEqual({ gi: 'low' });
  });

  it('an override equal to the preset is not custom', () => {
    const out = resolve({ preset: 'high', overrides: { gi: 'medium' } });
    expect(out.custom).toBe(false);
    expect(out.overridden).toEqual({});
  });

  it('no preset reads as high', () => {
    expect(resolve({ preset: null, overrides: {} }).values).toEqual(presetValues('high'));
  });

  it('a value a control does not know is the preset’s', () => {
    expect(resolve({ preset: 'ultra', overrides: { gi: 'blurry', shadowDistance: 9000 } }).values).toMatchObject({ gi: 'high', shadowDistance: 140 });
  });
});

describe('the store', () => {
  it('reads an empty store as no preset and no overrides', () => {
    expect(read(fakeStore())).toEqual({ preset: null, overrides: {} });
  });

  it('reads the preset from tp-quality and the overrides from tp-video; a level given (the address’s pin, Auto’s pick) is the preset instead', () => {
    const s = fakeStore({ 'tp-quality': 'high', 'tp-video': JSON.stringify({ v: 1, gi: 'low' }) });
    expect(read(s)).toEqual({ preset: 'high', overrides: { gi: 'low' } });
    expect(read(s, 'mid').preset).toBe('mid');
    expect(read(s, 'nonsense').preset).toBe('high');
  });

  it('a change of preset drops the overrides; a change of a control keeps the rest', () => {
    const s = fakeStore({ 'tp-quality': 'high', 'tp-video': JSON.stringify({ v: 1, gi: 'low', bloom: 'off' }) });
    write({ gi: 'high' }, s);
    expect(read(s).overrides).toEqual({ gi: 'high', bloom: 'off' });
    write({ preset: 'ultra' }, s);
    expect(read(s)).toEqual({ preset: 'ultra', overrides: {} });
    expect(s.getItem('tp-quality')).toBe('ultra');
  });

  it('writing a control back to its preset value removes the override', () => {
    const s = fakeStore({ 'tp-quality': 'high', 'tp-video': JSON.stringify({ v: 1, gi: 'low' }) });
    write({ gi: 'medium' }, s);
    expect(read(s).overrides).toEqual({});
  });

  it('names its event', () => {
    expect(EVENT).toBe('tp:video');
  });
});

describe('the small readers', () => {
  it('textureTier is the control’s, else the level’s', () => {
    expect(textureTier('high', { textures: 'mid' })).toBe('mid');
    expect(textureTier('high', {})).toBe('high');
    expect(textureTier('low', null)).toBe('low');
  });

  it('samplesFor and anisotropyOf read their fields as numbers', () => {
    expect(samplesFor({ msaa: '4' })).toBe(4);
    expect(samplesFor({})).toBe(null);
    expect(anisotropyOf({ anisotropy: 16 })).toBe(16);
    expect(anisotropyOf(undefined)).toBe(null);
  });
});

describe('HDR output (lane H1)', () => {
  it('is off in every preset, shown on an HDR display only, and wanted when on there', () => {
    const hdr = CONTROLS.find((c) => c.id === 'hdr');
    for (const p of PRESETS) expect(hdr.defaults[p]).toBe('off');
    const high = { matchMedia: () => ({ matches: true }) };
    const low = { matchMedia: () => ({ matches: false }) };
    expect(hdr.shown(high)).toBe(true);
    expect(hdr.shown(low)).toBe(false);
    expect(hdr.shown({})).toBe(false);
    expect(hdrWanted({ hdr: 'on' }, high)).toBe(true);
    expect(hdrWanted({ hdr: 'on' }, low)).toBe(false);
    expect(hdrWanted({ hdr: 'off' }, high)).toBe(false);
  });
});
