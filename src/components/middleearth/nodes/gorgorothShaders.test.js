import { describe, expect, it } from "vitest";
import * as glsl from "../gorgorothShaders";
import * as nodes from "./gorgorothShaders";

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe("nodes/gorgorothShaders, the twin of the Eye, the beam and the pool", () => {
  it("exports what the original exports", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("makes node materials whose uniforms carry the GLSL’s names and values", () => {
    const ab = glsl.beamMaterial();
    const nb = nodes.beamMaterial();
    const pairs = [
      [glsl.eyeMaterial(), nodes.eyeMaterial()],
      [ab, nb],
      [glsl.poolMaterial(ab.uniforms), nodes.poolMaterial(nb.uniforms)],
    ];
    for (const [a, n] of pairs) {
      expect(n.isNodeMaterial).toBe(true);
      expect(Object.keys(n.uniforms).sort()).toEqual(
        Object.keys(a.uniforms).sort(),
      );
      for (const k of Object.keys(n.uniforms))
        expect(plain(n.uniforms[k].value)).toEqual(plain(a.uniforms[k].value));
      expect([n.transparent, n.depthWrite, n.blending, n.side, n.fog]).toEqual([
        a.transparent,
        a.depthWrite,
        a.blending,
        a.side,
        a.fog,
      ]);
    }
  });

  it("shares the beam’s uniforms with the pool, as the original does", () => {
    const beam = nodes.beamMaterial();
    const pool = nodes.poolMaterial(beam.uniforms);
    expect(pool.uniforms).toBe(beam.uniforms);
    beam.uniforms.uPower.value = 2.5;
    expect(pool.uniforms.uPower.value).toBe(2.5);
  });
});
