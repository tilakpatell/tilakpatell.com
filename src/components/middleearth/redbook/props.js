// The land and what stands on it, for the pop-ups’ painted flats: trees,
// hills, mountains, skies, water, smoke and lit windows, each painted with
// ./brush.js straight onto a card’s brush `b` where the scene puts it. A
// place is in the card’s 0…1 box (y down); a height is in the box’s heights,
// and a width is turned to the box’s widths here (`wx`), so a tree is round
// on a wide card and a tall one alike.
//
//   oak, pine, mallorn, deadTree, hedge, sky, moon, stars, clouds, range,
//   water, ripples, smoke, lit (a window), fire, path

import { CARD, INK, blob, circle, many, mixc, oval, rgba, rough, shade, smooth, tint, top } from './brush';

const wx = (b, v) => (v * b.h) / b.w;

// an oak’s shapes for a card w × h: its trunk and the clumps of its crown
function oakGeom(d, x, y, H, seed = 1) {
  const t = H * 0.38;
  const tw = wx(d, H * 0.07);
  const trunk = smooth([[x - tw, y], [x - tw * 0.55, y - t * 0.5], [x - tw * 0.4, y - t], [x + tw * 0.4, y - t], [x + tw * 0.55, y - t * 0.5], [x + tw, y], [x + tw * 1.6, y + 0.004], [x - tw * 1.6, y + 0.004]]);
  const R = H * 0.3;
  const cy = y - H + R * 1.05;
  const spots = [[-0.55, 0.35, 0.62], [0.55, 0.38, 0.6], [-0.2, 0.55, 0.62], [0.25, 0.6, 0.58], [0, 0.0, 0.75], [-0.5, -0.1, 0.6], [0.5, -0.05, 0.62], [-0.15, -0.5, 0.55], [0.25, -0.45, 0.55]].sort((p, q) => q[1] - p[1]);
  const clumps = spots.map(([dx, dy, s], i) => ({ cx: x + wx(d, dx * R), cy: cy + dy * R, r: wx(d, s * R), dy, seed: seed * 13 + i }));
  return { trunk, clumps, t, tw };
}
const clumpShape = (d, c) => blob(c.cx, c.cy, c.r, { bumps: 8, seed: c.seed, aspect: d.w / d.h });

// an oak’s outline, for a card to be cut round it
export const oakOutline = (x, y, H, { seed = 1 } = {}) => (ctx, w, h) => {
  const g = oakGeom({ w, h }, x, y, H, seed);
  many(g.trunk, ...g.clumps.map((c) => clumpShape({ w, h }, c)))(ctx, w, h);
};

// an oak: a short thick trunk, two boughs, a round crown of clumps
export function oak(b, x, y, H, { leaf = '#5f7f34', seed = 1, bark = '#5b4128', light = 0.35 } = {}) {
  const g = oakGeom(b, x, y, H, seed);
  b.wash(g.trunk, { h: [tint(bark, 0.2), shade(bark, 0.45)], x0: x - g.tw, x1: x + g.tw }, { edge: 0.4 });
  b.line([[x - g.tw * 0.2, y - g.t * 0.9], [x - wx(b, H * 0.16), y - g.t * 1.5]], { width: 0.0009, colour: shade(bark, 0.3) });
  b.line([[x + g.tw * 0.2, y - g.t * 0.9], [x + wx(b, H * 0.15), y - g.t * 1.45]], { width: 0.0009, colour: shade(bark, 0.3) });
  for (const c of g.clumps) b.clump(c.cx, c.cy, c.r, mixc(leaf, '#2f4a1a', c.dy > 0.3 ? 0.25 : 0), { seed: c.seed, lit: light });
}

