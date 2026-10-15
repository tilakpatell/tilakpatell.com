import * as THREE from "three/webgpu";
import {
  Fn,
  instanceIndex,
  instancedArray,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { describe, expect, it } from "vitest";
import * as nodes from "./noiseNodes";

// Builds a compute kernel that calls `use(fns)` into WGSL, as three's own
// builder would (no device in Node: it asks for features and is told none).
const wgsl = (use) => {
  const out = instancedArray(1, "vec4");
  const kernel = Fn(() => {
    out.element(instanceIndex).assign(use());
  })().compute(1);
  const r = new THREE.WebGPURenderer({
    canvas: {
      style: {},
      addEventListener() {},
      removeEventListener() {},
      getContext: () => null,
      width: 1,
      height: 1,
    },
  });
  r.hasFeature = () => false;
  r.backend.renderer = r;
  const b = new THREE.WGSLNodeBuilder(null, r);
  b.compute = kernel;
  b.build();
  return b.computeShader;
};

describe("noiseNodes, the twin of noiseGlsl", () => {
  it("names the GLSL’s functions, over a seed of the caller’s", () => {
    expect(Object.keys(nodes).sort()).toEqual([
      "FBM_OCT",
      "M3",
      "M3T",
      "noiseWith",
    ]);
    expect(nodes.FBM_OCT).toBe(10);
    const fns = nodes.noiseWith(uniform(new THREE.Vector3(17, 3, 41)));
    expect(Object.keys(fns).sort()).toEqual([
      "fbm",
      "fbmd",
      "hash13",
      "hash33",
      "noise",
      "noised",
      "noised2",
    ]);
  });

  it("the turn between octaves is the GLSL’s mat3, column by column, and its transpose", () => {
    // (the const under three's intent to make it a variable, should anything assign to it)
    const matrix = (n) => n.value ?? n.node.value;
    expect(Array.from(matrix(nodes.M3).elements)).toEqual([
      0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64,
    ]);
    expect(Array.from(matrix(nodes.M3T).elements)).toEqual(
      Array.from(matrix(nodes.M3).clone().transpose().elements),
    );
  });

  it("builds, each a function of its own (not inlined at every call)", () => {
    const f = nodes.noiseWith(uniform(new THREE.Vector3(1, 2, 3)));
    const code = wgsl(() => {
      const p = vec3(0.3, 1.7, -2.2);
      const d = f.fbmd(p, 6.5, 0.5);
      return vec4(
        f.fbm(p, 4).add(f.noise(p)).add(f.hash13(p)),
        f.hash33(p).add(d.yzw).add(f.noised2(p).yzw),
      );
    });
    // hash13, hash33, noised, noise, fbmd, noised2, fbm
    expect(code.match(/\nfn fn\d+/g)?.length).toBe(7);
    expect(code).toMatch(/fract/);
  });

  it("octaves past ten, for a shader that asks (the galaxy’s worlds at ultra)", () => {
    const f = nodes.noiseWith(uniform(new THREE.Vector3()), { octaves: 14 });
    expect(wgsl(() => f.fbmd(vec3(1, 2, 3), 13, 0.5))).toMatch(/i < 14;/);
  });
});
