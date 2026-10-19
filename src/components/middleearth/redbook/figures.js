// The figures the pop-ups are cut from: each { outline, draw(p) }, painted
// in the 0…1 box of its card (./paint.js) with its feet on the bottom edge,
// so a card stands on the page where the scene puts it. An outline is a
// function of the context: several shapes at once (a head, a body, a
// staff) cut as one.

import { ellipse, INK } from './paint';

const circle = (ctx, x, y, r) => {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
};
const poly = (ctx, w, h, pts) => {
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.closePath();
};

// A person standing, the box tall and narrow: a wizard (hat, beard,
// staff), a hobbit (bare head, curls, a waistcoat), a Ranger or a Rider
// (a hood), an Elf (long hair), a Dwarf (helm, beard, axe), a king (crown).
export function person({ kind = 'hobbit', robe = '#6b7f5a', skin = '#e8b98f', hair = '#5a3a1e', light = null } = {}) {
  const hood = kind === 'ranger' || kind === 'wraith';
  const head = kind === 'hobbit' ? 0.13 : 0.1;
  const hy = kind === 'wizard' ? 0.3 : kind === 'hobbit' ? 0.22 : 0.17;
  const body = (w, h) => [
    [0.5 - 0.1, hy + head * 0.9],
    [0.5 + 0.1, hy + head * 0.9],
    [0.5 + (kind === 'wizard' || hood ? 0.26 : 0.2), 0.97],
    [0.5 - (kind === 'wizard' || hood ? 0.26 : 0.2), 0.97],
  ].map(([x, y]) => [x * w, y * h]);
  const outline = (ctx, w, h) => {
    circle(ctx, 0.5 * w, hy * h, head * w);
    ctx.moveTo(...body(w, h)[0]);
    for (const pt of body(w, h).slice(1)) ctx.lineTo(...pt);
    ctx.closePath();
    if (kind === 'wizard') poly(ctx, w, h, [[0.24, hy - 0.02], [0.76, hy - 0.02], [0.56, 0.02], [0.5, 0.0]]);
    if (kind === 'wizard' || kind === 'elf') poly(ctx, w, h, [[0.8, 0.06], [0.86, 0.06], [0.86, 0.98], [0.8, 0.98]]);
    if (kind === 'dwarf') poly(ctx, w, h, [[0.12, 0.45], [0.2, 0.38], [0.24, 0.98], [0.18, 0.98]]);
    if (kind === 'king') poly(ctx, w, h, [[0.36, hy - 0.06], [0.64, hy - 0.06], [0.68, hy - 0.16], [0.58, hy - 0.1], [0.5, hy - 0.18], [0.42, hy - 0.1], [0.32, hy - 0.16]]);
    if (hood) poly(ctx, w, h, [[0.36, hy + 0.08], [0.5, hy - 0.16], [0.64, hy + 0.08]]);
  };
  const draw = (p) => {
    const { w, h } = p;
    const robeShape = (ctx) => {
      ctx.moveTo(...body(w, h)[0]);
      for (const pt of body(w, h).slice(1)) ctx.lineTo(...pt);
      ctx.closePath();
    };
    p.wash(robeShape, robe, { alpha: 0.85 });
    // folds in the robe
    p.hatch(0.36, hy + 0.2, 0.64, 0.95, { n: 14, len: 0.12, angle: 1.45, alpha: 0.25, width: 0.006 });
    const face = ellipse(0.5, hy, head, head * (w / h));
    if (kind === 'wraith') p.fill(face, '#0d0b0a');
    else p.wash(face, skin, { alpha: 0.9 });
    if (kind === 'hobbit') p.dots(ellipse(0.5, hy - head * 0.55 * (w / h), head * 0.8, head * 0.3 * (w / h), { n: 10 }), { size: 0.035, colour: hair });
    if (kind === 'wizard') {
      p.wash([[0.24, hy - 0.02], [0.76, hy - 0.02], [0.56, 0.02], [0.5, 0.0]], robe, { alpha: 0.9 });
      p.wash([[0.4, hy + 0.02], [0.6, hy + 0.02], [0.5, hy + 0.2]], '#d8d4cc', { alpha: 0.9 });
      p.wash([[0.8, 0.06], [0.86, 0.06], [0.86, 0.98], [0.8, 0.98]], '#6a4a2a', { alpha: 0.9 });
    }
    if (kind === 'elf') {
      p.wash([[0.38, hy - 0.04], [0.62, hy - 0.04], [0.66, hy + 0.3], [0.34, hy + 0.3]], hair, { alpha: 0.5 });
      p.wash([[0.8, 0.06], [0.86, 0.06], [0.86, 0.98], [0.8, 0.98]], '#cfc6a8', { alpha: 0.9 });
    }
    if (kind === 'dwarf') {
      p.wash([[0.38, hy + 0.02], [0.62, hy + 0.02], [0.56, hy + 0.32], [0.44, hy + 0.32]], '#8a4a24', { alpha: 0.9 });
      p.wash([[0.12, 0.45], [0.2, 0.38], [0.24, 0.98], [0.18, 0.98]], '#7a7a7a', { alpha: 0.9 });
    }
    if (kind === 'king') p.wash([[0.36, hy - 0.06], [0.64, hy - 0.06], [0.68, hy - 0.16], [0.58, hy - 0.1], [0.5, hy - 0.18], [0.42, hy - 0.1], [0.32, hy - 0.16]], '#c9a43a', { alpha: 0.95 });
    if (hood) {
      p.fill([[0.36, hy + 0.08], [0.5, hy - 0.16], [0.64, hy + 0.08]], robe);
      p.fill(ellipse(0.5, hy + 0.02, head * 0.7, head * 0.8 * (w / h)), '#0d0b0a', kind === 'wraith' ? 1 : 0.7);
    }
    if (light) p.glow(0.5, 0.55, 0.5, light, 0.6);
    p.ink(outline, { width: 0.012, alpha: 0.8 });
  };
  return { outline, draw };
}

