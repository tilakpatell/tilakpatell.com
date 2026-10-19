// Cirith Ungol's painted textures: rock, the Tower's blocks and flags, a
// glow, a star, a flame, the webs, Shelob's hair and the orcs' warts.
// Moved out of props.js as they were.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, paintPixels, smooth } from '../../../../lib/paint';
import { rng } from '../../shire/build';
import { TAU } from './helpers';

// ── painted textures ──

// Rock, nearly white so the vertex colours give its hue: grain, joints and
// hairline cracks, streaks down it. With its relief.
export function rockCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 5, v * 5, 5);
    const crack = (1 - smooth(0, 0.018, k.f2 - k.f1)) * smooth(0.58, 0.7, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const streak = (n(u * 64, 0.5, 64) - 0.5) * smooth(0.35, 0.7, fbm(n, u * 2 + 3, v * 2, { period: 2, octaves: 2 }));
    const fleck = smooth(0.82, 0.9, n(u * 96 + 5, v * 96, 96));
    field[py * S + px] = clamp01(0.3 + big * 0.5 + grain * 0.14 - crack * 0.5);
    const t = 0.74 + big * 0.3 + (grain - 0.5) * 0.18 - crack * 0.22 - streak * 0.3 + fleck * 0.12;
    out[0] = 226 * t;
    out[1] = 226 * t;
    out[2] = 222 * t;
  });
  return { c, field };
}

// Dressed black stone in courses: blocks of uneven length, the joints
// deep, the faces chipped. With its relief.
export function blockCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const rows = 4;
  paintPixels(c, (u, v, out, px, py) => {
    const ry = v * rows;
    const row = Math.floor(ry);
    const fy = ry - row;
    const shift = n(row * 3.1, 1.7, rows) * 0.9;
    const bx = u * 2 + shift;
    const fx = bx - Math.floor(bx);
    const edge = Math.min(fy, 1 - fy, fx * 0.5, (1 - fx) * 0.5);
    const joint = 1 - smooth(0.006, 0.03, edge);
    const chip = smooth(0.62, 0.75, fbm(n, u * 12, v * 12, { period: 12, octaves: 3 })) * (1 - smooth(0.02, 0.08, edge));
    const grain = n(u * 96, v * 96, 96);
    const blot = fbm(n, u * 5 + 3, v * 5, { period: 5, octaves: 4 });
    const shade = 0.8 + n(Math.floor(bx) * 5.3, row * 2.9) * 0.3;
    field[py * S + px] = clamp01(0.62 - joint * 0.6 - chip * 0.25 + (grain - 0.5) * 0.12);
    const t = (0.62 + blot * 0.35 + (grain - 0.5) * 0.16) * shade - joint * 0.45 - chip * 0.15;
    out[0] = 220 * t;
    out[1] = 214 * t;
    out[2] = 208 * t;
  });
  return { c, field };
}

// Flagstones for the court: big irregular slabs, worn, dark joints.
export function flagCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 2);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const k = cells(u * 4, v * 4, 4);
    const joint = 1 - smooth(0.02, 0.07, k.f2 - k.f1);
    const grain = n(u * 128, v * 128, 128);
    const blot = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const worn = smooth(0.4, 0.8, fbm(n, u * 2 + 9, v * 2, { period: 2, octaves: 3 }));
    field[py * S + px] = clamp01(0.6 - joint * 0.55 + (grain - 0.5) * 0.1 - k.f1 * 0.15);
    const t = (0.55 + k.id * 0.3 + blot * 0.3 + (grain - 0.5) * 0.15 + worn * 0.1) * (1 - joint * 0.75);
    out[0] = 215 * t;
    out[1] = 205 * t;
    out[2] = 196 * t;
  });
  return { c, field };
}

// Smooth noise in three channels, tiling, for the shaders.
export function noiseCanvas(S = 128) {
  const n1 = makeNoise(3);
  const n2 = makeNoise(17);
  const n3 = makeNoise(29);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    out[0] = fbm(n1, u * 4, v * 4, { period: 4, octaves: 4 }) * 255;
    out[1] = fbm(n2, u * 8, v * 8, { period: 8, octaves: 3 }) * 255;
    out[2] = fbm(n3, u * 2, v * 2, { period: 2, octaves: 5 }) * 255;
  });
}

// A soft round glow.
export function glowCanvas(S = 128) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.28)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.07)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, S, S);
  return c;
}

// Starlight: a hot point with long thin rays, for the phial.
export function starCanvas(S = 256) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const h = S / 2;
  x.globalCompositeOperation = 'lighter';
  const ray = (a, len, w, alpha) => {
    x.save();
    x.translate(h, h);
    x.rotate(a);
    const g = x.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -w);
    x.lineTo(len, 0);
    x.lineTo(0, w);
    x.closePath();
    x.fill();
    x.restore();
  };
  for (let i = 0; i < 4; i++) ray((i / 4) * TAU, h * 0.98, 3, 0.9);
  for (let i = 0; i < 4; i++) ray((i / 4) * TAU + Math.PI / 4, h * 0.55, 2, 0.5);
  for (let i = 0; i < 12; i++) ray((i / 12) * TAU + 0.13, h * (0.25 + (i % 3) * 0.08), 1.2, 0.35);
  const g = x.createRadialGradient(h, h, 0, h, h, h * 0.3);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}

