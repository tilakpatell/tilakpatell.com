// Cybertron's maps, worked out here once and saved as webp in
// public/textures/universe/ for the universe map's planet and the Cybertron
// page's: the world at war, the way the long shots from space show it. A
// sphere built over end to end. Great circular works (the city-states, the
// polar works) of rings within rings, terraces stepping up to a dome or down
// to a pit or a reactor, lesser circles set round their rims; the land
// between broken into great curved plates by canyons with energon deep in
// them; districts of pale towers packed close, darker blue steel between;
// and the war's fires running molten along the rings, the seams and the
// trenches, bursting out where the fighting is. Sampled in 3D on the sphere,
// so there's no seam.
//
//   transformers.webp / -sm   the colour
//   transformers-normal.webp  the relief, as a tangent-space normal map
//   transformers-glow.webp    what glows, packed: red the energon, green the
//                             fires, blue the cities' lights (for the night
//                             side), so each side's energon can be its own
//                             colour. Lossless: lossy webp would smear one
//                             channel into the next.
//
//   transformers-xl.ktx2      the colour at 4096, for the universe map's
//                             planet worn near on ultra (UASTC: a quarter of
//                             a 4096 WebP's graphics memory)
//
// node scripts/build-cybertron-planet.mjs   (a minute or two; CY_W=2048 for
// a quick look; CY_XL=only writes the -xl alone, the rest left as they are)

import fs from 'node:fs';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'universe');
const W = +(process.env.CY_W ?? 4096); // worked out at this size, saved at half (and a quarter)
const H = W / 2;

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
// a hash of up to four integers, 0…1
function hash(a, b = 0, c = 0, d = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(d | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (v) => v - Math.floor(v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const key = (id) => Math.floor(id * 1e9); // a 0…1 id back to an integer, to hash on
const TAU = Math.PI * 2;

// The map's direction for a latitude and longitude, in degrees, the way
// three.js's sphere is UV-mapped (u from 0 at the back, round to the east).
function dir(latDeg, lonDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)];
}
// a basis on the surface at c (for the angle round it)
function basis(c) {
  const up = Math.abs(c[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(up, c));
  const e2 = cross(c, e1);
  return [e1, e2];
}
// the point d radians from c, toward the angle a round it
function away(c, a, d) {
  const [e1, e2] = basis(c);
  return norm([0, 1, 2].map((k) => c[k] * Math.cos(d) + (e1[k] * Math.cos(a) + e2[k] * Math.sin(a)) * Math.sin(d)));
}
// a direction picked at random, evenly over the sphere
function anywhere(r) {
  const z = r() * 2 - 1;
  const a = r() * TAU;
  const s = Math.sqrt(1 - z * z);
  return [Math.cos(a) * s, z, Math.sin(a) * s];
}
const apart = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));

// ── the metal ──
const SILVER_DK = hex('#8f9cad');
const SILVER_LT = hex('#e9eff6');
const STEEL_DK = hex('#1f2b40');
const STEEL_LT = hex('#4c6386');
const IRON_DK = hex('#2f3846');
const IRON_LT = hex('#66717f');
const WALL = hex('#111925');
const DEEP = hex('#04070c');
const SCORCH = hex('#1a191c');
const EMBER = hex('#4a2410');
const HOT = hex('#b8602a'); // metal seen through a fire: under the glow anyway

// ── the great works: rings within rings ──
// profile: 'tower' (the terraces step up to the middle), 'bowl' (down to
// it), 'mixed'. core: 'dome', 'reactor' or 'pit'. halo: the district
// wrapped round part of it, out to a last curved canyon ('silver', 'steel').
const NAMED = [
  { name: 'north pole', at: [0, 1, 0], r: 0.5, profile: 'tower', core: 'dome', halo: 'silver' },
  { name: 'Iacon', at: dir(26, 178), r: 0.44, profile: 'tower', core: 'dome', halo: 'silver' },
  { name: 'Kaon', at: dir(-22, 24), r: 0.4, profile: 'bowl', core: 'reactor', halo: 'steel' },
  { name: 'south pole', at: [0, -1, 0], r: 0.42, profile: 'bowl', core: 'pit', halo: 'steel' },
  { name: 'Polyhex', at: dir(-2, 262), r: 0.3, profile: 'mixed', core: 'reactor', halo: 'silver' },
  { name: 'Praxus', at: dir(16, 100), r: 0.27, profile: 'tower', core: 'dome', halo: 'silver' },
  { name: 'Tarn', at: dir(-8, 322), r: 0.3, profile: 'bowl', core: 'pit', halo: 'steel' },
  { name: 'Vos', at: dir(36, 292), r: 0.17, profile: 'tower', core: 'dome' },
  { name: 'Tyger Pax', at: dir(-14, 140), r: 0.16, profile: 'bowl', core: 'reactor' },
  { name: 'Helex', at: dir(-36, 214), r: 0.19, profile: 'mixed', core: 'dome' },
  { name: 'Altihex', at: dir(22, 50), r: 0.16, profile: 'tower', core: 'reactor' },
  { name: 'Uraya', at: dir(30, 228), r: 0.13, profile: 'bowl', core: 'pit' },
];
const wr = rng(53);
const WORKS = NAMED.map((w) => ({ ...w }));
// lesser circles set round the rims of the great ones
for (const w of NAMED.filter((n) => n.r >= 0.25)) {
  const n = 2 + Math.floor(wr() * 4);
  const a0 = wr() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU * (0.35 + wr() * 0.3) + wr() * 0.3;
    const r = w.r * (0.09 + wr() * 0.08);
    WORKS.push({ at: away(w.at, a, w.r * (0.9 + wr() * 0.12)), r, profile: wr() < 0.5 ? 'bowl' : 'tower', core: ['dome', 'reactor', 'pit'][Math.floor(wr() * 3)], sat: true, parent: w });
  }
}
// and the rest scattered where there's room: middling works, and dishes
const fits = (at, r) => WORKS.every((o) => o.sat || apart(at, o.at) > (r + o.r) * 1.08 + 0.02);
for (let tries = 0, made = 0; made < 34 && tries < 4000; tries++) {
  const middling = made < 12;
  const r = middling ? 0.09 + wr() * 0.07 : 0.035 + wr() * 0.045;
  const at = anywhere(wr);
  if (!fits(at, r)) continue;
  WORKS.push({ at, r, profile: middling ? ['tower', 'bowl', 'mixed'][Math.floor(wr() * 3)] : 'bowl', core: middling ? ['dome', 'reactor', 'pit'][Math.floor(wr() * 3)] : wr() < 0.55 ? 'pit' : 'reactor', halo: null });
  made++;
}

