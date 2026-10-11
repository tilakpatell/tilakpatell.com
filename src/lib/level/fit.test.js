import { describe, expect, it } from 'vitest';
import { costAt, fitCull } from './fit';

// meshes: their chains and draw calls a piece; weight is instances × volume
const meshes = [
  { lods: [1000, 500, 100], mats: 1, weight: 1000 }, // the hangar
  { lods: [200, 100, 50], mats: 1, weight: 1 }, // snow debris
];
const at = (list) => ({
  x: Float32Array.from(list.map((i) => i[0])),
  z: Float32Array.from(list.map((i) => i[1])),
  r: Float32Array.from(list.map((i) => i[2])),
  mesh: Int32Array.from(list.map((i) => i[3])),
  mirrored: Uint8Array.from(list.map((i) => i[4] ?? 0)),
});
const row = { tris: 2000, calls: 100 };

describe('costAt', () => {
  it('charges each instance its LOD by size and distance, and nothing past K radii', () => {
    const inst = at([[0.5, 0, 10, 0], [40, 0, 10, 0], [5, 0, 1, 1], [500, 0, 1, 1]]);
    // high: the hangar LOD0 at 0.5 m, LOD2 at 40 m (40 / 10 = 4: two doublings); debris LOD2 at 5 m; the far debris past 60 radii
    expect(costAt(inst, meshes, [0, 0], 'high', 60)).toEqual({ tris: 1000 + 100 + 50, calls: 3 });
  });

  it('a mirrored instance is its own call; a dropped mesh costs nothing', () => {
    const inst = at([[0.5, 0, 10, 0, 0], [0.6, 0, 10, 0, 1]]);
    expect(costAt(inst, meshes, [0, 0], 'high', 60).calls).toBe(2);
    expect(costAt(inst, meshes, [0, 0], 'high', 60, new Set([0]))).toEqual({ tris: 0, calls: 0 });
  });
});

describe('fitCull', () => {
  it('keeps the farthest reach that fits: everything, when everything does', () => {
    const inst = at([[1, 0, 1, 1]]);
    const f = fitCull(inst, meshes, row, 'high', { positions: [[0, 0]], kMax: 1000 });
    expect(f.K).toBe(1000);
    expect(f.dropped).toEqual([]);
  });

  it('pulls the reach in until the worst place fits 90% of the row', () => {
    // twenty debris in a line, 10 m apart, each 50 triangles that far out: 1,000 against 720
    const inst = at(Array.from({ length: 20 }, (_, i) => [10 + i * 10, 0, 1, 1]));
    const f = fitCull(inst, meshes, { tris: 800, calls: 100 }, 'high', { positions: [[0, 0]], kMax: 1000 });
    expect(f.worst.tris).toBeLessThanOrEqual(720);
    expect(f.dropped).toEqual([]);
    expect(f.K).toBeLessThan(1000);
    expect(f.K).toBeGreaterThan(10);
  });

  it('when even the nearest reach is over, the lightest mesh goes, not the hangar', () => {
    const inst = at([[1, 0, 10, 0], [1, 0, 1, 1], [1.2, 0, 1, 1], [1.4, 0, 1, 1]]);
    const f = fitCull(inst, meshes, { tris: 1150, calls: 100 }, 'high', { positions: [[0, 0]], kMin: 4, kMax: 1000 });
    expect(f.dropped).toEqual([1]);
    expect(f.worst.tris).toBe(1000);
  });

  it('never drops a mesh you stand on (`keep`): the next lightest goes, and the row is left over if nothing else can', () => {
    const inst = at([[1, 0, 10, 0], [1, 0, 1, 1], [1.2, 0, 1, 1], [1.4, 0, 1, 1]]);
    const kept = meshes.map((m, i) => (i === 1 ? { ...m, keep: true } : m));
    const f = fitCull(inst, kept, { tris: 1150, calls: 100 }, 'high', { positions: [[0, 0]], kMin: 4, kMax: 1000 });
    expect(f.dropped).not.toContain(1);
    expect(f.dropped).toEqual([0]);
  });

  it('a mesh the map keeps last (its own buildings: `last`) goes only after every other at the worst place', () => {
    const inst = at([[1, 0, 10, 0], [1, 0, 1, 1], [1.2, 0, 1, 1], [1.4, 0, 1, 1]]);
    const kept = [meshes[0], { ...meshes[1], last: true }];
    const f = fitCull(inst, kept, { tris: 1150, calls: 100 }, 'high', { positions: [[0, 0]], kMin: 4, kMax: 1000 });
    expect(f.dropped).toEqual([0]);
    // (and when only kept ones are left, the lightest of them, as before)
    const all = [{ ...meshes[0], last: true }, { ...meshes[1], last: true }];
    expect(fitCull(inst, all, { tris: 1150, calls: 100 }, 'high', { positions: [[0, 0]], kMin: 4, kMax: 1000 }).dropped).toEqual([1]);
  });

  it('the parts of one thing (a tree’s trunk and crown: one `group`) go together', () => {
    const parts = [meshes[0], { ...meshes[1], group: 'tree' }, { ...meshes[1], weight: 5000, group: 'tree' }];
    const inst = at([[1, 0, 10, 0], [1, 0, 1, 1], [1.2, 0, 1, 1], [1.4, 0, 1, 2]]);
    const f = fitCull(inst, parts, { tris: 1150, calls: 100 }, 'high', { positions: [[0, 0]], kMin: 4, kMax: 1000 });
    expect(f.dropped.sort()).toEqual([1, 2]);
  });

  it('a mesh drawn only up to a LOD (`upTo`: its far LODs’ maps missing) costs nothing past it', () => {
    const inst = at([[40, 0, 10, 0]]);
    // (at 40 m the hangar would draw its LOD2; drawn up to LOD 2, it is not drawn there at all)
    expect(costAt(inst, [{ ...meshes[0], upTo: 2 }, meshes[1]], [0, 0], 'high', 60)).toEqual({ tris: 0, calls: 0 });
    expect(costAt(inst, [{ ...meshes[0], upTo: 3 }, meshes[1]], [0, 0], 'high', 60)).toEqual({ tris: 100, calls: 1 });
  });

  it('ultra has no triangle ceiling: only the calls hold it', () => {
    const inst = at([[1, 0, 10, 0], [1, 0, 1, 1]]);
    expect(fitCull(inst, meshes, { tris: Infinity, calls: 1500 }, 'ultra', { positions: [[0, 0]], kMax: 1000 }).K).toBe(1000);
  });
});
