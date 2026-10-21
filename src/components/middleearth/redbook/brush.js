// The Red Book’s brushes: the paint box its pop-ups are painted with, on a
// 2D canvas, in the manner of Tolkien’s ink and watercolour for The Hobbit.
// A shape lives in its card’s 0…1 box (y down); a round thing’s radius is in
// the box’s widths; a stroke, a hatch’s gap and a grain are in metres on the
// card (`ppm`, its pixels a metre), so a line is as thick on a hobbit as on
// the mountains behind him.
//
//   brush(ctx, w, h, { seed, ppm }) → b: trace, fill, wash, ink, line, curve,
//     hatch, stipple, glow, light, clump, grass, text, clip
//   smooth(points, { closed }) → a shape through the points, Catmull–Rom
//   top(points, { bottom }) → a shape: a smooth skyline closed along the bottom
//   rough(points, amp, seed, { n, closed }) → the points, torn a little
//   blob(cx, cy, r, { bumps, depth, seed, aspect }) → a scalloped round, for leaves and smoke
//   circle(cx, cy, r) / oval(cx, cy, rx, ry) / many(...shapes) → shapes
//   mixc(a, b, t), shade(c, k), tint(c, k) → colours
//   cutout(px, ph, art, { ppm, seed, margin, tone }) → a canvas: the art cut from card

import { fbm, makeCanvas, makeNoise } from '../../../lib/paint';

export const INK = '#271b10';
export const CARD = '#f3e7cb';

// a little random from a seed, so a piece paints the same each time
export function rand(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// colours, as #rrggbb
const rgbOf = (c) => {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOf = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
export const mixc = (a, b, t) => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return hexOf(x.map((v, i) => v + (y[i] - v) * t));
};
export const shade = (c, k = 0.3) => mixc(c, '#1c130b', k);
export const tint = (c, k = 0.3) => mixc(c, '#fff6e2', k);
export const rgba = (c, a) => {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// shapes
const tracePoints = (ctx, w, h, pts, closed = true) => {
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  if (closed) ctx.closePath();
};
const traceShape = (ctx, w, h, shape) => (typeof shape === 'function' ? shape(ctx, w, h) : tracePoints(ctx, w, h, shape));

export function smooth(points, { closed = true } = {}) {
  return (ctx, w, h) => curveThrough(ctx, points.map(([x, y]) => [x * w, y * h]), closed, true);
}

// a Catmull–Rom curve as Béziers through pixel points
function curveThrough(ctx, P, closed, move) {
  const n = P.length;
  const at = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  if (move) ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

// a skyline, smooth through its points, closed down the sides and along the bottom
export function top(points, { bottom = 1 } = {}) {
  return (ctx, w, h) => {
    const P = points.map(([x, y]) => [x * w, y * h]);
    ctx.moveTo(P[0][0], bottom * h);
    ctx.lineTo(P[0][0], P[0][1]);
    curveThrough(ctx, P, false, false);
    ctx.lineTo(P.at(-1)[0], bottom * h);
    ctx.closePath();
  };
}

export const circle = (cx, cy, r) => (ctx, w, h) => {
  ctx.moveTo(cx * w + r * w, cy * h);
  ctx.arc(cx * w, cy * h, r * w, 0, Math.PI * 2);
};
export const oval = (cx, cy, rx, ry) => (ctx, w, h) => {
  ctx.moveTo(cx * w + rx * w, cy * h);
  ctx.ellipse(cx * w, cy * h, rx * w, ry * h, 0, 0, Math.PI * 2);
};
export const many =
  (...shapes) =>
  (ctx, w, h) => {
    for (const s of shapes) if (s) traceShape(ctx, w, h, s);
  };

// the points, each pushed a little off the line, as scissors and a nib wander
export function rough(points, amp = 0.01, seed = 1, { n = 6, closed = false } = {}) {
  const noise = makeNoise(seed);
  const out = [];
  const segs = closed ? points.length : points.length - 1;
  for (let i = 0; i < segs; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const d = (fbm(noise, (i * n + k) * 0.35, seed * 0.7, { octaves: 3 }) - 0.5) * 2 * amp * (k === 0 ? 0.3 : 1);
      out.push([ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d]);
    }
  }
  if (!closed) out.push(points.at(-1));
  return out;
}

// a scalloped round: leaves in a crown, a puff of smoke, a cloud
export function blob(cx, cy, r, { bumps = 9, depth = 0.14, seed = 1, aspect = 1, n = 72 } = {}) {
  const rr = rand(seed);
  const phase = rr() * 6;
  const wob = Array.from({ length: bumps }, () => 0.85 + rr() * 0.3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = (a * bumps) / (Math.PI * 2) + phase;
    const lobe = wob[Math.floor(k) % bumps];
    const s = Math.abs(Math.sin(k * Math.PI));
    const rad = r * (1 - depth + depth * Math.sqrt(s)) * (0.92 + 0.08 * lobe);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * aspect]);
  }
  return pts;
}

