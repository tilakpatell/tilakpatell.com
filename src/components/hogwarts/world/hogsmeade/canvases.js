// The village’s painted surfaces (in a browser): what a scan can’t give at
// its real size, drawn here with a height field for the relief, as the
// Road’s towns paint their slate and planks. Each repeats every two metres
// (the builder lays uvs in metres, ./buckets.js’s metricUv, a repeat 2 m).
// The slates in their courses, each a little lifted at its lower edge and
// none quite the colour of the next; the street’s setts, domed and dark in
// the joints; the pavement’s flags; leaded glass in diamond quarries; and a
// field of soft noise that breaks up the snow.
//
//   slateCanvas(), settsCanvas(), flagsCanvas() → { map: canvas, normal: canvas }
//   leadedCanvas() → canvas   noiseCanvas() → canvas (grey)

import { fbm, makeCanvas, makeNoise, normalFromField } from '../../../../lib/paint';

const N = 512; // px a two-metre repeat
const PX = N / 2; // px a metre

// mulberry32, so the village is painted the same for everyone
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fill an image from a per-pixel function giving [r, g, b] 0…255 and a height
function paint(fn) {
  const c = makeCanvas(N, N);
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const field = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [r, gg, b, h] = fn(x, y);
      const i = (y * N + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      field[y * N + x] = h;
    }
  g.putImageData(img, 0, 0);
  return { c, field };
}

export function slateCanvas() {
  const noise = makeNoise(31);
  const r = rng(7);
  const course = Math.round(0.24 * PX);
  const rows = Math.ceil(N / course);
  // each course its slates across the whole repeat (their widths, their
  // shades), every other course set over by half a slate
  const slates = [];
  for (let row = 0; row < rows; row++) {
    const list = [];
    let x = 0;
    while (x < N) {
      const w = Math.min(N - x, Math.round((0.26 + r() * 0.12) * PX));
      list.push({ x0: x, x1: x + w, shade: 0.78 + r() * 0.3, hue: r(), lichen: r() < 0.07 });
      x += w;
    }
    slates.push({ list, off: row % 2 ? Math.round(0.16 * PX) : 0 });
  }
  const { c, field } = paint((x, y) => {
    const row = Math.floor(y / course) % rows;
    const k = (y % course) / course; // 0 at a course’s top, 1 at its lower edge
    const { list, off } = slates[row];
    const xx = (x + off) % N;
    const s = list.find((t) => xx >= t.x0 && xx < t.x1) ?? list[list.length - 1];
    const edge = Math.min(xx - s.x0, s.x1 - xx);
    const gap = edge < 2 || k > 0.96 ? 0.35 : 1;
    const grain = fbm(noise, x / 32, y / 32, { period: N / 32, octaves: 3 }) * 0.18;
    const v = s.shade * gap * (0.9 + grain);
    // (blue-grey Welsh slate, some greener, a few with a patch of lichen)
    let col = [78 + s.hue * 10, 86 + s.hue * 6, 98 - s.hue * 8].map((q) => q * v);
    if (s.lichen && fbm(noise, x / 16, y / 16, { period: N / 16 }) > 0.58) col = [150, 148, 96];
    return [...col, gap < 1 ? 0 : 0.2 + k * 0.8 + grain];
  });
  return { map: c, normal: normalFromField(field, N, N, 2.6) };
}

export function settsCanvas() {
  const noise = makeNoise(53);
  const r = rng(11);
  // (sixteen courses and ten setts a course to the repeat, so it tiles)
  const rowH = N / 16;
  const rows = 16;
  const shades = Array.from({ length: rows * 20 }, () => 0.75 + r() * 0.35);
  const offs = Array.from({ length: rows }, () => Math.round(r() * 0.2 * PX));
  const { c, field } = paint((x, y) => {
    const row = Math.floor(y / rowH) % rows;
    const w = N / 10;
    const xx = (x + offs[row]) % N;
    const col = Math.floor(xx / w);
    const u = (xx % w) / w - 0.5;
    const v = (y % rowH) / rowH - 0.5;
    // (a domed sett: highest in its middle, the joint between dark and low)
    const dome = Math.max(0, 1 - (u * u * 3.2 + v * v * 3.6));
    const joint = dome < 0.08;
    const sh = shades[(row * 20 + col) % shades.length];
    const grain = fbm(noise, x / 8, y / 8, { period: N / 8, octaves: 3 }) * 0.25;
    const k = joint ? 0.28 : sh * (0.82 + grain);
    return [96 * k + 8, 92 * k + 6, 88 * k + 4, joint ? 0 : Math.sqrt(dome) + grain * 0.4];
  });
  return { map: c, normal: normalFromField(field, N, N, 3.2) };
}

export function flagsCanvas() {
  const noise = makeNoise(77);
  const r = rng(19);
  const rowH = [0.62, 0.48, 0.7, 0.55].map((m) => Math.round(m * PX));
  const rows = [];
  let y0 = 0;
  for (let i = 0; y0 < N; i++) {
    const h = rowH[i % rowH.length];
    const cuts = [];
    let x = Math.round(r() * 0.3 * PX);
    while (x < N + PX) {
      cuts.push({ x, shade: 0.8 + r() * 0.3 });
      x += Math.round((0.5 + r() * 0.5) * PX);
    }
    rows.push({ y0, y1: Math.min(N, y0 + h), cuts });
    y0 += h;
  }
  const { c, field } = paint((x, y) => {
    const row = rows.find((q) => y >= q.y0 && y < q.y1) ?? rows[rows.length - 1];
    let cut = row.cuts[0];
    for (const q of row.cuts) if (q.x <= x) cut = q;
    const next = row.cuts.find((q) => q.x > x)?.x ?? N + PX;
    const joint = y - row.y0 < 2 || x - cut.x < 2 || next - x < 2;
    const grain = fbm(noise, x / 16, y / 16, { period: N / 16, octaves: 4 }) * 0.3;
    const k = joint ? 0.4 : cut.shade * (0.85 + grain);
    return [150 * k, 142 * k, 128 * k, joint ? 0 : 0.6 + grain];
  });
  return { map: c, normal: normalFromField(field, N, N, 1.8) };
}

// leaded glass in diamond quarries: pale old glass, each pane its own, the lead dark
export function leadedCanvas() {
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(5);
  g.fillStyle = '#111';
  g.fillRect(0, 0, S, S);
  const q = S / 5;
  for (let i = -6; i < 12; i++)
    for (let j = -6; j < 12; j++) {
      const cx = (i + j) * (q / 2);
      const cy = (j - i) * (q / 2) * 1.4;
      const v = 175 + r() * 60;
      g.fillStyle = `rgb(${v},${v * (0.92 + r() * 0.08)},${v * (0.78 + r() * 0.12)})`;
      g.beginPath();
      g.moveTo(cx, cy - q * 0.7 + 3);
      g.lineTo(cx + q / 2 - 3, cy);
      g.lineTo(cx, cy + q * 0.7 - 3);
      g.lineTo(cx - q / 2 + 3, cy);
      g.closePath();
      g.fill();
    }
  // the frame’s edge, dark
  g.strokeStyle = '#111';
  g.lineWidth = 10;
  g.strokeRect(0, 0, S, S);
  return c;
}

export function noiseCanvas() {
  const S = 256;
  const noise = makeNoise(97);
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = Math.round(fbm(noise, x / 32, y / 32, { period: S / 32, octaves: 4 }) * 255);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}
