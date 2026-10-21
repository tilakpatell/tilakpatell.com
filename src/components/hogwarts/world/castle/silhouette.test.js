import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CRAG, PLAN, SIZE, castleParts } from './silhouette';

const boxOf = (parts) => {
  const b = new THREE.Box3();
  for (const p of parts) {
    p.g.computeBoundingBox();
    b.union(p.g.boundingBox);
  }
  return b;
};

describe('the castle seen from across the water', () => {
  const parts = castleParts();

  it('is stone, slate, glass and rock, each part with a colour', () => {
    expect(new Set(parts.map((p) => p.role))).toEqual(new Set(['stone', 'roof', 'glass', 'rock']));
    for (const p of parts) {
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.g.attributes.position.count).toBeGreaterThan(0);
    }
  });

  it('stands on its crag, the Astronomy Tower highest of all', () => {
    const b = boxOf(parts);
    expect(b.min.y).toBeGreaterThanOrEqual(-1);
    expect(b.max.y).toBeCloseTo(SIZE.tall, 0);
    const towers = PLAN.filter((p) => p.kind === 'tower');
    const top = (p) => p.h + (p.capH ?? 0);
    const highest = towers.reduce((a, p) => (top(p) > top(a) ? p : a));
    expect(highest.name).toBe('Astronomy');
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(SIZE.wide + 1);
    expect(b.max.x - b.min.x).toBeGreaterThan(CRAG.wide);
  });

  it('lights its windows on the side that faces the lake, a few rooms dark', () => {
    const glass = parts.filter((p) => p.role === 'glass');
    expect(glass.length).toBeGreaterThan(80);
    // (most of them face the boats, +z: they are what the first-years see)
    const facing = glass.filter((p) => {
      p.g.computeVertexNormals();
      return p.g.attributes.normal.getZ(0) > 0.2;
    });
    expect(facing.length / glass.length).toBeGreaterThan(0.6);
  });

  it('is the same castle for everyone: the same seed, the same parts', () => {
    const again = castleParts();
    expect(again.length).toBe(parts.length);
    expect(again.map((p) => p.g.attributes.position.count)).toEqual(parts.map((p) => p.g.attributes.position.count));
    expect(boxOf(again).max.toArray()).toEqual(boxOf(parts).max.toArray());
  });

  it('keeps every tower on the crag’s top', () => {
    for (const p of PLAN.filter((x) => x.kind === 'tower' || x.kind === 'hall')) {
      const [x, z] = p.at;
      expect((x / (CRAG.wide * 0.5)) ** 2 + (z / (CRAG.deep * 0.5)) ** 2, p.name).toBeLessThan(1);
    }
  });
});
