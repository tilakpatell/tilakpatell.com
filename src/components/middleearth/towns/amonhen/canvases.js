// Amon Hen’s painted textures: weathered stone, moss, wool, grain, a puff,
// the Uruks’ war-paint. Moved out of props.js as they were.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { TAU } from './helpers';

// ── painted textures ──

// Old stone, nearly white so the vertex colours give its hue: a granular
// grain, shallow pits, hairline cracks, rain streaks, and crusts and rings
// of lichen. With its relief, for the normal map.
export function weatheredCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const pits = makeCells(seed + 7);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 5, v * 5, 5);
    const crack = (1 - smooth(0, 0.03, k.f2 - k.f1)) * smooth(0.5, 0.62, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const q = pits(u * 22, v * 22, 22);
    const pit = q.id < 0.25 ? 1 - smooth(0.04, 0.16, q.f1) : 0;
    const streak = (n(u * 48, 3.5, 48) - 0.5) * smooth(0.4, 0.7, fbm(n, u * 2 + 1, v * 2, { period: 2, octaves: 2 }));
    field[py * S + px] = clamp01(0.35 + big * 0.45 + grain * 0.18 - crack * 0.4 - pit * 0.25);
    const t = 0.8 + big * 0.2 + (grain - 0.5) * 0.12 - crack * 0.34 - pit * 0.12 - streak * 0.2;
    let r = 240 * t;
    let g = 238 * t;
    let b = 230 * t;
    // lichen: pale crusts in drifts, a few white rings, specks of black
    const drift = fbm(n, u * 3 + 11, v * 3 + 4, { period: 3, octaves: 2 });
    const l1 = smooth(0.6, 0.68, fbm(n, u * 6 + 3, v * 6 + 1, { period: 6, octaves: 4 }) + (drift - 0.5) * 0.4);
    const ring = q.id > 0.86 ? smooth(0.12, 0.2, q.f1) * (1 - smooth(0.24, 0.32, q.f1)) : 0;
    const l3 = smooth(0.76, 0.8, fbm(n, u * 32 + 2, v * 32 + 8, { period: 32, octaves: 2 }));
    r = mix(mix(mix(r, 226, l1 * 0.45), 250, ring * 0.45), 80, l3 * 0.3);
    g = mix(mix(mix(g, 226, l1 * 0.45), 250, ring * 0.45), 84, l3 * 0.3);
    b = mix(mix(mix(b, 196, l1 * 0.45), 242, ring * 0.45), 72, l3 * 0.3);
    out[0] = r;
    out[1] = g;
    out[2] = b;
  });
  return { c, field };
}

// Moss, close up: a felt of tiny fronds, pale so the vertex colours dye it,
// with the relief of its tufts.
export function mossCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const k = cells(u * 14, v * 14, 14);
    const tuft = 1 - smooth(0.1, 0.62, k.f1);
    const fine = n(u * 96, v * 96, 96);
    const blot = fbm(n, u * 5, v * 5, { period: 5, octaves: 3 });
    const h = clamp01(tuft * 0.6 + fine * 0.3 + blot * 0.2);
    field[py * S + px] = h;
    const t = 0.62 + h * 0.42 + (k.id - 0.5) * 0.14;
    out[0] = 230 * t;
    out[1] = 240 * t;
    out[2] = 210 * t;
  });
  return { c, field };
}

// Wool, coarse and fulled, grey so a material's colour dyes it (a blanket,
// a pack): a weave, darker in the creases.
export function woolCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const weave = Math.sin(u * S * 1.2) * Math.sin(v * S * 1.2) * 0.5 + 0.5;
    const blotch = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const fine = fbm(n, u * 48 + 3, v * 48, { period: 48, octaves: 2 });
    field[py * S + px] = weave * 0.25 + blotch * 0.5 + fine * 0.25;
    const k = 0.72 + blotch * 0.28 + fine * 0.1 - weave * 0.08;
    out[0] = 232 * k;
    out[1] = 230 * k;
    out[2] = 226 * k;
  });
  return { c, field };
}

