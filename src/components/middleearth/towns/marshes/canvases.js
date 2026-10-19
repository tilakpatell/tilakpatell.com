// The Marshes’ painted textures: grey rock, black iron, a glow, a flame,
// Gollum’s eye, the elven rope and the drowned faces. Moved out of props.js
// as they were.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, paintPixels, smooth } from '../../../../lib/paint';
import { TAU } from './helpers';

// ── painted textures ──

// Grey rock, nearly white so vertex colours give its hue: grain, joints
// and hairline cracks, rain streaks down it. With its relief.
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

// Black iron in great plates: seams, rivets along them, pitting and rust
// run down from the joints. With its relief.
export function ironCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const gu = u * 4;
    const gv = v * 4;
    const fu = gu - Math.floor(gu);
    const fv = gv - Math.floor(gv);
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
    const seam = 1 - smooth(0.004, 0.025, edge);
    // rivets in a row a little in from each seam
    const ru = Math.min(Math.abs(fu - 0.07), Math.abs(fu - 0.93));
    const rv = Math.min(Math.abs(fv - 0.07), Math.abs(fv - 0.93));
    const along = (t) => Math.abs(((t * 7) % 1) - 0.5) / 7;
    const rivet = Math.max(1 - smooth(0.012, 0.026, Math.hypot(ru, along(fv))), 1 - smooth(0.012, 0.026, Math.hypot(rv, along(fu))));
    const pit = n(u * 96, v * 96, 96);
    const blot = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const rust = smooth(0.58, 0.78, fbm(n, u * 3 + 5, v * 3, { period: 3, octaves: 3 }));
    const streak = smooth(0.5, 0.9, n(u * 48, 0.5, 48)) * (1 - fv);
    field[py * S + px] = clamp01(0.5 + rivet * 0.45 - seam * 0.45 + (pit - 0.5) * 0.12);
    const t = 0.55 + blot * 0.35 + (pit - 0.5) * 0.14 - seam * 0.4 + rivet * 0.35;
    out[0] = 150 * t + rust * 46 + streak * 18;
    out[1] = 144 * t + rust * 18 + streak * 6;
    out[2] = 140 * t;
  });
  return { c, field };
}

// A soft round glow.
export function glowCanvas() {
  const c = makeCanvas(64);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  return c;
}

// A candle flame: a teardrop, white at its heart.
export function flameCanvas() {
  const c = makeCanvas(32, 64);
  paintPixels(c, (u, v, out) => {
    const dy = v - 0.66;
    const d = Math.hypot((u - 0.5) / (0.2 + Math.max(0, dy) * 0.4), dy / (dy < 0 ? 0.6 : 0.26));
    const a = 1 - smooth(0.25, 1, d);
    const core = 1 - smooth(0, 0.45, d);
    out[0] = 200 + core * 55;
    out[1] = 255;
    out[2] = 215 + core * 40;
    out[3] = a * 255;
  });
  return c;
}

