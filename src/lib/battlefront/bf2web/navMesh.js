// The bots’ way across a level, as bf2-web plans it (WebPort/ai/nav-mesh.{h,cpp}): A* over the NavPower graph’s areas
// (each a convex polygon whose edges name the neighbouring area), then the funnel through the corridor’s portals, and
// the queries BattleAI’s Pathfinder asks (the closest point, whether a straight line stays on the mesh, a random
// reachable point to patrol to). It reads bf2-web’s BFNAVPK1 package, or a level pack’s own NavPower mesh
// (navmesh.js’s decode): Hoth’s `skirmish` mesh there is the same Skirmish graph bf2-web’s Arcade bots plan on, 1,967
// areas wound as bf2-web needs them (the interior on the negative side of each edge, x right, z up) with every portal
// paired. Float as the C++ counts it; navMesh.test.js replays its driver. Pure.
//
//   navFromMesh(mesh) → nav      mesh: navmesh.js’s decoded mesh ({ verts, polyEdges, edgeVert, edgeAdj })
//   loadNavPackage(bytes) → { status, nav }      createNavMesh(arrays) → nav
//   findArea(nav, pos, maxVertical = 2) → area | -1
//   closestPoint(nav, pos, maxDistance) → { area, point } (area -1: nothing that close)
//   surfaceHeight(nav, area, x, z)
//   findPath(nav, start, end, snap = 3) → { ok, points: [x, y, z, …], stats }
//   canGoStraight(nav, start, end, snap = 1.5) → { ok, collision }
//   isPointReachableFromPoint(nav, a, b, snap = 3)
//   findReachableRandomPosition(nav, start, center, radius, rng) → point | null   rng: { seed } (xorshift32, advanced)
//   findReachableSnappedPosition(nav, start, destination, maxSnap) → point | null
//   navRandom01(rng) → [0, 1)

const f = Math.fround;

export const NAV_STATUS = { ok: 0, truncated: 1, magic: 2, version: 3, counts: 4, size: 5, topology: 6, empty: 7 };

const cross2 = (ax, az, bx, bz) => f(f(ax * bz) - f(az * bx));
// Mononen’s triarea2 on x/z: positive when c lies clockwise of b seen from a
function triArea2(a, b, c) {
  const ax = f(b[0] - a[0]), az = f(b[2] - a[2]), bx = f(c[0] - a[0]), bz = f(c[2] - a[2]);
  return f(f(bx * az) - f(ax * bz));
}
const equalXZ = (a, b) => {
  const dx = f(a[0] - b[0]), dz = f(a[2] - b[2]);
  return f(f(dx * dx) + f(dz * dz)) < f(1e-8);
};
const distance3 = (a, b) => {
  const dx = f(a[0] - b[0]), dy = f(a[1] - b[1]), dz = f(a[2] - b[2]);
  return f(Math.sqrt(f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz))));
};

export function navRandom01(rng) {
  let x = rng.seed >>> 0 || 0x9e3779b9;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  rng.seed = x;
  return f((x >>> 8) * (1 / 16777216));
}

// A level pack’s NavPower mesh as the planner’s arrays: each polygon an area, its centre the mean of its vertices, its
// bounds over its vertices, each edge its start vertex and the area across it (-1: a wall)
export function navArraysFromMesh(mesh) {
  const A = mesh.polyEdges.length;
  const E = mesh.edgeVert.length;
  const areaPos = new Float32Array(3 * A);
  const areaBounds = new Float32Array(6 * A);
  const areaEdgeStart = new Uint32Array(A + 1);
  const edgePos = new Float32Array(3 * E);
  const edgeAdjacent = new Int32Array(E);
  let e = 0;
  for (let a = 0; a < A; a++) {
    areaEdgeStart[a] = e;
    const n = mesh.polyEdges[a];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const sum = [0, 0, 0];
    for (let j = 0; j < n; j++, e++) {
      const v = mesh.edgeVert[e];
      for (let k = 0; k < 3; k++) {
        const x = mesh.verts[3 * v + k];
        edgePos[3 * e + k] = x;
        sum[k] = f(sum[k] + x);
        if (x < min[k]) min[k] = x;
        if (x > max[k]) max[k] = x;
      }
      const adj = mesh.edgeAdj[e];
      edgeAdjacent[e] = adj < 0 || adj >= A ? -1 : adj;
    }
    for (let k = 0; k < 3; k++) {
      areaPos[3 * a + k] = f(sum[k] / n);
      areaBounds[6 * a + k] = min[k];
      areaBounds[6 * a + 3 + k] = max[k];
    }
  }
  areaEdgeStart[A] = E;
  return { areaPos, areaBounds, areaEdgeStart, edgePos, edgeAdjacent };
}

