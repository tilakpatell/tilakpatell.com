import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../towns/rain';
import * as nodes from './rain';

const plain = (v) => (v?.toArray ? v.toArray() : v);
// (Math.random seeded, the same for either side)
const seeded = (fn) => {
  const real = Math.random;
  let s = 0x51ab;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
};

describe('nodes/towns/rain, the twin of the rain', () => {
  it('exports what the rain exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes node materials whose uniforms carry the GLSL’s names and values', () => {
    const a = seeded(() => glsl.makeRain({ count: 50, splashes: 10, len: 0.9 }));
    const n = seeded(() => nodes.makeRain({ count: 50, splashes: 10, len: 0.9 }));
    expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    for (const k of Object.keys(a.uniforms)) {
      expect(n.uniforms[k].isNode, k).toBe(true);
      expect(plain(n.uniforms[k].value), k).toEqual(plain(a.uniforms[k].value));
    }
    const [sa, pa] = a.group.children;
    const [sn, pn] = n.group.children;
    expect(sn.isLineSegments).toBe(true);
    expect(sn.material.isLineBasicNodeMaterial).toBe(true);
    expect(sn.material.uniforms).toBe(n.uniforms);
    // (a splash a sprite, instanced, as the node renderer draws no wide point)
    expect(pn.isSprite).toBe(true);
    expect(pn.count).toBe(10);
    expect(pn.material.isPointsNodeMaterial).toBe(true);
    for (const [o, t] of [
      [sa, sn],
      [pa, pn],
    ]) {
      expect([t.material.transparent, t.material.depthWrite, t.material.fog]).toEqual([o.material.transparent, o.material.depthWrite, o.material.fog]);
      expect([t.renderOrder, t.frustumCulled]).toEqual([o.renderOrder, o.frustumCulled]);
      expect(t.material.toneMapped).toBe(true); // (the GLSL had the chunks)
      for (const k of Object.keys(o.material.uniforms)) expect(plain(t.material.uniforms[k].value), k).toEqual(plain(o.material.uniforms[k].value));
    }
    // (the splashes share the streaks’ amount and colour)
    expect(pn.material.uniforms.uColor).toBe(n.uniforms.uColor);
    expect([...sn.geometry.getAttribute('seed').array]).toEqual([...sa.geometry.getAttribute('seed').array]);
  });

  it('follows the camera and rings the same splashes out round you', () => {
    const a = seeded(() => glsl.makeRain({ count: 20, splashes: 12 }));
    const n = seeded(() => nodes.makeRain({ count: 20, splashes: 12 }));
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(3, 2, -4);
    seeded(() => a.update(camera, 1.5, 0.7, { x: 1, z: 2 }));
    seeded(() => n.update(camera, 1.5, 0.7, { x: 1, z: 2 }));
    expect(n.uniforms.uCam.value.toArray()).toEqual([3, 2, -4]);
    expect(n.uniforms.uAmount.value).toBe(0.7);
    const pa = a.group.children[1].geometry.attributes;
    const sprite = n.group.children[1];
    expect(sprite.material.uniforms.uTime.value).toBe(1.5);
    // (the sprite’s instance attributes read the same arrays the classic one sent)
    const posNode = sprite.material.positionNode;
    expect([...posNode.value.array]).toEqual([...pa.position.array]);
    n.tint(0.2, 0.3, 0.4, 0.5);
    expect(n.uniforms.uColor.value.toArray()).toEqual([0.2, 0.3, 0.4]);
    expect(n.uniforms.uOpacity.value).toBe(0.5);
    n.update(camera, 2, 0);
    expect(n.group.visible).toBe(false);
  });
});
