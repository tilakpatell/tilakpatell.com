import { describe, expect, it } from 'vitest';
import { GAME_TO_SITE, ONE_EXPOSURE, PROBE_TO_SITE, SKY_TO_SITE, exposureOf, gameSite, hexOf, lutShape, siteLightFrom, sunFromProbe, weatherEntry } from './gameLight';
import hoth from '../../data/bf2017/light/hoth.json';

// Hoth's sunny weather through the two constants: pinned, so a drift in the
// conversion (or a re-run of the script that reads something else) fails here
const HOTH_SUNNY = {
  sky: { zenith: '#85b1ff', horizon: '#b1caff', hazeColor: '#b1caff', suns: [{ az: 4.636, el: 0.575, color: '#fffaf6' }] },
  light: { sun: 0.79, sky: '#90c0ff', ground: '#edf6ff', ambient: 0.61 },
  fog: { color: '#b1caff', density: 0.000294 },
  exposure: 0.000086317,
  probeScale: 0.003392122,
  bloom: 1,
  grading: { brightness: 1, contrast: 1, saturation: 1, lut: 'textures/galaxy/bf2017/light/hoth/sunny.lut.png', lutSize: 33 },
  wind: { dir: 0, strength: 5 },
};

const SIZE = 16;
function cube() {
  const faces = {};
  for (const f of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) faces[f] = new Float32Array(SIZE * SIZE * 3).fill(0.2);
  return faces;
}
function light(faces, face, x, y, v = 50) {
  const i = (y * SIZE + x) * 3;
  faces[face][i] = faces[face][i + 1] = faces[face][i + 2] = v;
}
const deg = (a, b) => (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };

describe('the sun read from a probe', () => {
  it('finds a bright texel straight up', () => {
    const f = cube();
    light(f, 'py', 7, 7); light(f, 'py', 8, 7); light(f, 'py', 7, 8); light(f, 'py', 8, 8);
    expect(deg(sunFromProbe(f, SIZE), [0, 1, 0])).toBeLessThan(2);
  });

  it('finds one off the middle of a side face within 2°', () => {
    const f = cube();
    light(f, 'pz', 12, 3);
    // the texel's centre on +z, in the cube map's own frame: u right, v down
    const u = (2 * 12.5) / SIZE - 1;
    const v = (2 * 3.5) / SIZE - 1;
    expect(deg(sunFromProbe(f, SIZE), unit([u, -v, 1]))).toBeLessThan(2);
  });

  it('reads +x and -z the way three.js samples them', () => {
    const f = cube();
    light(f, 'px', 7, 7); light(f, 'px', 8, 8); light(f, 'px', 7, 8); light(f, 'px', 8, 7);
    expect(deg(sunFromProbe(f, SIZE), [1, 0, 0])).toBeLessThan(2);
    const g = cube();
    light(g, 'nz', 7, 7); light(g, 'nz', 8, 8); light(g, 'nz', 7, 8); light(g, 'nz', 8, 7);
    expect(deg(sunFromProbe(g, SIZE), [0, 0, -1])).toBeLessThan(2);
  });

  it('gives null for a probe with no light in it', () => {
    const f = cube();
    for (const k in f) f[k].fill(0);
    expect(sunFromProbe(f, SIZE)).toBeNull();
  });
});

