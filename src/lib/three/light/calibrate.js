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
// luminanceScale(tonemap, { lux, el, sky, room }) → k | null      (the record's TonemapComponentData; the scene the meter sees)
// meteredEV(tonemap, { lux, el, sky, room }) → EV | null
// sunIntensity(outdoor, k), skyScale(sky, k), gameToSite(k), bloomThreshold(grading)
// calibrate(record, { sky, room }) → { k, ev, sun, sky, gameToSite, bloomThreshold } | null   (a VE record's components;
//   `sky`, the luminance the meter sees of the sky where the view sees less of it than the record's:
//   the interiors' share, inside.js's skyShare; `room`, the nits of the room it sees in its place, the
//   game's capture of it, apply.js)

import { BLOOM } from '../bloom.js';
import { exposureOf } from '../gameLight.js';

const ISO_K = 1.2;
const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
const first = (v) => (Array.isArray(v) ? v[0] : v);

// The record's tone map in lane G's shape, so the one meter (gameLight.js)
// decides the EV for both stacks.
// (a tone map without an EV meters from 12, gameLight.js's default; none at all, null)
export function meteredEV(tone, { lux, el, sky, room } = {}) {
  if (!tone) return null;
  const ev = n(tone.EV) ?? 12;
  const comp = n(tone.ExposureCompensation) ?? 0;
  // (a scene with no light to meter keeps the record’s EV, as before)
  const lit = (n(lux) ?? 0) > 0 || (n(sky) ?? 0) > 0 || (n(room) ?? 0) > 0;
  const m = exposureOf({
    sun: { lux: n(lux) ?? 0, el: n(el) ?? 45 },
    sky: { luminance: n(sky) ?? 0 },
    room: { luminance: n(room) ?? 0 },
    // (the record's MinEV/MaxEV clamp the metered EV only where ClampEV is
    // set: Hoth's day meters 16.3 under its 128,000 lux and 35,000 nits, and
    // clamping it to MaxEV 15 blew the snow and the sky to white)
    tonemap: { ev, compensation: comp, minEV: tone.ClampEV === true ? n(tone.MinEV) : lit ? -Infinity : undefined, maxEV: tone.ClampEV === true ? n(tone.MaxEV) : lit ? Infinity : undefined, auto: tone.AutomaticExposure !== false },
  });
  return comp - Math.log2(m);
}

export function luminanceScale(tone, scene = {}) {
  const ev = meteredEV(tone, scene);
  if (ev === null) return null;
  return (2 ** ev * ISO_K) / 2 ** (n(tone.ExposureCompensation) ?? 0);
}

// One exposure for everything, as the game applies it (the owner's bf2-re
// study, findings 02: the lighting passes multiply by g_exposureMultipliers,
// the sky dome by its LuminanceScale at the same exposure): the record's
// lux, nits and candela over k, no fitted constant. Lane G's GAME_TO_SITE
// (0.0713) and SKY_TO_SITE (0.2006) dimmed the sun 11.7× and the sky 4.2×
// to hide the LUT read with linear values (passes.js, fixed); with that
// fixed the physical factor is the picture.
export const gameToSite = (k) => 1 / k;
export const sunIntensity = (outdoor, k) => (n(outdoor?.SunIntensity) ?? 0) * gameToSite(k);
export const skyScale = (sky, k) => (n(sky?.LuminanceScale) ?? 0) / k;
export const bloomThreshold = (grading) => (n(grading?.ColorGradingMaxHdrValue) ?? 1) * BLOOM.threshold;

export function calibrate(record, { sky: seen, room } = {}) {
  const c = (name) => first(record?.[`${name}ComponentData`]) ?? {};
  const tone = c('Tonemap');
  const outdoor = c('OutdoorLight');
  const sky = c('Sky');
  const scene = { lux: outdoor.SunIntensity, el: outdoor.SunRotationY, sky: seen ?? sky.LuminanceScale, room };
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
