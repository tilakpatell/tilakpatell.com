// A level's navmesh: the game's own NavPower polygons (scripts/bf2017-navmesh.mjs
// reads them out of the PathfindingBlobAsset chunks; bf2-re findings/57 has the
// blob's layout) and the level designers' hand links, in the pack's frame. Pure:
// no three.js, no DOM. The polygons are convex and planar, wound
// counter-clockwise seen from above; the floors of a building's storeys overlap
// in x–z and are told apart by height.
//
// The file (navmesh.bin, little-endian, every section 4-byte aligned):
//
//   0   'NAVM'   4   u32 version (1)   8   u32 meshes   12  u32 links
//   16  f32×3 origin (the game's position of the pack's 0, 0, 0)   28  f32 yaw
//   32  the meshes' directory, 64 bytes each:
//       char[16] name, u32 verts, u32 polys, u32 edges, u32 offset (of its data),
//       f32 radius, f32 step, f32 height, f32 voxel (the agent it was baked for),
//       u32 layer, u32 flags (bit 0: indices are u32, else u16), u32 links (a bit a
//       link source: which of the file's links the game turns on with this mesh), u32 0
//   then the links, 64 bytes each:
//       u8 points (2–4), u8 flags (bit 0 both ways, bit 1 on at the start),
//       u8 source (an index: the layer it came from), u8 0, f32 radius,
//       f32 snap (MaxSnapDist), f32 0, f32×3 × 4 points (the first and last are its ends)
//   then each mesh's data, at its offset:
//       f32×3 × verts, u8 × polys edges a polygon, u8 × polys flags (bit 0: the
//       game's area flag 31), then u16 or u32 × edges: the vertex each edge starts
//       at (edge i of a polygon runs to edge i+1's vertex), u16 or u32 × edges: the
//       polygon across the edge (all ones: a wall), u8 × edges flags (bit 0: the
//       game's edge bit 15, bit 1: bit 13)
//
//   encodeNavmesh({ origin, yaw, meshes: [{ name, radius, step, height, voxel, layer, links, verts,
//                   polyEdges, polyFlags, edgeVert, edgeAdj, edgeFlags }], links: [{ points, both, start,
//                   source, radius, snap }] }) → Uint8Array
//   decodeNavmesh(buffer) → the same shape (typed arrays)
//   load(buffer, { mesh, links, cell }) → a navmesh (below); every point is [x, y, z] in the pack's frame
//     .locate(x, y, z, { above, below }) → the polygon under the point (the nearest floor in height), or −1
//     .heightOn(poly, x, z) → the polygon's plane's height there
//     .nearest(x, y, z, { radius }) → { poly, point, distance } | null
//     .raycast(from, to) → { hit, t, point, poly, edge } along the mesh, stopped by the first wall
//     .route(from, to, { snap, dense, maxExpand }) → { points, polys, links, length, expanded } | null
//     .findPath(from, to, opts) → [[x, y, z], …] | null
//     .addLink({ points, both, snap }) → a link added at run time (a door opened), the islands joined again
//     .island(poly), .polygon(poly), .toPack([x, y, z]), .toGame([x, y, z])

const MAGIC = 0x4d56414e; // 'NAVM'
const VERSION = 1;
const HEAD = 32;
const DIR = 64;
const LINK = 64;
const align = (n) => (n + 3) & ~3;