// The rings of a work, from its core out: wide terraces (blocks of towers,
// or plain plating, or a ring of lesser circles) with a groove or a wall
// between each, and a canyon round the rim. Widths in radians.
function rings(w, R) {
  const r = w.r;
  const big = r > 0.2;
  w.coreR = r * (w.sat ? 0.32 + R() * 0.14 : big ? 0.09 + R() * 0.06 : 0.2 + R() * 0.14);
  w.coreFire = w.core === 'reactor' || R() < 0.55;
  const rimW = clamp(r * 0.07, 0.007, 0.022);
  const bands = [];
  let d = w.coreR;
  let last = 'core';
  let level = 0;
  while (d < r - rimW - 0.003) {
    let kind;
    if (last === 'groove' || last === 'wall') {
      const x = R();
      kind = big && d > r * 0.25 && x < 0.22 ? 'cells' : x < 0.66 ? 'blocks' : 'plain';
    } else kind = R() < 0.62 ? 'groove' : 'wall';
    let wd;
    if (kind === 'groove') wd = 0.006 + R() * (big ? 0.009 : 0.004);
    else if (kind === 'wall') wd = 0.004 + R() * 0.004;
    else if (kind === 'cells') wd = 0.04 + R() * 0.035;
    else wd = big ? 0.016 + R() * 0.05 : 0.012 + R() * 0.02;
    const room = r - rimW - d;
    if (wd > room) {
      wd = room;
      if (kind === 'cells') kind = 'blocks';
    }
    if (kind === 'blocks' || kind === 'plain' || kind === 'cells') level += w.profile === 'tower' ? -1 : w.profile === 'bowl' ? 1 : R() < 0.5 ? -1 : 1;
    const b = { kind, d0: d, d1: d + wd, level, seed: Math.floor(R() * 1e6) };
    if (kind === 'groove') {
      // molten mostly, energon in some, a few dark
      const x = R();
      b.fire = x < 0.64;
      b.energon = x >= 0.64 && x < 0.9;
      b.n = 2 + Math.floor(R() * (big ? 14 : 5));
      b.duty = 0.4 + R() * 0.5;
    }
    if (kind === 'wall') b.dash = R() < 0.45 ? (R() < 0.6 ? 'fire' : 'lights') : null;
    if (kind === 'blocks') {
      b.silver = R() < (w.halo === 'silver' ? 0.75 : w.halo === 'steel' ? 0.35 : 0.5);
      b.L = 0.013 + R() * 0.016;
      b.rows = Math.max(1, Math.round(wd / (0.016 + R() * 0.012)));
    }
    if (kind === 'plain') {
      b.steel = R() < 0.65;
      b.L = 0.035 + R() * 0.05;
    }
    if (kind === 'cells') b.n = Math.max(5, Math.floor((TAU * Math.sin(d + wd / 2)) / (wd * 1.25)));
    bands.push(b);
    d += wd;
    last = kind;
  }
  bands.push({ kind: 'rim', d0: d, d1: r, level, fire: R() < 0.6, n: 3 + Math.floor(R() * 8), duty: 0.35 + R() * 0.45, seed: Math.floor(R() * 1e6) });
  // the heights: the outermost terrace level with the land, the rest
  // stepped from it
  const STEP = 0.0028;
  for (const b of bands) b.h = (b.level - level) * STEP;
  w.coreH = (bands[0]?.h ?? 0) + (w.profile === 'tower' ? STEP : w.profile === 'bowl' ? -STEP : 0);
  w.bands = bands;
}
// the great ones' halos: a district wrapped round part of the work, out to a
// curved canyon
for (const w of WORKS) {
  rings(w, wr);
  w.b = basis(w.at);
  w.cos = Math.cos(w.r);
  if (w.halo) {
    w.arcR = w.r * (1.3 + wr() * 0.35);
    w.arcA = wr();
    w.arcSpan = 0.3 + wr() * 0.3;
    w.cosHalo = Math.cos(w.arcR + 0.02);
  }
}
// the smallest first: the first a point falls in is the one it's on
WORKS.sort((a, b) => a.r - b.r);
const HALOS = WORKS.filter((w) => w.halo);

// where the war is burning: scorched plating, cracks running molten, craters,
// fires
const WAR = [
  { at: dir(-18, 40), r: 0.5 }, // Kaon's front
  { at: dir(-10, 142), r: 0.32 }, // Tyger Pax
  { at: dir(8, 212), r: 0.3 }, // Iacon's outskirts
  { at: dir(-46, 268), r: 0.3 },
  { at: dir(22, 338), r: 0.3 },
  { at: dir(48, 96), r: 0.24 },
  { at: dir(-60, 160), r: 0.22 },
].map((w) => ({ ...w, cos: Math.cos(w.r) }));

// craters, most of them where the fighting is, and the fires bursting up
const cr = rng(97);
const CRATERS = [];
for (let i = 0; i < 130; i++) {
  let c;
  if (i < 90) {
    const w = WAR[i % WAR.length];
    c = away(w.at, cr() * TAU, Math.sqrt(cr()) * w.r);
  } else c = anywhere(cr);
  const rad = 0.006 + cr() ** 3 * 0.035;
  CRATERS.push({ c, rad, cos: Math.cos(rad * 1.3), fire: i < 90 && cr() < 0.6 });
}
const BLASTS = [];
for (let i = 0; i < 16; i++) {
  const w = WAR[i % WAR.length];
  const rad = 0.018 + cr() ** 2 * 0.045;
  BLASTS.push({ c: away(w.at, cr() * TAU, Math.sqrt(cr()) * w.r * 0.8), rad, cos: Math.cos(rad * 1.6), seed: i });
}

