// Mordor's painted textures: basalt, cinder, hide, a glow, a flame, a puff
// of smoke, a tiling noise, feathers, the Ring's letters, the sky the gold
// shines with, the camp's banner and Gollum's eye. Moved out of props.js as
// they were.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, paintPixels, smooth } from '../../../../lib/paint';
import { rng } from '../../shire/build';
import { TAU } from './helpers';

// ── painted textures ──

// Black basalt, nearly white so vertex colours give its hue: gas pits,
// grain, joints and fine cracks. With its relief.
export function basaltCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const pits = makeCells(seed + 9);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 6, v * 6, 6);
    const crack = (1 - smooth(0, 0.02, k.f2 - k.f1)) * smooth(0.5, 0.66, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const p = pits(u * 24, v * 24, 24);
    const pit = (1 - smooth(0.06, 0.16, p.f1)) * smooth(0.45, 0.7, n(u * 8 + 3, v * 8, 8));
    field[py * S + px] = clamp01(0.4 + big * 0.4 + grain * 0.14 - crack * 0.5 - pit * 0.35);
    const t = 0.72 + big * 0.3 + (grain - 0.5) * 0.2 - crack * 0.3 - pit * 0.25;
    out[0] = 230 * t;
    out[1] = 226 * t;
    out[2] = 222 * t;
  });
  return { c, field };
}

// Ash and cinder: fine grains, scattered clinker, ripples where the wind
// has laid it. With its relief.
export function cinderCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const grain = n(u * 160, v * 160, 160);
    const mid = fbm(n, u * 16, v * 16, { period: 16, octaves: 3 });
    const k = cells(u * 14, v * 14, 14);
    const clinker = (1 - smooth(0.1, 0.32, k.f1)) * smooth(0.55, 0.75, n(u * 10 + 5, v * 10, 10));
    const ripple = Math.sin((v + (mid - 0.5) * 0.08) * TAU * 22) * 0.5 + 0.5;
    field[py * S + px] = clamp01(0.35 + grain * 0.2 + clinker * 0.5 + ripple * 0.12 + mid * 0.1);
    const t = 0.78 + (grain - 0.5) * 0.34 + (mid - 0.5) * 0.24 - clinker * 0.28 + ripple * 0.05;
    out[0] = 232 * t;
    out[1] = 226 * t;
    out[2] = 220 * t;
  });
  return { c, field };
}

// Hide, scraped and stitched: patches, seams and stains.
export function hideCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 2);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const k = cells(u * 3, v * 3, 3);
    const seam = 1 - smooth(0.0, 0.03, k.f2 - k.f1);
    const stitch = seam * (Math.sin((u + v) * 260) > 0.2 ? 1 : 0.4);
    const blot = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const t = 0.7 + (k.id - 0.5) * 0.3 + (blot - 0.5) * 0.4 - stitch * 0.35;
    out[0] = 220 * t;
    out[1] = 205 * t;
    out[2] = 190 * t;
  });
}

// A soft round glow.
export function glowCanvas(S = 64) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, S, S);
  return c;
}

// A tongue of flame, white at its heart, for a sprite.
export function flameCanvas() {
  const n = makeNoise(77);
  return paintPixels(makeCanvas(64, 128), (u, v, out) => {
    const y = 1 - v;
    const w = 0.36 * Math.pow(1 - y, 0.7) * smooth(0, 0.12, y) + 0.02;
    const x = Math.abs(u - 0.5 + (n(u * 4, y * 5) - 0.5) * 0.18 * y);
    const a = smooth(w, w * 0.25, x) * smooth(1, 0.55, y + (n(u * 6 + 2, y * 6) - 0.5) * 0.3);
    const core = smooth(w * 0.7, 0, x) * smooth(0.7, 0.1, y);
    out[0] = 255;
    out[1] = 130 + core * 125;
    out[2] = 40 + core * 170;
    out[3] = a * 255;
  });
}

