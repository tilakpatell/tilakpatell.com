import { describe, expect, it } from 'vitest';
import { PUSH, buildProjected, decalFrame, groupByTexture, loadDecalThree, reaches } from './projected.js';

// a box lying on the ground, projecting down its X
const DOWN_X = [0, 0, Math.SQRT1_2, Math.SQRT1_2]; // Rz(90°): X → Y
const at = (texture, position, extra = {}) => ({ kind: 'projected', position, quaternion: DOWN_X, size: [1, 2, 2], normal: [0, 1, 0], texture, opacity: 1, ...extra });

describe('the pure parts', () => {
  it('groups by texture, in first-seen order', () => {
    const g = groupByTexture([at('a', [0, 0, 0]), at('b', [1, 0, 0]), at('a', [2, 0, 0])]);
    expect([...g.keys()]).toEqual(['a', 'b']);
    expect(g.get('a')).toHaveLength(2);
  });
  it('a projected decal’s box projects along its X: the projector’s Z is the box’s X, its image the box’s Y by Z', () => {
    const f = decalFrame(at('a', [0, 0, 0], { quaternion: [0, 0, 0, 1], size: [0.5, 3, 4] }));
    // 120° about (1, 1, 1): x → y, y → z, z → x
    expect(f.quaternion).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(f.size).toEqual([3, 4, 0.5]);
  });
  it('a volume box projects along its Y (when it falls to a projection): the frame turned −90° about X', () => {
    const f = decalFrame(at('a', [0, 0, 0], { kind: 'volume', quaternion: [0, 0, 0, 1], size: [3, 0.5, 4] }));
    expect(f.quaternion[0]).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(f.quaternion[3]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(f.size).toEqual([3, 4, 0.5]);
  });
  it('a decal reaches a target whose bounding sphere its box’s overlaps', () => {
    const t = { center: [0, 0, 0], radius: 5 };
    expect(reaches(at('a', [3, 0, 0]), t)).toBe(true);
    expect(reaches(at('a', [30, 0, 0]), t)).toBe(false);
  });
});

describe('buildProjected (three in Node)', () => {
  it('one merged mesh per texture, never one per decal; a decal over nothing is counted', async () => {
    const three = await loadDecalThree();
    const { THREE } = three;
    const plane = new THREE.PlaneGeometry(20, 20, 4, 4).rotateX(-Math.PI / 2);
    const targets = [{ geometry: plane, matrix: new THREE.Matrix4() }];
    const decals = [at('a', [0, 0, 0]), at('a', [4, 0, 0]), at('a', [-4, 0, 3]), at('b', [0, 0, -4]), at('b', [5, 0, 5]), at('a', [80, 0, 0])];
    const made = [];
    const materialFor = (tex) => {
      const m = new THREE.MeshBasicMaterial({ name: tex });
      made.push(m);
      return m;
    };
    const out = buildProjected(decals, targets, { ...three, materialFor });
    expect(out.meshes).toHaveLength(2);
    expect(out.meshes.map((m) => m.userData.texture).sort()).toEqual(['a', 'b']);
    expect(out.drawn).toBe(5);
    expect(out.empty).toBe(1);
    for (const m of out.meshes) {
      expect(m.geometry.attributes.position.count).toBeGreaterThan(0);
      expect(m.geometry.attributes.uv).toBeTruthy();
      expect(m.renderOrder).toBeGreaterThan(0);
    }
    // the 2 mm push off the surface, along its own normal (Review Focus 5)
    const ys = out.meshes[0].geometry.attributes.position.array.filter((_, i) => i % 3 === 1);
    for (const y of ys) expect(y).toBeCloseTo(PUSH, 5);
  });
  it('the push follows the surface, whichever way the record’s axis points', async () => {
    const three = await loadDecalThree();
    const { THREE } = three;
    const plane = new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2);
    const flipped = at('a', [0, 0, 0], { quaternion: [0, 0, -Math.SQRT1_2, Math.SQRT1_2], normal: [0, -1, 0] }); // X → −Y
    const out = buildProjected([flipped], [{ geometry: plane, matrix: new THREE.Matrix4() }], { ...three, materialFor: () => new THREE.MeshBasicMaterial() });
    expect(out.meshes[0].geometry.attributes.position.getY(0)).toBeCloseTo(PUSH, 5);
  });
  it('only the faces turned to the decal take it: not the back of the wall, not its sides', async () => {
    const three = await loadDecalThree();
    const { THREE } = three;
    const wall = new THREE.BoxGeometry(4, 4, 0.4); // front face at z = 0.2
    const onFront = (x) => at('a', [x, 0, 0.2], { quaternion: [0, -Math.SQRT1_2, 0, Math.SQRT1_2], size: [2, 1, 1], normal: [0, 0, 1] }); // X → +Z, 2 m deep
    const out = buildProjected([onFront(0), onFront(1.8)], [{ geometry: wall, matrix: new THREE.Matrix4() }], { ...three, materialFor: () => new THREE.MeshBasicMaterial() });
    const n = out.meshes[0].geometry.attributes.normal;
    expect(n.count).toBeGreaterThan(0);
    for (let i = 0; i < n.count; i++) expect(n.getZ(i)).toBeGreaterThan(0.99);
  });
  it('an atlas tile: the cut’s UVs fall in that tile of the sheet', async () => {
    const three = await loadDecalThree();
    const { THREE } = three;
    const plane = new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2);
    const out = buildProjected([at('a', [0, 0, 0], { tile: [1, 0, 2, 2] })], [{ geometry: plane, matrix: new THREE.Matrix4() }], { ...three, materialFor: () => new THREE.MeshBasicMaterial() });
    const uv = out.meshes[0].geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0.5 - 1e-6);
      expect(uv.getY(i)).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });
  it('an instanced target: the decal lands where the instance matrix puts the geometry', async () => {
    const three = await loadDecalThree();
    const { THREE } = three;
    const plane = new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2);
    const moved = new THREE.Matrix4().makeTranslation(50, 2, 0);
    const out = buildProjected([at('a', [50, 2, 0])], [{ geometry: plane, matrix: moved }], { ...three, materialFor: () => new THREE.MeshBasicMaterial() });
    expect(out.drawn).toBe(1);
    const p = out.meshes[0].geometry.attributes.position;
    expect(p.getX(0)).toBeGreaterThan(48);
    expect(p.getY(0)).toBeCloseTo(2 + PUSH, 4);
  });
});
