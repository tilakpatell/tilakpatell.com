// The Road's particle sheets, painted here rather than taken from a game:
// none of the committed sheets is a raindrop, a snowflake or a flame
// (docs/superpowers/specs/2026-10-18-the-road-design.md §4.4). Each sheet
// is a strip of four frames, 128² each (512 × 128), white shapes on a clear
// ground with their shading in the alpha and a little in the grey, so the
// records' colour curves tint them; the four frames are four draws of the
// same thing, and a particle takes one at random (`randomStart`).
//
//   node scripts/road-sheets.mjs   → public/models/middleearth/fx/{flake,drop,flame,mote,leaf,petal,puff,ash}.webp
//
// Seeded, so a run paints the same pixels; the site's own work (a row in
// src/data/modelCredits.json says so).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)('sharp');
const OUT = fileURLToPath(new URL('../public/models/middleearth/fx/', import.meta.url));
const F = 128; // a frame's side
const FRAMES = 4;

// mulberry32, and a smooth value noise over it
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (i, j, s) => {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
function noise(x, y, s) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const u = smooth(x - i);
  const v = smooth(y - j);
  const a = hash(i, j, s) + (hash(i + 1, j, s) - hash(i, j, s)) * u;
  const b = hash(i, j + 1, s) + (hash(i + 1, j + 1, s) - hash(i, j + 1, s)) * u;
  return a + (b - a) * v;
}
const fbm = (x, y, s) => noise(x, y, s) * 0.55 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.15;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const step = (e0, e1, x) => smooth(clamp((x - e0) / (e1 - e0)));
const turn = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// Each painter: (x, y in −1…1 across the frame, y up; the frame's rng and
// index) → [grey 0…1, alpha 0…1]
const PAINT = {
  // a drop: a narrow bright core, soft either side (the stretch draws it long)
  drop: (x, y) => {
    const d = Math.hypot(x / 0.22, y / 0.85);
    return [0.85 + 0.15 * step(1, 0, d), step(1, 0.2, d) * (0.6 + 0.4 * step(-0.8, 0.6, y))];
  },
  // a flake: six arms, a branch or two on each, round a soft heart
  flake: (x, y, r, k) => {
    const arms = 6;
    const a = Math.atan2(y, x) + r.spin;
    const rad = Math.hypot(x, y);
    const sector = ((((a / (2 * Math.PI)) * arms) % 1) + 1) % 1;
    const off = Math.abs(sector - 0.5) * ((2 * Math.PI) / arms) * rad;
    const arm = step(0.07, 0.02, off) * step(r.len, r.len - 0.12, rad);
    // (a branch leaves the arm at r.branch and runs out at a slant)
    const out = rad - r.branch;
    const branch = out > 0 && out < 0.2 + 0.04 * k ? step(0.05, 0.015, Math.abs(off - out * 0.75)) : 0;
    const heart = step(0.22, 0.05, rad);
    return [0.92, clamp(Math.max(arm, branch * 0.9, heart))];
  },
  // a flame: a teardrop that narrows upward, its edge licked by noise, its
  // heart white and its tongue thinning to nothing
  flame: (x, y, r, k) => {
    const t = (y + 0.45) / 1.4; // 0 at the foot’s middle, 1 at the tip
    // (round below its middle, narrowing to a tongue above)
    const lick = 0.8 + 0.2 * Math.sin(Math.max(0, t) * 3.2 + k);
    const w = 0.5 * lick * (t < 0 ? Math.sqrt(clamp(1 - (t / 0.3) ** 2)) : Math.pow(clamp(1 - t), 0.8));
    const wob = (fbm(x * 2.5 + k * 3, y * 3 - k, 31 + k) - 0.5) * 0.4 * clamp(t);
    const d = Math.abs(x - wob) / Math.max(0.02, w);
    const a = step(1, 0.5, d) * step(0.98, 0.55, t) * (w > 0.03 ? 1 : 0);
    return [0.7 + 0.3 * step(0.7, 0.1, d) * (1 - t), a];
  },
  // a mote: a round glow, falling off as a light does
  mote: (x, y, r) => {
    const d = Math.hypot(x, y);
    return [1, clamp(Math.exp(-d * d * r.fall) - 0.02)];
  },
  // a leaf: an almond with its midrib and a stalk, turned
  leaf: (x0, y0, r) => {
    const [x, y] = turn(x0, y0, r.spin);
    const w = 0.42 * Math.sqrt(clamp(1 - (y / 0.8) ** 2));
    const d = Math.abs(x) / Math.max(1e-3, w);
    const body = step(1, 0.85, d) * (Math.abs(y) < 0.8 ? 1 : 0);
    const rib = step(0.05, 0.015, Math.abs(x)) * (y > -0.95 && y < 0.7 ? 1 : 0);
    const stalk = step(0.04, 0.015, Math.abs(x)) * (y < -0.75 && y > -0.98 ? 1 : 0);
    return [0.78 + 0.22 * (1 - rib) - 0.12 * d, clamp(Math.max(body, stalk))];
  },
  // a petal: broad at the tip, narrow at its foot
  petal: (x0, y0, r) => {
    const [x, y] = turn(x0, y0, r.spin);
    const t = (y + 0.8) / 1.6;
    const w = 0.55 * Math.sin(Math.PI * clamp(t) * 0.85) ** 0.8;
    const d = Math.abs(x) / Math.max(1e-3, w);
    return [0.85 + 0.15 * t, clamp(step(1, 0.8, d) * (t > 0 && t < 1 ? 1 : 0))];
  },
  // a puff: a few soft lobes and a cloud's noise, thin at its edge
  puff: (x, y, r, k) => {
    let a = 0;
    for (const [cx, cy, s] of r.lobes) a += Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s);
    const n = fbm(x * 2.2 + k * 5, y * 2.2, 71 + k);
    const d = Math.hypot(x, y);
    return [0.72 + 0.28 * n, clamp(a * 0.55 * (0.55 + 0.6 * n) * step(1, 0.6, d))];
  },
  // ash: a ragged little flake, darker at its middle
  ash: (x0, y0, r, k) => {
    const [x, y] = turn(x0, y0, r.spin);
    const a = Math.atan2(y, x);
    const edge = 0.5 + 0.25 * (fbm(Math.cos(a) * 1.5 + k * 4, Math.sin(a) * 1.5, 91 + k) - 0.5) * 2;
    const d = Math.hypot(x / 1.2, y / 0.75) / edge;
    return [0.6 + 0.4 * d, step(1, 0.9, d)];
  },
};

