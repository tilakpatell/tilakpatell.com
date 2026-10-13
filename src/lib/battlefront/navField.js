// The way to a far place over the navgrid. One search (nav.js's findPath)
// reaches as far as its cells allow; past that a bot was sent a straight
// leg toward its goal, and on real ground the line ends at a wall. Many bots
// are sent to few places (a round's posts, a stage's objectives), so the way
// is found once a place and kept: every open cell's distance to it, by the
// search's own moves (eight neighbours, no corner cut: navSearch.js), out to
// FIELD_REACH; a bot walks down it a leg at a time.
//
// The field's moves are checked where the search's are not: the search holds
// a cell open when a soldier fits at its middle, so a wall thinner than a
// cell that lies between two middles (Hoth's trench walls: the mask's fine
// grid has them, nav.js's `walkable`) is walked into. Here a move between
// two cells is made only if a soldier fits all along the line between their
// middles; a cell with nothing fine in it or beside it is taken as it is,
// and each cell's moves are worked out once a navgrid.
//
// The line is checked with room either side (ROOM): the cells' middles lie
// on the fine grid's own lines, so a line alone can run along a wall's face,
// and a bot a hair off it stands in the wall's sample and cannot go on.
//
// By hand: the reach (400 m: Hoth's posts and its sides' first places lie
// within 250 m of each other), how many fields a navgrid keeps (the oldest
// asked for is let go), that a place is kept by its navgrid cell, and the
// room. Pure.
//
//   fieldTo(nav, [x, z]) → field | null       (kept on the nav by the place's cell; null where no open cell is near)
//   distAt(nav, field, [x, z]) → m            (Infinity: no way, or past the reach)
//   legAlong(nav, field, from, metres) → [[x, z], …] | null   (from `from` down the field, pulled straight where open)

import { cellAt, nearestWalkable, walkable } from './nav.js';

export const FIELD_REACH = 400;
export const FIELD_KEPT = 12;
// The room a stretch of the way keeps either side of its line, m.
export const ROOM = 0.25;

const SQRT2 = Math.SQRT2;
const open = (nav, i) => nav.walk[i] === 1 && !nav.solid[i];

// the eight moves, each a bit of a cell's set
const MOVES = [];
for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) MOVES.push([dc, dr]);

// a cell with something fine in it: a blocked sample of the mask's fine grid, or a box solid beside it
function rough(nav, c, r) {
  if (nav.near.has(r * nav.cols + c)) return true;
  const f = nav.mask?.fine;
  if (!f) return false;
  const k = Math.round(nav.cell / f.cell);
  for (let fr = r * k; fr < (r + 1) * k; fr++)
    for (let fc = c * k; fc < (c + 1) * k; fc++) {
      const j = fr * f.cols + fc;
      if (f.bits[j >> 3] & (1 << (j & 7))) return true;
    }
  return false;
}

// a soldier fits all along a segment, with `room` either side of it, and every cell it crosses is open
// (sampled at an eighth of a cell)
function clear(nav, a, b, room = ROOM) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(d / (nav.cell / 8)));
  const sx = d > 1e-9 ? (-(b[1] - a[1]) / d) * room : 0;
  const sz = d > 1e-9 ? ((b[0] - a[0]) / d) * room : 0;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const cr = cellAt(nav, x, z);
    if (!cr || !open(nav, cr[1] * nav.cols + cr[0]) || !walkable(nav, x, z)) return false;
    if (room && (!walkable(nav, x + sx, z + sz) || !walkable(nav, x - sx, z - sz))) return false;
  }
  return true;
}

const centre = (nav, c, r) => [nav.origin[0] + (c + 0.5) * nav.cell, nav.origin[1] + (r + 0.5) * nav.cell];

// The moves out of an open cell, a bit each (MOVES' order), worked out once a navgrid: onto an open cell,
// with no corner cut, and where either cell is rough (or, on a diagonal, either cell it passes between),
// only if a soldier fits along the line between them
function movesOf(nav, c, r) {
  const n = nav.cols * nav.rows;
  const kept = (nav.moves ??= { set: new Uint8Array(n), done: new Uint8Array(n), rough: new Uint8Array(n) });
  const i = r * nav.cols + c;
  if (kept.done[i]) return kept.set[i];
  const isRough = (cc, rr) => {
    const j = rr * nav.cols + cc;
    if (!kept.rough[j]) kept.rough[j] = rough(nav, cc, rr) ? 2 : 1;
    return kept.rough[j] === 2;
  };
  let set = 0;
  for (let m = 0; m < 8; m++) {
    const [dc, dr] = MOVES[m];
    const cc = c + dc;
    const rr = r + dr;
    if (cc < 0 || rr < 0 || cc >= nav.cols || rr >= nav.rows || !open(nav, rr * nav.cols + cc)) continue;
    // (no corner cutting: a diagonal needs both sides open)
    if (dr && dc && (!open(nav, r * nav.cols + cc) || !open(nav, rr * nav.cols + c))) continue;
    const fine = isRough(c, r) || isRough(cc, rr) || (dr && dc && (isRough(cc, r) || isRough(c, rr)));
    if (fine && !clear(nav, centre(nav, c, r), centre(nav, cc, rr))) continue;
    set |= 1 << m;
  }
  kept.set[i] = set;
  kept.done[i] = 1;
  return set;
}

