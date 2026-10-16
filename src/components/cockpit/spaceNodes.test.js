import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as glsl from './space';
import * as nodes from './spaceNodes';

// (the jump's glow is painted on a canvas: a stand-in, in Node)
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterAll(() => vi.unstubAllGlobals());

// (toneMapped and fog too, but on a ShaderMaterial: its GLSL had neither
// chunk, so it never was, and the twin says so with both off)
const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest'];
const toneMapped = (m) => (m.isShaderMaterial ? false : m.toneMapped);
const fog = (m) => (m.isShaderMaterial ? false : m.fog);
const meshes = (group) => {
  const out = [];
  group.traverse((o) => o.material && out.push(o));
  return out;
};
const sameDraws = (a, b) => {
  const A = meshes(a);
  const B = meshes(b);
  expect(B.length).toBe(A.length);
  A.forEach((o, i) => {
    const n = B[i];
    expect(n.material.isNodeMaterial, o.material.type).toBe(true);
    for (const k of flags) expect(n.material[k], `${o.material.type} ${k}`).toEqual(o.material[k]);
    expect(n.material.toneMapped).toBe(toneMapped(o.material));
    expect(n.material.fog).toBe(fog(o.material));
    expect(n.renderOrder).toBe(o.renderOrder);
    expect(n.frustumCulled).toBe(o.frustumCulled);
    expect(n.visible).toBe(o.visible);
    if (o.material.uniforms) expect(Object.keys(n.material.uniforms).sort()).toEqual(Object.keys(o.material.uniforms).sort());
  });
  return [A, B];
};

describe('space outside the glass as nodes, the twin of ./space', () => {
  it('exports what space.js exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('the sky: the nebula and the stars, the same flags and uniforms, set() writing them', () => {
    const a = glsl.sky({ count: 50 });
    const n = nodes.sky({ count: 50 });
    const [, B] = sameDraws(a.group, n.group);
    n.set({ px: 2, fade: 0.4 });
    const [dome, stars] = B;
    expect(dome.material.uniforms.uFade.value).toBe(0.4);
    expect(stars.material.uniforms.uFade.value).toBe(0.4);
    expect(stars.material.uniforms.uPx.value).toBe(2);
    expect(stars.count).toBe(50);
  });

  it('the planet: its body standard, its air additive', () => {
    const a = glsl.planet({ radius: 10 });
    const n = nodes.planet({ radius: 10 });
    sameDraws(a.group, n.group);
    expect(n.body.material.isMeshStandardNodeMaterial).toBe(true);
    n.spin(1);
    expect(n.body.rotation.y).toBeCloseTo(0.004);
  });

  it('the jump: streaks, the tunnel and the glow, update() and light() as before', () => {
    const a = glsl.hyperspace({ count: 20 });
    const n = nodes.hyperspace({ count: 20 });
    const [A, B] = sameDraws(a.group, n.group);
    for (const h of [a, n]) {
      h.resize(800, 400, 2);
      h.update(0.1, 1, { throttle: 0.8, tunnel: 0.5 });
    }
    for (const k of Object.keys(A[0].material.uniforms)) {
      const v = A[0].material.uniforms[k].value;
      expect(B[0].material.uniforms[k].value?.toArray?.() ?? B[0].material.uniforms[k].value, k).toEqual(v?.toArray?.() ?? v);
    }
    for (const k of Object.keys(A[1].material.uniforms)) expect(B[1].material.uniforms[k].value, k).toBe(A[1].material.uniforms[k].value);
    expect(B[1].visible).toBe(A[1].visible);
    expect(B[2].material.opacity).toBe(A[2].material.opacity);
    const ca = new THREE.Color();
    const cn = new THREE.Color();
    expect(n.light(cn, { throttle: 0.7, tunnel: 0.2 })).toBe(a.light(ca, { throttle: 0.7, tunnel: 0.2 }));
    expect(cn.toArray()).toEqual(ca.toArray());
  });
});