export function encodeNavmesh({ origin = [0, 0, 0], yaw = 0, meshes, links = [] }) {
  const layout = [];
  let at = HEAD + meshes.length * DIR + links.length * LINK;
  for (const m of meshes) {
    const V = m.verts.length / 3;
    const P = m.polyEdges.length;
    const E = m.edgeVert.length;
    const wide = V >= 0xffff || P >= 0xffff;
    const w = wide ? 4 : 2;
    const parts = { verts: at, polyEdges: at + V * 12 };
    parts.polyFlags = align(parts.polyEdges + P);
    parts.edgeVert = align(parts.polyFlags + P);
    parts.edgeAdj = align(parts.edgeVert + E * w);
    parts.edgeFlags = align(parts.edgeAdj + E * w);
    const end = align(parts.edgeFlags + E);
    layout.push({ m, V, P, E, wide, w, at, parts });
    at = end;
  }
  const out = new Uint8Array(at);
  const v = new DataView(out.buffer);
  v.setUint32(0, MAGIC, true);
  v.setUint32(4, VERSION, true);
  v.setUint32(8, meshes.length, true);
  v.setUint32(12, links.length, true);
  origin.forEach((q, i) => v.setFloat32(16 + i * 4, q, true));
  v.setFloat32(28, yaw, true);
  layout.forEach(({ m, V, P, E, wide, w, at: start, parts }, i) => {
    const d = HEAD + i * DIR;
    const name = String(m.name).slice(0, 15);
    for (let c = 0; c < name.length; c++) out[d + c] = name.charCodeAt(c) & 0x7f;
    [V, P, E, start].forEach((q, k) => v.setUint32(d + 16 + k * 4, q, true));
    [m.radius, m.step, m.height, m.voxel].forEach((q, k) => v.setFloat32(d + 32 + k * 4, q ?? 0, true));
    v.setUint32(d + 48, m.layer ?? 0, true);
    v.setUint32(d + 52, wide ? 1 : 0, true);
    v.setUint32(d + 56, m.links ?? 0, true);
    new Float32Array(out.buffer, parts.verts, V * 3).set(m.verts);
    out.set(m.polyEdges, parts.polyEdges);
    out.set(m.polyFlags ?? new Uint8Array(P), parts.polyFlags);
    const none = wide ? 0xffffffff : 0xffff;
    for (let e = 0; e < E; e++) {
      const adj = m.edgeAdj[e];
      if (w === 4) {
        v.setUint32(parts.edgeVert + e * 4, m.edgeVert[e], true);
        v.setUint32(parts.edgeAdj + e * 4, adj < 0 ? none : adj, true);
      } else {
        v.setUint16(parts.edgeVert + e * 2, m.edgeVert[e], true);
        v.setUint16(parts.edgeAdj + e * 2, adj < 0 ? none : adj, true);
      }
    }
    out.set(m.edgeFlags ?? new Uint8Array(E), parts.edgeFlags);
  });
  links.forEach((l, i) => {
    const d = HEAD + meshes.length * DIR + i * LINK;
    const pts = l.points.slice(0, 4);
    out[d] = pts.length;
    out[d + 1] = (l.both ? 1 : 0) | (l.start ? 2 : 0);
    out[d + 2] = l.source ?? 0;
    v.setFloat32(d + 4, l.radius ?? 1, true);
    v.setFloat32(d + 8, l.snap ?? 0, true);
    pts.forEach((p, k) => p.forEach((q, c) => v.setFloat32(d + 16 + k * 12 + c * 4, q, true)));
  });
  return out;
}

