import { describe, expect, it } from 'vitest';
import { hasIndirect, indirectOf, loadGpuThree, setIndirect, upload } from './three.js';

// The hooks this folder takes from three r186; a three upgrade that moves
// one fails here first (docs/stack/three.md, "Upgrading").
describe('gpuScene/three.js', () => {
  it('finds the indirect attribute, the bundle and the storage attributes in three/webgpu', async () => {
    const g = await loadGpuThree();
    for (const k of ['IndirectStorageBufferAttribute', 'BundleGroup', 'StorageBufferAttribute', 'StorageInstancedBufferAttribute']) expect(typeof g[k]).toBe('function');
    const a = new g.IndirectStorageBufferAttribute(10, 5);
    expect(a.isIndirectStorageBufferAttribute).toBe(true);
    const node = g.tsl.instancedArray(4, 'uvec4');
    expect(typeof node.toAttribute).toBe('function');
  });

  it('sets a geometry’s indirect draws and reads them back as the backend does', async () => {
    const { THREE, IndirectStorageBufferAttribute } = await loadGpuThree();
    const geometry = new THREE.BufferGeometry();
    const attr = new IndirectStorageBufferAttribute(10, 5);
    setIndirect(geometry, attr, [0, 20, 40]);
    expect(geometry.getIndirect()).toBe(attr);
    // (a render object asks its geometries, which read the geometry's fields)
    const ro = { getIndirect: () => geometry.indirect, getIndirectOffset: () => geometry.indirectOffset };
    expect(indirectOf(ro)).toEqual({ attribute: attr, offsets: [0, 20, 40] });
    setIndirect(geometry, attr, [20]);
    expect(indirectOf(ro).offsets).toEqual([20]);
    expect(indirectOf({ getIndirect: () => null })).toBe(null);
  });

  it('sends one dirty span of rows, in the attribute’s own elements', async () => {
    const { StorageInstancedBufferAttribute } = await loadGpuThree();
    const a = new StorageInstancedBufferAttribute(new Uint32Array(8 * 10), 4);
    upload(a, { start: 3, count: 2 }, 2);
    expect(a.updateRanges).toEqual([{ start: 24, count: 16 }]);
    expect(a.version).toBe(1);
  });

  it('draws indirect only on WebGPU', () => {
    expect(hasIndirect({ isWebGPURenderer: true, backend: {} })).toBe(true);
    expect(hasIndirect({ isWebGPURenderer: true, backend: { isWebGLBackend: true } })).toBe(false);
    expect(hasIndirect({ isWebGLRenderer: true })).toBe(false);
  });
});
