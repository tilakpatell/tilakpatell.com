import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// a model kind with a light copy, loaded from a loader that answers at once
const CATALOG = { hut: { lod: true } };
vi.mock('./catalog', () => ({
  SURFACE_MODELS: CATALOG,
  modelUrlFor: (kind) => `/m/${kind}.glb`,
  surfaceLodUrl: (kind) => `/m/${kind}.lod1.glb`,
  wantsLod: () => true,
}));
vi.mock('../../../lib/three/gltf', () => ({
  gltfLoader: () => ({
    loadAsync: async () => {
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()));
      return { scene };
    },
  }),
}));

const { createPlacer } = await import('./placer');

const world = () => ({ heightAt: () => 0, solids: { box: vi.fn(), circle: vi.fn() }, floors: [] });

describe('a thing put on the grid of cells', () => {
  it("is noted with its light copy's arrival, and the catalogue is left alone", async () => {
    const placer = createPlacer({ parent: new THREE.Group(), kit: {}, world: world() });
    const put = placer.put({ kind: 'hut', at: [12, -30], chunk: true });
    expect(placer.chunked).toHaveLength(1);
    const [entry] = placer.chunked;
    expect(entry).toMatchObject({ x: 12, z: -30 });
    const object = await put;
    await entry.done;
    expect(entry.object).toBe(object);
    // (the chunk's own `low`, waited on by thingCells.js, not a field on the shared catalogue row)
    expect(entry.low).toBeInstanceOf(Promise);
    await entry.low;
    expect(CATALOG.hut).not.toHaveProperty('low');
    placer.dispose();
  });

  it('notes nothing put without `chunk`, in a zone, or clear of the fog', () => {
    const placer = createPlacer({ parent: new THREE.Group(), kit: {}, world: world() });
    placer.put({ kind: 'hut', at: [0, 0] });
    placer.put({ kind: 'hut', at: [0, 0], chunk: true, zone: 'inside' });
    placer.put({ kind: 'hut', at: [0, 0], chunk: true, fog: false });
    expect(placer.chunked).toHaveLength(0);
    placer.dispose();
  });
});
