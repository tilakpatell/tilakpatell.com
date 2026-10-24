// Which names the chart shows, so it never turns to mush. Pure: no React, no
// DOM, no three.js, sizes in pixels.
//
// The names go down greedily, the highest priority first (a tie goes by id,
// so the same places thin the same way every time). Each takes the first of
// its sides that stays inside the frame and meets no name already down, no
// other place's dot and nothing hard (the ship, a button over the chart). One
// with no such side gets null: its dot alone, no name. A firm label (the
// picked place's) that no side fits for the dots takes the first that fits
// without the places' dots, so a pick in a crowd is still named: it may cover
// another place's dot, never the frame's edge, a name already down or
// anything hard. The ship is on the chart
// wherever it is, so a pick it blocks on every side goes unnamed.
//
// The galaxy's labelPlace.js is the model. It is not imported: worlds are
// islands, and the universe hides a name where the galaxy moves it. The nav
// map's names came from chartLabels.js, eight sides round a dot inside one
// fixed circle; this takes any frame's box or circle and its own sides, so
// the nav map and the mini-map thin their names the one way.
//
// SIDES: right, left and under the dot
// boxOf(side, { x, y, w, h }) → { x0, y0, x1, y1 }
// declutter(labels, { bounds, sides, dots, hard }) → Map of id → side or null
// firstInside(label, { bounds, sides, hard }) → where a name left off shows
//   over the rest, on a hover or a focus: the first side inside the frame and
//   clear of everything hard, else the first inside the frame, else null
//
// A label is { id, x, y, w, h, priority, firm? }: x and y its dot's middle, w and h
// its dot and name together, so a box's near end is the dot's far edge, 8 px
// past its middle (navmap.css's 16 px dot). bounds is the frame's box, or
// its circle { cx, cy, r } (the nav map's, which cuts off the rest), and a
// name's box keeps every corner inside it.
// dots are the { x, y } middles of the places' dots drawn, and hard the same
// for the marks no name may ever cover (the ship's): a name keeps off each
// one's 16 px box, but never off one within 8 px of its own point, which is
// its own dot or one drawn on top of it. A hard one may be a box instead,
// { x0, y0, x1, y1 } (a button over the chart): no name meets it, whatever
// is under it.

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

// the boxes a label must keep off: each dot's 16 px, not its own nor one drawn on it, and each box
const isBox = (d) => 'x0' in d;
const blocksFor = (l, points) => points.filter((d) => isBox(d) || !(Math.hypot(d.x - l.x, d.y - l.y) <= DOT)).map((d) => (isBox(d) ? d : { x0: d.x - DOT, y0: d.y - DOT, x1: d.x + DOT, y1: d.y + DOT }));

export function declutter(labels, { bounds, sides = SIDES, dots = [], hard = [] }) {
  const out = new Map(labels.map((l) => [l.id, null]));
  const kept = [];
  for (const l of [...labels].sort(byPriority)) {
    const hardBlocks = blocksFor(l, hard);
    const blocks = [...blocksFor(l, dots), ...hardBlocks];
    const fits = (side, off) => {
      const box = boxOf(side, l);
      return within(box, bounds) && !kept.some((k) => meet(box, k)) && !off.some((d) => meet(box, d));
    };
    const side = sides.find((s) => fits(s, blocks)) ?? (l.firm ? sides.find((s) => fits(s, hardBlocks)) : undefined);
    if (side === undefined) continue;
    kept.push(boxOf(side, l));
    out.set(l.id, side);
  }
  return out;
}

export function firstInside(label, { bounds, sides = SIDES, hard = [] }) {
  const inside = sides.filter((s) => within(boxOf(s, label), bounds));
  const blocks = blocksFor(label, hard);
  return inside.find((s) => !blocks.some((b) => meet(boxOf(s, label), b))) ?? inside[0] ?? null;
}