export const navFromMesh = (mesh) => createNavMesh(navArraysFromMesh(mesh));

// bf2-web’s BFNAVPK1 package (its runtime/nav/navgraph-v43.js buildNavPackage): a header, a JSON manifest with the
// counts, then the sections in a fixed order, four bytes a value
export function loadNavPackage(bytes) {
  const fail = (status) => ({ status, nav: null });
  if (!bytes || bytes.length < 16) return fail(NAV_STATUS.truncated);
  if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'BFNAVPK1') return fail(NAV_STATUS.magic);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(8, true) !== 1) return fail(NAV_STATUS.version);
  const manifestBytes = v.getUint32(12, true);
  if (manifestBytes % 4 !== 0 || 16 + manifestBytes > bytes.length) return fail(NAV_STATUS.truncated);
  const text = new TextDecoder('latin1').decode(bytes.subarray(16, 16 + manifestBytes));
  const at = text.indexOf('"counts":{');
  const count = (key) => {
    const m = at < 0 ? null : text.slice(at).match(new RegExp(`"${key}"[ :]*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const areas = count('areas');
  const edges = count('edges');
  if (areas === null || edges === null) return fail(NAV_STATUS.counts);
  if (areas === 0) return fail(NAV_STATUS.empty);
  if (16 + manifestBytes + 4 * (16 * areas + (areas + 1) + 6 * edges) !== bytes.length) return fail(NAV_STATUS.size);
  let p = 16 + manifestBytes;
  const floats = (n) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = v.getFloat32(p + 4 * i, true);
    p += 4 * n;
    return out;
  };
  const areaPos = floats(3 * areas);
  p += 4 * areas;
  const areaBounds = floats(6 * areas);
  p += 4 * areas;
  const flags1 = Array.from({ length: areas }, (_, a) => v.getUint32(p + 16 * a, true));
  p += 16 * areas + 4 * areas;
  const areaEdgeStart = new Uint32Array(areas + 1);
  for (let i = 0; i <= areas; i++) areaEdgeStart[i] = v.getUint32(p + 4 * i, true);
  p += 4 * (areas + 1);
  const edgePos = floats(3 * edges);
  const edgeAdjacent = new Int32Array(edges);
  for (let i = 0; i < edges; i++) edgeAdjacent[i] = v.getInt32(p + 4 * i, true);
  let valid = areaEdgeStart[0] === 0 && areaEdgeStart[areas] === edges;
  for (let a = 0; valid && a < areas; a++) {
    const n = areaEdgeStart[a + 1] - areaEdgeStart[a];
    valid = areaEdgeStart[a + 1] >= areaEdgeStart[a] && n >= 3 && n === (flags1[a] & 0x7f);
  }
  for (let e = 0; valid && e < edges; e++) valid = edgeAdjacent[e] >= -1 && edgeAdjacent[e] < areas;
  if (!valid) return fail(NAV_STATUS.topology);
  return { status: NAV_STATUS.ok, nav: createNavMesh({ areaPos, areaBounds, areaEdgeStart, edgePos, edgeAdjacent }) };
}

export function createNavMesh({ areaPos, areaBounds, areaEdgeStart, edgePos, edgeAdjacent }) {
  const A = areaEdgeStart.length - 1;
  const nav = { areaPos, areaBounds, areaEdgeStart, edgePos, edgeAdjacent, areaCount: A, edgeCount: edgeAdjacent.length };
  nav.areaXZ = new Float32Array(A);
  for (let a = 0; a < A; a++) {
    const s = areaEdgeStart[a], n = areaEdgeStart[a + 1] - s;
    let twice = 0;
    for (let j = 0; j < n; j++) {
      const v0 = vertex(nav, s + j), v1 = vertex(nav, s + ((j + 1) % n));
      twice = f(twice + f(f(v0[0] * v1[2]) - f(v1[0] * v0[2])));
    }
    nav.areaXZ[a] = f(Math.abs(twice) * 0.5);
  }
  buildGrid(nav);
  buildComponents(nav);
  return nav;
}

const vertex = (nav, e) => nav.edgePos.subarray(3 * e, 3 * e + 3);
const bounds = (nav, a) => nav.areaBounds.subarray(6 * a, 6 * a + 6);

function buildGrid(nav) {
  const A = nav.areaCount;
  let [minX, , minZ, maxX, , maxZ] = bounds(nav, 0);
  for (let a = 1; a < A; a++) {
    const b = bounds(nav, a);
    minX = Math.min(minX, b[0]);
    minZ = Math.min(minZ, b[2]);
    maxX = Math.max(maxX, b[3]);
    maxZ = Math.max(maxZ, b[5]);
  }
  let cell = 4;
  // the grid stays under a million cells for a large graph
  while (f(f(f(f(maxX - minX) / cell) * f(maxZ - minZ)) / cell) > 1.0e6) cell = f(cell * 2);
  nav.cellSize = cell;
  nav.gridMinX = minX;
  nav.gridMinZ = minZ;
  nav.gridW = Math.trunc(f(f(maxX - minX) / cell)) + 1;
  nav.gridH = Math.trunc(f(f(maxZ - minZ) / cell)) + 1;
  const lists = Array.from({ length: nav.gridW * nav.gridH }, () => []);
  for (let a = 0; a < A; a++) {
    const b = bounds(nav, a);
    const [x0, z0, x1, z1] = cellRange(nav, b[0], b[2], b[3], b[5]);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) lists[z * nav.gridW + x].push(a);
  }
  nav.cells = lists;
}

function cellRange(nav, minX, minZ, maxX, maxZ) {
  const cx = (v) => Math.max(0, Math.min(nav.gridW - 1, Math.floor(f(f(v - nav.gridMinX) / nav.cellSize))));
  const cz = (v) => Math.max(0, Math.min(nav.gridH - 1, Math.floor(f(f(v - nav.gridMinZ) / nav.cellSize))));
  return [cx(minX), cz(minZ), cx(maxX), cz(maxZ)];
}

function buildComponents(nav) {
  const A = nav.areaCount;
  const component = new Int32Array(A).fill(-1);
  let count = 0;
  for (let seed = 0; seed < A; seed++) {
    if (component[seed] >= 0) continue;
    const id = count++;
    component[seed] = id;
    const stack = [seed];
    while (stack.length) {
      const a = stack.pop();
      for (let e = nav.areaEdgeStart[a]; e < nav.areaEdgeStart[a + 1]; e++) {
        const b = nav.edgeAdjacent[e];
        if (b >= 0 && component[b] < 0) {
          component[b] = id;
          stack.push(b);
        }
      }
    }
  }
  nav.component = component;
  nav.componentCount = count;
}

function insideXZ(nav, a, x, z, epsilon = f(1e-4)) {
  const s = nav.areaEdgeStart[a], n = nav.areaEdgeStart[a + 1] - s;
  for (let j = 0; j < n; j++) {
    const p = vertex(nav, s + j), q = vertex(nav, s + ((j + 1) % n));
    if (cross2(f(q[0] - p[0]), f(q[2] - p[2]), f(x - p[0]), f(z - p[2])) > epsilon) return false;
  }
  return true;
}

export function surfaceHeight(nav, a, x, z) {
  x = f(x);
  z = f(z);
  const s = nav.areaEdgeStart[a], n = nav.areaEdgeStart[a + 1] - s;
  const v0 = vertex(nav, s);
  for (let k = 1; k + 1 < n; k++) {
    const v1 = vertex(nav, s + k), v2 = vertex(nav, s + k + 1);
    const d = cross2(f(v1[0] - v0[0]), f(v1[2] - v0[2]), f(v2[0] - v0[0]), f(v2[2] - v0[2]));
    if (Math.abs(d) < f(1e-12)) continue;
    const b1 = f(cross2(f(x - v0[0]), f(z - v0[2]), f(v2[0] - v0[0]), f(v2[2] - v0[2])) / d);
    const b2 = f(cross2(f(v1[0] - v0[0]), f(v1[2] - v0[2]), f(x - v0[0]), f(z - v0[2])) / d);
    if (b1 >= f(-1e-4) && b2 >= f(-1e-4) && f(b1 + b2) <= f(1.0001)) return f(f(v0[1] + f(b1 * f(v1[1] - v0[1]))) + f(b2 * f(v2[1] - v0[1])));
  }
  let y = 0;
  for (let j = 0; j < n; j++) y = f(y + vertex(nav, s + j)[1]);
  return f(y / n);
}

// The area's point nearest pos. With `inPlace` the answer is written over pos as the edges are walked, so the edges
// after a nearer one are measured from the point moved there: findPath's partial end calls the C++ with its input and
// output the same array, and this keeps that.
function closestInArea(nav, a, pos, inPlace = false) {
  const out = inPlace ? pos : [0, 0, 0];
  if (insideXZ(nav, a, pos[0], pos[2])) {
    const y = surfaceHeight(nav, a, pos[0], pos[2]);
    [out[0], out[1], out[2]] = [pos[0], y, pos[2]];
    return out;
  }
  const s = nav.areaEdgeStart[a], n = nav.areaEdgeStart[a + 1] - s;
  let best = Infinity;
  for (let j = 0; j < n; j++) {
    const p = vertex(nav, s + j), q = vertex(nav, s + ((j + 1) % n));
    const dx = f(q[0] - p[0]), dz = f(q[2] - p[2]), len2 = f(f(dx * dx) + f(dz * dz));
    let t = len2 > 0 ? f(f(f(f(pos[0] - p[0]) * dx) + f(f(pos[2] - p[2]) * dz)) / len2) : 0;
    t = Math.max(0, Math.min(1, t));
    const c = [f(p[0] + f(t * dx)), f(p[1] + f(t * f(q[1] - p[1]))), f(p[2] + f(t * dz))];
    const d = f(f(f(c[0] - pos[0]) * f(c[0] - pos[0])) + f(f(c[2] - pos[2]) * f(c[2] - pos[2])));
    if (d < best) {
      best = d;
      [out[0], out[1], out[2]] = c;
    }
  }
  return out;
}

const f3 = (p) => [f(p[0]), f(p[1]), f(p[2])];

export function findArea(nav, pos, maxVertical = 2) {
  pos = f3(pos);
  maxVertical = f(maxVertical);
  const [x0, z0] = cellRange(nav, pos[0], pos[2], pos[0], pos[2]);
  let best = -1;
  let bestDy = maxVertical;
  for (const a of nav.cells[z0 * nav.gridW + x0]) {
    const b = bounds(nav, a);
    const e = f(1e-3);
    if (pos[0] < f(b[0] - e) || pos[0] > f(b[3] + e) || pos[2] < f(b[2] - e) || pos[2] > f(b[5] + e) || !insideXZ(nav, a, pos[0], pos[2])) continue;
    const dy = Math.abs(f(surfaceHeight(nav, a, pos[0], pos[2]) - pos[1]));
    if (dy <= bestDy && (best < 0 || dy < bestDy || a < best)) {
      bestDy = dy;
      best = a;
    }
  }
  return best;
}

// the cell lists’ areas under a box, each once, in order
function areasIn(nav, minX, minZ, maxX, maxZ) {
  const [x0, z0, x1, z1] = cellRange(nav, minX, minZ, maxX, maxZ);
  const seen = new Set();
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (const a of nav.cells[z * nav.gridW + x]) seen.add(a);
  return [...seen].sort((a, b) => a - b);
}

export function closestPoint(nav, pos, maxDistance) {
  pos = f3(pos);
  maxDistance = f(maxDistance);
  // an area holding the point in x/z within the vertical reach wins over a neighbour whose surface is nearer in 3D (the
  // nav surface lies up to ~0.9 m under the render floor on Hoth)
  const holding = findArea(nav, pos, Math.min(maxDistance, 2));
  if (holding >= 0) return { area: holding, point: [pos[0], surfaceHeight(nav, holding, pos[0], pos[2]), pos[2]] };
  let best = -1;
  let bestDistance = maxDistance;
  let point = [0, 0, 0];
  for (const a of areasIn(nav, f(pos[0] - maxDistance), f(pos[2] - maxDistance), f(pos[0] + maxDistance), f(pos[2] + maxDistance))) {
    const b = bounds(nav, a);
    if (pos[0] < f(b[0] - maxDistance) || pos[0] > f(b[3] + maxDistance) || pos[2] < f(b[2] - maxDistance) || pos[2] > f(b[5] + maxDistance) ||
      pos[1] < f(b[1] - maxDistance) || pos[1] > f(b[4] + maxDistance)) continue;
    const c = closestInArea(nav, a, pos);
    const d = distance3(c, pos);
    if (d < bestDistance || (d === bestDistance && best >= 0 && a < best) || (best < 0 && d <= bestDistance)) {
      bestDistance = d;
      best = a;
      point = c;
    }
  }
  return { area: best, point };
}

// the edge the segment leaves an area through (past t), and where along start → end; -1 when it ends inside
function exitEdge(nav, a, start, end, tFrom) {
  const s = nav.areaEdgeStart[a], n = nav.areaEdgeStart[a + 1] - s;
  const dx = f(end[0] - start[0]), dz = f(end[2] - start[2]);
  let edge = -1;
  let tExit = 1;
  let edgeIsPortal = false;
  for (let j = 0; j < n; j++) {
    const p = vertex(nav, s + j), q = vertex(nav, s + ((j + 1) % n));
    const ex = f(q[0] - p[0]), ez = f(q[2] - p[2]);
    // > 0: the line moves to the outside of this edge
    const denominator = cross2(ex, ez, dx, dz);
    if (denominator <= f(1e-12)) continue;
    // it leaves through this edge only when its end lies more than 1 mm outside (a segment along a wall or through a
    // funnel corner grazes the edge without crossing it)
    const length = f(Math.sqrt(f(f(ex * ex) + f(ez * ez))));
    if (length <= 0 || cross2(ex, ez, f(end[0] - p[0]), f(end[2] - p[2])) <= f(f(1e-3) * length)) continue;
    const t = f(-cross2(ex, ez, f(start[0] - p[0]), f(start[2] - p[2])) / denominator);
    const portal = nav.edgeAdjacent[s + j] >= 0;
    // through a vertex two edges give the same t: the portal is the way the segment goes on
    if (t < f(tExit - f(1e-5)) || (t <= f(tExit + f(1e-5)) && portal && !edgeIsPortal)) {
      tExit = t;
      edge = j;
      edgeIsPortal = portal;
    }
  }
  if (edge < 0) return null;
  return { edge, t: Math.max(tExit, tFrom) };
}

export function canGoStraight(nav, start, end, snap = 1.5) {
  start = f3(start);
  end = f3(end);
  let from = null;
  // the start area is the one the segment enters: a start on a portal or a funnel corner touches several
  let area = -1;
  const dx = f(end[0] - start[0]), dz = f(end[2] - start[2]), length = f(Math.sqrt(f(f(dx * dx) + f(dz * dz))));
  if (length > f(1e-4)) {
    const step = Math.min(1, f(f(0.01) / length));
    area = findArea(nav, [f(start[0] + f(dx * step)), start[1], f(start[2] + f(dz * step))], 2);
    if (area >= 0) from = [start[0], surfaceHeight(nav, area, start[0], start[2]), start[2]];
  }
  // off the mesh: from the start’s closest mesh point
  if (area < 0) {
    const c = closestPoint(nav, start, snap);
    area = c.area;
    from = c.point;
  }
  if (area < 0) return { ok: false, collision: [...start] };
  let t = 0;
  for (let guard = 0; guard <= nav.areaCount; guard++) {
    const exit = exitEdge(nav, area, from, end, t);
    if (!exit) return { ok: true, collision: [0, 0, 0] };
    const next = nav.edgeAdjacent[nav.areaEdgeStart[area] + exit.edge];
    if (next < 0) return { ok: false, collision: [0, 1, 2].map((k) => f(from[k] + f(f(end[k] - from[k]) * exit.t))) };
    area = next;
    t = exit.t;
  }
  return { ok: false, collision: [0, 0, 0] };
}

export const isPointReachableFromPoint = (nav, a, b, snap = 3) => {
  const x = closestPoint(nav, a, snap).area;
  const y = closestPoint(nav, b, snap).area;
  return x >= 0 && y >= 0 && nav.component[x] === nav.component[y];
};

// a binary heap of [cost, area], least first (ties by the area)
function heap() {
  const items = [];
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  return {
    get size() {
      return items.length;
    },
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!less(items[i], items[parent])) break;
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < items.length && less(items[l], items[m])) m = l;
          if (r < items.length && less(items[r], items[m])) m = r;
          if (m === i) break;
          [items[i], items[m]] = [items[m], items[i]];
          i = m;
        }
      }
      return top;
    },
  };
}

export function findPath(nav, startIn, endIn, snap = 3) {
  startIn = f3(startIn);
  endIn = f3(endIn);
  const stats = { expanded: 0, corridor: 0, points: 0, length: 0, startArea: -1, endArea: -1, snappedStart: false, snappedEnd: false, partial: false };
  const s0 = closestPoint(nav, startIn, snap);
  const e0 = closestPoint(nav, endIn, snap);
  const startArea = s0.area;
  let endArea = e0.area;
  const start = s0.point;
  let end = e0.point;
  stats.startArea = startArea;
  stats.endArea = endArea;
  if (startArea < 0 || endArea < 0) return { ok: false, points: [], stats };
  stats.snappedStart = distance3(start, startIn) > f(1e-3) && !insideXZ(nav, startArea, startIn[0], startIn[2]);
  stats.snappedEnd = distance3(end, endIn) > f(1e-3) && !insideXZ(nav, endArea, endIn[0], endIn[2]);
  if (nav.component[startArea] !== nav.component[endArea]) {
    // the reachable area nearest the end: the path goes as near as the start’s island allows
    stats.partial = true;
    let bestDistance = Infinity;
    let best = -1;
    const comp = nav.component[startArea];
    for (let a = 0; a < nav.areaCount; a++) {
      if (nav.component[a] !== comp) continue;
      const d = distance3(closestInArea(nav, a, end), end);
      if (d < bestDistance) {
        bestDistance = d;
        best = a;
      }
    }
    endArea = best;
    end = closestInArea(nav, endArea, [...end], true);
    stats.endArea = endArea;
  }
  const corridor = [];
  const entryEdge = [];
  if (startArea === endArea) corridor.push(startArea);
  else {
    // A* over areas; a node stands at the middle of the portal it was entered through
    const A = nav.areaCount;
    const g = new Float64Array(A).fill(Infinity);
    const pos = new Float32Array(3 * A);
    const parent = new Int32Array(A).fill(-1);
    const parentEdge = new Uint32Array(A);
    const closed = new Uint8Array(A);
    const open = heap();
    g[startArea] = 0;
    pos.set(start, 3 * startArea);
    open.push([distance3(start, end), startArea]);
    let found = false;
    while (open.size) {
      const a = open.pop()[1];
      if (closed[a]) continue;
      closed[a] = 1;
      stats.expanded++;
      if (a === endArea) {
        found = true;
        break;
      }
      const s = nav.areaEdgeStart[a], n = nav.areaEdgeStart[a + 1] - s;
      const pa = pos.subarray(3 * a, 3 * a + 3);
      for (let j = 0; j < n; j++) {
        const b = nav.edgeAdjacent[s + j];
        if (b < 0 || closed[b]) continue;
        const p = vertex(nav, s + j), q = vertex(nav, s + ((j + 1) % n));
        const mid = [f(f(p[0] + q[0]) * 0.5), f(f(p[1] + q[1]) * 0.5), f(f(p[2] + q[2]) * 0.5)];
        let cost = f(g[a] + distance3(pa, mid));
        if (b === endArea) cost = f(cost + distance3(mid, end));
        if (cost < g[b]) {
          g[b] = cost;
          parent[b] = a;
          parentEdge[b] = s + j;
          pos.set(mid, 3 * b);
          open.push([b === endArea ? cost : f(cost + distance3(mid, end)), b]);
        }
      }
    }
    if (!found) return { ok: false, points: [], stats };
    for (let a = endArea; a >= 0; a = parent[a]) {
      corridor.push(a);
      entryEdge.push(parentEdge[a]);
      if (a === startArea) break;
    }
    corridor.reverse();
    entryEdge.reverse();
  }
  stats.corridor = corridor.length;
  // the funnel (Mononen’s simple stupid funnel) over the portals: the start, each portal (left p, right q of the edge
  // p → q of the area it leaves), the end
  const portals = [[start, start]];
  for (let i = 1; i < corridor.length; i++) {
    const from = corridor[i - 1];
    const s = nav.areaEdgeStart[from], n = nav.areaEdgeStart[from + 1] - s;
    const e = entryEdge[i];
    portals.push([[...vertex(nav, e)], [...vertex(nav, s + ((e - s + 1) % n))]]);
  }
  portals.push([end, end]);
  let apex = [...portals[0][0]];
  let left = [...portals[0][0]];
  let right = [...portals[0][1]];
  let apexIndex = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  const points = [...apex];
  for (let i = 1; i < portals.length; i++) {
    const [l, r] = portals[i];
    if (triArea2(apex, right, r) <= 0) {
      if (equalXZ(apex, right) || triArea2(apex, left, r) > 0) {
        right = [...r];
        rightIndex = i;
      } else {
        points.push(...left);
        apex = [...left];
        apexIndex = leftIndex;
        right = [...apex];
        leftIndex = rightIndex = apexIndex;
        i = apexIndex;
        continue;
      }
    }
    if (triArea2(apex, left, l) >= 0) {
      if (equalXZ(apex, left) || triArea2(apex, right, l) < 0) {
        left = [...l];
        leftIndex = i;
      } else {
        points.push(...right);
        apex = [...right];
        apexIndex = rightIndex;
        left = [...apex];
        leftIndex = rightIndex = apexIndex;
        i = apexIndex;
        continue;
      }
    }
  }
  const last = portals[portals.length - 1][0];
  if (points.length < 3 || !equalXZ(points.slice(-3), last) || points.length === 3) points.push(...last);
  stats.points = points.length / 3;
  for (let i = 3; i < points.length; i += 3) stats.length = f(stats.length + distance3(points.slice(i - 3, i), points.slice(i, i + 3)));
  return { ok: true, points, stats };
}

export function findReachableRandomPosition(nav, start, center, radius, rng) {
  start = f3(start);
  center = f3(center);
  radius = f(radius);
  const startArea = closestPoint(nav, start, 3).area;
  if (startArea < 0) return null;
  const comp = nav.component[startArea];
  const picks = [];
  const weights = [];
  let total = 0;
  for (const a of areasIn(nav, f(center[0] - radius), f(center[2] - radius), f(center[0] + radius), f(center[2] + radius))) {
    if (nav.component[a] !== comp) continue;
    const dx = f(nav.areaPos[3 * a] - center[0]), dz = f(nav.areaPos[3 * a + 2] - center[2]);
    if (f(f(dx * dx) + f(dz * dz)) > f(radius * radius)) continue;
    picks.push(a);
    total = f(total + nav.areaXZ[a]);
    weights.push(total);
  }
  if (!picks.length || total <= 0) return null;
  const upper = (list, x) => {
    let i = 0;
    while (i < list.length && !(x < list[i])) i++;
    return i;
  };
  const r = f(navRandom01(rng) * total);
  const a = picks[Math.min(upper(weights, r), picks.length - 1)];
  // a uniform point of the convex polygon: a fan triangle by area, then a uniform point in it
  const s = nav.areaEdgeStart[a], n = nav.areaEdgeStart[a + 1] - s;
  const v0 = vertex(nav, s);
  const fan = [];
  let fanTotal = 0;
  for (let k = 1; k + 1 < n; k++) {
    const v1 = vertex(nav, s + k), v2 = vertex(nav, s + k + 1);
    fanTotal = f(fanTotal + f(Math.abs(cross2(f(v1[0] - v0[0]), f(v1[2] - v0[2]), f(v2[0] - v0[0]), f(v2[2] - v0[2]))) * 0.5));
    fan.push(fanTotal);
  }
  const rt = f(navRandom01(rng) * fanTotal);
  const k = 1 + Math.min(upper(fan, rt), fan.length - 1);
  const v1 = vertex(nav, s + k), v2 = vertex(nav, s + k + 1);
  let u = navRandom01(rng);
  let w = navRandom01(rng);
  if (f(u + w) > 1) {
    u = f(1 - u);
    w = f(1 - w);
  }
  return [0, 1, 2].map((c) => f(f(v0[c] + f(u * f(v1[c] - v0[c]))) + f(w * f(v2[c] - v0[c]))));
}

export function findReachableSnappedPosition(nav, start, destination, maxSnap) {
  destination = f3(destination);
  maxSnap = f(maxSnap);
  const startArea = closestPoint(nav, start, 3).area;
  if (startArea < 0) return null;
  const comp = nav.component[startArea];
  const [x0, z0, x1, z1] = cellRange(nav, f(destination[0] - maxSnap), f(destination[2] - maxSnap), f(destination[0] + maxSnap), f(destination[2] + maxSnap));
  let best = maxSnap;
  let out = null;
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      for (const a of nav.cells[z * nav.gridW + x]) {
        if (nav.component[a] !== comp) continue;
        const point = closestInArea(nav, a, destination);
        const d = distance3(point, destination);
        if (d < best || (!out && d <= best)) {
          best = d;
          out = point;
        }
      }
    }
  }
  return out;
}