// a whole tree as a card’s art, its foot on the card’s foot
export function treeArt(kind = 'oak', opts = {}) {
  const aspect = kind === 'pine' ? 0.5 : kind === 'mallorn' ? 0.62 : kind === 'dead' ? 0.8 : 0.95;
  if (kind === 'oak') return { aspect, outline: oakOutline(0.5, 0.995, 0.99, opts), draw: (b) => oak(b, 0.5, 0.995, 0.99, opts) };
  const outline = (ctx, w, h) => {
    if (kind === 'pine') pineOutline(0.5, 0.995, 0.99, opts)(ctx, w, h);
    else if (kind === 'mallorn') mallornOutline(0.5, 0.995, 0.99)(ctx, w, h);
    else oval(0.5, 0.5, 0.5, 0.5)(ctx, w, h);
  };
  const draw = (b) => (kind === 'pine' ? pine(b, 0.5, 0.995, 0.99, opts) : kind === 'mallorn' ? mallorn(b, 0.5, 0.995, 0.99, opts) : deadTree(b, 0.5, 0.995, 0.99, opts));
  return { aspect, outline, draw };
}

// a pine’s tiers for a card w × h, top last
function pineGeom(d, x, y, H, seed = 1, tiers = 5) {
  const W = wx(d, H * 0.56);
  return Array.from({ length: tiers }, (_, i) => {
    const k = i / (tiers - 1);
    const ty = y - H * (0.15 + k * 0.85);
    const hw = W * (1 - k * 0.72) * 0.5;
    const th = H * 0.32;
    const pts = rough([[x - hw, ty + th * 0.35], [x - hw * 0.5, ty + th * 0.2], [x, ty - th * 0.45], [x + hw * 0.5, ty + th * 0.2], [x + hw, ty + th * 0.35], [x, ty + th * 0.25]], 0.004, seed + i, { n: 3, closed: true });
    return { pts, ty, hw, th };
  });
}
export const pineOutline = (x, y, H, { seed = 1, tiers = 5 } = {}) => (ctx, w, h) => {
  const d = { w, h };
  many([[x - wx(d, H * 0.02), y], [x - wx(d, H * 0.015), y - H * 0.3], [x + wx(d, H * 0.015), y - H * 0.3], [x + wx(d, H * 0.02), y]], ...pineGeom(d, x, y, H, seed, tiers).map((t) => smooth(t.pts)))(ctx, w, h);
};

// a pine or fir: tiers that droop, darkest under
export function pine(b, x, y, H, { leaf = '#2f4a32', seed = 1, snow = false, tiers = 5 } = {}) {
  b.fill([[x - wx(b, H * 0.02), y], [x - wx(b, H * 0.015), y - H * 0.3], [x + wx(b, H * 0.015), y - H * 0.3], [x + wx(b, H * 0.02), y]], '#3a2a1c');
  for (const { pts, ty, hw, th } of pineGeom(b, x, y, H, seed, tiers)) {
    b.wash(smooth(pts), { h: [tint(leaf, 0.2), shade(leaf, 0.45)], x0: x - hw, x1: x + hw }, { edge: 0.45 });
    if (snow) b.fill(smooth([[x - hw * 0.5, ty + th * 0.08], [x, ty - th * 0.42], [x + hw * 0.3, ty + th * 0.02], [x, ty + th * 0.05]]), '#f4f6fa', 0.9);
    b.ink(smooth(pts), { width: 0.0003, alpha: 0.5, twice: false });
  }
}

// a mallorn’s trunk and crowns for a card w × h
function mallornGeom(d, x, y, H, seed = 1) {
  const tw = wx(d, H * 0.035);
  const trunk = smooth([[x - tw * 1.6, y], [x - tw, y - H * 0.5], [x - tw * 0.6, y - H * 0.85], [x + tw * 0.6, y - H * 0.85], [x + tw, y - H * 0.5], [x + tw * 1.6, y]]);
  const R = H * 0.13;
  const clumps = [[-0.2, 0.62], [0.2, 0.66], [-0.1, 0.78], [0.12, 0.82], [0, 0.94], [-0.25, 0.8], [0.27, 0.84]].map(([dx, dy], i) => ({ cx: x + wx(d, dx * H), cy: y - H * dy, r: wx(d, R * (1.15 - i * 0.04)), seed: seed * 7 + i }));
  return { tw, trunk, clumps };
}
export const mallornOutline = (x, y, H, { seed = 1 } = {}) => (ctx, w, h) => {
  const g = mallornGeom({ w, h }, x, y, H, seed);
  many(g.trunk, ...g.clumps.map((c) => clumpShape({ w, h }, c)))(ctx, w, h);
};

