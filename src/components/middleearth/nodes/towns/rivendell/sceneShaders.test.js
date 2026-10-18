import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/rivendell/sceneShaders";
import * as nodes from "./sceneShaders";

const water = () => ({
  uniforms: {
    uSky: { value: new THREE.Color(0.4, 0.5, 0.6) },
    uDeep: { value: new THREE.Color(0.05, 0.1, 0.12) },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 0.9, 0.8) },
    uGlints: { value: 1 },
  },
});
const plain = (v) => (v?.toArray ? v.toArray() : v);

describe("nodes/towns/rivendell/sceneShaders, the twin of the river", () => {
  it("exports what the GLSL module exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes a node material whose uniforms carry the GLSL’s names and values", () => {
    const w = water();
    const a = glsl.riverMaterial(w);
    const n = nodes.riverMaterial(w);
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms)
        .filter((k) => k.startsWith("u"))
        .sort(),
    );
    for (const k of Object.keys(n.uniforms))
      expect(plain(n.uniforms[k].value), k).toEqual(plain(a.uniforms[k].value));
    expect([n.fog, n.toneMapped, n.transparent]).toEqual([true, false, false]);
  });

  it("follows the town’s water, which the sky writes", () => {
    const w = water();
    const n = nodes.riverMaterial(w);
    w.uniforms.uDeep.value = new THREE.Color(0.5, 0.5, 0.5);
    n.uniforms.uDeep.update({});
    expect(n.uniforms.uDeep.value.toArray()).toEqual([0.5, 0.5, 0.5]);
  });
});
