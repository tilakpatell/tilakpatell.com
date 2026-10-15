import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './belt';
import * as nodes from './beltNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'premultipliedAlpha', 'forceSinglePass'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));

describe('beltNodes, the twin of belt', () => {
  it('exports what belt exports, the rocks where belt puts them', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.beltRocks({ count: 300 })).toEqual(glsl.beltRocks({ count: 300 }));
    expect(nodes.beltRocks({ small: true, seed: 7, scale: 3 })).toEqual(glsl.beltRocks({ small: true, seed: 7, scale: 3 }));
    expect(nodes.rock(11).attributes.position.array).toEqual(glsl.rock(11).attributes.position.array);
  });

  it('draws the belt in the same instanced shapes, under the rock’s node material', () => {
    const a = glsl.createBelt({ count: 200 });
    const n = nodes.createBelt({ count: 200 });
    expect(n.group.children.map((m) => m.count)).toEqual(a.group.children.map((m) => m.count));
    for (const mesh of n.group.children) expect(mesh.material.isNodeMaterial).toBe(true);
    expect(n.rocks).toEqual(a.rocks);
    n.hide(3);
    n.update(10);
    expect(n.group.rotation.y).toBeCloseTo(a.update(10) ?? a.group.rotation.y, 9);
  });

  it('the dust: a node material, the same uniforms by name, the same flags, written by update', () => {
    const a = glsl.createDust();
    const n = nodes.createDust({ small: true });
    const m = n.points.material;
    expect(m.isNodeMaterial).toBe(true);
    expect(Object.keys(m.uniforms).sort()).toEqual(Object.keys(a.points.material.uniforms).sort());
    expect(flags(m)).toEqual(flags(a.points.material));
    expect(m.uniforms.uBox.value).toBe(14);
    expect(n.points.count).toBe(320);
    expect(n.points.frustumCulled).toBe(false);
    expect(n.points.visible).toBe(false);
    n.update(new THREE.Vector3(1, 2, 3), 0.5, 2);
    expect(n.points.visible).toBe(true);
    expect(m.uniforms.uAmount.value).toBe(0.5);
    expect(m.uniforms.uDpr.value).toBe(2);
    expect(m.uniforms.uCam.value.toArray()).toEqual([1, 2, 3]);
  });
});
