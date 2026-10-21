// The light at the shore, from the last of the sunset into the night the
// first-years come on: the sun just gone behind the hills to the west, its
// glow low in the sky there and fading, the sky deepening from a dusky
// blue to night, the moon up over the castle's right shoulder, the stars
// coming out and the castle's windows brightening as the dark comes on.
// One number, the seconds since the world opened, drives it; it holds at
// night once there. Pure: the colours as sRGB [r, g, b] 0…1, the world
// converts them. (Lane C's day clock takes it over: rules/clock.js.)
//
//   DUSK → { length, ...the two ends }
//   lightAt(t, { reduced }) → { k, sun, moon, key, zenith, horizon, glow, hemi, stars, windows, fog, exposure }
//     horizon: the sky's colour low all round; glow: the sunset's, low where the sun went down
//   dirOf(el, az) → [x, y, z]: a direction from its height and its bearing

export const DUSK = {
  length: 240, // s from the last of the light to full night
  // (the bearing is from −z, the castle's way, toward +x: the sun has set
  // to the left of the castle, the moon stands to its right)
  dusk: { sunEl: -0.015, sunAz: -0.95, glow: '#e8945a', key: 1.6, keyColour: '#ffc89a', zenith: '#1a2446', horizon: '#5e5a72', hemiSky: '#6a7898', hemiGround: '#3a342a', hemi: 1.5, stars: 0.25, windows: 0.75, fog: '#4e5064', density: 0.0006, exposure: 1.25 },
  night: { sunEl: -0.16, sunAz: -1.05, glow: '#2a2440', key: 0.8, keyColour: '#9aa8d8', zenith: '#070b1e', horizon: '#1e2640', hemiSky: '#34406a', hemiGround: '#16161c', hemi: 0.95, stars: 1, windows: 1, fog: '#1a2034', density: 0.0007, exposure: 1.6 },
  moon: { el: 0.3, az: 0.42 },
  // the sunset's light on the ground comes from its bright sky, higher than the sun itself
  skyLight: 0.2,
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => a.map((v, i) => mix(v, b[i], k));
const smooth = (x) => x * x * (3 - 2 * x);
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};

export const dirOf = (el, az) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];

export function lightAt(t = 0, { reduced = false } = {}) {
  // (reduced motion: the dark comes on all the same, but held still at its end, no change to watch)
  const k = reduced ? 1 : smooth(Math.min(1, Math.max(0, t / DUSK.length)));
  const a = DUSK.dusk;
  const b = DUSK.night;
  const sunEl = mix(a.sunEl, b.sunEl, k);
  const sunAz = mix(a.sunAz, b.sunAz, k);
  const moon = dirOf(DUSK.moon.el, DUSK.moon.az);
  // the key light: the sunset sky's at first, turning to the moon's as it goes
  const key = unit(mix3(dirOf(DUSK.skyLight, sunAz), moon, k));
  return {
    k,
    sun: { el: sunEl, az: sunAz, dir: dirOf(sunEl, sunAz) },
    moon: { el: DUSK.moon.el, az: DUSK.moon.az, dir: moon, light: k },
    key: { dir: key, colour: mix3(hex(a.keyColour), hex(b.keyColour), k), intensity: mix(a.key, b.key, k) },
    zenith: mix3(hex(a.zenith), hex(b.zenith), k),
    horizon: mix3(hex(a.horizon), hex(b.horizon), k),
    glow: mix3(hex(a.glow), hex(b.glow), k),
    hemi: { sky: mix3(hex(a.hemiSky), hex(b.hemiSky), k), ground: mix3(hex(a.hemiGround), hex(b.hemiGround), k), intensity: mix(a.hemi, b.hemi, k) },
    stars: mix(a.stars, b.stars, k),
    windows: mix(a.windows, b.windows, k),
    fog: { colour: mix3(hex(a.fog), hex(b.fog), k), density: mix(a.density, b.density, k) },
    exposure: mix(a.exposure, b.exposure, k),
  };
}
