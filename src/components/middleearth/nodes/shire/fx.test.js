import { describe, expect, it } from "vitest";
import * as THREE from "three";
import * as glsl from "../../shire/fx";
import * as nodes from "./fx";

const value = (v) => (v?.toArray ? v.toArray() : v);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

const build = (K) => {
  const scene = new THREE.Scene();
  const fx = K.createFx(scene, { scale: 0.5 });
  fx.showRings([{ at: v(0, 1, 0), r: 1, opacity: 0.7, face: v(0, 0, 1) }], 2);
  fx.showRings(
    [
      { at: v(0, 1, 0), r: 1, opacity: 0.7, face: v(0, 0, 1) },
      { at: v(1, 1, 0), r: 2, opacity: 0.4, face: v(0, 1, 0) },
    ],
    3,
  );
  fx.placeFlies([{ x: 0, y: 0, z: 0, r: 2 }]);
  fx.step(0.016, 4, { night: 0.8, day: 0 });
  const rings = scene.children.filter(
    (o) => o.geometry?.type === "TorusGeometry",
  );
  const flies = scene.children.find((o) => o.isPoints || o.isSprite);
  return { fx, scene, rings, flies };
};

describe("nodes/shire/fx, the twin of the Shire’s fireworks and smoke", () => {
  it("exports what fx exports, the same swatch", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.SWATCH).toEqual(glsl.SWATCH);
    expect(Object.keys(build(nodes).fx).sort()).toEqual(
      Object.keys(build(glsl).fx).sort(),
    );
  });

  it("makes node rings and fireflies whose uniforms carry the GLSL’s names and values", () => {
    const a = build(glsl);
    const n = build(nodes);
    expect(n.rings.length).toBe(a.rings.length);
    // (a material each, never sharing their uniforms)
    expect(n.rings[0].material).not.toBe(n.rings[1].material);
    const pairs = [
      ...n.rings.map((r, i) => [a.rings[i].material, r.material]),
      [a.flies.material, n.flies.material],
    ];
    for (const [o, m] of pairs) {
      expect(m.isNodeMaterial).toBe(true);
      expect(Object.keys(m.uniforms).sort()).toEqual(
        Object.keys(o.uniforms).sort(),
      );
      for (const k of Object.keys(m.uniforms))
        expect(value(m.uniforms[k].value)).toEqual(value(o.uniforms[k].value));
      expect([m.transparent, m.depthWrite, m.blending, m.side]).toEqual([
        o.transparent,
        o.depthWrite,
        o.blending,
        o.side,
      ]);
    }
  });

  it("draws the fireflies as an instanced sprite over the same places", () => {
    const n = build(nodes);
    expect(n.flies.isSprite).toBe(true);
    expect(n.flies.material.isPointsNodeMaterial).toBe(true);
    expect(n.flies.count).toBe(Math.round(140 * 0.5));
    expect(n.flies.visible).toBe(true);
  });
});
