import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import * as glsl from "../../shire/propsShaders";
import * as nodes from "./propsShaders";

describe("nodes/shire/propsShaders, the twin of the props’ GLSL", () => {
  it("exports what the original exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("hooks the flowers' tint onto a node material, keyed", () => {
    const classic = new THREE.MeshStandardMaterial({ vertexColors: true });
    const m = nodes.flowerTint(classic);
    expect(m.isNodeMaterial).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(m.customProgramCacheKey()).toContain("flowerTint");
    // (the same twin for the same classic material, as a later swap finds it)
    expect(nodes.flowerTint(classic).isNodeMaterial).toBe(true);
  });

  it("keeps the instance colour from three's multiply while it sets up, and gives it back", () => {
    const seen = [];
    const m = new MeshStandardNodeMaterial();
    m.setupDiffuseColor = function (builder) {
      seen.push(builder.object.instanceColor);
      return "own";
    };
    nodes.flowerTint(m);
    // (no instance colours: three's own, untouched)
    const plain = { instanceColor: null };
    expect(m.setupDiffuseColor({ object: plain })).toBe("own");
    const colours = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
    const object = { instanceColor: colours };
    try {
      m.setupDiffuseColor({ object });
    } catch {
      // (the tint's multiply wants a shader being built; this is not one)
    }
    expect(seen).toEqual([null, null]);
    expect(object.instanceColor).toBe(colours);
  });
});
