// Which names the nav map's chart shows, and on which side of their dots,
// so no name sits on another or on a dot. The galaxy's labelPlace.js is the
// model (not imported: worlds are islands), and the difference is on
// purpose: the galaxy moves a name until it fits, the universe hides one
// that doesn't. A hidden name isn't lost: its dot is still a button, its name
// is its label for a screen reader and comes up on hover and focus, and the
// list beside the chart has it.
//
// Greedy, in priority order (ties by id, so a chart never shuffles between
// two frames): each name takes the first side that stays inside `bounds`,
// meets no name already down and covers no other place's dot. With none
// left it gets null: its dot alone.
//
// In px. A label is { id, x, y, w, h, priority }: its dot's middle, and the
// size of the whole button (the dot and the name beside it, as navmap.css
// draws it), and, where it may go only some ways, its own `sides` (the war's
// front reads leftwards, a far fight's name hangs under or over its burst).
// A side's box matches the CSS's translate for that `data-side`.

export const SIDES = ['right', 'left', 'under', 'over'];
const DOT = 8; // (half the drawn dot's box: navmap.css's .navmap-dot is 16 px)

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

const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b, o) => b.x0 >= o.x0 && b.y0 >= o.y0 && b.x1 <= o.x1 && b.y1 <= o.y1;
// inside the circle `o` is the square round (the nav map's chart is a disc:
// a name off it is cut off by its edge): every corner within its radius
const insideRound = (b, o) => {
  const cx = (o.x0 + o.x1) / 2;
  const cy = (o.y0 + o.y1) / 2;
  const r = Math.min(o.x1 - o.x0, o.y1 - o.y0) / 2;
  return [b.x0, b.x1].every((x) => [b.y0, b.y1].every((y) => Math.hypot(x - cx, y - cy) <= r));
};

// labels: [{ id, x, y, w, h, priority }]; bounds: { x0, y0, x1, y1 } (with
// `round`, the disc inside it); dots: [{ x, y }], every place's dot (and
// anything else a name mustn't cover, the ship); sides: the ones to try, in
// order → Map<id, side | null>
export function declutter(labels, { bounds, round = false, sides = SIDES, dots = [] } = {}) {
  const fits = round ? insideRound : inside;
  const out = new Map();
  const kept = [];
  const order = [...labels].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const l of order) {
    // a dot within a dot's half-width of its own point is its own (or one drawn on top of it): it never blocks it
    const others = dots.filter((d) => Math.hypot(d.x - l.x, d.y - l.y) > DOT).map((d) => ({ x0: d.x - DOT, y0: d.y - DOT, x1: d.x + DOT, y1: d.y + DOT }));
    let side = null;
    for (const s of l.sides ?? sides) {
      const b = boxOf(s, l);
      if (bounds && !fits(b, bounds)) continue;
      if (kept.some((k) => meet(b, k))) continue;
      if (others.some((d) => meet(b, d))) continue;
      side = s;
      kept.push(b);
      break;
    }
    out.set(l.id, side);
  }
  return out;
}
