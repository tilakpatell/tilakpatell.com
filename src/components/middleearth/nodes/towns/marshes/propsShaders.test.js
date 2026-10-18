import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/marshes/propsShaders";
import * as nodes from "./propsShaders";

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe("nodes/towns/marshes/propsShaders, the twin of the drowned faces", () => {
  it("exports what the GLSL module exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes a node material whose uniforms carry the GLSL’s names and values", () => {
    const map = new THREE.Texture();
    const a = glsl.faceMaterial(map);
    const n = nodes.faceMaterial(map);
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms)
        .filter((k) => k.startsWith("u"))
        .sort(),
    );
    for (const k of Object.keys(n.uniforms))
      expect(plain(n.uniforms[k].value), k).toEqual(plain(a.uniforms[k].value));
    expect(n.uniforms.uMap.value).toBe(map);
    expect([n.fog, n.toneMapped, n.transparent, n.depthWrite]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    // (its depth lifted: the vertex’s clip position is its own)
    expect(n.vertexNode).toBeTruthy();
  });

  it("makes a fresh material a face, as face() writes each one’s clock", () => {
    const map = new THREE.Texture();
    const one = nodes.faceMaterial(map);
    const two = nodes.faceMaterial(map);
    expect(one).not.toBe(two);
    one.uniforms.uK.value = 0.5;
    expect(two.uniforms.uK.value).toBe(0);
  });
});
