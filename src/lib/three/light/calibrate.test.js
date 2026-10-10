import { describe, expect, it } from 'vitest';
import { BLOOM } from '../bloom.js';
import { GAME_TO_SITE, SKY_TO_SITE, siteLightFrom, weatherEntry } from '../gameLight.js';
import hothLight from '../../../data/bf2017/light/hoth.json';
import { bloomThreshold, calibrate, gameToSite, luminanceScale, meteredEV, skyScale, sunIntensity } from './calibrate';
import { readEntry } from './entry';
import hoth from './fixtures/hoth.ve.json';

const comp = (e, name) => e.record[`${name}ComponentData`][0];
const classic = siteLightFrom(weatherEntry(hothLight, 'clear'));

describe('luminanceScale', () => {
  it('meters Hoth Sunny as lane G does: the EV clamps at MaxEV 15, opened 1.5 stops', () => {
    const tone = comp(hoth.sunny, 'Tonemap');
    const scene = { lux: 128000, el: 32.943, sky: 35000 };
    expect(meteredEV(tone, scene)).toBe(15);
    expect(luminanceScale(tone, scene)).toBeCloseTo((2 ** 15 * 1.2) / 2 ** 1.5, 6);
  });
  it('a record that exposes by hand keeps its EV; none gives null', () => {
    expect(meteredEV({ EV: 12, ExposureCompensation: 0, AutomaticExposure: false }, {})).toBe(12);
    expect(luminanceScale(null, {})).toBe(null);
    // a tone map without an EV meters from gameLight.js's default 12, never a factor of 1
    expect(meteredEV({}, {})).toBe(12);
  });
});

describe('Hoth Sunny on the node stack and the classic one', () => {
  const k = luminanceScale(comp(hoth.sunny, 'Tonemap'), { lux: 128000, el: 32.943, sky: 35000 });
  it('the same sun as gameLight.js gives the classic stack', () => {
    expect(sunIntensity(comp(hoth.sunny, 'OutdoorLight'), k)).toBeCloseTo(classic.light.sun, 2);
    expect(readEntry(hoth.sunny).sun.intensity).toBeCloseTo(classic.light.sun, 2);
    expect(classic.light.sun).toBe(0.79);
  });
  it('the sky at lane G’s level: the dome’s horizon and the fill', () => {
    expect(skyScale(comp(hoth.sunny, 'Sky'), k)).toBeCloseTo(classic.light.ambient, 2);
    const p = readEntry(hoth.sunny);
    expect(p.sky.luminance).toBeCloseTo(0.61, 2);
    expect(p.ambient.intensity).toBeCloseTo(0.61, 2);
  });
  it('one factor for the lamps: lux to the site’s at the sun’s rate, from GAME_TO_SITE', () => {
    expect(gameToSite(k)).toBeCloseTo(GAME_TO_SITE * 2 ** (1.5 - 15), 12);
    expect(readEntry(hoth.sunny).gameToSite).toBeCloseTo(gameToSite(k), 12);
    expect(skyScale({ LuminanceScale: 1 }, k)).toBeCloseTo(SKY_TO_SITE * 2 ** (1.5 - 15), 12);
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
    expect(c.sun).toBeCloseTo(0.79, 2);
    expect(c.sky).toBeCloseTo(0.61, 2);
    expect(c.bloomThreshold).toBe(1);
    expect(calibrate({})).toBe(null);
    // a sun with no tone map is still taken to the site's units
    expect(calibrate({ OutdoorLightComponentData: [{ SunIntensity: 128000, SunRotationY: 33 }] }).sun).toBeLessThan(10);
    expect(calibrate(null)).toBe(null);
  });
});
