import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/edoras/propsShaders";
import * as nodes from "./propsShaders";

const WIND = new THREE.Vector3(0.32, 0, -0.95).normalize();
const ACROSS = new THREE.Vector3()
  .crossVectors(WIND, new THREE.Vector3(0, 1, 0))
  .normalize();

describe("nodes/towns/edoras/propsShaders, the twin of the wind’s shaders", () => {
  it("exports what the GLSL module exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("returns the patched material, the GLSL’s as itself and the twin’s as a node material", () => {
    const U = { uTime: { value: 0 } };
    const banner = new THREE.MeshStandardMaterial({ alphaTest: 0.5 });
    expect(glsl.windBanner(banner, U, WIND, ACROSS)).toBe(banner);
    const n = nodes.windBanner(
      new THREE.MeshStandardMaterial({ alphaTest: 0.5 }),
      U,
      WIND,
      ACROSS,
    );
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    expect(n.alphaTest).toBe(0.5);
    expect(n.customProgramCacheKey()).toContain("edoras-banner");

    const tuft = new THREE.MeshLambertMaterial({ vertexColors: true });
    expect(glsl.windGrass(tuft, U, WIND, 0.5)).toBe(tuft);
    const g = nodes.windGrass(
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      U,
      WIND,
      0.5,
    );
    expect(g.isMeshLambertNodeMaterial).toBe(true);
    expect(g.vertexColors).toBe(true);
    expect(g.customProgramCacheKey()).toContain("edoras-grass0.5");
  });
});
