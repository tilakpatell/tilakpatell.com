// The village’s light by the hour (the design’s §4.13, for a set that has
// its own sky): a Highland day low and cold, the sun never far up, a short
// warm dusk, and a long blue night with the moon over the Shack’s hill and
// every shop window lit. The shops light their windows from late afternoon
// and the lamps a little after; snow brightens the ground light a touch.
// Pure: colours as sRGB [r, g, b] 0…1, the set converts them.
//
//   skyAt(hour, { snow }) → { day, dusk, night, sun: { dir }, moon: { dir }, key: { dir, colour, intensity },
//     hemi: { sky, ground, intensity }, zenith, horizon, glow, fog: { colour, density }, stars, windows,
//     lamps, smoke, exposure }

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => a.map((v, i) => mix(v, b[i], k));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};
// (a direction from its height and its bearing from −z toward +x)
const dirOf = (el, az) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];

// the three looks the hours move between
const DAY = { zenith: '#5d7ea8', horizon: '#c9d3dc', glow: '#e9e2d4', key: '#fff1dc', keyI: 2.2, hemiSky: '#b4c4d8', hemiGround: '#6a6258', hemiI: 1.25, fog: '#b7c2cc', density: 0.0045, exposure: 1.05 };
const DUSK = { zenith: '#2a3260', horizon: '#c98a6a', glow: '#f0965a', key: '#ffb07a', keyI: 1.3, hemiSky: '#7c7aa0', hemiGround: '#40342c', hemiI: 0.95, fog: '#6c6478', density: 0.0055, exposure: 1.25 };
const NIGHT = { zenith: '#060a1c', horizon: '#1d2642', glow: '#28304e', key: '#9eb0e0', keyI: 0.75, hemiSky: '#3a4672', hemiGround: '#171820', hemiI: 0.85, fog: '#1b2236', density: 0.006, exposure: 1.55 };

export function skyAt(hour = 21, { snow = 0 } = {}) {
  const h = ((hour % 24) + 24) % 24;
  // the sun’s height through a Highland day: up at 8, highest (and not high) at 13, down by 18
  const el = 0.5 * Math.cos(((h - 13) / 24) * Math.PI * 2) - 0.12;
  const day = smooth(-0.02, 0.22, el);
  // (dusk: the sun near the horizon, either end of the day)
  const dusk = clamp(1 - Math.abs(el - 0.02) / 0.16) * (el > -0.2 ? 1 : 0);
  const night = 1 - smooth(-0.16, 0.02, el);
  // (+x east, +z south: east at 8, south at 13, west at 18)
  const sun = dirOf(el, Math.PI + ((h - 13) * Math.PI) / 10);
  // (the moon high in the south-east, moving a little through the night)
  const moon = dirOf(0.48, 2.3 + ((h < 12 ? h + 24 : h) - 21) * 0.06);
  // the look: night to day through dusk
  const base = (k) => ({ ...Object.fromEntries(Object.keys(DAY).map((key) => [key, typeof DAY[key] === 'string' ? mix3(hex(NIGHT[key]), hex(DAY[key]), k) : mix(NIGHT[key], DAY[key], k)])) });
  const look = base(day);
  const tint = (key, k) => (typeof DUSK[key] === 'string' ? mix3(look[key], hex(DUSK[key]), k) : mix(look[key], DUSK[key], k));
  const d = dusk * 0.85;
  const out = Object.fromEntries(Object.keys(DAY).map((key) => [key, tint(key, d)]));
  // the key light: the sun by day, the moon by night
  const keyDir = unit(day > 0.05 || dusk > 0.3 ? [sun[0], Math.max(0.08, sun[1]), sun[2]] : moon);
  const snowLift = 1 + clamp(snow) * 0.18;
  return {
    hour: h,
    day,
    dusk,
    night,
    sun: { dir: sun },
    moon: { dir: moon },
    key: { dir: keyDir, colour: out.key, intensity: out.keyI },
    hemi: { sky: out.hemiSky, ground: mix3(out.hemiGround, [0.82, 0.84, 0.9], clamp(snow) * 0.35), intensity: out.hemiI * snowLift },
    zenith: out.zenith,
    horizon: out.horizon,
    glow: out.glow,
    fog: { colour: out.fog, density: out.density },
    stars: smooth(0.4, 0.95, night),
    // the shops light up as the light goes, the lamps a little after
    windows: clamp(1 - day * 0.85 + dusk * 0.3),
    lamps: smooth(0.25, 0.75, night + dusk * 0.4),
    // (the smoke moonlit at night, so it shows against the sky)
    smoke: mix3(hex('#5a6480'), hex('#c4c8cc'), day),
    exposure: out.exposure,
  };
}
