import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { FAR_STEPS, FILTER_HOOK, PCSS_SAMPLES, boxUv, createFarCache, depthConvention, earlyOut, farShadowAt, farShadowOf, filterFor, pcssFilter, penumbraWidth, readPcss, vogelDisk, vsmFallback } from './shadows';
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

describe('the far shadow cache (lane N3)', () => {
  // Hoth's level.json shadowCache (lane E0): the box's axes each its full size
  const hoth = { centre: [-20.36, 22.72, 197.52], forward: [0, 0, 1111.48], png: 'shadow/far.png', resolution: 4096, right: [650.64, 0, 0], size: [2048, 2048], tiles: 8, up: [0, 202.43, 0], variant: 'Cloudy_VFX' };
  it('farShadowOf reads the pack’s row (shadowCache), or none', () => {
    expect(farShadowOf({ shadowCache: hoth })).toMatchObject({ png: 'shadow/far.png', size: [2048, 2048] });
    expect(farShadowOf({ farShadow: hoth, shadowCache: null }).png).toBe('shadow/far.png');
    expect(farShadowOf({ shadowCache: null })).toBe(null);
    expect(farShadowOf({ shadowCache: { ...hoth, right: [0, 0, 0] } })).toBe(null);
    expect(farShadowOf(null)).toBe(null);
  });
  it('boxUv: a world point into the box’s map (u along right, v along forward) and its height in the box (0 bottom, 1 top)', () => {
    const c = farShadowOf({ shadowCache: hoth });
    expect(boxUv(c, hoth.centre)).toEqual([0.5, 0.5, 0.5]);
    const corner = boxUv(c, [hoth.centre[0] + 650.64 / 2, hoth.centre[1] + 202.43 / 2, hoth.centre[2] - 1111.48 / 2]);
    expect(corner.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0, 1]);
  });
  it('depthConvention: which end of the 16-bit depth is the top, from where the ground lies', () => {
    const c = farShadowOf({ shadowCache: hoth });
    // the ground (y = 0) sits 0.612 of the box down from its top: a map whose
    // median is 0.612 counts from the top, one whose median is 0.388 from the bottom
    const groundDown = (hoth.centre[1] + 202.43 / 2) / 202.43;
    expect(depthConvention(c, Array(9).fill(groundDown), 0)).toBe('top');
    expect(depthConvention(c, Array(9).fill(1 - groundDown), 0)).toBe('bottom');
  });
  it('farShadowAt: lit with no cache, or where the map is open; shadowed under an occluder along the sun', () => {
    const c = farShadowOf({ shadowCache: hoth });
    const sun = [0, 1, 0];
    // a map all at the ground (y = 0), counted from the top
    const groundDown = (hoth.centre[1] + 202.43 / 2) / 202.43;
    const flat = () => groundDown;
    expect(farShadowAt(null, flat, [0, 0, 200], sun)).toBe(1);
    expect(farShadowAt(c, flat, [0, 0.5, 200], sun, { zero: 'top' })).toBe(1);
    // a 20 m block over the point
    const block = (u, v) => (Math.abs(u - 0.5) < 0.02 && Math.abs(v - 0.5) < 0.02 ? groundDown - 20 / 202.43 : groundDown);
    expect(farShadowAt(c, block, [hoth.centre[0], 0.5, hoth.centre[2]], sun, { zero: 'top' })).toBe(0);
    // outside the box: the record's distant term, lit
    expect(farShadowAt(c, block, [5000, 0, 5000], sun, { zero: 'top' })).toBe(1);
    expect(FAR_STEPS).toBe(8);
  });
});

// a 16-bit grey PNG, filter 0 every row (png16.test.js holds the reader to the rest)
function png16(w, h, values) {
  const raw = Buffer.alloc(h * (w * 2 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.writeUInt16BE(values[y * w + x], y * (w * 2 + 1) + 1 + x * 2);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 16;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

describe('createFarCache', () => {
  const row = { png: 'shadow/far.png', size: [4, 4], centre: [0, 50, 0], right: [100, 0, 0], up: [0, 100, 0], forward: [0, 0, 100] };
  it('the map loaded as a half-float texture, its convention read from it, its node made', async () => {
    // the ground (y = 0) is half the box down from its top: 0.5 in either convention; a map at 0.6 from the top is under it
    const values = Array(16).fill(Math.round(0.55 * 65535));
    const cache = await createFarCache(row, { loadPng: async () => Uint8Array.from(png16(4, 4, values)).buffer, groundY: 0 });
    expect(cache).not.toBe(null);
    expect(cache.zero).toBe('top');
    expect(cache.sample(0.5, 0.5)).toBeCloseTo(0.55, 3);
    expect(cache.node).toBeTruthy();
    cache.dispose();
  });
  it('no row, or a map that does not load or decode: none (the record’s distant term)', async () => {
    expect(await createFarCache(null, { loadPng: async () => new ArrayBuffer(8) })).toBe(null);
    expect(await createFarCache(row, { loadPng: async () => new ArrayBuffer(8) })).toBe(null);
    expect(await createFarCache(row, { loadPng: async () => { throw new Error('404'); } })).toBe(null);
  });
});
