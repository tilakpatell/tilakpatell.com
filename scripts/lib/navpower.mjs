// NavPower's baked navmesh as STAR WARS Battlefront II (2017) ships it: the
// chunk a PathfindingBlobAsset's Blob.BlobId names (bf2export's `chunks`
// mode writes it), read field by field. Every field below was proved on
// Hoth's four blobs (bf2-re findings/57): the sizes add up to the byte, every
// portal has its twin, every area is in exactly one KD leaf, and the polygons
// lie on the floors. The layout is the Hitman NavPower one the Glacier
// modders decoded (NavKit, ZHMTools' navp), at graph version 0x2B and big
// endian (the blob was baked for the consoles' byte order and is read as is).
//
//   0x000 Header       u32 endian (0xFFFFFFFF), u32 version (2), u32 imageSize (file − 0x18),
//                      u32 checksum, u32 runtimeFlags (0), u32 constantFlags (0)
//   0x018 Section      u32 id (0x10000, the nav graph), u32 size (imageSize − 12), u32 pointerSize (1: 64-bit)
//   0x024 NavSet       u32 endian (0xFFFFFFFF), u32 version (0x2B), u32 graphs (1)
//   0x030 NavGraph     (0x150 bytes; offsets below are from here, the graph's base)
//         +0x00 u32 version (0x2B)       +0x04 u32 layer        +0x08 u32 areaBytes
//         +0x0C u32 kdTreeBytes          +0x10 u32 linkBytes (0) +0x14 u32 (0) +0x18 u32 (0x38) +0x1C u32 (0)
//         +0x20 u32 totalBytes (0x150 + areaBytes + kdTreeBytes + linkBytes)
//         +0x24 f32 buildScale (1.8)     +0x28 f32 voxel        +0x2C f32 radius
//         +0x30 f32 stepHeight           +0x34 f32 height       +0x38 f32×6 bbox (min, max)
//         +0x50 u32 upAxis (1: y)        +0x54…+0x9F zero       +0xA0…+0x11F a 128-byte block
//         the same in all four blobs     +0x120…+0x14F zero
//   0x180 Areas        areaBytes of Area records, each 0x48 + edges × 0x20:
//         +0x00 u64×4 runtime pointers (0) +0x20 f32×3 centre   +0x2C f32 radius (the farthest vertex)
//         +0x30 u32 searchCost (0xFFFFFFFF) +0x34 u32 usageFlags (0)
//         +0x38 u32 flags1: edges (bits 0–6), island (bits 7–24, 0x3FFFF: left to the runtime)
//         +0x3C u32 flags2: obstacle cost × (bits 16–19), static cost × (bits 20–23),
//                           basis vertex (bits 24–30, < edges), a flag (bit 31, rare)
//         +0x40 u32 flags3 (0)   +0x44 u32 flags4 (0)
//         +0x48 Edge × edges: u64 adjacent area (its offset from the graph's base, 0 = a wall),
//               f32×3 the edge's first vertex, u32 flags1 (0xFFFF0000; bit 15 on some portals,
//               bit 13 on some walls), u32 flags2 (the same on both sides of a portal, 0 on a
//               wall), u32 pad (0)
//         An area is a convex, planar polygon; edge i runs from its vertex to edge i+1's.
//   then  KD tree      kdTreeBytes: f32×6 bbox, u32 size (kdTreeBytes − 28), then nodes:
//         node: u32 (bit 31 clear; split axis bits 28–30; the right child's offset from this
//               node, bits 0–27), f32 the left child's max on the axis, f32 the right child's
//               min (12 bytes; the left child follows the node)
//         leaf: u32 0x80000000 | the area's offset from the graph's base (4 bytes)
//
//   readNavPower(bytes) → { header, graph, areas, kd }

const GRAPH = 0x30;
const AREAS = 0x180;
const AREA = 0x48;
const EDGE = 0x20;

