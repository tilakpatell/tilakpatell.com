// The Invincible planet's maps, worked out here once and saved as webp in
// public/textures/universe/ (the universe map's other planets are recoloured
// real maps, scripts/build-universe-textures.py; this one is made up): a
// rust-and-ochre world of old dark sea beds, high plateaus and ridges,
// craters with bright ejecta, and long rifts, some still molten. Sampled in
// 3D on the sphere, so there's no seam and no pinching at the poles.
//
//   invincible.webp / -hq / -sm   the colour (and -xl.ktx2, at 4096, worn near on ultra)
//   invincible-normal.webp / -hq  the relief, as a tangent-space normal map
//   invincible-glow.webp    what glows of itself: the molten rifts and vents
//   invincible-night.webp / -sm   the cities' lights, for the night side
//   invincible-clouds.webp / -sm  the high dust, as an alpha map
//   invincible-rough.webp   how rough: the old sea beds glossy, the rest matte
//                           (ONLY=rough makes just this)
//
// node scripts/build-invincible-planet.mjs   (about two minutes; INV_W=2048
// for the old size, half a minute)

import fs from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'universe');
const W = +(process.env.INV_W ?? 4096); // worked out at this size, saved at it (-xl) and down
const H = W / 2;
const FINE = W >= 4096 ? 5 : 4; // (the finest grain's octaves: one more at 4096, so the close look has it)

// ── noise ──
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// improved Perlin noise in 3D, about −1…1
function perlin(seed) {
  const r = rng(seed);
  const p = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const k = h & 15;
    const u = k < 8 ? x : y;
    const v = k < 4 ? y : k === 12 || k === 14 ? x : z;
    return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}
