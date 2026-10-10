import { describe, expect, it } from 'vitest';
import { curve, eventFlare, flareAt, flareElements, lensflareParams } from './flare';
import hoth from './fixtures/hoth.ve.json';
import flares from '../../../data/bf2017/flares.json';

const sun = flareElements(hoth.sunny.record);

describe('flareElements', () => {
  it('Hoth’s day: five elements, their sizes, ray distances and curves, the occluder’s 4,000', () => {
    expect(sun.occluderSize).toBe(4000);
    expect(sun.elements).toHaveLength(5);
    expect(sun.elements[0]).toMatchObject({ size: [2, 2], rayDistance: 0, alphaOccluder: [0.434081852, 0.149560273, -1.58364689, 1], sizeOccluder: [0, 0, -0.5, 1] });
    expect(sun.elements[1]).toMatchObject({ size: [0.5, 0.5], rayDistance: 0.8 });
    expect(sun.elements[3].size).toEqual([2.5, 0.075]);
  });
  it('lighting.json’s flat row (dotted keys) reads the same', () => {
    const raw = {};
    for (const [k, v] of Object.entries(hoth.sunny.record.SunFlareComponentData[0])) {
      if (v && typeof v === 'object') for (const [a, x] of Object.entries(v)) raw[`${k}.${a}`] = x;
      else raw[k] = v;
    }
    const flat = flareElements(raw);
    expect(flat.elements).toHaveLength(5);
    expect(flat.elements[2]).toEqual(sun.elements[2]);
  });
  it('a LensFlareBlueprint: its Elements, its camera-distance curves, its own occluder', () => {
    const ion = flares.flares.FX_LF_IoN_Bomb_Explosion;
    expect(ion.occluderSize).toBe(0.5);
    expect(ion.elements[0].alphaCamDist).toEqual([-12.5712471, 35.4252853, -33.2500763, 10.3956442]);
    expect(ion._source).toMatch(/LensFlareEntityData/);
    expect(Object.keys(flares.flares)).toHaveLength(12);
  });
});

describe('the curves', () => {
  it('a cubic as the fog’s', () => {
    expect(curve([1, 2, 3, 4], 0.5)).toBeCloseTo(0.125 + 0.5 + 1.5 + 4);
  });
  it('the sun’s flare fades by the record’s occluder curve as a ridge covers it: whole when clear, gone when hidden', () => {
    expect(flareAt(sun, { occlusion: 0 }).alpha).toBeCloseTo(1);
    // (the brightest at half: the fifth element's straight fall, 1 − t, over the glare's 0.30)
    expect(flareAt({ ...sun, elements: [sun.elements[0]] }, { occlusion: 0.5 }).alpha).toBeCloseTo(0.434081852 / 8 + 0.149560273 / 4 - 1.58364689 / 2 + 1, 5);
    expect(flareAt(sun, { occlusion: 0.5 }).alpha).toBeCloseTo(0.5);
    expect(flareAt(sun, { occlusion: 1 }).alpha).toBeLessThan(0.001);
    // monotone as the ridge rises
    let last = 2;
    for (let o = 0; o <= 1.0001; o += 0.1) {
      const a = flareAt(sun, { occlusion: o }).alpha;
      expect(a).toBeLessThanOrEqual(last + 1e-9);
      last = a;
    }
  });
  it('the glare halves in size as it is covered; the third element dims toward a quarter off the centre', () => {
    expect(flareAt(sun, { occlusion: 1 }).sizes[0]).toEqual([1, 1]);
    const off = flareAt({ ...sun, elements: [sun.elements[2]] }, { screen: 1 });
    expect(off.alpha).toBeCloseTo(0.25);
  });
  it('an event flare fades with the camera’s distance by its own curve', () => {
    const ion = flares.flares.FX_LF_IoN_Bomb_Explosion;
    const near = flareAt(ion, { camDist: 5 }).alpha;
    const far = flareAt(ion, { camDist: 100 }).alpha;
    expect(near).toBeGreaterThan(far);
  });
});

describe('lensflareParams and eventFlare', () => {
  it('the ghosts: one per element off the sun, at the mean step between their ray distances', () => {
    expect(lensflareParams(sun)).toEqual({ ghostSamples: 2, ghostSpacing: 0.45 });
    expect(lensflareParams({ elements: [] })).toEqual({ ghostSamples: 1, ghostSpacing: 0.25 });
  });
  it('by blueprint name, full or short', () => {
    expect(eventFlare('FX/Gadgets/WalkerAssault_IoNBomb/LensFlare/FX_LF_IoN_Bomb_Explosion', flares)).toBe(flares.flares.FX_LF_IoN_Bomb_Explosion);
    expect(eventFlare('LF_Lightsaber_Blocked', flares).elements).toHaveLength(1);
    expect(eventFlare('nope', flares)).toBe(null);
  });
});
