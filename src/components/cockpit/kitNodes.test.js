import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as glsl from './kit';
import * as nodes from './kitNodes';

// (the kit paints on canvases: a stand-in, in Node, that takes every call)
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterAll(() => vi.unstubAllGlobals());

const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'toneMapped', 'opacity'];
const same = (a, b, keys = flags) => {
  for (const k of keys) expect(b[k], k).toEqual(a[k]);
};

describe('the cockpit kit as nodes, the twin of ./kit', () => {
  it('exports what kit.js exports, the pure helpers alike', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    const a = glsl.rng(7);
    const b = nodes.rng(7);
    for (let i = 0; i < 5; i++) expect(b()).toBe(a());
    expect(nodes.shade('#808080', 0.5)).toBe(glsl.shade('#808080', 0.5));
    expect(nodes.roundedBox(1, 1, 1).attributes.position.count).toBe(glsl.roundedBox(1, 1, 1).attributes.position.count);
  });

  it('plates and consoles: node materials with the originals’ settings', () => {
    const pa = glsl.plated(glsl.platingMaps(), { rx: 2, ry: 3, metalness: 0.5 });
    const pn = nodes.plated(nodes.platingMaps(), { rx: 2, ry: 3, metalness: 0.5 });
    expect(pn.isNodeMaterial).toBe(true);
    expect(pn.isMeshStandardNodeMaterial).toBe(true);
    same(pa, pn, [...flags, 'metalness', 'roughness', 'bumpScale']);
    expect(pn.map.repeat.toArray()).toEqual(pa.map.repeat.toArray());
    const ca = glsl.consoleMat(glsl.consoleMaps(), { glow: 2 });
    const cn = nodes.consoleMat(nodes.consoleMaps(), { glow: 2 });
    expect(cn.isMeshStandardNodeMaterial).toBe(true);
    same(ca, cn, [...flags, 'emissiveIntensity', 'bumpScale', 'roughness', 'metalness']);
    expect(cn.emissive.toArray()).toEqual(ca.emissive.toArray());
  });

  it('glass: the same flags, its uniforms by name, and setLight', () => {
    const a = glsl.glassMat({ opacity: 0.1 });
    const n = nodes.glassMat({ opacity: 0.1 });
    expect(n.isNodeMaterial).toBe(true);
    same(a, n);
    expect(n.color.getHex()).toBe(a.color.getHex());
    expect(Object.keys(n.uniforms).sort()).toEqual(['uDirt', 'uLight']);
    n.userData.setLight(new THREE.Color(0, 0.5, 1));
    expect(n.uniforms.uLight.value.toArray()).toEqual([0, 0.5, 1]);
  });

  it('blinkers, screens and glows: node materials, ticking their uniforms', () => {
    const spots = [
      [0, 0, 0],
      [0.1, 0, 0],
    ];
    const ba = glsl.blinkers(spots);
    const bn = nodes.blinkers(spots);
    expect(bn.mesh.material.isNodeMaterial).toBe(true);
    same(ba.mesh.material, bn.mesh.material);
    expect(bn.mesh.geometry.attributes.aBlink.array).toEqual(ba.mesh.geometry.attributes.aBlink.array);
    bn.tick(3.5);
    expect(bn.mesh.material.uniforms.uTime.value).toBe(3.5);
    const sa = glsl.screen(0.2, 0.1, () => {});
    const sn = nodes.screen(0.2, 0.1, () => {});
    expect(sn.mesh.material.isNodeMaterial).toBe(true);
    same(sa.mesh.material, sn.mesh.material);
    expect(sn.mesh.material.color.toArray()).toEqual(sa.mesh.material.color.toArray());
    const ga = glsl.glowSprite('#ff0000', 2, 0.5);
    const gn = nodes.glowSprite('#ff0000', 2, 0.5);
    expect(gn.material.isSpriteNodeMaterial).toBe(true);
    same(ga.material, gn.material);
    expect(gn.scale.toArray()).toEqual(ga.scale.toArray());
  });

  it('freeKit frees what the twin’s own helpers made, and keeps the glow', () => {
    const glow = nodes.glowTexture();
    const t = nodes.painted(4, 4, () => {});
    const m = nodes.plated(nodes.platingMaps());
    const spy = vi.fn();
    for (const x of [t, m.map, m.bumpMap, m.roughnessMap]) x.addEventListener('dispose', spy);
    const kept = vi.fn();
    glow.addEventListener('dispose', kept);
    nodes.freeKit();
    expect(spy).toHaveBeenCalledTimes(4);
    expect(kept).not.toHaveBeenCalled();
  });
});
