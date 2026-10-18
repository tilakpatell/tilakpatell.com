import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import * as glsl from "../../towns/ghosts";
import * as nodes from "./ghosts";

// (Node has no canvas: a card that measures and draws nothing, as
// ../../towns/ghosts.test.js has it)
beforeAll(() => {
  const pen = {
    measureText: () => ({ width: 60 }),
    beginPath() {},
    roundRect() {},
    fill() {},
    fillText() {},
  };
  vi.stubGlobal("document", {
    createElement: () => ({ width: 0, height: 0, getContext: () => pen }),
  });
});
afterAll(() => vi.unstubAllGlobals());

const make = () => {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
  );
  return { group, top: 1.6 };
};

// the same travellers, a few frames in, on either side
const run = (G) => {
  const ghosts = G.createGhosts({ make, animate: () => {} });
  const list = [
    { id: "abc", name: "Sam", x: 1, z: 2, face: 0.5, moving: true },
    { id: "xyz", name: "Pip", x: -3, z: 0, face: 0, moving: false, ring: true },
  ];
  for (let i = 1; i <= 5; i++) ghosts.update(list, i * 0.1, 0.1);
  const seen = [];
  ghosts.group.traverse((o) => {
    if (o.material)
      seen.push({
        type: o.material.type,
        node: o.material.isNodeMaterial === true,
        opacity: o.material.opacity,
        transparent: o.material.transparent,
        depthWrite: o.material.depthWrite,
        blending: o.material.blending,
        at: o.getWorldPosition(new THREE.Vector3()).toArray(),
      });
  });
  return { ghosts, seen };
};

describe("nodes/towns/ghosts, the twin of the ghosts", () => {
  it("exports what the ghosts export", () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it("draws the same travellers, in the same places and as faded, with node materials", () => {
    const a = run(glsl);
    const n = run(nodes);
    expect(n.ghosts.count).toBe(a.ghosts.count);
    expect(n.seen.length).toBe(a.seen.length);
    expect(n.seen.every((s) => s.node)).toBe(true);
    const strip = (s) => ({ ...s, type: s.type.replace("Node", ""), node: 0 });
    expect(n.seen.map(strip)).toEqual(a.seen.map(strip));
    // (the pale stuff: the classic one's own colours and glow)
    const pale = (G) => G.group.children[0].children[0].children[0].material;
    for (const k of ["color", "emissive"])
      expect(pale(n.ghosts)[k].getHex()).toBe(pale(a.ghosts)[k].getHex());
    expect(pale(n.ghosts).emissiveNode?.isNode).toBe(true);
    a.ghosts.dispose();
    n.ghosts.dispose();
  });
});
