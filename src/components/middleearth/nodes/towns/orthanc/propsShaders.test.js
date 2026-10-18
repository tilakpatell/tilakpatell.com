import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/orthanc/propsShaders";
import * as nodes from "./propsShaders";

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe("nodes/towns/orthanc/propsShaders, the twin of Orthanc’s shaders", () => {
  it("exports what the GLSL module exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes the palantír’s glass a node material whose uniforms carry the GLSL’s names and values", () => {
    const a = glsl.stoneMaterial();
    const n = nodes.stoneMaterial();
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms).sort(),
    );
    for (const k of Object.keys(n.uniforms))
      expect(plain(n.uniforms[k].value), k).toEqual(plain(a.uniforms[k].value));
    // (tone mapped, as its GLSL’s chunk had it; no fog, a ShaderMaterial’s)
    expect([n.fog, n.toneMapped]).toEqual([false, true]);
    // a fresh one each time, its own clock
    expect(nodes.stoneMaterial().uniforms.uTime).not.toBe(n.uniforms.uTime);
  });

  it("makes the tower’s stone a standard node material, hooked and keyed", () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x9a9ca8,
      roughness: 0.3,
    });
    const n = nodes.glassyStone(m);
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    expect(n.color.getHex()).toBe(0x9a9ca8);
    expect(n.roughness).toBe(0.3);
    expect(n.customProgramCacheKey()).toContain("orthanc-tower-stone");
  });
});