// A Black Rider on his horse, side on, all black but the eye of the horse
export function rider({ colour = '#141210' } = {}) {
  const horse = [
    [0.08, 0.5], [0.2, 0.36], [0.3, 0.42], [0.68, 0.4], [0.78, 0.3], [0.86, 0.18], [0.95, 0.22], [0.92, 0.32], [0.84, 0.46],
    [0.82, 0.62], [0.84, 0.98], [0.78, 0.98], [0.74, 0.66], [0.62, 0.64], [0.58, 0.98], [0.52, 0.98], [0.5, 0.66], [0.36, 0.66],
    [0.32, 0.98], [0.26, 0.98], [0.26, 0.66], [0.18, 0.62], [0.16, 0.98], [0.1, 0.98], [0.1, 0.6], [0.04, 0.62],
  ];
  const man = [[0.42, 0.42], [0.46, 0.16], [0.52, 0.04], [0.58, 0.16], [0.62, 0.42], [0.66, 0.6], [0.4, 0.6]];
  const outline = (ctx, w, h) => {
    poly(ctx, w, h, horse);
    poly(ctx, w, h, man);
  };
  const draw = (p) => {
    p.fill(horse, colour);
    p.fill(man, colour);
    p.hatch(0.1, 0.4, 0.9, 0.9, { n: 30, len: 0.05, angle: 1.3, colour: '#4a4440', alpha: 0.5 });
    p.dots([[0.88, 0.25]], { size: 0.012, colour: '#c43a1a' });
  };
  return { outline, draw };
}

// A tree: a broad oak (the party tree), a mallorn (silver bark, gold
// leaves), a pine, or a dead one for the marshes
export function tree({ kind = 'oak', leaf = '#6f8a3c', seed = 1 } = {}) {
  const trunk = kind === 'mallorn' ? [[0.45, 0.98], [0.47, 0.35], [0.53, 0.35], [0.55, 0.98]] : [[0.43, 0.98], [0.46, 0.5], [0.54, 0.5], [0.57, 0.98]];
  const blobs =
    kind === 'pine'
      ? null
      : kind === 'dead'
        ? []
        : kind === 'mallorn'
          ? [[0.5, 0.22, 0.3, 0.13], [0.32, 0.36, 0.2, 0.1], [0.68, 0.34, 0.2, 0.1], [0.5, 0.08, 0.18, 0.08]]
          : [[0.5, 0.32, 0.4, 0.22], [0.26, 0.42, 0.22, 0.14], [0.74, 0.42, 0.22, 0.14], [0.5, 0.18, 0.26, 0.14]];
  const pine = [[0.5, 0.02], [0.82, 0.8], [0.18, 0.8]];
  const branches = [[0.5, 0.6, 0.2, 0.3], [0.5, 0.5, 0.8, 0.25], [0.48, 0.7, 0.15, 0.55], [0.52, 0.4, 0.62, 0.12]];
  const outline = (ctx, w, h) => {
    poly(ctx, w, h, trunk);
    if (kind === 'pine') poly(ctx, w, h, pine);
    for (const [x, y, rx, ry] of blobs ?? []) {
      ctx.moveTo((x + rx) * w, y * h);
      ctx.ellipse(x * w, y * h, rx * w, ry * h, 0, 0, Math.PI * 2);
    }
    if (kind === 'dead')
      for (const [x0, y0, x1, y1] of branches) {
        const dx = (y1 - y0) * 0.04;
        poly(ctx, w, h, [[x0 - 0.02, y0], [x1 - dx, y1], [x1 + 0.02, y1], [x0 + 0.02, y0 + 0.04]]);
      }
  };
  const draw = (p) => {
    p.wash(trunk, kind === 'mallorn' ? '#c9c6bc' : '#5b4128', { alpha: 0.9 });
    if (kind === 'pine') p.wash(pine, leaf, { alpha: 0.85 });
    for (const [x, y, rx, ry] of blobs ?? []) p.wash(ellipse(x, y, rx, ry), leaf, { alpha: 0.75 });
    if (kind === 'dead') for (const [x0, y0, x1, y1] of branches) p.line([[x0, y0], [x1, y1]], { width: 0.03, colour: '#3a3026' });
    if (kind !== 'dead') p.hatch(0.15, 0.1, 0.85, 0.55, { n: 50, len: 0.04, angle: 0.6 + seed, alpha: 0.25 });
    p.ink(outline, { width: 0.01, alpha: 0.7 });
  };
  return { outline, draw };
}