// ── the plating: rectangles on the cube's faces ──
// Each face is cut in a grid, then each cell split again and again at random,
// the longer side first, like the panels on a hull. Gives, at each level, the
// plate's id, how far (in radians) the point is from its edge, which edge
// that is (0 west, 1 east, 2 south, 3 north) and how far along it.
function cubeFace(p) {
  const ax = Math.abs(p[0]);
  const ay = Math.abs(p[1]);
  const az = Math.abs(p[2]);
  let face;
  let a;
  let b;
  let m;
  if (ax >= ay && ax >= az) [face, a, b, m] = [p[0] > 0 ? 0 : 1, p[2], p[1], ax];
  else if (ay >= az) [face, a, b, m] = [p[1] > 0 ? 2 : 3, p[0], p[2], ay];
  else [face, a, b, m] = [p[2] > 0 ? 4 : 5, p[0], p[1], az];
  // equal-angle: the cells come out near enough square on the sphere
  return [face, (Math.atan(a / m) / (Math.PI / 4) + 1) * 0.5, (Math.atan(b / m) / (Math.PI / 4) + 1) * 0.5];
}
function plates(face, fu, fv, grid, depth, seed) {
  const u = fu * grid;
  const v = fv * grid;
  const toRad = Math.PI / 2 / grid;
  let x0 = Math.floor(u);
  let x1 = x0 + 1;
  let y0 = Math.floor(v);
  let y1 = y0 + 1;
  let id = hash(face, x0, y0, seed);
  const ids = [];
  const edges = [];
  const sides = [];
  const along = [];
  const note = () => {
    const e = [u - x0, x1 - u, v - y0, y1 - v];
    let s = 0;
    for (let i = 1; i < 4; i++) if (e[i] < e[s]) s = i;
    ids.push(id);
    edges.push(e[s] * toRad);
    sides.push(s);
    along.push(s < 2 ? (v - y0) / (y1 - y0) : (u - x0) / (x1 - x0));
  };
  note();
  for (let d = 0; d < depth; d++) {
    const k = key(id);
    if (d > 1 && hash(k, d, face, seed + 7) < 0.18) {
      note();
      continue;
    }
    const cut = 0.25 + Math.round(hash(k, d, 3, seed) * 4) * 0.125; // 0.25…0.75 in eighths
    if (x1 - x0 >= y1 - y0) {
      const s = x0 + (x1 - x0) * cut;
      if (u < s) x1 = s;
      else x0 = s;
      id = hash(k, d, u < s ? 1 : 2, seed + 11);
    } else {
      const s = y0 + (y1 - y0) * cut;
      if (v < s) y1 = s;
      else y0 = s;
      id = hash(k, d, v < s ? 3 : 4, seed + 13);
    }
    note();
  }
  return { id, ids, edges, sides, along, e: edges[edges.length - 1], fu: (u - x0) / (x1 - x0), fv: (v - y0) / (y1 - y0) };
}

// ── the canyons: the edges of big cells ──
// (the edges of a 3D Voronoi diagram meet the sphere in straight-ish lines;
// warped, they curve)
function voronoi(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let f1 = 9;
  let f2 = 9;
  let id1 = 0;
  let id2 = 0;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const cx = xi + i;
        const cy = yi + j;
        const cz = zi + k;
        const px = cx + hash(cx, cy, cz, seed);
        const py = cy + hash(cx, cy, cz, seed + 1);
        const pz = cz + hash(cx, cy, cz, seed + 2);
        const d = Math.hypot(px - x, py - y, pz - z);
        const id = hash(cx, cy, cz, seed + 3);
        if (d < f1) {
          f2 = f1;
          id2 = id1;
          f1 = d;
          id1 = id;
        } else if (d < f2) {
          f2 = d;
          id2 = id;
        }
      }
  return { f1, f2, id1, id2 };
}
const SECT = 1.45; // the sectors' cells, per radius
const LESSER = 3.6; // the lesser chasms'

// runs of light round a ring, n to the turn, some lit: 1 along a lit run,
// easing in and out at its ends
function arcs(a01, n, duty, seed) {
  const f = a01 * n;
  const s = Math.floor(f);
  const t = f - s;
  const on = (i) => hash(((i % n) + n) % n, seed, 17) < duty;
  if (!on(s)) return 0;
  const ease = Math.min(0.2, 2 / n); // short runs ease over less of themselves
  return (on(s - 1) ? 1 : smooth(0, ease, t)) * (on(s + 1) ? 1 : smooth(1, 1 - ease, t)) * (0.72 + 0.28 * Math.sin(a01 * TAU * 3 + seed));
}
// blocks round a ring, rows of them, staggered: which, and how far in from
// its edges (radians)
function ringBlocks(d, a01, d0, d1, L, rows, seed) {
  const wr = (d1 - d0) / rows;
  const fr = (d - d0) / wr;
  const ir = Math.min(rows - 1, Math.floor(fr));
  const tr = fr - ir;
  const n = Math.max(6, Math.round((TAU * Math.sin(d0 + wr * (ir + 0.5))) / L));
  const fa = a01 * n + (ir % 2) * 0.5;
  const ia = Math.floor(fa);
  const ta = fa - ia;
  const e = Math.min(Math.min(ta, 1 - ta) * (TAU / n) * Math.sin(d), Math.min(tr, 1 - tr) * wr);
  return { id: hash(((ia % n) + n) % n, ir, seed, 23), e };
}

