import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as glsl from '../interdictor';
import * as nodes from './interdictor';

// (the flash's glow is drawn on a canvas: a stand-in, in Node)
beforeAll(() => {
  const ctx = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterAll(() => vi.unstubAllGlobals());

const models = () => ({ slot: () => ({ holder: new THREE.Group() }), drop() {} });
// (toneMapped too, but on a ShaderMaterial: its GLSL had no tone-mapping
// chunk, so it never was, and the twin says so with toneMapped: false)
const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest'];
const toneMapped = (m) => (m.isShaderMaterial ? false : m.toneMapped);
const place = { at: [10, 0, -40], heading: 0.7, drift: [1, 0, 0.5] };

describe('the Interdictor as nodes, the twin of ../interdictor', () => {
  it('exports what interdictor.js exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('adds the same things, node materials with the same flags, the well’s uniforms by name', () => {
    const pa = new THREE.Group();
    const pn = new THREE.Group();
    glsl.createInterdictor(pa, { models: models(), small: true });
    nodes.createInterdictor(pn, { models: models(), small: true });
    expect(pn.children.length).toBe(pa.children.length);
    pn.children.forEach((o, i) => {
      const g = pa.children[i];
      expect(o.type).toBe(g.type);
      expect(o.material.isNodeMaterial).toBe(true);
      for (const k of flags) expect(o.material[k], `${i} ${k}`).toBe(g.material[k]);
      expect(o.material.toneMapped).toBe(toneMapped(g.material));
      for (const k of ['visible', 'renderOrder', 'frustumCulled']) expect(o[k]).toBe(g[k]);
      expect(o.scale.toArray()).toEqual(g.scale.toArray());
    });
    const ua = pa.children[1].material.uniforms;
    const un = pn.children[1].material.uniforms;
    expect(Object.keys(un).sort()).toEqual(Object.keys(ua).sort());
    for (const k of Object.keys(ua)) expect(un[k].value?.toArray?.() ?? un[k].value).toEqual(ua[k].value?.toArray?.() ?? ua[k].value);
  });

  it('drops in, stays and jumps away as the original does, frame for frame', () => {
    const pa = new THREE.Group();
    const pn = new THREE.Group();
    const a = glsl.createInterdictor(pa, { models: models() });
    const n = nodes.createInterdictor(pn, { models: models() });
    expect(n.arrive(place)).toBe(a.arrive(place));
    expect(n.arrive(place)).toBe(false);
    for (let f = 0; f < 400; f++) {
      if (f === 250) (a.leave(), n.leave());
      const t = f / 30;
      expect(n.update(1 / 30, t)).toBe(a.update(1 / 30, t));
      expect([n.here, n.at, n.solids]).toEqual([a.here, a.at, a.solids]);
      expect(pn.children[1].material.uniforms.uAmount.value).toBe(pa.children[1].material.uniforms.uAmount.value);
      expect(pn.children[0].material.opacity).toBe(pa.children[0].material.opacity);
    }
    n.dispose();
    a.dispose();
  });
});
