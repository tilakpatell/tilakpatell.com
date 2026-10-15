// A navmesh.bin (src/lib/battlefront/navmesh.js's format) cut to one of its
// meshes and a box on the ground, for a test's fixture: the polygons with
// every vertex inside the box, their vertices renumbered, an edge into a
// polygon left out a wall; the hand links with every point inside. The box is
// in the pack's frame (the file's own), [x0, z0, x1, z1].
//
//   cutNavmesh(decoded, { mesh, box }) → the encoder's input (encodeNavmesh)

export function cutNavmesh(decoded, { mesh, box }) {
  const m = decoded.meshes.find((x) => x.name === mesh);
  if (!m) throw new Error(`navmesh-cut: no mesh ${mesh}`);
  const [x0, z0, x1, z1] = box;
  const P = m.polyEdges.length;
  const start = new Uint32Array(P + 1);
  for (let p = 0; p < P; p++) start[p + 1] = start[p] + m.polyEdges[p];
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const vertIn = (vi) => inside(m.verts[vi * 3], m.verts[vi * 3 + 2]);
  const kept = new Int32Array(P).fill(-1);
  const keep = [];
  for (let p = 0; p < P; p++) {
    let all = true;
    for (let e = start[p]; e < start[p + 1] && all; e++) all = vertIn(m.edgeVert[e]);
    if (all) {
      kept[p] = keep.length;
      keep.push(p);
    }
  }
  const vmap = new Map();
  const verts = [];
  const vertOf = (vi) => {
    if (!vmap.has(vi)) {
      vmap.set(vi, verts.length / 3);
      verts.push(m.verts[vi * 3], m.verts[vi * 3 + 1], m.verts[vi * 3 + 2]);
    }
    return vmap.get(vi);
  };
  const polyEdges = [];
  const polyFlags = [];
  const edgeVert = [];
  const edgeAdj = [];
  const edgeFlags = [];
  for (const p of keep) {
    polyEdges.push(m.polyEdges[p]);
    polyFlags.push(m.polyFlags[p]);
    for (let e = start[p]; e < start[p + 1]; e++) {
      edgeVert.push(vertOf(m.edgeVert[e]));
      // (a portal into a polygon cut away is a wall now)
      edgeAdj.push(m.edgeAdj[e] >= 0 ? kept[m.edgeAdj[e]] : -1);
      edgeFlags.push(m.edgeFlags[e]);
    }
  }
  const links = decoded.links.filter((l) => l.points.every((q) => inside(q[0], q[2])));
  return {
    origin: decoded.origin,
    yaw: decoded.yaw,
    meshes: [
      {
        ...m,
        verts: Float32Array.from(verts),
        polyEdges: Uint8Array.from(polyEdges),
        polyFlags: Uint8Array.from(polyFlags),
        edgeVert: Uint32Array.from(edgeVert),
        edgeAdj: Int32Array.from(edgeAdj),
        edgeFlags: Uint8Array.from(edgeFlags),
      },
    ],
    links,
  };
}
