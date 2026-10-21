// The light at the shore, from the last of the sunset into the night the
// first-years come on: the sun going down behind the hills to the west, the
// sky's colours, the moon up over the castle's right shoulder, the stars
// coming out and the castle's windows brightening as the dark comes on.
// One number, the seconds since the world opened, drives it; it holds at
// night once there. Pure: the colours as sRGB [r, g, b] 0…1, the world
// converts them. (Lane C's day clock takes it over: rules/clock.js.)
//
//   DUSK → { length, ...the two ends }
//   lightAt(t, { reduced }) → { sun, moon, zenith, horizon, hemi, stars, windows, fog, exposure, k }
//   dirOf(el, az) → [x, y, z]: a direction from its height and its bearing

export const DUSK = {
  length: 240, // s from the last of the light to full night
  // (the bearing is from −z, the castle's way, toward +x: the sun sets to
  // the left of the castle, the moon stands to its right)
  dusk: { sunEl: 0.035, sunAz: -0.95, sun: '#ffc896', key: 1.15, zenith: '#1a2446', horizon: '#e89a5a', hemiSky: '#5a6890', hemiGround: '#2e2a22', hemi: 0.6, stars: 0.15, windows: 0.7, fog: '#a88070', density: 0.0009, exposure: 1.2 },
  night: { sunEl: -0.16, sunAz: -1.05, sun: '#9aa8d8', key: 0.42, zenith: '#070b1e', horizon: '#26304e', hemiSky: '#2a3460', hemiGround: '#14141a', hemi: 0.42, stars: 1, windows: 1, fog: '#1c2236', density: 0.0011, exposure: 1.55 },
  moon: { el: 0.3, az: 0.42 },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => a.map((v, i) => mix(v, b[i], k));
const smooth = (x) => x * x * (3 - 2 * x);

export const dirOf = (el, az) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];

export function lightAt(t = 0, { reduced = false } = {}) {
  // (reduced motion: the dark comes on all the same, but held still at its end, no change to watch)
  const k = reduced ? 1 : smooth(Math.min(1, Math.max(0, t / DUSK.length)));
  const a = DUSK.dusk;
  const b = DUSK.night;
  const sunEl = mix(a.sunEl, b.sunEl, k);
  const sunAz = mix(a.sunAz, b.sunAz, k);
  // the key light: the sunset's while the sun is up, the moon's after (it
  // comes from the moon then, so what's lit faces the castle's side)
  const up = Math.min(1, Math.max(0, (sunEl + 0.04) / 0.08));
  const keyDir = up > 0.5 ? dirOf(Math.max(sunEl, 0.02), sunAz) : dirOf(DUSK.moon.el, DUSK.moon.az);
  return {
    k,
    sun: { el: sunEl, az: sunAz, dir: dirOf(sunEl, sunAz), colour: hex(a.sun), up },
    moon: { el: DUSK.moon.el, az: DUSK.moon.az, dir: dirOf(DUSK.moon.el, DUSK.moon.az), light: k },
    key: { dir: keyDir, colour: mix3(hex(a.sun), hex(b.sun), k), intensity: mix(a.key, b.key, k) },
    zenith: mix3(hex(a.zenith), hex(b.zenith), k),
    horizon: mix3(hex(a.horizon), hex(b.horizon), k),
    hemi: { sky: mix3(hex(a.hemiSky), hex(b.hemiSky), k), ground: mix3(hex(a.hemiGround), hex(b.hemiGround), k), intensity: mix(a.hemi, b.hemi, k) },
    stars: mix(a.stars, b.stars, k),
    windows: mix(a.windows, b.windows, k),
    fog: { colour: mix3(hex(a.fog), hex(b.fog), k), density: mix(a.density, b.density, k) },
    exposure: mix(a.exposure, b.exposure, k),
  };
}
