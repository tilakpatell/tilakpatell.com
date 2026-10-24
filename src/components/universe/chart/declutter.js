// Which names the chart shows, so it never turns to mush. Pure: no React, no
// DOM, no three.js, sizes in pixels.
//
// The names go down greedily, the highest priority first (a tie goes by id,
// so the same places thin the same way every time). Each takes the first of
// its sides that stays inside the frame and meets no name already down and no
// other place's dot. One with no such side gets null: its dot alone, no name.
//
// The galaxy's labelPlace.js is the model. It is not imported: worlds are
// islands, and the universe hides a name where the galaxy moves it. The nav
// map's names today come from chartLabels.js, eight sides round a dot inside
// one fixed circle; this takes any frame's box or circle and its own sides, so
// the nav map and the mini-map thin their names the one way.
//
// SIDES: right, left and under the dot
// boxOf(side, { x, y, w, h }) → { x0, y0, x1, y1 }
// declutter(labels, { bounds, sides, dots }) → Map of id → side or null
//
// A label is { id, x, y, w, h, priority }: x and y its dot's middle, w and h
// its dot and name together, so a box's near end is the dot's far edge, 8 px
// past its middle (navmap.css's 16 px dot). bounds is the frame's box, or
// its circle { cx, cy, r } (the nav map's, which cuts off the rest), and a
// name's box keeps every corner inside it.
// dots are the { x, y } middles of the dots drawn: a name keeps off each
// one's 16 px box, but never off one within 8 px of its own point, which is
// its own dot or one drawn on top of it.

export const SIDES = Object.freeze(['right', 'left', 'under']);

const DOT = 8; // (half navmap.css's 16 px dot)

export function boxOf(side, { x, y, w, h }) {
  if (side === 'left') return { x0: x + DOT - w, y0: y - h / 2, x1: x + DOT, y1: y + h / 2 };
  if (side === 'under') return { x0: x - w / 2, y0: y - DOT, x1: x + w / 2, y1: y + DOT + h };
  return { x0: x - DOT, y0: y - h / 2, x1: x - DOT + w, y1: y + h / 2 };
}

const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// inside a box, or every corner inside a circle (a box with a NaN in it is
// inside nothing, so a place with no number gets no name)
const inCircle = (b, f) => [b.x0, b.x1].every((x) => [b.y0, b.y1].every((y) => Math.hypot(x - f.cx, y - f.cy) <= f.r));
const within = (b, f) => ('r' in f ? inCircle(b, f) : b.x0 >= f.x0 && b.y0 >= f.y0 && b.x1 <= f.x1 && b.y1 <= f.y1);
const rank = (l) => (typeof l.priority === 'number' && !Number.isNaN(l.priority) ? l.priority : -Infinity);
// highest first, and a tie (two kept places, both Infinity) by id
function byPriority(a, b) {
  const [pa, pb] = [rank(a), rank(b)];
  if (pa !== pb) return pa > pb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function declutter(labels, { bounds, sides = SIDES, dots = [] }) {
  const out = new Map(labels.map((l) => [l.id, null]));
  const kept = [];
  for (const l of [...labels].sort(byPriority)) {
    const blocks = dots.filter((d) => !(Math.hypot(d.x - l.x, d.y - l.y) <= DOT)).map((d) => ({ x0: d.x - DOT, y0: d.y - DOT, x1: d.x + DOT, y1: d.y + DOT }));
    for (const side of sides) {
      const box = boxOf(side, l);
      if (!within(box, bounds) || kept.some((k) => meet(box, k)) || blocks.some((d) => meet(box, d))) continue;
      kept.push(box);
      out.set(l.id, side);
      break;
    }
  }
  return out;
}