// A puff of smoke: soft, lumpy, its alpha in the canvas.
export function puffCanvas(S = 128) {
  const n = makeNoise(41);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const f = fbm(n, u * 5, v * 5, { octaves: 4 });
    const a = smooth(1, 0.25, d + (f - 0.5) * 0.7);
    out[0] = out[1] = out[2] = 200 + f * 55;
    out[3] = a * 255;
  });
}

// Smooth noise in three channels, tiling, for the shaders (lava, smoke,
// the beam's dust, the cracks in the rock).
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

// Feathers in rows, overlapping like slates: each a rounded tip with its
// shaft, the edge darker. Grey, for vertex colours to tint. With relief.
export function featherCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const rows = 8;
    const row = Math.floor(v * rows);
    const fv = v * rows - row;
    const uu = u * 6 + (row % 2) * 0.5;
    const fu = uu - Math.floor(uu);
    // a scalloped tip at the bottom of each row
    const tip = Math.sqrt(Math.max(0, 1 - ((fu - 0.5) * 2) ** 2)) * 0.5;
    const inside = fv - (1 - tip - 0.48);
    const edge = 1 - smooth(0, 0.08, Math.abs(inside));
    const shaft = (1 - smooth(0, 0.035, Math.abs(fu - 0.5))) * 0.5;
    const barbs = Math.sin((fv * 3 + Math.abs(fu - 0.5)) * 60) * 0.5 + 0.5;
    const blot = fbm(n, u * 5, v * 5, { period: 5, octaves: 3 });
    field[py * S + px] = clamp01(0.5 + fv * 0.35 - edge * 0.3 + shaft * 0.2 + barbs * 0.05);
    const t = 0.7 + fv * 0.25 - edge * 0.22 + shaft * 0.12 + (barbs - 0.5) * 0.06 + (blot - 0.5) * 0.14;
    out[0] = out[1] = out[2] = 245 * clamp01(t);
  });
  return { c, field };
}

// The Ring's inscription: a line of flowing letters in the Elvish hand,
// white on black, wrapping round the band. Not a real text: bows and
// stems, the strokes swelling and thinning, the vowel-marks over them.
export function lettersCanvas() {
  const W = 1024;
  const H = 64;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const r = rng(1999);
  const base = 40;
  let px = 6;
  while (px < W - 30) {
    const kind = Math.floor(r() * 6);
    const w = 16 + r() * 8;
    x.lineWidth = 2.6;
    // the stem: up (a telco), down, or short
    const up = kind % 3 === 0;
    const down = kind % 3 === 1;
    x.beginPath();
    x.moveTo(px + 2, up ? base - 30 : base - 16);
    x.quadraticCurveTo(px, base - 6, px + 3, down ? base + 18 : base);
    x.stroke();
    // one or two bows off the stem
    const bows = 1 + (kind > 2 ? 1 : 0);
    for (let b = 0; b < bows; b++) {
      x.lineWidth = 2.2;
      x.beginPath();
      const y0 = base - 16 + b * 2;
      x.moveTo(px + 3, y0);
      x.bezierCurveTo(px + w * 0.6, y0 - 6, px + w * 0.9, base - 4, px + 3 + b * 4, base - (b ? 2 : 0));
      x.stroke();
      if (b === 0 && kind === 5) x.lineTo(px + w * 0.6 + 6, base + 1);
    }
    // a swash or a curl now and then
    if (r() < 0.25) {
      x.lineWidth = 1.8;
      x.beginPath();
      x.moveTo(px + w * 0.7, base);
      x.quadraticCurveTo(px + w, base + 6, px + w + 6, base - 3);
      x.stroke();
    }
    // the tehtar over it: an acute, a dot or two, a curl
    const t = r();
    x.lineWidth = 1.8;
    if (t < 0.3) {
      x.beginPath();
      x.moveTo(px + w * 0.35, base - 23);
      x.lineTo(px + w * 0.65, base - 30);
      x.stroke();
    } else if (t < 0.5) {
      x.beginPath();
      x.arc(px + w * 0.5, base - 26, 1.8, 0, TAU);
      x.fill();
      x.beginPath();
      x.arc(px + w * 0.5 + 6, base - 27, 1.8, 0, TAU);
      x.fill();
    } else if (t < 0.65) {
      x.beginPath();
      x.arc(px + w * 0.5, base - 25, 4, Math.PI, TAU);
      x.stroke();
    }
    px += w + 3 + r() * 5;
    if (r() < 0.08) px += 10;
  }
  return c;
}

