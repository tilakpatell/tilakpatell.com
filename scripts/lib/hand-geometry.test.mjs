import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { handShape } from '../../src/lib/three/grip.js';
import { canonicalFrame, chainRadius, fingerChain, fingerGroups, fingerWeights, twistWeights } from './hand-geometry.mjs';
import { FRAME, hand, tube } from './hand.fixture.mjs';

const V = THREE.Vector3;

// handShape with the knuckle line at y = 10
function shapeOf(pts) {
  const A = pts.map((p) => p.y).sort((a, b) => a - b);
  const at = (f) => A[Math.round(f * (A.length - 1))];
  const lo = Math.max(0, at(0.01));
  const hi = at(0.99);
  return handShape(pts, FRAME, { knuckle: (10 - lo) / (hi - lo) });
}

describe('fingerGroups', () => {
  it('reads four fingers and a thumb from the mesh, index first', () => {
    const h = hand();
    const g = fingerGroups(h.pts, shapeOf(h.pts), FRAME, { tris: h.tris });
    expect(g.kind).toBe('fingers');
    expect(g.fingers).toHaveLength(4);
    ['index', 'middle', 'ring', 'pinky'].forEach((name, i) => {
      const mine = new Set(h.fingers[name]);
      expect(g.fingers[i].every((j) => mine.has(j))).toBe(true);
      expect(g.fingers[i].length).toBeGreaterThan(mine.size * 0.6);
    });
    const thumb = new Set(g.thumb);
    expect(h.thumb.filter((j) => thumb.has(j)).length).toBeGreaterThan(h.thumb.length * 0.6);
    expect(Object.values(h.fingers).flat().some((j) => thumb.has(j))).toBe(false);
  });
  it('reads the same hand from its points alone, by the gaps between the fingers', () => {
    const h = hand();
    const g = fingerGroups(h.pts, shapeOf(h.pts), FRAME);
    expect(g.kind).toBe('fingers');
    expect(g.fingers.map((f) => Math.round(f.reduce((s, j) => s + h.pts[j].z, 0) / f.length))).toEqual([3, 1, -1, -3]);
  });
  it('calls a hand with no gaps a mitten: one slab, or fingers sewn together', () => {
    const slab = hand({ fused: true });
    const g = fingerGroups(slab.pts, shapeOf(slab.pts), FRAME, { tris: slab.tris });
    expect(g.kind).toBe('mitten');
    expect(g.fingers).toHaveLength(1);
    expect(g.fingers[0].length).toBeGreaterThan(slab.fingers.slab.length * 0.8);
    expect(fingerGroups(slab.pts, shapeOf(slab.pts), FRAME).kind).toBe('mitten');
    const glove = hand({ r: 1 });
    expect(fingerGroups(glove.pts, shapeOf(glove.pts), FRAME).kind).toBe('mitten');
  });
  it('finds a thumb hung under the palm, as a relaxed hand holds it', () => {
    const h = hand({ thumb: 'under' });
    const g = fingerGroups(h.pts, shapeOf(h.pts), FRAME, { tris: h.tris });
    expect(g.kind).toBe('fingers');
    const thumb = new Set(g.thumb ?? []);
    expect(h.thumb.filter((j) => thumb.has(j)).length).toBeGreaterThan(h.thumb.length * 0.6);
    expect(Object.values(h.fingers).flat().some((j) => thumb.has(j))).toBe(false);
    expect(g.fingers.flat().some((j) => h.thumb.includes(j))).toBe(false);
  });
  it('finds no thumb where none stands out', () => {
    const h = hand({ thumb: false });
    const g = fingerGroups(h.pts, shapeOf(h.pts), FRAME, { tris: h.tris });
    expect(g.kind).toBe('fingers');
    expect(g.thumb).toBeNull();
  });
});