const N1 = perlin(11);
const N2 = perlin(23);
const N3 = perlin(37);
const N4 = perlin(41);
const N5 = perlin(53);
// fbm, 0…1
const fbm = (n, x, y, z, oct = 5, gain = 0.5) => {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * n(x * f, y * f, z * f);
    norm += a;
    a *= gain;
    f *= 2.03;
  }
  return 0.5 + 0.5 * (s / norm) * 1.4;
};
// ridged: creases where the noise crosses zero, 0…1
const ridged = (n, x, y, z, oct = 5) => {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    const k = 1 - Math.abs(n(x * f, y * f, z * f));
    s += a * k * k;
    norm += a;
    a *= 0.5;
    f *= 2.1;
  }
  return s / norm;
};
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ── craters: many small, a few big, the fresh ones with rays ──
const cr = rng(97);
const CRATERS = [];
for (let i = 0; i < 260; i++) {
  // a point on the sphere, evenly
  const z = cr() * 2 - 1;
  const a = cr() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  const c = [Math.cos(a) * s, z, Math.sin(a) * s];
  const rad = 0.012 + cr() ** 3.2 * 0.16; // radians
  // a basis on the surface there, for the rays' direction round it
  const up = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(c, up));
  const e2 = cross(c, e1);
  CRATERS.push({ c, rad, cos: Math.cos(Math.min(Math.PI, rad * 3.2)), depth: 0.05 + cr() * 0.07, fresh: cr() < 0.22 && rad > 0.03, rays: 7 + Math.floor(cr() * 9), ph: cr() * 10, e1, e2 });
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v) {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
// volcanic vents that still glow
const VENTS = Array.from({ length: 9 }, () => {
  const z = cr() * 1.6 - 0.8;
  const a = cr() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return { c: [Math.cos(a) * s, z, Math.sin(a) * s], r: 0.02 + cr() * 0.035 };
});

// ── the colours ──
const BASALT = [66, 34, 28];
const SEA = [96, 44, 32];
const RUST = [132, 56, 34];
const OCHRE = [184, 106, 58];
const DUST = [222, 172, 128];
const FROST = [232, 206, 192];
const RIFT = [52, 14, 10];
const EJECTA = [236, 196, 160];

const height = new Float32Array(W * H);
const color = new Float32Array(W * H * 3);
const glow = new Float32Array(W * H * 3);
const night = new Float32Array(W * H);
const cloud = new Float32Array(W * H);

console.log('working out the surface…');
for (let y = 0; y < H; y++) {
  const theta = ((y + 0.5) / H) * Math.PI;
  const lat = Math.PI / 2 - theta;
  for (let x = 0; x < W; x++) {
    const phi = ((x + 0.5) / W) * Math.PI * 2;
    // the point on the sphere, as three.js's sphere maps this pixel
    const px = -Math.cos(phi) * Math.sin(theta);
    const py = Math.cos(theta);
    const pz = Math.sin(phi) * Math.sin(theta);
    // warp it a little, so nothing reads as noise
    const wx = px + 0.32 * N5(px * 1.4 + 3, py * 1.4, pz * 1.4);
    const wy = py + 0.32 * N5(px * 1.4, py * 1.4 + 7, pz * 1.4);
    const wz = pz + 0.32 * N5(px * 1.4, py * 1.4, pz * 1.4 + 11);
    const base = fbm(N1, wx * 1.7, wy * 1.7, wz * 1.7, 6);
    const high = smooth(0.48, 0.62, base); // plateaus over the old sea beds
    const ridge = ridged(N2, wx * 3.1, wy * 3.1, wz * 3.1, 5);
    const fine = fbm(N3, px * 16, py * 16, pz * 16, FINE);
    let h = base * 0.55 + high * 0.22 + ridge * high * 0.22 + (fine - 0.5) * 0.07;
    // the rifts: long canyons where a slow noise crosses zero, in some places
    const rn = N4(wx * 1.15 + 40, wy * 1.15, wz * 1.15);
    const riftWhere = smooth(0.5, 0.64, fbm(N3, px * 0.9 + 70, py * 0.9, pz * 0.9, 3));
    const rift = (1 - smooth(0.0, 0.03 + 0.02 * fine, Math.abs(rn))) * riftWhere;
    h -= rift * 0.22;
    // craters
    let rim = 0;
    let floor = 0;
    let ray = 0;
    for (const k of CRATERS) {
      const d = k.c[0] * px + k.c[1] * py + k.c[2] * pz;
      if (d < k.cos) continue;
      const t = Math.acos(Math.min(1, d)) / k.rad;
      if (t < 1) {
        h -= k.depth * (1 - t * t);
        floor = Math.max(floor, 1 - t);
      }
      const r1 = Math.exp(-(((t - 1) / 0.16) ** 2));
      h += k.depth * 0.55 * r1;
      rim = Math.max(rim, r1);
      if (k.fresh && t > 0.9 && t < 3.2) {
        const ang = Math.atan2(px * k.e2[0] + py * k.e2[1] + pz * k.e2[2], px * k.e1[0] + py * k.e1[1] + pz * k.e1[2]);
        const spokes = Math.abs(Math.sin(ang * k.rays * 0.5 + k.ph + 2.5 * N3(px * 7, py * 7, pz * 7))) ** 6;
        ray = Math.max(ray, spokes * 0.45 * (1 - (t - 0.9) / 2.3) ** 2 + 0.3 * Math.max(0, 1 - (t - 0.9) / 0.8));
      }
    }
    const i = y * W + x;
    height[i] = h;
    // the colour, from how high, then what's on it
    let c = h < 0.36 ? mix(BASALT, SEA, smooth(0.2, 0.36, h)) : h < 0.5 ? mix(SEA, RUST, smooth(0.36, 0.5, h)) : h < 0.66 ? mix(RUST, OCHRE, smooth(0.5, 0.66, h)) : mix(OCHRE, DUST, smooth(0.66, 0.85, h));
    // wind streaks, stretched east–west
    const streak = fbm(N2, px * 2.2, py * 18, pz * 2.2, 4);
    c = mix(c, [c[0] * 0.78, c[1] * 0.72, c[2] * 0.7], smooth(0.55, 0.75, streak) * 0.55);
    c = mix(c, [c[0] * 1.14, c[1] * 1.12, c[2] * 1.1], smooth(0.62, 0.8, 1 - streak) * 0.35);
    c = c.map((v) => v * (0.86 + 0.28 * fine));
    c = mix(c, RIFT, rift * 0.85);
    c = mix(c, [c[0] * 0.8, c[1] * 0.76, c[2] * 0.74], floor * 0.5);
    c = mix(c, [c[0] * 1.18 + 12, c[1] * 1.16 + 10, c[2] * 1.14 + 8], rim * 0.35);
    c = mix(c, EJECTA, clamp(ray) * 0.4);
    // frost at the poles, broken up
    c = mix(c, FROST, smooth(1.28, 1.46, Math.abs(lat) + 0.1 * (fine - 0.5)) * (0.55 + 0.4 * fine));
    color.set(c, i * 3);
    // what glows: the deepest of the rifts, molten, and the vents
    // (the middle of a rift brightest, along the stretches where the lava's up)
    let g = (1 - smooth(0.0, 0.022, Math.abs(rn))) * riftWhere * smooth(0.42, 0.58, fbm(N5, px * 2.2 + 9, py * 2.2, pz * 2.2, 3));
    for (const v of VENTS) {
      const d = Math.acos(Math.min(1, v.c[0] * px + v.c[1] * py + v.c[2] * pz));
      if (d < v.r * 2.5) g = Math.max(g, Math.exp(-((d / v.r) ** 2) * 2) * (0.7 + 0.3 * fine));
    }
    glow.set([255 * g, 92 * g * (0.6 + 0.4 * g), 22 * g * g], i * 3);
    // the cities: on the plateaus, away from the rifts and the poles, in clusters
    const civ = smooth(0.55, 0.7, fbm(N1, px * 2.4 + 90, py * 2.4, pz * 2.4, 3)) * high * (1 - rift) * (1 - smooth(0.9, 1.1, Math.abs(lat)));
    const lights = smooth(0.62, 0.8, fbm(N4, px * 55, py * 55, pz * 55, 3)) + 0.5 * smooth(0.7, 0.9, fbm(N2, px * 140, py * 140, pz * 140, 2));
    night[i] = clamp(civ * lights * 1.6);
    // high dust in bands, torn into streaks
    const band = 0.5 + 0.5 * Math.sin(lat * 7.5 + 3.5 * fbm(N5, px * 1.6, py * 1.6, pz * 1.6, 3));
    const tear = fbm(N3, px * 3.2 + 30, py * 14, pz * 3.2, 5);
    cloud[i] = clamp(smooth(0.56, 0.86, tear * (0.55 + 0.55 * band)) * 0.7 * (1 - smooth(1.05, 1.35, Math.abs(lat))));
  }
  if (y % 128 === 0) console.log(`  ${Math.round((y / H) * 100)}%`);
}

// ── save ──
const rgb = (src, scale = 1) => {
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) out[i] = clamp(src[i] * scale, 0, 255);
  return out;
};
const grey = (src) => {
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = clamp(src[i] * 255, 0, 255);
  return out;
};
// the relief as a normal map: the slope across (u) and up (v) the map
const normal = Buffer.alloc(W * H * 3);
{
  const k = 9 * (W / 2048); // how steep (per texel: the same slopes at any size)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const at = (xx, yy) => height[Math.min(H - 1, Math.max(0, yy)) * W + ((xx + W) % W)];
      const du = (at(x + 1, y) - at(x - 1, y)) * 0.5 * k * 10;
      const dv = -(at(x, y + 1) - at(x, y - 1)) * 0.5 * k * 10;
      const n = norm([-du, -dv, 1]);
      const i = (y * W + x) * 3;
      normal[i] = (n[0] * 0.5 + 0.5) * 255;
      normal[i + 1] = (n[1] * 0.5 + 0.5) * 255;
      normal[i + 2] = (n[2] * 0.5 + 0.5) * 255;
    }
}
const save = async (buf, name, w, q = 86) => {
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .resize(w, w / 2, { kernel: 'lanczos3' })
    .webp({ quality: q, effort: 6 })
    .toFile(path.join(OUT, name));
  console.log('  wrote', name);
};
// how rough: the old sea beds glossy (they catch the sun: the planet's own
// floor is 0.22, so a glint, not a white disc), the plateaus matte
const rough = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const h = height[i];
  const r = h < 0.36 ? 0.25 : h < 0.5 ? 0.25 + ((h - 0.36) / 0.14) * 0.65 : 0.9;
  rough[i * 3] = rough[i * 3 + 1] = rough[i * 3 + 2] = Math.round(r * 255);
}
console.log('saving…');
// (ONLY=rough: just the roughness map, the others left as they are)
// (ONLY=rough,normal: just those, the others left as they are; the relief at
// 2048 too, for ultra)
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
if (!only || only.includes('rough')) await save(rough, 'invincible-rough.webp', 1024, 88);
if (!only || only.includes('normal')) {
  await save(normal, 'invincible-normal.webp', 1024, 90);
  await save(normal, 'invincible-normal-hq.webp', 2048, 92);
}
if (only) process.exit(0);
const col = rgb(color);
{
  // the -xl: KTX2 (flipped for three's UVs, sRGB), a quarter of the graphics memory a 4096 WebP takes
  const png = await sharp(col, { raw: { width: W, height: H, channels: 3 } }).resize(4096, 2048, { kernel: 'lanczos3' }).png().toBuffer();
  const { encodeImage } = await import('./ktx2.mjs');
  const { ktx2 } = await encodeImage(png, { role: 'color', flipY: true, rdo: 3 });
  fs.writeFileSync(path.join(OUT, 'invincible-xl.ktx2'), ktx2);
  console.log('  wrote invincible-xl.ktx2', `${Math.round(ktx2.byteLength / 1024)} KB`);
}
await save(col, 'invincible-hq.webp', 2048, 88);
await save(col, 'invincible.webp', 1024);
await save(col, 'invincible-sm.webp', 512);
await save(rgb(glow), 'invincible-glow.webp', 1024);
const lit = grey(night);
for (let i = 0; i < lit.length; i += 3) {
  // a warm sodium white
  lit[i + 1] = lit[i + 1] * 0.82;
  lit[i + 2] = lit[i + 2] * 0.55;
}
await save(lit, 'invincible-night.webp', 1024);
await save(lit, 'invincible-night-sm.webp', 512);
const dust = grey(cloud);
await save(dust, 'invincible-clouds.webp', 1024);
await save(dust, 'invincible-clouds-sm.webp', 512);
