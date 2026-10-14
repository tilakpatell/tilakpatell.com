import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import * as glsl from '../glsl/sky';
import * as nodes from './sky';
import { buildShaders } from './fixtures/build';

// The windows’ views’ shaders as nodes, against the GLSL ones: the same
// flags, the same uniforms under the same names and values (views.js writes
// uOrigin, uSun and uDrift through `.value`), each built whole in Node.
const FLAGS = ['transparent', 'depthWrite', 'depthTest', 'blending', 'side', 'premultipliedAlpha', 'toneMapped', 'fog'];

const sun = new THREE.Vector3(0.62, 0.3, -0.72).normalize();
const SUN = [3.1, 2.95, 2.75];
const pixel = (r, g, b, a = 255) => {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
  t.needsUpdate = true;
  return t;
};
const maps = () => ({ map: pixel(90, 120, 160), normal: pixel(128, 128, 255), rough: pixel(200, 200, 200), clouds: pixel(255, 255, 255, 120) });

// the uniforms' values, comparable: a colour by its hex, a vector by its numbers, a texture as itself
const valueOf = (v) => (v?.isColor ? v.getHex() : v?.toArray ? v.toArray() : v);
function sameUniforms(n, o) {
  expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(o.uniforms).sort());
  for (const [k, u] of Object.entries(n.uniforms)) {
    expect(u.isNode, k).toBe(true);
    expect([k, valueOf(u.value)]).toEqual([k, valueOf(o.uniforms[k].value)]);
  }
}
const sameFlags = (n, o) => {
  expect(n.isNodeMaterial).toBe(true);
  for (const f of FLAGS) expect([f, n[f]]).toEqual([f, o[f]]);
};

describe('the windows’ views as nodes', () => {
  it('shares one set of sky uniforms, as nodes, at the GLSL’s values', () => {
    const o = glsl.skyUniforms(sun, SUN);
    const n = nodes.skyUniforms(sun, SUN);
    for (const k of ['uOrigin', 'uSun', 'uSunColour']) {
      expect(n[k].isNode).toBe(true);
      expect(valueOf(n[k].value)).toEqual(valueOf(o[k].value));
    }
    // (its own copy of the sun’s way, as the GLSL’s: views.js turns it with the room)
    expect(n.uSun.value).not.toBe(sun);
  });

  it('draws the stars as quads the size the points were, in the same far-off places', () => {
    const pos = new Float32Array([0, 0, -1000, 1000, 0, 0, 0, 1000, 0]);
    const col = new Float32Array([1, 1, 1, 0.5, 0.6, 0.7, 0.2, 0.2, 0.2]);
    const size = new Float32Array([1.5, 2, 3]);
    const o = glsl.starsMesh(pos, col, size, glsl.skyUniforms(sun, SUN), 2);
    const n = nodes.starsMesh(pos, col, size, nodes.skyUniforms(sun, SUN), 2);
    expect(o.isPoints).toBe(true);
    expect(n.isMesh).toBe(true);
    sameFlags(n.material, o.material);
    sameUniforms(n.material, o.material);
    expect(n.geometry.instanceCount).toBe(3);
    expect(Array.from(n.geometry.attributes.aStar.array)).toEqual(Array.from(o.geometry.attributes.position.array));
    for (const a of ['aColour', 'aSize']) expect(Array.from(n.geometry.attributes[a].array)).toEqual(Array.from(o.geometry.attributes[a].array));
    expect(buildShaders(n).vertex).toMatch(/aStar/);
  });

  it('makes the band, the sun and the battle’s flashes with the GLSL’s flags and uniforms', () => {
    const [uo, un] = [glsl.skyUniforms(sun, SUN), nodes.skyUniforms(sun, SUN)];
    const pole = [0.35, 0.8, 0.45];
    for (const [o, n, geo] of [
      [glsl.bandMaterial(uo, pole), nodes.bandMaterial(un, pole), new THREE.SphereGeometry(1000, 8, 4)],
      [glsl.sunMaterial(uo, 212), nodes.sunMaterial(un, 212), new THREE.PlaneGeometry(2, 2)],
    ]) {
      sameFlags(n, o);
      sameUniforms(n, o);
      expect(buildShaders(new THREE.Mesh(geo, n)).fragment).toMatch(/fn main/);
    }
    const flash = nodes.flashMaterial();
    sameFlags(flash, glsl.flashMaterial());
    const flashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), flash, 4);
    flashes.setColorAt(0, new THREE.Color());
    expect(buildShaders(flashes).vertex).toMatch(/instanceIndex|instance_index/);
  });

  for (const giant of [false, true]) {
    it(`lights a ${giant ? 'gas giant' : 'planet'} as the GLSL does, its halo sharing its air`, () => {
      const [uo, un] = [glsl.skyUniforms(sun, SUN), nodes.skyUniforms(sun, SUN)];
      const m = maps();
      const own = giant ? { map: m.map } : m;
      const o = glsl.bodyMaterial(uo, { air: [0.5, 0.68, 1], giant, ...own });
      const n = nodes.bodyMaterial(un, { air: [0.5, 0.68, 1], giant, ...own });
      sameFlags(n, o);
      sameUniforms(n, o);
      const ho = glsl.haloMaterial(uo, { air: o.uniforms.uAir, r: 40 });
      const hn = nodes.haloMaterial(un, { air: n.uniforms.uAir, r: 40 });
      sameFlags(hn, ho);
      sameUniforms(hn, ho);
      expect(hn.uniforms.uAir).toBe(n.uniforms.uAir);
      // (the drift views.js writes reaches the clouds)
      n.uniforms.uDrift.value = 0.25;
      expect(n.uniforms.uDrift.value).toBe(0.25);
      const geo = new THREE.SphereGeometry(40, 16, 8);
      expect(buildShaders(new THREE.Mesh(geo, n)).fragment).toMatch(/fn main/);
      expect(buildShaders(new THREE.Mesh(geo, hn)).fragment).toMatch(/fn main/);
    });
  }

  it('lights a loaded model by the view’s sun, out of the house look, as the GLSL’s patch did', () => {
    const un = nodes.skyUniforms(sun, SUN);
    const classic = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
    const lit = nodes.sunlit(classic, un);
    expect(lit.isMeshStandardNodeMaterial).toBe(true);
    expect(lit.userData.noHouse).toBe(true);
    expect(lit.customProgramCacheKey()).toContain('view-sun');
    for (const k of ['roughness', 'metalness', 'vertexColors']) expect(lit[k]).toBe(classic[k]);
    const geo = new THREE.BoxGeometry();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 3).fill(0.6), 3));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0x9aa6b8, 0x0d0f13, 0.35));
    // (one more direct light than the scene has: the view’s sun, in the shader)
    const plain = buildShaders(new THREE.Mesh(geo, new MeshStandardNodeMaterial({ vertexColors: true })), { scene }).fragment;
    const sunny = buildShaders(new THREE.Mesh(geo, lit), { scene: scene.clone() }).fragment;
    expect(sunny.length).toBeGreaterThan(plain.length);
  });
});
