// Where each system's name goes on the galaxy map (HoloMap.jsx), so none
// covers another or a dot: twelve places round its dot, right first, then
// left, above, below, the corners, and above and below with the name hung
// from the dot's left edge (s) or its right edge (e), which is what is left
// in a crowd of dots. The names are placed in priority order (where you are,
// the one picked, a battle on, the major order, the rest), each taking the
// place that overlaps least with the names already down, every other dot, the
// `blocks` (boxes { x0, y0, x1, y1 } of the controls drawn over the map: they
// cover a name as a dot does) and the box's edge; then the ones that still
// cover something look again with everyone down, and the few that are left
// in a cluster are tried in every place together (a search that takes the
// best of them, up to a budget). In screen pixels, at the map's zoom (the
// names keep their size while the map scales, so zoomed in they part).
// With `hideUnder` (the map zoomed in, where a pan brings it out), a dot
// under a control is out of sight: its name is null, as an optional one's
// with no room, and it's placed round by no one.
//
// An item may be `optional`: a charted world's (charted/index.js), unless
// it's where you are or the one picked, and a landmark's name (landmarks.js,
// with no dot). The other names are placed as if it weren't there, then one
// over its dot moves to a place that covers nothing at all if it has one,
// and never otherwise; an optional dot a name still covers is HIDDEN, name
// and all, till the map's zoomed in enough to part them. The rest get their
// names last, each only in a place that covers nothing at all (no name, no
// dot, no control, not the edge), or none: null, its dot alone. So the
// films' worlds keep their names at every zoom, and the charted ones come in
// as there's room. An item's `dot` is its dot's radius, where it isn't the
// map's own (a charted world's is SMALL_DOT, a landmark's 0).

export const PLACES = ['r', 'l', 't', 'b', 'tr', 'br', 'tl', 'bl', 'bs', 'be', 'ts', 'te'];
export const GAP = 9; // (the dot's radius, 7, and 2 more)
export const DOT = 7;
export const SMALL_DOT = 4; // (a charted world's dot, galaxy.css's)
export const HIDDEN = 'none'; // (an optional item's place when a name covers its dot)
export const CORNER = GAP * 0.6; // (how far a corner place's box is off the dot's middle, across and up or down)

export function boxAt(place, x, y, w, h) {
  const c = CORNER;
  switch (place) {
    case 'l':
      return { x0: x - GAP - w, y0: y - h / 2, x1: x - GAP, y1: y + h / 2 };
    case 't':
      return { x0: x - w / 2, y0: y - GAP - h, x1: x + w / 2, y1: y - GAP };
    case 'b':
      return { x0: x - w / 2, y0: y + GAP, x1: x + w / 2, y1: y + GAP + h };
    case 'tr':
      return { x0: x + c, y0: y - c - h, x1: x + c + w, y1: y - c };
    case 'br':
      return { x0: x + c, y0: y + c, x1: x + c + w, y1: y + c + h };
    case 'tl':
      return { x0: x - c - w, y0: y - c - h, x1: x - c, y1: y - c };
    case 'bl':
      return { x0: x - c - w, y0: y + c, x1: x - c, y1: y + c + h };
    case 'ts':
      return { x0: x - DOT, y0: y - GAP - h, x1: x - DOT + w, y1: y - GAP };
    case 'te':
      return { x0: x + DOT - w, y0: y - GAP - h, x1: x + DOT, y1: y - GAP };
    case 'bs':
      return { x0: x - DOT, y0: y + GAP, x1: x - DOT + w, y1: y + GAP + h };
    case 'be':
      return { x0: x + DOT - w, y0: y + GAP, x1: x + DOT, y1: y + GAP + h };
    default:
      return { x0: x + GAP, y0: y - h / 2, x1: x + GAP + w, y1: y + h / 2 };
  }
}

// the way the war's marks on a dot (the + or −, the you-fought dot) see a name's place: above or below the dot, or to its left or
// right, or at a corner (warmap.css keys on these)
export const sideOf = (place) => (place === 'bs' || place === 'be' ? 'b' : place === 'ts' || place === 'te' ? 't' : place);
// and which edge of the dot an above-or-below name hangs from, s (the left) or e (the right), or nothing for one that's centred
export const hangOf = (place) => (place === 'bs' || place === 'ts' ? 's' : place === 'be' || place === 'te' ? 'e' : undefined);

