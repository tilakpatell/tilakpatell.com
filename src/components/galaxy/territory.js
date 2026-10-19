// The galaxy's wars as territory on the holotable (HoloMap.jsx, WarLayers.jsx):
// round each system the war is fought over, the space nearer it than any
// other, as far as its reach (a cell), filled the colour of whoever holds it;
// a border where two powers' cells touch; and the links the war runs along
// (gcwRules.js's NEIGHBOURS), each held, contested or fought along. Pure,
// tested.
//
// A cell is a Voronoi cell with a cap: a 24-gon round its system (its reach,
// further for a worthier system: capOf), cut by the line midway to every
// other system (Sutherland and Hodgman's clipping), so no two overlap and a
// lone system out on the rim doesn't claim half the galaxy, and by the
// galaxy's disc (Nevarro's reach would poke past it). Each edge keeps
// the neighbour whose line made it (or null, the edge of its reach), and so a
// border between two cells is where their shared edges overlap. The systems
// don't move, so CELLS is worked out once.
//
// capOf(id) → grid squares; cellsOf([{ id, pos, cap }]) → [{ id, poly: [[x,
// z]…], edges: [{ with, a, b }] }] (and { core, rim }, the disc); contains(cell, p) → whether p's in it;
// clashOf(table) → (a, b) → whether a's or b's battle is fought from the
// other; bordersOf(owner, { cells, hot }) → [{ a, b, p: [[x, z], [x, z]], hot
// }]; EDGES → [[a, b]] (a < b); linksOf(table) → [{ id, a, b, state ('own',
// 'contested', 'battle'), owner (the holder, on its own link) }].

import { NEIGHBOURS, WAR_SYSTEMS, worthOf } from './gcwRules';
import { CORE, RIM, systemById } from './systems';

const GON = 24;
const RIM_GON = 96;
const EPS = 1e-9;

// how far a system's territory reaches (grid squares): further for a worthier one
export const capOf = (id) => 1.5 + 0.4 * worthOf(id);

// what's left of a convex polygon (vertices tagged with the edge leaving them)
// on the near side of a line (n·p ≤ c), the new edge tagged `tag`
function clip(poly, n, c, tag) {
  const side = (v) => n[0] * v.x + n[1] * v.z - c;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    const w = poly[(i + 1) % poly.length];
    const sv = side(v);
    const sw = side(w);
    const cross = () => {
      const t = sv / (sv - sw);
      return { x: v.x + (w.x - v.x) * t, z: v.z + (w.z - v.z) * t };
    };
    if (sv <= EPS) {
      out.push(v);
      if (sw > EPS) out.push({ ...cross(), t: tag });
    } else if (sw <= EPS) out.push({ ...cross(), t: v.t });
  }
  return out;
}

export function cellsOf(points, { core = CORE, rim = RIM } = {}) {
  // (the galaxy's disc, as the edges of a 96-gon in it: nothing reaches past it)
  const disc = Array.from({ length: RIM_GON }, (_, i) => {
    const a = ((i + 0.5) / RIM_GON) * Math.PI * 2;
    const n = [Math.cos(a), Math.sin(a)];
    return [n, n[0] * core[0] + n[1] * core[1] + rim * Math.cos(Math.PI / RIM_GON)];
  });
  return points.map((me) => {
    const [x0, z0] = me.pos;
    let poly = Array.from({ length: GON }, (_, i) => {
      const a = (i / GON) * Math.PI * 2;
      return { x: x0 + Math.cos(a) * me.cap, z: z0 + Math.sin(a) * me.cap, t: null };
    });
    for (const o of points) {
      if (o === me || !poly.length) continue;
      const [x1, z1] = o.pos;
      // (nearer me than o: 2p·(o − me) ≤ |o|² − |me|²)
      poly = clip(poly, [x1 - x0, z1 - z0], (x1 * x1 + z1 * z1 - x0 * x0 - z0 * z0) / 2, o.id);
    }
    // (a system past the disc, Kamino, holds a pocket of space of its own beyond it: the disc doesn't cut it off)
    if (Math.hypot(x0 - core[0], z0 - core[1]) <= rim) for (const [n, c] of disc) poly = clip(poly, n, c, null);
    // (a corner cut exactly on a line comes out twice: the second's the one whose edge goes on)
    poly = poly.filter((v, i) => {
      const w = poly[(i + 1) % poly.length];
      return poly.length < 2 || Math.hypot(w.x - v.x, w.z - v.z) > EPS;
    });
    const edges = poly.map((v, i) => {
      const w = poly[(i + 1) % poly.length];
      return { with: v.t, a: [v.x, v.z], b: [w.x, w.z] };
    });
    return { id: me.id, poly: poly.map((v) => [v.x, v.z]), edges };
  });
}