export function decodeNavmesh(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEAD || v.getUint32(0, true) !== MAGIC) throw new Error('navmesh: not a navmesh.bin');
  if (v.getUint32(4, true) !== VERSION) throw new Error(`navmesh: version ${v.getUint32(4, true)}`);
  const nm = v.getUint32(8, true);
  const nl = v.getUint32(12, true);
  const origin = [0, 1, 2].map((i) => v.getFloat32(16 + i * 4, true));
  const yaw = v.getFloat32(28, true);
  // a copy of the bytes, so every typed array below is aligned
  const own = new Uint8Array(bytes);
  const meshes = [];
  for (let i = 0; i < nm; i++) {
    const d = HEAD + i * DIR;
    let name = '';
    for (let c = 0; c < 16 && own[d + c]; c++) name += String.fromCharCode(own[d + c]);
    const [V, P, E, at] = [0, 1, 2, 3].map((k) => v.getUint32(d + 16 + k * 4, true));
    const [radius, step, height, voxel] = [0, 1, 2, 3].map((k) => v.getFloat32(d + 32 + k * 4, true));
    const wide = (v.getUint32(d + 52, true) & 1) === 1;
    const w = wide ? 4 : 2;
    const polyEdges = own.subarray(at + V * 12, at + V * 12 + P);
    const pf = align(at + V * 12 + P);
    const ev = align(pf + P);
    const ea = align(ev + E * w);
    const ef = align(ea + E * w);
    const Index = wide ? Uint32Array : Uint16Array;
    const rawAdj = new Index(own.buffer, ea, E);
    const none = wide ? 0xffffffff : 0xffff;
    const edgeAdj = new Int32Array(E);
    for (let e = 0; e < E; e++) edgeAdj[e] = rawAdj[e] === none ? -1 : rawAdj[e];
    meshes.push({
      name,
      radius,
      step,
      height,
      voxel,
      layer: v.getUint32(d + 48, true),
      links: v.getUint32(d + 56, true),
      verts: new Float32Array(own.buffer, at, V * 3),
      polyEdges,
      polyFlags: own.subarray(pf, pf + P),
      edgeVert: Uint32Array.from(new Index(own.buffer, ev, E)),
      edgeAdj,
      edgeFlags: own.subarray(ef, ef + E),
    });
  }
  const links = [];
  for (let i = 0; i < nl; i++) {
    const d = HEAD + nm * DIR + i * LINK;
    const n = own[d];
    const points = [];
    for (let k = 0; k < n; k++) points.push([0, 1, 2].map((c) => v.getFloat32(d + 16 + k * 12 + c * 4, true)));
    links.push({ points, both: (own[d + 1] & 1) === 1, start: (own[d + 1] & 2) === 2, source: own[d + 2], radius: v.getFloat32(d + 4, true), snap: v.getFloat32(d + 8, true) });
  }
  return { origin, yaw, meshes, links };
}

// ---- the queries ----

// a binary heap of (key, value) on two growable arrays
function heap() {
  let keys = new Float64Array(1024);
  let vals = new Int32Array(1024);
  let n = 0;
  return {
    get size() {
      return n;
    },
    clear() {
      n = 0;
    },
    push(k, x) {
      if (n === keys.length) {
        const k2 = new Float64Array(n * 2);
        k2.set(keys);
        keys = k2;
        const v2 = new Int32Array(n * 2);
        v2.set(vals);
        vals = v2;
      }
      let i = n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] <= k) break;
        keys[i] = keys[p];
        vals[i] = vals[p];
        i = p;
      }
      keys[i] = k;
      vals[i] = x;
    },
    pop() {
      const top = vals[0];
      const k = keys[--n];
      const x = vals[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= k) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = k;
      vals[i] = x;
      return top;
    },
  };
}

// the z of (a − o) × (b − o) in x–z: > 0 when b is counter-clockwise of a seen from above
const cross = (ox, oz, ax, az, bx, bz) => (ax - ox) * (bz - oz) - (az - oz) * (bx - ox);