const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const outside = (b, o) => (b.x1 - b.x0) * (b.y1 - b.y0) - area(b, o);

// a name's width before it's been measured: its letters at the map's size, and its marks
export const estimateWidth = (name, fontPx = 12.5, extras = 0) => Math.ceil(name.length * fontPx * 0.58 + 8 + extras);

// how much the boxes overlap, all pairs (for the tests and the check)
export function overlapArea(boxes) {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) n += area(boxes[i], boxes[j]);
  return n;
}

// what an overlap costs, per px² (a name cut off by the edge is as lost as one under another; a dot or a control, which stays
// put, is dearer than a name, which could have gone elsewhere)
const COST = { name: 10, dot: 14, block: 14, edge: 20 };
const LATER = 0.02; // (what each place past the right costs, so a tie keeps the earlier one: no more than a graze's worth, whatever the number of names)
const PASSES = 8;
const GRAZE = 0.5; // (px a name may graze an optional dot by and leave it shown: the browser check's own tolerance)
const shrunk = (b) => ({ x0: b.x0 + GRAZE, y0: b.y0 + GRAZE, x1: b.x1 - GRAZE, y1: b.y1 - GRAZE });
const NODES = 6000; // (the most places the cluster search tries: a crowd with no clear answer isn't searched for ever, a pan's frame has 16 ms)
const REACH = 2 * GAP; // (a name's box reaches its own size and a gap past its dot's middle, so two meet only within both sizes and this)

