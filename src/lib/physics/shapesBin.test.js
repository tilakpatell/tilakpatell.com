import { describe, expect, it } from 'vitest';
import { packHull, packShapes, readHull, readShapes } from './shapesBin.js';

describe('shapesBin version 2', () => {
  it('round-trips a hull with its radius and its parts', () => {
    const shapes = [
      { kind: 'hull', part: 0, material: 68, root: 0, points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]) },
      { kind: 'mesh', part: 1, material: 206, root: 1, points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) },
    ];
    const h = readHull(packHull({ radius: 0.62, parts: [{ name: 'body', property: 68 }, { name: 'reactor', property: 206 }], shapes }));
    expect(h.version).toBe(2);
    expect(h.radius).toBeCloseTo(0.62, 6);
    expect(h.parts).toEqual([{ name: 'body', property: 68 }, { name: 'reactor', property: 206 }]);
    expect(Array.from(h.shapes[1].indices)).toEqual([0, 1, 2]);
    expect(h.shapes[0].material).toBe(68);
  });

  it('still reads a version 1 bin, and readShapes reads a version 2 one', () => {
    const v1 = packShapes([{ kind: 'sphere', part: 0, material: 0, root: 0, centre: [1, 2, 3], radius: 4 }]);
    expect(readShapes(v1)[0].radius).toBe(4);
    expect(readHull(v1).parts).toEqual([]);
    const v2 = packHull({ radius: 1, parts: [], shapes: [{ kind: 'sphere', part: 0, material: 0, root: 0, centre: [0, 0, 0], radius: 2 }] });
    expect(readShapes(v2)[0].radius).toBe(2);
  });

  it('keeps unaligned names readable and multi-byte names intact', () => {
    const shapes = [{ kind: 'mesh', part: 0, material: 1, root: 0, points: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) }];
    const parts = [{ name: 'a', property: 1 }, { name: 'ré', property: 2 }, { name: '', property: 3 }];
    const h = readHull(packHull({ radius: 2, parts, shapes }));
    expect(h.parts).toEqual(parts);
    expect(Array.from(h.shapes[0].indices)).toEqual([0, 1, 2]);
  });

  it('refuses a name over 255 bytes and a version it does not know', () => {
    const shape = { kind: 'sphere', part: 0, material: 0, root: 0, centre: [0, 0, 0], radius: 1 };
    expect(() => packHull({ radius: 1, parts: [{ name: 'x'.repeat(256), property: 0 }], shapes: [shape] })).toThrow(/255/);
    expect(() => packHull({ radius: 1, parts: [{ name: 'é'.repeat(128), property: 0 }], shapes: [shape] })).toThrow(/255/);
    expect(() => packHull({ radius: 1, parts: [{ name: 'x'.repeat(255), property: 0 }], shapes: [shape] })).not.toThrow();
    const bad = packHull({ radius: 1, parts: [], shapes: [shape] });
    new DataView(bad).setUint32(4, 3, true);
    expect(() => readShapes(bad)).toThrow('shapes bin: version 3');
    expect(() => readHull(bad)).toThrow('shapes bin: version 3');
  });
});
