import { describe, expect, it, vi } from 'vitest';
import { POLYGON_OFFSET, createDecals } from './decalScene.js';
import { loadDecalThree } from './projected.js';

// a box lying on the ground, projecting down its X (Rz(90°))
const at = (texture, position, extra = {}) => ({ kind: 'projected', position, quaternion: [0, 0, Math.SQRT1_2, Math.SQRT1_2], size: [1, 2, 2], normal: [0, 1, 0], texture, opacity: 1, ...extra });
const PACK = {
  format: 1,
  cell: 128,
  textures: ['a', 'b', 'c'],
  files: { a: 'tex/decals/a.ktx2', b: 'tex/decals/b.ktx2', c: 'tex/decals/c.ktx2' },
  cells: {
    '0,0': [at('a', [0, 0, 0]), at('a', [4, 0, 0]), at('a', [-4, 0, 3]), at('b', [0, 0, -4]), at('b', [5, 0, 5]), at('c', [-5, 0, -5], { kind: 'volume', quaternion: [0, 0, 0, 1], size: [4, 2, 4], opacity: 0.7 })],
    '1,0': [at('a', [130, 0, 0])],
  },
};

async function setup(opts = {}) {
  const three = await loadDecalThree();
  const { THREE } = three;
  const scene = new THREE.Scene();
  const loader = vi.fn(async () => new THREE.Texture());
  const plane = new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2);
  const targets = [{ geometry: plane, matrix: new THREE.Matrix4() }];
  const decals = createDecals({ scene, pack: PACK, loader, three, ...opts });
  return { THREE, scene, loader, targets, decals };
}
const drawn = (scene) => scene.children.flatMap((g) => g.children);

describe('createDecals', () => {
  it('a cell: one draw per texture for the projected, a box per volume decal where the depth can be read', async () => {
    const { scene, targets, decals } = await setup({ backend: 'webgpu' });
    await decals.cell(0, 0, targets);
    const meshes = drawn(scene);
    expect(meshes).toHaveLength(3);
    expect(meshes.filter((m) => m.material.side === 1)).toHaveLength(1); // the box's back faces
    expect(decals.stats()).toMatchObject({ draws: 3, decals: 6, textures: 3, fallback: 0 });
    const flat = meshes.find((m) => m.userData.texture === 'a').material;
    expect(flat.polygonOffset).toBe(true);
    expect(flat.polygonOffsetFactor).toBe(POLYGON_OFFSET);
    expect(flat.depthWrite).toBe(false);
    // drawn from the look: a colour, the coverage from the map
    expect(flat.colorNode?.isNode).toBe(true);
    expect(flat.opacityNode?.isNode).toBe(true);
  });
  it('volumes: false (a driver whose depth read fails) projects a volume decal over its box', async () => {
    const { scene, targets, decals } = await setup({ backend: 'nodes-webgl', volumes: false });
    await decals.cell(0, 0, targets);
    expect(drawn(scene).every((m) => m.material.side !== 1)).toBe(true);
    expect(decals.stats()).toMatchObject({ draws: 3, fallback: 1 });
  });
  it('the classic renderer draws none: its materials are not node materials', async () => {
    const { scene, targets, decals } = await setup({ backend: 'webgl' });
    await decals.cell(0, 0, targets);
    expect(drawn(scene)).toHaveLength(0);
  });
  it('a cell’s volume boxes of one texture are one draw', async () => {
    const vol = (p, o) => at('c', p, { kind: 'volume', quaternion: [0, 0, 0, 1], size: [4, 2, 4], opacity: o });
    const pack = { ...PACK, cells: { '0,0': [vol([0, 0, 0], 1), vol([10, 0, 0], 0.5), vol([20, 0, 0], 1)] } };
    const three = await loadDecalThree();
    const scene = new three.THREE.Scene();
    const d = createDecals({ scene, pack, loader: async () => new three.THREE.Texture(), three });
    await d.cell(0, 0, []);
    expect(drawn(scene)).toHaveLength(1);
    expect(drawn(scene)[0].count).toBe(3);
  });
  it('a texture is loaded once across cells, by its file', async () => {
    const { targets, decals, loader } = await setup();
    await decals.cell(0, 0, targets);
    await decals.cell(1, 0, targets);
    expect(loader.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b', 'c']);
    expect(loader).toHaveBeenCalledWith('a', 'tex/decals/a.ktx2');
    expect(decals.stats().draws).toBe(4);
  });
  it('drop takes a cell’s draws out and frees their geometry', async () => {
    const { scene, targets, decals } = await setup();
    await decals.cell(0, 0, targets);
    const geos = drawn(scene).filter((m) => m.material.side !== 1).map((m) => m.geometry);
    const spies = geos.map((g) => vi.spyOn(g, 'dispose'));
    decals.drop(0, 0);
    expect(drawn(scene)).toHaveLength(0);
    for (const s of spies) expect(s).toHaveBeenCalled();
    expect(decals.stats().draws).toBe(0);
  });
  it('low draws none; a cell without decals draws none', async () => {
    const low = await setup({ tier: 'low' });
    await low.decals.cell(0, 0, low.targets);
    expect(drawn(low.scene)).toHaveLength(0);
    const { scene, targets, decals } = await setup();
    await decals.cell(5, 5, targets);
    expect(drawn(scene)).toHaveLength(0);
  });
  it('a cell asked for twice is built once', async () => {
    const { scene, targets, decals } = await setup();
    await Promise.all([decals.cell(0, 0, targets), decals.cell(0, 0, targets)]);
    expect(drawn(scene)).toHaveLength(3);
  });
  it('dispose frees everything', async () => {
    const { scene, targets, decals } = await setup();
    await decals.cell(0, 0, targets);
    decals.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
