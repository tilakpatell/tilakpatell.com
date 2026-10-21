import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { sectorAt } from '../gen/grid';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { beyondPlaces, createStarfield } from './starfield';

const ring = (sx, sz, inner, outer) => {
  const out = [];
  for (let dx = -outer; dx <= outer; dx++)
    for (let dz = -outer; dz <= outer; dz++) {
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      if (d > inner && d <= outer && (sx + dx || sz + dz)) out.push([sx + dx, sz + dz]);
    }
  return out;
};

describe('the sectors beyond, as star specks', () => {
  it('has a place for every system in the ring of sectors 2 and 3 out', () => {
    const cells = ring(4, 4, 1, 3);
    expect(cells).toHaveLength(40);
    const want = cells.reduce((n, [x, z]) => n + makeSector(UNIVERSE, x, z).systems.length, 0);
    const places = beyondPlaces(UNIVERSE, 4, 4);
    expect(places).toHaveLength(want);
    for (const p of places) {
      expect(p.r).toBeGreaterThan(0);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('skips the loaded 3×3 and the authored sector', () => {
    const places = beyondPlaces(UNIVERSE, 1, 0);
    expect(ring(2, 0, 1, 3)).toHaveLength(39); // (0, 0) is 2 out: skipped
    const near = beyondPlaces(UNIVERSE, 2, 0);
    for (const p of places) {
      const [x, z] = sectorAt(p.at[0], p.at[2]);
      expect(Math.max(Math.abs(x - 1), Math.abs(z))).toBeGreaterThan(1);
    }
    for (const p of near) expect(sectorAt(p.at[0], p.at[2])).not.toEqual([0, 0]);
    expect(near.length).toBe(ring(2, 0, 1, 3).reduce((n, [x, z]) => n + makeSector(UNIVERSE, x, z).systems.length, 0));
  });

  it('is the same every time', () => {
    const a = beyondPlaces(UNIVERSE, -3, 5);
    const b = beyondPlaces(UNIVERSE, -3, 5);
    expect(b).toEqual(a);
    expect(beyondPlaces(UNIVERSE, -3, 5, { inner: 0, outer: 1 }).length).toBeGreaterThan(0);
  });

  it('draws them under an inner group at the middle sector, and cleans up', () => {
    const parent = new THREE.Group();
    const f = createStarfield(parent);
    expect(parent.children).toHaveLength(1);
    f.rebuild(UNIVERSE, 4, 4);
    const n = f.size();
    expect(n).toBe(beyondPlaces(UNIVERSE, 4, 4).length);
    const inner = parent.children[0];
    expect(inner.children).toHaveLength(1);
    expect(inner.position.toArray()).toEqual([480000, 0, 480000]);
    const cam = new THREE.PerspectiveCamera();
    cam.updateMatrixWorld();
    expect(() => f.update(cam, 1 / 60)).not.toThrow();
    f.rebuild(UNIVERSE, 5, 4);
    expect(inner.position.toArray()).toEqual([600000, 0, 480000]);
    expect(inner.children).toHaveLength(1);
    f.dispose();
    expect(parent.children).toHaveLength(0);
    expect(inner.children).toHaveLength(0);
  });
});