// a mallorn: a tall silver trunk, branches high, crowns of gold, and the
// lamps of the flets among them
export function mallorn(b, x, y, H, { leaf = '#d8b54a', seed = 1, lamps = true } = {}) {
  const g = mallornGeom(b, x, y, H, seed);
  b.wash(g.trunk, { h: ['#f2f0ea', '#8a8a86'], x0: x - g.tw, x1: x + g.tw }, { edge: 0.3 });
  b.hatch(g.trunk, { angle: 0.1, gap: 0.002, alpha: 0.25 });
  for (const [dy, dx] of [[0.55, -0.22], [0.62, 0.2], [0.75, -0.14], [0.8, 0.16]]) b.line([[x, y - H * dy], [x + wx(b, H * dx), y - H * (dy + 0.1)]], { width: 0.0008, colour: '#a8a6a0' });
  for (const c of g.clumps) b.clump(c.cx, c.cy, c.r, leaf, { seed: c.seed, lit: 0.45, deep: 0.35 });
  if (lamps) for (const [dx, dy] of [[-0.12, 0.6], [0.14, 0.64], [0.02, 0.76]]) b.glow(x + wx(b, dx * H), y - H * dy, 0.004, '#eef4ff', 1);
}

// a dead tree: a twisted trunk, bare branches, forked
// (`margin`: a band of bare card drawn under the limbs first, for a dead
// tree on a card of its own)
export function deadTree(b, x, y, H, { bark = '#3a3026', seed = 3, margin = 0 } = {}) {
  const limb = (x0, y0, a, len, w, d, pass) => {
    const x1 = x0 + wx(b, Math.cos(a) * len);
    const y1 = y0 - Math.sin(a) * len;
    const pts = [[x0, y0], [(x0 + x1) / 2 + wx(b, Math.sin(a * 3 + seed) * len * 0.08), (y0 + y1) / 2], [x1, y1]];
    if (pass) b.line(pts, { width: w + margin * 2, colour: CARD, alpha: 1, twice: false });
    else b.line(pts, { width: w, colour: bark, alpha: 0.95 });
    if (d <= 0) return;
    limb(x1, y1, a + 0.45 + Math.sin(seed + d) * 0.15, len * 0.68, w * 0.62, d - 1, pass);
    limb(x1, y1, a - 0.5 + Math.cos(seed * 2 + d) * 0.15, len * 0.62, w * 0.6, d - 1, pass);
  };
  if (margin) limb(x, y, Math.PI / 2 + 0.06, H * 0.45, 0.004, 4, true);
  limb(x, y, Math.PI / 2 + 0.06, H * 0.45, 0.004, 4, false);
}

// a hedge or a bank of bushes along the foot of a card
export function hedge(b, x0, x1, y, H, { leaf = '#4f6e2c', seed = 5, n = null } = {}) {
  const count = n ?? Math.max(3, Math.round(((x1 - x0) * b.w) / (H * b.h * 0.9)));
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / count;
    b.clump(x, y - H * 0.45, wx(b, H * 0.6), leaf, { seed: seed + i, lit: 0.3 });
  }
}

// a sky, top to bottom, on the whole card or a shape
export function sky(b, shape, { top: t = '#1c2a4a', bottom = '#5a6a88', mid = null } = {}) {
  b.wash(shape, { v: [t, bottom], mid, at: 0.6 }, { edge: 0, grain: 0.22 });
}

export function moon(b, x, y, r, { colour = '#f4f0dc', halo = '#c8d4f0' } = {}) {
  b.glow(x, y, r * b.w * 4 / b.ppm, halo, 0.55);
  b.wash(circle(x, y, r), { radial: [x - r * 0.3, y - r * 0.3 * (b.w / b.h), r * 1.4], stops: [[0, '#ffffff'], [1, colour]] }, { edge: 0.3, grain: 0.2 });
  b.fill(circle(x + r * 0.25, y + r * 0.1 * (b.w / b.h), r * 0.18), shade(colour, 0.12), 0.5);
}