// The grain of elven wood, pale grey, long and fine, for the boats.
export function grainCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const wob = fbm(n, u * 2, v * 6, { period: 2, octaves: 3 }) * 2.5;
    const lines = Math.sin((v * 40 + wob) * TAU) * 0.5 + 0.5;
    const fine = n(u * 4, v * 160, 4);
    const h = lines * 0.6 + fine * 0.4;
    field[py * S + px] = h;
    const k = 0.86 + h * 0.12;
    out[0] = 236 * k;
    out[1] = 236 * k;
    out[2] = 230 * k;
  });
  return { c, field };
}

// A soft round puff, a little lumpy (mist, spray).
export function puffCanvas(S = 64) {
  const n = makeNoise(23);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const lump = 0.7 + fbm(n, u * 4, v * 4, { octaves: 3 }) * 0.6;
    out[0] = out[1] = out[2] = 255;
    out[3] = 255 * clamp01(clamp01(1 - d) ** 1.5 * lump);
  });
  return c;
}

// The war-paint sheet, four squares: the White Hand of Saruman smeared
// across a face (the palm over the mouth, the fingers up over the eyes to
// the brow); the same on Lurtz, with his scars; the Hand painted on a
// shield; and nothing.
export function warpaintCanvas() {
  const S = 256;
  const H = S / 2;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const hand = (q, { k = 1, x = 0.5, y = 0.5, face = false } = {}) => {
    ctx.save();
    ctx.setTransform(H * k, 0, 0, H * k, (q % 2) * H + (x - 0.5 * k) * H, (q < 2 ? 0 : H) + (y - 0.5 * k) * H);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0.5, face ? 0.66 : 0.7, face ? 0.23 : 0.21, face ? 0.17 : 0.17, 0, 0, TAU);
    ctx.fill();
    // four fingers, a little apart; on a face they reach up over the eyes
    // to the brow
    const tip = face ? 0.22 : 0.05;
    for (const [x0, x1, y1, w] of [[0.36, 0.22, 0.13, 0.1], [0.45, 0.4, 0, 0.11], [0.55, 0.6, 0, 0.11], [0.64, 0.78, 0.14, 0.095]]) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, 0.64);
      ctx.lineTo(x1, tip + y1 * (face ? 0.7 : 1));
      ctx.stroke();
    }
    // the thumb, out to the side and up
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(0.36, 0.76);
    ctx.quadraticCurveTo(0.2, 0.72, 0.1, face ? 0.56 : 0.5);
    ctx.stroke();
    ctx.restore();
  };
  hand(0, { face: true });
  hand(1, { face: true });
  hand(2, { k: 0.78, y: 0.48 });
  // roughen it: smeared by fingers on a face, brushed on a shield
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n = makeNoise(17);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4;
      const a = d[i + 3] / 255;
      const rough = fbm(n, px / 7, py / 7, { octaves: 3 });
      const streak = n(px / 2.2, py / 16);
      const face = py < H;
      const k = face ? a * (0.45 + rough * 0.7 + streak * 0.35) * 1.5 - 0.3 : a * (0.8 + rough * 0.3 + streak * 0.1) * 1.3 - 0.15;
      d[i] = d[i + 1] = d[i + 2] = 248;
      d[i + 3] = 255 * smooth(0.2, 0.55, k);
    }
  }
  ctx.putImageData(img, 0, 0);
  // Lurtz's scars, pale and puckered, across his brow and cheek
  ctx.save();
  ctx.setTransform(H, 0, 0, H, H, 0);
  ctx.strokeStyle = 'rgba(176, 150, 136, 0.95)';
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, w] of [[0.12, 0.3, 0.42, 0.62, 0.03], [0.68, 0.12, 0.86, 0.44, 0.026], [0.6, 0.78, 0.9, 0.7, 0.022]]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + 0.03, (y0 + y1) / 2 - 0.03, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
  return c;
}
