import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { FILTER_HOOK, PCSS_SAMPLES, earlyOut, filterFor, pcssFilter, penumbraWidth, readPcss, vogelDisk, vsmFallback } from './shadows';
import hoth from './fixtures/hoth.ve.json';

describe('readPcss', () => {
  it('the record’s PCSS numbers', () => {
    expect(readPcss(hoth.sunny)).toEqual({ initial: 8, max: 256, threshold: 0.05, angularRadius: 0.29, penumbraSize: 4, filterScale: 1 });
    // (no record: Hoth's)
    expect(readPcss({}).initial).toBe(8);
    // (a count of 0 would divide by 0 in the kernel: at least 1)
    expect(readPcss({ record: { OutdoorLightComponentData: [{ SunPcssInitialSampleCount: 0, SunPcssMaximumSampleCount: 0 }] } })).toMatchObject({ initial: 1, max: 1 });
  });
});

describe('filterFor', () => {
  it('PCSS with the record’s 256 on ultra and the site’s 32 on high; three’s PCF on mid; none on low', () => {
    const r = readPcss(hoth.sunny);
    expect(filterFor('ultra', r)).toEqual({ kind: 'pcss', initial: 8, max: PCSS_SAMPLES.ultra, threshold: 0.05, angularRadius: 0.29, penumbraSize: 4, filterScale: 1 });
    expect(PCSS_SAMPLES).toEqual({ ultra: 256, high: 32 });
    expect(filterFor('high', r).max).toBe(32);
    expect(filterFor('mid', r)).toEqual({ kind: 'pcf' });
    expect(filterFor('low', r)).toEqual({ kind: 'none' });
    // (the record's maximum caps the site's)
    expect(filterFor('ultra', { ...r, max: 64 }).max).toBe(64);
    // the hook is there on r186 (ShadowNode reads shadow.filterNode); without it, VSM
    expect(FILTER_HOOK).toBe(true);
    expect(filterFor('ultra', r, { hook: false })).toEqual({ kind: 'vsm', samples: 8 });
  });
});

describe('vogelDisk', () => {
  it('three’s layout: n points inside the unit disc, spread round it', () => {
    const pts = Array.from({ length: 32 }, (_, i) => vogelDisk(i, 32, 0));
    for (const [x, y] of pts) expect(Math.hypot(x, y)).toBeLessThanOrEqual(1);
    expect(Math.hypot(...vogelDisk(0, 32, 0))).toBeCloseTo(Math.sqrt(0.5 / 32));
    expect(Math.hypot(...vogelDisk(31, 32, 0))).toBeCloseTo(Math.sqrt(31.5 / 32));
    const mx = pts.reduce((s, p) => s + p[0], 0) / 32;
    const my = pts.reduce((s, p) => s + p[1], 0) / 32;
    expect(Math.hypot(mx, my)).toBeLessThan(0.1);
    // a rotation turns the pattern, not its radii
    expect(Math.hypot(...vogelDisk(5, 32, 1.3))).toBeCloseTo(Math.hypot(...vogelDisk(5, 32, 0)));
  });
});

describe('earlyOut', () => {
  it('after the initial search: none blocked is lit, all blocked is shadow, within the record’s 5 % either way', () => {
    expect(earlyOut(0, 8, 0.05)).toBe('lit');
    expect(earlyOut(8, 8, 0.05)).toBe('shadow');
    expect(earlyOut(4, 8, 0.05)).toBe(null);
    expect(earlyOut(1, 8, 0.05)).toBe(null);
    expect(earlyOut(1, 32, 0.05)).toBe('lit');
    expect(earlyOut(31, 32, 0.05)).toBe('shadow');
  });
});

describe('penumbraWidth', () => {
  it('widens with the distance from the blocker: the sun’s disc times the record’s penumbra size', () => {
    const r = readPcss(hoth.sunny);
    const at1 = penumbraWidth(1, r);
    const at10 = penumbraWidth(10, r);
    expect(at10 / at1).toBeCloseTo(10);
    expect(at1).toBeCloseTo(Math.tan((0.29 * Math.PI) / 180) * 4, 6);
    expect(penumbraWidth(-3, r)).toBe(0);
  });
});

describe('pcssFilter', () => {
  it('a filter function for shadow.filterNode', async () => {
    const fn = await pcssFilter(filterFor('ultra', readPcss(hoth.sunny)));
    expect(typeof fn).toBe('function');
  });
});

describe('vsmFallback', () => {
  it('VSM with the record’s initial count as blur samples', () => {
    const renderer = { shadowMap: { type: THREE.PCFShadowMap } };
    const light = new THREE.DirectionalLight();
    vsmFallback(renderer, light, 8);
    expect(renderer.shadowMap.type).toBe(THREE.VSMShadowMap);
    expect(light.shadow.blurSamples).toBe(8);
  });
});
