import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as glsl from "../../../towns/moria/propsShaders";
import * as nodes from "./propsShaders";

const kitU = () => ({
  uTime: { value: 3 },
  uReveal: { value: 0.5 },
  uRevealAt: { value: new THREE.Vector3(1, 2, 3) },
  uRevealCam: { value: 1 },
  uRevealColor: { value: new THREE.Color(0.72, 0.84, 1.0) },
  uIthil: { value: 0.4 },
  uFire: { value: 1 },
  uFireColor: { value: new THREE.Color(1.0, 0.3, 0.07) },
  uNoise: { value: new THREE.Texture() },
  uRage: { value: 0.2 },
});
const plain = (v) => (v?.toArray ? v.toArray() : v);
const points = (n) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(n * 3), 3),
  );
  g.setAttribute(
    "aSeed",
    new THREE.BufferAttribute(new Float32Array(n * 4).fill(0.5), 4),
  );
  return g;
};

describe("nodes/towns/moria/propsShaders, the twin of Moria’s shaders", () => {
  it("exports what the GLSL module exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes node materials whose uniforms carry the GLSL’s names and values", () => {
    const U = kitU();
    const K = { renderer: null };
    const beam = {
      from: new THREE.Vector3(1, 2, 3),
      dir: new THREE.Vector3(0, -1, 0),
      r0: 0.5,
      r1: 2,
      len: 9,
    };
    const pairs = [
      ["beamMaterial", [U]],
      ["sunlitMaterial", [U, beam]],
      ["abyssMaterial", [U, true]],
      ["abyssMaterial", [U, false]],
      ["flameMaterial", [U, { size: 0.5, rise: 1, heat: 2, rate: 3 }]],
      ["smokeMaterial", [U, { size: 3, rise: 4 }]],
      ["fireSolidMaterial", [U]],
      ["wingMaterial", [U]],
      ["rippleMaterial", []],
    ].map(([k, a]) => [k, glsl[k](...a), nodes[k](...a)]);
    for (const k of ["dustPoints", "sparkPoints"])
      pairs.push([
        k,
        glsl[k](points(5), U, K).material,
        nodes[k](points(5), U, K).material,
      ]);
    for (const [k, a, n] of pairs) {
      expect(n.isNodeMaterial, k).toBe(true);
      expect(Object.keys(n.uniforms).sort(), k).toEqual(
        Object.keys(a.uniforms)
          .filter((u) => u.startsWith("u"))
          .sort(),
      );
      for (const u of Object.keys(n.uniforms))
        expect(plain(n.uniforms[u].value), `${k}.${u}`).toEqual(
          plain(a.uniforms[u].value),
        );
      expect(
        [n.transparent, n.depthWrite, n.blending, n.side, n.fog],
        k,
      ).toEqual([a.transparent, a.depthWrite, a.blending, a.side, a.fog]);
      expect(n.toneMapped, k).toBe(false);
    }
  });

  it("follows the kit’s clock and fire, so the kit’s writes still land", () => {
    const U = kitU();
    const m = nodes.flameMaterial(U);
    U.uTime.value = 7.5;
    U.uRage.value = 0.9;
    // (a followed uniform reads its { value } each render)
    for (const k of ["uTime", "uRage"]) m.uniforms[k].update({});
    expect([m.uniforms.uTime.value, m.uniforms.uRage.value]).toEqual([
      7.5, 0.9,
    ]);
    expect(nodes.flameMaterial(U).uniforms.uTime).toBe(m.uniforms.uTime);
  });

  it("draws points as sprites, one instance a point", () => {
    const U = kitU();
    const d = nodes.dustPoints(points(7), U, { renderer: null });
    const s = nodes.sparkPoints(points(9), U, { renderer: null });
    expect([d.isSprite, d.count, s.isSprite, s.count]).toEqual([
      true,
      7,
      true,
      9,
    ]);
    expect(d.material.isPointsNodeMaterial).toBe(true);
    expect(d.material.userData.fit).toBeTypeOf("function");
    expect(glsl.dustPoints(points(7), U, {}).isPoints).toBe(true);
  });

  it("clones a ripple as a fresh material, its uniforms its own", () => {
    const a = nodes.rippleMaterial();
    a.name = "ripple";
    const b = a.clone();
    expect(b.isNodeMaterial).toBe(true);
    expect(b.name).toBe("ripple");
    expect(b.uniforms.uTime).not.toBe(a.uniforms.uTime);
    b.uniforms.uK.value = 1;
    expect(a.uniforms.uK.value).toBe(0);
  });

  it("hooks return the node material for the classic one, as ./props.js uses them", () => {
    const U = kitU();
    const M = () => new THREE.MeshStandardMaterial({ roughness: 0.5 });
    const tex = new THREE.Texture();
    const hooked = [
      nodes.revealable(M(), U, "moria-reveal"),
      nodes.underglow(M(), U, "moria-abyss"),
      nodes.ithildinGlow(M(), U),
      nodes.hide(M(), { tex, nrm: tex, key: "moria-troll" }),
      nodes.hide(M(), {
        tex,
        nrm: tex,
        key: "moria-balrog",
        ...nodes.balrogFire(U),
      }),
    ];
    for (const m of hooked) {
      expect(m.isMeshStandardNodeMaterial).toBe(true);
      expect(m.roughness).toBe(0.5);
    }
    expect(hooked[1].emissiveNode).toBeTruthy();
    expect(hooked[4].emissiveNode).toBeTruthy();
    expect(Object.keys(nodes.balrogFire(U).uniforms)).toEqual(
      Object.keys(glsl.balrogFire(U).uniforms),
    );
    // each hook its own program key
    const keys = hooked.map((m) => m.customProgramCacheKey());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
