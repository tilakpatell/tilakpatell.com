// One weather's light, read into the plain numbers this folder draws with.
//
// Two inputs, either or both:
// - the game's VisualEnvironment record, as the bucket's map extras carry it
//   (`web/maps/<level>.extras.json`, `environments[<name>]`: one array per
//   component, `OutdoorLightComponentData`, `SkyComponentData`,
//   `FogComponentData`, `TonemapComponentData`, `ColorCorrectionComponentData`),
//   passed as `entry.record`; its field names are the game's, read from
//   Hoth's three weathers;
// - lane G's derived shape, `siteLightFrom(entry)` in
//   src/lib/three/gameLight.js (the bf2017 levels design): { sky: { zenith,
//   horizon, haze, hazeColor, suns: [{ az, el, color }] }, light: { sun,
//   second, sky, ground, ambient }, fog: { color, density }, exposure, bloom,
//   wind }. It is not on main yet (lane G waits on its calibration), so both
//   are pinned in the test.
// Where the record has a field it wins: the derived shape is made from it.
// Anything missing falls back to a named default, so a world with no
// record still lights.
//
// Units. The record's are physical (the sun in lux, the sky's luminance in
// nits, the lamps in lumens) and the game exposes them by EV. The site's
// are three's, drawn at exposure 1, so one factor takes the game's to the
// site's: 2^ExposureCompensation / (1.2 · 2^EV), the photometric exposure
// at the EV the game settles on (MaxEV where it exposes automatically: a
// bright scene clamps there). Hoth's sunny 128,000 lux becomes 9.2, its
// sunset's 22,500 lux 28 (at EV 10.4: the game opens up at dusk). The
// placed lights take the same factor (`gameToSite`), so a lamp is as bright
// against the sun as the game made it. Where the record has a tone map the
// factor is lane G's calibration (calibrate.js: the meter and GAME_TO_SITE
// of src/lib/three/gameLight.js), so the node stack's Hoth Sunny sun is the
// classic stack's 0.79 and its sky and fill lane G's 0.61; `exposureOf`
// below is the uncalibrated factor, kept for a tone map calibrate.js cannot
// read. `entry.gameToSite` still wins over both.
//
// readEntry(entry, { origin }) → { sun, ambient, sky, fog, shadow, exposure, bloom, ao, grade, gameToSite }
// lerpEntry(a, b, t) → the same shape, a weather crossfade at t in 0…1

import { bloomThreshold, calibrate } from './calibrate.js';

// Earth's sea-level scattering, per metre: the Rayleigh coefficients for
// 680, 550 and 440 nm, and a clear day's Mie (the record's own replace them)
export const RAYLEIGH = [5.8e-6, 13.5e-6, 33.1e-6];
export const MIE = 21e-6;
export const MIE_G = 0.76; // the forward lobe of a hazy sky
export const SUN = { dir: [0.4, 0.75, 0.3], color: [1, 0.96, 0.9], intensity: 3 };
// the sky's luminance against the sun's illuminance where a record gives
// none: Hoth's day, 35,000 nits under 128,000 lux
export const SKY_TO_SUN = 35000 / 128000;
// the sun's disc against the sky beside it where a record gives none:
// Hoth's day, SunScale 120,000 over LuminanceScale 35,000
export const SUN_TO_SKY = 120000 / 35000;
export const AMBIENT = { sky: [0.55, 0.65, 0.8], ground: [0.3, 0.27, 0.24], intensity: 0.6 };
export const FOG = { color: [0.7, 0.75, 0.82], density: 0.0012 };
// GTAO's own defaults: Hoth's records carry no DynamicAO component
export const AO = { radius: 0.25, bias: 0, power: 1 };

