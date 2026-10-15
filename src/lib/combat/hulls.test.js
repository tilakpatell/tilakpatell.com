import { describe, it, expect } from 'vitest';
import { packHull, packShapes } from '../physics/shapesBin.js';
import { basisOf } from './pose.js';
import { hullOf, hullFromTriangles, probeSphere, segmentHit, hullContact } from './hulls.js';

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

  it('turns the ship by its basis, not its transpose', () => {
    // a block out along the nose, the ship turned 60° about y: a bolt down that way meets it at 0.8
    const a = Math.PI / 3;
    const fwd = { x: Math.sin(a), y: 0, z: Math.cos(a) };
    const { points, indices } = boxMesh(0.1, 0.1, 0.3);
    const h = hullOf(packHull({ radius: 1, parts: [{ name: 'p', property: 1 }], shapes: [{ kind: 'mesh', root: 1, points: points.map((v, i) => (i % 3 === 2 ? v + 0.5 : v)), indices }] }));
    const p = pose([0, 0, 0], [0, 0, 0], basisOf(fwd, { x: 0, y: 1, z: 0 }));
    const hit = segmentHit(h, p, [fwd.x * 5, 0, fwd.z * 5], [0, 0, 0]);
    expect(hit.t).toBeCloseTo((5 - 0.8) / 5, 5);
    close(hit.normal, [fwd.x, 0, fwd.z]);
    expect(segmentHit(h, p, [-fwd.x * 5, 0, fwd.z * 5], [0, 0, 0])).toBeNull();
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
    expect(c.depth).toBeCloseTo(1.015 + 0.001, 5); // its leading corners put back on the near face, and SKIN past it
    expect(c.at[2]).toBeCloseTo(-0.006, 5);
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
    expect(c.depth).toBeCloseTo(12.01 - (10 - 0.02) + 0.004, 4);
  });

  it('puts a ship that arrives inside out by the nearest face', () => {
    const big = hullOf(solidBin(0.5));
    const c = hullContact(probe(), pose([0.9, 0, 0.2]), big, pose([0, 0, 0], [0, 0, 0], I, 2));
    close(c.normal, [1, 0, 0]);
    expect(c.depth).toBeCloseTo(0.11 + 0.002, 5);
    expect(c.at[0]).toBeCloseTo(1.002, 5);
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

  it('keeps a ship that rests on a wall out of it, step after step, whether the wall is thinner than a step or than two', () => {
    // a 12 m fighter at 3.3 m a step against a plate on a 100 m capital (as the review found it)
    const fighter = hullOf(solidBin(0.5));
    for (const thick of [3, 5]) {
      const plate = hullOf(solidBin(0.5, 0.5, thick / 200));
      const near = -thick / 2;
      for (const start of [-20, -19.3, -18.05, -17.77]) {
        let z = start;
        let met = 0;
        for (let step = 0; step < 12; step++) {
          const c = hullContact(fighter, pose([0, 0, z], [0, 0, z + 3.3], I, 12), plate, pose([0, 0, 0], [0, 0, 0], I, 100));
          z += 3.3;
          if (c) {
            met++;
            close(c.normal, [0, 0, -1]);
            z -= c.depth;
          }
          expect(z + 6).toBeLessThanOrEqual(near + 1e-6); // its nose never inside the plate or past it (the plate is float32)
        }
        expect(met).toBeGreaterThan(5);
      }
    }
  });

  it('turns the small ship and the big one each by its own basis, not its transpose', () => {
    // a solid out along the big ship's nose, turned 60° about y: met along that way, not its mirror
    const a = Math.PI / 3;
    const fwd = { x: Math.sin(a), y: 0, z: Math.cos(a) };
    const out = boxMesh(0.1).points.map((v, i) => (i % 3 === 2 ? v + 0.5 : v));
    const along = hullOf(packHull({ radius: 1, parts: [{ name: 'p', property: 1 }], shapes: [{ kind: 'hull', root: 0, points: out }, { kind: 'mesh', root: 1, ...boxMesh(0.1) }] }));
    const big = pose([0, 0, 0], [0, 0, 0], basisOf(fwd, { x: 0, y: 1, z: 0 }), 2);
    const to = (d, x = fwd.x) => [x * d, 0, fwd.z * d];
    const c = hullContact(probe(), pose(to(3), to(0.95)), along, big);
    expect(c).not.toBeNull();
    close(c.normal, [fwd.x, 0, fwd.z]);
    expect(hullContact(probe(), pose(to(3, -fwd.x), to(0.95, -fwd.x)), along, big)).toBeNull();
    // and the small ship's own turn: a rod reaching out along its nose, turned so its tip comes in at the solid
    const rod = hullOf(packHull({ radius: 1, parts: [], shapes: [{ kind: 'hull', root: 0, points: boxMesh(0.01, 0.01, 0.5).points.map((v, i) => (i % 3 === 2 ? v + 0.5 : v)) }, { kind: 'mesh', root: 1, ...boxMesh(0.01) }] }));
    const spot = to(1);
    const from = [spot[0] - 2, 0, spot[2]];
    const into = [spot[0] - 0.9, 0, spot[2]];
    expect(hullContact(rod, pose(from, into, basisOf({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })), along, big)).not.toBeNull();
    expect(hullContact(rod, pose(from, into, basisOf({ x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })), along, big)).toBeNull();
  });
});