describe('fingerChain', () => {
  it('puts three joints at 0, ⅓ and ⅔ of a straight finger, each aimed at the next', () => {
    const pts = [];
    tube(pts, [], (t) => new V(0, 10 + 6 * t, 1), { r: 0.6 });
    const chain = fingerChain(pts, { joints: 3, toward: FRAME.along });
    expect(chain).toHaveLength(3);
    chain.forEach((j, i) => {
      expect(j.at[1]).toBeCloseTo(10 + 2 * i, 0);
      expect(Math.abs(j.at[2] - 1)).toBeLessThan(0.05);
      expect(new V(...j.axis).dot(FRAME.along)).toBeGreaterThan(0.999);
      expect(j.len).toBeCloseTo(2, 0);
    });
  });
  it('follows a curled finger, not its chord', () => {
    const pts = [];
    // a quarter circle of radius 4 from the knuckle, curling toward the palm (−x)
    const line = (t) => new V(-4 + 4 * Math.cos((t * Math.PI) / 2), 10 + 4 * Math.sin((t * Math.PI) / 2), 0);
    tube(pts, [], line, { r: 0.6, rings: 25 });
    const chain = fingerChain(pts, { joints: 3, toward: FRAME.along });
    for (const j of chain) {
      const p = new V(...j.at);
      const off = Math.abs(Math.hypot(p.x + 4, p.y - 10) - 4); // from the centre line's arc
      expect(off).toBeLessThan(0.35);
    }
    expect(new V(...chain[0].axis).dot(new V(...chain[2].axis))).toBeLessThan(0.9);
  });
  it('puts two joints on a thumb or a mitten, at 0 and ½', () => {
    const pts = [];
    tube(pts, [], (t) => new V(0, 10 + 6 * t, 0), { r: 1 });
    const chain = fingerChain(pts, { joints: 2, toward: FRAME.along });
    expect(chain.map((j) => Math.round(j.at[1]))).toEqual([10, 13]);
  });
});

describe('chainRadius', () => {
  it('is the finger’s thickness about its line', () => {
    const pts = [];
    tube(pts, [], (t) => new V(0, 10 + 6 * t, 1), { r: 0.6 });
    expect(chainRadius(pts, fingerChain(pts, { joints: 3, toward: FRAME.along }))).toBeCloseTo(0.6, 1);
  });
});

describe('canonicalFrame', () => {
  it('turns +y along the finger and +z out of the back of the hand, +x their cross', () => {
    const along = new V(0.3, 1, 0.1).normalize();
    const q = new THREE.Quaternion(...canonicalFrame(along, new V(1, 0.2, 0)));
    const y = new V(0, 1, 0).applyQuaternion(q);
    const z = new V(0, 0, 1).applyQuaternion(q);
    const x = new V(1, 0, 0).applyQuaternion(q);
    expect(y.dot(along)).toBeGreaterThan(1 - 1e-9);
    expect(Math.abs(z.dot(along))).toBeLessThan(1e-9);
    expect(z.x).toBeGreaterThan(0.95);
    expect(x.distanceTo(new V().crossVectors(y, z))).toBeLessThan(1e-9);
  });
});

describe('fingerWeights', () => {
  const HAND = 11;
  const FORE = 10;
  // the hand's chains as the extension builds them, its bones from 24 on
  function rigged() {
    const h = hand();
    const g = fingerGroups(h.pts, shapeOf(h.pts), FRAME, { tris: h.tris });
    let next = 24;
    const chains = g.fingers.map((f) => {
      const pts = f.map((j) => h.pts[j]);
      const joints = fingerChain(pts, { joints: 3, toward: FRAME.along });
      return { bones: joints.map(() => next++), joints, thumb: false, radius: chainRadius(pts, joints) };
    });
    const tp = g.thumb.map((j) => h.pts[j]);
    const tj = fingerChain(tp, { joints: 2, toward: new V(0, 0.6, 0.8) });
    chains.push({ bones: tj.map(() => next++), joints: tj, thumb: true, radius: chainRadius(tp, tj) });
    const n = h.pts.length;
    const joints = new Uint16Array(n * 4);
    const weights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      joints[i * 4] = HAND;
      weights[i * 4] = 1;
      // (the wrist's edge shares the forearm, as a Meshy skin does)
      if (h.pts[i].y <= 2) {
        joints.set([HAND, FORE], i * 4);
        weights.set([0.7, 0.3], i * 4);
      }
    }
    // one vertex out on the index with four influences already
    const crowd = h.fingers.index[1]; // (at the knuckle: the hand and the first joint share it)
    joints.set([HAND, FORE, 5, 6], crowd * 4);
    weights.set([0.4, 0.2, 0.2, 0.2], crowd * 4);
    return { h, chains, out: fingerWeights(h.pts, joints, weights, chains, { hand: HAND, along: FRAME.along, s0: 10 }), crowd };
  }
  const at = (out, i) => {
    const m = new Map();
    for (let k = 0; k < 4; k++) if (out.weights[i * 4 + k] > 0) m.set(out.joints[i * 4 + k], (m.get(out.joints[i * 4 + k]) ?? 0) + out.weights[i * 4 + k]);
    return m;
  };
  it('sums to one on every vertex, never more than four influences', () => {
    const { h, out } = rigged();
    for (let i = 0; i < h.pts.length; i++) {
      const w = out.weights.subarray(i * 4, i * 4 + 4);
      expect(Math.abs(w[0] + w[1] + w[2] + w[3] - 1)).toBeLessThan(1e-6);
      expect(new Set([...out.joints.subarray(i * 4, i * 4 + 4)].filter((_, k) => w[k] > 0)).size).toBeLessThanOrEqual(4);
    }
  });
  it('leaves the palm whole on the hand, puts a fingertip wholly on its last joint, and shares the knuckle', () => {
    const { h, chains, out } = rigged();
    for (let i = 0; i < h.pts.length; i++) {
      if (h.pts[i].y < 7 && h.pts[i].y > 2 && h.pts[i].z < 2) expect(at(out, i)).toEqual(new Map([[HAND, 1]]));
    }
    const index = chains[0];
    const tip = h.fingers.index.find((i) => h.pts[i].y > 15.9);
    expect(at(out, tip)).toEqual(new Map([[index.bones[2], 1]]));
    const y0 = index.joints[0].at[1];
    const knuckle = h.fingers.index.filter((i) => i !== h.fingers.index[1]).reduce((a, b) => (Math.abs(h.pts[b].y - y0) < Math.abs(h.pts[a].y - y0) ? b : a));
    const k = at(out, knuckle);
    expect(k.get(HAND)).toBeGreaterThan(0.2);
    expect(k.get(index.bones[0])).toBeGreaterThan(0.2);
    expect(out.touched.has(tip)).toBe(true);
    expect(out.touched.has(h.pts.findIndex((p) => p.x === -1 && p.y === 4 && p.z === -2))).toBe(false);
  });
  it('drops the smallest influence of a crowded vertex and renormalises', () => {
    const { crowd, out } = rigged();
    const m = at(out, crowd);
    expect(m.size).toBeLessThanOrEqual(4);
    expect([...m.values()].reduce((a, b) => a + b)).toBeCloseTo(1, 6);
  });
});