export function stars(b, { n = 60, box = [0, 0, 1, 0.5], colour = '#f6f2dc' } = {}) {
  b.stipple(null, { n, size: 0.00035, colour, alpha: 0.9, box });
}

// soft bands of cloud, each with a line of ink under it
export function clouds(b, list, { colour = '#d8dce6', ink = true } = {}) {
  for (const [x, y, s, seed = 1] of list) {
    const pts = blob(x, y, wx(b, s), { bumps: 6, depth: 0.25, seed, aspect: (b.w / b.h) * 0.45 });
    b.wash(pts, { v: [tint(colour, 0.3), shade(colour, 0.2)], y0: y - s * 0.4, y1: y + s * 0.4 }, { alpha: 0.85, edge: 0.2, grain: 0.15 });
    if (ink) b.curve([[x - wx(b, s * 0.8), y + s * 0.2], [x, y + s * 0.3], [x + wx(b, s * 0.8), y + s * 0.18]], { width: 0.00035, alpha: 0.35, twice: false });
  }
}

// a range’s skyline for a card w × h: peaks and the valleys between them
function rangeGeom(d, tops, foot, seed) {
  const pts = [[tops[0][0] - 0.2, foot]];
  for (let i = 0; i < tops.length; i++) {
    pts.push(tops[i]);
    if (i < tops.length - 1) {
      const [ax, ay] = tops[i];
      const [bx, by] = tops[i + 1];
      pts.push([(ax + bx) / 2, Math.max(ay, by) + Math.abs(bx - ax) * 0.55 * (d.w / d.h)]);
    }
  }
  pts.push([tops.at(-1)[0] + 0.2, foot]);
  const torn = rough(pts, 0.006, seed, { n: 5 });
  return { torn, shape: torn.concat([[tops.at(-1)[0] + 0.2, foot + 0.01], [tops[0][0] - 0.2, foot + 0.01]]) };
}
export const rangeOutline =
  (tops, { foot = 1, seed = 2 } = {}) =>
  (ctx, w, h) =>
    many(rangeGeom({ w, h }, tops, foot, seed).shape)(ctx, w, h);

// A range of mountains: each peak lit on its left face, in shadow on its
// right, snow on its head; `tops` [[x, y], …] in the box, the foot at `foot`
export function range(b, tops, { rock = '#7d7a86', snow = '#f4f2ee', foot = 1, seed = 2, haze = null, snowLine = 0.16 } = {}) {
  const { torn, shape } = rangeGeom(b, tops, foot, seed);
  b.wash(shape, { v: [tint(rock, 0.1), shade(rock, 0.25)], y0: Math.min(...tops.map((t) => t[1])), y1: foot }, { edge: 0.5 });
  // each peak’s shadowed face: from the summit down and to the right
  for (let i = 0; i < tops.length; i++) {
    const [x, y] = tops[i];
    const next = tops[i + 1] ?? [x + 0.2, foot];
    const dropX = x + (next[0] - x) * 0.18;
    const face = rough([[x, y], [dropX, (y + foot) / 2], [x + (next[0] - x) * 0.1, foot], [next[0] - (next[0] - x) * 0.25, foot], [(x + next[0]) / 2, Math.max(y, next[1]) + Math.abs(next[0] - x) * 0.55 * (b.w / b.h)]], 0.005, seed + i * 3, { n: 3, closed: true });
    b.fill(face, shade(rock, 0.5), 0.45);
    b.hatch(face, { angle: -1.1, gap: 0.0014, alpha: 0.35 });
    if (snow) {
      const s = snowLine * (b.w / b.h) * Math.abs(next[0] - x) * 2;
      const cap = rough([[x - s * 0.55, y + s], [x, y], [x + s * 0.5, y + s * 0.9], [x + s * 0.2, y + s * 0.7], [x, y + s * 1.05], [x - s * 0.25, y + s * 0.75]], 0.004, seed + i, { n: 2, closed: true });
      b.wash(cap, { h: ['#ffffff', shade(snow, 0.15)], x0: x - s * 0.5, x1: x + s * 0.5 }, { edge: 0.3, grain: 0.15 });
    }
  }
  if (haze) b.fill(shape, { v: [rgba(haze, 0), rgba(haze, 0.55)], y0: Math.min(...tops.map((t) => t[1])), y1: foot });
  b.ink(torn, { width: 0.00045, alpha: 0.75, closed: false, twice: false });
  return shape;
}

