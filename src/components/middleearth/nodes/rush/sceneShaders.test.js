import { describe, expect, it } from "vitest";
import * as glsl from "../../rush/sceneShaders";
import * as nodes from "./sceneShaders";

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe("nodes/rush/sceneShaders, the twin of the rush’s ring", () => {
  it("exports what the original exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes a node material whose uniforms carry the GLSL’s names and values", () => {
    const a = glsl.ringMaterial();
    const n = nodes.ringMaterial();
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms).sort(),
    );
    for (const k of Object.keys(n.uniforms))
      expect(plain(n.uniforms[k].value)).toEqual(plain(a.uniforms[k].value));
    expect([
      n.transparent,
      n.depthTest,
      n.depthWrite,
      n.blending,
      n.side,
      n.fog,
    ]).toEqual([
      a.transparent,
      a.depthTest,
      a.depthWrite,
      a.blending,
      a.side,
      a.fog,
    ]);
    // (no tone-mapping chunk in the GLSL)
    expect(n.toneMapped).toBe(false);
  });

  it("takes the scene’s writes as the GLSL did", () => {
    const n = nodes.ringMaterial();
    n.uniforms.uK.value = 0.4;
    n.uniforms.uCol.value.setRGB(0.2, 0.5, 0.1);
    expect(n.uniforms.uCol.value.toArray()).toEqual([0.2, 0.5, 0.1]);
  });
});
