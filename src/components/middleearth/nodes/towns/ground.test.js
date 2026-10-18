import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

// (no canvas in Node: the detail texture’s painting stood in for)
vi.mock("../../../../lib/paint", async (load) => ({
  ...(await load()),
  makeCanvas: (size) => ({ width: size, height: size }),
  paintPixels: () => {},
  normalFromField: (f, w, h) => ({ width: w, height: h }),
}));

const glsl = await import("../../towns/ground");
const nodes = await import("./ground");

const plain = (v) => (v?.toArray ? v.toArray() : v);
const height = (x, z) => 0.2 * Math.sin(x * 0.3) + 0.1 * Math.cos(z * 0.4);
const PUDDLES = [
  [0, 0, 1.5, 1, 0.3],
  [3, -2, 1, 0.7, 1.1],
];

describe("nodes/towns/ground, the twin of a town’s ground", () => {
  it("exports what the ground exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes puddles of a node material, its uniforms the GLSL’s names and values", () => {
    const a = glsl.makePuddles(PUDDLES, height);
    const n = nodes.makePuddles(PUDDLES, height);
    expect(Object.keys(n).sort()).toEqual(Object.keys(a).sort());
    expect(n.material.isNodeMaterial).toBe(true);
    expect(n.material.uniforms).toBe(n.uniforms);
    const names = Object.keys(a.uniforms).filter((k) => k.startsWith("u"));
    expect(Object.keys(n.uniforms).sort()).toEqual(names.sort());
    for (const k of names) {
      const v = a.uniforms[k].value;
      if (Array.isArray(v)) {
        // (the lamps: the same vectors, each one its own uniform node)
        expect(n.uniforms[k].value.map(plain)).toEqual(v.map(plain));
        n.uniforms[k].nodes.forEach((u, i) => {
          expect(u.isNode).toBe(true);
          expect(u.value).toBe(n.uniforms[k].value[i]);
        });
      } else {
        expect(n.uniforms[k].isNode, k).toBe(true);
        expect(plain(n.uniforms[k].value), k).toEqual(plain(v));
      }
    }
    for (const p of [
      "fog",
      "transparent",
      "depthWrite",
      "polygonOffset",
      "polygonOffsetFactor",
      "toneMapped",
    ])
      expect(n.material[p], p).toBe(a.material[p]);
    expect([n.mesh.renderOrder, n.mesh.name]).toEqual([
      a.mesh.renderOrder,
      a.mesh.name,
    ]);
    expect([...n.mesh.geometry.attributes.position.array]).toEqual([
      ...a.mesh.geometry.attributes.position.array,
    ]);
    expect([...n.mesh.geometry.attributes.local.array]).toEqual([
      ...a.mesh.geometry.attributes.local.array,
    ]);
  });

  it("sets the lamps and the rain as the original does", () => {
    const a = glsl.makePuddles(PUDDLES, height);
    const n = nodes.makePuddles(PUDDLES, height);
    const lights = [
      {
        position: new THREE.Vector3(1, 3, 2),
        color: new THREE.Color(1, 0.6, 0.2),
        power: 2,
      },
      {
        position: new THREE.Vector3(-4, 2, 0),
        color: new THREE.Color(0.5, 0.5, 1),
      },
    ];
    for (const p of [a, n]) {
      p.setLights(lights);
      p.update(4.5, 0.6);
    }
    expect(n.uniforms.uLightPos.value.map(plain)).toEqual(
      a.uniforms.uLightPos.value.map(plain),
    );
    expect(n.uniforms.uLightCol.value.map(plain)).toEqual(
      a.uniforms.uLightCol.value.map(plain),
    );
    expect(n.uniforms.uLightPos.nodes[0].value.w).toBe(2);
    expect([n.uniforms.uTime.value, n.uniforms.uRain.value]).toEqual([
      4.5, 0.6,
    ]);
  });

  it("scatters the same tufts, on a swaying Lambert node material", () => {
    const opts = { radius: 20, height, growable: (x) => x > -8, seed: 41 };
    const wind = { uWind: { value: 0 } };
    const a = glsl.makeTufts(400, opts, wind);
    const n = nodes.makeTufts(400, opts, wind);
    expect(n.children.length).toBe(a.children.length);
    n.children.forEach((m, i) => {
      const o = a.children[i];
      expect(m.isInstancedMesh).toBe(true);
      expect(m.material.isMeshLambertNodeMaterial).toBe(true);
      expect(m.material.vertexColors).toBe(true);
      expect(m.material.customProgramCacheKey()).toContain("sway0.4");
      expect([...m.instanceMatrix.array]).toEqual([...o.instanceMatrix.array]);
      expect([...m.instanceColor.array]).toEqual([...o.instanceColor.array]);
    });
    expect([...n.children[0].geometry.attributes.position.array]).toEqual([
      ...a.children[0].geometry.attributes.position.array,
    ]);
  });

  it("raises and paints the same terrain, on a standard node material", () => {
    const opts = {
      size: 20,
      seg: 8,
      height,
      paint: (x, z, h, out) => out.splice(0, 3, 0.3, 0.4 + h, 0.2),
      roughness: 0.9,
    };
    const a = glsl.makeTerrain(null, opts);
    const n = nodes.makeTerrain(null, opts);
    expect(n.material.isMeshStandardNodeMaterial).toBe(true);
    for (const p of ["vertexColors", "roughness"])
      expect(n.material[p]).toBe(a.material[p]);
    expect(n.material.normalScale.toArray()).toEqual(
      a.material.normalScale.toArray(),
    );
    expect([...n.geometry.attributes.position.array]).toEqual([
      ...a.geometry.attributes.position.array,
    ]);
    expect([...n.geometry.attributes.color.array]).toEqual([
      ...a.geometry.attributes.color.array,
    ]);
    expect([n.receiveShadow, n.name]).toEqual([a.receiveShadow, a.name]);
  });
});
