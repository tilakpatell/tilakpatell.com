import { describe, expect, it } from 'vitest';
import { moduleOf, summarise } from './cpu-profile.mjs';

const frame = (functionName, url = '', lineNumber = 0) => ({ functionName, url, lineNumber, columnNumber: 0, scriptId: '1' });

// (root) → frame → sort → hypot; frame → step (rapier); (idle); (garbage collector)
const profile = {
  startTime: 0,
  endTime: 10000,
  nodes: [
    { id: 1, callFrame: frame('(root)'), children: [2, 5, 6] },
    { id: 2, callFrame: frame('frame', 'http://127.0.0.1:5188/src/runtime/runtime.js?t=1', 130), children: [3, 7] },
    { id: 3, callFrame: frame('sort', 'http://127.0.0.1:5188/src/components/galaxy/surface/level/levelScene.js', 210), children: [4] },
    { id: 4, callFrame: frame('hypot'), children: [] },
    { id: 5, callFrame: frame('(idle)'), children: [] },
    { id: 6, callFrame: frame('(garbage collector)'), children: [] },
    { id: 7, callFrame: frame('step', 'http://127.0.0.1:5188/node_modules/.vite/deps/@dimforge_rapier3d-simd.js?v=1', 9), children: [] },
  ],
  // each sample is on the stack for the next delta: 1 ms apart
  samples: [3, 4, 4, 7, 5, 5, 6, 2, 3, 3],
  timeDeltas: [0, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
};

describe('moduleOf', () => {
  it('names the site’s files by path and a dependency by package', () => {
    expect(moduleOf('http://127.0.0.1:5188/src/lib/level/lod.js?t=2')).toBe('src/lib/level/lod.js');
    expect(moduleOf('http://x/node_modules/.vite/deps/three.js?v=1')).toBe('three');
    expect(moduleOf('http://x/node_modules/.vite/deps/@dimforge_rapier3d.js')).toBe('rapier');
    expect(moduleOf('http://x/node_modules/three/examples/jsm/loaders/GLTFLoader.js')).toBe('three');
    expect(moduleOf('')).toBe('(native)');
  });
});

describe('summarise', () => {
  const s = summarise(profile, { frames: 2 });

  it('leaves idle out and sums the rest', () => {
    expect(s.idleMs).toBe(2);
    expect(s.ms).toBe(8);
  });

  it('sums self time by module and per frame', () => {
    const level = s.modules.find((m) => m.module === 'src/components/galaxy/surface/level/levelScene.js');
    expect(level.selfMs).toBe(3);
    expect(level.perFrame).toBe(1.5);
    expect(s.modules.find((m) => m.module === 'rapier').selfMs).toBe(1);
    expect(s.modules.find((m) => m.module === '(native)').selfMs).toBe(2);
  });

  it('counts a function’s callees in its total, each sample once', () => {
    const sort = s.total.find((r) => r.fn.startsWith('sort '));
    expect(sort.totalMs).toBe(5);
    expect(sort.fn).toBe('sort src/components/galaxy/surface/level/levelScene.js:211');
    expect(s.total.find((r) => r.fn.startsWith('frame ')).totalMs).toBe(7);
    expect(s.self[0].fn.startsWith('sort ')).toBe(true);
  });
});
