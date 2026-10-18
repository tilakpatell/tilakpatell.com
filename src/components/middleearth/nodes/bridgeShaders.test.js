import { describe, expect, it } from "vitest";
import * as glsl from "../bridgeShaders";
import * as nodes from "./bridgeShaders";

describe("nodes/bridgeShaders, the twin of the bridge’s ward", () => {
  it("exports what the original exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes a node material whose uniforms carry the GLSL’s names and values", () => {
    const a = glsl.wardMaterial();
    const n = nodes.wardMaterial();
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms)).toEqual(Object.keys(a.uniforms));
    expect(n.uniforms.opacity.value).toBe(a.uniforms.opacity.value);
    expect([n.transparent, n.depthWrite, n.blending, n.side, n.fog]).toEqual([
      a.transparent,
      a.depthWrite,
      a.blending,
      a.side,
      a.fog,
    ]);
    // the bridge’s write lands on the node
    n.uniforms.opacity.value = 0.7;
    expect(n.opacityNode.value).toBe(0.7);
  });
});