// a tile of grain for the washes to settle in, once
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const s = 192;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData?.(s, s);
  if (img?.data) {
    const noise = makeNoise(29);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const n = fbm(noise, x / 9, y / 9, { period: s / 9, octaves: 3 }) * 0.7 + fbm(noise, x / 2.2, y / 2.2, { period: s / 2.2, octaves: 2 }) * 0.3;
        const v = 200 + n * 55;
        const i = (y * s + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v * 0.97;
        img.data[i + 2] = v * 0.92;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }
  grainTile = c;
  return c;
}

export function brush(ctx, w, h, { seed = 1, ppm = 2400 } = {}) {
  const r = rand(seed);
  const m = (metres) => Math.max(0.6, metres * ppm);
  const trace = (shape) => {
    ctx.beginPath();
    traceShape(ctx, w, h, shape);
  };
  // a paint: a colour, or a gradient { v: [top, bottom] } { h: [left, right] }
  // { stops, from, to } { radial: [x, y, r], stops }, in the box
  const paintOf = (p) => {
    if (typeof p === 'string') return p;
    if (p.v || p.h) {
      const [a, b] = p.v ?? p.h;
      const g = p.v ? ctx.createLinearGradient(0, (p.y0 ?? 0) * h, 0, (p.y1 ?? 1) * h) : ctx.createLinearGradient((p.x0 ?? 0) * w, 0, (p.x1 ?? 1) * w, 0);
      g.addColorStop(0, a);
      if (p.mid) g.addColorStop(p.at ?? 0.5, p.mid);
      g.addColorStop(1, b);
      return g;
    }
    const g = p.radial ? ctx.createRadialGradient(p.radial[0] * w, p.radial[1] * h, 0, p.radial[0] * w, p.radial[1] * h, p.radial[2] * w) : ctx.createLinearGradient(p.from[0] * w, p.from[1] * h, p.to[0] * w, p.to[1] * h);
    for (const [t, c] of p.stops) g.addColorStop(t, c);
    return g;
  };
  const edgeOf = (p) => (typeof p === 'string' ? p : (p.v ?? p.h ?? p.stops.map((s) => s[1]))[1]);

  const b = {
    ctx,
    w,
    h,
    r,
    m,
    ppm,
    trace,
    fill(shape, paint, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      trace(shape);
      ctx.fillStyle = paintOf(paint);
      ctx.fill();
      ctx.restore();
      return b;
    },
    // inside a shape, then out again
    clip(shape, fn) {
      ctx.save();
      trace(shape);
      ctx.clip();
      fn(b);
      ctx.restore();
      return b;
    },
    // a watercolour wash: the paint, the grain it settles into, and the
    // darker rim where the water dried at its edge
    wash(shape, paint, { alpha = 1, grain: g = 0.35, edge = 0.45, rim = 0.0022, edgeColour = null } = {}) {
      ctx.save();
      trace(shape);
      ctx.clip();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = paintOf(paint);
      ctx.fillRect(0, 0, w, h);
      if (g > 0) {
        const pat = ctx.createPattern?.(grain(), 'repeat');
        if (pat) {
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = g;
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      if (edge > 0) {
        trace(shape);
        ctx.globalAlpha = edge;
        ctx.strokeStyle = edgeColour ?? shade(edgeOf(paint), 0.35);
        ctx.lineWidth = m(rim);
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = m(rim * 0.8);
        ctx.stroke();
      }
      ctx.restore();
      return b;
    },
    // light falling on a shape from a point: a soft lift toward a pale colour
    light(shape, x, y, rad, colour = '#fff4d8', alpha = 0.5) {
      return b.clip(shape, () => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = paintOf({ radial: [x, y, rad], stops: [[0, colour], [1, rgba(colour, 0)]] });
        ctx.fillRect(0, 0, w, h);
      });
    },
    // the shadow side of a shape: a wash darkening toward one way
    dark(shape, { from = [0.3, 0], to = [1, 0.4], colour = '#1c130b', alpha = 0.45 } = {}) {
      return b.clip(shape, () => {
        ctx.globalAlpha = 1;
        ctx.fillStyle = paintOf({ from, to, stops: [[0, rgba(colour, 0)], [1, rgba(colour, alpha)]] });
        ctx.fillRect(0, 0, w, h);
      });
    },
    // a nib round a shape: twice, the second a hair thinner and off the first
    ink(shape, { width = 0.0005, colour = INK, alpha = 0.85, closed = true, twice = true } = {}) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = colour;
      ctx.beginPath();
      if (typeof shape === 'function') shape(ctx, w, h);
      else tracePoints(ctx, w, h, shape, closed);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = m(width);
      ctx.stroke();
      if (twice) {
        ctx.translate(m(width * 0.6), m(width * 0.3));
        ctx.globalAlpha = alpha * 0.35;
        ctx.lineWidth = m(width * 0.55);
        ctx.stroke();
      }
      ctx.restore();
      return b;
    },
    // the ink round a figure’s outside only, whatever shapes it is made of:
    // the shape filled, worn away by `width` from every side, and the rim
    // that is left inked (the inner shapes’ edges stay unlined)
    silhouette(shape, { width = 0.00045, colour = INK, alpha = 0.85 } = {}) {
      const mask = makeCanvas(w, h);
      const mc = mask.getContext('2d');
      if (!mc?.drawImage) return b;
      mc.beginPath();
      traceShape(mc, w, h, shape);
      mc.fillStyle = '#000';
      mc.fill();
      const inner = makeCanvas(w, h);
      const ic = inner.getContext('2d');
      ic.drawImage(mask, 0, 0);
      ic.globalCompositeOperation = 'destination-in';
      const t = m(width);
      for (const [dx, dy] of [[t, 0], [-t, 0], [0, t], [0, -t], [t * 0.7, t * 0.7], [-t * 0.7, t * 0.7], [t * 0.7, -t * 0.7], [-t * 0.7, -t * 0.7]]) ic.drawImage(mask, dx, dy);
      mc.globalCompositeOperation = 'destination-out';
      mc.drawImage(inner, 0, 0);
      mc.globalCompositeOperation = 'source-in';
      mc.fillStyle = colour;
      mc.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
      return b;
    },
    line(points, opts = {}) {
      return b.ink(points, { ...opts, closed: false });
    },
    curve(points, opts = {}) {
      return b.ink(smooth(points, { closed: false }), opts);
    },
    // parallel strokes inside a shape, at `angle`, every `gap` metres; `fade(x, y)`
    // (0…1 in the box) thins them where it is low, so a hatch shades one side only
    hatch(shape, { angle = -0.9, gap = 0.0016, width = 0.00028, colour = INK, alpha = 0.5, fade = null, seg = 0.006, wobble = 0.15 } = {}) {
      ctx.save();
      trace(shape);
      ctx.clip();
      ctx.strokeStyle = colour;
      ctx.lineWidth = m(width);
      ctx.lineCap = 'round';
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const diag = Math.hypot(w, h);
      const step = m(gap);
      const run = m(seg);
      for (let o = -diag; o <= diag; o += step * (0.8 + r() * 0.4)) {
        // a line across the box through the point o along the normal
        const cx = w / 2 - dy * o;
        const cy = h / 2 + dx * o;
        if (!fade) {
          ctx.globalAlpha = alpha * (0.7 + r() * 0.3);
          ctx.beginPath();
          ctx.moveTo(cx - dx * diag, cy - dy * diag);
          ctx.lineTo(cx + dx * diag, cy + dy * diag);
          ctx.stroke();
          continue;
        }
        for (let s = -diag; s < diag; s += run) {
          const x0 = cx + dx * s;
          const y0 = cy + dy * s;
          if (x0 < -run || x0 > w + run || y0 < -run || y0 > h + run) continue;
          const f = fade(x0 / w, y0 / h);
          if (f <= 0.02 || r() > f + 0.15) continue;
          ctx.globalAlpha = alpha * Math.min(1, f);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 + dx * run * (1 - wobble * r()), y0 + dy * run * (1 - wobble * r()));
          ctx.stroke();
        }
      }
      ctx.restore();
      return b;
    },
    // dots inside a shape: stipple, stars, flowers
    stipple(shape, { n = 60, size = 0.0004, colour = INK, alpha = 0.7, box = [0, 0, 1, 1], where = null } = {}) {
      ctx.save();
      if (shape) {
        trace(shape);
        ctx.clip();
      }
      ctx.fillStyle = colour;
      for (let i = 0; i < n; i++) {
        const x = box[0] + (box[2] - box[0]) * r();
        const y = box[1] + (box[3] - box[1]) * r();
        if (where && r() > where(x, y)) continue;
        ctx.globalAlpha = alpha * (0.6 + r() * 0.4);
        ctx.beginPath();
        ctx.arc(x * w, y * h, m(size) * (0.6 + r() * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return b;
    },
    // a soft round light; its radius in metres
    glow(x, y, radius, colour, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = paintOf({ radial: [x, y, m(radius) / w], stops: [[0, colour], [0.35, rgba(colour, 0.45)], [1, rgba(colour, 0)]] });
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return b;
    },
    // a clump of leaves: lit from the upper left, dark under, a few scallops
    // of ink on its shadow side and its edge inked
    clump(cx, cy, rad, colour, { seed: s = 1, bumps = 8, ink = true, lit = 0.35, deep = 0.45, aspect = w / h } = {}) {
      const shape = blob(cx, cy, rad, { bumps, seed: s, aspect });
      b.wash(shape, { from: [cx - rad * 0.8, cy - rad * aspect], to: [cx + rad * 0.6, cy + rad * aspect], stops: [[0, tint(colour, lit)], [0.55, colour], [1, shade(colour, deep)]] }, { edge: 0.35, grain: 0.3 });
      if (ink) {
        // little cupped strokes, leaves seen edge on, on the shaded half
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineWidth = m(0.00028);
        ctx.lineCap = 'round';
        const rr = rand(s * 7 + 3);
        for (let i = 0; i < 9; i++) {
          const a = 0.2 + rr() * 2.2;
          const d = rad * (0.25 + rr() * 0.55);
          const x = cx + Math.cos(a) * d;
          const y = cy + Math.sin(a) * d * aspect;
          const s2 = rad * (0.12 + rr() * 0.1);
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.arc(x * w, y * h, s2 * w, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
        ctx.restore();
        b.ink(shape, { width: 0.0004, alpha: 0.7, twice: false });
      }
      return b;
    },
    // tufts of grass along a line of points
    grass(points, { n = 40, tall = 0.004, colour = '#3d5422', alpha = 0.8, width = 0.0003 } = {}) {
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineCap = 'round';
      ctx.lineWidth = m(width);
      for (let i = 0; i < n; i++) {
        const t = r() * (points.length - 1);
        const k = Math.floor(t);
        const f = t - k;
        const [ax, ay] = points[k];
        const [bx, by] = points[Math.min(points.length - 1, k + 1)];
        const x = (ax + (bx - ax) * f) * w;
        const y = (ay + (by - ay) * f) * h;
        ctx.globalAlpha = alpha * (0.6 + r() * 0.4);
        for (let j = 0; j < 3; j++) {
          const lean = (j - 1) * 0.5 + (r() - 0.5) * 0.4;
          const len = m(tall) * (0.6 + r() * 0.6);
          ctx.beginPath();
          ctx.moveTo(x + j * m(0.0004), y);
          ctx.quadraticCurveTo(x + j * m(0.0004) + lean * len * 0.3, y - len * 0.6, x + j * m(0.0004) + lean * len * 0.7, y - len);
          ctx.stroke();
        }
      }
      ctx.restore();
      return b;
    },
    text(str, x, y, { size = 0.05, font = 'Cinzel, Georgia, serif', weight = 600, colour = INK, align = 'left', alpha = 1, italic = false, max } = {}) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${italic ? 'italic ' : ''}${weight} ${Math.round(size * h)}px ${font}`;
      ctx.fillText(str, x * w, y * h, max ? max * w : undefined);
      ctx.restore();
      return b;
    },
  };
  return b;
}

// A cut-out: the art painted on card and cut round its outline with a thin
// margin of bare card, as scissors leave it, and nothing beyond. The art is
// { outline, draw(b), bare } in the card’s 0…1 box (`bare`: no card, only
// its marks); `ppm` is the card’s pixels a metre, for its brush.
export function cutout(px, ph, art, { ppm = 2400, seed = 3, margin = 0.0012, tone = CARD } = {}) {
  const c = makeCanvas(px, ph);
  const ctx = c.getContext('2d');
  const b = brush(ctx, px, ph, { seed, ppm });
  const outline = art.outline;
  // (a see-through card, snow or birds or lamps, is its marks alone)
  if (art.bare) {
    art.draw(b);
    return c;
  }
  if (margin > 0) {
    ctx.save();
    b.trace(outline);
    ctx.lineWidth = b.m(margin) * 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tone;
    ctx.stroke();
    ctx.fillStyle = tone;
    ctx.fill();
    // the cut edge, faintly browner
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, b.m(0.0003));
    ctx.strokeStyle = '#8a6a40';
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  b.trace(outline);
  ctx.clip();
  art.draw(b);
  ctx.restore();
  return c;
}
