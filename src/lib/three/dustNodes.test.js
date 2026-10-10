import { describe, expect, it } from 'vitest';
import * as glsl from './dust';
import * as nodes from './dustNodes';

describe('dustNodes, the twin of dust', () => {
  it('the same mesh, flags and uniforms, and the same bursts', () => {
    const a = glsl.createDust({ count: 8, size: 0.7, life: 1 });
    const n = nodes.createDust({ count: 8, size: 0.7, life: 1 });
    expect(n.mesh.material.isNodeMaterial).toBe(true);
    for (const k of ['transparent', 'depthWrite']) expect(n.mesh.material[k]).toBe(a.mesh.material[k]);
    expect(n.mesh.material.color.getHex()).toBe(a.mesh.material.color.getHex());
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    expect(n.mesh).toMatchObject({ name: 'dust', frustumCulled: false, renderOrder: 2, visible: false });
    for (const d of [a, n]) {
      d.update(0.5);
      d.burst([1, 2, 3], 3);
    }
    expect(n.used).toBe(a.used);
    expect(n.mesh.visible).toBe(true);
    expect(Array.from(n.mesh.geometry.attributes.aStart.array)).toEqual(Array.from(a.mesh.geometry.attributes.aStart.array));
    n.update(2);
    a.update(2);
    expect(n.uniforms.uDustTime.value).toBe(a.uniforms.uDustTime.value);
    expect(n.mesh.visible).toBe(false);
  });
});
