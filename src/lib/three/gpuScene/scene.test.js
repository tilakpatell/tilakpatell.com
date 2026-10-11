import { describe, expect, it } from 'vitest';
import { FLAG, ROW_U32, packInstances } from './pack.js';
import { createGpuScene } from './scene.js';

const packed = (n, mesh = 1) => {
  const out = new Uint32Array(n * ROW_U32);
  packInstances(Array.from({ length: n }, (_, i) => ({ position: [i, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], mesh })), out);
  return out;
};

describe('createGpuScene', () => {
  it('appends a cell’s rows, frees them by flag and reuses the slots', () => {
    const s = createGpuScene({ capacity: 64 });
    const a = s.append(packed(100), 100);
    expect(a).toEqual({ start: 0, count: 100 });
    expect(s.count).toBe(100);
    expect(s.capacity).toBe(128); // doubled once
    expect(s.grew).toBe(1);
    s.free(a);
    expect(s.dead).toBe(100);
    // (the rows stay where they were, flagged dead: the cull pass skips them)
    expect(s.rows[ROW_U32 * 5 + 7] & FLAG.live << 16).toBe(0);
    const b = s.append(packed(50, 7), 50);
    expect(b).toEqual({ start: 0, count: 50 });
    expect(s.dead).toBe(50);
    expect(s.count).toBe(100);
    expect(s.meshOf(10)).toBe(7);
  });

  it('counts the live instances of each mesh, for the draw slots’ room', () => {
    const s = createGpuScene({ capacity: 16 });
    const a = s.append(packed(3, 2), 3);
    s.append(packed(4, 5), 4);
    expect(s.perMesh().get(2)).toBe(3);
    expect(s.perMesh().get(5)).toBe(4);
    s.free(a);
    expect(s.perMesh().get(2) ?? 0).toBe(0);
  });

  it('keeps the dirty span for one upload, and merges the freed spans', () => {
    const s = createGpuScene({ capacity: 32 });
    const a = s.append(packed(4), 4);
    const b = s.append(packed(4), 4);
    expect(s.takeDirty()).toEqual({ start: 0, count: 8 });
    expect(s.takeDirty()).toBe(null);
    s.free(a);
    s.free(b);
    expect(s.takeDirty()).toEqual({ start: 0, count: 8 });
    // (a span of 8 again: the two freed spans were merged)
    expect(s.append(packed(8), 8)).toEqual({ start: 0, count: 8 });
  });

  it('a range freed twice is freed once', () => {
    const s = createGpuScene({ capacity: 8 });
    const a = s.append(packed(2), 2);
    s.free(a);
    s.free(a);
    expect(s.dead).toBe(2);
    expect(s.append(packed(3), 3)).toEqual({ start: 2, count: 3 });
  });
});
