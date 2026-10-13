import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { loadThree } from '../light/three.js';
import { body, threeWorld } from './fixtures/body.js';
import { canDrawRows, createFigureRows, sendRows } from './rows.js';
import { ROWS_AN_INSTANCE, rowVertex } from './skinNode.js';

const made = async (over = {}) => {
  const { tsl } = await loadThree();
  const scene = new THREE.Scene();
  return { scene, rows: createFigureRows({ scene, tsl, ...over }) };
};
const skinOf = (rows, mesh, key = 'body') => rows.part(key, mesh.geometry, mesh.material, { joints: mesh.skeleton.bones.length, bindMatrix: mesh.bindMatrix });
const vertexOf = (mesh, i) => ({
  index: [0, 1, 2, 3].map((k) => mesh.geometry.attributes.skinIndex.getComponent(i, k)),
  weight: [0, 1, 2, 3].map((k) => mesh.geometry.attributes.skinWeight.getComponent(i, k)),
  position: [0, 1, 2].map((k) => mesh.geometry.attributes.position.getComponent(i, k)),
});
// a place against the body's own, so a thousand-metre float32 does not hide a millimetre
const near = (got, want, origin, digits = 4) => got.forEach((v, k) => expect(v - origin.getComponent(k), `axis ${k}`).toBeCloseTo(want.getComponent(k) - origin.getComponent(k), digits));

describe('a part of the rows', () => {
  it('is one mesh a key: unculled, casting no shadow, drawing nothing yet, on a material of its own', async () => {
    const { scene, rows } = await made({ capacity: 8 });
    const { mesh } = body();
    const p = skinOf(rows, mesh);
    expect(skinOf(rows, mesh)).toBe(p);
    expect(rows.group.parent).toBe(scene);
    expect(rows.group.name).toBe('figureRows');
    expect(p.mesh.parent).toBe(rows.group);
    expect(p.mesh.geometry).toBe(mesh.geometry);
    expect(p.mesh.isSkinnedMesh).toBeFalsy();
    expect(p.mesh.frustumCulled).toBe(false);
    expect(p.mesh.castShadow).toBe(false);
    expect(p.mesh.receiveShadow).toBe(true);
    expect(p.mesh.count).toBe(0);
    expect(p.mesh.material).not.toBe(mesh.material);
    expect(p.mesh.material.name).toBe('mat_body');
    expect(p.mesh.material.positionNode.isNode).toBe(true);
    expect(mesh.material.positionNode).toBeUndefined();
    // two rows an instance, the root's four texels and four a joint
    expect(p.texture.image.width).toBe((2 + 1) * 4);
    expect(p.texture.image.height).toBe(8 * ROWS_AN_INSTANCE);
    expect(p.texture.type).toBe(THREE.FloatType);
    expect(rows.stats()).toMatchObject({ parts: 1, rows: 0, draws: 0 });
  });

  it('takes the node material three would make of the part’s own', async () => {
    const node = new THREE.MeshStandardMaterial({ name: 'node' });
    const fromMaterial = vi.fn(() => node);
    const { rows } = await made({ renderer: { library: { fromMaterial } } });
    const { mesh } = body();
    const p = skinOf(rows, mesh);
    expect(p.mesh.material).toBe(node);
    // (a copy went to three: the figure's own material is not the one converted)
    expect(fromMaterial.mock.calls[0][0]).not.toBe(mesh.material);
    expect(fromMaterial.mock.calls[0][0].name).toBe('mat_body');
  });
});

