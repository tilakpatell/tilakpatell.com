import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/amonhen/propsShaders";
import * as nodes from "./propsShaders";

const valueOf = (v) => (v?.toArray ? v.toArray() : v);
const sameUniforms = (a, n) => {
  expect(Object.keys(n.uniforms).sort()).toEqual(
    Object.keys(a.uniforms)
      .filter((k) => k.startsWith("u"))
      .sort(),
  );
  for (const k of Object.keys(n.uniforms))
    expect(valueOf(n.uniforms[k].value)).toEqual(valueOf(a.uniforms[k].value));
};
const sameState = (a, n) =>
  expect([n.transparent, n.depthWrite, n.blending, n.side, n.fog]).toEqual([
    a.transparent,
    a.depthWrite,
    a.blending,
    a.side,
    a.fog,
  ]);
// the kit’s `fall`: the fog’s uniforms and one clock
const clock = () => ({
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  uTime: { value: 0 },
});

describe("nodes/towns/amonhen/propsShaders, the twin of Amon Hen’s props’ shaders", () => {
  it("exports what the original exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes the falls, the foam, the mist and the Eye node materials with the GLSL’s uniforms", () => {
    const puff = new THREE.Texture();
    const pairs = [
      [glsl.fallsMaterial(clock()), nodes.fallsMaterial(clock())],
      [glsl.foamMaterial(clock()), nodes.foamMaterial(clock())],
      [
        glsl.mistMaterial({ ...clock(), uPuff: { value: puff } }),
        nodes.mistMaterial({ ...clock(), uPuff: { value: puff } }),
      ],
      [
        glsl.eyeMaterial({ uTime: { value: 2 }, uK: { value: 0.5 } }),
        nodes.eyeMaterial({ uTime: { value: 2 }, uK: { value: 0.5 } }),
      ],
    ];
    for (const [a, n] of pairs) {
      expect(n.isNodeMaterial).toBe(true);
      sameUniforms(a, n);
      sameState(a, n);
    }
    expect(pairs[3][1].toneMapped).toBe(false);
  });

  it("keeps the kit’s one clock for the falls, the foam and the mist", () => {
    const fall = clock();
    const falls = nodes.fallsMaterial(fall);
    const foam = nodes.foamMaterial(fall);
    const mist = nodes.mistMaterial({
      ...fall,
      uPuff: { value: new THREE.Texture() },
    });
    falls.uniforms.uTime.value = 3.5;
    expect(foam.uniforms.uTime.value).toBe(3.5);
    expect(mist.uniforms.uTime.value).toBe(3.5);
  });

  it("makes the Uruk-hai’s material a standard node material on the same terms", () => {
    const paint = new THREE.Texture();
    const env = new THREE.Texture();
    const a = glsl.urukMaterial(paint, env);
    const n = nodes.urukMaterial(paint, env);
    expect(n.isNodeMaterial).toBe(true);
    expect(n.isMeshStandardMaterial).toBe(true);
    expect([
      n.vertexColors,
      n.roughness,
      n.metalness,
      n.envMap,
      n.envMapIntensity,
    ]).toEqual([
      a.vertexColors,
      a.roughness,
      a.metalness,
      a.envMap,
      a.envMapIntensity,
    ]);
    expect(n.customProgramCacheKey()).toContain("amonhen-uruk");
  });
});
