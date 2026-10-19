// The galaxy's routes: a jump between two systems follows the great
// hyperspace lanes (systems.js's LANES) and the lesser ones (spurs.js's
// SPURS) where they join, and goes direct
// where they don't, slower and riskier off the beaten track. Pure numbers,
// tested in Node; scene.js times the jump by it, HoloMap.jsx draws the
// course along it, interdiction.js brings the Empire's window on sooner after
// a jump off the lanes.
//
// laneGraph(lanes, systems) → { nodes: [{ at, lanes }], edges: [{ a, b, len, lane }], snap: { [system id]: node index } }
//   each lane's points as nodes joined in order; where two lanes cross, a
//   point on both; lanes sharing a point (within JOIN) share the node; a
//   system within SNAP of a lane point is snapped to the nearest one
// routeBetween(fromId, toId) → { pts: [[x, z], …], squares, onLane, lanes: [lane ids, in order] } or null
// routeMid(route) → [x, z], the point half the way along the course (where its tag goes)
// jumpTime(route) → seconds in hyperspace
// viaLanes(route) → the holomap's words for it: 'via the Corellian Run', or that it's off the lanes

import { LANES, SYSTEMS, systemById } from './systems';
import { SPURS } from './spurs';

// every route a course can take, the great and the lesser
export const ROUTES = [...LANES, ...SPURS];

export const SNAP = 1.2; // grid squares: how far off a lane point a system still counts as on the lane
// grid squares: two lanes' points this close are one junction (0.4, not
// 0.3: the Rimma leaves the Run 0.36 off the point the Spine does)
export const JOIN = 0.4;
export const JUMP = { base: 2.5, perSquare: 1.2, max: 12, offLane: 1.6 }; // seconds

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const length = (pts) => pts.slice(1).reduce((d, p, i) => d + dist(pts[i], p), 0);

// where segments p→q and r→s cross, as how far along each (0…1), or null
function cross(p, q, r, s) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t > 0 && t < 1 && u > 0 && u < 1 ? { t, u } : null;
}

// each lane's points with the places it crosses another lane put in
function withCrossings(lanes) {
  const extra = lanes.map((l) => l.pts.slice(1).map(() => []));
  lanes.forEach((A, i) =>
    lanes.forEach((B, j) => {
      if (j <= i) return;
      for (let a = 1; a < A.pts.length; a++)
        for (let b = 1; b < B.pts.length; b++) {
          const c = cross(A.pts[a - 1], A.pts[a], B.pts[b - 1], B.pts[b]);
          if (!c) continue;
          const at = [A.pts[a - 1][0] + (A.pts[a][0] - A.pts[a - 1][0]) * c.t, A.pts[a - 1][1] + (A.pts[a][1] - A.pts[a - 1][1]) * c.t];
          extra[i][a - 1].push({ k: c.t, at });
          extra[j][b - 1].push({ k: c.u, at });
        }
    }),
  );
  return lanes.map((l, i) => ({ ...l, pts: l.pts.flatMap((p, a) => [p, ...(extra[i][a] ?? []).sort((x, y) => x.k - y.k).map((x) => x.at)]) }));
}

export function laneGraph(lanes = ROUTES, systems = SYSTEMS) {
  const nodes = [];
  const edges = [];
  const nodeAt = (at, lane) => {
    let i = nodes.findIndex((n) => dist(n.at, at) <= JOIN);
    if (i < 0) i = nodes.push({ at, lanes: [] }) - 1;
    if (!nodes[i].lanes.includes(lane)) nodes[i].lanes.push(lane);
    return i;
  };
  for (const l of withCrossings(lanes)) {
    const ids = l.pts.map((p) => nodeAt(p, l.id));
    for (let k = 1; k < ids.length; k++) if (ids[k] !== ids[k - 1]) edges.push({ a: ids[k - 1], b: ids[k], len: dist(nodes[ids[k - 1]].at, nodes[ids[k]].at), lane: l.id });
  }
  const snap = {};
  for (const s of systems) {
    let best = -1;
    let bestD = SNAP;
    nodes.forEach((n, i) => {
      const d = dist(n.at, s.pos);
      if (d <= bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0) snap[s.id] = best;
  }
  return { nodes, edges, snap };
}

let graph = null;
const theGraph = () => (graph ??= laneGraph());

// the shortest way along the edges from node `from` to node `to` (Dijkstra:
// a couple of dozen nodes, so a plain scan for the nearest is plenty), as
// [{ node, lane }] where `lane` is the one taken to reach it; null if they don't join
function shortest({ nodes, edges }, from, to) {
  const far = nodes.map(() => Infinity);
  const prev = nodes.map(() => null);
  const done = nodes.map(() => false);
  far[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && far[i] < Infinity && (u < 0 || far[i] < far[u])) u = i;
    if (u < 0) return null;
    if (u === to) break;
    done[u] = true;
    for (const e of edges) {
      const v = e.a === u ? e.b : e.b === u ? e.a : -1;
      if (v < 0 || done[v]) continue;
      if (far[u] + e.len < far[v]) {
        far[v] = far[u] + e.len;
        prev[v] = { node: u, lane: e.lane };
      }
    }
  }
  const path = [{ node: to, lane: null }];
  for (let n = to; prev[n]; n = prev[n].node) {
    path[0].lane = prev[n].lane;
    path.unshift({ node: prev[n].node, lane: null });
  }
  return path;
}

export function routeBetween(fromId, toId) {
  const a = systemById(fromId);
  const b = systemById(toId);
  if (!a || !b) return null;
  const g = theGraph();
  const direct = { pts: [a.pos, b.pos], squares: dist(a.pos, b.pos), onLane: false, lanes: [] };
  if (a === b || g.snap[a.id] === undefined || g.snap[b.id] === undefined) return direct;
  const path = shortest(g, g.snap[a.id], g.snap[b.id]);
  if (!path) return direct;
  const pts = [a.pos];
  for (const { node } of path) if (dist(pts[pts.length - 1], g.nodes[node].at) > 1e-9) pts.push(g.nodes[node].at);
  if (dist(pts[pts.length - 1], b.pos) > 1e-9) pts.push(b.pos);
  else pts[pts.length - 1] = b.pos;
  const lanes = [];
  for (const { lane } of path) if (lane && lanes[lanes.length - 1] !== lane) lanes.push(lane);
  return { pts, squares: length(pts), onLane: true, lanes };
}

// the point half the way along a course
export function routeMid({ pts }) {
  let left = length(pts) / 2;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (d >= left && d > 0) {
      const t = left / d;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    left -= d;
  }
  return pts[pts.length - 1];
}

export const jumpTime = (route) => Math.min(JUMP.max, (JUMP.base + JUMP.perSquare * route.squares) * (route.onLane ? 1 : JUMP.offLane));

// the lanes a route takes, in words: each with 'the' before it, two joined
// by 'and', more by commas and then 'and'
export function viaLanes(route) {
  if (!route) return '';
  if (!route.onLane) return 'off the lanes: a straight jump, slower, and the Empire watches those';
  const names = route.lanes.map((id) => `the ${ROUTES.find((l) => l.id === id).name}`);
  // two systems snapped to the one lane point: no lane between them to name
  if (!names.length) return 'a short hop, on the lanes';
  const last = names.pop();
  return `via ${names.length ? `${names.join(', ')} and ${last}` : last}`;
}
