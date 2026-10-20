// The study’s surfaces, painted in code (./brush.js): oak panelling and the
// plaster over it, floorboards, the braided rug, the hearth’s stones, the
// bookcase full of Bilbo’s books, the round green door and the boards of
// the vault. Each is a function of its size, so a tier halves it.

import { fbm, makeCanvas, makeNoise } from '../../../lib/paint';
import { CARD, brush, circle, mixc, oval, rand, rgba, shade, tint } from './brush';
import { sheet } from './paint';

// wood with its grain along x: the desk, the boards, the beams
export function woodArt(w, h, { tone = [66, 42, 26], seed = 17, along = 220, across = 14 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData?.(w, h);
  if (!img?.data) return c;
  const noise = makeNoise(seed);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = fbm(noise, x / along, y / across, { octaves: 4 });
      const ring = 0.5 + 0.5 * Math.sin(n * 22 + y * 0.05);
      const k = 0.72 + ring * 0.28 + (fbm(noise, x / 9, y / 3, { octaves: 2 }) - 0.5) * 0.12;
      const i = (y * w + x) * 4;
      img.data[i] = tone[0] * k;
      img.data[i + 1] = tone[1] * k;
      img.data[i + 2] = tone[2] * k;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

// oak panelling: frames and raised panels, lit from above, the grain up them
export function panelArt(w, h) {
  const c = woodArt(w, h, { tone: [92, 60, 34], seed: 23, along: 14, across: 260 });
  const b = brush(c.getContext('2d'), w, h, { seed: 4, ppm: w / 2 });
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = i / n + 0.02;
    const x1 = (i + 1) / n - 0.02;
    const box = [[x0, 0.12], [x1, 0.12], [x1, 0.88], [x0, 0.88]];
    b.fill(box, { v: [rgba('#ffe2b0', 0.12), rgba('#1a0e06', 0.25)] });
    b.ink(box, { width: 0.004, colour: '#2a160a', alpha: 0.7, twice: false });
    b.line([[x0, 0.12], [x1, 0.12]], { width: 0.003, colour: '#e8b880', alpha: 0.35, twice: false });
  }
  b.fill([[0, 0], [1, 0], [1, 0.06], [0, 0.06]], '#3a2212');
  b.fill([[0, 0.94], [1, 0.94], [1, 1], [0, 1]], '#2a180c');
  return c;
}

// the plaster over the panels, warm and uneven, a little smoke-stained up high
export function plasterArt(w) {
  const c = sheet(w, w, 51, { tone: '#b8a284', edge: 0.12 });
  const b = brush(c.getContext('2d'), w, w, { seed: 6, ppm: w });
  b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], { v: [rgba('#2a1a0e', 0.25), rgba('#2a1a0e', 0)] });
  return c;
}

// floorboards, end to end
export function floorArt(w, h) {
  const c = woodArt(w, h, { tone: [70, 44, 26], seed: 31, along: 160, across: 10 });
  const ctx = c.getContext('2d');
  const r = rand(5);
  ctx.strokeStyle = 'rgba(20, 10, 4, 0.7)';
  ctx.lineWidth = Math.max(1, h / 180);
  const rows = 8;
  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    const x = r() * w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h / rows);
    ctx.stroke();
  }
  return c;
}

// a round rug of braided rag, ring on ring
export function rugArt(w) {
  const c = makeCanvas(w, w);
  const b = brush(c.getContext('2d'), w, w, { seed: 9, ppm: w / 1.2 });
  const colours = ['#8a3a22', '#c8902a', '#4a6a3a', '#7a2a1a', '#d8b06a', '#3a5a6a', '#9a4a2a', '#5a7a3a'];
  for (let i = 0; i < 16; i++) {
    const rr = 0.49 - i * 0.03;
    if (rr <= 0) break;
    b.fill(circle(0.5, 0.5, rr), colours[i % colours.length]);
    b.hatch(circle(0.5, 0.5, rr), { angle: (i % 2 ? 0.8 : -0.8), gap: 0.004, width: 0.0012, colour: '#1a0e06', alpha: 0.25 });
  }
  b.fill(circle(0.5, 0.5, 0.49), { radial: [0.5, 0.5, 0.5], stops: [[0.7, rgba('#000000', 0)], [1, rgba('#000000', 0.35)]] });
  // (round: nothing beyond its edge)
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w * 0.495, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// the hearth’s stones: rough blocks in their mortar, soot over the mouth
export function stoneArt(w, h) {
  const c = makeCanvas(w, h);
  const b = brush(c.getContext('2d'), w, h, { seed: 12, ppm: w / 0.9 });
  b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], '#4a443c');
  const r = rand(3);
  const rows = 9;
  for (let j = 0; j < rows; j++) {
    let x = -r() * 0.1;
    const y0 = j / rows;
    while (x < 1) {
      const bw = 0.12 + r() * 0.12;
      const g = 0.006;
      const tone = mixc('#8a8274', '#5a544a', r());
      b.wash([[x + g, y0 + g], [x + bw - g, y0 + g * 1.4], [x + bw - g * 1.3, y0 + 1 / rows - g], [x + g * 1.2, y0 + 1 / rows - g * 1.2]], { v: [tint(tone, 0.15), shade(tone, 0.2)], y0, y1: y0 + 1 / rows }, { edge: 0.5, grain: 0.4 });
      x += bw;
    }
  }
  b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], { v: [rgba('#0a0604', 0.55), rgba('#0a0604', 0)], y0: 0, y1: 0.5 });
  return c;
}