// A range of peaks, snow on them or not, for a card that stands behind
export function peaks({ tops = [[0.2, 0.3], [0.5, 0.05], [0.8, 0.25]], rock = '#7d7a86', snow = '#f4f2ee', dark = false } = {}) {
  const pts = [[0, 0.98], ...tops.flatMap(([x, y], i) => (i < tops.length - 1 ? [[x, y], [(x + tops[i + 1][0]) / 2, Math.max(y, tops[i + 1][1]) + 0.25]] : [[x, y]])), [1, 0.98]];
  const outline = pts;
  const draw = (p) => {
    p.wash(pts, rock, { alpha: dark ? 0.95 : 0.75 });
    if (!dark && snow) for (const [x, y] of tops) p.wash([[x, y], [x + 0.08, y + 0.14], [x + 0.02, y + 0.11], [x - 0.04, y + 0.15], [x - 0.08, y + 0.13]], snow, { alpha: 0.95 });
    p.hatch(0.05, 0.4, 0.95, 0.95, { n: 40, len: 0.08, angle: -2.1, alpha: 0.3 });
    p.ink(pts, { width: 0.008, alpha: 0.7 });
  };
  return { outline, draw };
}

// A tall tower with one lit window: Cirith Ungol, Orthanc, the White Tower
export function tower({ stone = '#8b8494', window = '#ffcf6a', dark = false, spikes = false } = {}) {
  const body = [[0.36, 0.98], [0.4, 0.2], [0.46, 0.1], [0.5, 0.0], [0.54, 0.1], [0.6, 0.2], [0.64, 0.98]];
  const horn = [[0.4, 0.2], [0.3, 0.02], [0.44, 0.14], [0.56, 0.14], [0.7, 0.02], [0.6, 0.2]];
  const outline = (ctx, w, h) => {
    poly(ctx, w, h, body);
    if (spikes) poly(ctx, w, h, horn);
  };
  const draw = (p) => {
    p.wash(body, stone, { alpha: dark ? 0.95 : 0.8 });
    if (spikes) p.wash(horn, stone, { alpha: 0.95 });
    p.hatch(0.38, 0.25, 0.62, 0.95, { n: 30, len: 0.04, angle: 0, alpha: 0.25 });
    p.glow(0.5, 0.26, 0.12, window, 0.9);
    p.fill([[0.48, 0.22], [0.52, 0.22], [0.52, 0.3], [0.48, 0.3]], window);
    p.ink(outline, { width: 0.01, alpha: 0.8 });
  };
  return { outline, draw };
}

// A flame, for a card that glows
export function flame({ colour = '#ffb347' } = {}) {
  const pts = [[0.5, 0.02], [0.66, 0.36], [0.8, 0.72], [0.62, 0.98], [0.38, 0.98], [0.2, 0.72], [0.34, 0.36]];
  return {
    outline: pts,
    draw: (p) => {
      p.wash(pts, colour, { alpha: 1 });
      p.wash([[0.5, 0.3], [0.6, 0.62], [0.56, 0.95], [0.44, 0.95], [0.4, 0.62]], '#fff1b8', { alpha: 1 });
    },
  };
}

// The Eye: lidless, a slit of black in fire
export function eye() {
  const lid = ellipse(0.5, 0.5, 0.46, 0.22, { n: 40 });
  return {
    outline: lid,
    draw: (p) => {
      p.glow(0.5, 0.5, 0.6, '#ff7a1a', 1);
      p.wash(lid, '#e0571a', { alpha: 1 });
      p.wash(ellipse(0.5, 0.5, 0.3, 0.16), '#ffb14a', { alpha: 1 });
      p.fill(ellipse(0.5, 0.5, 0.035, 0.2), '#120806');
      p.ink(lid, { width: 0.02, colour: '#5a1406', alpha: 0.8 });
    },
  };
}

// a bird in flight, two strokes of the brush: for a flock or the gulls
export function bird(ctx, x, y, s, colour = INK) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, s * 0.25);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y);
  ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y);
  ctx.stroke();
  ctx.restore();
}
