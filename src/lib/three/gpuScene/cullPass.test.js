import { describe, expect, it, vi } from 'vitest';
import { meshTable } from './cull.js';
import { createCull } from './cullPass.js';
import { createGpuScene } from './scene.js';
import { loadGpuThree } from './three.js';

// The cull pass built in Node (its compute nodes are made, never run: the
// renderer here only counts dispatches), for what it sends the GPU.
const pack = {
  meshes: [0, 1, 2].map(() => ({ bounds: [-1, -1, -1, 1, 1, 1], radius: 1.7, lods: [1], glb: [`m.glb`] })).map((m, i) => ({ ...m, glb: [`m${i}.glb`] })),
  far: { draws: [0, 1, 2].map((mesh) => ({ mesh, count: 2, offset: mesh * 2 })) },
};

async function made(slots = 8) {
  const three = await loadGpuThree();
  const table = meshTable(pack, 'high');
  const scene = createGpuScene({ capacity: 16 });
  const dispatched = [];
  const renderer = { compute: (n) => dispatched.push(n) };
  return { three, cull: createCull(renderer, { scene, table, hzb: null, three, slots }), dispatched };
}

describe('createCull', () => {
  it('sends every slot key set in a frame, not only the last (a group of parts set together)', async () => {
    const { three, cull, dispatched } = await made();
    // (a group of three parts: draws.js's rebuild sets each part's slot in one go)
    cull.setSlot(1, { key: 2, indexCount: 36, firstIndex: 0, baseVertex: 0 });
    cull.setSlot(2, { key: 0, indexCount: 6, firstIndex: 36, baseVertex: 24 });
    cull.setSlot(5, { key: 1, indexCount: 12, firstIndex: 42, baseVertex: 28 });
    cull.run(new three.THREE.PerspectiveCamera(), { now: 0, width: 64, height: 32, occlude: false });
    expect(dispatched.length).toBe(3);
    expect(Array.from(cull.slotKeys.array.subarray(1, 6))).toEqual([2, 0, 0, 0, 1]);
    // (one span over slots 1 to 5: each key with it, as the GPU will read them)
    expect(cull.slotKeys.updateRanges).toEqual([{ start: 1, count: 5 }]);
    expect(cull.slotCount).toBe(6);
  });

  // (an If whose callback hands back a node, `() => x.assign(y)`, is taken
  // by three as a return from an inline Fn: commented out, and a console
  // warning each, nineteen on Hoth's first frame)
  it('builds its three kernels to WGSL with no stray return', async () => {
    const { three, cull, dispatched } = await made();
    cull.run(new three.THREE.PerspectiveCamera(), { now: 0, width: 64, height: 32, occlude: false });
    const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 };
    const r = new three.THREE.WebGPURenderer({ canvas });
    // (no device in Node: the builder asks for features and is told none)
    r.hasFeature = () => false;
    r.backend.renderer = r;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const node of dispatched) {
        const b = new three.THREE.WGSLNodeBuilder(null, r);
        b.compute = node;
        b.build();
        expect(b.computeShader).not.toMatch(/\/\/ return /);
      }
      expect(warn.mock.calls.filter((c) => /Return statement/.test(String(c[0])))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('sends nothing of the keys on a frame that set none', async () => {
    const { three, cull } = await made();
    cull.run(new three.THREE.PerspectiveCamera(), { now: 0, width: 64, height: 32, occlude: false });
    expect(cull.slotKeys.updateRanges).toEqual([]);
    expect(cull.slotKeys.version).toBe(0);
  });
});
