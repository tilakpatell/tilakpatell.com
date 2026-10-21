// The Red Book’s paint box: parchment, ink and watercolour on a 2D canvas,
// in the manner of Tolkien’s own drawings for The Hobbit (the design’s
// §3.1). Every piece of a pop-up is a canvas painted with these: a shape is
// a path in a 0…1 box, washed (a few thin passes, darker where the water
// pooled at its edge), then inked. A cut-out keeps a margin of bare card
// round its shape, as scissors leave it, and is transparent outside that.
//
//   sheet(w, h, seed) → a canvas of parchment
//   card(w, h, draw, { margin, seed }) → a cut-out: draw(p) paints inside, p the pen
//   pen(ctx, w, h, seed): wash(path, colour, opts), ink(path, opts), dots, hatch,
//     text(str, x, y, opts), glow(x, y, r, colour), shape(fn) (a path from points)

import { makeCanvas, makeNoise, fbm } from '../../../lib/paint';

export const INK = '#2b2116';
export const PAPER = '#efe3c4';
export const CARD = '#f4ead2';

// the box the painters draw in is 0…1 each way, y down; a path is made of
// [x, y] points or a function of the context
const toPath = (ctx, w, h, shape) => {
  ctx.beginPath();
  if (typeof shape === 'function') {
    shape(ctx, w, h);
    return;
  }
  const [first, ...rest] = shape;
  ctx.moveTo(first[0] * w, first[1] * h);
  for (const [x, y] of rest) ctx.lineTo(x * w, y * h);
  ctx.closePath();
};

// a little random from a seed, so a piece paints the same each time
export function rand(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function pen(ctx, w, h, seed = 1) {
  const r = rand(seed);
  const p = {
    ctx,
    w,
    h,
    r,
    // a watercolour wash: thin passes a little apart, the edge darker
    wash(shape, colour, { alpha = 0.55, passes = 3, edge = 0.5, spread = 0.004 } = {}) {
      ctx.save();
      for (let i = 0; i < passes; i++) {
        ctx.save();
        ctx.translate((r() - 0.5) * spread * w, (r() - 0.5) * spread * h);
        toPath(ctx, w, h, shape);
        ctx.globalAlpha = alpha / passes + 0.08;
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.restore();
      }
      if (edge > 0) {
        toPath(ctx, w, h, shape);
        ctx.globalAlpha = edge * 0.35;
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1, w * 0.006);
        ctx.stroke();
      }
      ctx.restore();
      return p;
    },
    // a flat fill (for the darks, the Rider, the night)
    fill(shape, colour, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      toPath(ctx, w, h, shape);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.restore();
      return p;
    },
    // an ink line round a shape, a nib's width
    ink(shape, { width = 0.006, colour = INK, alpha = 0.9, open = false } = {}) {
      ctx.save();
      if (typeof shape === 'function') {
        ctx.beginPath();
        shape(ctx, w, h);
      } else {
        ctx.beginPath();
        shape.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
        if (!open) ctx.closePath();
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1, width * Math.min(w, h));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
      return p;
    },
    // a line of points, not closed
    line(points, opts = {}) {
      return p.ink(points, { ...opts, open: true });
    },
    // short strokes across a box, for grass, shadow or rain
    hatch(x0, y0, x1, y1, { n = 40, len = 0.03, angle = -1.2, width = 0.003, colour = INK, alpha = 0.5 } = {}) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1, width * w);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (x0 + (x1 - x0) * r()) * w;
        const y = (y0 + (y1 - y0) * r()) * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len * w, y + Math.sin(angle) * len * w);
      }
      ctx.stroke();
      ctx.restore();
      return p;
    },
    dots(points, { size = 0.008, colour = INK, alpha = 1 } = {}) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      for (const [x, y, s = 1] of points) {
        ctx.beginPath();
        ctx.arc(x * w, y * h, size * s * Math.min(w, h), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return p;
    },
    // a soft round light, for lamps, fire and the Eye
    glow(x, y, rad, colour, alpha = 1) {
      ctx.save();
      const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, rad * Math.min(w, h));
      g.addColorStop(0, colour);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return p;
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
      return p;
    },
  };
  return p;
}

// aged parchment: warm, blotched, darker toward its edges
export function sheet(w, h, seed = 7, { tone = PAPER, edge = 0.35 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, w, h);
  const noise = makeNoise(seed);
  // the blotches, as broad soft stains at a low resolution, scaled up
  const s = 48;
  const small = makeCanvas(s, Math.max(8, Math.round((s * h) / w)));
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(small.width, small.height);
  for (let y = 0; y < small.height; y++) {
    for (let x = 0; x < small.width; x++) {
      const n = fbm(noise, x / 12, y / 12, { octaves: 3 });
      const i = (y * small.width + x) * 4;
      img.data[i] = 150;
      img.data[i + 1] = 110;
      img.data[i + 2] = 60;
      img.data[i + 3] = Math.max(0, (n - 0.45) * 160);
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
  // the edges, browned by hands
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(120, 80, 30, 0)');
  g.addColorStop(1, `rgba(110, 70, 25, ${edge})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

// A cut-out: the shape painted on card, with a margin of bare card round it
// and nothing beyond. `outline` is the silhouette (a path in the 0…1 box)
// the scissors followed; draw(p) paints the picture inside it.
export function card(w, h, outline, draw, { margin = 0.018, seed = 3, tone = CARD } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  // the card's margin: the outline stroked fat in card colour, then filled
  ctx.save();
  toPath(ctx, w, h, outline);
  ctx.lineWidth = margin * 2 * Math.min(w, h);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = tone;
  ctx.stroke();
  ctx.fillStyle = tone;
  ctx.fill();
  // the cut edge's shadow, faintly
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = Math.max(1, 0.004 * w);
  ctx.strokeStyle = '#8a6e45';
  ctx.stroke();
  ctx.restore();
  // the picture, kept inside the margin
  ctx.save();
  toPath(ctx, w, h, outline);
  ctx.clip();
  const p = pen(ctx, w, h, seed);
  draw(p);
  ctx.restore();
  return c;
}

// a path from an ellipse, as points (for hills, doors, pools)
export function ellipse(cx, cy, rx, ry, { n = 32, from = 0, to = Math.PI * 2 } = {}) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

// a rolling ridge across the box from left to right, closed along the bottom
export function ridge(y, { amp = 0.1, bumps = 3, seed = 1, n = 28, bottom = 1 } = {}) {
  const r = rand(seed);
  const phase = r() * 6;
  const pts = [[0, bottom]];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const v = Math.sin(x * Math.PI * bumps + phase) * 0.5 + Math.sin(x * Math.PI * bumps * 2.3 + phase * 2) * 0.2;
    pts.push([x, y - amp * (0.5 + v * 0.6)]);
  }
  pts.push([1, bottom]);
  return pts;
}