describe('the weather a world is under', () => {
  const hoth = { weathers: { sunny: { n: 's' }, sunset: { n: 'd' }, cloudy: { n: 'c' }, blizzard: { n: 'b' }, interior: { n: 'i' } } };

  it('maps the four states to the level’s weathers', () => {
    expect(weatherEntry(hoth, 'clear').n).toBe('s');
    expect(weatherEntry(hoth, 'dusk').n).toBe('d');
    expect(weatherEntry(hoth, 'overcast').n).toBe('c');
    expect(weatherEntry(hoth, 'storm').n).toBe('b');
  });

  it('falls back to sunny, and a world with one weather keeps it', () => {
    expect(weatherEntry(hoth, undefined).n).toBe('s');
    expect(weatherEntry(hoth, 'fog').n).toBe('s');
    expect(weatherEntry({ weathers: { night: { n: 'x' } } }, 'storm').n).toBe('x');
    // (a level's own words: Naboo's dusk, Kamino's storm; its main by name; never a room by default)
    expect(weatherEntry({ weathers: { dusk: { n: 'd' } } }, 'dusk').n).toBe('d');
    expect(weatherEntry({ weathers: { stormy: { n: 'k' }, interior: { n: 'i' } } }, 'storm').n).toBe('k');
    expect(weatherEntry({ main: 'overcast', weathers: { interior: { n: 'i' }, overcast: { n: 'o' } } }, 'clear').n).toBe('o');
    expect(weatherEntry({ weathers: { interior: { n: 'i' }, night: { n: 'x' } } }, 'clear').n).toBe('x');
  });

  it('gives null for a world without a record', () => {
    expect(weatherEntry(undefined, 'clear')).toBeNull();
    expect(weatherEntry({ weathers: {} }, 'clear')).toBeNull();
  });
});

describe('the grading LUT’s shape', () => {
  it('reads a strip either way round as its cube', () => {
    expect(lutShape(1024, 32)).toBe(32);
    expect(lutShape(32, 1024)).toBe(32);
    expect(lutShape(256, 16)).toBe(16);
    expect(lutShape(16, 256)).toBe(16);
  });

  it('refuses anything else', () => {
    expect(lutShape(256, 1)).toBeNull();
    expect(lutShape(512, 512)).toBeNull();
    expect(lutShape(1024, 16)).toBeNull();
  });
});

describe('the records to the site’s light', () => {
  it('is nothing without a record', () => {
    expect(siteLightFrom(undefined)).toBeNull();
    expect(siteLightFrom(null)).toBeNull();
  });

  it('holds the constants set on Hoth', () => {
    // (the before and after shots of Hoth's ice field: mean luminance 0.3529
    // under the site's light, 0.3531 under the game's)
    expect(GAME_TO_SITE).toBe(0.0713);
    expect(SKY_TO_SITE).toBe(0.2006);
    expect(PROBE_TO_SITE).toBe(52.4);
  });

  it('takes the sky’s level from the record, the probe only for its colours', () => {
    const sunset = siteLightFrom(hoth.weathers.sunset);
    // (3,000 against noon's 35,000, opened 4.6 stops more: a little brighter than noon's fill)
    expect(sunset.light.ambient).toBeCloseTo(3000 * exposureOf(hoth.weathers.sunset) * SKY_TO_SITE, 2);
    expect(sunset.sky.suns[0].color).toBe('#ff9260');
    // (no sky level: the probe's own radiance, through the fallback)
    const { luminance, ...sky } = hoth.weathers.sunny.sky;
    expect(luminance).toBe(35000);
    const own = siteLightFrom({ ...hoth.weathers.sunny, sky });
    expect(own.probeScale).toBeCloseTo(exposureOf({ ...hoth.weathers.sunny, sky }) * PROBE_TO_SITE, 9);
  });

  it('meters as the game’s camera does: the lit ground, clamped to the record’s range', () => {
    // Hoth sunny: the grey card under 128,000 lux at 33° and a sky of 35,000
    // meters EV 16.3, held at the record's 15, opened 1.5
    expect(Math.log2(exposureOf(hoth.weathers.sunny))).toBeCloseTo(1.5 - 15, 6);
    // the sunset: 22,500 lux, 10° up, a sky of 3,000: EV 12.5, held at 10.4, opened 1
    expect(Math.log2(exposureOf(hoth.weathers.sunset))).toBeCloseTo(1 - 10.4, 6);
    // a storm: a weak sun (1,250 lux) and a sky of 3,000 meter EV 12.2, held
    // at 11, not opened up to the sun alone's 8.3
    expect(Math.log2(exposureOf({ sun: { lux: 1250, el: 33.158 }, sky: { luminance: 3000 }, tonemap: { compensation: 0.5, minEV: 7, maxEV: 11 } }))).toBeCloseTo(0.5 - 11, 6);
    // no auto exposure: the record's EV
    expect(Math.log2(exposureOf({ tonemap: { ev: 12, compensation: 0, auto: false } }))).toBeCloseTo(-12, 6);
  });

  it('gives Hoth’s sunny weather the calibrated numbers', () => {
    expect(siteLightFrom(hoth.weathers.sunny)).toEqual(HOTH_SUNNY);
  });

  it('leaves a black sun’s colour to the site rather than failing', () => {
    const d = siteLightFrom({ sun: { color: [0, 0, 0], lux: 1000, az: 10, el: 20 }, tonemap: { ev: 10 } });
    expect(d.sky.suns[0]).toEqual({ az: 0.175, el: 0.349 });
  });

  it('keeps a hue whole when it is brighter than white', () => {
    expect(hexOf([2, 1, 0])).toBe('#ffbc00');
    expect(hexOf([0.5, 0.5, 0.5])).toBe('#bcbcbc');
  });
});

