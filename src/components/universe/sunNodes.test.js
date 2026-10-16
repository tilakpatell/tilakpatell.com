import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './sun';
import * as nodes from './sunNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'premultipliedAlpha', 'forceSinglePass', 'fog'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));
const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('sunNodes, the twin of sun', () => {
  it('exports what sun exports, the noise a node function in place of its GLSL', () => {
    expect(Object.keys(nodes).sort()).toEqual([...Object.keys(glsl).filter((k) => k !== 'NOISE_GLSL'), 'snoise'].sort());
    expect(typeof nodes.snoise).toBe('function');
  });

  it('builds the surface and the corona under node materials, the same flags, uniforms and draw order', () => {
    const tex = new THREE.DataTexture(new Uint8Array([200, 120, 40, 255]), 1, 1);
    for (const T of [{}, { sun: tex, small: true }]) {
      const a = glsl.buildSun(T);
      const n = nodes.buildSun(T);
      expect(n.group.position.toArray()).toEqual(a.group.position.toArray());
      expect(n.group.children).toHaveLength(a.group.children.length);
      a.update(7.5, new THREE.PerspectiveCamera());
      n.update(7.5, new THREE.PerspectiveCamera());
      n.group.children.forEach((o, i) => {
        const was = a.group.children[i];
        expect(o.material.isNodeMaterial).toBe(true);
        expect(flags(o.material)).toEqual(flags(was.material));
        expect(o.renderOrder).toBe(was.renderOrder);
        expect(o.geometry.attributes.position.count).toBe(was.geometry.attributes.position.count);
        expect(o.rotation.toArray()).toEqual(was.rotation.toArray());
        expect(o.quaternion.toArray()).toEqual(was.quaternion.toArray());
        expect(Object.keys(o.material.uniforms).sort()).toEqual(Object.keys(was.material.uniforms).sort());
        // (no map: the twin’s uMap holds a stand-in texel, never shown)
        for (const k of Object.keys(was.material.uniforms)) if (k !== 'uMap' || T.sun) expect([k, plain(o.material.uniforms[k].value)]).toEqual([k, plain(was.material.uniforms[k].value)]);
      });
    }
  });
});
