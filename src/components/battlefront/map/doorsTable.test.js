import { describe, expect, it } from 'vitest';
import { readInstances, writeInstances } from '../../../lib/level/instances.js';
import { matcher, splitCell, splitTable } from './doorsTable.js';

// a pack of two meshes: a leaf (two placed) and a crate (one), and its far table
const pack = {
  meshes: [{ name: 'models/leaf_mesh.glb' }, { name: 'models/crate_mesh.glb' }],
  far: {
    draws: [
      { mesh: 0, mirrored: false, offset: 0, count: 2, cells: { '0,0': [0, 1], '1,0': [1, 1] } },
      { mesh: 1, mirrored: false, offset: 2, count: 1, cells: { '1,0': [0, 1] } },
    ],
  },
};
const rows = (ps) => writeInstances({ count: ps.length, position: Float32Array.from(ps.flat()), quaternion: Float32Array.from(ps.flatMap(() => [0, 0, 0, 1])), scale: Float32Array.from(ps.flatMap(() => [1, 1, 1])) });
const bin = rows([
  [1, 0, 2],
  [130, 0, 2],
  [131, 1, 3],
]);
const controlled = [{ mesh: 'models/leaf_mesh.glb', at: [130, 0, 2], kind: 'leaf', id: 'door' }];

describe('the mode part’s table split', () => {
  it('takes the controlled instances out of the far table and keeps the rest in their cells', () => {
    const p = structuredClone(pack);
    const s = splitTable(p, bin, matcher(p, controlled));
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ mesh: 0, position: [130, 0, 2], is: controlled[0] });
    expect(s.draws).toEqual([
      { mesh: 0, mirrored: false, offset: 0, count: 1, cells: { '0,0': [0, 1] } },
      { mesh: 1, mirrored: false, offset: 1, count: 1, cells: { '1,0': [0, 1] } },
    ]);
    const kept = readInstances(s.bin);
    expect(kept.count).toBe(2);
    expect(Array.from(kept.position)).toEqual([1, 0, 2, 131, 1, 3]);
  });

  it('matches by the mesh’s name and its place within 2 cm, nothing else', () => {
    const m = matcher(pack, controlled);
    expect(m(0, [130.01, 0, 2])).toBe(controlled[0]);
    expect(m(0, [130.05, 0, 2])).toBeNull();
    expect(m(1, [130, 0, 2])).toBeNull();
  });

  it('leaves a cell’s shapes for the fixed collision without them', () => {
    const cell = rows([
      [130, 0, 2],
      [131, 1, 3],
    ]);
    const left = splitCell(
      [
        { mesh: 0, offset: 0, count: 1 },
        { mesh: 1, offset: 1, count: 1 },
      ],
      cell,
      matcher(pack, controlled),
    );
    expect(left.map((i) => i.mesh)).toEqual([1]);
  });
});