// ── a point on a work ──
// fills out: h, col, en(ergon), fire, lit
function core(w, k, a01, out) {
  if (w.core === 'dome') {
    const s = Math.sqrt(Math.max(0, 1 - k * k));
    out.h = w.coreH + s * Math.min(0.016, w.coreR * 0.3);
    // ribbed: rings round it, and lines up it
    const ring = smooth(0.0, 0.1, frac(k * 4)) * smooth(1.0, 0.9, frac(k * 4));
    const n = w.coreR > 0.03 ? 16 : 8;
    const rib = smooth(0, 0.08, Math.abs(frac(a01 * n) - 0.5) * 2 * k * 3);
    out.col = mul(mix(STEEL_LT, SILVER_LT, 0.2 + 0.6 * s), 0.55 + 0.45 * ring * (0.7 + 0.3 * rib));
    // its foot ringed with light
    const foot = smooth(0.8, 0.9, k) * smooth(1.0, 0.95, k);
    if (w.coreFire) out.fire = foot * 0.95;
    else out.en = foot;
  } else if (w.core === 'reactor') {
    out.h = w.coreH - 0.004 * smooth(1, 0.8, k);
    // a molten heart, rings of it, a dark rim round
    const swirl = frac(k * 5 + Math.sin(a01 * TAU * 3) * 0.08);
    const heat = smooth(0.95, 0.6, k) * (0.62 + 0.38 * smooth(0.7, 0.0, k)) * (0.75 + 0.25 * smooth(0.2, 0.5, Math.abs(swirl - 0.5) * 2));
    out.fire = heat;
    out.col = mix(mul(WALL, 1.4), HOT, heat);
  } else {
    // a pit, stepped down, energon pooled at the bottom
    const steps = Math.floor((1 - k) * 4) / 4 + smooth(0, 0.2, frac((1 - k) * 4)) / 4;
    out.h = w.coreH - steps * Math.min(0.02, w.coreR * 0.5);
    const lipK = frac((1 - k) * 4);
    out.col = mul(mix(IRON_DK, DEEP, steps), 1 + smooth(0.2, 0.0, lipK) * 0.8 * (k > 0.3 ? 1 : 0));
    out.en = smooth(0.5, 0.0, k) * 0.95;
    if (w.coreFire) out.fire = smooth(0.85, 0.95, k) * smooth(1.0, 0.96, k) * 0.7;
  }
}
// a lesser circle in a ring of them
function cell(sd, kind, h0, out) {
  if (kind < 0.45) {
    // a ring of fire round a hot heart
    if (sd < 0.42) {
      out.fire = 0.5 + 0.4 * smooth(0.42, 0.0, sd);
      out.col = HOT;
      out.h = h0 - 0.002;
    } else if (sd < 0.78) {
      out.fire = smooth(0.13, 0.03, Math.abs(sd - 0.64));
      out.col = WALL;
      out.h = h0 - 0.004;
    } else {
      out.col = SILVER_LT;
      out.h = h0 + 0.002;
    }
  } else if (kind < 0.75) {
    // a dome in a lit moat
    if (sd < 0.62) {
      const s = Math.sqrt(1 - (sd / 0.62) ** 2);
      out.col = mix(STEEL_LT, SILVER_LT, 0.2 + 0.7 * s);
      out.h = h0 + s * 0.004;
    } else if (sd < 0.78) {
      const g = smooth(0.09, 0.02, Math.abs(sd - 0.7));
      if (kind < 0.62) out.fire = g;
      else out.en = g;
      out.col = WALL;
      out.h = h0 - 0.004;
    } else {
      out.col = mix(SILVER_DK, SILVER_LT, 0.5);
      out.h = h0 + 0.001;
    }
  } else {
    // a dark well, lit at the bottom
    out.col = mix(WALL, DEEP, smooth(1, 0.3, sd));
    out.h = h0 - 0.008 * smooth(1, 0.2, sd);
    out.en = smooth(0.45, 0.0, sd) * 0.9;
    out.fire = smooth(0.12, 0.02, Math.abs(sd - 0.86)) * 0.8;
  }
}
function work(w, d, a01, out) {
  out.en = 0;
  out.fire = 0;
  out.lit = 0;
  if (d < w.coreR) return core(w, d / w.coreR, a01, out);
  let b = w.bands[w.bands.length - 1];
  for (const c of w.bands)
    if (d < c.d1) {
      b = c;
      break;
    }
  const wd = b.d1 - b.d0;
  const t = (d - b.d0) / wd; // 0…1 across, from the inner edge
  const edge = Math.min(t, 1 - t) * wd; // radians in from the nearer edge
  switch (b.kind) {
    case 'groove': {
      out.h = b.h - 0.007 * smooth(0, 0.002, edge);
      out.col = mix(WALL, DEEP, smooth(0, 0.003, edge));
      const across = 1 - smooth(0.1, 0.5, Math.abs(t - 0.5));
      const run = arcs(a01, b.n, b.duty, b.seed);
      if (b.fire) out.fire = across * run;
      else if (b.energon) out.en = across * run;
      break;
    }
    case 'wall': {
      out.h = b.h + 0.0025 * smooth(0, 0.0015, edge);
      out.col = mul(SILVER_LT, 0.8 + 0.2 * smooth(0, 0.002, edge));
      if (b.dash) {
        const n = Math.round((TAU * Math.sin(d)) / 0.012);
        const on = smooth(0.08, 0.16, frac(a01 * n)) * smooth(0.56, 0.48, frac(a01 * n)) * smooth(0.25, 0.4, 0.5 - Math.abs(t - 0.5));
        if (b.dash === 'fire') out.fire = on * 0.75;
        else out.lit = on;
      }
      break;
    }
    case 'blocks': {
      const bl = ringBlocks(d, a01, b.d0, b.d1, b.L, b.rows, b.seed);
      const v = hash(key(bl.id), 3);
      const gap = smooth(0.0008, 0.0024, bl.e);
      const court = v < 0.12;
      const tall = v > 0.88;
      let col = b.silver ? mix(SILVER_DK, SILVER_LT, 0.2 + 0.8 * v) : mix(STEEL_DK, STEEL_LT, 0.3 + 0.7 * v);
      if (court) col = mul(col, 0.42);
      out.col = mul(col, 0.3 + 0.7 * gap);
      out.h = b.h + gap * (court ? -0.0012 : tall ? 0.0016 : (v - 0.5) * 0.0008);
      out.lit = (hash(key(bl.id), 5) < 0.4 ? (b.silver ? 0.75 : 0.45) * smooth(0.002, 0.0035, bl.e) : 0) + (1 - gap) * 0.25;
      if (hash(key(bl.id), 7) < 0.025) out.fire = 0.7 * smooth(0.0015, 0.004, bl.e);
      break;
    }
    case 'plain': {
      const n = Math.max(6, Math.round((TAU * Math.sin((b.d0 + b.d1) / 2)) / b.L));
      const fa = a01 * n;
      const seam = smooth(0.0008, 0.0024, Math.min(frac(fa), 1 - frac(fa)) * (TAU / n) * Math.sin(d));
      const v = hash(Math.floor(fa) % n, b.seed, 29);
      let col = b.steel ? mix(STEEL_DK, STEEL_LT, 0.35 + 0.4 * v) : mix(IRON_DK, IRON_LT, 0.3 + 0.4 * v);
      // the terrace's lip catches the light
      col = mul(col, (0.85 + 0.35 * smooth(0.004, 0.0, t * wd)) * (0.45 + 0.55 * seam));
      out.col = col;
      out.h = b.h;
      break;
    }
    case 'cells': {
      const dc = (b.d0 + b.d1) / 2;
      const rs = wd * 0.44;
      const fi = a01 * b.n;
      const si = Math.round(fi);
      const idx = ((si % b.n) + b.n) % b.n;
      const sd = Math.hypot(((fi - si) / b.n) * TAU * Math.sin(dc), d - dc) / rs;
      out.h = b.h - 0.001;
      out.col = mul(mix(IRON_DK, STEEL_DK, 0.5), 0.9 + 0.3 * smooth(0.004, 0, edge));
      if (sd < 1 && hash(idx, b.seed, 3) < 0.85) cell(sd, hash(idx, b.seed, 5), b.h, out);
      break;
    }
    default: {
      // the rim: a canyon round the work, stepped down in ledges
      const k = smooth(0, 0.85, 1 - Math.abs(t - 0.5) * 2);
      const st = Math.floor(k * 3) / 3 + smooth(0, 0.2, frac(k * 3)) / 3;
      const ledge = smooth(0.15, 0, frac(k * 3)) * (k < 0.66 ? 1 : 0);
      out.h = b.h - st * 0.02;
      out.col = mul(mix(WALL, DEEP, k), 1 + ledge * 0.8);
      const run = arcs(a01, b.n, b.duty, b.seed);
      const floor = smooth(0.55, 0.95, k);
      if (b.fire) out.fire = floor * run;
      else out.en = floor * (0.5 + 0.5 * run);
    }
  }
}

