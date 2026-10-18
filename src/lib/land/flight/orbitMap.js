// A planet's orbit map: a small equirectangular colour map of its ground,
// for the universe's planet to wear, baked from the very ground the flight
// flies over, so the world seen from orbit is the world landed on.
//
// - The layout. sphere.js's (landings/biomes.js's uvOf): texel (i, j) is
//   the direction dirOfUv((i + 0.5) / width, (j + 0.5) / height), u running
//   from −x round toward +z, v 0 at the north pole (the image's top row).
// - The colour. The flight's ground shader's rule (lib/three/groundLook.js,
//   by height and slope, with its accent, rock and wet ground) at the mean of
//   its noises: a texel is hundreds of metres across, so it sees the noise's
//   average and none of its grain. Under the planet's water, the water sheet
//   as expanse/flight/water.js draws it. lib may not import three.js, so the
//   maths is ported: colours read as sRGB, mixed in linear light (as three.js
//   mixes them), written back as sRGB bytes.
// - The kinds of spec. A round planet (generated.js's) reads sphereField's
//   sample at each texel's direction: the same chart, the same four heights
//   SLOPE_STEP m either way and the same biome as the flight's ground there,
//   to the bit. A gas giant, ringed or not, is a cloud deck with no ground to
//   put on a sphere: bands, turned by a noise of the direction. Any other
//   plane (the named worlds, the thirteen seeded Expanse planets) shows a
//   window PLANE_WINDOW m across of the plane it's flown on, laid round the
//   sphere by u and v (a plane doesn't wrap, so its edges meet at u = 0).
// - Alpha is 0 under water and 255 elsewhere, so the planet's shader can
//   tell the sea from the land.
//
// It's never stored, only cached in memory by whoever asks for it.
//
// Pure: runs in Node and in a worker.
//
//   ORBIT_MAP_SIZE[tier] → [width, height]
//   orbitMapSize(tier) → { width, height }   (an unknown tier is mid's)
//   PLANE_WINDOW: metres across u a plane's window shows (half that across v)
//   groundColour(spec, { h, slope }) → { rgb: [r, g, b] sRGB bytes, water: under the water? }
//   bakeOrbitMap(spec, { width = 256, height = 128 }) → { width, height,
//     rgba: Uint8ClampedArray (sRGB; alpha 0 under water), biome: Uint8Array (each texel's heaviest) }

import { seeded } from '../../seeded.js';
import { planetField } from './field.js';
import { fold, noise3For } from './fnl.js';
import { hash64 } from './hash.js';
import { WATER_LOOKS } from './planetTables.js';
import { dirOfUv } from './sphere.js';
import { SLOPE_STEP, sphereField } from './sphereField.js';

export const ORBIT_MAP_SIZE = { low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] };
export const PLANE_WINDOW = 40000;

export function orbitMapSize(tier) {
  const [width, height] = Object.hasOwn(ORBIT_MAP_SIZE, tier) ? ORBIT_MAP_SIZE[tier] : ORBIT_MAP_SIZE.mid;
  return { width, height };
}