// A torch flame: a ragged teardrop, white-gold at its heart; the material's
// colour gives its heat.
export function flameCanvas() {
  const c = makeCanvas(64, 128);
  const n = makeNoise(41);
  paintPixels(c, (u, v, out) => {
    const y = 1 - v;
    const w = 0.34 * Math.pow(Math.max(0, 1 - y), 0.7) * smooth(0, 0.25, y) + 0.02;
    const wob = (n(u * 4, y * 6) - 0.5) * 0.12 * y;
    const d = Math.abs(u - 0.5 + wob) / w;
    const a = (1 - smooth(0.4, 1, d)) * (1 - smooth(0.7, 1, y + (n(u * 8 + 3, y * 9) - 0.5) * 0.2));
    const core = (1 - smooth(0, 0.6, d)) * (1 - smooth(0.1, 0.5, y));
    out[0] = 255;
    out[1] = 150 + core * 105;
    out[2] = 60 + core * 170;
    out[3] = clamp01(a) * 255;
  });
  return c;
}

// Shelob's web in a sheet: threads every way, thick where they cross, holes
// torn in it, fading to nothing at its edges. The right-hand strip is solid
// thread, for strands to take their colour from.
export function webCanvas(S = 256) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(91);
  x.clearRect(0, 0, S, S);
  x.lineCap = 'round';
  const W = S * 0.94;
  for (let i = 0; i < 260; i++) {
    const a = r() * TAU;
    const cx = r() * W;
    const cy = r() * S;
    const len = S * (0.2 + r() * 0.8);
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    x.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.35})`;
    x.lineWidth = 0.6 + r() * (r() < 0.1 ? 3 : 1.2);
    x.beginPath();
    x.moveTo(cx - dx / 2, cy - dy / 2);
    x.quadraticCurveTo(cx + (r() - 0.5) * 40, cy + (r() - 0.5) * 40 + 12, cx + dx / 2, cy + dy / 2);
    x.stroke();
  }
  // clotted sheets of it
  for (let i = 0; i < 26; i++) {
    const cx = r() * W;
    const cy = r() * S;
    const rad = 10 + r() * 34;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.2 + r() * 0.25})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // fade it out at the edges and tear holes in it
  x.globalCompositeOperation = 'destination-out';
  const fade = (x0, y0, x1, y1) => {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    return g;
  };
  x.fillStyle = fade(0, 0, S * 0.08, 0);
  x.fillRect(0, 0, S * 0.08, S);
  x.fillStyle = fade(W, 0, W - S * 0.08, 0);
  x.fillRect(W - S * 0.08, 0, S * 0.08, S);
  x.fillStyle = fade(0, S, 0, S * 0.9);
  x.fillRect(0, S * 0.9, W, S * 0.1);
  for (let i = 0; i < 7; i++) {
    const cx = S * 0.15 + r() * W * 0.75;
    const cy = S * 0.15 + r() * S * 0.7;
    const rad = 6 + r() * 16;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // and an uneven oval, so no sheet shows its square edges
  x.globalCompositeOperation = 'destination-in';
  x.save();
  x.translate(W / 2, S * 0.42);
  x.scale(1, 1.15);
  const vg = x.createRadialGradient(0, 0, S * 0.1, 0, 0, W * 0.5);
  vg.addColorStop(0, 'rgba(0,0,0,1)');
  vg.addColorStop(0.65, 'rgba(0,0,0,0.85)');
  vg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = vg;
  x.fillRect(-W, -S, W * 2, S * 2);
  x.restore();
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = 'rgba(255,255,255,0.55)';
  x.fillRect(S * 0.96, 0, S * 0.04, S);
  return c;
}

// Fine hair laid one way, and blotches: green the shading, blue the dark,
// for a hide's detail; and its relief.
export function hairCanvas(S = 256) {
  const n = makeNoise(77);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const streak = n(u * 160, v * 18, 160) * 0.6 + n(u * 90 + 3, v * 12, 90) * 0.4;
    const blot = fbm(n, u * 6 + 11, v * 6, { period: 6, octaves: 4 });
    const pit = smooth(0.7, 0.85, n(u * 40 + 7, v * 40, 40));
    field[py * S + px] = clamp01(streak * 0.8 + blot * 0.2 - pit * 0.3);
    out[0] = 128;
    out[1] = streak * 255;
    out[2] = smooth(0.55, 0.75, blot) * 200 + pit * 55;
  });
  return { c, field };
}

// Warty, pitted skin for the orcs: green the shading, blue the dark.
export function wartCanvas(S = 256) {
  const n = makeNoise(63);
  const cells = makeCells(65);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const k = cells(u * 14, v * 14, 14);
    const wart = 1 - smooth(0.05, 0.4, k.f1);
    const crease = 1 - smooth(0, 0.08, k.f2 - k.f1);
    const blot = fbm(n, u * 5, v * 5, { period: 5, octaves: 4 });
    field[py * S + px] = clamp01(0.4 + wart * 0.5 * smooth(0.4, 0.6, k.id) - crease * 0.3);
    out[0] = 128;
    out[1] = 128 + (blot - 0.5) * 200 + wart * 40;
    out[2] = crease * 140 + smooth(0.6, 0.8, blot) * 90;
  });
  return { c, field };
}
