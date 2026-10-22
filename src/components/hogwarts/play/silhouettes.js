// The Patronus’s four shapes, one a house (rules/spells.js’s PATRONUS): a
// stag, a hare, an otter and a fox, each a silhouette of points side on
// (metres, facing +x, its feet on y = 0), the outline traced and the body
// filled a little, every leg’s points tagged with the hip it swings about.
// play/glow.js’s figure draws the points as cards and runs them. Pure.
//
//   SHAPES → { stag, hare, otter, fox }: { points: [{ x, y, z, leg }], hips: [{ x, y, phase, swing }], speed, bound }

import { seeded } from '../../../lib/seeded';

// the parts a shape is drawn from, each traced as points
function ellipse(out, r, { x, y, rx, ry, n = 40, fill = 0, z = 0, leg = -1, tilt = 0, deep = 0.75 }) {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  // (a body has a width: its points spread across it as much as it is
  // deep, rounder in the middle, so from behind it is a shape and not a line)
  const put = (u, v) => {
    const k = Math.sqrt(Math.max(0, 1 - (u / rx) ** 2));
    out.push({ x: x + u * c - v * s, y: y + u * s + v * c, z: z + (r() * 2 - 1) * ry * deep * k, leg });
  };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    put(Math.cos(a) * rx, Math.sin(a) * ry);
  }
  for (let i = 0; i < fill; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * 0.85;
    put(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
  }
}
function line(out, r, [x0, y0], [x1, y1], { n = 10, z = 0, leg = -1 } = {}) {
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    out.push({ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, z: z + (r() - 0.5) * 0.03, leg });
  }
}
// a leg, near (z +) or far (z −): hip to knee to hoof
function leg(out, r, hip, knee, foot, i, z) {
  line(out, r, hip, knee, { n: 8, z, leg: i });
  line(out, r, knee, foot, { n: 8, z, leg: i });
}

function stag() {
  const r = seeded(11);
  const p = [];
  ellipse(p, r, { x: 0, y: 1.2, rx: 0.68, ry: 0.3, n: 64, fill: 130 });
  line(p, r, [0.5, 1.32], [0.82, 1.78], { n: 12 });
  line(p, r, [0.38, 1.28], [0.7, 1.72], { n: 12 });
  ellipse(p, r, { x: 0.9, y: 1.82, rx: 0.17, ry: 0.09, n: 18, fill: 8, tilt: -0.35 });
  line(p, r, [1.02, 1.76], [1.1, 1.7], { n: 4 });
  // the antlers: a beam each side, three tines on it
  for (const z of [0.08, -0.08]) {
    line(p, r, [0.86, 1.9], [0.72, 2.35], { n: 10, z });
    line(p, r, [0.72, 2.35], [0.55, 2.6], { n: 6, z });
    line(p, r, [0.8, 2.1], [0.98, 2.28], { n: 5, z });
    line(p, r, [0.74, 2.3], [0.88, 2.52], { n: 5, z });
    line(p, r, [0.66, 2.45], [0.58, 2.66], { n: 4, z });
  }
  line(p, r, [-0.66, 1.3], [-0.78, 1.42], { n: 4 });
  const hips = [
    { x: 0.45, y: 1.02, phase: 0, swing: 0.55 },
    { x: 0.45, y: 1.02, phase: Math.PI * 0.25, swing: 0.55 },
    { x: -0.45, y: 1.05, phase: Math.PI, swing: 0.6 },
    { x: -0.45, y: 1.05, phase: Math.PI * 1.25, swing: 0.6 },
  ];
  leg(p, r, [0.45, 1.02], [0.5, 0.5], [0.46, 0], 0, 0.14);
  leg(p, r, [0.45, 1.02], [0.5, 0.5], [0.46, 0], 1, -0.14);
  leg(p, r, [-0.45, 1.05], [-0.58, 0.55], [-0.5, 0], 2, 0.14);
  leg(p, r, [-0.45, 1.05], [-0.58, 0.55], [-0.5, 0], 3, -0.14);
  return { points: p, hips, speed: 7, bound: 0.25 };
}

