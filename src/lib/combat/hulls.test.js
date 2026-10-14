import { describe, it, expect } from 'vitest';
import { packHull, packShapes } from '../physics/shapesBin.js';
import { basisOf } from './pose.js';
import { hullOf, hullFromTriangles, segmentHit, hullContact } from './hulls.js';

const I = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const pose = (at0, at1 = at0, basis = I, scale = 1) => ({ at0, at1, basis, scale });
const close = (a, b, d = 5) => b.forEach((v, i) => expect(a[i]).toBeCloseTo(v, d));

// a box's corners and its twelve triangles, wound outward
function boxMesh(hx, hy = hx, hz = hx) {
  const points = new Float32Array(24);
  for (let i = 0; i < 8; i++) points.set([i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz], i * 3);
  const faces = [
    [0, 2, 6, 4],
    [1, 3, 7, 5],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 1, 3, 2],
    [4, 5, 7, 6],
  ];
  const indices = [];
  const p = (k) => [points[k * 3], points[k * 3 + 1], points[k * 3 + 2]];
  for (const [a, b, c, d] of faces) {
    for (const [u, v, w] of [
      [a, b, c],
      [a, c, d],
    ]) {
      const [pu, pv, pw] = [p(u), p(v), p(w)];
      const e1 = pv.map((x, i) => x - pu[i]);
      const e2 = pw.map((x, i) => x - pu[i]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const out = n[0] * (pu[0] + pv[0] + pw[0]) + n[1] * (pu[1] + pv[1] + pw[1]) + n[2] * (pu[2] + pv[2] + pw[2]);
      indices.push(...(out > 0 ? [u, v, w] : [u, w, v]));
    }
  }
  return { points, indices: Uint32Array.from(indices) };
}

// a 1×1×1 box, root 1 mesh, part 0, property 68
const boxBin = () => packHull({ radius: Math.sqrt(3) / 2, parts: [{ name: 'hull', property: 68 }], shapes: [{ kind: 'mesh', part: 0, material: 0, root: 1, ...boxMesh(0.5) }] });

// a box as both roots: a convex hull to be solid, a mesh to be shot
const solidBin = (hx, hy = hx, hz = hx, property = 3) =>
  packHull({
    radius: Math.hypot(hx, hy, hz),
    parts: [{ name: 'body', property }],
    shapes: [
      { kind: 'hull', part: 0, material: 0, root: 0, points: boxMesh(hx, hy, hz).points },
      { kind: 'mesh', part: 0, material: 0, root: 1, ...boxMesh(hx, hy, hz) },
    ],
  });

// a UV sphere: 2 × segs × (rings − 1) triangles
function sphere(r, segs, rings) {
  const positions = new Float32Array((rings + 1) * segs * 3);
  for (let i = 0; i <= rings; i++) {
    const th = (Math.PI * i) / rings;
    for (let j = 0; j < segs; j++) {
      const ph = (2 * Math.PI * j) / segs;
      positions.set([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)], (i * segs + j) * 3);
    }
  }
  const idx = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j;
      const b = i * segs + ((j + 1) % segs);
      const c = (i + 1) * segs + j;
      const d = (i + 1) * segs + ((j + 1) % segs);
      if (i > 0) idx.push(a, c, b);
      if (i < rings - 1) idx.push(b, c, d);
    }
  }
  return { positions, indices: Uint32Array.from(idx) };
}

const rnd = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;

