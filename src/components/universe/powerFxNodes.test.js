import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './powerFx';
import * as nodes from './powerFxNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'fog', 'forceSinglePass'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));

// every power on at once, a few frames in
const make = (P) => {
  const parent = new THREE.Group();
  const fx = P.createPowerFx(parent);
  fx.torpedoes([{ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: -3 }, { x: 1, y: 0, z: 0, vx: 1, vy: 0, vz: 0 }]);
  fx.beam({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -5 });
  fx.magnet({ x: 0, y: 1, z: 0 }, 0.6);
  fx.crystal({ x: 0, y: -1, z: 0 }, 0.5);
  fx.shock({ x: 2, y: 0, z: 0 }, 3);
  for (let i = 0; i < 4; i++) fx.update(0.05);
  return { parent, fx };
};
const named = (w, name) => w.parent.getObjectByName(`power:${name}`);

describe('powerFxNodes, the twin of powerFx', () => {
  it('exports what powerFx exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.TORPEDOES).toBe(glsl.TORPEDOES);
  });

  it('makes the same things, each under a node material with the same flags', () => {
    const a = make(glsl);
    const n = make(nodes);
    expect(n.parent.children.map((o) => [o.name, o.type, o.visible])).toEqual(a.parent.children.map((o) => [o.name, o.type, o.visible]));
    n.parent.children.forEach((o, i) => {
      const b = a.parent.children[i];
      expect(o.material.isNodeMaterial).toBe(true);
      expect(flags(o.material)).toEqual(flags(b.material));
      expect(o.matrix.toArray()).toEqual(b.matrix.toArray());
      if (o.isInstancedMesh) {
        expect(o.count).toBe(b.count);
        expect(Array.from(o.instanceMatrix.array)).toEqual(Array.from(b.instanceMatrix.array));
      }
      if (b.material.color) expect(o.material.color.toArray()).toEqual(b.material.color.toArray());
    });
    expect(n.fx.busy).toBe(a.fx.busy);
  });

  it('keeps the shaders’ uniforms by name, written as before', () => {
    const a = make(glsl);
    const n = make(nodes);
    for (const name of ['ray', 'shock']) {
      const u = named(n, name).material.uniforms;
      const v = named(a, name).material.uniforms;
      expect(Object.keys(u).sort()).toEqual(Object.keys(v).sort());
      for (const k of Object.keys(v)) {
        const x = v[k].value;
        if (typeof x === 'number') expect(u[k].value).toBeCloseTo(x, 9);
        else expect(u[k].value.toArray()).toEqual(x.toArray());
      }
    }
  });

  it('puts everything away and takes it off again', () => {
    const { parent, fx } = make(nodes);
    fx.clear();
    expect(fx.busy).toBe(false);
    fx.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