// ── one point of the planet ──
// h: height (in planet radii); col: sRGB colour; glow: [energon, fire, lights]
const ON = { h: 0, col: null, en: 0, fire: 0, lit: 0 };
function sample(p) {
  const [x, y, z] = p;
  // whole regions paler or darker
  const region = fbm(N4, x * 2.3 + 4, y * 2.3, z * 2.3, 3);

  // the sectors: the land's great plates, curved, canyons between
  const wx = x + (fbm(N3, x * 1.7, y * 1.7, z * 1.7, 3) - 0.5) * 0.34 + (fbm(N2, x * 7, y * 7, z * 7, 2) - 0.5) * 0.03;
  const wy = y + (fbm(N3, x * 1.7 + 9, y * 1.7, z * 1.7, 3) - 0.5) * 0.34 + (fbm(N2, x * 7 + 9, y * 7, z * 7, 2) - 0.5) * 0.03;
  const wz = z + (fbm(N3, x * 1.7, y * 1.7 + 9, z * 1.7, 3) - 0.5) * 0.34 + (fbm(N2, x * 7, y * 7 + 9, z * 7, 2) - 0.5) * 0.03;
  const vb = voronoi(wx * SECT, wy * SECT, wz * SECT, 101);
  const sid = key(vb.id1);
  const pairB = hash(key(Math.min(vb.id1, vb.id2)), key(Math.max(vb.id1, vb.id2)), 5);
  const dB = (vb.f2 - vb.f1) / SECT;

  // the war
  let war = 0;
  for (const w of WAR) {
    const wd = dot(p, w.at);
    if (wd < w.cos) continue;
    war = Math.max(war, smooth(w.r, w.r * 0.35, Math.acos(clamp(wd, -1, 1))));
  }
  war = clamp(war * smooth(0.38, 0.58, fbm(N4, x * 4 + 1, y * 4, z * 4, 3)) * 1.5);

  // the plating: panels, and the blocks of towers on them
  const [face, fu, fv] = cubeFace(p);
  const pl = plates(face, fu, fv, 4, 5, 1);
  const fb = plates(face, fu, fv, 22, 3, 2);
  // the districts: whole sectors pale with towers or blue steel, with
  // panels of the one let into the other
  let silver = hash(sid, 41) < 0.4;
  if (hash(key(pl.ids[2]), 43) < 0.2) silver = !silver;
  const bv = hash(key(fb.id), 3);
  const street = smooth(0.0009, 0.0026, fb.e);
  const avenue = smooth(0.0015, 0.0045, pl.edges[3]);
  let h = (hash(sid, 3) - 0.5) * 0.008;
  let col;
  let lit = 0;
  let fire = 0;
  let en = 0;

  // the great works' halos: the district wrapped round them, cut in curved
  // plates, out to a last canyon
  let halo = 0;
  let haloSeam = 1;
  let haloSilver = false;
  let arcCut = 0;
  let arcFire = 0;
  for (const w of HALOS) {
    const c = dot(p, w.at);
    if (c < w.cosHalo) continue;
    const d = Math.acos(clamp(c, -1, 1));
    if (d < w.r) continue;
    const a01 = Math.atan2(dot(p, w.b[1]), dot(p, w.b[0])) / TAU + 0.5;
    const rel = frac(a01 - w.arcA); // 0…1 round from the arc's start
    const span = smooth(0, 0.04, rel) * smooth(w.arcSpan, w.arcSpan - 0.04, rel);
    if (span <= 0) continue;
    // curved plates, in rings and spokes
    const ringN = (d - w.r) / 0.034;
    const ringE = Math.min(frac(ringN), 1 - frac(ringN)) * 0.034;
    const nSp = Math.round((TAU * Math.sin(d)) / 0.07);
    const spE = Math.min(frac(a01 * nSp), 1 - frac(a01 * nSp)) * (TAU / nSp) * Math.sin(d);
    const inHalo = smooth(w.arcR + 0.004, w.arcR - 0.004, d) * span;
    if (inHalo > halo) {
      halo = inHalo;
      haloSeam = smooth(0.0008, 0.0026, Math.min(ringE, spE));
      haloSilver = w.halo === 'silver';
    }
    // the canyon at its edge, narrowing out at the ends
    const cw = 0.011 * span;
    const ad = Math.abs(d - w.arcR);
    if (ad < cw) {
      const k = 1 - ad / cw;
      arcCut = Math.max(arcCut, k);
      arcFire = Math.max(arcFire, smooth(0.5, 0.9, k) * (0.4 + 0.6 * arcs(a01, 9, 0.7, Math.floor(w.r * 1e4))));
    }
  }
  if (halo > 0.5) silver = haloSilver;

  if (silver) {
    // pale towers packed close, streets dark between, a few courts sunk
    // among them and a few towers higher still
    const court = bv < 0.1;
    const tall = bv > 0.88;
    col = mix(SILVER_DK, SILVER_LT, 0.25 + 0.75 * bv);
    if (court) col = mul(col, 0.45);
    if (tall) col = mul(col, 1.08);
    col = mul(col, 0.28 + 0.72 * street * avenue);
    h += street * (court ? -0.0012 : tall ? 0.0018 : (bv - 0.5) * 0.001);
    const win = hash(key(fb.id), 5) < 0.45 ? smooth(0.002, 0.004, fb.e) : 0;
    lit = win * 0.7 * (0.6 + 0.4 * hash(key(fb.id), 6)) + (1 - street * avenue) * 0.35;
  } else {
    // blue steel, plate by plate, the blocks on it worn faint
    const ps = hash(key(pl.id), 3);
    col = hash(key(pl.ids[3]), 9) < 0.22 ? mix(IRON_DK, IRON_LT, 0.3 + 0.4 * ps) : mix(STEEL_DK, STEEL_LT, 0.3 + 0.45 * ps);
    col = mul(col, (0.84 + 0.16 * bv) * (0.62 + 0.38 * street));
    h += (ps - 0.5) * 0.0015 * smooth(0, 0.003, pl.edges[4]) + (bv - 0.5) * 0.0004 * street;
    lit = hash(key(fb.id), 13) < 0.06 ? 0.5 * smooth(0.002, 0.004, fb.e) : 0;
  }
  // the panels' seams, wide between the big ones
  const seam0 = smooth(0.0, 0.006, pl.edges[0]);
  const seam1 = smooth(0.0, 0.004, pl.edges[1]);
  const seam2 = smooth(0.0, 0.0028, pl.edges[2]);
  h -= (1 - seam0) * 0.003 + (1 - seam1) * 0.0018 + (1 - seam2) * 0.001;
  col = mul(col, (0.82 + 0.3 * region) * (0.35 + 0.65 * seam0 * seam1 * (0.6 + 0.4 * seam2)));

  // trenches along some of the panels' edges, molten: long runs, some
  // turning a corner
  for (let L = 1; L <= 3; L++) {
    const e = pl.edges[L];
    const w = 0.0045 - L * 0.0006;
    if (e > w) continue;
    const ik = key(pl.ids[L]);
    if (hash(ik, pl.sides[L], L, 31) > 0.22 + war * 0.25 - L * 0.03) continue;
    const seg = pl.along[L] * 3;
    if (hash(ik, pl.sides[L], Math.floor(seg), 33) > 0.75) continue;
    const runs = smooth(0, 0.1, frac(seg)) * smooth(1, 0.9, frac(seg));
    const across = smooth(w, w * 0.3, e);
    h -= across * 0.003;
    col = mul(col, 1 - across * 0.6);
    const hot = 0.55 + 0.45 * hash(ik, pl.sides[L], 35);
    if (hash(ik, pl.sides[L], 37) < 0.18) en = Math.max(en, across * runs * hot);
    else fire = Math.max(fire, across * runs * hot);
  }

  // scattered fires: a block burning here and there, more in the war
  if (hash(key(fb.id), 71) < 0.006 + war * 0.04) {
    fire = Math.max(fire, (0.45 + 0.5 * hash(key(fb.id), 72)) * smooth(0.0015, 0.004, fb.e));
    col = mix(col, HOT, 0.5);
  }

  // the great canyons, and the lesser chasms
  const wB = 0.024 + 0.024 * fbm(N4, x * 3, y * 3, z * 3, 2);
  let canyon = 0;
  let floor = 0;
  let ledge = 0;
  let lip = 0;
  if (pairB < 0.86 && dB < wB) {
    const k = 1 - dB / wB; // 0 at the lip, 1 on the floor's line
    canyon = Math.floor(k * 3) / 3 + smooth(0, 0.16, frac(k * 3)) / 3;
    ledge = smooth(0.14, 0.0, frac(k * 3)) * (k < 0.66 ? 1 : 0);
    floor = smooth(0.62, 0.95, k);
    lip = smooth(0.0, 0.05, k) * smooth(0.22, 0.08, k);
  }
  const vs = voronoi(wx * LESSER + 40, wy * LESSER, wz * LESSER, 202);
  const pairS = hash(key(Math.min(vs.id1, vs.id2)), key(Math.max(vs.id1, vs.id2)), 9);
  const dS = (vs.f2 - vs.f1) / LESSER;
  const wS = 0.007;
  let chasm = 0;
  if (pairS < 0.4 && dS < wS) chasm = smooth(0, 0.5, 1 - dS / wS);

  // the works themselves: rings within rings
  let onWork = null;
  let wd = 0;
  for (const w of WORKS) {
    const c = dot(p, w.at);
    if (c < w.cos) continue;
    const d = Math.acos(clamp(c, -1, 1));
    if (d < w.r) {
      onWork = w;
      wd = d;
      break;
    }
  }
  // the canyons stop at a work's rim
  const open = onWork ? 0 : 1;
  canyon *= open;
  chasm *= open;
  arcCut *= open;

  // halos
  if (halo > 0 && open) {
    const hc = haloSilver ? mix(SILVER_DK, SILVER_LT, 0.3 + 0.6 * bv) : mix(STEEL_DK, STEEL_LT, 0.35 + 0.4 * bv);
    col = mix(col, mul(hc, (0.3 + 0.7 * street) * (0.82 + 0.3 * region) * (0.4 + 0.6 * haloSeam)), halo * 0.85);
    h += halo * (0.002 - (1 - haloSeam) * 0.002);
  }

  // canyons: dark walls, deeper darker, each ledge's lip catching the light;
  // energon pooled along the floors, the rims molten in places, the floors
  // too where the war is
  const cutAll = Math.max(canyon, arcCut * 0.9);
  if (cutAll > 0) {
    h -= cutAll * 0.032;
    col = mix(col, mix(WALL, DEEP, cutAll), smooth(0, 0.15, cutAll));
    col = mul(col, 1 + ledge * 0.9 * open);
    const runs = smooth(0.45, 0.62, fbm(N1, x * 5 + 3, y * 5, z * 5, 3));
    const pool = floor * (0.55 + 0.45 * smooth(0.3, 0.7, fbm(N2, x * 9, y * 9 + 4, z * 9, 2)));
    en = Math.max(en, pool * open * (pairB < 0.45 ? 0.95 : 0.6) * (1 - war * 0.5));
    fire = Math.max(fire, pool * open * war * 1.1, lip * open * runs * (0.55 + 0.5 * war), arcFire * open);
  }
  if (chasm > 0) {
    h -= chasm * 0.01;
    col = mul(col, 1 - chasm * 0.8);
    const g = smooth(0.6, 1, chasm);
    if (pairS < 0.12) en = Math.max(en, g * 0.7);
    else if (pairS < 0.2 || war > 0.3) fire = Math.max(fire, g * (0.5 + 0.5 * war));
  }

  if (onWork) {
    const a01 = Math.atan2(dot(p, onWork.b[1]), dot(p, onWork.b[0])) / TAU + 0.5;
    work(onWork, wd, a01, ON);
    h = ON.h;
    col = mul(ON.col, 0.9 + 0.2 * region);
    en = ON.en;
    fire = ON.fire;
    lit = ON.lit;
  }

  // the war: scorched, cracked open and molten in the cracks, energon
  // bleeding from some
  if (war > 0) {
    const burn = war * smooth(0.35, 0.65, fbm(N2, x * 6 + 2, y * 6, z * 6, 3));
    col = mix(col, mix(SCORCH, EMBER, 0.35 * burn), burn * (onWork ? 0.45 : 0.7));
    const q = fbm(N3, x * 3 + 7, y * 3, z * 3, 2) * 0.6;
    const n1 = Math.abs(N1(x * 11 + q, y * 11, z * 11 - q));
    const n2 = Math.abs(N2(x * 23 + 5, y * 23 + q, z * 23));
    const crack = Math.max(smooth(0.05, 0.0, n1), smooth(0.04, 0.0, n2) * 0.7) * smooth(0.25, 0.6, war);
    if (crack > 0) {
      h -= crack * 0.003;
      col = mul(col, 1 - crack * 0.5);
      if (N4(x * 3, y * 3, z * 3) > 0.25) en = Math.max(en, crack * 0.85);
      else fire = Math.max(fire, crack * (0.6 + 0.4 * war));
    }
  }
  for (const c of CRATERS) {
    const cd = dot(p, c.c);
    if (cd < c.cos) continue;
    const k = Math.acos(clamp(cd, -1, 1)) / c.rad;
    const bowl = smooth(1.0, 0.0, k);
    const rim = Math.exp(-((k - 1) ** 2) * 18) * 0.35;
    h += (rim - bowl * bowl) * c.rad * 0.25;
    col = mul(mix(col, SCORCH, smooth(1.2, 0.8, k)), 1 - bowl * 0.6);
    if (c.fire) fire = Math.max(fire, smooth(0.65, 0.0, k) * 0.95);
  }
  // the fires bursting up: a white-hot heart, ragged at the edge
  for (const b of BLASTS) {
    const cd = dot(p, b.c);
    if (cd < b.cos) continue;
    const k = Math.acos(clamp(cd, -1, 1)) / b.rad;
    const rag = (fbm(N1, x * 40 + b.seed, y * 40, z * 40, 3) - 0.5) * 0.9;
    const blast = smooth(1.15, 0.2, k + rag);
    fire = Math.max(fire, blast);
    col = mix(col, mix(EMBER, HOT, blast), smooth(1.5, 0.6, k + rag * 0.5));
  }

  lit = clamp(lit * (1 - war * 0.7));
  return { h, col, glow: [clamp(en), clamp(fire), lit] };
}