export function placeLabels(items, { dot = DOT, bounds = null, blocks = [], hideUnder = false } = {}) {
  const dotOf = (o) => {
    const r = o.dot ?? dot;
    return { x0: o.x - r, y0: o.y - r, x1: o.x + r, y1: o.y + r };
  };
  const byPrio = (a, b) => b.prio - a.prio || (a.id < b.id ? -1 : 1);
  // (a dot under a control is out of sight, where asked: its name goes unsaid, and takes no room from its neighbours')
  const under = (it) => hideUnder && blocks.some((k) => it.x > k.x0 && it.x < k.x1 && it.y > k.y0 && it.y < k.y1);
  const unseen = items.filter(under);
  const inSight = items.filter((it) => !under(it));
  const order = inSight.filter((it) => !it.optional).sort(byPrio);
  const boxes = {}; // id → its box in each place
  const base = {}; // id → what each place costs of what stays put: the dots, the controls, the edge (and a little for each place past the right, so a tie keeps the earlier one: right, as the map always had it)
  for (const it of order) {
    boxes[it.id] = PLACES.map((p) => boxAt(p, it.x, it.y, it.w, it.h));
    base[it.id] = boxes[it.id].map((b, n) => {
      let c = n * LATER;
      for (const o of order) if (o.id !== it.id) c += area(b, dotOf(o)) * COST.dot;
      for (const k of blocks) c += area(b, k) * COST.block;
      if (bounds) c += outside(b, bounds) * COST.edge;
      return c;
    });
  }
  // the names whose boxes could ever meet this one's: the only ones its choice matters to
  const near = {};
  for (const it of order) near[it.id] = order.filter((o) => o !== it && Math.abs(o.x - it.x) < o.w + it.w + REACH && Math.abs(o.y - it.y) < o.h + it.h + REACH);
  const at = {}; // id → the index in PLACES of the place it has now
  // the cost of a name in its n-th place: what stays put, and the overlap with the names down now
  const cost = (it, n) => {
    let c = base[it.id][n];
    for (const o of near[it.id]) if (o.id in at) c += area(boxes[it.id][n], boxes[o.id][at[o.id]]) * COST.name;
    return c;
  };
  const covers = (it) => cost(it, at[it.id]) - at[it.id] * LATER > 1e-9;
  const best = (it) => {
    let pick = 0;
    let low = Infinity;
    for (let n = 0; n < PLACES.length; n++) {
      const c = cost(it, n);
      if (c < low) (low = c), (pick = n);
    }
    return [pick, low];
  };
  // first each in priority order takes the place that covers least of what's down already...
  for (const it of order) at[it.id] = best(it)[0];
  // ...then, the lowest priority first, each that still covers something looks again with everyone else down (a name placed early
  // couldn't know a later one would be left with nowhere): it moves only to a place that costs less, so this settles
  const lowest = [...order].reverse();
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (const it of lowest) {
      if (!covers(it)) continue;
      const now = cost(it, at[it.id]);
      const [pick, low] = best(it);
      if (low < now - 1e-9) (at[it.id] = pick), (moved = true);
    }
    if (!moved) break;
  }
  // what's left covering something is a cluster of names that each need another's move (two dots a few px apart, and the names of
  // both): every place of every name in the cluster is tried together (the names that could meet them, and those that could meet
  // those), and the cheapest taken
  const seen = new Set();
  for (const first of lowest.filter(covers)) {
    if (seen.has(first)) continue;
    const names = [first];
    seen.add(first);
    for (let i = 0; i < names.length; i++) for (const o of near[names[i].id]) if (!seen.has(o)) (seen.add(o), names.push(o));
    // (the ones with the fewest clear places first, the rest in priority order: they have the least choice)
    const clear = (it) => base[it.id].filter((c, n) => c < n * LATER + 1e-9).length;
    names.sort((x, y) => clear(x) - clear(y) || order.indexOf(x) - order.indexOf(y));
    const cheap = Object.fromEntries(names.map((it) => [it.id, PLACES.map((_, n) => [n, base[it.id][n]]).sort((x, y) => x[1] - y[1] || x[0] - y[0])]));
    const rest = names.map((_, i) => names.slice(i).reduce((c, it) => c + cheap[it.id][0][1], 0)); // (what the names from i on cost at the least)
    const sum = (now) => names.reduce((c, it, i) => c + base[it.id][now[it.id]] + near[it.id].reduce((s, o) => (names.indexOf(o) > i ? s + area(boxes[it.id][now[it.id]], boxes[o.id][now[o.id]]) * COST.name : s), 0), 0);
    let low = sum(at);
    let pick = null;
    const now = {};
    let nodes = 0;
    const search = (k, cost) => {
      if (k === names.length) {
        if (cost < low - 1e-9) (low = cost), (pick = { ...now });
        return;
      }
      const it = names[k];
      for (const [n, c0] of cheap[it.id]) {
        if (++nodes > NODES) return;
        let c = cost + c0;
        for (const o of near[it.id]) if (o.id in now) c += area(boxes[it.id][n], boxes[o.id][now[o.id]]) * COST.name;
        if (c + (rest[k + 1] ?? 0) >= low - 1e-9) continue;
        now[it.id] = n;
        search(k + 1, c);
        delete now[it.id];
      }
    };
    search(0, 0);
    if (pick) Object.assign(at, pick);
  }
  // the optional ones, last: a name over one's dot moves off it to a place that covers nothing, where it has one
  const optional = inSight.filter((o) => o.optional).sort(byPrio);
  const onDot = (b) => optional.some((o) => area(shrunk(b), dotOf(o)) > 0);
  for (const it of lowest) {
    if (!onDot(boxes[it.id][at[it.id]])) continue;
    const n = PLACES.findIndex((_, k) => cost(it, k) - k * LATER <= 1e-9 && !onDot(boxes[it.id][k]));
    if (n >= 0) at[it.id] = n;
  }
  const out = Object.fromEntries([...order.map((it) => [it.id, PLACES[at[it.id]]]), ...unseen.map((it) => [it.id, null])]);
  // then a dot still under a name is hidden; the rest are named in the first place that covers nothing, or not (null)
  const down = order.map((it) => boxes[it.id][at[it.id]]);
  const shown = optional.filter((it) => !down.some((d) => area(shrunk(d), dotOf(it)) > 0));
  for (const it of optional) out[it.id] = HIDDEN;
  const dots = [...order, ...shown];
  for (const it of shown) {
    out[it.id] = null;
    for (const place of PLACES) {
      const b = boxAt(place, it.x, it.y, it.w, it.h);
      if ((bounds && outside(b, bounds) > 0) || blocks.some((k) => area(b, k) > 0) || down.some((d) => area(b, d) > 0) || dots.some((o) => o !== it && area(b, dotOf(o)) > 0)) continue;
      out[it.id] = place;
      down.push(b);
      break;
    }
  }
  return out;
}
