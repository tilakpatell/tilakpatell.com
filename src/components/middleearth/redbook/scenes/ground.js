// What a spread’s ground is painted with: the land seen from above, as the
// base page of a pop-up is, in washes and ink (../paint.js), and the
// heading in the left page’s corner. The spread’s box is 0…1 each way, the
// gutter at x 0.5, the far edge at y 0, the reader’s edge at y 1.

import { INK, ellipse, rand } from '../paint';

export const GRASS = '#93a86a';
export const DUSK = '#5d6a7c';
export const NIGHT = '#33394a';

// a wash across the whole spread, a few blotches of a second colour over it
export function land(p, base, { blotch = null, seed = 1, n = 9 } = {}) {
  p.wash([[0, 0], [1, 0], [1, 1], [0, 1]], base, { alpha: 0.7, edge: 0 });
  if (!blotch) return;
  const r = rand(seed);
  for (let i = 0; i < n; i++) p.wash(ellipse(r(), r(), 0.06 + r() * 0.12, 0.05 + r() * 0.1, { n: 18 }), blotch, { alpha: 0.35, edge: 0.3 });
}

// a winding path or river: a band through the points
export function band(p, points, colour, { width = 0.03, alpha = 0.7, ink = true } = {}) {
  const { ctx, w, h } = p;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width * w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.stroke();
  ctx.restore();
  if (ink) {
    p.line(points.map(([x, y]) => [x, y - width * 0.7]), { width: 0.0025, alpha: 0.5 });
    p.line(points.map(([x, y]) => [x, y + width * 0.7]), { width: 0.0025, alpha: 0.5 });
  }
}

// the heading, in the left page’s top corner, as the scribe wrote it
export function heading(p, page, { colour = INK } = {}) {
  p.wash([[0.035, 0.04], [0.29, 0.04], [0.29, 0.165], [0.035, 0.165]], '#f3e8cc', { alpha: 0.85, edge: 0.2 });
  p.ink([[0.035, 0.04], [0.29, 0.04], [0.29, 0.165], [0.035, 0.165]], { width: 0.002, colour: '#7a2a18', alpha: 0.8 });
  p.text(page.title, 0.05, 0.1, { size: 0.042, colour, max: 0.23 });
  p.text(page.date, 0.05, 0.145, { size: 0.026, colour: '#7a2a18', font: 'Georgia, serif', italic: true, weight: 500 });
}

// the gutter’s shadow, where the pages bend into the spine
export function gutter(p) {
  const { ctx, w, h } = p;
  const g = ctx.createLinearGradient(0.44 * w, 0, 0.56 * w, 0);
  g.addColorStop(0, 'rgba(60, 40, 20, 0)');
  g.addColorStop(0.5, 'rgba(60, 40, 20, 0.35)');
  g.addColorStop(1, 'rgba(60, 40, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0.44 * w, 0, 0.12 * w, h);
}
