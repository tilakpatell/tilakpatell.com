import { describe, expect, it } from 'vitest';
import { BLOOM } from '../bloom.js';
import { siteLightFrom, weatherEntry } from '../gameLight.js';
import hothLight from '../../../data/bf2017/light/hoth.json';
import { bloomThreshold, calibrate, frameNits, gameToSite, luminanceScale, meteredEV, skyScale, sunIntensity } from './calibrate';
import { readEntry } from './entry';
import hoth from './fixtures/hoth.ve.json';

const comp = (e, name) => e.record[`${name}ComponentData`][0];
const classic = siteLightFrom(weatherEntry(hothLight, 'clear'));

describe('luminanceScale', () => {
  it('meters Hoth Sunny at its clamp (ClampEV, MaxEV 15 in the record): the meter says 16.33, the record 15, opened 1.5 stops', () => {
    const tone = comp(hoth.sunny, 'Tonemap');
    const scene = { lux: 128000, el: 32.943, sky: 35000 };
    expect(meteredEV(tone, scene)).toBe(15);
    expect(meteredEV({ ...tone, ClampEV: undefined }, scene)).toBeCloseTo(16.3287, 3);
    expect(luminanceScale(tone, scene)).toBeCloseTo((2 ** meteredEV(tone, scene) * 1.2) / 2 ** 1.5, 3);
  });
  it('meters a room under the rock by the nits of the game’s capture of it, in the interior’s clamp', () => {
    const tone = { EV: 10, ExposureCompensation: 1.5, ClampEV: true, MinEV: 8.5, MaxEV: 10.5, AutomaticExposure: true };
    // (the sun put out, no sky: the meter pinned at MinEV 8.5, the PR's reading before)
    expect(meteredEV(tone, { lux: 0.001, el: 33, sky: 0 })).toBeCloseTo(8.5, 6);
    // (the west hangar's capture, 151 nits at its horizon: EV 10.24, inside the interior's 8.5…10.5)
    expect(meteredEV(tone, { lux: 0.001, el: 33, sky: 0, room: 151 })).toBeCloseTo(Math.log2(151 * 8), 2);
    // (the command block's long room, 367: clamped at MaxEV 10.5)
    expect(meteredEV(tone, { lux: 0.001, el: 33, sky: 0, room: 367 })).toBeCloseTo(10.5, 6);
  });

  it('reads the frame’s meter back to the game’s nits: the log luminances’ mean, over the exposure it was drawn at', () => {
    // (two texels at 0.25 and 1 in the site's units: their log mean 0.5; drawn at gameToSite 0.0025, 200 nits)
    const px = new Float32Array([Math.log2(0.25), 0, 0, 1, Math.log2(1), 0, 0, 1]);
    expect(frameNits(px, 0.0025)).toBeCloseTo(200, 6);
    expect(frameNits(new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1]), 0.5)).toBeCloseTo(2, 6);
    expect(frameNits(new Float32Array(0), 1)).toBe(null);
    expect(frameNits(px, 0)).toBe(null);
  });

  it('a record that exposes by hand keeps its EV; none gives null', () => {
    expect(meteredEV({ EV: 12, ExposureCompensation: 0, AutomaticExposure: false }, {})).toBe(12);
    expect(luminanceScale(null, {})).toBe(null);
    // a tone map without an EV meters from gameLight.js's default 12, never a factor of 1
    expect(meteredEV({}, {})).toBe(12);
  });
});

describe('Hoth Sunny at one physical exposure (the owner’s bf2-re study, findings 02)', () => {
  const k = luminanceScale(comp(hoth.sunny, 'Tonemap'), { lux: 128000, el: 32.943, sky: 35000 });
  it('the meter is clamped only where the record sets ClampEV: Hoth’s day at MaxEV 15, the meter’s own 16.33 without it', () => {
    expect(meteredEV(comp(hoth.sunny, 'Tonemap'), { lux: 128000, el: 32.943, sky: 35000 })).toBe(15);
    expect(meteredEV({ ...comp(hoth.sunny, 'Tonemap'), ClampEV: undefined }, { lux: 128000, el: 32.943, sky: 35000 })).toBeCloseTo(16.3287, 3);
  });
  it('the sun is its lux over k, no fitted constant: 9.21 on Hoth’s day at the clamp (the classic stack’s 0.79 was lane G’s fit)', () => {
    expect(sunIntensity(comp(hoth.sunny, 'OutdoorLight'), k)).toBeCloseTo(128000 / k, 6);
    expect(readEntry(hoth.sunny).sun.intensity).toBeCloseTo(9.207, 2);
    expect(classic.light.sun).toBe(0.79);
  });
  it('the sky is its nits over the same k: 2.52, the dome’s level and the fill', () => {
    expect(skyScale(comp(hoth.sunny, 'Sky'), k)).toBeCloseTo(35000 / k, 6);
    const p = readEntry(hoth.sunny);
    expect(p.sky.luminance).toBeCloseTo(2.5176, 3);
    expect(p.ambient.intensity).toBeCloseTo(2.5176, 3);
    // the game’s ratio: 128,000 lux to 35,000 nits
    expect(p.sun.intensity / p.sky.luminance).toBeCloseTo(128000 / 35000, 6);
  });
  it('one factor for the lamps: 1 / k, the sun’s rate', () => {
    expect(gameToSite(k)).toBeCloseTo(1 / k, 12);
    expect(readEntry(hoth.sunny).gameToSite).toBeCloseTo(gameToSite(k), 12);
    expect(skyScale({ LuminanceScale: 1 }, k)).toBeCloseTo(1 / k, 12);
  });
  it('bloom from ColorGradingMaxHdrValue: Hoth’s 1 is the house’s threshold', () => {
    expect(bloomThreshold(comp(hoth.sunny, 'ColorCorrection'))).toBe(BLOOM.threshold);
    expect(bloomThreshold({ ColorGradingMaxHdrValue: 4 })).toBe(4 * BLOOM.threshold);
    expect(bloomThreshold(null)).toBe(BLOOM.threshold);
  });
});

describe('calibrate', () => {
  it('a record in, the four numbers out; no tone map, null', () => {
    const c = calibrate(hoth.sunny.record);
    expect(c.sun).toBeCloseTo(9.207, 2);
    expect(c.sky).toBeCloseTo(2.5176, 3);
    expect(c.bloomThreshold).toBe(1);
    expect(calibrate({})).toBe(null);
    // a sun with no tone map is still taken to the site's units
    expect(calibrate({ OutdoorLightComponentData: [{ SunIntensity: 128000, SunRotationY: 33 }] }).sun).toBeLessThan(10);
    expect(calibrate(null)).toBe(null);
  });
});
