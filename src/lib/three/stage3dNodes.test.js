import { describe, expect, it } from "vitest";
import * as glsl from "../stage3d";
import * as nodes from "./stage3dNodes";

describe("stage3dNodes, the twin of lib/stage3d’s parts", () => {
  it("copies what a stage takes from lib/stage3d, the same in what they give", () => {
    expect(nodes.hot(0x804020, 2).toArray()).toEqual(
      glsl.hot(0x804020, 2).toArray(),
    );
    for (const o of [{}, { soft: true }, { tier: "low" }])
      expect(nodes.stageRatio(o)).toBe(glsl.stageRatio(o));
    const made = [];
    const both = [nodes, glsl].map((m) =>
      m.stageSizing({
        ratio: 1.5,
        canvas: (...a) => made.push(["c", ...a]),
        buffers: (...a) => made.push(["b", ...a]),
      }),
    );
    for (const z of both) {
      z.resize(400, 200);
      z.scale(0.8);
      z.fit();
      z.setRatio(1);
      z.fit();
    }
    expect(made.slice(0, made.length / 2)).toEqual(made.slice(made.length / 2));
  });

  it("has GRADE’s uniforms, by name and value, for the grade pass", () => {
    const u = nodes.gradeUniforms();
    const names = Object.keys(glsl.GRADE.uniforms).filter(
      (k) => k !== "tDiffuse",
    );
    expect(Object.keys(u).sort()).toEqual(names.sort());
    for (const k of names) {
      const v = glsl.GRADE.uniforms[k].value;
      expect(v?.toArray ? u[k].value.toArray() : u[k].value).toEqual(
        v?.toArray ? v.toArray() : v,
      );
    }
    expect(typeof nodes.gradeNode(u)).toBe("function");
  });
});
