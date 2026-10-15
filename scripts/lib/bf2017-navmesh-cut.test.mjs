import { describe, expect, it } from 'vitest';
import { decodeNavmesh, encodeNavmesh } from '../../src/lib/battlefront/navmesh.js';
import { cutNavmesh } from './bf2017-navmesh-cut.mjs';

// two unit squares side by side, joined by a portal, and a link from the first's middle to the second's
const twin = () =>
  decodeNavmesh(
    encodeNavmesh({
      origin: [5, 1, 7],
      yaw: 0.5,
      meshes: [
        {
          name: 'a',
          radius: 0.4,
          step: 0.3,
          height: 1.8,
          voxel: 0.2,
          layer: 0,
          links: 1,
          verts: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0, 1]),
          polyEdges: new Uint8Array([4, 4]),
          edgeVert: [0, 3, 2, 1, 1, 2, 5, 4],
          edgeAdj: [-1, -1, 1, -1, -1, 0, -1, -1],
        },
        { name: 'b', radius: 0.4, step: 0.3, height: 1.8, voxel: 0.2, layer: 0, verts: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1]), polyEdges: new Uint8Array([3]), edgeVert: [0, 2, 1], edgeAdj: [-1, -1, -1] },
      ],
      links: [
        { points: [[0.5, 0, 0.5], [1.5, 0, 0.5]], both: true, start: true, source: 0, radius: 1, snap: 2 },
        { points: [[0.2, 0, 0.2], [0.8, 0, 0.8]], both: false, start: false, source: 0, radius: 1, snap: 2 },
      ],
    }),
  );

describe('a navmesh cut for a fixture', () => {
  it('keeps one mesh, the polygons wholly in the box, a portal into a cut one a wall, the links inside', () => {
    const cut = decodeNavmesh(encodeNavmesh(cutNavmesh(twin(), { mesh: 'a', box: [-0.1, -0.1, 1.1, 1.1] })));
    expect(cut.origin).toEqual([5, 1, 7]);
    expect(cut.yaw).toBeCloseTo(0.5, 6);
    expect(cut.meshes.map((m) => m.name)).toEqual(['a']);
    const m = cut.meshes[0];
    expect(Array.from(m.polyEdges)).toEqual([4]);
    expect(m.verts.length / 3).toBe(4);
    expect(Array.from(m.edgeAdj)).toEqual([-1, -1, -1, -1]);
    expect(m.links).toBe(1);
    expect(cut.links.map((l) => l.points[0])).toEqual([[expect.closeTo(0.2, 5), 0, expect.closeTo(0.2, 5)]]);
  });

  it('keeps everything in a box round it all', () => {
    const cut = cutNavmesh(twin(), { mesh: 'a', box: [-10, -10, 10, 10] });
    expect(Array.from(cut.meshes[0].edgeAdj)).toEqual([-1, -1, 1, -1, -1, 0, -1, -1]);
    expect(cut.links).toHaveLength(2);
    expect(() => cutNavmesh(twin(), { mesh: 'c', box: [0, 0, 1, 1] })).toThrow(/no mesh c/);
  });
});
