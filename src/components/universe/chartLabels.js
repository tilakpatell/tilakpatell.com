// Where each name goes on the nav map's chart (NavMap.jsx). A name sits
// beside its dot, on the first of eight sides that's clear of every name
// placed before it, of every dot and of the chart's own buttons, and inside
// the chart's circle (it clips the rest). The places that matter most go
// first. A name with no clear side is left off: its dot stays, and the name
// shows over the others on a hover, a focus or a pick, on the first side
// that's inside the circle.
// Pure: sizes in pixels, and `measure(text)` says how wide a name's box is
// (the browser's own text measure in NavMap.jsx, a guess in the tests).

// the sides tried, in a map-maker's order: beside the dot first (right,
// then left), then off its corners, then straight above and below it
export const SIDES = ['right', 'left', 'upright', 'downright', 'upleft', 'downleft', 'up', 'down'];

// where a name's box goes for a side: its top-left, from the dot's middle
// (`r` the dot's radius, `gap` the room between dot and name)
export function boxAt(side, w, h, r, gap) {
  const c = r * 0.75; // (off a corner: round the dot's edge, just clear of it)
  switch (side) {
    case 'right':
      return [r + gap, -h / 2];
    case 'left':
      return [-r - gap - w, -h / 2];
    case 'upright':
      return [c, -c - h];
    case 'downright':
      return [c, c];
    case 'upleft':
      return [-c - w, -c - h];
    case 'downleft':
      return [-c - w, c];
    case 'up':
      return [-w / 2, -r - gap - h];
    default:
      return [-w / 2, r + gap];
  }
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// a box and a dot (a circle) touch
const touches = (b, x, y, r) => Math.hypot(x - Math.max(b.x0, Math.min(x, b.x1)), y - Math.max(b.y0, Math.min(y, b.y1))) < r;
// every corner of a box inside the circle
const insideCircle = (b, cx, cy, R) => [b.x0, b.x1].every((x) => [b.y0, b.y1].every((y) => Math.hypot(x - cx, y - cy) <= R));

// items: [{ id, x, y, text, r?, label? }] in order of importance, x and y the
// dot's middle in the chart's pixels; `label: false` (a place filtered out)
// is never placed, only given a spot for its hover. size: the chart's width
// (it's square); its circle is `size / 2 - inset` round the middle.
// obstacles: [{ x0, y0, x1, y1 }], boxes no name may cover.
// Returns a Map of id → { side, dx, dy, w, h, off }: the box's top-left from
// the dot's middle, its size, and whether it's left off.
export function placeLabels(items, { size, measure, height = 18, gap = 3, dot = 6, inset = 2, room = 2, obstacles = [] } = {}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - inset;
  const placed = [...obstacles];
  const out = new Map();
  for (const it of items) {
    const w = measure(it.text);
    const h = height;
    const r = it.r ?? dot;
    let first = null; // (the first side inside the circle: where a name left off shows)
    let best = null;
    for (const side of SIDES) {
      const [dx, dy] = boxAt(side, w, h, r, gap);
      const b = { x0: it.x + dx, y0: it.y + dy, x1: it.x + dx + w, y1: it.y + dy + h };
      if (!insideCircle(b, cx, cy, R)) continue;
      first ??= { side, dx, dy };
      if (it.label === false) break;
      const grown = { x0: b.x0 - room, y0: b.y0 - room, x1: b.x1 + room, y1: b.y1 + room };
      if (placed.some((p) => overlaps(grown, p))) continue;
      if (items.some((o) => o !== it && touches(grown, o.x, o.y, o.r ?? dot))) continue;
      best = { side, dx, dy, box: b };
      break;
    }
    if (best) {
      placed.push(best.box);
      out.set(it.id, { side: best.side, dx: best.dx, dy: best.dy, w, h, off: false });
    } else {
      const f = first ?? { side: 'right', dx: r + gap, dy: -h / 2 };
      out.set(it.id, { side: f.side, dx: f.dx, dy: f.dy, w, h, off: true });
    }
  }
  return out;
}
