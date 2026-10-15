import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as glsl from './cruiser';
import * as nodes from './cruiserNodes';
import { drawnSkin } from './cruiserNodesParts';

// (Morty is the cast's, which has its own twin and tests: a cast with
// nobody in it here, the same on both sides)
const empty = vi.hoisted(() => () => ({ createMeshyCast: () => ({ load: async () => {}, make: () => null, dispose() {} }) }));
vi.mock('../../rickmorty/portal/meshyCast', empty);
vi.mock('../../rickmorty/portal/meshyCastNodes', empty);
// (and no models: the houses, the trees and the lamps don't load, on both sides)
vi.mock('../../../lib/three/gltf', () => ({ gltfLoader: () => ({ loadAsync: () => Promise.reject(new Error('no models in tests')) }) }));

// (the screen paints on a canvas: a stand-in, in Node, that takes every call)
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterAll(() => vi.unstubAllGlobals());

// (toneMapped and fog too, but on a ShaderMaterial: its GLSL had neither
// chunk, so it never was, and the twin says so with both off)
const flags = ['transparent', 'premultipliedAlpha', 'blending', 'side', 'depthWrite', 'depthTest', 'opacity'];
const toneMapped = (m) => (m.isShaderMaterial ? false : m.toneMapped);
const fog = (m) => (m.isShaderMaterial ? false : m.fog);
const drawn = (group) => {
  const out = [];
  group.traverse((o) => o.material && out.push(o));
  return out;
};

describe('Rick’s cruiser as nodes, the twin of ./cruiser', () => {
  it('exports what cruiser.js exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('builds the same cab: every draw a node material with the original’s flags', async () => {
    const a = await glsl.build({ rich: true, coarse: false });
    const n = await nodes.build({ rich: true, coarse: false });
    expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
    for (const k of ['eye', 'rest', 'range', 'hfov', 'vmin', 'vmax', 'exposure', 'toneMapping', 'envIntensity', 'bloom', 'flash', 'glance', 'rumble']) expect(n[k], k).toEqual(a[k]);
    for (const side of ['inside', 'outside']) {
      const A = drawn(a[side]);
      const B = drawn(n[side]);
      expect(B.length, side).toBe(A.length);
      A.forEach((o, i) => {
        const m = B[i].material;
        const label = `${side} ${i} ${o.material.type}`;
        expect(m.isNodeMaterial, label).toBe(true);
        for (const k of flags) expect(m[k], `${label} ${k}`).toEqual(o.material[k]);
        expect(m.toneMapped, label).toBe(toneMapped(o.material));
        expect(m.fog, label).toBe(fog(o.material));
        if (o.material.color) expect(m.color.getHex(), label).toBe(o.material.color.getHex());
        if (o.material.uniforms) expect(Object.keys(m.uniforms).sort(), label).toEqual(Object.keys(o.material.uniforms).sort());
        expect(B[i].renderOrder, label).toBe(o.renderOrder);
      });
    }
    // a moment of the launch: the same poses, the portal's uniforms written
    const plan = { spool: 900, peak: 2400 };
    for (const b of [a, n]) b.update(0.016, 3.2, { launching: true, t: 1200, plan, throttle: 0.3 });
    const portal = (b) => drawn(b.outside).find((o) => o.geometry.type === 'CircleGeometry' && o.material.uniforms?.open);
    expect(portal(n).material.uniforms.open.value).toBe(portal(a).material.uniforms.open.value);
    expect(portal(n).material.uniforms.t.value).toBe(3.2);
    expect(portal(n).visible).toBe(portal(a).visible);
    const pos = (b) => drawn(b.inside).map((o) => o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => v.toFixed(5)));
    expect(pos(n)).toEqual(pos(a));
    n.dispose();
    a.dispose();
  });

  it('snaps a texture to the palette with uniforms by element', () => {
    const map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const m = drawnSkin(map, ['#ff0000', '#00ff00']);
    expect(m.isMeshToonNodeMaterial).toBe(true);
    expect(m.map).toBe(map);
    expect(m.uniforms.uPal.map((u) => u.value.getHex())).toEqual([0xff0000, 0x00ff00]);
  });
});
