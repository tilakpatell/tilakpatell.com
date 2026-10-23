// The music room's planet, for Indian classical music: a gas giant of its
// own, made from nothing but code (it was Jupiter recoloured, and read as
// Jupiter: its Great Red Spot and all). Its bands are a Banarasi silk's,
// saffron, marigold, vermilion, maroon and cream down to deep indigo at the
// poles, with fine gold threads woven along the pale zones, the zari. Where
// two bands meet the flow breaks into waves, each edge in a whole number of
// them round the planet, as a string vibrates in its harmonics. Paisleys
// turn in the belts, storms shaped as the boteh is, a teardrop with its tip
// curled over by its own spin, ringed inside in maroon and gold and inked
// round their edge; a string of small pale storms runs along the south like
// a mala's beads. At each pole the bands give way to a lotus, eight petals
// standing still as a wave stands on a drum's skin.
//
// Makes music at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm).
// PREVIEW=<folder> bakes at 2048 and writes a PNG there instead.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { clamp, eachTexel, fbm, hex, mix3, perlin, save, smooth, bakeSize } from './sphere.mjs';

const PREVIEW = process.env.PREVIEW ?? null;
const [W, H] = PREVIEW ? [2048, 1024] : bakeSize();
const deg = Math.PI / 180;

// The bands, south pole to north (s, the band coordinate: 0 at the south
// pole, 1 at the north, by the sine of the latitude), each from its edge up
const BANDS = [
  [0, '#1a1452'],
  [0.07, '#2c1b6c'],
  [0.11, '#5c1838'],
  [0.15, '#a1232a'],
  [0.2, '#dc4c1c'],
  [0.245, '#f28c26'],
  [0.29, '#fdc24c'],
  [0.335, '#fae2a8'],
  [0.385, '#e8a03a'],
  [0.43, '#c4521e'],
  [0.465, '#7c1b2e'],
  [0.5, '#f4b23e'],
  [0.535, '#ffdb8e'],
  [0.575, '#e46c20'],
  [0.615, '#a62636'],
  [0.66, '#f7a63c'],
  [0.705, '#fde7b2'],
  [0.755, '#e6882a'],
  [0.8, '#b63c26'],
  [0.845, '#6c1842'],
  [0.895, '#3b1d70'],
  [0.94, '#21165a'],
].map(([s, c]) => [s, hex(c)]);
// each edge's waves: how many round the planet (a harmonic of the slowest)
const HARMONICS = [6, 12, 9, 18, 8, 24, 12, 16, 10, 20, 12, 18, 8, 24, 9, 16, 12, 20, 6, 12, 8];
// the zari: gold threads along the pale zones (their s)
const ZARI = [0.33, 0.345, 0.53, 0.545, 0.7, 0.715];
// the paisleys: [lat, lon, size (radians across), which way it turns]
const PAISLEYS = [
  [-22, 40, 0.36, 1],
  [19, 205, 0.27, -1],
  [33, 300, 0.16, 1],
  [-36, 150, 0.18, -1],
  [6, 112, 0.13, 1],
  [-8, 262, 0.2, -1],
];
// the mala: small pale storms in a row along the south
const BEADS = Array.from({ length: 11 }, (_, k) => [-43, 15 + k * 31, 0.05, k % 2 ? 1 : -1]);

const GOLD = hex('#ffe39a');
const INK = hex('#2e0b1c');
const MAROON = hex('#7a1a2e');
const SAFFRON = hex('#f39a2e');
const CREAM = hex('#fbe8bc');
const INDIGO = hex('#1c1554');
const VIOLET = hex('#4a2a8c');

// the colour at a band coordinate, sharp at each edge, as a woven band is
function bandAt(s) {
  let i = 0;
  while (i < BANDS.length - 1 && s >= BANDS[i + 1][0]) i++;
  const [s0, c0] = BANDS[i];
  const next = BANDS[i + 1];
  if (!next) return c0;
  // (a narrow blend at the edge, wider toward the poles' own soft bands)
  const t = smooth(next[0] - 0.006, next[0] + 0.002, s);
  return mix3(mix3(c0, next[1], smooth(s0, next[0], s) * 0.25), next[1], t);
}
// how near s is an edge, its index, and the signed distance
function edgeNear(s) {
  let best = 0;
  let d = Infinity;
  for (let k = 1; k < BANDS.length; k++) {
    const dk = s - BANDS[k][0];
    if (Math.abs(dk) < Math.abs(d)) {
      d = dk;
      best = k;
    }
  }
  return { k: best, d };
}