describe('hullContact on a hull with no solids', () => {
  const probe = () => hullOf(solidBin(0.01));
  const drawnBox = (flip = false) => {
    const { points, indices } = boxMesh(0.5);
    const idx = flip ? Uint32Array.from(indices, (_, i) => indices[i - (i % 3) + [0, 2, 1][i % 3]]) : indices;
    return hullFromTriangles(points, idx);
  };
  const at2 = pose([0, 0, 0], [0, 0, 0], I, 2);

  it('pushes a probe sitting still inside it out through the nearest face', () => {
    for (const big of [drawnBox(), drawnBox(true)]) {
      const c = hullContact(probe(), pose([0.7, 0.1, -0.2]), big, at2);
      expect(c).not.toBeNull();
      close(c.normal, [1, 0, 0]);
      expect(c.depth).toBeCloseTo(0.31 + 0.002, 5); // the probe farthest from the face, and SKIN
      expect(c.at[0]).toBeCloseTo(1.002, 5);
    }
  });

  it('treats a box with every triangle wound backwards as the box: an entry is caught, an exit is let go', () => {
    for (const big of [drawnBox(), drawnBox(true)]) {
      const c = hullContact(probe(), pose([-2, 0, 0], [-0.5, 0, 0]), big, at2);
      close(c.normal, [-1, 0, 0]);
      expect(c.depth).toBeCloseTo(0.51 + 0.002, 5);
      expect(hullContact(probe(), pose([0, 0, 0], [3, 0, 0]), big, at2)).toBeNull();
      expect(hullContact(probe(), pose([0.5, 0, 0], [0.9, 0.3, 0]), big, at2)).not.toBeNull(); // inside and staying: put out
      expect(hullContact(probe(), pose([3, 0, 0], [5, 0, 0]), big, at2)).toBeNull();
    }
  });

  it('meets a single-sided sheet from either side', () => {
    const sheet = hullFromTriangles(Float32Array.from([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), Uint32Array.from([0, 1, 2, 0, 2, 3]));
    close(hullContact(probe(), pose([0, 0, -1], [0, 0, 1]), sheet, pose([0, 0, 0])).normal, [0, 0, -1]);
    close(hullContact(probe(), pose([0, 0, 1], [0, 0, -1]), sheet, pose([0, 0, 0])).normal, [0, 0, 1]);
  });
});

describe('convex hulls', () => {
  // a ring of k points at each end of a cylinder (a prism where k is small), turned by `basis`
  const turned = (k, rad, len, basis) => {
    const out = new Float32Array(k * 6);
    for (let e = 0; e < 2; e++) {
      for (let j = 0; j < k; j++) {
        const l = [rad * Math.cos((2 * Math.PI * j) / k), rad * Math.sin((2 * Math.PI * j) / k), (e - 0.5) * len];
        out.set([0, 1, 2].map((i) => basis[i] * l[0] + basis[3 + i] * l[1] + basis[6 + i] * l[2]), (e * k + j) * 3);
      }
    }
    return out;
  };

  it('holds every point of a 32-sided cylinder and a 24-sided prism, turned many ways, and meets a probe inside', () => {
    const r = rnd(17);
    let built = 0;
    for (const [k, rad, len] of [
      [32, 0.3, 1],
      [24, 0.45, 0.4],
    ]) {
      for (let n = 0; n < 60; n++) {
        const basis = n < 30 ? basisOf({ x: Math.sin(n * 0.0654), y: 0, z: Math.cos(n * 0.0654) }, { x: 0, y: 1, z: 0 }) : basisOf({ x: r(), y: r(), z: r() }, { x: r(), y: r(), z: r() }, r() * 3);
        const points = turned(k, rad, len, basis);
        const h = hullOf(packHull({ radius: 1, parts: [{ name: 'c', property: 1 }], shapes: [{ kind: 'hull', root: 0, points }, { kind: 'hull', root: 1, points }] }));
        const pl = h.solids[0].planes;
        let worst = -Infinity;
        for (let i = 0; i < points.length; i += 3) for (let j = 0; j < pl.length; j += 4) worst = Math.max(worst, pl[j] * points[i] + pl[j + 1] * points[i + 1] + pl[j + 2] * points[i + 2] - pl[j + 3]);
        expect(worst).toBeLessThan(1e-4);
        // closed, and wound outward (the middle, the origin, behind every face)
        const t = h.rays.tris;
        const key = (o) => `${t[o]},${t[o + 1]},${t[o + 2]}`;
        const edges = new Set();
        for (let q = 0; q < h.rays.count; q++) for (let e = 0; e < 3; e++) edges.add(key(q * 9 + e * 3) + '>' + key(q * 9 + ((e + 1) % 3) * 3));
        let open = 0;
        for (const e of edges) if (!edges.has(e.split('>').reverse().join('>'))) open++;
        expect(open).toBe(0);
        for (let q = 0; q < h.rays.count; q++) {
          const o = q * 9;
          const e1 = [0, 1, 2].map((i) => t[o + 3 + i] - t[o + i]);
          const e2 = [0, 1, 2].map((i) => t[o + 6 + i] - t[o + i]);
          const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          expect(nn[0] * t[o] + nn[1] * t[o + 1] + nn[2] * t[o + 2]).toBeGreaterThan(0);
        }
        // a speck sitting near the axis is inside, and put out
        const near = [basis[6] * len * 0.2, basis[7] * len * 0.2, basis[8] * len * 0.2];
        expect(hullContact(hullOf(solidBin(0.005)), pose(near), h, pose([0, 0, 0]))).not.toBeNull();
        built++;
      }
    }
    expect(built).toBe(120);
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

  it('answers 10,000 segment tests against a 1,000-triangle hull in under 100 ms warm, and many times faster than testing every triangle', () => {
    const { positions, indices } = sphere(0.5, 20, 26);
    const h = hullFromTriangles(positions, indices);
    expect(h.rays.count).toBe(1000);
    const r = rnd(11);
    const p = pose([1, 2, 3], [1.1, 2, 3], basisOf({ x: 0.3, y: 0.2, z: 1 }, { x: 0, y: 1, z: 0 }, 0.4), 3);
    const segs = [];
    for (let i = 0; i < 10000; i++) segs.push([[1 + r() * 2, 2 + r() * 2, 3 + r() * 2], [1 + r() * 2, 2 + r() * 2, 3 + r() * 2]]);
    // (the engine warmed first, then the best of three runs: a shared CI
    // runner's first pass is its slowest, and a bound on the wall clock
    // alone was 65 ms there against 30 here)
    const timed = () => {
      let hits = 0;
      const t0 = performance.now();
      for (const [a, b] of segs) if (segmentHit(h, p, a, b)) hits++;
      return { ms: performance.now() - t0, hits };
    };
    timed();
    const runs = [timed(), timed(), timed()];
    expect(runs[0].hits).toBeGreaterThan(1000);
    const ms = Math.min(...runs.map((o) => o.ms));
    expect(ms).toBeLessThan(100);
    // and the tree earns its place: every triangle tested instead (Möller–Trumbore
    // in the ship's frame, the same segments) takes many times longer a query
    const m = p.basis;
    const inv = 1 / p.scale;
    const t = h.rays.tris;
    const brute = (a, b) => {
      const ax = a[0] - p.at0[0], ay = a[1] - p.at0[1], az = a[2] - p.at0[2];
      const bx = b[0] - p.at1[0], by = b[1] - p.at1[1], bz = b[2] - p.at1[2];
      const ox = (m[0] * ax + m[1] * ay + m[2] * az) * inv, oy = (m[3] * ax + m[4] * ay + m[5] * az) * inv, oz = (m[6] * ax + m[7] * ay + m[8] * az) * inv;
      const dx = (m[0] * bx + m[1] * by + m[2] * bz) * inv - ox, dy = (m[3] * bx + m[4] * by + m[5] * bz) * inv - oy, dz = (m[6] * bx + m[7] * by + m[8] * bz) * inv - oz;
      let best = Infinity;
      for (let i = 0; i < t.length; i += 9) {
        const e1x = t[i + 3] - t[i], e1y = t[i + 4] - t[i + 1], e1z = t[i + 5] - t[i + 2];
        const e2x = t[i + 6] - t[i], e2y = t[i + 7] - t[i + 1], e2z = t[i + 8] - t[i + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det;
        const sx = ox - t[i], sy = oy - t[i + 1], sz = oz - t[i + 2];
        const u = (sx * px + sy * py + sz * pz) * f;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * f;
        if (v < 0 || u + v > 1) continue;
        const k = (e2x * qx + e2y * qy + e2z * qz) * f;
        if (k >= 0 && k <= 1 && k < best) best = k;
      }
      return best < Infinity;
    };
    const some = segs.slice(0, 1000);
    const b0 = performance.now();
    let bruteHits = 0;
    for (const [a, b] of some) if (brute(a, b)) bruteHits++;
    const bruteMs = (performance.now() - b0) * 10; // (a tenth of the segments: scaled to the same count)
    let treeHits = 0;
    for (const [a, b] of some) if (segmentHit(h, p, a, b)) treeHits++;
    expect(treeHits).toBe(bruteHits);
    expect(bruteMs / ms).toBeGreaterThan(4);
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

describe('probeSphere', () => {
  it('is a ball of probes at its radius that a hull keeps out, by its radius', () => {
    const ball = probeSphere(0.15);
    expect(ball.probes.length).toBe(27 * 3);
    expect(Math.hypot(ball.probes[0], ball.probes[1], ball.probes[2])).toBeCloseTo(0.15, 6);
    expect(segmentHit(ball, pose([0, 0, 0]), [-1, 0, 0], [1, 0, 0])).toBeNull(); // (nothing to shoot)
    const plate = hullOf(solidBin(0.5, 0.5, 0.005));
    // flown at the plate (scaled ×4: its face at z = −0.02) from z = −1 to z = 0: its leading probe put back on the near face
    const c = hullContact(ball, pose([0, 0, -1], [0, 0, 0]), plate, pose([0, 0, 0], [0, 0, 0], I, 4));
    expect(c).not.toBeNull();
    close(c.normal, [0, 0, -1]);
    expect(c.depth).toBeCloseTo(0.15 + 0.02 + 0.004, 4); // (the leading probe, 0.15 ahead, back to the near face at −0.02, and SKIN × 4 past it)
    // and short of it, nothing
    expect(hullContact(ball, pose([0, 0, -1], [0, 0, -0.5]), plate, pose([0, 0, 0], [0, 0, 0], I, 4))).toBeNull();
  });
});
