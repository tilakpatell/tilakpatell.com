import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { KINDS, UNIVERSE, fullSector, gargantuanKeeps } from '../../expanse/shared/gen';
import { createThingDrawers } from './drawers';
import { GIANT_KINDS } from './gargantuans';

const s = fullSector(UNIVERSE, 1, 0, 0, { lattice: false });
const budget = () => ({ thingKinds: { rocks: 48, pieces: 16, bodies: 4, panels: 300 }, gargantuan: 'low' });
const cam = new THREE.PerspectiveCamera();
const entry = (row, share = 0.3) => ({ id: row.id, kind: row.kind, at: row.at, size: row.size, d: 100, share, row });
const meshes = (g) => {
  const out = [];
  g.traverse((o) => (o.isMesh || o.isInstancedMesh) && o.visible && out.push(o));
  return out;
};

describe('lane 4a’s drawers', () => {
  it('draws every kind it knows near, prepares each mesh once, and shows nothing for no entries', () => {
    const { drawers, drawn } = createThingDrawers({ budget });
    const lists = Object.values(s.extras).flat();
    for (const kind of Object.keys(drawers)) {
      if (GIANT_KINDS.includes(kind)) continue;
      const rows = lists.filter((r) => r.kind === kind).slice(0, 2);
      if (!rows.length) continue;
      const g = new THREE.Group();
      const prepare = vi.fn();
      const d = drawers[kind](g, { prepare });
      d.update([], cam, 0);
      expect(meshes(g), kind).toEqual([]);
      d.update(rows.map((r) => entry(r)), cam, 1000);
      expect(meshes(g).length, kind).toBeGreaterThan(0);
      const calls = prepare.mock.calls.length;
      d.update(rows.map((r) => entry(r)), cam, 1001);
      expect(prepare.mock.calls.length, kind).toBe(calls);
      for (const m of meshes(g)) for (let i = 0; i < m.count * 16; i++) expect(Number.isFinite(m.instanceMatrix.array[i]), kind).toBe(true);
      d.dispose();
      expect(g.children.length, kind).toBe(0);
    }
    expect(Object.keys(drawn()).length).toBeGreaterThan(10);
  });
  it('caps a field’s rocks by the tier, and fades an entry in from nothing at its reach', () => {
    const { drawers } = createThingDrawers({ budget });
    const g = new THREE.Group();
    const d = drawers.field(g, {});
    const f = s.extras.field[0];
    d.update([entry(f, 0.5)], cam, 0);
    const rocks = meshes(g)[0];
    expect(rocks.count).toBe(48);
    d.update([entry(f, 1.0)], cam, 0);
    expect(meshes(g)).toEqual([]);
    d.update([entry(f, 0.9)], cam, 0);
    const half = new THREE.Matrix4().fromArray(rocks.instanceMatrix.array, 0);
    d.update([entry(f, 0.5)], cam, 0);
    const full = new THREE.Matrix4().fromArray(rocks.instanceMatrix.array, 0);
    expect(new THREE.Vector3().setFromMatrixScale(half).x).toBeLessThan(new THREE.Vector3().setFromMatrixScale(full).x);
  });
  it('builds a gargantuan near and fades it in, and lets it go when it’s far', () => {
    const { drawers } = createThingDrawers({ budget });
    for (const kind of GIANT_KINDS) {
      const row = { id: `E:1,0,1:w3`, kind, gargantuan: true, at: [0, 0, 0], size: 4000, body: 400, band: 300, span: Math.PI, mid: 0, axis: [0, 1, 0], light: [1, 0, 0], colors: ['#ffb070', '#ffffff'], seed: 7n };
      expect(KINDS[kind].near).toBe(false);
      expect(gargantuanKeeps(row).length).toBeGreaterThan(0);
      const g = new THREE.Group();
      const prepare = vi.fn();
      const d = drawers[kind](g, { prepare });
      d.update([{ id: row.id, at: row.at, size: row.size, d: 20000, row }], cam, 5);
      expect(prepare).toHaveBeenCalledTimes(1);
      const ops = [];
      g.traverse((o) => o.material && ops.push(o.material.opacity));
      expect(Math.max(...ops), kind).toBeGreaterThan(0.5);
      d.update([{ id: row.id, at: row.at, size: row.size, d: 80000, row }], cam, 5);
      expect(g.children.length, kind).toBe(0);
      d.dispose();
    }
  });
});