// ── work it out ──
console.time('cybertron');
const height = new Float32Array(W * H);
const colourF = new Float32Array(W * H * 3);
const glowF = new Float32Array(W * H * 3);
for (let j = 0; j < H; j++) {
  const v = 1 - (j + 0.5) / H;
  const lat = (v - 0.5) * Math.PI;
  const cl = Math.cos(lat);
  const sl = Math.sin(lat);
  for (let i = 0; i < W; i++) {
    const lon = ((i + 0.5) / W) * Math.PI * 2;
    const p = [-Math.cos(lon) * cl, sl, Math.sin(lon) * cl];
    const s = sample(p);
    const k = j * W + i;
    height[k] = s.h;
    for (let c = 0; c < 3; c++) {
      colourF[k * 3 + c] = s.col[c];
      glowF[k * 3 + c] = s.glow[c];
    }
  }
  if (j % 256 === 0) console.log(`  row ${j}/${H}`);
}

// a box blur, as wide on the sphere at every latitude
function blur(src, r, stride = 1, at = 0) {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const get = (k) => src[k * stride + at];
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    const rx = Math.min(W / 4, Math.round(r / Math.max(0.05, Math.cos(lat))));
    let acc = 0;
    for (let i = -rx; i <= rx; i++) acc += get(j * W + ((i + W) % W));
    for (let i = 0; i < W; i++) {
      tmp[j * W + i] = acc / (2 * rx + 1);
      acc += get(j * W + ((i + rx + 1) % W)) - get(j * W + ((i - rx + W) % W));
    }
  }
  for (let i = 0; i < W; i++) {
    let acc = 0;
    const tm = (j) => tmp[Math.min(H - 1, Math.max(0, j)) * W + i];
    for (let j = -r; j <= r; j++) acc += tm(j);
    for (let j = 0; j < H; j++) {
      out[j * W + i] = acc / (2 * r + 1);
      acc += tm(j + r + 1) - tm(j - r);
    }
  }
  return out;
}
const S = W / 4096; // blur reaches were set at the full size