// What polished metal catches in Mordor: a low sky of dark cloud, the fire
// of the Mountain red along the horizon, black ground.
export function envCanvas() {
  const W = 128;
  const H = 64;
  const n = makeNoise(5);
  return paintPixels(makeCanvas(W, H), (u, v, out) => {
    const up = 1 - v * 2;
    const horizon = Math.exp(-Math.abs(up) * 5);
    const fire = horizon * (0.5 + 0.5 * smooth(0.3, 0.8, n(u * 6, 1.5, 6))) * (0.6 + 0.4 * Math.cos((u - 0.3) * TAU));
    const sky = up > 0 ? 0.18 + 0.1 * fbm(n, u * 8, v * 8, { period: 8, octaves: 3 }) : 0.05;
    out[0] = clamp01(sky * 0.9 + fire * 1.2) * 255;
    out[1] = clamp01(sky * 0.55 + fire * 0.42) * 255;
    out[2] = clamp01(sky * 0.45 + fire * 0.12) * 255;
  });
}

// The banner of the Eye: a ragged black cloth, the Lidless Eye on it in red.
export function bannerCanvas() {
  const W = 64;
  const H = 128;
  const n = makeNoise(13);
  return paintPixels(makeCanvas(W, H), (u, v, out) => {
    const ex = (u - 0.5) / 0.32;
    const ey = (v - 0.36) / 0.16;
    const r = Math.hypot(ex, ey / Math.max(0.1, 1 - 0.7 * Math.min(1, Math.abs(ex)) ** 1.8));
    const eye = 1 - smooth(0.85, 1.0, r);
    const slit = 1 - smooth(0.04, 0.09, Math.abs(u - 0.5));
    const grime = fbm(n, u * 6, v * 6, { octaves: 3 });
    const k = 0.7 + grime * 0.5;
    out[0] = (20 + eye * (1 - slit * 0.9) * 150) * k;
    out[1] = (16 + eye * (1 - slit) * 20) * k;
    out[2] = 14 * k;
    // the hem torn into tatters
    const tear = v > 0.75 + (n(u * 9, 3) - 0.5) * 0.25 + Math.max(0, Math.sin(u * 30)) * 0.08;
    out[3] = tear ? 0 : 255;
  });
}


// Gollum's eye, wrapped on a ball: the iris at its +x, huge and pale blue,
// a small black pupil, a sallow white with red threads.
export function gollumEyeCanvas() {
  const c = makeCanvas(128, 64);
  const x = c.getContext('2d');
  x.fillStyle = '#d6d6c2';
  x.fillRect(0, 0, 128, 64);
  x.strokeStyle = 'rgba(160,60,50,0.35)';
  x.lineWidth = 0.8;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * 40, 32 + Math.sin(a) * 26);
    x.quadraticCurveTo(64 + Math.cos(a + 0.3) * 30, 32 + Math.sin(a + 0.3) * 22, 64 + Math.cos(a) * 21, 32 + Math.sin(a) * 18);
    x.stroke();
  }
  const g = x.createRadialGradient(64, 32, 2, 64, 32, 19);
  g.addColorStop(0, '#cfe8f6');
  g.addColorStop(0.45, '#9cc8e4');
  g.addColorStop(0.85, '#6c9cc0');
  g.addColorStop(1, '#3a5a74');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(64, 32, 18, 17, 0, 0, TAU);
  x.fill();
  x.strokeStyle = 'rgba(40,70,100,0.35)';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
    x.lineTo(64 + Math.cos(a) * 16, 32 + Math.sin(a) * 15);
    x.stroke();
  }
  x.fillStyle = '#050608';
  x.beginPath();
  x.ellipse(64, 32, 5, 5.5, 0, 0, TAU);
  x.fill();
  return c;
}
