// The game's units to the site's, in one place, for the node stack: the
// same calibration lane G set on the classic stack (src/lib/three/gameLight.js,
// PR #833), so a level lit both ways gives one sun. Pure.
//
// The game's camera settles at an EV (metered on a grey card under the sun
// and the sky, clamped to the record's MinEV…MaxEV, as gameLight.js's
// exposureOf does) and opens up by ExposureCompensation. The luminance that
// fills the sensor at that exposure is the scene's luminance scale,
//
//   k = 2^EV × 1.2 / 2^ExposureCompensation       (1.2: the saturation-based sensor's constant, 78 / (100 · 0.65))
//
// and a record's number over k is its share of white. Lane G fitted its
// constants against 2^(comp − EV), without the 1.2, so the site's value is
// the record's × 1.2 / k × the constant:
//
//   sun    = SunIntensity (lux)       × 1.2 / k × GAME_TO_SITE  (Hoth Sunny: 0.79, the classic stack's)
//   sky    = LuminanceScale (nits)    × 1.2 / k × SKY_TO_SITE   (Hoth Sunny: 0.61, the dome's horizon and the fill)
//   lamps  = their lumens or candela  × gameToSite(k), the sun's rate, so a lamp stands to the sun as the game made it
//   bloom  = ColorGradingMaxHdrValue  × the house's threshold   (the grade covers HDR to that value; above it glows)
//
// luminanceScale(tonemap, { lux, el, sky }) → k | null      (the record's TonemapComponentData; the scene the meter sees)
// meteredEV(tonemap, { lux, el, sky }) → EV | null
// sunIntensity(outdoor, k), skyScale(sky, k), gameToSite(k), bloomThreshold(grading)
// calibrate(record) → { k, ev, sun, sky, gameToSite, bloomThreshold } | null   (a VE record's components)

import { BLOOM } from '../bloom.js';
import { GAME_TO_SITE, SKY_TO_SITE, exposureOf } from '../gameLight.js';

const ISO_K = 1.2;
const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const first = (v) => (Array.isArray(v) ? v[0] : v);

// The record's tone map in lane G's shape, so the one meter (gameLight.js)
// decides the EV for both stacks.
// (a tone map without an EV meters from 12, gameLight.js's default; none at all, null)
export function meteredEV(tone, { lux, el, sky } = {}) {
  if (!tone) return null;
  const ev = n(tone.EV) ?? 12;
  const comp = n(tone.ExposureCompensation) ?? 0;
  const m = exposureOf({
    sun: { lux: n(lux) ?? 0, el: n(el) ?? 45 },
    sky: { luminance: n(sky) ?? 0 },
    tonemap: { ev, compensation: comp, minEV: n(tone.MinEV), maxEV: n(tone.MaxEV), auto: tone.AutomaticExposure !== false },
  });
  return comp - Math.log2(m);
}

export function luminanceScale(tone, scene = {}) {
  const ev = meteredEV(tone, scene);
  if (ev === null) return null;
  return (2 ** ev * ISO_K) / 2 ** (n(tone.ExposureCompensation) ?? 0);
}

export const gameToSite = (k) => (ISO_K / k) * GAME_TO_SITE;
export const sunIntensity = (outdoor, k) => (n(outdoor?.SunIntensity) ?? 0) * gameToSite(k);
export const skyScale = (sky, k) => (n(sky?.LuminanceScale) ?? 0) * (ISO_K / k) * SKY_TO_SITE;
export const bloomThreshold = (grading) => (n(grading?.ColorGradingMaxHdrValue) ?? 1) * BLOOM.threshold;

export function calibrate(record) {
  const c = (name) => first(record?.[`${name}ComponentData`]) ?? {};
  const tone = c('Tonemap');
  const outdoor = c('OutdoorLight');
  const sky = c('Sky');
  const scene = { lux: outdoor.SunIntensity, el: outdoor.SunRotationY, sky: sky.LuminanceScale };
  // (a record with neither a tone map nor a sun has nothing to calibrate)
  if (!record?.TonemapComponentData && n(outdoor.SunIntensity) === undefined) return null;
  const k = luminanceScale(tone, scene);
  return {
    k,
    ev: meteredEV(tone, scene),
    sun: sunIntensity(outdoor, k),
    sky: skyScale(sky, k),
    gameToSite: gameToSite(k),
    bloomThreshold: bloomThreshold(c('ColorCorrection')),
  };
}