// the fires light the metal round them: a soft spill of the fire's glow
// into the glow itself (so a thin seam still reads from far off) and a warm
// cast on the colour
const spill = blur(blur(glowF, Math.round(10 * S), 3, 1), Math.round(10 * S));
const spillE = blur(glowF, Math.round(8 * S), 3, 0);
const glow = new Uint8Array(W * H * 3);
for (let k = 0; k < W * H; k++) {
  const f = glowF[k * 3 + 1];
  const sp = Math.min(1, spill[k] * 2.2);
  glow[k * 3] = Math.round(clamp(glowF[k * 3] + (1 - glowF[k * 3]) * Math.min(1, spillE[k] * 1.5) * 0.25) * 255);
  glow[k * 3 + 1] = Math.round(clamp(f + (1 - f) * sp * 0.4) * 255);
  glow[k * 3 + 2] = Math.round(clamp(glowF[k * 3 + 2]) * 255);
}

// shade the hollows: how far each point lies below the land round it
// (a blur of the height at two reaches), darker the deeper it sits
const near = blur(height, Math.max(2, Math.round(6 * S)));
const far = blur(height, Math.round(28 * S));
const colour = new Uint8Array(W * H * 3);
const WARM = [1.0, 0.45, 0.14];
for (let k = 0; k < W * H; k++) {
  const cavity = Math.max(0, near[k] - height[k]) * 90 + Math.max(0, far[k] - height[k]) * 22;
  const ridge = Math.max(0, height[k] - near[k]) * 40;
  const ao = clamp(1 - cavity * 0.7, 0.3, 1) * (1 + Math.min(0.25, ridge));
  const warm = Math.min(1, spill[k] * 2.2) * 0.22;
  for (let c = 0; c < 3; c++) colour[k * 3 + c] = Math.round(clamp(colourF[k * 3 + c] * ao + WARM[c] * warm) * 255);
}