describe('twistWeights', () => {
  it('hands the forearm’s weight to the twist linearly, none at the elbow, all at the wrist', () => {
    const pts = [new V(0, 0, 0), new V(0, 12, 0), new V(0, 24, 0), new V(0, 30, 0), new V(0, 6, 0)];
    const joints = new Uint16Array([10, 9, 0, 0, 10, 0, 0, 0, 10, 11, 0, 0, 11, 0, 0, 0, 3, 0, 0, 0]);
    const weights = new Float32Array([0.5, 0.5, 0, 0, 1, 0, 0, 0, 0.6, 0.4, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    const out = twistWeights(pts, joints, weights, { fore: 10, twist: 60, elbow: new V(0, 0, 0), wrist: new V(0, 24, 0), from: 0 });
    const w = (i, j) => [0, 1, 2, 3].reduce((s, k) => s + (out.joints[i * 4 + k] === j ? out.weights[i * 4 + k] : 0), 0);
    expect(w(0, 60)).toBe(0);
    expect(w(0, 10)).toBeCloseTo(0.5, 6);
    expect(w(1, 60)).toBeCloseTo(0.5, 6);
    expect(w(1, 10)).toBeCloseTo(0.5, 6);
    // (a touched vertex's weights are put on the 16ths: 0.6 is 0.625)
    expect(w(2, 60)).toBeCloseTo(0.625, 6);
    expect(w(2, 11)).toBeCloseTo(0.375, 6);
    expect(w(3, 11)).toBe(1);
    expect(w(4, 3)).toBe(1);
    expect([...out.touched].sort()).toEqual([1, 2]);
  });
  it('by default starts half way down the forearm, where a game rig’s twist bone works', () => {
    const pts = [new V(0, 6, 0), new V(0, 12, 0), new V(0, 18, 0), new V(0, 24, 0)];
    const joints = new Uint16Array(16).fill(0);
    const weights = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      joints[i * 4] = 10;
      weights[i * 4] = 1;
    }
    const out = twistWeights(pts, joints, weights, { fore: 10, twist: 60, elbow: new V(0, 0, 0), wrist: new V(0, 24, 0) });
    const w = (i) => [0, 1, 2, 3].reduce((s, k) => s + (out.joints[i * 4 + k] === 60 ? out.weights[i * 4 + k] : 0), 0);
    expect([0, 1, 2, 3].map(w)).toEqual([0, 0, 0.5, 1]);
    expect([...out.touched]).toEqual([2, 3]);
  });
});
