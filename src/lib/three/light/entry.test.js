import { describe, expect, it } from 'vitest';
import { MIE, RAYLEIGH, SUN, lerpEntry, readEntry, sunDir } from './entry';
import hoth from './fixtures/hoth.ve.json';

describe('readEntry', () => {
  it('a world with no record still lights, on the named defaults', () => {
    const p = readEntry(null);
    expect(p.sun.color).toEqual(SUN.color);
    expect(p.sky.rayleigh).toEqual(RAYLEIGH);
    expect(p.sky.mie).toBe(MIE);
    expect(p.exposure).toBe(1);
    expect(Math.hypot(...p.sun.dir)).toBeCloseTo(1);
  });
  it('reads lane G’s derived shape', () => {
    const p = readEntry({
      sky: { zenith: '#3366cc', suns: [{ az: 0, el: 90, color: [1, 0.8, 0.6] }] },
      light: { sun: 5, sky: [0.5, 0.6, 0.7], ground: 0x804020, ambient: 0.4 },
      fog: { color: [0.9, 0.9, 1], density: 0.002 },
      exposure: 1.2,
      bloom: 0.5,
    });
    expect(p.sun.dir[1]).toBeCloseTo(1);
    expect(p.sun.intensity).toBe(5);
    expect(p.sun.color).toEqual([1, 0.8, 0.6]);
    expect(p.ambient.ground[0]).toBeCloseTo(128 / 255);
    expect(p.ambient.intensity).toBe(0.4);
    expect(p.sky.zenith[2]).toBeCloseTo(0.8);
    expect(p.fog.density).toBe(0.002);
    expect(p.exposure).toBe(1.2);
    expect(p.bloom.scale).toBe(0.5);
  });
  it('reads Hoth’s records as the bucket has them: the sun, the sky, the fog, the exposure', () => {
    const p = readEntry({ ...hoth.sunny, light: { sun: 5 } });
    // 128,000 lux metered to EV 16.33 (unclamped: no ClampEV in the record), opened 1.5 stops,
    // at one physical exposure (calibrate.js): 3.67 (the classic stack's 0.79 was lane G's fit)
    expect(p.gameToSite).toBeCloseTo(2 ** 1.5 / (1.2 * 2 ** 16.3287), 9);
    expect(p.sun.intensity).toBeCloseTo(3.666, 2);
    expect(p.sun.color[2]).toBeCloseTo(0.91762);
    expect(p.sun.dir[1]).toBeCloseTo(Math.sin((32.943 * Math.PI) / 180), 4);
    expect(p.sky.rayleigh).toEqual([0.00001, 0.00001, 0.00003]);
    expect(p.sky.mie).toBe(0);
    expect(p.sky.mieG).toBe(0.785);
    expect(p.sky.heightR).toBe(8000);
    expect(p.sky.luminance).toBeCloseTo(35000 * p.gameToSite, 6);
    expect(p.fog.curve).toEqual([2.23109, -4.56547, 2.92437, -0.00879]);
    expect([p.fog.start, p.fog.end]).toEqual([50, 10000]);
    expect(p.fog.height).toEqual({ altitude: 320, depth: 50, visibility: 3000 });
    expect(p.bloom.scale).toBeCloseTo(1);
    expect(p.grade.lutName).toBe('Levels/Lighting/Hoth/Sunny_01/T_CC_Hoth_Sunny_01');
    // (the record's black sky colour means "from the environment": the derived one stands)
    expect(p.ambient.sky).toEqual(readEntry({}).ambient.sky);
  });
  it('the sunset opens up, the interior has its own ambient; the height fog in the pack’s frame', () => {
    // (the dusk’s 22,500 lux at its own metered EV, no ClampEV; lane G’s clamped 2.37 was the classic stack’s)
    expect(readEntry(hoth.sunset).sun.intensity).toBeCloseTo(22500 * readEntry(hoth.sunset).gameToSite, 6);
    expect(readEntry(hoth.sunset).sun.intensity).toBeGreaterThan(readEntry(hoth.sunny).sun.intensity);
    expect(readEntry(hoth.sunset).sun.color[1]).toBeCloseTo(0.28355);
    const inside = readEntry(hoth.interior);
    expect(inside.ambient.sky).toEqual([0.318, 0.341, 0.4]);
    expect(inside.bloom.scale).toBeCloseTo(0.5);
    expect(readEntry(hoth.sunny, { origin: [0, 300, 0] }).fog.height.altitude).toBe(20);
  });
  it('lane G’s factor wins over the exposure, once it is there', () => {
    expect(readEntry({ ...hoth.sunny, gameToSite: 1e-4 }).sun.intensity).toBeCloseTo(12.8);
  });
});

describe('sunDir', () => {
  it('azimuth from +Z toward +X, elevation up', () => {
    expect(sunDir(90, 0)[0]).toBeCloseTo(1);
    expect(sunDir(0, 0)[2]).toBeCloseTo(1);
    expect(sunDir(0, 90)[1]).toBeCloseTo(1);
  });
});

describe('lerpEntry', () => {
  it('eases every number, keeps the sun a unit vector and swaps what cannot blend', () => {
    const a = readEntry({ light: { sun: 2 }, sky: { suns: [{ az: 0, el: 10 }] } });
    const b = readEntry({ light: { sun: 6 }, sky: { suns: [{ az: 90, el: 10 }] }, record: { FogComponentData: [{ Curve: [1, 0, 0, 0], Start: 0, End: 100 }] } });
    expect(lerpEntry(a, b, 0).sun.intensity).toBe(2);
    const mid = lerpEntry(a, b, 0.5);
    expect(mid.sun.intensity).toBe(4);
    expect(Math.hypot(...mid.sun.dir)).toBeCloseTo(1);
    expect(mid.fog.curve).toEqual(b.fog.curve);
    expect(lerpEntry(a, b, 0).fog.curve).toBe(null);
    expect(lerpEntry(a, b, 2).sun.intensity).toBe(6);
  });
});