// the relief, as a tangent-space normal map: east along u, north along v
const normal = new Uint8Array(W * H * 3);
const STRENGTH = 1.0;
for (let j = 0; j < H; j++) {
  const lat = (0.5 - (j + 0.5) / H) * Math.PI;
  const cl = Math.max(0.08, Math.cos(lat));
  const du = ((2 * Math.PI) / W) * cl * 2; // arc length across two pixels east
  const dv = (Math.PI / H) * 2;
  for (let i = 0; i < W; i++) {
    const e = height[j * W + ((i + 1) % W)];
    const w = height[j * W + ((i - 1 + W) % W)];
    const n = height[Math.max(0, j - 1) * W + i];
    const s = height[Math.min(H - 1, j + 1) * W + i];
    const gx = ((e - w) / du) * STRENGTH;
    const gy = ((n - s) / dv) * STRENGTH;
    const l = Math.hypot(gx, gy, 1);
    const k = (j * W + i) * 3;
    normal[k] = Math.round((0.5 - (0.5 * gx) / l) * 255);
    normal[k + 1] = Math.round((0.5 - (0.5 * gy) / l) * 255);
    normal[k + 2] = Math.round((0.5 + 0.5 / l) * 255);
  }
}
console.timeEnd('cybertron');

const save = async (buf, name, w, opts) => {
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .resize(w, w / 2, { kernel: 'lanczos3' })
    .webp({ effort: 6, ...opts })
    .toFile(path.join(OUT, name));
  console.log('  wrote', name);
};
console.log('saving…');
// the -xl: the colour at the size it's worked out at, as KTX2 (flipped for three's UVs, sRGB)
{
  const png = await sharp(colour, { raw: { width: W, height: H, channels: 3 } }).resize(4096, 2048, { kernel: 'lanczos3' }).png().toBuffer();
  const { encodeImage } = await import('./ktx2.mjs');
  const { ktx2 } = await encodeImage(png, { role: 'color', flipY: true, rdo: 3 });
  fs.writeFileSync(path.join(OUT, 'transformers-xl.ktx2'), ktx2);
  console.log('  wrote transformers-xl.ktx2', `${Math.round(ktx2.byteLength / 1024)} KB`);
}
if (process.env.CY_XL === 'only') process.exit(0);
await save(colour, 'transformers.webp', 2048, { quality: 82 });
await save(colour, 'transformers-sm.webp', 1024, { quality: 80 });
await save(normal, 'transformers-normal.webp', 2048, { quality: 88 });
await save(glow, 'transformers-glow.webp', 2048, { lossless: true });
// (and lighter ones for the universe map, which loads every planet at once)
await save(normal, 'transformers-normal-sm.webp', 1024, { quality: 86 });
await save(glow, 'transformers-glow-sm.webp', 1024, { lossless: true });