describe('segmentHit', () => {
  it('meets a box where the segment enters it', () => {
    const h = hullOf(boxBin());
    const hit = segmentHit(h, { at0: [0, 0, 0], at1: [0, 0, 0], basis: I, scale: 2 }, [-5, 0, 0], [5, 0, 0]);
    expect(hit.t).toBeCloseTo(0.4, 5);
    expect(hit.point[0]).toBeCloseTo(-1, 5);
    expect(hit.normal).toEqual([-1, 0, 0]);
    expect(hit.property).toBe(68);
    expect(hit.part).toBe(0);
  });

  it('misses beside it, and meets it turned', () => {
    const h = hullOf(boxBin());
    expect(segmentHit(h, pose([0, 0, 0], [0, 0, 0], I, 2), [-5, 1.2, 0], [5, 1.2, 0])).toBeNull();
    const turned = basisOf({ x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 }, { x: 0, y: 1, z: 0 });
    const hit = segmentHit(h, pose([0, 0, 0], [0, 0, 0], turned, 2), [-5, 0, 0], [5, 0, 0]);
    expect(hit).not.toBeNull();
    expect(hit.point[0]).toBeCloseTo(-Math.SQRT2, 5);
    expect(hit.t).toBeCloseTo((5 - Math.SQRT2) / 10, 5);
    expect(Math.hypot(...hit.normal)).toBeCloseTo(1, 5);
    expect(hit.normal[0]).toBeLessThan(0);
    // and from the far side the normal faces back along the bolt
    const back = segmentHit(h, pose([0, 0, 0], [0, 0, 0], I, 2), [0, 0, 5], [0, 0, -5]);
    expect(back.normal).toEqual([0, 0, 1]);
  });

  it('meets a box moving across the segment (the moving frame)', () => {
    const h = hullOf(boxBin());
    const hit = segmentHit(h, pose([0, 0, -3], [0, 0, 3], I, 2), [-5, 0, 0], [5, 0, 0]);
    expect(hit).not.toBeNull();
    expect(hit.t).toBeCloseTo(0.4, 5);
    close(hit.point, [-1, 0, 0]);
    // the box held still at either end of the step is missed
    expect(segmentHit(h, pose([0, 0, 3], [0, 0, 3], I, 2), [-5, 0, 0], [5, 0, 0])).toBeNull();
    expect(segmentHit(h, pose([0, 0, -3], [0, 0, -3], I, 2), [-5, 0, 0], [5, 0, 0])).toBeNull();
  });

  it('takes points as [x, y, z] or { x, y, z }', () => {
    const h = hullOf(boxBin());
    const hit = segmentHit(h, pose([0, 0, 0], [0, 0, 0], I, 2), { x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(hit.t).toBeCloseTo(0.4, 5);
  });
});

describe('hullOf', () => {
  it('reads root 1 for bolts and root 0 for contact, each shape with its part’s property', () => {
    const cube = boxMesh(0.5).points;
    const inner = Float32Array.from([...cube, 0, 0, 0, 0.1, 0.2, -0.1]); // two points inside: neither a corner
    const little = boxMesh(0.1).points.map((v, i) => (i % 3 === 2 ? v + 2 : v));
    const h = hullOf(
      packHull({
        radius: 2.2,
        parts: [
          { name: 'body', property: 68 },
          { name: 'wing', property: 34 },
        ],
        shapes: [
          { kind: 'hull', part: 0, material: 0, root: 0, points: inner },
          { kind: 'mesh', part: 1, material: 0, root: 1, ...boxMesh(0.5) },
          { kind: 'hull', part: 0, material: 0, root: 1, points: little },
        ],
      }),
    );
    expect(h.radius).toBeCloseTo(2.2, 5);
    expect(h.parts.map((p) => p.name)).toEqual(['body', 'wing']);
    expect(h.rays.count).toBe(24); // the mesh's 12 and the little hull's 12 faces
    expect(h.solids).toHaveLength(1);
    expect(h.solids[0].part).toBe(0);
    expect(h.solids[0].planes.length / 4).toBe(6); // a cube's faces, its coplanar triangles merged
    expect(h.probes.length / 3).toBe(9); // eight corners and the centre
    expect(segmentHit(h, pose([0, 0, 0]), [-5, 0, 0], [5, 0, 0]).property).toBe(34);
    const nose = segmentHit(h, pose([0, 0, 0]), [0, 0, 5], [0, 0, 0.6]);
    expect(nose.property).toBe(68);
    expect(nose.t).toBeCloseTo((5 - 2.1) / 4.4, 5);
  });

  it('takes every triangle for bolts where there is one root, and no solids', () => {
    const h = hullOf(boxBin());
    expect(h.rays.count).toBe(12);
    expect(h.solids).toEqual([]);
    expect(h.probes.length / 3).toBeGreaterThanOrEqual(9); // the box's corners and its centre
  });

  it('falls back to the shape’s material where the bin names no parts', () => {
    const h = hullOf(packShapes([{ kind: 'mesh', part: 0, material: 12, root: 0, ...boxMesh(0.5) }]));
    expect(segmentHit(h, pose([0, 0, 0]), [-5, 0, 0], [5, 0, 0]).property).toBe(12);
  });
});

describe('hullContact', () => {
  const probe = () => hullOf(solidBin(0.01)); // a speck: its corners and centre

  it('pushes a probe that has crossed a thin wall out the side it came from', () => {
    const plate = hullOf(solidBin(0.5, 0.5, 0.005));
    const c = hullContact(probe(), pose([0, 0, -1], [0, 0, 1]), plate, pose([0, 0, 0]));
    expect(c).not.toBeNull();
    close(c.normal, [0, 0, -1]);
    expect(c.depth).toBeGreaterThan(0);
    expect(c.depth).toBeCloseTo(1.015, 5); // its leading corners put back on the near face
    expect(c.at[2]).toBeCloseTo(-0.005, 5);
    expect(c.part).toBe(0);
    // stopped short of it, nothing
    expect(hullContact(probe(), pose([0, 0, -1], [0, 0, -0.1]), plate, pose([0, 0, 0]))).toBeNull();
  });

  it('reads the wall where it is turned and moved to, in the world', () => {
    const plate = hullOf(solidBin(0.5, 0.5, 0.005));
    const turned = basisOf({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }); // the plate's z along world x
    const c = hullContact(probe(), pose([8, 0, 0], [12, 0, 0]), plate, pose([10, 0, 0], [10, 0, 0], turned, 4));
    expect(c).not.toBeNull();
    close(c.normal, [-1, 0, 0]);
    expect(c.depth).toBeCloseTo(12.01 - (10 - 0.02), 4);
  });

  it('puts a ship that arrives inside out by the nearest face', () => {
    const big = hullOf(solidBin(0.5));
    const c = hullContact(probe(), pose([0.9, 0, 0.2]), big, pose([0, 0, 0], [0, 0, 0], I, 2));
    close(c.normal, [1, 0, 0]);
    expect(c.depth).toBeCloseTo(0.11, 5);
    expect(c.at[0]).toBeCloseTo(1, 5);
    // and one on its way out is let go
    expect(hullContact(probe(), pose([0.9, 0, 0], [1.5, 0, 0]), big, pose([0, 0, 0], [0, 0, 0], I, 2))).toBeNull();
  });

  it('falls back to the ray triangles where the big hull has no solids', () => {
    const big = hullOf(boxBin());
    const c = hullContact(probe(), pose([-2, 0, 0], [-0.5, 0, 0]), big, pose([0, 0, 0], [0, 0, 0], I, 2));
    expect(c).not.toBeNull();
    close(c.normal, [-1, 0, 0]);
    // the leading corners' 0.51 behind the face, and a thousandth of the big ship's length
    expect(c.depth).toBeCloseTo(0.51 + 0.002, 5);
    // a probe leaving through a face is not caught on it
    expect(hullContact(probe(), pose([0, 0, 0], [3, 0, 0]), big, pose([0, 0, 0], [0, 0, 0], I, 2))).toBeNull();
  });
});

describe('hullFromTriangles', () => {
  it('hullFromTriangles keeps a 20,000-triangle sphere under 1,500 and its radius within 3 %', () => {
    const { positions, indices } = sphere(0.5, 100, 101);
    expect(indices.length / 3).toBe(20000);
    const h = hullFromTriangles(positions, indices, { property: 9, name: 'mine' });
    expect(h.rays.count).toBeLessThanOrEqual(1500);
    expect(h.rays.count).toBeGreaterThan(300);
    expect(Math.abs(h.radius - 0.5) / 0.5).toBeLessThan(0.03);
    for (let i = 0; i < h.rays.tris.length; i += 3) expect(Math.abs(Math.hypot(h.rays.tris[i], h.rays.tris[i + 1], h.rays.tris[i + 2]) - 0.5)).toBeLessThan(0.015);
    expect(h.parts).toEqual([{ name: 'mine', property: 9 }]);
    expect(h.solids).toEqual([]);
    expect(h.probes.length / 3).toBeGreaterThan(6);
    const hit = segmentHit(h, pose([0, 0, 0]), [0.1, 0.05, -3], [0.1, 0.05, 3]);
    expect(hit.property).toBe(9);
    expect(Math.abs(hit.point[2] + Math.sqrt(0.25 - 0.0125)) / 0.5).toBeLessThan(0.03);
  });

  it('keeps a model already under the cap as it is', () => {
    const { positions, indices } = sphere(0.5, 20, 26);
    expect(hullFromTriangles(positions, indices).rays.count).toBe(1000);
  });

  it('answers 10,000 segment tests against a 1,000-triangle hull in under 50 ms', () => {
    const { positions, indices } = sphere(0.5, 20, 26);
    const h = hullFromTriangles(positions, indices);
    expect(h.rays.count).toBe(1000);
    const r = rnd(11);
    const p = pose([1, 2, 3], [1.1, 2, 3], basisOf({ x: 0.3, y: 0.2, z: 1 }, { x: 0, y: 1, z: 0 }, 0.4), 3);
    const segs = [];
    for (let i = 0; i < 10000; i++) segs.push([[1 + r() * 2, 2 + r() * 2, 3 + r() * 2], [1 + r() * 2, 2 + r() * 2, 3 + r() * 2]]);
    let hits = 0;
    const t0 = performance.now();
    for (const [a, b] of segs) if (segmentHit(h, p, a, b)) hits++;
    const ms = performance.now() - t0;
    console.log(`hulls: 10,000 segments against 1,000 triangles in ${ms.toFixed(1)} ms (${hits} hits)`);
    expect(hits).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(50);
  });

  it('finds the nearest triangle the brute-force way would', () => {
    const { positions, indices } = sphere(0.5, 20, 26);
    const h = hullFromTriangles(positions, indices);
    const { tris, count } = h.rays;
    const r = rnd(5);
    for (let n = 0; n < 300; n++) {
      const a = [r() * 0.8, r() * 0.8, r() * 0.8];
      const b = [r() * 0.8, r() * 0.8, r() * 0.8];
      const d = b.map((v, i) => v - a[i]);
      let best = Infinity;
      for (let k = 0; k < count; k++) {
        const v0 = [tris[k * 9], tris[k * 9 + 1], tris[k * 9 + 2]];
        const e1 = [0, 1, 2].map((i) => tris[k * 9 + 3 + i] - v0[i]);
        const e2 = [0, 1, 2].map((i) => tris[k * 9 + 6 + i] - v0[i]);
        const cr = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
        const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
        const pv = cr(d, e2);
        const det = dot(e1, pv);
        if (Math.abs(det) < 1e-12) continue;
        const s = a.map((v, i) => v - v0[i]);
        const u = dot(s, pv) / det;
        const q = cr(s, e1);
        const v = dot(d, q) / det;
        const t = dot(e2, q) / det;
        if (u >= 0 && v >= 0 && u + v <= 1 && t >= 0 && t <= 1 && t < best) best = t;
      }
      const hit = segmentHit(h, pose([0, 0, 0]), a, b);
      if (best === Infinity) expect(hit).toBeNull();
      else expect(hit.t).toBeCloseTo(best, 5);
    }
  });
});