export function load(buffer, { mesh = 0, links: useLinks = true, cell = 4 } = {}) {
  const file = decodeNavmesh(buffer);
  const m = typeof mesh === 'string' ? file.meshes.find((q) => q.name === mesh) : file.meshes[mesh];
  if (!m) throw new Error(`navmesh: no mesh ${mesh}`);
  const { verts, polyEdges, edgeVert, edgeAdj } = m;
  const P = polyEdges.length;
  const start = new Uint32Array(P + 1);
  for (let p = 0; p < P; p++) start[p + 1] = start[p] + polyEdges[p];
  const X = (vi) => verts[vi * 3];
  const Y = (vi) => verts[vi * 3 + 1];
  const Z = (vi) => verts[vi * 3 + 2];

  // a plane a polygon (y = a x + b z + c, Newell's normal) and its centre and x–z box
  const plane = new Float64Array(P * 3);
  const centre = new Float64Array(P * 3);
  const box = new Float64Array(P * 4);
  for (let p = 0; p < P; p++) {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    const n = polyEdges[p];
    for (let i = 0; i < n; i++) {
      const a = edgeVert[start[p] + i];
      const b = edgeVert[start[p] + ((i + 1) % n)];
      nx += (Y(a) - Y(b)) * (Z(a) + Z(b));
      ny += (Z(a) - Z(b)) * (X(a) + X(b));
      nz += (X(a) - X(b)) * (Y(a) + Y(b));
      cx += X(a) / n;
      cy += Y(a) / n;
      cz += Z(a) / n;
      x0 = Math.min(x0, X(a));
      x1 = Math.max(x1, X(a));
      z0 = Math.min(z0, Z(a));
      z1 = Math.max(z1, Z(a));
    }
    const flat = Math.abs(ny) < 1e-9;
    plane[p * 3] = flat ? 0 : -nx / ny;
    plane[p * 3 + 1] = flat ? 0 : -nz / ny;
    plane[p * 3 + 2] = flat ? cy : cy + (nx * cx + nz * cz) / ny;
    centre.set([cx, cy, cz], p * 3);
    box.set([x0, z0, x1, z1], p * 4);
  }
  const heightOn = (p, x, z) => plane[p * 3] * x + plane[p * 3 + 1] * z + plane[p * 3 + 2];

  // the x–z grid of the polygons' boxes (cell metres)
  let gx0 = Infinity;
  let gz0 = Infinity;
  let gx1 = -Infinity;
  let gz1 = -Infinity;
  for (let p = 0; p < P; p++) {
    gx0 = Math.min(gx0, box[p * 4]);
    gz0 = Math.min(gz0, box[p * 4 + 1]);
    gx1 = Math.max(gx1, box[p * 4 + 2]);
    gz1 = Math.max(gz1, box[p * 4 + 3]);
  }
  const GW = Math.max(1, Math.ceil((gx1 - gx0) / cell) + 1);
  const GH = Math.max(1, Math.ceil((gz1 - gz0) / cell) + 1);
  const cellX = (x) => Math.min(GW - 1, Math.max(0, Math.floor((x - gx0) / cell)));
  const cellZ = (z) => Math.min(GH - 1, Math.max(0, Math.floor((z - gz0) / cell)));
  const cellCount = new Uint32Array(GW * GH + 1);
  const eachCell = (p, fn) => {
    const i0 = cellX(box[p * 4]);
    const i1 = cellX(box[p * 4 + 2]);
    const j0 = cellZ(box[p * 4 + 1]);
    const j1 = cellZ(box[p * 4 + 3]);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * GW + i);
  };
  for (let p = 0; p < P; p++) eachCell(p, (c) => cellCount[c + 1]++);
  for (let c = 0; c < GW * GH; c++) cellCount[c + 1] += cellCount[c];
  const cellPolys = new Uint32Array(cellCount[GW * GH]);
  const fill = cellCount.slice(0, GW * GH);
  for (let p = 0; p < P; p++) eachCell(p, (c) => (cellPolys[fill[c]++] = p));

  // x–z inside a convex polygon (counter-clockwise from above), edges included
  const inside = (p, x, z, eps = 1e-4) => {
    if (x < box[p * 4] - eps || x > box[p * 4 + 2] + eps || z < box[p * 4 + 1] - eps || z > box[p * 4 + 3] + eps) return false;
    const n = polyEdges[p];
    for (let i = 0; i < n; i++) {
      const a = edgeVert[start[p] + i];
      const b = edgeVert[start[p] + ((i + 1) % n)];
      const len = Math.hypot(X(b) - X(a), Z(b) - Z(a)) || 1;
      if (cross(X(a), Z(a), X(b), Z(b), x, z) / len > eps) return false;
    }
    return true;
  };

  function locate(x, y, z, { above = 1, below = 3 } = {}) {
    if (x < gx0 - 1 || x > gx1 + 1 || z < gz0 - 1 || z > gz1 + 1) return -1;
    const c = cellZ(z) * GW + cellX(x);
    let best = -1;
    let bestD = Infinity;
    for (let k = cellCount[c]; k < cellCount[c + 1]; k++) {
      const p = cellPolys[k];
      if (!inside(p, x, z)) continue;
      const h = heightOn(p, x, z);
      if (h > y + above || h < y - below) continue;
      const d = Math.abs(h - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // the x–z point of a polygon nearest (x, z): itself when inside, else on its rim
  const closestOn = (p, x, z) => {
    if (inside(p, x, z)) return [x, z];
    let bx = x;
    let bz = z;
    let bd = Infinity;
    const n = polyEdges[p];
    for (let i = 0; i < n; i++) {
      const a = edgeVert[start[p] + i];
      const b = edgeVert[start[p] + ((i + 1) % n)];
      const dx = X(b) - X(a);
      const dz = Z(b) - Z(a);
      const t = Math.max(0, Math.min(1, ((x - X(a)) * dx + (z - Z(a)) * dz) / (dx * dx + dz * dz || 1)));
      const qx = X(a) + t * dx;
      const qz = Z(a) + t * dz;
      const d = (qx - x) ** 2 + (qz - z) ** 2;
      if (d < bd) {
        bd = d;
        bx = qx;
        bz = qz;
      }
    }
    return [bx, bz];
  };

  const seenStamp = new Uint32Array(P);
  let stamp = 0;
  function nearest(x, y, z, { radius = 8 } = {}) {
    stamp++;
    const i0 = cellX(x - radius);
    const i1 = cellX(x + radius);
    const j0 = cellZ(z - radius);
    const j1 = cellZ(z + radius);
    let best = null;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = j * GW + i;
        for (let k = cellCount[c]; k < cellCount[c + 1]; k++) {
          const p = cellPolys[k];
          if (seenStamp[p] === stamp) continue;
          seenStamp[p] = stamp;
          if (box[p * 4] > x + radius || box[p * 4 + 2] < x - radius || box[p * 4 + 1] > z + radius || box[p * 4 + 3] < z - radius) continue;
          const [qx, qz] = closestOn(p, x, z);
          const qy = heightOn(p, qx, qz);
          const d = Math.hypot(qx - x, qy - y, qz - z);
          if (d <= radius && (!best || d < best.distance)) best = { poly: p, point: [qx, qy, qz], distance: d };
        }
      }
    }
    return best;
  }

  // islands: polygons joined by portals (links joined below)
  const parent = new Int32Array(P).map((_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let p = 0; p < P; p++) for (let e = start[p]; e < start[p + 1]; e++) if (edgeAdj[e] >= 0) join(p, edgeAdj[e]);
  const meshIsland = new Int32Array(P);
  for (let p = 0; p < P; p++) meshIsland[p] = find(p);

  // the hand links this mesh is given: each end on the mesh (nearest within its snap, at most 2 m)
  const links = [];
  if (useLinks) {
    file.links.forEach((l, id) => {
      if (useLinks !== 'all' && m.links && !(m.links & (1 << l.source)) && !l.start) return;
      const a = l.points[0];
      const b = l.points[l.points.length - 1];
      const snap = Math.min(2, l.snap || 2);
      const na = nearest(a[0], a[1], a[2], { radius: snap });
      const nb = nearest(b[0], b[1], b[2], { radius: snap });
      if (!na || !nb || na.poly === nb.poly) return;
      const length = l.points.reduce((s, q, k) => (k ? s + Math.hypot(q[0] - l.points[k - 1][0], q[1] - l.points[k - 1][1], q[2] - l.points[k - 1][2]) : 0), 0);
      links.push({ id, from: na.poly, to: nb.poly, points: l.points, both: l.both, length });
      join(na.poly, nb.poly);
    });
  }
  // a polygon's link hops: via codes −2 − (2k + 0) forward along link k, −2 − (2k + 1) back
  const byPoly = new Map();
  const hop = (p, code) => {
    if (!byPoly.has(p)) byPoly.set(p, []);
    byPoly.get(p).push(code);
  };
  links.forEach((l, k) => {
    hop(l.from, -2 - 2 * k);
    if (l.both) hop(l.to, -3 - 2 * k);
  });
  const linkOf = (code) => {
    const c = -2 - code;
    const l = links[c >> 1];
    const fwd = (c & 1) === 0;
    return { l, fwd, to: fwd ? l.to : l.from, points: fwd ? l.points : l.points.slice().reverse() };
  };
  const island = new Int32Array(P);
  for (let p = 0; p < P; p++) island[p] = find(p);

  // a link added at run time: the way through a door the level opens (the mesh was baked with it
  // shut, the two sides apart), its ends on the mesh within snap; the islands joined again. → its
  // index, or −1 when an end is off the mesh or both ends are one polygon
  function addLink({ points, both = true, snap = 2 }) {
    const a = points[0];
    const b = points[points.length - 1];
    const na = nearest(a[0], a[1], a[2], { radius: snap });
    const nb = nearest(b[0], b[1], b[2], { radius: snap });
    if (!na || !nb || na.poly === nb.poly) return -1;
    const length = points.reduce((sum, q, k) => (k ? sum + Math.hypot(q[0] - points[k - 1][0], q[1] - points[k - 1][1], q[2] - points[k - 1][2]) : 0), 0);
    const k = links.push({ id: -1, from: na.poly, to: nb.poly, points, both, length }) - 1;
    hop(na.poly, -2 - 2 * k);
    if (both) hop(nb.poly, -3 - 2 * k);
    join(na.poly, nb.poly);
    for (let p = 0; p < P; p++) island[p] = find(p);
    return k;
  }

  // along the mesh from a to b (x–z, the polygons followed through their portals) to the first wall
  function raycast(from, to, { poly = -1 } = {}) {
    let p = poly >= 0 ? poly : locate(from[0], from[1], from[2]);
    if (p < 0) return { hit: true, t: 0, point: from.slice(), poly: -1, edge: -1 };
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    let tIn = 0;
    for (let guard = 0; guard <= P; guard++) {
      // Cyrus–Beck: the edge the segment leaves this convex polygon by (the
      // polygons are clockwise in the x–z plane, so an edge's outward normal is (−ez, ex))
      let tExit = Infinity;
      let exit = -1;
      const n = polyEdges[p];
      for (let i = 0; i < n; i++) {
        const e = start[p] + i;
        const a = edgeVert[e];
        const b = edgeVert[start[p] + ((i + 1) % n)];
        const ex = X(b) - X(a);
        const ez = Z(b) - Z(a);
        const den = -ez * dx + ex * dz;
        if (den <= 1e-12) continue;
        const t = (-ez * (X(a) - from[0]) + ex * (Z(a) - from[2])) / den;
        if (t < tExit) {
          tExit = t;
          exit = e;
        }
      }
      if (exit < 0 || tExit >= 1) return { hit: false, t: 1, point: [to[0], heightOn(p, to[0], to[2]), to[2]], poly: p, edge: -1 };
      const t = Math.max(tIn, tExit);
      const q = edgeAdj[exit];
      if (q < 0) {
        const x = from[0] + dx * t;
        const z = from[2] + dz * t;
        return { hit: true, t, point: [x, heightOn(p, x, z), z], poly: p, edge: exit };
      }
      tIn = t;
      p = q;
    }
    return { hit: true, t: tIn, point: from.slice(), poly: p, edge: -1 };
  }

  // ---- A* over the polygons, then the funnel ----
  const g = new Float64Array(P);
  const came = new Int32Array(P);
  const via = new Int32Array(P);
  const entry = new Float64Array(P * 3);
  const opened = new Uint32Array(P);
  const closed = new Uint32Array(P);
  let search = 0;
  const open = heap();

  // where to cross the portal a–b going from (px, pz) toward (tx, tz): where that
  // line meets it, held a tenth of its length in from its ends
  const portalPoint = (a, b, px, pz, tx, tz, out) => {
    const ax = X(a);
    const az = Z(a);
    const ex = X(b) - ax;
    const ez = Z(b) - az;
    const den = ex * (tz - pz) - ez * (tx - px);
    let s = 0.5;
    if (Math.abs(den) > 1e-12) s = ((px - ax) * (tz - pz) - (pz - az) * (tx - px)) / den;
    s = Math.max(0.1, Math.min(0.9, s));
    out[0] = ax + ex * s;
    out[1] = Y(a) + (Y(b) - Y(a)) * s;
    out[2] = az + ez * s;
  };

  // where a point is on the mesh: the floor under it, else the nearest within snap
  const onMesh = (q, snap) => {
    const p = locate(q[0], q[1], q[2]);
    if (p >= 0) return { poly: p, point: [q[0], heightOn(p, q[0], q[2]), q[2]] };
    return nearest(q[0], q[1], q[2], { radius: snap });
  };

  function route(from, to, { snap = 4, dense = true, maxExpand = Infinity } = {}) {
    const sn = onMesh(from, snap);
    const tn = onMesh(to, snap);
    if (!sn || !tn) return null;
    const S = sn.poly;
    const T = tn.poly;
    if (island[S] !== island[T]) return null;
    const [gx, gy, gz] = tn.point;
    const h = (x, y, z) => Math.hypot(gx - x, gy - y, gz - z);
    search++;
    open.clear();
    g[S] = 0;
    came[S] = -1;
    via[S] = -1;
    entry.set(sn.point, S * 3);
    opened[S] = search;
    open.push(h(...sn.point), S);
    const pt = [0, 0, 0];
    let expanded = 0;
    let found = false;
    while (open.size) {
      const p = open.pop();
      if (closed[p] === search) continue;
      closed[p] = search;
      if (p === T) {
        found = true;
        break;
      }
      if (++expanded > maxExpand) break;
      const px = entry[p * 3];
      const py = entry[p * 3 + 1];
      const pz = entry[p * 3 + 2];
      const relax = (q, cost, how, x, y, z) => {
        if (closed[q] === search) return;
        const ng = g[p] + cost;
        if (opened[q] === search && ng >= g[q]) return;
        opened[q] = search;
        g[q] = ng;
        came[q] = p;
        via[q] = how;
        entry[q * 3] = x;
        entry[q * 3 + 1] = y;
        entry[q * 3 + 2] = z;
        open.push(ng + h(x, y, z), q);
      };
      const n = polyEdges[p];
      for (let i = 0; i < n; i++) {
        const e = start[p] + i;
        const q = edgeAdj[e];
        if (q < 0 || closed[q] === search) continue;
        portalPoint(edgeVert[e], edgeVert[start[p] + ((i + 1) % n)], px, pz, gx, gz, pt);
        relax(q, Math.hypot(pt[0] - px, pt[1] - py, pt[2] - pz), e, pt[0], pt[1], pt[2]);
      }
      for (const code of byPoly.get(p) ?? []) {
        const { l, to: q, points } = linkOf(code);
        const a = points[0];
        const b = points[points.length - 1];
        // (a metre more than its length: a hop is slower than a walk)
        relax(q, Math.hypot(a[0] - px, a[1] - py, a[2] - pz) + l.length + 1, code, b[0], b[1], b[2]);
      }
    }
    if (!found) return null;
    const polys = [];
    const steps = [];
    for (let p = T; p !== -1; p = came[p]) {
      polys.push(p);
      steps.push(via[p]);
    }
    polys.reverse();
    steps.reverse();
    // the runs of portals between link hops, each pulled taut
    const points = [sn.point.slice()];
    const usedLinks = [];
    let runStart = sn.point;
    let portals = [];
    const flush = (end) => {
      for (const q of funnel(runStart, end, portals, dense)) points.push(q);
      portals = [];
    };
    for (let k = 1; k < polys.length; k++) {
      const how = steps[k];
      if (how >= 0) {
        portals.push(portalOf(polys[k - 1], how));
        continue;
      }
      const { l, points: pts } = linkOf(how);
      flush(pts[0]);
      for (let i = 1; i < pts.length; i++) points.push(pts[i].slice());
      runStart = pts[pts.length - 1];
      usedLinks.push(l.id);
    }
    flush(tn.point);
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = out[out.length - 1];
      const b = points[i];
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-3) out.push(b);
    }
    let length = 0;
    for (let i = 1; i < out.length; i++) length += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1], out[i][2] - out[i - 1][2]);
    return { points: out, polys, links: usedLinks, length, expanded };
  }

  const P3 = (vi) => [X(vi), Y(vi), Z(vi)];
  // the portal out of polygon p by edge e as [left, right] for one walking out
  // (the polygons are clockwise in x–z: the edge's first vertex is on the left)
  const portalOf = (p, e) => {
    const i = e - start[p];
    return [P3(edgeVert[e]), P3(edgeVert[start[p] + ((i + 1) % polyEdges[p])])];
  };

  // the simple stupid funnel (Mononen's) in x–z: the corners are the mesh's own
  // vertices, their heights with them; with dense, the points where the taut
  // line crosses a portal off the line's own height go in too (a ramp, a step)
  function funnel(a, b, portals, dense) {
    const L = [a, ...portals.map((q) => q[0]), b];
    const R = [a, ...portals.map((q) => q[1]), b];
    const corners = [];
    let apex = a;
    let left = a;
    let right = a;
    let ai = 0;
    let li = 0;
    let ri = 0;
    const same = (u, w) => Math.abs(u[0] - w[0]) < 1e-6 && Math.abs(u[2] - w[2]) < 1e-6;
    for (let i = 1; i < L.length; i++) {
      const nl = L[i];
      const nr = R[i];
      if (cross(apex[0], apex[2], right[0], right[2], nr[0], nr[2]) >= 0) {
        if (same(apex, right) || cross(apex[0], apex[2], left[0], left[2], nr[0], nr[2]) < 0) {
          right = nr;
          ri = i;
        } else {
          corners.push([left, li]);
          apex = left;
          ai = li;
          right = left;
          ri = li;
          i = ai;
          continue;
        }
      }
      if (cross(apex[0], apex[2], left[0], left[2], nl[0], nl[2]) <= 0) {
        if (same(apex, left) || cross(apex[0], apex[2], right[0], right[2], nl[0], nl[2]) > 0) {
          left = nl;
          li = i;
        } else {
          corners.push([right, ri]);
          apex = right;
          ai = ri;
          left = right;
          li = ri;
          i = ai;
          continue;
        }
      }
    }
    corners.push([b, L.length - 1]);
    const out = [];
    let from = a;
    let fromAt = 0;
    for (const [q, at] of corners) {
      if (dense) {
        for (let k = fromAt + 1; k < at; k++) {
          const u = L[k];
          const w = R[k];
          const den = (w[0] - u[0]) * (q[2] - from[2]) - (w[2] - u[2]) * (q[0] - from[0]);
          if (Math.abs(den) < 1e-12) continue;
          const s = Math.max(0, Math.min(1, ((from[0] - u[0]) * (q[2] - from[2]) - (from[2] - u[2]) * (q[0] - from[0])) / den));
          const c = [u[0] + (w[0] - u[0]) * s, u[1] + (w[1] - u[1]) * s, u[2] + (w[2] - u[2]) * s];
          const run = Math.hypot(q[0] - from[0], q[2] - from[2]) || 1;
          const lineY = from[1] + ((q[1] - from[1]) * Math.hypot(c[0] - from[0], c[2] - from[2])) / run;
          if (Math.abs(c[1] - lineY) > 0.15) {
            out.push(c);
            from = c;
          }
        }
      }
      out.push(q.slice());
      from = q;
      fromAt = at;
    }
    return out;
  }

  const toPack = ([x, y, z]) => {
    const [ox, oy, oz] = file.origin;
    const c = Math.cos(file.yaw);
    const s = Math.sin(file.yaw);
    return [(x - ox) * c + (z - oz) * s, y - oy, -(x - ox) * s + (z - oz) * c];
  };
  const toGame = ([x, y, z]) => {
    const [ox, oy, oz] = file.origin;
    const c = Math.cos(file.yaw);
    const s = Math.sin(file.yaw);
    return [x * c - z * s + ox, y + oy, x * s + z * c + oz];
  };

  return {
    name: m.name,
    radius: m.radius,
    step: m.step,
    height: m.height,
    polyCount: P,
    meshes: file.meshes.map((q) => q.name),
    origin: file.origin,
    yaw: file.yaw,
    links,
    islands: new Set(meshIsland).size,
    locate,
    heightOn,
    nearest,
    raycast,
    route,
    findPath: (from, to, opts) => route(from, to, opts)?.points ?? null,
    addLink,
    island: (p) => island[p],
    polygon: (p) => Array.from({ length: polyEdges[p] }, (_, i) => P3(edgeVert[start[p] + i])),
    centre: (p) => [centre[p * 3], centre[p * 3 + 1], centre[p * 3 + 2]],
    toPack,
    toGame,
  };
}
