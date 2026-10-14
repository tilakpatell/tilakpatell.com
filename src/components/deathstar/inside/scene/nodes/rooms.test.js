import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../glsl/rooms';
import * as nodes from './rooms';
import { buildShaders } from './fixtures/build';

// The rooms’ own shaders as nodes, against the GLSL ones: the same flags,
// the same uniforms under the same names and values (the rooms write uTime,
// uStrength and uRipple through `.value`), each built whole in Node.
const FLAGS = ['name', 'transparent', 'depthWrite', 'depthTest', 'blending', 'side', 'premultipliedAlpha', 'toneMapped', 'fog', 'opacity'];

const valueOf = (v) => (v?.isColor ? v.getHex() : v?.toArray ? v.toArray() : v);
function same(n, o, uniforms = [n.uniforms, o.uniforms]) {
  expect(n.isNodeMaterial).toBe(true);
  for (const f of FLAGS) expect([f, n[f]]).toEqual([f, o[f]]);
  const [un, uo] = uniforms;
  expect(Object.keys(un).sort()).toEqual(Object.keys(uo).sort());
  for (const [k, u] of Object.entries(un)) {
    expect(u.isNode, k).toBe(true);
    expect([k, valueOf(u.value)]).toEqual([k, valueOf(uo[k].value)]);
  }
}
const built = (material, geo = new THREE.PlaneGeometry(2, 2)) => buildShaders(new THREE.Mesh(geo, material));

describe('the rooms’ shaders as nodes', () => {
  it('lights a shaft as the GLSL glow does, for every way a room asks for it', () => {
    for (const opts of [{}, { color: 0xa9cbff, base: -40, fall: 15, strength: 2.2, rim: false, top: -4, soft: 30 }, { axis: { x: 3, z: -2 }, radius: 8.5, rim: true }]) {
      const n = nodes.glowMaterial(opts);
      same(n, glsl.glowMaterial(opts));
      expect(built(n).fragment).toMatch(/fn main/);
    }
  });

  it('fills the air as the GLSL haze does, standing and lying flat', () => {
    for (const opts of [{}, { color: 0xe6eeff, strength: 0, flat: true }, { color: 0xd2dcb4, strength: 0.13 }]) {
      const n = nodes.hazeMaterial(opts);
      same(n, glsl.hazeMaterial(opts));
      expect(built(n, new THREE.CylinderGeometry(0.4, 1, 3, 8, 1, true)).fragment).toMatch(/fn main/);
    }
  });

  it('draws both stations’ fields with the GLSL’s colours, strengths and flags', () => {
    for (const k of ['bayField', 'ds2Field']) {
      const n = nodes[k]();
      same(n, glsl[k]());
      n.uniforms.uTime.value = 12.5;
      expect(built(n).fragment).toMatch(/fn main/);
    }
  });

  it('makes the compactor’s water the GLSL’s standard surface, its ripples as its normal', () => {
    const params = () => ({ name: 'ds-water', color: 0x3d3f20, roughness: 0.16, metalness: 0.1, emissive: 0x10130a, normalMap: new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1), normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity: 0.88, envMapIntensity: 1.2 });
    const o = glsl.waterSurface(params());
    const n = nodes.waterSurface(params());
    same(n.material, o.material, [n.uniforms, o.uniforms]);
    expect(n.material.isMeshStandardNodeMaterial).toBe(true);
    for (const k of ['roughness', 'metalness', 'envMapIntensity']) expect(n.material[k]).toBe(o.material[k]);
    for (const k of ['color', 'emissive']) expect(n.material[k].getHex()).toBe(o.material[k].getHex());
    expect(n.material.normalScale.toArray()).toEqual(o.material.normalScale.toArray());
    expect(n.material.normalNode?.isNode).toBe(true);
    n.uniforms.uRipple.value.set(1, 2, 0.4);
    const { fragment } = built(n.material);
    // (its own tangent frame, from the screen’s derivatives of the map’s uv)
    expect(fragment).toMatch(/dpdx/);
  });

  it('draws the stars past a mouth as quads the size the points were', () => {
    const pos = new Float32Array([0, 0, -380, 380, 0, 0]);
    const col = new Float32Array([1, 1, 1, 0.8, 0.88, 1]);
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const o = glsl.starPoints(pos, col, map, { size: 2.2 });
    const n = nodes.starPoints(pos, col, map, { size: 2.2 });
    expect(o.isPoints).toBe(true);
    expect(n.isMesh).toBe(true);
    for (const f of ['transparent', 'depthWrite', 'blending', 'fog', 'toneMapped']) expect([f, n.material[f]]).toEqual([f, o.material[f]]);
    expect(n.material.map).toBe(map);
    expect(n.geometry.instanceCount).toBe(2);
    expect(Array.from(n.geometry.attributes.aStar.array)).toEqual(Array.from(o.geometry.attributes.position.array));
    expect(Array.from(n.geometry.attributes.aColour.array)).toEqual(Array.from(o.geometry.attributes.color.array));
    expect(buildShaders(n).vertex).toMatch(/aStar/);
  });
});
