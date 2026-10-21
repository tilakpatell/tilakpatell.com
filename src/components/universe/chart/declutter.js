// Chart label declutter: which of a place's names get to stay on the chart,
// and on which side of their dots, so no name sits on another or on a dot.
// Modelled on the galaxy's labelPlace.js, which moves a name aside until it
// stops overlapping. It is not imported, because worlds are islands, and the
// universe differs on purpose: where the galaxy moves a name, the chart hides
// it and leaves the dot alone. A hidden name isn't lost: its dot is still a
// button, its name is its label for a screen reader and comes up on hover and
// focus, and the list beside the chart has it. Pure, no imports.
//
// SIDES = ['right', 'left', 'under', 'over']   the navmap.css `data-side` values
// boxOf(side, { x, y, w, h }) → { x0, y0, x1, y1 }   a name's box in px
// declutter(labels, { bounds, round, sides, dots }) → Map<id, side | null>
//
// Greedy, highest priority first, ties by id so the result is the same
// whatever order the labels arrive in (a chart never shuffles between two
// frames). Priority may be Infinity. Each label takes the first side whose box
// lies inside bounds, meets no kept name and covers no other place's dot; if
// none does it gets null (dot only). Every label has an entry. Boxes that only
// touch edge to edge do not meet.
//
// In px. A label is { id, x, y, w, h, priority, sides? }: its dot's middle, the
// size of the whole button (the dot and the name beside it, as navmap.css
// draws it), and, where it may go only some ways, its own `sides` (the war's
// front reads leftwards, a far fight's name hangs under or over its burst).
// Bounds are a box { x0, y0, x1, y1 } or, for a round chart, a circle
// { cx, cy, r }: a name's box is inside it when all four corners are. `round`
// takes a box's inscribed circle instead (the nav map's chart is a disc: a
// name off it is cut off by its edge). A side's box matches the CSS's
// translate for that `data-side`.

export const SIDES = ['right', 'left', 'under', 'over'];

// Half the dot's 16 px box (navmap.css's .navmap-dot). A dot this close to a
// label's own point is its own dot (or one drawn on top of it), so it never
// blocks that label.
const DOT = 8;

// These mirror navmap.css's translates for each data-side.
export function boxOf(side, { x, y, w, h }) {
  switch (side) {
    case 'left':
      return { x0: x + DOT - w, y0: y - h / 2, x1: x + DOT, y1: y + h / 2 };
    case 'under':
      return { x0: x - w / 2, y0: y - DOT, x1: x + w / 2, y1: y + DOT + h };
    case 'over':
      return { x0: x - w / 2, y0: y - DOT - h, x1: x + w / 2, y1: y + DOT };
    default:
      return { x0: x - DOT, y0: y - h / 2, x1: x - DOT + w, y1: y + h / 2 };
  }
}

const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// A box's inscribed circle: the disc a square chart is drawn clipped to.
const discOf = (o) => ({ cx: (o.x0 + o.x1) / 2, cy: (o.y0 + o.y1) / 2, r: Math.min(o.x1 - o.x0, o.y1 - o.y0) / 2 });

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

export function declutter(labels, { bounds = null, round = false, sides = SIDES, dots = [] } = {}) {
  const within = bounds && round && bounds.r === undefined ? discOf(bounds) : bounds;
  const result = new Map();
  const kept = [];
  const dotBoxes = dots.map((d) => ({ x: d.x, y: d.y, x0: d.x - DOT, y0: d.y - DOT, x1: d.x + DOT, y1: d.y + DOT }));

  for (const label of [...labels].sort(byPriority)) {
    const blocking = dotBoxes.filter((d) => Math.hypot(d.x - label.x, d.y - label.y) > DOT);
    let taken = null;
    for (const side of label.sides ?? sides) {
      const box = boxOf(side, label);
      if (within && !inside(box, within)) continue;
      if (kept.some((k) => meets(box, k)) || blocking.some((d) => meets(box, d))) continue;
      taken = side;
      kept.push(box);
      break;
    }
    result.set(label.id, taken);
  }
  return result;
}