export function readNavPower(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u = (o) => v.getUint32(o, false);
  const f = (o) => v.getFloat32(o, false);
  const vec = (o) => [f(o), f(o + 4), f(o + 8)];
  const fail = (what) => {
    throw new Error(`navpower: ${what}`);
  };
  if (bytes.byteLength < AREAS) fail('too short');
  const header = { endian: u(0), version: u(4), imageSize: u(8), checksum: u(12), runtimeFlags: u(16), constantFlags: u(20) };
  if (header.endian !== 0xffffffff) fail(`endian flag ${header.endian.toString(16)} (only the big-endian blob is known)`);
  if (header.version !== 2 || header.imageSize !== bytes.byteLength - 0x18) fail('header');
  const section = { id: u(0x18), size: u(0x1c), pointerSize: u(0x20) };
  if (section.id !== 0x10000 || section.size !== header.imageSize - 12 || section.pointerSize !== 1) fail('section');
  const set = { endian: u(0x24), version: u(0x28), graphs: u(0x2c) };
  if (set.graphs !== 1) fail(`${set.graphs} graphs`);
  const g = GRAPH;
  const graph = {
    version: u(g),
    layer: u(g + 4),
    areaBytes: u(g + 8),
    kdTreeBytes: u(g + 12),
    linkBytes: u(g + 16),
    totalBytes: u(g + 32),
    buildScale: f(g + 36),
    voxel: f(g + 40),
    radius: f(g + 44),
    step: f(g + 48),
    height: f(g + 52),
    bbox: { min: vec(g + 56), max: vec(g + 68) },
    up: u(g + 80),
  };
  if (graph.version !== 0x2b || set.version !== 0x2b) fail(`graph version ${graph.version.toString(16)}`);
  if (graph.totalBytes !== AREAS - GRAPH + graph.areaBytes + graph.kdTreeBytes + graph.linkBytes) fail('graph sizes');
  if (GRAPH + graph.totalBytes !== bytes.byteLength) fail('graph length');
  if (graph.linkBytes !== 0) fail('link records (none known)');

  // the areas, in file order; adjacency first as offsets, then as indices
  const areas = [];
  const byOffset = new Map();
  let o = AREAS;
  const end = AREAS + graph.areaBytes;
  while (o < end) {
    const flags1 = u(o + 0x38);
    const flags2 = u(o + 0x3c);
    const n = flags1 & 0x7f;
    if (n < 3 || o + AREA + n * EDGE > end) fail(`area at 0x${o.toString(16)}`);
    const edges = [];
    for (let e = 0; e < n; e++) {
      const eo = o + AREA + e * EDGE;
      if (u(eo) !== 0) fail('adjacency beyond 4 GB');
      edges.push({ adj: u(eo + 4), vertex: vec(eo + 8), flags1: u(eo + 20), flags2: u(eo + 24) });
    }
    byOffset.set(o - GRAPH, areas.length);
    areas.push({
      offset: o - GRAPH,
      centre: vec(o + 0x20),
      radius: f(o + 0x2c),
      searchCost: u(o + 0x30),
      usage: u(o + 0x34),
      flags1,
      flags2,
      island: (flags1 >>> 7) & 0x3ffff,
      obstacleCost: (flags2 >>> 16) & 0xf,
      staticCost: (flags2 >>> 20) & 0xf,
      basis: (flags2 >>> 24) & 0x7f,
      flag31: flags2 >>> 31,
      edges,
    });
    o += AREA + n * EDGE;
  }
  if (o !== end) fail('areas overrun');
  for (const a of areas) {
    for (const e of a.edges) {
      if (e.adj === 0) {
        e.adj = -1;
        continue;
      }
      const j = byOffset.get(e.adj);
      if (j === undefined) fail(`edge to 0x${e.adj.toString(16)}, no area there`);
      e.adj = j;
    }
  }

  // the KD tree: every leaf must name an area
  const K = end;
  const kd = { bbox: { min: vec(K), max: vec(K + 12) }, size: u(K + 24), nodes: 0, leaves: 0, depth: 0, leafOf: new Int32Array(areas.length).fill(-1) };
  if (kd.size !== graph.kdTreeBytes - 28) fail('kd size');
  const N0 = K + 28;
  const stack = [[0, 0]];
  while (stack.length) {
    const [n, depth] = stack.pop();
    if (n < 0 || n + 4 > kd.size) fail('kd node outside the tree');
    kd.depth = Math.max(kd.depth, depth);
    const d = u(N0 + n);
    if (d & 0x80000000) {
      const j = byOffset.get(d & 0x7fffffff);
      if (j === undefined) fail('kd leaf names no area');
      if (kd.leafOf[j] >= 0) fail('an area in two leaves');
      kd.leafOf[j] = n;
      kd.leaves++;
      continue;
    }
    kd.nodes++;
    stack.push([n + (d & 0x0fffffff), depth + 1], [n + 12, depth + 1]);
  }
  if (kd.nodes * 12 + kd.leaves * 4 !== kd.size) fail('kd tree bytes');
  if (kd.leaves !== areas.length) fail('kd leaves');
  return { header, section, set, graph, areas, kd };
}