function hare() {
  const r = seeded(23);
  const p = [];
  ellipse(p, r, { x: 0, y: 0.34, rx: 0.32, ry: 0.19, n: 40, fill: 70, tilt: 0.15 });
  ellipse(p, r, { x: 0.36, y: 0.52, rx: 0.12, ry: 0.09, n: 18, fill: 6 });
  for (const [z, tip] of [
    [0.04, [0.26, 0.98]],
    [-0.04, [0.38, 0.95]],
  ])
    ellipse(p, r, { x: (0.32 + tip[0]) / 2, y: (0.6 + tip[1]) / 2, rx: 0.045, ry: 0.2, n: 14, z, tilt: Math.atan2(tip[0] - 0.32, tip[1] - 0.6) * -1 });
  ellipse(p, r, { x: -0.33, y: 0.4, rx: 0.06, ry: 0.06, n: 8, fill: 4 });
  const hips = [
    { x: 0.2, y: 0.25, phase: 0, swing: 0.6 },
    { x: 0.2, y: 0.25, phase: 0.3, swing: 0.6 },
    { x: -0.18, y: 0.28, phase: Math.PI, swing: 0.8 },
    { x: -0.18, y: 0.28, phase: Math.PI + 0.3, swing: 0.8 },
  ];
  leg(p, r, [0.2, 0.25], [0.24, 0.12], [0.26, 0], 0, 0.08);
  leg(p, r, [0.2, 0.25], [0.24, 0.12], [0.26, 0], 1, -0.08);
  leg(p, r, [-0.18, 0.28], [-0.36, 0.14], [-0.22, 0], 2, 0.1);
  leg(p, r, [-0.18, 0.28], [-0.36, 0.14], [-0.22, 0], 3, -0.1);
  return { points: p, hips, speed: 8, bound: 0.35 };
}

function otter() {
  const r = seeded(37);
  const p = [];
  ellipse(p, r, { x: 0, y: 0.26, rx: 0.5, ry: 0.13, n: 52, fill: 70 });
  ellipse(p, r, { x: 0.56, y: 0.33, rx: 0.13, ry: 0.09, n: 18, fill: 6 });
  line(p, r, [-0.48, 0.24], [-0.95, 0.12], { n: 14 });
  line(p, r, [-0.48, 0.3], [-0.95, 0.14], { n: 12 });
  const hips = [
    { x: 0.3, y: 0.18, phase: 0, swing: 0.7 },
    { x: 0.3, y: 0.18, phase: Math.PI, swing: 0.7 },
    { x: -0.3, y: 0.18, phase: Math.PI * 0.5, swing: 0.7 },
    { x: -0.3, y: 0.18, phase: Math.PI * 1.5, swing: 0.7 },
  ];
  leg(p, r, [0.3, 0.18], [0.34, 0.08], [0.36, 0], 0, 0.1);
  leg(p, r, [0.3, 0.18], [0.34, 0.08], [0.36, 0], 1, -0.1);
  leg(p, r, [-0.3, 0.18], [-0.32, 0.08], [-0.3, 0], 2, 0.1);
  leg(p, r, [-0.3, 0.18], [-0.32, 0.08], [-0.3, 0], 3, -0.1);
  return { points: p, hips, speed: 6, bound: 0.15 };
}

function fox() {
  const r = seeded(51);
  const p = [];
  ellipse(p, r, { x: 0, y: 0.46, rx: 0.4, ry: 0.16, n: 44, fill: 70 });
  ellipse(p, r, { x: 0.5, y: 0.62, rx: 0.13, ry: 0.1, n: 18, fill: 6 });
  line(p, r, [0.6, 0.6], [0.74, 0.56], { n: 5 });
  for (const z of [0.05, -0.05]) {
    line(p, r, [0.45, 0.7], [0.48, 0.84], { n: 5, z });
    line(p, r, [0.48, 0.84], [0.55, 0.71], { n: 5, z });
  }
  ellipse(p, r, { x: -0.62, y: 0.5, rx: 0.3, ry: 0.1, n: 26, fill: 18, tilt: 0.25 });
  const hips = [
    { x: 0.28, y: 0.36, phase: 0, swing: 0.55 },
    { x: 0.28, y: 0.36, phase: Math.PI, swing: 0.55 },
    { x: -0.28, y: 0.38, phase: Math.PI * 0.5, swing: 0.6 },
    { x: -0.28, y: 0.38, phase: Math.PI * 1.5, swing: 0.6 },
  ];
  leg(p, r, [0.28, 0.36], [0.3, 0.17], [0.3, 0], 0, 0.1);
  leg(p, r, [0.28, 0.36], [0.3, 0.17], [0.3, 0], 1, -0.1);
  leg(p, r, [-0.28, 0.38], [-0.36, 0.2], [-0.3, 0], 2, 0.1);
  leg(p, r, [-0.28, 0.38], [-0.36, 0.2], [-0.3, 0], 3, -0.1);
  return { points: p, hips, speed: 7.5, bound: 0.2 };
}

export const SHAPES = { stag: stag(), hare: hare(), otter: otter(), fox: fox() };
