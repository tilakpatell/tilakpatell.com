import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MAX, createStationLook } from './stationLook';

const rows = (n) => Array.from({ length: n }, (_, i) => ({ at: [i * 100, 5, -i * 30], size: 20 + i, grow: i === 1 ? 0.5 : 1 }));

describe('generated stations drawn', () => {
  it('costs nothing with none, draws what it’s given up to eight, and warms each mesh once', () => {
    const group = new THREE.Group();
    const prepare = vi.fn();
    const look = createStationLook(group, { prepare });
    expect(prepare).toHaveBeenCalledTimes(2);
    look.update([]);
    expect(group.children.map((m) => [m.visible, m.count])).toEqual([
      [false, 0],
      [false, 0],
    ]);
    look.update(rows(3));
    expect(group.children.map((m) => [m.visible, m.count])).toEqual([
      [true, 3],
      [true, 3],
    ]);
    const m = new THREE.Matrix4();
    group.children[0].getMatrixAt(1, m);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    m.decompose(p, new THREE.Quaternion(), s);
    expect(p.toArray()).toEqual([100, 5, -30]);
    expect(s.x).toBeCloseTo(21 * 0.5, 9);
    look.update(rows(9));
    expect(group.children[0].count).toBe(MAX);
    expect(prepare).toHaveBeenCalledTimes(2);
    look.dispose();
    expect(group.children).toEqual([]);
  });
});