// ── colour ──

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// GLSL's smoothstep; with its edges together (GLSL leaves that undefined) a
// step, so a flat palette still gives a finite colour
const smoothstep = (a, b, x) => {
  if (!(b > a)) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// GLSL's mix
const mix = (x, y, a) => x * (1 - a) + y * a;

// the sRGB transfer functions (IEC 61966-2-1), as three.js's colour
// management reads a '#rrggbb' into linear light and the renderer writes it out
const toLinear = (c) => (c < 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c < 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const byteOf = (c) => Math.round(toSrgb(clamp01(c)) * 255);

// a '#rrggbb' (or '#rgb') in linear light; anything else is white, as
// three.js's Color leaves a colour it can't read
const WHITE = [1, 1, 1];
function linear(hex) {
  if (typeof hex !== 'string') return WHITE;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return WHITE;
  const s = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  return [0, 2, 4].map((i) => toLinear(parseInt(s.slice(i, i + 2), 16) / 255));
}

// the palette the flight's ground wears: its ground look's, else the planet's
// own over 0…120 m (expanse/flight/ground.js:38's siteOf)
const paletteOf = (spec) => spec.ground?.palette ?? { ...(spec.palette ?? {}), hLow: 0, hHigh: 120 };

// The rule, made once a spec: (h, slope, out, at) writes the sRGB bytes at
// out[at…at + 2] and says whether the point is under the water. Each step is
// groundLook.js's fragment shader at the mean of its noises (nBig = nMid =
// nFine = 0.5, the noise tile read 0…1), with its uniforms' defaults (:59-68).
function painterOf(spec) {
  const p = paletteOf(spec);
  // :59-63, each colour falling back as its uniform's does
  const low = linear(p.low);
  const high = linear(p.high ?? p.low);
  const accent = linear(p.accent ?? p.high ?? p.low);
  // :173's strata, rockC = rock × (0.78 + 0.4 × 0.5)
  const rock = linear(p.rock ?? p.low).map((c) => c * 0.98);
  // :64
  const hLow = p.hLow ?? 0;
  const hHigh = p.hHigh ?? 30;
  const rockAt = p.rockAt ?? 0.42;
  // :169's patches of the accent, a texel's average of them: half the cover
  // (step(0.001, cover) gates it off when there's none)
  const accentK = (p.accentCover ?? 0) >= 0.001 ? p.accentCover * 0.5 : 0;
  // :67-68 (wet.color, as groundLook reads it); :176's step(−9999, level)
  // turns it off where no level is given
  const wetLevel = p.wet?.level ?? -1e4;
  const wetBand = p.wet?.band ?? 1.5;
  const wetOn = wetLevel >= -9999;
  const wet = linear(p.wet?.color ?? '#000000');

  // the water sheet (expanse/flight/water.js:18-26): its colour, or its
  // kind's, 0.15 of the way to the planet's accent; drawn only for a kind it
  // knows. Lava is opaque and glows: 0.6 of the way to its glow.
  const w = spec.water;
  const look = w ? WATER_LOOKS[w.kind] : null;
  const sea = look && Number.isFinite(w.level) ? w.level : null;
  const tint = linear(spec.palette?.accent ?? p.accent);
  const glow = look?.glow ? linear(look.glow) : null;
  const waterC = linear(w?.colour ?? look?.color).map((c, i) => {
    const t = mix(c, tint[i], 0.15);
    return w?.kind === 'lava' && glow ? mix(t, glow[i], 0.6) : t;
  });
  const lava = w?.kind === 'lava';
  const opacity = look?.opacity ?? 1;

  return (h, slope, out, at) => {
    // :166-167, nBig's offset 0 at its mean: low to high by height
    const k = smoothstep(hLow, hHigh, h);
    let r = mix(low[0], high[0], k);
    let g = mix(low[1], high[1], k);
    let b = mix(low[2], high[2], k);
    // :169, the accent's patches
    r = mix(r, accent[0], accentK);
    g = mix(g, accent[1], accentK);
    b = mix(b, accent[2], accentK);
    // :170's deep in the hollows is smoothstep(0.62, 0.8, nMid) = 0 at the
    // mean: none. :172-174, rock where it's steep (nMid's nudge 0 at its mean)
    const rk = smoothstep(rockAt, rockAt + 0.14, slope);
    r = mix(r, rock[0], rk);
    g = mix(g, rock[1], rk);
    b = mix(b, rock[2], rk);
    // :176, darker toward the water's edge
    if (wetOn) {
      const wk = (1 - smoothstep(wetLevel, wetLevel + wetBand, h)) * 0.75;
      r = mix(r, wet[0], wk);
      g = mix(g, wet[1], wk);
      b = mix(b, wet[2], wk);
    }
    // (:179's grain is × 1 at its mean; the scans, :182-214, and the marks,
    // :216-217, are close up only)
    const under = sea !== null && h < sea;
    if (under) {
      // lava hides the ground; any other water lets it show through
      r = lava ? waterC[0] : mix(r, waterC[0], opacity);
      g = lava ? waterC[1] : mix(g, waterC[1], opacity);
      b = lava ? waterC[2] : mix(b, waterC[2], opacity);
    }
    out[at] = byteOf(r);
    out[at + 1] = byteOf(g);
    out[at + 2] = byteOf(b);
    return under;
  };
}

export function groundColour(spec, { h, slope }) {
  const rgb = [0, 0, 0];
  const water = painterOf(spec)(h, slope, rgb, 0);
  return { rgb, water };
}

// ── the bake ──

const isGiant = (spec) => spec.type === 'gas' || spec.type === 'ringed';
// the bands' count's own draw, apart from anything else the seed makes
const BANDS = fold(hash64('orbit', 'bands'));

// each texel's direction, as (dir, k) with k its index, row by row
function eachDir(width, height, fn) {
  for (let j = 0; j < height; j++) {
    const v = (j + 0.5) / height;
    for (let i = 0; i < width; i++) fn(dirOfUv((i + 0.5) / width, v), j * width + i);
  }
}

// a round planet: the flight's own ground at each texel's direction
function bakeRound(spec, width, height, rgba, biome) {
  const field = sphereField(spec);
  const paint = painterOf(spec);
  eachDir(width, height, (dir, k) => {
    const s = field.sample(dir);
    rgba[k * 4 + 3] = paint(s.h, s.slope, rgba, k * 4) ? 0 : 255;
    biome[k] = s.biome;
  });
}

// a gas giant: B bands from pole to pole (6…11, seeded), bent by a warped
// noise n of the direction, low to high across each; the accent's storms
// where |n| > 0.55. Every texel is cloud: alpha 255, biome 0.
function bakeBands(spec, width, height, rgba) {
  const p = paletteOf(spec);
  const low = linear(p.low);
  const high = linear(p.high ?? p.low);
  const accent = linear(p.accent ?? p.high ?? p.low);
  const noise = noise3For(spec.seed, { frequency: 2.2, octaves: 4, warp: 0.25 });
  const B = 6 + Math.floor(seeded(spec.seed ^ BANDS)() * 6);
  eachDir(width, height, (d, k) => {
    const n = noise(d[0], d[1], d[2]);
    const at = k * 4;
    if (Math.abs(n) > 0.55) {
      rgba[at] = byteOf(accent[0]);
      rgba[at + 1] = byteOf(accent[1]);
      rgba[at + 2] = byteOf(accent[2]);
    } else {
      const t = 0.5 * Math.sin((d[1] * B + 0.6 * n) * Math.PI) + 0.5;
      rgba[at] = byteOf(mix(low[0], high[0], t));
      rgba[at + 1] = byteOf(mix(low[1], high[1], t));
      rgba[at + 2] = byteOf(mix(low[2], high[2], t));
    }
    rgba[at + 3] = 255;
  });
}

// any other plane: a window of it, x = (u − 0.5) × PLANE_WINDOW across u and
// z = (v − 0.5) × PLANE_WINDOW / 2 across v, its slope read SLOPE_STEP m
// either way as sphereField's sample reads a round planet's
function bakeWindow(spec, width, height, rgba, biome) {
  const field = planetField(spec);
  const paint = painterOf(spec);
  const s = SLOPE_STEP;
  for (let j = 0; j < height; j++) {
    const z = ((j + 0.5) / height - 0.5) * (PLANE_WINDOW / 2);
    for (let i = 0; i < width; i++) {
      const x = ((i + 0.5) / width - 0.5) * PLANE_WINDOW;
      const k = j * width + i;
      const gx = (field.heightAt(x + s, z) - field.heightAt(x - s, z)) / (2 * s);
      const gz = (field.heightAt(x, z + s) - field.heightAt(x, z - s)) / (2 * s);
      rgba[k * 4 + 3] = paint(field.heightAt(x, z), 1 - 1 / Math.hypot(1, gx, gz), rgba, k * 4) ? 0 : 255;
      biome[k] = field.biomeAt(x, z);
    }
  }
}

export function bakeOrbitMap(spec, { width = 256, height = 128 } = {}) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const biome = new Uint8Array(width * height);
  if (spec.round) bakeRound(spec, width, height, rgba, biome);
  else if (isGiant(spec)) bakeBands(spec, width, height, rgba);
  else bakeWindow(spec, width, height, rgba, biome);
  return { width, height, rgba, biome };
}
