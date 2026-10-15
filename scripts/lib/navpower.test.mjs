import { describe, expect, it } from 'vitest';
import { checksOf, meshOf, readNavPower } from './navpower.mjs';

// A NavPower blob by the layout navpower.mjs documents (big endian, graph version 0x2B):
// two triangles sharing an edge (a portal each way) and a KD tree of one node over their two leaves.
function blob() {
  const AREA = 0x48 + 3 * 0x20;
  const areaBytes = 2 * AREA;
  const kdBytes = 28 + 12 + 4 + 4;
  const len = 0x180 + areaBytes + kdBytes;
  const v = new DataView(new ArrayBuffer(len));
  const u = (o, x) => v.setUint32(o, x >>> 0, false);
  const f = (o, x) => v.setFloat32(o, x, false);
  u(0, 0xffffffff);
  u(4, 2);
  u(8, len - 0x18);
  u(0x18, 0x10000);
  u(0x1c, len - 0x18 - 12);
  u(0x20, 1);
  u(0x24, 0xffffffff);
  u(0x28, 0x2b);
  u(0x2c, 1);
  const g = 0x30;
  u(g, 0x2b);
  u(g + 8, areaBytes);
  u(g + 12, kdBytes);
  u(g + 24, 0x38);
  u(g + 32, 0x150 + areaBytes + kdBytes);
  [1.8, 0.2, 0.4, 0.3, 1.8, 0, 0, 0, 1, 0, 1].forEach((x, i) => f(g + 36 + i * 4, x));
  u(g + 80, 1);
  const A = 0x180;
  const B = A + AREA;
  const area = (o, verts, adj, centre) => {
    centre.forEach((x, i) => f(o + 0x20 + i * 4, x));
    f(o + 0x2c, Math.max(...verts.map((p) => Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]))));
    u(o + 0x30, 0xffffffff);
    u(o + 0x38, 3);
    verts.forEach((p, e) => {
      const eo = o + 0x48 + e * 0x20;
      u(eo + 4, adj[e]);
      p.forEach((x, i) => f(eo + 8 + i * 4, x));
      u(eo + 20, 0xffff0000);
      u(eo + 24, adj[e] ? 7 : 0);
    });
  };
  // (the shared edge runs (1, 0, 0) → (0, 0, 1) in A and back in B)
  area(A, [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [0, B - g, 0], [1 / 3, 0, 1 / 3]);
  area(B, [[1, 0, 0], [1, 0, 1], [0, 0, 1]], [0, 0, A - g], [2 / 3, 0, 2 / 3]);
  const K = 0x180 + areaBytes;
  [0, 0, 0, 1, 0, 1].forEach((x, i) => f(K + i * 4, x));
  u(K + 24, kdBytes - 28);
  const N = K + 28;
  u(N, 16); // (a node: split on x, the right child 16 bytes on, the left leaf right after the node)
  f(N + 4, 0.5);
  f(N + 8, 0.5);
  u(N + 12, 0x80000000 | (A - g));
  u(N + 16, 0x80000000 | (B - g));
  return new Uint8Array(v.buffer);
}

describe('NavPower’s blob', () => {
  it('reads the header, the graph, the areas and their portals, and the KD tree', () => {
    const d = readNavPower(blob());
    expect(d.graph).toMatchObject({ version: 0x2b, radius: expect.closeTo(0.4, 5), step: expect.closeTo(0.3, 5), up: 1 });
    expect(d.areas).toHaveLength(2);
    expect(d.areas.map((a) => a.edges.map((e) => e.adj))).toEqual([
      [-1, 1, -1],
      [-1, -1, 0],
    ]);
    expect(d.kd).toMatchObject({ nodes: 1, leaves: 2 });
  });

  it('proves itself: every portal twinned, every area planar and convex, its radius the farthest vertex', () => {
    expect(checksOf(readNavPower(blob()))).toMatchObject({ areas: 2, portals: 2, twins: 2, sameFlags2: 2, planar: 2, convex: 2, radius: 2 });
  });

  it('refuses what it does not know', () => {
    const b = blob();
    b[0x2b] = 0x2a; // (another graph version)
    expect(() => readNavPower(b)).toThrow(/version/);
  });

  it('makes a mesh with its vertices shared', () => {
    const m = meshOf(readNavPower(blob()));
    expect(m.verts.length / 3).toBe(4);
    expect(Array.from(m.polyEdges)).toEqual([3, 3]);
  });
});
