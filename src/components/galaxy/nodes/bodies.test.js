import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../bodies';
import * as nodes from './bodies';

const plain = (v) => {
  if (Array.isArray(v)) return v.map(plain);
  if (v?.isTexture) return 'texture';
  return v?.toArray ? v.toArray() : v;
};
// (toneMapped too, but on a ShaderMaterial: its GLSL had no tone-mapping
// chunk, so it never was, and the twin says so with toneMapped: false)
const flags = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest'];
const toneMapped = (m) => (m.isShaderMaterial ? false : m.toneMapped);
const sameUniforms = (n, a, what) => {
  expect(Object.keys(n).sort(), what).toEqual(Object.keys(a).sort());
  for (const k of Object.keys(a)) expect(plain(n[k].value), `${what} ${k}`).toEqual(plain(a[k].value));
};

describe('nodes/bodies, the twin of ../bodies', () => {
  it('exports what bodies.js exports, its looks and pure rules the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.FAMILIES).toEqual(glsl.FAMILIES);
    expect(nodes.LOOKS).toEqual(glsl.LOOKS);
    for (const L of Object.values(glsl.LOOKS)) expect(nodes.detailScans(L)).toEqual(glsl.detailScans(L));
    for (const kind of ['big', 'small', 'moon']) for (const level of ['low', 'mid', 'high', 'ultra']) expect(nodes.segmentsFor(kind, level)).toEqual(glsl.segmentsFor(kind, level));
    for (const tier of ['low', 'mid', 'high', 'ultra']) for (const px of [100, 301, 900]) expect(nodes.nearOctaves({ tier, pxTall: px })).toBe(glsl.nearOctaves({ tier, pxTall: px }));
    for (const a of [{ r: 1, dist: 2, fov: 60, height: 720 }, { r: 3, dist: 2, fov: 60, height: 720 }, { r: 40, dist: 900, fov: 50, height: 1080 }]) expect(nodes.pxTall(a)).toBe(glsl.pxTall(a));
  });

  it('builds every look as bodies.js does, its materials node materials with the same flags and uniforms', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 9000);
    camera.position.set(0, 0, 200);
    const suns = [{ dir: new THREE.Vector3(1, 0, 0), color: new THREE.Color(1.2, 1.1, 1) }, { dir: new THREE.Vector3(0, 0, 1), color: new THREE.Color(0.6, 0.5, 0.4) }];
    for (const id of Object.keys(glsl.LOOKS)) {
      for (const [small, tier] of [[false, 'mid'], [true, 'mid'], [false, 'ultra'], [false, 'low']]) {
        const what = `${id} ${small ? 'small' : 'big'} ${tier}`;
        const a = glsl.buildBody(id, { r: 30, small, tier });
        const n = nodes.buildBody(id, { r: 30, small, tier });
        expect(Object.keys(n).sort(), what).toEqual(Object.keys(a).sort());
        expect(n.radius, what).toBe(a.radius);
        expect(n.reach, what).toBe(a.reach);
        expect(n.surface, what).toBe(n.group.children[0]);
        expect(n.group.children.length, what).toBe(a.group.children.length);
        n.group.children.forEach((o, i) => {
          const g = a.group.children[i];
          expect(o.type, `${what} ${i}`).toBe(g.type);
          expect(o.visible, `${what} ${i}`).toBe(g.visible);
          expect(o.material.isNodeMaterial, `${what} ${i}`).toBe(true);
          for (const k of flags) expect(o.material[k], `${what} ${i} ${k}`).toBe(g.material[k]);
          expect(o.material.toneMapped, `${what} ${i}`).toBe(toneMapped(g.material));
          expect(o.geometry.attributes.position.count, `${what} ${i}`).toBe(g.geometry.attributes.position.count);
          if (g.material.uniforms) sameUniforms(o.material.uniforms, g.material.uniforms, `${what} ${i}`);
        });
        // (the surface's #defines, as the ShaderMaterial had them)
        expect(n.surface.material.defines, what).toEqual(a.surface.material.defines);
        for (const b of [a, n]) {
          b.setSuns(suns);
          b.update(12.5, camera);
          b.set('shield', 1);
          b.set('nonsense', 3);
          b.setDetail(0.5);
        }
        n.group.children.forEach((o, i) => {
          const g = a.group.children[i];
          expect(o.visible, `${what} ${i}`).toBe(g.visible);
          if (g.material.uniforms) sameUniforms(o.material.uniforms, g.material.uniforms, `${what} ${i} after a frame`);
        });
        a.dispose();
        n.dispose();
      }
    }
  }, 60000); // (every look, four ways, twice: spheres of up to 256 × 192)

  it('drops its noise octaves with the detail asked for, never under 4', () => {
    const octaves = (b) => b.surface.material.uniforms.uMaxOct.value;
    const b = nodes.buildBody('tatooine', { r: 30, small: false });
    for (const [k, want] of [[1, 9], [0, 4], [0.5, 7], [7, 9], [-1, 4]]) {
      b.setDetail(k);
      expect(octaves(b)).toBe(want);
    }
  });

  it('lights Scarif’s shield where a ship bumps it, then lets it fade', () => {
    const b = nodes.buildBody('scarif', { r: 32 });
    expect(b.reach).toBeCloseTo(32 * 1.12);
    b.set('shield', 1);
    expect(b.hitLeft).toBe(0);
    expect(b.hit(new THREE.Vector3(0, 0, 32 * 1.12))).toBe(true);
    expect(b.hitLeft).toBe(1);
    b.update(10);
    b.update(10.05);
    expect(b.hitLeft).toBeCloseTo(1 - 0.05 * 1.1, 5);
    for (let t = 10.1; t < 12; t += 0.05) b.update(t);
    expect(b.hitLeft).toBe(0);
    expect(nodes.buildBody('hoth', { r: 36 }).hit(new THREE.Vector3(0, 0, 40))).toBe(false);
  });

  it('works its ground finer from orbit on high and ultra, eased in as bodies.js does', () => {
    const near = (b) => b.surface.material.uniforms.uNearOct.value;
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 9000);
    const renderer = { getDrawingBufferSize: (v) => v.set(1280, 720) };
    for (const [tier, small] of [['high', false], ['ultra', false], ['mid', false], ['high', true]]) {
      const a = glsl.buildBody('tatooine', { r: 30, small, tier });
      const n = nodes.buildBody('tatooine', { r: 30, small, tier });
      for (const [z, frames] of [[2.4, 2], [2.4, 60], [40, 60]]) {
        camera.position.set(0, 0, 30 * z);
        for (let i = 0; i < frames; i++) {
          for (const b of [a, n]) {
            b.surface.onBeforeRender?.(renderer, null, camera);
            b.update(i / 30, camera);
          }
        }
        expect(near(n), `${tier} ${z}`).toBe(near(a));
      }
    }
  });
});