// Gollum's eye, wrapped on a ball: the iris at its +x, huge and pale blue,
// a small black pupil, a sallow white with red threads.
export function eyeCanvas() {
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

// The elven rope's twist: silver-grey with darker strands winding round.
export function ropeCanvas() {
  const c = makeCanvas(32, 32);
  paintPixels(c, (u, v, out) => {
    const s = (u + v * 2) % 0.25;
    const k = 0.78 + 0.22 * Math.sin((s / 0.25) * Math.PI);
    out[0] = 214 * k;
    out[1] = 218 * k;
    out[2] = 222 * k;
  });
  return c;
}

// A drowned face for the marsh pools, pale on clear: `kind` 0 a Man of the
// Last Alliance under his helm, 1 an Elf, her hair spread in the water, 2
// an Orc.
export function faceCanvas(kind) {
  const S = 128;
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const cx = 64;
  const cy = 66;
  // hair first, floating out round the head
  x.lineCap = 'round';
  if (kind === 1) {
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * (0.92 + (i / 45) * 1.16);
      const r0 = 34;
      const r1 = 54 + ((i * 37) % 9);
      x.strokeStyle = `rgba(210,230,226,${0.18 + ((i * 13) % 5) * 0.04})`;
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0 * 0.8, cy + Math.sin(a) * r0);
      x.quadraticCurveTo(cx + Math.cos(a + 0.25) * r1 * 0.8, cy + Math.sin(a + 0.25) * r1 * 0.9, cx + Math.cos(a - 0.1) * r1, cy + Math.sin(a - 0.1) * r1);
      x.stroke();
    }
  } else if (kind === 2) {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * (1.1 + (i / 17) * 0.8);
      x.strokeStyle = 'rgba(150,170,160,0.35)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 36);
      x.lineTo(cx + Math.cos(a + 0.15) * 44, cy + Math.sin(a + 0.15) * 46);
      x.stroke();
    }
  }
  // the face, pale, fading at its edges
  const fw = kind === 2 ? 30 : 26;
  const g = x.createRadialGradient(cx, cy - 4, 4, cx, cy, 40);
  g.addColorStop(0, 'rgba(236,246,240,0.95)');
  g.addColorStop(0.6, 'rgba(214,232,226,0.85)');
  g.addColorStop(0.85, 'rgba(190,214,208,0.35)');
  g.addColorStop(1, 'rgba(190,214,208,0)');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(cx, cy, fw + 8, 42, 0, 0, TAU);
  x.fill();
  // a Man's helm, its rim round the brow
  if (kind === 0) {
    x.strokeStyle = 'rgba(200,220,215,0.75)';
    x.lineWidth = 6;
    x.beginPath();
    x.ellipse(cx, cy - 6, 32, 38, 0, Math.PI * 1.08, Math.PI * 1.92);
    x.stroke();
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(cx, cy - 44);
    x.lineTo(cx, cy - 22);
    x.stroke();
  }
  const dark = (a) => `rgba(18,34,32,${a})`;
  // the sockets: hollow and staring, or shut
  const eye = (s) => {
    const ex = cx + s * (kind === 2 ? 13 : 11);
    const ey = cy - 4;
    const sh = x.createRadialGradient(ex, ey, 1, ex, ey, 11);
    sh.addColorStop(0, dark(kind === 1 ? 0.45 : 0.95));
    sh.addColorStop(0.6, dark(kind === 1 ? 0.25 : 0.6));
    sh.addColorStop(1, dark(0));
    x.fillStyle = sh;
    x.beginPath();
    x.ellipse(ex, ey, 10, kind === 2 ? 6 : 7, s * (kind === 2 ? -0.35 : 0.1), 0, TAU);
    x.fill();
    if (kind === 1) {
      x.strokeStyle = dark(0.8);
      x.lineWidth = 1.4;
      x.beginPath();
      x.arc(ex, ey - 4, 6, Math.PI * 0.2, Math.PI * 0.8);
      x.stroke();
    }
  };
  eye(-1);
  eye(1);
  // the brow, heavy on an Orc
  if (kind === 2) {
    x.strokeStyle = dark(0.6);
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(cx - 24, cy - 16);
    x.lineTo(cx - 4, cy - 9);
    x.moveTo(cx + 24, cy - 16);
    x.lineTo(cx + 4, cy - 9);
    x.stroke();
  }
  // the nose's shadow
  x.strokeStyle = dark(0.35);
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(cx - 2, cy - 2);
  x.quadraticCurveTo(cx - 5, cy + 10, cx - 1, cy + 13);
  x.stroke();
  x.fillStyle = dark(0.5);
  x.beginPath();
  x.ellipse(cx - 3, cy + 14, 2, 1.4, 0, 0, TAU);
  x.ellipse(cx + 3, cy + 14, 2, 1.4, 0, 0, TAU);
  x.fill();
  // the mouth: open in a drowned cry, shut on an Elf, fanged on an Orc
  if (kind === 1) {
    x.strokeStyle = dark(0.6);
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(cx - 8, cy + 24);
    x.quadraticCurveTo(cx, cy + 26, cx + 8, cy + 24);
    x.stroke();
  } else {
    const mw = kind === 2 ? 13 : 8;
    const mh = kind === 2 ? 6 : 8;
    const m = x.createRadialGradient(cx, cy + 25, 1, cx, cy + 25, mw + 2);
    m.addColorStop(0, dark(0.95));
    m.addColorStop(0.7, dark(0.7));
    m.addColorStop(1, dark(0));
    x.fillStyle = m;
    x.beginPath();
    x.ellipse(cx, cy + 25, mw, mh, 0, 0, TAU);
    x.fill();
    if (kind === 2) {
      x.fillStyle = 'rgba(230,240,230,0.9)';
      for (const s of [-1, 1]) {
        x.beginPath();
        x.moveTo(cx + s * 9, cy + 28);
        x.lineTo(cx + s * 7, cy + 19);
        x.lineTo(cx + s * 5, cy + 28);
        x.fill();
      }
    }
  }
  // a Man's beard
  if (kind === 0) {
    x.strokeStyle = 'rgba(200,222,216,0.4)';
    x.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      const bx = cx - 18 + (i / 23) * 36;
      x.beginPath();
      x.moveTo(bx, cy + 18 + Math.abs(bx - cx) * 0.2);
      x.lineTo(bx + Math.sin(i) * 3, cy + 40 - Math.abs(bx - cx) * 0.4);
      x.stroke();
    }
  }
  return c;
}