export async function bake() {
  console.log('the music planet: weaving its bands');
  const nA = perlin(301);
  const nB = perlin(302);
  const nC = perlin(303);
  const nD = perlin(304);
  const out = new Float32Array(W * H * 3);
  const storms = [...PAISLEYS, ...BEADS].map(([la, lo, size, dir], i) => ({ lat: la * deg, lon: lo * deg, size, dir, bead: i >= PAISLEYS.length }));

  eachTexel(W, H, (x, y, z, i, lat, lon) => {
    // the flow: east-west streaks (the noise stretched along the latitude),
    // eddies, and the waves at each edge
    const s0 = (Math.sin(lat) + 1) / 2;
    const edge = edgeNear(s0);
    const streak = fbm(nA, x * 2.5, y * 34, z * 2.5, { octaves: 5 });
    const eddy = fbm(nB, x * 9 + streak, y * 22, z * 9 - streak, { octaves: 4 });
    // (along an edge the flow tears into curls: a warp there, twice over)
    const torn = Math.exp(-((edge.d / 0.016) ** 2));
    const curl = fbm(nD, x * 16 + eddy * 2, y * 26, z * 16 - eddy * 2, { octaves: 4 });
    // (and small eddies everywhere, for the close look)
    const fine = fbm(nC, x * 44 + curl, y * 90, z * 44 - curl, { octaves: 4 });
    let sLat = lat + streak * 0.014 + eddy * 0.007 + curl * 0.02 * torn + fine * 0.0028;
    // the storms: each turns the bands round it, and is drawn over them
    let body = null;
    for (const st of storms) {
      let dl = lon - st.lon;
      if (dl > Math.PI) dl -= Math.PI * 2;
      if (dl < -Math.PI) dl += Math.PI * 2;
      const du = (dl * Math.cos(st.lat)) / (st.size * 0.5);
      const dv = (lat - st.lat) / (st.size * 0.3);
      const r2 = du * du + dv * dv;
      if (r2 > 9) continue;
      // (the spin, strongest inside: the band coordinate read round a turned point)
      const turn = st.dir * 2.6 * Math.exp(-r2 * 0.8);
      const ca = Math.cos(turn);
      const sa = Math.sin(turn);
      const rv = du * sa + dv * ca;
      sLat = st.lat + rv * st.size * 0.3 + (sLat - lat);
      // the boteh: a teardrop round its middle, its tip curled the way it turns
      const phi = Math.atan2(dv, du);
      const tip = 0.62 + 0.5 * Math.cos(phi + st.dir * (0.6 + 2.2 * Math.exp(-r2 * 0.6)));
      const d = Math.sqrt(r2) / tip;
      if (d < 1.12) body = { d, st };
    }
    let s = (Math.sin(clamp(sLat, -Math.PI / 2, Math.PI / 2)) + 1) / 2;
    const waves = HARMONICS[(edge.k - 1) % HARMONICS.length];
    const crest = Math.sin(lon * waves + edge.k * 1.7 + eddy * 2) + 0.35 * Math.sin(lon * waves * 2 + edge.k);
    s += crest * 0.0042 * Math.exp(-((edge.d / 0.012) ** 2));
    let col = bandAt(s);
    // the silk's sheen along the streaks
    // (and its threads, fine streaks for the close look)
    const sheen = fbm(nC, x * 6, y * 140, z * 6, { octaves: 4 }) * 0.5 + 0.5;
    const threads = fbm(nA, x * 30 + fine, y * 640, z * 30, { octaves: 2 });
    col = col.map((c) => c * (0.88 + 0.18 * sheen + 0.05 * threads));
    // the zari, gold, a little wavy
    for (const zs of ZARI) {
      const g = Math.exp(-(((s - zs) / 0.0011) ** 2)) * (0.7 + 0.3 * Math.sin(lon * 40 + zs * 90));
      col = mix3(col, GOLD, clamp(g * 0.85));
    }
    // the lotus at each pole: eight petals, outlined in gold, indigo between
    const fromPole = (Math.PI / 2 - Math.abs(lat)) / (18 * deg);
    if (fromPole < 1.15) {
      const petal = 0.5 + 0.5 * Math.cos(lon * 8 + (lat > 0 ? 0 : Math.PI / 8));
      const inner = 0.5 + 0.5 * Math.cos(lon * 8 + Math.PI + (lat > 0 ? 0 : Math.PI / 8));
      const shape = petal ** 0.7 * 1.05 - fromPole;
      const shape2 = inner ** 0.7 * 0.62 - fromPole;
      let lotus = mix3(INDIGO, VIOLET, smooth(0.0, 0.5, shape) * 0.7);
      lotus = mix3(lotus, mix3(MAROON, SAFFRON, smooth(0, 0.4, shape2)), smooth(-0.02, 0.02, shape2));
      lotus = mix3(lotus, GOLD, Math.exp(-((shape / 0.025) ** 2)) * 0.9 + Math.exp(-((shape2 / 0.02) ** 2)) * 0.7);
      lotus = mix3(lotus, GOLD, smooth(0.12, 0.0, fromPole)); // (its seed head, gold)
      col = mix3(col, lotus, smooth(1.12, 0.85, fromPole + fbm(nD, x * 20, y * 20, z * 20, { octaves: 2 }) * 0.04));
    }
    // a storm's own body: rings inside in maroon, saffron and gold (cream for a bead), inked round
    if (body) {
      const { d, st } = body;
      const rings = 0.5 + 0.5 * Math.cos(d * Math.PI * (st.bead ? 2 : 5));
      let inside = st.bead ? mix3(CREAM, GOLD, rings * 0.5) : mix3(mix3(MAROON, SAFFRON, rings), GOLD, smooth(0.75, 1, rings) * 0.6);
      inside = mix3(inside, CREAM, smooth(0.25, 0.0, d) * (st.bead ? 0.3 : 0.6));
      const k = smooth(1.0, 0.94, d);
      col = mix3(col, inside, k);
      col = mix3(col, INK, Math.exp(-(((d - 0.98) / 0.03) ** 2)) * 0.75);
    }
    const o = i * 3;
    out[o] = col[0];
    out[o + 1] = col[1];
    out[o + 2] = col[2];
  });

  if (PREVIEW) {
    fs.mkdirSync(PREVIEW, { recursive: true });
    const buf = Buffer.alloc(W * H * 3);
    for (let k = 0; k < buf.length; k++) buf[k] = Math.round(clamp(out[k]) * 255);
    await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(PREVIEW, 'music.png'));
    return;
  }
  await save(out, W, H, 3, 'music', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
}