describe('a site under the game’s light', () => {
  const site = {
    id: 'hoth',
    gameLight: 'hoth',
    sky: { zenith: '#6f98c8', horizon: '#e4ecf4', haze: 0.95, suns: [{ az: 2.4, el: 0.2, color: '#fff4e6', size: 0.014, glow: 1 }], bodies: [{ az: 1, el: 0.2 }] },
    fog: { color: '#e2eaf3', density: 0.0011 },
    light: { sun: 2.6, sky: '#9fbce6', ground: '#e6edf6', ambient: 0.9 },
  };

  it('is the site itself for a world without a record', () => {
    expect(gameSite(site, null, 'clear')).toBe(site);
    expect(gameSite(site, undefined)).toBe(site);
  });

  it('lays the derived sky, light and fog over the site’s, keeping what the record does not say', () => {
    const s = gameSite(site, hoth, 'clear');
    expect(s).not.toBe(site);
    expect(s.sky.zenith).toBe(HOTH_SUNNY.sky.zenith);
    expect(s.sky.suns[0]).toEqual({ ...site.sky.suns[0], ...HOTH_SUNNY.sky.suns[0] });
    expect(s.sky.bodies).toBe(site.sky.bodies);
    expect(s.sky.haze).toBe(0.95);
    expect(s.light.sun).toBe(HOTH_SUNNY.light.sun);
    // (the game's fog is thinner than the site's: the site's density holds)
    expect(s.fog.density).toBe(0.0011);
    expect(s.fog.color).toBe(HOTH_SUNNY.fog.color);
    expect(s.gameLit).toEqual(HOTH_SUNNY);
    // (the site handed in is not changed)
    expect(site.sky.zenith).toBe('#6f98c8');
  });
});

// (one exposure for the sun, the sky and the lamps, calibrate.js's: the
// record's lux and nits over the camera's k, as the node stack lights the
// painted sky and the lamps; where a world draws in its record's picture its
// sun and fill take the same rate, not lane G's fitted one)
describe('the records at one exposure', () => {
  it('gives Hoth’s sunny sun its lux over the camera’s k, the Battlefront world’s 9.21', () => {
    const d = siteLightFrom(hoth.weathers.sunny, ONE_EXPOSURE);
    expect(d.light.sun).toBeCloseTo(9.21, 2);
    // (lane G's rate stands where it is not asked for)
    expect(siteLightFrom(hoth.weathers.sunny).light.sun).toBe(HOTH_SUNNY.light.sun);
    // (the fill and the sky's level by the same rate, a share of the fitted one)
    expect(d.light.ambient / HOTH_SUNNY.light.ambient).toBeCloseTo(1 / (1.2 * SKY_TO_SITE), 1);
  });

  it('a site laid under it takes it', () => {
    const site = { id: 'hoth', gameLight: 'hoth', sky: {}, fog: {}, light: { sun: 2.6 } };
    expect(gameSite(site, hoth, 'clear', ONE_EXPOSURE).light.sun).toBeCloseTo(9.21, 2);
    expect(gameSite(site, hoth, 'clear').light.sun).toBe(HOTH_SUNNY.light.sun);
  });
});
