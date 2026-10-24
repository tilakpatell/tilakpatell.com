import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SUBSYSTEMS, TURRETS } from '../universe/wars';
import { SECTIONS, componentsOf, cutParts, partSpecs, partsOf, piecesOf, reachOf } from './capitalParts';

// a ship 1 long as galaxy/models.js fits one: a holder scaled to the unit
// frame, a hull slab, and on its back a dome of its own (a separate piece)
// at the Star Destroyer's port generator
const ship = () => {
  const holder = new THREE.Group();
  holder.scale.setScalar(0.5); // (the model 2 long, as it came)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 2, 1, 1, 12), new THREE.MeshStandardMaterial());
  const domeAt = SUBSYSTEMS.destroyer[0].at;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial());
  dome.position.set(domeAt[0] * 2, domeAt[1] * 2, domeAt[2] * 2);
  holder.add(hull, dome);
  holder.updateMatrixWorld(true);
  return { holder, hull, dome };
};
const tris = (o) => (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;

describe('capitalParts', () => {
  it('finds a model’s separate pieces, corners shared by place as well as by number', () => {
    const box = new THREE.BoxGeometry(1, 1, 1); // (six faces, each its own corners)
    const two = new THREE.BoxGeometry(1, 1, 1).translate(5, 0, 0);
    const both = new THREE.BufferGeometry();
    const pos = new Float32Array([...box.attributes.position.array, ...two.attributes.position.array]);
    both.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    both.setIndex([...box.index.array, ...two.index.array.map((i) => i + box.attributes.position.count)]);
    const runs = componentsOf(both.index, both.attributes.position, both.index.count);
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.length)).toEqual([12, 12]);
  });

  it('takes the pieces within a part’s reach and no bigger than it, and none under its floor', () => {
    const { holder, hull, dome } = ship();
    const at = SUBSYSTEMS.destroyer[0].at;
    const got = piecesOf([hull, dome], { at, reach: 0.03 });
    expect(got.map((p) => p.mesh)).toEqual([dome]);
    expect(piecesOf([hull, dome], { at, reach: 0.03, low: at[1] + 0.01 })).toEqual([]);
    expect(reachOf({ r: 0.02 })).toBeCloseTo(0.027, 6);
    expect(reachOf({ r: 0.02, reach: 0.1 })).toBe(0.1);
    void holder;
  });

  it('says every Star Wars flagship’s subsystems and its batteries are parts, the others’ batteries alone', () => {
    for (const kind of ['destroyer', 'moncal', 'executor', 'interdictor', 'venator', 'providence', 'lucrehulk', 'gozanti']) {
      const specs = partSpecs(kind);
      expect(specs.filter((s) => s.kind !== 'battery').map((s) => s.id), kind).toEqual(['gen-port', 'gen-star', 'bridge', 'reactor']);
      expect(specs.filter((s) => s.kind === 'battery'), kind).toHaveLength(TURRETS[kind].length);
    }
    expect(partSpecs('councildread').every((s) => s.kind === 'battery')).toBe(true);
    // (the Star Destroyer's are the model's own; the MC80's built on its hull)
    expect(partSpecs('destroyer').filter((s) => s.kind !== 'battery').every((s) => s.build === null)).toBe(true);
    expect(partSpecs('moncal').find((s) => s.id === 'gen-port').build).toBe('dome');
  });

  it('cuts a copy: the dome a part of its own, the hull in three sections, the template as it was', () => {
    const { holder, hull } = ship();
    const before = tris(hull);
    const { holder: cut, ids } = cutParts(holder, 'destroyer', [{ id: 'gen-port', kind: 'shieldgen', at: SUBSYSTEMS.destroyer[0].at, r: 0.017, reach: 0.03, build: null }]);
    expect(ids).toEqual(['gen-port']);
    expect(tris(hull)).toBe(before); // (the template's geometry untouched)
    const parts = partsOf(cut);
    expect(parts.ids).toEqual(['gen-port']);
    const sections = parts.sections();
    expect(sections.every((s) => s.length > 0)).toBe(true);
    expect(sections.flat().reduce((n, m) => n + tris(m), 0)).toBe(before);
    // (each section's triangles on its side of the breaks)
    const v = new THREE.Vector3();
    cut.updateMatrixWorld(true);
    sections.forEach((meshes, i) => {
      for (const m of meshes) {
        const pos = m.geometry.attributes.position;
        const idx = m.geometry.index;
        for (let t = 0; t < idx.count; t += 3) {
          let z = 0;
          for (let c = 0; c < 3; c++) z += v.fromBufferAttribute(pos, idx.getX(t + c)).applyMatrix4(m.matrixWorld).z / 3;
          if (i === 0) expect(z).toBeLessThan(SECTIONS[0] + 1e-6);
          if (i === 2) expect(z).toBeGreaterThan(SECTIONS[1] - 1e-6);
        }
      }
    });
  });

  it('builds a part where the spec asks for one, on the hull’s side of its middle, and knocks a part off once', () => {
    const { holder } = ship();
    const at = [0, -0.06, 0];
    const { holder: cut, ids } = cutParts(holder, 'moncal', [{ id: 'reactor', kind: 'reactor', at, r: 0.04, build: 'bulb' }]);
    expect(ids).toEqual(['reactor']);
    const parts = partsOf(cut);
    const meshes = parts.knock('reactor');
    expect(meshes.length).toBeGreaterThan(0);
    expect(parts.knock('reactor')).toBeNull();
    expect(parts.has('reactor')).toBe(false);
    expect(parts.gone.has('reactor')).toBe(true);
    // (under the keel: turned over, its foot toward the hull, above its middle)
    const built = meshes[0].parent;
    expect(built.rotation.x).toBeCloseTo(Math.PI, 6);
    expect(built.position.y * holder.scale.x).toBeGreaterThan(at[1]);
  });
});
