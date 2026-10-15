import { afterEach, describe, expect, it, vi } from 'vitest';
import * as glsl from './speedLines';
import * as nodes from './speedLinesNodes';

// a seeded Math.random, so the two builds lay out the same stars
const seeded = (seed = 7) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
const build = (make, o) => {
  vi.spyOn(Math, 'random').mockImplementation(seeded());
  const s = make(o);
  vi.restoreAllMocks();
  return s;
};
const lines = (s) => s.group.children[0];

describe('speedLinesNodes, the twin of speedLines', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exports what speedLines exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('the same lines, flags and uniforms by name, the same stars', () => {
    for (const small of [false, true]) {
      const a = build(glsl.createSpeedLines, { small });
      const n = build(nodes.createSpeedLines, { small });
      const la = lines(a);
      const ln = lines(n);
      expect(ln.isLineSegments).toBe(true);
      expect(ln.material.isNodeMaterial).toBe(true);
      for (const k of ['transparent', 'blending', 'side', 'depthWrite', 'depthTest']) expect(ln.material[k]).toBe(la.material[k]);
      expect(ln).toMatchObject({ frustumCulled: false, renderOrder: 50, visible: false });
      expect(Object.keys(ln.material.uniforms).sort()).toEqual(Object.keys(la.material.uniforms).sort());
      expect(ln.material.uniforms.uColor.value.toArray()).toEqual(la.material.uniforms.uColor.value.toArray());
      for (const att of ['position', 'aStar', 'aEnd']) expect(Array.from(ln.geometry.attributes[att].array)).toEqual(Array.from(la.geometry.attributes[att].array));
    }
  });

  it('set and update write the same values', () => {
    const a = glsl.createSpeedLines();
    const n = nodes.createSpeedLines();
    for (const s of [a, n]) {
      expect(s.busy).toBe(false);
      s.set({ stretch: 0.5, speed: 120 });
      s.update(0.25);
      s.update(3);
    }
    expect(n.busy).toBe(true);
    expect(lines(n).visible).toBe(true);
    for (const k of ['uTravel', 'uLen', 'uStretch']) expect(lines(n).material.uniforms[k].value).toBe(lines(a).material.uniforms[k].value);
    n.dispose();
  });
});