// water in a shape: deep below, the sky’s light on top, and ripples
export function water(b, shape, { deep = '#2a4a5e', light = '#8fb4c8', y0 = 0, y1 = 1, n = 40 } = {}) {
  b.wash(shape, { v: [light, deep], y0, y1 }, { edge: 0.3, grain: 0.2 });
  ripples(b, shape, { y0, y1, n, colour: tint(light, 0.4) });
}

export function ripples(b, shape, { y0 = 0, y1 = 1, n = 40, colour = '#d8eaf4', alpha = 0.7 } = {}) {
  b.clip(shape, () => {
    for (let i = 0; i < n; i++) {
      const y = y0 + (y1 - y0) * b.r();
      const x = b.r();
      const len = 0.02 + b.r() * 0.05;
      b.line([[x, y], [x + len * 0.5, y - 0.002], [x + len, y]], { width: 0.0003, colour: i % 3 ? colour : INK, alpha: i % 3 ? alpha : 0.3, twice: false });
    }
  });
}

// smoke curling up from a chimney, a few soft puffs drifting to one side
export function smoke(b, x, y, H, { colour = '#c8c4bc', drift = 0.6 } = {}) {
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    const px = x + wx(b, Math.sin(k * 3) * H * 0.12 + k * H * 0.25 * drift);
    const py = y - k * H;
    b.fill(blob(px, py, wx(b, H * (0.05 + k * 0.08)), { bumps: 5, depth: 0.2, seed: i + 3, aspect: b.w / b.h }), colour, 0.55 - k * 0.35);
  }
}

// a lit window: the glow round it, the warm pane, its glazing bars
export function lit(b, shape, { colour = '#ffd27a', glow = '#ffb84a', bars = true, x, y, r = 0.008 } = {}) {
  if (x != null) b.glow(x, y, r, glow, 0.7);
  b.fill(shape, { v: [tint(colour, 0.4), colour] });
  if (bars && x != null) {
    b.clip(shape, () => {
      b.line([[x, 0], [x, 1]], { width: 0.0003, alpha: 0.7, twice: false });
      b.line([[0, y], [1, y]], { width: 0.0003, alpha: 0.7, twice: false });
    });
  }
  b.ink(shape, { width: 0.0004, alpha: 0.8, twice: false });
}

// a fire: tongues of flame, hot white at the heart
export function fire(b, x, y, H) {
  const W = wx(b, H * 0.6);
  b.glow(x, y - H * 0.4, H * b.h * 1.2 / b.ppm, '#ff9a3a', 0.8);
  const tongue = (dx, s, c) => b.fill(smooth([[x + dx - W * 0.4 * s, y], [x + dx - W * 0.25 * s, y - H * 0.45 * s], [x + dx + W * 0.05, y - H * s], [x + dx + W * 0.25 * s, y - H * 0.4 * s], [x + dx + W * 0.4 * s, y]]), c);
  tongue(-W * 0.25, 0.7, '#e2531a');
  tongue(W * 0.25, 0.75, '#e2531a');
  tongue(0, 1, '#ff9a2a');
  tongue(0, 0.6, '#ffe08a');
}

// a winding path or river on the ground: a band through the points
export function path(b, points, colour, { width = 0.03, alpha = 0.85, ink = true } = {}) {
  const { ctx, w, h } = b;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width * w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  smooth(points, { closed: false })(ctx, w, h);
  ctx.stroke();
  ctx.restore();
  if (ink) {
    const off = (s) => points.map(([x, y]) => [x, y + width * 0.5 * s * (w / h)]);
    b.curve(off(-1), { width: 0.0003, alpha: 0.45, twice: false });
    b.curve(off(1), { width: 0.0003, alpha: 0.45, twice: false });
  }
}

export { many, oval, circle, top };
