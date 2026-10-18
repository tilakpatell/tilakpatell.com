import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/orthanc/sceneShaders";
import * as nodes from "./sceneShaders";

describe("nodes/towns/orthanc/sceneShaders, the twin of Saruman’s robe", () => {
  it("exports what the GLSL module exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes the robe a physical node material, hooked, its iridescence kept", () => {
    const robeTime = { value: 0 };
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xf4f0ff,
      iridescence: 1,
      sheen: 0.6,
    });
    const n = nodes.manyColoursRobe(m, robeTime);
    expect(n.isMeshPhysicalNodeMaterial).toBe(true);
    expect([n.iridescence, n.sheen]).toEqual([1, 0.6]);
    expect(n.customProgramCacheKey()).toContain("orthanc-many-colours");
  });
});