// Bilbo’s bookcase from the front: five shelves of spines, gilt on some,
// a jar, a candle, a rolled map
export function shelfArt(w, h) {
  const c = woodArt(w, h, { tone: [74, 46, 26], seed: 41, along: 18, across: 200 });
  const b = brush(c.getContext('2d'), w, h, { seed: 14, ppm: w / 0.7 });
  const r = rand(21);
  const shelves = 5;
  const spines = ['#6a1e1a', '#2e4a3a', '#3a3a5a', '#7a5a2a', '#4a2a1a', '#8a7a5a', '#5a2a3a', '#2a3a2a', '#9a6a3a'];
  for (let s = 0; s < shelves; s++) {
    const y1 = 0.04 + ((s + 1) / shelves) * 0.92;
    const y0 = y1 - 0.92 / shelves + 0.025;
    b.fill([[0.04, y0 - 0.02], [0.96, y0 - 0.02], [0.96, y1], [0.04, y1]], '#1a0e06');
    let x = 0.05;
    while (x < 0.94) {
      if (r() < 0.07) {
        // a jar, or a candle-end, between the books
        b.wash(oval(x + 0.035, y1 - 0.04, 0.03, 0.045), { v: ['#c8b890', '#6a5a3a'] }, { edge: 0.4 });
        x += 0.08;
        continue;
      }
      const bw = 0.022 + r() * 0.03;
      const bh = (y1 - y0) * (0.62 + r() * 0.34);
      const col = spines[Math.floor(r() * spines.length)];
      const lean = r() < 0.08 ? 0.01 : 0;
      const spine = [[x + lean, y1 - bh], [x + bw + lean, y1 - bh], [x + bw, y1], [x, y1]];
      b.wash(spine, { h: [tint(col, 0.2), shade(col, 0.35)], x0: x, x1: x + bw }, { edge: 0.4, grain: 0.3 });
      if (r() < 0.6) for (const k of [0.15, 0.8]) b.line([[x + 0.003, y1 - bh * k], [x + bw - 0.003, y1 - bh * k]], { width: 0.002, colour: '#d8b04a', alpha: 0.8, twice: false });
      x += bw + 0.003;
    }
    b.fill([[0.02, y1], [0.98, y1], [0.98, y1 + 0.02], [0.02, y1 + 0.02]], '#5a3a1e');
  }
  b.ink([[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]], { width: 0.006, colour: '#2a160a', twice: false });
  return c;
}

// the round green door: its planks, its frame, the brass knob in the middle
export function doorArt(w) {
  const c = makeCanvas(w, w);
  const b = brush(c.getContext('2d'), w, w, { seed: 8, ppm: w / 1.1 });
  b.fill(circle(0.5, 0.5, 0.5), '#5a3a1e');
  b.wash(circle(0.5, 0.5, 0.45), { radial: [0.4, 0.35, 0.7], stops: [[0, '#3f8a4a'], [1, '#1a4a26']] }, { edge: 0.6 });
  for (let i = 1; i < 8; i++) b.clip(circle(0.5, 0.5, 0.45), () => b.line([[i / 8, 0], [i / 8, 1]], { width: 0.002, colour: '#0e2a14', alpha: 0.6, twice: false }));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.fill(circle(0.5 + Math.cos(a) * 0.475, 0.5 + Math.sin(a) * 0.475, 0.012), '#2a1a0e');
  }
  b.fill(circle(0.5, 0.5, 0.05), { radial: [0.48, 0.48, 0.06], stops: [[0, '#fff0a0'], [1, '#a8781a']] });
  b.ink(circle(0.5, 0.5, 0.05), { width: 0.002, twice: false });
  return c;
}

// the vault’s boards, curved over the room
export function vaultArt(w, h) {
  const c = woodArt(w, h, { tone: [58, 38, 24], seed: 61, along: 260, across: 9 });
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(12, 6, 2, 0.6)';
  ctx.lineWidth = Math.max(1, h / 200);
  for (let i = 0; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i / 14) * h);
    ctx.lineTo(w, (i / 14) * h);
    ctx.stroke();
  }
  return c;
}

// the mithril coat: rings of silver, finer than any mail of Men
export function mithrilArt(w, h) {
  const c = makeCanvas(w, h);
  const b = brush(c.getContext('2d'), w, h, { seed: 2, ppm: w / 0.3 });
  b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], { h: ['#e8eef6', '#7a8494'] });
  for (let y = 0; y < 1; y += 0.02) for (let x = (y * 50) % 2 ? 0.01 : 0; x < 1; x += 0.02) b.ink(circle(x, y, 0.008), { width: 0.0004, colour: '#ffffff', alpha: 0.5, twice: false });
  return c;
}

// the sign Bilbo propped by the door
export function signArt(w, h) {
  const c = makeCanvas(w, h);
  const b = brush(c.getContext('2d'), w, h, { seed: 3, ppm: w / 0.3 });
  b.wash([[0, 0], [1, 0], [1, 1], [0, 1]], { v: [tint(CARD, 0.1), '#c8b48a'] }, { edge: 0.5 });
  b.text('No admittance', 0.5, 0.38, { size: 0.2, align: 'center', font: 'Georgia, serif', italic: true, weight: 600, max: 0.9 });
  b.text('except on', 0.5, 0.6, { size: 0.16, align: 'center', font: 'Georgia, serif', italic: true, weight: 500, max: 0.9 });
  b.text('party business', 0.5, 0.82, { size: 0.2, align: 'center', font: 'Georgia, serif', italic: true, weight: 600, max: 0.9 });
  return c;
}