// the mesh of a decoded blob in a pack's frame ((x, y, z) → frame(x, y, z)),
// its vertices shared (one per position, to the millimetre)
export function meshOf(decoded, frame = (x, y, z) => [x, y, z]) {
  const index = new Map();
  const verts = [];
  const polyEdges = new Uint8Array(decoded.areas.length);
  const polyFlags = new Uint8Array(decoded.areas.length);
  let edgeCount = 0;
  for (const a of decoded.areas) edgeCount += a.edges.length;
  const edgeVert = new Uint32Array(edgeCount);
  const edgeAdj = new Int32Array(edgeCount);
  const edgeFlags = new Uint8Array(edgeCount);
  let e = 0;
  decoded.areas.forEach((a, p) => {
    polyEdges[p] = a.edges.length;
    polyFlags[p] = a.flag31;
    for (const ed of a.edges) {
      const q = frame(...ed.vertex);
      const key = `${Math.round(q[0] * 1000)},${Math.round(q[1] * 1000)},${Math.round(q[2] * 1000)}`;
      let vi = index.get(key);
      if (vi === undefined) {
        vi = verts.length / 3;
        index.set(key, vi);
        verts.push(q[0], q[1], q[2]);
      }
      edgeVert[e] = vi;
      edgeAdj[e] = ed.adj;
      edgeFlags[e] = (ed.flags1 & 0x8000 ? 1 : 0) | (ed.flags1 & 0x2000 ? 2 : 0);
      e++;
    }
  });
  return { verts: Float32Array.from(verts), polyEdges, polyFlags, edgeVert, edgeAdj, edgeFlags };
}

// the checks that prove the reading on a decoded blob (findings/57's table)
export function checksOf(decoded) {
  const { areas } = decoded;
  let portals = 0;
  let twins = 0;
  let sameFlags2 = 0;
  let planar = 0;
  let radius = 0;
  let convex = 0;
  let winding = 0;
  for (let p = 0; p < areas.length; p++) {
    const a = areas[p];
    const vs = a.edges.map((e) => e.vertex);
    const n = vs.length;
    // twin: the neighbour has an edge back with the same two vertices reversed
    for (let i = 0; i < n; i++) {
      const ed = a.edges[i];
      if (ed.adj < 0) continue;
      portals++;
      const b = areas[ed.adj];
      const p0 = vs[i];
      const p1 = vs[(i + 1) % n];
      const near = (x, y) => Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 1e-3;
      const back = b.edges.findIndex((be, j) => be.adj === p && near(be.vertex, p1) && near(b.edges[(j + 1) % b.edges.length].vertex, p0));
      if (back >= 0) {
        twins++;
        if (b.edges[back].flags2 === ed.flags2) sameFlags2++;
      }
    }
    // planar (Newell's normal through the mean), radius, convex and wound one way in x–z
    let nx = 0;
    let ny = 0;
    let nz = 0;
    const c = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const s = vs[i];
      const t = vs[(i + 1) % n];
      nx += (s[1] - t[1]) * (s[2] + t[2]);
      ny += (s[2] - t[2]) * (s[0] + t[0]);
      nz += (s[0] - t[0]) * (s[1] + t[1]);
      for (let k = 0; k < 3; k++) c[k] += s[k] / n;
    }
    const L = Math.hypot(nx, ny, nz) || 1;
    if (vs.every((s) => Math.abs((s[0] - c[0]) * nx + (s[1] - c[1]) * ny + (s[2] - c[2]) * nz) / L < 0.005)) planar++;
    const far = Math.max(...vs.map((s) => Math.hypot(s[0] - a.centre[0], s[1] - a.centre[1], s[2] - a.centre[2])));
    if (Math.abs(far - a.radius) < 0.01) radius++;
    if (ny < 0) winding++;
    // (every turn the same way as the winding, up to a millimetre's wobble)
    let left = 0;
    let right = 0;
    for (let i = 0; i < n; i++) {
      const s = vs[i];
      const t = vs[(i + 1) % n];
      const w = vs[(i + 2) % n];
      const cross = (t[0] - s[0]) * (w[2] - t[2]) - (t[2] - s[2]) * (w[0] - t[0]);
      if (cross > 1e-4) left++;
      else if (cross < -1e-4) right++;
    }
    if (!left || !right) convex++;
  }
  return { areas: areas.length, portals, twins, sameFlags2, planar, radius, convex, wound: winding };
}