describe('placing', () => {
  it('lands a placed instance’s vertices where three’s own skinning puts them, weights that do not sum to one too', async () => {
    const { rows } = await made();
    const { root, mesh } = body();
    const p = skinOf(rows, mesh);
    rows.begin();
    rows.place(p, 0, mesh.skeleton, mesh.matrixWorld);
    rows.send();
    expect(p.mesh.count).toBe(1);
    // (to a hundredth of a millimetre, 1,300 m from the origin: the joints are re-based before they are float32)
    for (let i = 0; i < 3; i++) near(rowVertex(p.data, p.layout, 0, vertexOf(mesh, i)), threeWorld(mesh, i), root.position, 5);
    // (and three's CPU skinning agrees where the weights are whole)
    const cpu = mesh.getVertexPosition(0, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    near(rowVertex(p.data, p.layout, 0, vertexOf(mesh, 0)), cpu, root.position, 5);
  });

  it('places a part with no skin by its node’s whole world matrix', async () => {
    const { rows } = await made();
    const { root, gun } = body();
    const p = rows.part('gun', gun.geometry, gun.material);
    expect(p.texture.image.width).toBe(4);
    rows.begin();
    rows.place(p, 0, null, gun.matrixWorld);
    near(rowVertex(p.data, p.layout, 0, { position: [0.5, 0.5, 0.5] }), new THREE.Vector3(0.5, 0.5, 0.5).applyMatrix4(gun.matrixWorld), root.position);
  });

  it('draws what was placed this frame and no more', async () => {
    const { rows } = await made();
    const a = body();
    const b = body({ at: [10, 0, 10] });
    const p = skinOf(rows, a.mesh);
    rows.begin();
    rows.place(p, 0, a.mesh.skeleton, a.mesh.matrixWorld);
    rows.place(p, 1, b.mesh.skeleton, b.mesh.matrixWorld);
    rows.send();
    expect(p.mesh.count).toBe(2);
    expect(rows.stats()).toMatchObject({ rows: 2, draws: 1 });
    rows.begin();
    rows.place(p, 0, b.mesh.skeleton, b.mesh.matrixWorld);
    rows.send();
    expect(p.mesh.count).toBe(1);
    rows.begin();
    rows.send();
    expect(p.mesh.count).toBe(0);
    expect(rows.stats()).toMatchObject({ rows: 0, draws: 0 });
    // (a count set by hand)
    rows.count(p, 1);
    rows.send();
    expect(p.mesh.count).toBe(1);
  });

  it('keeps each instance’s pose of the frame before, by the instance it was, and gives a new one its own', async () => {
    const { rows } = await made();
    const a = body();
    const b = body({ at: [10, 0, 10] });
    const p = skinOf(rows, a.mesh);
    rows.begin();
    rows.place(p, 0, a.mesh.skeleton, a.mesh.matrixWorld);
    rows.place(p, 1, b.mesh.skeleton, b.mesh.matrixWorld);
    rows.send();
    // (new this frame: no movement of its own)
    expect(rowVertex(p.data, p.layout, 1, { ...vertexOf(b.mesh, 1), before: true })).toEqual(rowVertex(p.data, p.layout, 1, vertexOf(b.mesh, 1)));
    const was = threeWorld(b.mesh, 1);
    // b walks and bends its knee; a has left the rows, so b is instance 0 now
    b.root.position.x += 0.5;
    b.knee.rotation.x = 0.4;
    b.root.updateMatrixWorld(true);
    rows.begin();
    rows.place(p, 0, b.mesh.skeleton, b.mesh.matrixWorld, 1);
    rows.send();
    near(rowVertex(p.data, p.layout, 0, vertexOf(b.mesh, 1)), threeWorld(b.mesh, 1), b.root.position);
    near(rowVertex(p.data, p.layout, 0, { ...vertexOf(b.mesh, 1), before: true }), was, b.root.position);
    expect(threeWorld(b.mesh, 1).distanceTo(was)).toBeGreaterThan(0.4);
  });

  it('grows past its capacity: nothing placed is lost and nothing is left undrawn', async () => {
    const { rows } = await made({ capacity: 2 });
    const bodies = [0, 1, 2, 3, 4].map((k) => body({ at: [k * 3, 0, 0] }));
    const p = skinOf(rows, bodies[0].mesh);
    const first = p.texture;
    const gone = vi.fn();
    first.addEventListener('dispose', gone);
    rows.begin();
    bodies.forEach((b, i) => rows.place(p, i, b.mesh.skeleton, b.mesh.matrixWorld));
    rows.send();
    expect(p.mesh.count).toBe(5);
    expect(p.capacity).toBe(8);
    expect(p.texture).not.toBe(first);
    expect(p.texture.image.height).toBe(8 * ROWS_AN_INSTANCE);
    expect(p.texture.image.data).toBe(p.data);
    expect(p.nodes.rows.value).toBe(p.texture);
    expect(gone).toHaveBeenCalledTimes(1);
    bodies.forEach((b, i) => near(rowVertex(p.data, p.layout, i, vertexOf(b.mesh, 1)), threeWorld(b.mesh, 1), b.root.position));
    // (and the frame after still finds each one's pose of this frame)
    const was = threeWorld(bodies[4].mesh, 1);
    rows.begin();
    rows.place(p, 0, bodies[4].mesh.skeleton, bodies[4].mesh.matrixWorld, 4);
    near(rowVertex(p.data, p.layout, 0, { ...vertexOf(bodies[4].mesh, 1), before: true }), was, bodies[4].root.position);
  });
});

describe('letting go', () => {
  it('drops a part once: its mesh out of the group, its material and its texture freed, the figure’s own left alone', async () => {
    const { rows } = await made();
    const { mesh } = body();
    const p = skinOf(rows, mesh);
    const freed = { material: vi.fn(), texture: vi.fn(), own: vi.fn(), geometry: vi.fn() };
    p.mesh.material.addEventListener('dispose', freed.material);
    p.texture.addEventListener('dispose', freed.texture);
    mesh.material.addEventListener('dispose', freed.own);
    mesh.geometry.addEventListener('dispose', freed.geometry);
    expect(rows.drop('body')).toBe(true);
    expect(rows.drop('body')).toBe(false);
    expect(p.mesh.parent).toBe(null);
    expect(freed.material).toHaveBeenCalledTimes(1);
    expect(freed.texture).toHaveBeenCalledTimes(1);
    expect(freed.own).not.toHaveBeenCalled();
    expect(freed.geometry).not.toHaveBeenCalled();
    expect(rows.stats().parts).toBe(0);
    // (a dropped part is placed no more; the key makes a new one)
    rows.begin();
    rows.place(p, 0, mesh.skeleton, mesh.matrixWorld);
    expect(p.n).toBe(0);
    expect(skinOf(rows, mesh)).not.toBe(p);
  });

  it('disposes every material and texture it made, and leaves the scene', async () => {
    const { scene, rows } = await made();
    const { mesh, gun } = body();
    const parts = [skinOf(rows, mesh), rows.part('gun', gun.geometry, gun.material)];
    const freed = vi.fn();
    for (const p of parts) {
      p.mesh.material.addEventListener('dispose', freed);
      p.texture.addEventListener('dispose', freed);
    }
    rows.dispose();
    expect(freed).toHaveBeenCalledTimes(4);
    expect(rows.group.parent).toBe(null);
    expect(scene.children).toEqual([]);
    expect(rows.stats().parts).toBe(0);
  });
});

describe('sending the rows', () => {
  const texture = () => new THREE.DataTexture(new Float32Array(12 * 8 * 4), 12, 8, THREE.RGBAFormat, THREE.FloatType);

  it('sends the rows in use through the device’s queue once the backend has the texture', () => {
    const t = texture();
    const gpu = {};
    const writeTexture = vi.fn();
    const renderer = { backend: { has: (x) => x === t, get: () => ({ texture: gpu }), device: { queue: { writeTexture } } } };
    const data = new Float32Array(12 * 8 * 4);
    expect(sendRows(renderer, t, data, 4)).toBe('rows');
    expect(writeTexture).toHaveBeenCalledWith({ texture: gpu }, data, { bytesPerRow: 12 * 16, rowsPerImage: 4 }, { width: 12, height: 4 });
    expect(t.version).toBe(0);
    expect(t.image.data).toBe(data);
  });

  it('leaves the whole texture to three until the backend has made it, and on a backend with no queue', () => {
    const data = new Float32Array(12 * 8 * 4);
    for (const renderer of [null, { backend: { has: () => false } }, { backend: { has: () => true, get: () => ({ texture: {} }) } }]) {
      const t = texture();
      expect(sendRows(renderer, t, data, 4)).toBe('whole');
      expect(t.version).toBe(1);
      expect(t.image.data).toBe(data);
    }
  });

  it('counts what a frame sent', async () => {
    const { rows } = await made({ capacity: 4 });
    const { mesh } = body();
    const p = skinOf(rows, mesh);
    rows.begin();
    rows.place(p, 0, mesh.skeleton, mesh.matrixWorld);
    rows.send();
    // (no renderer here: the whole texture, four instances of two rows of three matrices)
    expect(rows.stats().sent).toEqual({ bytes: 4 * 2 * 3 * 64, whole: 1 });
  });
});

describe('canDrawRows', () => {
  it('is the node renderer on WebGPU, and nothing else', () => {
    const library = { fromMaterial: () => null };
    expect(canDrawRows({ isWebGPURenderer: true, backend: {}, library })).toBe(true);
    expect(canDrawRows({ isWebGPURenderer: true, backend: { isWebGLBackend: true }, library })).toBe(false);
    expect(canDrawRows({ isWebGLRenderer: true })).toBe(false);
    expect(canDrawRows(null)).toBe(false);
  });
});
