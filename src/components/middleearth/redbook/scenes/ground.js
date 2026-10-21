// What a spread’s ground is painted with (../brush.js): the page itself,
// aged parchment with a ruled border in red ink and the folio at its foot
// (the page’s title on the left, its date on the right), and the land the
// pop-up stands on, seen from above and running to the reader’s edge. The
// spread’s box is 0…1 each way, the gutter at x 0.5, the far edge at y 0,
// the reader’s edge at y 1.

import { INK, oval, rgba, shade, tint } from '../brush';

export const GRASS = '#8fa863';
export const NIGHT = '#2c3446';
export const RED = '#8a2a18';

const FRAME = { x: 0.03, y: 0.035, foot: 0.06 }; // the picture’s inset from the page’s edges
export const pageBox = (side) => (side < 0 ? [FRAME.x, FRAME.y, 0.5 - FRAME.x * 0.6, 1 - FRAME.foot] : [0.5 + FRAME.x * 0.6, FRAME.y, 1 - FRAME.x, 1 - FRAME.foot]);
const rect = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// the picture’s area on both pages, for a scene to paint its land inside
export const picture = (ctx, w, h) => {
  for (const s of [-1, 1]) {
    const [x0, y0, x1, y1] = pageBox(s);
    ctx.rect(x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h);
  }
};

// the bare page: parchment, browned at its edges, the gutter’s shadow
export function paper(b, { tone = '#efe2c2' } = {}) {
  b.wash([[0, 0], [1, 0], [1, 1], [0, 1]], { radial: [0.5, 0.5, 0.8], stops: [[0, tint(tone, 0.15)], [0.7, tone], [1, shade(tone, 0.2)]] }, { edge: 0, grain: 0.45 });
  for (const s of [-1, 1]) {
    const cx = s < 0 ? 0.25 : 0.75;
    b.fill(oval(cx, 0.5, 0.3, 0.62), { radial: [cx, 0.5, 0.32], stops: [[0.7, rgba('#7a5020', 0)], [1, rgba('#7a5020', 0.22)]] });
  }
}

// the land inside the picture: far to near in a gradient, blotched
export function land(b, { far = '#a8b878', near = '#6f8a42', blotch = '#5a7434', n = 22, seed = 1 } = {}) {
  b.clip(picture, () => {
    b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], { v: [far, near] });
    for (let i = 0; i < n; i++) {
      const x = b.r();
      const y = b.r();
      b.fill(oval(x, y, 0.03 + b.r() * 0.08, 0.02 + b.r() * 0.06), blotch, 0.18 + 0.12 * ((seed + i) % 3));
    }
  });
}

// the frame round each page’s picture and the folio under it
export function border(b, page, { colour = RED, ink = INK } = {}) {
  for (const s of [-1, 1]) {
    const box = pageBox(s);
    b.ink(rect(box), { width: 0.0008, colour, alpha: 0.85, twice: false });
    const [x0, y0, x1, y1] = box;
    const g = 0.006;
    b.ink(rect([x0 - g, y0 - g * 1.4, x1 + g, y1 + g * 1.4]), { width: 0.00035, colour, alpha: 0.7, twice: false });
    // a knot of ink at each corner
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) b.fill(oval(x, y, 0.004, 0.009), colour, 0.85);
  }
  if (!page) return;
  b.text(page.title, 0.25, 0.985, { size: 0.03, colour: ink, align: 'center', max: 0.4 });
  b.text(page.date ?? '', 0.75, 0.985, { size: 0.027, colour: RED, align: 'center', font: 'Georgia, serif', italic: true, weight: 500, max: 0.4 });
}

// the gutter’s shadow, where the pages bend into the spine
export function gutter(b) {
  const { ctx, w, h } = b;
  const g = ctx.createLinearGradient(0.44 * w, 0, 0.56 * w, 0);
  g.addColorStop(0, 'rgba(60, 40, 20, 0)');
  g.addColorStop(0.5, 'rgba(50, 30, 12, 0.45)');
  g.addColorStop(1, 'rgba(60, 40, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0.44 * w, 0, 0.12 * w, h);
}

// a whole ground: the page, the land, what the scene adds, the frame
export function ground(b, page, landOpts, extra = null) {
  paper(b);
  land(b, landOpts);
  if (extra) b.clip(picture, () => extra(b));
  border(b, page);
  gutter(b);
}
