import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './cme';
import * as nodes from './cmeNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'premultipliedAlpha', 'forceSinglePass', 'fog', 'opacity'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));
const plain = (v) => (v?.toArray ? v.toArray() : v);
// what's drawn, as plain numbers: each thing's kind, flags, place and uniforms
const snap = (root) => {
  const out = [];
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.material) return;
    const u = o.material.uniforms ?? {};
    out.push({
      type: o.type,
      node: Boolean(o.material.isNodeMaterial),
      flags: flags(o.material),
      at: [o.renderOrder, o.visible, o.frustumCulled],
      matrix: o.matrixWorld.toArray(),
      color: o.material.uniforms ? null : (o.material.color?.toArray() ?? null), // (a shader’s colour is its uniforms)
      uniforms: Object.fromEntries(Object.keys(u).map((k) => [k, plain(u[k].value)])),
    });
  });
  return out;
};

const run = (C) => {
  const parent = new THREE.Group();
  const e = C.createEjection(parent, { small: false });
  e.launch({ at: [1, 2, 3], r: 2, color: '#ffaa66' }, { x: 40, y: 5, z: -20 }, { rise: 3, speed: 50, reach: 60 });
  const steps = [];
  for (const dt of [0.5, 1.5, 1.2, 0.1, 0.3]) steps.push([e.update(dt, 10 + dt), snap(parent)]);
  return { parent, e, steps };
};

describe('cmeNodes, the twin of cme', () => {
  it('exports what cme exports, its numbers and where the ejection is the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.CME).toEqual(glsl.CME);
    const o = { rise: 3, speed: 150, starR: 2, reach: 40 };
    for (const age of [0, 1, 3, 3.1, 3.2, 10]) expect(nodes.ejectionAt(age, o)).toEqual(glsl.ejectionAt(age, o));
  });

  it('makes the same things under node materials, the same flags, uniforms and draw order, frame by frame', () => {
    const a = run(glsl);
    const n = run(nodes);
    expect(n.e.axis.toArray()).toEqual(a.e.axis.toArray());
    n.steps.forEach(([busy, list], i) => {
      const [busyA, listA] = a.steps[i];
      expect(busy).toBe(busyA);
      expect(list.every((o) => o.node)).toBe(true);
      // (what's drawn alike, but the material's kind)
      const bare = (l) => l.map((o) => ({ ...o, node: null }));
      expect(bare(list)).toEqual(bare(listA));
    });
    n.e.dispose();
    expect(n.parent.children).toHaveLength(0);
  });
});
