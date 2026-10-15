import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../rocks';
import * as nodes from './rocks';

const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'flatShading', 'roughness', 'metalness', 'emissiveIntensity'];
const arr = (a) => Array.from(a.array);

describe('nodes/rocks, the twin of rocks', () => {
  it('exports what rocks.js exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  for (const [kind, shape] of [
    ['field', { radius: 40 }],
    ['ring', { inner: 30, outer: 50, thickness: 3, tilt: [0.2, 0.1] }],
    ['debris', { radius: 30 }],
  ]) {
    for (const small of [false, true]) {
      it(`lays out the ${kind} field${small ? ' (small)' : ''} rock for rock, under node materials`, () => {
        const opts = { kind, at: [5, -2, 3], count: 120, seed: 7, small, ...shape };
        const a = glsl.createRocks(opts);
        const n = nodes.createRocks(opts);
        expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
        expect(n.solids).toEqual(a.solids);
        expect(n.group.position.toArray()).toEqual(a.group.position.toArray());
        expect(n.group.rotation.toArray()).toEqual(a.group.rotation.toArray());
        expect(n.group.children.length).toBe(a.group.children.length);
        n.group.children.forEach((o, i) => {
          const g = a.group.children[i];
          expect(o.isInstancedMesh).toBe(true);
          expect(o.count).toBe(g.count);
          expect(o.material.isNodeMaterial).toBe(true);
          expect(o.material.type).toBe(`${g.material.type.replace('Material', '')}NodeMaterial`);
          for (const k of flags) expect(o.material[k], `${i} ${k}`).toBe(g.material[k]);
          expect(o.material.color.toArray()).toEqual(g.material.color.toArray());
          expect(o.material.emissive.toArray()).toEqual(g.material.emissive.toArray());
          expect(arr(o.instanceMatrix)).toEqual(arr(g.instanceMatrix));
          expect(o.instanceColor ? arr(o.instanceColor) : null).toEqual(g.instanceColor ? arr(g.instanceColor) : null);
          for (const k of ['position', 'normal', 'aSpinAxis', 'aSpin']) expect(arr(o.geometry.attributes[k]), `${i} ${k}`).toEqual(arr(g.geometry.attributes[k]));
          expect(o.geometry.boundingSphere.radius).toBe(g.geometry.boundingSphere.radius);
        });
        a.update(12.5);
        n.update(12.5);
        a.group.children.forEach((g, i) => expect(n.group.children[i].material.emissiveIntensity).toBe(g.material.emissiveIntensity));
        n.dispose();
        a.dispose();
      });
    }
  }

  it('hands a placed kind to the placed rocks, moved to `at`', () => {
    const models = { rk: { scene: new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())), size: 2 } };
    const pieces = [{ model: 'rk', at: [1, 2, 3], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], track: 'large' }];
    const a = glsl.createRocks({ kind: 'placed', at: [10, 0, 0], pieces, models });
    const n = nodes.createRocks({ kind: 'placed', at: [10, 0, 0], pieces, models });
    expect(n.solids).toEqual(a.solids);
    expect(n.group.position.toArray()).toEqual(a.group.position.toArray());
    expect(n.group.children[0].material.isNodeMaterial).toBe(true);
  });
});