// a heap of the field's cells by their distance
function heap(d) {
  const a = [];
  return {
    get size() {
      return a.length;
    },
    push(i) {
      a.push(i);
      let k = a.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (d[a[p]] <= d[a[k]]) break;
        [a[p], a[k]] = [a[k], a[p]];
        k = p;
      }
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < a.length && d[a[l]] < d[a[m]]) m = l;
          if (r < a.length && d[a[r]] < d[a[m]]) m = r;
          if (m === k) break;
          [a[m], a[k]] = [a[k], a[m]];
          k = m;
        }
      }
      return top;
    },
  };
}

// The field: a window of the grid round the goal's cell (c0, r0 its corner), each of its cells' distance
function build(nav, goal) {
  const half = Math.ceil(FIELD_REACH / nav.cell);
  const gc = goal % nav.cols;
  const gr = Math.floor(goal / nav.cols);
  const c0 = Math.max(0, gc - half);
  const r0 = Math.max(0, gr - half);
  const cols = Math.min(nav.cols, gc + half + 1) - c0;
  const rows = Math.min(nav.rows, gr + half + 1) - r0;
  const dist = new Float32Array(cols * rows).fill(Infinity);
  const shut = new Uint8Array(cols * rows);
  const at = (c, r) => (r - r0) * cols + (c - c0);
  const q = heap(dist);
  dist[at(gc, gr)] = 0;
  q.push(at(gc, gr));
  while (q.size) {
    const cur = q.pop();
    if (shut[cur]) continue;
    shut[cur] = 1;
    const c = (cur % cols) + c0;
    const r = Math.floor(cur / cols) + r0;
    const set = movesOf(nav, c, r);
    for (let m = 0; m < 8; m++) {
      if (!(set & (1 << m))) continue;
      const [dc, dr] = MOVES[m];
      const cc = c + dc;
      const rr = r + dr;
      if (cc < c0 || rr < r0 || cc >= c0 + cols || rr >= r0 + rows) continue;
      const ni = at(cc, rr);
      if (shut[ni]) continue;
      const nd = dist[cur] + (dr && dc ? nav.cell * SQRT2 : nav.cell);
      if (nd >= dist[ni] || nd > FIELD_REACH) continue;
      dist[ni] = nd;
      q.push(ni);
    }
  }
  return { goal, c0, r0, cols, rows, dist };
}

export function fieldTo(nav, to) {
  const spot = nearestWalkable(nav, to[0], to[1], 8);
  const cr = spot && cellAt(nav, spot[0], spot[1]);
  if (!cr || !open(nav, cr[1] * nav.cols + cr[0])) return null;
  const goal = cr[1] * nav.cols + cr[0];
  const kept = (nav.fields ??= new Map());
  let f = kept.get(goal);
  // (asked for again: the newest; one more than is kept: the oldest goes)
  if (f) kept.delete(goal);
  else {
    f = build(nav, goal);
    if (kept.size >= FIELD_KEPT) kept.delete(kept.keys().next().value);
  }
  kept.set(goal, f);
  return f;
}

// a grid cell's distance in the field (Infinity outside its window)
const of = (f, c, r) => (c < f.c0 || r < f.r0 || c >= f.c0 + f.cols || r >= f.r0 + f.rows ? Infinity : f.dist[(r - f.r0) * f.cols + (c - f.c0)]);

export function distAt(nav, field, at) {
  const cr = cellAt(nav, at[0], at[1]);
  return cr ? of(field, cr[0], cr[1]) : Infinity;
}

export function legAlong(nav, field, from, metres) {
  const cr = cellAt(nav, from[0], from[1]);
  if (!cr) return null;
  // (the first cell: the bot's own where it has a way and the bot can walk to its middle, else the one
  // beside it with the shortest way that it can walk to. This stretch is from where the bot stands, which
  // may be at a wall's face: its line alone is checked)
  let first = null;
  if (Number.isFinite(of(field, cr[0], cr[1])) && clear(nav, from, centre(nav, cr[0], cr[1]), 0)) first = cr;
  else {
    let best = Infinity;
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const d = of(field, cr[0] + dc, cr[1] + dr);
        if (d < best && clear(nav, from, centre(nav, cr[0] + dc, cr[1] + dr), 0)) [best, first] = [d, [cr[0] + dc, cr[1] + dr]];
      }
  }
  if (!first) return null;
  let [c, r] = first;
  const pts = [[from[0], from[1]], centre(nav, c, r)];
  let walked = 0;
  while (walked < metres) {
    let next = null;
    const here = of(field, c, r);
    const set = movesOf(nav, c, r);
    for (let m = 0; m < 8; m++) {
      if (!(set & (1 << m))) continue;
      const d = of(field, c + MOVES[m][0], r + MOVES[m][1]);
      if (d < (next ? next.d : here)) next = { d, c: c + MOVES[m][0], r: r + MOVES[m][1] };
    }
    if (!next) break;
    walked += here - next.d;
    [c, r] = [next.c, next.r];
    pts.push(centre(nav, c, r));
  }
  // string-pull: drop a point when the line past it is open
  const out = [pts[0]];
  let k = 0;
  while (k < pts.length - 1) {
    let j = pts.length - 1;
    while (j > k + 1 && !clear(nav, pts[k], pts[j])) j--;
    out.push(pts[j]);
    k = j;
  }
  return out;
}
