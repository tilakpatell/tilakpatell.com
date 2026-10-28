// A small NavPower-shaped mesh for the planner's test, made the same way by
// the test and by scripts/bf2web-golden.mjs (which packs it as bf2-web's
// BFNAVPK1 for its native driver): a grid of 4 m cells, each a convex
// quad or two triangles, with a ramp and a few holes for walls, and a
// separate island to the east so a path can be partial. Wound as bf2-web's
// graphs are (the interior on the negative side of each edge, x right, z
// up); every portal is paired. The shape navmesh.js decodes:
//
//   navGrid() → { verts: Float32Array, polyEdges: Uint8Array, edgeVert: Uint32Array, edgeAdj: Int32Array }

const W = 12;
const H = 9;
const CELL = 4;
// cells left out: walls inside the grid
const HOLES = new Set(['4,2', '4,3', '4,4', '7,6', '8,6', '2,7']);
// the island: these columns are cut off from the rest by a gap of holes
const ISLAND_FROM = 10;

export function navGrid() {
  const verts = [];
  const vertexAt = new Map();
  const vert = (i, j) => {
    const key = `${i},${j}`;
    if (!vertexAt.has(key)) {
      // a ramp rising along x, with a little roll along z
      vertexAt.set(key, verts.length / 3);
      verts.push(i * CELL, i * 0.35 + (j % 3) * 0.1, j * CELL);
    }
    return vertexAt.get(key);
  };
  const open = (i, j) => i >= 0 && j >= 0 && i < W && j < H && i !== ISLAND_FROM - 1 && !HOLES.has(`${i},${j}`);
  // each polygon as its vertex loop, clockwise in x right, z up (so the interior is on each edge's negative side)
  const polys = [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!open(i, j)) continue;
      const a = vert(i, j), b = vert(i, j + 1), c = vert(i + 1, j + 1), d = vert(i + 1, j);
      // every third cell is split into two triangles on its diagonal
      if ((i + 2 * j) % 3 === 0) {
        polys.push([a, b, c]);
        polys.push([a, c, d]);
      } else polys.push([a, b, c, d]);
    }
  }
  // the edges' neighbours: the polygon holding the same edge the other way round
  const owner = new Map();
  polys.forEach((p, k) => p.forEach((v, e) => owner.set(`${v},${p[(e + 1) % p.length]}`, k)));
  const polyEdges = new Uint8Array(polys.length);
  const edgeVert = [];
  const edgeAdj = [];
  polys.forEach((p, k) => {
    polyEdges[k] = p.length;
    p.forEach((v, e) => {
      edgeVert.push(v);
      edgeAdj.push(owner.get(`${p[(e + 1) % p.length]},${v}`) ?? -1);
    });
  });
  return { verts: new Float32Array(verts), polyEdges, edgeVert: new Uint32Array(edgeVert), edgeAdj: new Int32Array(edgeAdj) };
}