// the frame's own draws, the same for the same sheet and frame
const drawsFor = (rng) => ({
  spin: rng() * Math.PI * 2,
  len: 0.78 + rng() * 0.18,
  branch: 0.38 + rng() * 0.2,
  fall: 6 + rng() * 6,
  lobes: Array.from({ length: 5 }, () => [(rng() - 0.5) * 0.9, (rng() - 0.5) * 0.7, 0.06 + rng() * 0.1]),
});

export async function paintSheet(name) {
  const px = Buffer.alloc(F * FRAMES * F * 4);
  for (let k = 0; k < FRAMES; k++) {
    const r = drawsFor(rngOf(1000 * (Object.keys(PAINT).indexOf(name) + 1) + k));
    for (let j = 0; j < F; j++)
      for (let i = 0; i < F; i++) {
        const x = ((i + 0.5) / F) * 2 - 1;
        const y = 1 - ((j + 0.5) / F) * 2;
        const [g, a] = PAINT[name](x, y, r, k);
        const o = (j * F * FRAMES + k * F + i) * 4;
        const v = Math.round(clamp(g) * 255);
        px[o] = v;
        px[o + 1] = v;
        px[o + 2] = v;
        px[o + 3] = Math.round(clamp(a) * 255);
      }
  }
  return sharp(px, { raw: { width: F * FRAMES, height: F, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  for (const name of Object.keys(PAINT)) {
    const buf = await paintSheet(name);
    await sharp(buf).toFile(`${OUT}${name}.webp`);
    console.log(`${name}.webp ${(buf.length / 1024).toFixed(1)} kB`);
  }
}