export const CELLS = cellsOf(WAR_SYSTEMS.map((id) => ({ id, pos: systemById(id).pos, cap: capOf(id) })));
const CELL = Object.fromEntries(CELLS.map((c) => [c.id, c]));

// a point's in a (convex, wound one way) cell if it's on the same side of every edge
export function contains(cell, [x, z]) {
  let sign = 0;
  for (const e of cell.edges) {
    const cross = (e.b[0] - e.a[0]) * (z - e.a[1]) - (e.b[1] - e.a[1]) * (x - e.a[0]);
    if (Math.abs(cross) < EPS) continue;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return sign !== 0;
}

// where two cells' shared edges overlap (each cut by its own reach, so one may
// run further than the other), or null where they don't touch
function shared(a, b) {
  const ea = a.edges.find((e) => e.with === b.id);
  const eb = b.edges.find((e) => e.with === a.id);
  if (!ea || !eb) return null;
  const len = Math.hypot(ea.b[0] - ea.a[0], ea.b[1] - ea.a[1]);
  if (len < EPS) return null;
  const d = [(ea.b[0] - ea.a[0]) / len, (ea.b[1] - ea.a[1]) / len];
  const along = (p) => (p[0] - ea.a[0]) * d[0] + (p[1] - ea.a[1]) * d[1];
  const s1 = along(eb.a);
  const s2 = along(eb.b);
  const from = Math.max(0, Math.min(s1, s2));
  const to = Math.min(len, Math.max(s1, s2));
  if (to - from < 1e-6) return null;
  const at = (s) => [ea.a[0] + d[0] * s, ea.a[1] + d[1] * s];
  return [at(from), at(to)];
}

// the battles of a table (gcw.js's warTable) as a question: is one of these
// two being fought for from the other (its attacker holding the other)?
export function clashOf(table) {
  const rows = Object.fromEntries(table.systems.map((r) => [r.id, r]));
  const from = (x, y) => Boolean(rows[x]?.battle && rows[x].battle.attacker === rows[y]?.owner);
  return (a, b) => from(a, b) || from(b, a);
}

export function bordersOf(owner, { cells = CELLS, hot = () => false } = {}) {
  const byId = cells === CELLS ? CELL : Object.fromEntries(cells.map((c) => [c.id, c]));
  const out = [];
  for (const c of cells)
    for (const e of c.edges) {
      if (e.with === null || !(c.id < e.with) || owner[c.id] === owner[e.with] || !byId[e.with]) continue;
      const p = shared(c, byId[e.with]);
      if (p) out.push({ a: c.id, b: e.with, p, hot: hot(c.id, e.with) });
    }
  return out;
}

// the war's links, each once, by name
export const EDGES = WAR_SYSTEMS.flatMap((a) => NEIGHBOURS[a].filter((b) => a < b).map((b) => [a, b])).sort((x, y) => x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]));

// held (both ends one side's), contested (two sides'), or fought along (a
// battle at one end, its attacker at the other)
export function linksOf(table) {
  const owner = Object.fromEntries(table.systems.map((r) => [r.id, r.owner]));
  const clash = clashOf(table);
  return EDGES.map(([a, b]) => {
    const state = clash(a, b) ? 'battle' : owner[a] === owner[b] ? 'own' : 'contested';
    return { id: `${a}-${b}`, a, b, state, owner: state === 'own' ? owner[a] : null };
  });
}