const rgb = (c, fallback) => {
  if (Array.isArray(c) && c.length >= 3) return [c[0], c[1], c[2]].map(Number);
  if (c && typeof c === 'object' && 'r' in c) return [c.r, c.g, c.b].map(Number);
  if (c && typeof c === 'object' && 'x' in c) return [c.x, c.y, c.z].map(Number);
  if (typeof c === 'number' && Number.isFinite(c)) return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  if (typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c)) return rgb(parseInt(c.replace('#', ''), 16));
  return fallback.slice();
};
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return v.map((c) => c / l);
};

// a sun's azimuth and elevation (degrees; azimuth from +Z toward +X) as the
// direction toward it
export function sunDir(az, el) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

const comp = (r, name) => r?.[`${name}ComponentData`]?.[0] ?? {};

// the factor from the game's units to the site's, from the record's tone map
export function exposureOf(tone) {
  if (!tone || tone.EV == null) return null;
  const ev = tone.AutomaticExposure && tone.MaxEV != null ? tone.MaxEV : tone.EV;
  return 2 ** (tone.ExposureCompensation ?? 0) / (1.2 * 2 ** ev);
}

export function readEntry(entry = {}, { origin = [0, 0, 0] } = {}) {
  const e = entry ?? {};
  const r = e.record ?? null;
  const outdoor = comp(r, 'OutdoorLight');
  const skyRec = comp(r, 'Sky');
  const fogRec = comp(r, 'Fog');
  const tone = comp(r, 'Tonemap');
  const grade = comp(r, 'ColorCorrection');
  const cal = calibrate(r);
  const k = num(e.gameToSite, cal?.gameToSite ?? exposureOf(tone) ?? 1);
  // the sky's own rate: lane G's SKY_TO_SITE where calibrated, else the sun's
  const skyK = e.gameToSite == null && cal ? cal.sky / Math.max(1e-12, num(skyRec.LuminanceScale, 0)) : k;

  const s0 = e.sky?.suns?.[0];
  const sunLight = e.light?.sun;
  const sun = {
    dir: unit(outdoor.SunRotationX != null ? sunDir(outdoor.SunRotationX, outdoor.SunRotationY ?? 45) : s0 ? sunDir(num(s0.az, 0), num(s0.el, 45)) : SUN.dir),
    color: rgb(outdoor.SunColor ?? sunLight?.color ?? s0?.color, SUN.color),
    intensity: outdoor.SunIntensity != null ? outdoor.SunIntensity * k : num(typeof sunLight === 'number' ? sunLight : sunLight?.intensity, SUN.intensity),
  };
  // (a record's black sky and ground colours mean "from the sky", which the
  // environment gives; the derived shape's or the defaults stand in)
  const lit = (c) => (Array.isArray(c) && c.some((v) => v > 0) ? c : null);
  const lightSky = e.light?.sky;
  const lightGround = e.light?.ground;
  const ambient = {
    sky: rgb(lit(outdoor.SkyColor) ?? lightSky?.color ?? lightSky, AMBIENT.sky),
    ground: rgb(lit(outdoor.GroundColor) ?? lightGround?.color ?? lightGround, AMBIENT.ground),
    // (lane G's fill is the sky's level: calibrated, the record's LuminanceScale at the site's)
    intensity: num(typeof e.light?.ambient === 'number' ? e.light.ambient : e.light?.ambient?.intensity, cal && skyRec.LuminanceScale != null ? skyRec.LuminanceScale * skyK : AMBIENT.intensity),
  };
  const rayleigh = rgb(skyRec.RayleighScatteringCoefficient, RAYLEIGH).map((c) => c * num(skyRec.RayleighScatteringCoefficientScale, 1));
  const sky = {
    rayleigh,
    mie: num(skyRec.MieScatteringCoefficient, MIE),
    mieG: num(skyRec.MieG, MIE_G),
    heightR: num(skyRec.ScaleHeightRayleigh, 8) * 1000, // m (the record's are km)
    heightM: num(skyRec.ScaleHeightMie, 1.2) * 1000,
    luminance: skyRec.LuminanceScale != null ? skyRec.LuminanceScale * skyK : sun.intensity * SKY_TO_SUN,
    sunSize: num(skyRec.SunSize, 0.004), // rad: the disc's angular radius
    // the disc's luminance (the record's SunScale, Hoth's day 120,000 nits)
    sunScale: skyRec.SunScale != null ? skyRec.SunScale * skyK : (skyRec.LuminanceScale != null ? skyRec.LuminanceScale * skyK : sun.intensity * SKY_TO_SUN) * SUN_TO_SKY,
    zenith: rgb(e.sky?.zenith, [0.24, 0.42, 0.78]),
    horizon: rgb(e.sky?.horizon, [0.7, 0.78, 0.88]),
    cloud: rgb(skyRec.CloudLayer1Color ?? e.sky?.hazeColor, [1, 1, 1]),
    cover: num(e.sky?.haze, 0),
    ground: ambient.ground.slice(),
  };
  // The record's fog: a cubic over the distance from Start to End (its
  // `Curve`, x t³ + y t² + z t + w), and below HeightFogAltitude a height
  // fog fading out over HeightFogDepth above it, 95% opaque at
  // HeightFogVisibilityRange. The derived shape has a density only, which
  // is exponential fog.
  const on = fogRec.Enable !== false && Object.keys(fogRec).length > 0;
  const fog = {
    color: rgb(e.fog?.color ?? fogRec.FogColor, FOG.color),
    density: num(e.fog?.density, FOG.density),
    curve: on && Array.isArray(fogRec.Curve) && fogRec.Curve.length === 4 ? fogRec.Curve.map(Number) : null,
    start: on ? num(fogRec.Start, 0) : 0,
    end: on ? num(fogRec.End, 1000) : 1000,
    height:
      on && fogRec.HeightFogEnable
        ? { altitude: num(fogRec.HeightFogAltitude, 0) - origin[1], depth: Math.max(1e-3, num(fogRec.HeightFogDepth, 50)), visibility: Math.max(1, num(fogRec.HeightFogVisibilityRange, 3000)) }
        : null,
  };
  const shadow = {
    mapSize: num(e.shadow?.mapSize, 2048),
    bias: num(e.shadow?.bias, -0.0004),
    normalBias: num(e.shadow?.normalBias, 0.02),
    far: num(e.shadow?.far, null),
  };
  const bloomScale = Array.isArray(tone.BloomScale) ? tone.BloomScale[0] : tone.BloomScale;
  return {
    sun,
    ambient,
    sky,
    fog,
    shadow,
    exposure: num(e.exposure, 1),
    // (the game's BloomScale is the share of the blurred image added back,
    // 0.1 on Hoth's day; the site's bloom strength is its own, so the
    // record's is kept as a ratio to the day's)
    bloom: { scale: bloomScale != null ? bloomScale / 0.1 : num(typeof e.bloom === 'number' ? e.bloom : e.bloom?.scale, 1) },
    ao: { ...AO, ...(e.ao ?? {}) },
    grade: { maxHdr: num(grade.ColorGradingMaxHdrValue, 1), bloomThreshold: bloomThreshold(grade), lutName: grade.HdrColorGradingLut ?? null, lut: e.lut ?? null },
    gameToSite: k,
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const mixArr = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

// Every number eased from a to b; what cannot be blended (a fog curve on one
// side only, the height fog's presence, the LUT) is b's from the start of
// the crossfade, a's before it.
export function lerpEntry(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const walk = (x, y) => {
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v) => typeof v === 'number')) return mixArr(x, y, k);
    if (typeof x === 'number' && typeof y === 'number') return mix(x, y, k);
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !x.isTexture) {
      const out = {};
      for (const key of Object.keys(y)) out[key] = walk(x[key], y[key]);
      return out;
    }
    return k > 0 ? y : x;
  };
  const out = walk(a, b);
  out.sun.dir = unit(out.sun.dir);
  return out;
}
