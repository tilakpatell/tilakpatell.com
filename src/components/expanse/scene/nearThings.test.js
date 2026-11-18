import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fullSector } from '../gen/space';
import { UNIVERSE } from '../gen/seed';
import { MESH_NEAR, createNearThings, pickNear, thingsAround } from './nearThings';
import { THING_CLEAR } from '../gen/things';

const sector = fullSector(UNIVERSE, 3, 0, 0);
const sectorAt = (sx, sy, sz) => (sx === 3 && sy === 0 && sz === 0 ? sector : null);
const t = sector.things;
const placeOf = (i) => [sector.origin[0] + t.at[i * 3], sector.origin[1] + t.at[i * 3 + 1], sector.origin[2] + t.at[i * 3 + 2]];

describe('the things round the camera', () => {
  it('finds by their cells exactly what a look at every one would', () => {
    const cam = placeOf(10).map((v, k) => v + [1500, -800, 2500][k]);
    const reach = 14000;
    const seen = [];
    thingsAround(sectorAt, cam, reach, (s, i) => seen.push(i));
    const want = [];
    for (let i = 0; i < t.count; i++) {
      const p = placeOf(i);
      if (Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]) <= reach + t.size[i]) want.push(i);
    }
    expect(seen.sort((a, b) => a - b)).toEqual(want);
    expect(want.length).toBeGreaterThan(5);
  });

  it('picks those within thirty of their sizes, nearest first, as many as asked', () => {
    const i = [...t.size].findIndex((s) => s > 60);
    const at = placeOf(i);
    const cam = [at[0] + t.size[i] * 20, at[1], at[2]];
    const rows = pickNear(sectorAt, [sector], cam, { max: 4 });
    expect(rows[0].at.map(Math.round)).toEqual(at.map(Math.round));
    expect(rows[0].id).toMatch(/^E:3,0:w\d+$/);
    expect(rows.length).toBeLessThanOrEqual(4);
    for (const r of rows) expect(Math.hypot(r.at[0] - cam[0], r.at[1] - cam[1], r.at[2] - cam[2])).toBeLessThanOrEqual(r.size * MESH_NEAR);
  });
});

describe('the things drawn', () => {
  const rows = [
    { id: 'a', kind: 'rock', at: [0, 0, -500], size: 40, look: { color: '#8a8178', lit: true } },
    { id: 'b', kind: 'rock', at: [10, 0, -900], size: 70, look: { color: '#8a8178', lit: true } },
    { id: 'c', kind: 'derelict', at: [50, 0, -400], size: 90, look: { color: '#6d727c', lit: true } },
  ];

  it('draws a kind in one instanced mesh, nothing when there are none', () => {
    const group = new THREE.Group();
    const near = createNearThings(group, { max: 8 });
    near.update(rows, null, 0);
    const rock = group.getObjectByName('things:rock');
    expect(rock.isInstancedMesh).toBe(true);
    expect([rock.count, rock.visible]).toEqual([2, true]);
    expect(group.getObjectByName('things:derelict').count).toBe(1);
    near.update([], null, 1);
    expect(group.children.every((m) => !m.visible && m.count === 0)).toBe(true);
    near.dispose();
    expect(group.children).toHaveLength(0);
  });

  it('hands a kind with a drawer of its own its rows alone, and no mesh', () => {
    const group = new THREE.Group();
    const update = vi.fn();
    const near = createNearThings(group, { drawers: { derelict: () => ({ update, dispose: vi.fn() }) } });
    near.update(rows, null, 0);
    expect(update).toHaveBeenCalledWith([rows[2]], null, 0);
    expect(group.getObjectByName('things:derelict')).toBeUndefined();
  });

  it('makes each one solid', () => {
    const near = createNearThings(new THREE.Group());
    near.update(rows, null, 0);
    expect(near.solids()).toEqual(rows.map((r) => ({ id: r.id, at: r.at, r: r.size, reach: r.size * 1.2 })));
  });
});

describe('the lattice and the mesh hand-over', () => {
  it('keeps every lattice thing one more of its sizes off a keep-out than it is built near', () => {
    expect(THING_CLEAR).toBe(MESH_NEAR + 1);
  });
});
