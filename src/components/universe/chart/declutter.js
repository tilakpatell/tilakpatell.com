// Chart label declutter: which of a place's names get to stay on the chart.
// Modelled on the galaxy's labelPlace.js, which moves a name aside until it
// stops overlapping. It is not imported, because worlds are islands, and the
// universe differs: where the galaxy moves a name, the chart hides it and
// leaves the dot alone. Pure, no imports.
//
// SIDES = ['right', 'left', 'under']   the navmap.css `data-side` values
// boxOf(side, { x, y, w, h }) → { x0, y0, x1, y1 }   a name's box in px
// declutter(labels, { bounds, sides, dots }) → Map<id, side | null>
//
// Greedy, highest priority first, ties by id so the result is the same
// whatever order the labels arrive in. Priority may be Infinity. Each label
// takes the first side whose box lies inside bounds and meets no kept name and
// no dot; if none does it gets null (dot only). Every label has an entry.
// Boxes that only touch edge to edge do not meet. Bounds are a box
// { x0, y0, x1, y1 } or, for a round chart, a circle { cx, cy, r }: a name's
// box is inside it when all four corners are.

export const SIDES = ['right', 'left', 'under'];

// Half the dot's 16 px box. A dot this close to a label's own point is its own
// dot (or one drawn on top of it), so it never blocks that label.
const DOT = 8;

// These mirror navmap.css's translates for each data-side.
export function boxOf(side, { x, y, w, h }) {
  if (side === 'left') return { x0: x + DOT - w, y0: y - h / 2, x1: x + DOT, y1: y + h / 2 };
  if (side === 'under') return { x0: x - w / 2, y0: y - DOT, x1: x + w / 2, y1: y + DOT + h };
  return { x0: x - DOT, y0: y - h / 2, x1: x - DOT + w, y1: y + h / 2 };
}

const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function inside(b, bounds) {
  if (bounds.r === undefined) return b.x0 >= bounds.x0 && b.y0 >= bounds.y0 && b.x1 <= bounds.x1 && b.y1 <= bounds.y1;
  const corner = (x, y) => Math.hypot(x - bounds.cx, y - bounds.cy) <= bounds.r;
  return corner(b.x0, b.y0) && corner(b.x1, b.y0) && corner(b.x0, b.y1) && corner(b.x1, b.y1);
}

// Highest first. Compared, never subtracted: Infinity - Infinity is NaN.
function byPriority(a, b) {
  if (a.priority !== b.priority) return a.priority > b.priority ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function declutter(labels, { bounds, sides = SIDES, dots = [] }) {
  const result = new Map();
  const kept = [];
  const dotBoxes = dots.map((d) => ({ x: d.x, y: d.y, x0: d.x - DOT, y0: d.y - DOT, x1: d.x + DOT, y1: d.y + DOT }));

  for (const label of [...labels].sort(byPriority)) {
    const blocking = dotBoxes.filter((d) => Math.hypot(d.x - label.x, d.y - label.y) > DOT);
    let taken = null;
    for (const side of sides) {
      const box = boxOf(side, label);
      if (!inside(box, bounds)) continue;
      if (kept.some((k) => meets(box, k)) || blocking.some((d) => meets(box, d))) continue;
      taken = side;
      kept.push(box);
      break;
    }
    result.set(label.id, taken);
  }
  return result;
}
