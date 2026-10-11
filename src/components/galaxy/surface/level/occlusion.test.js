import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  HIDE_AFTER,
  boundsOf,
  createOcclusion,
  occlusionState,
} from "./occlusion";

describe("occlusionState", () => {
  it("hides a cell after HIDE_AFTER occluded frames and shows it on the first frame it is seen", () => {
    const s = occlusionState();
    for (let i = 1; i < HIDE_AFTER; i++) expect(s.read("a", true)).toBe(false);
    expect(s.read("a", true)).toBe(true);
    expect(s.hidden.has("a")).toBe(true);
    expect(s.read("a", true)).toBe(false);
    expect(s.read("a", false)).toBe(true);
    expect(s.hidden.has("a")).toBe(false);
  });
  it("never hides a cell it is told to keep", () => {
    const s = occlusionState({ hideAfter: 1 });
    expect(s.read("b", true, true)).toBe(false);
    expect(s.hidden.size).toBe(0);
  });
});

describe("boundsOf", () => {
  it("boxes each cell’s instances by their radii", () => {
    const b = boundsOf([
      { cell: "0,0", x: 0, y: 1, z: 0, r: 1 },
      { cell: "0,0", x: 10, y: 0, z: 5, r: 2 },
      { cell: null, x: 99, y: 0, z: 0, r: 1 },
    ]);
    expect([...b.keys()]).toEqual(["0,0"]);
    expect(b.get("0,0")).toEqual({ min: [-1, -2, -1], max: [12, 2, 7] });
  });
});

describe("createOcclusion", () => {
  const cells = new Map([
    ["near", { min: [-5, 0, -5], max: [5, 5, 5] }],
    ["far", { min: [95, 0, -5], max: [105, 5, 5] }],
  ]);
  it("reads each proxy’s query while it draws, and hides only the far cell the walls cover", () => {
    const parent = new THREE.Group();
    const occluded = new Set(["occluder-proxy:near", "occluder-proxy:far"]);
    const renderer = { isOccluded: (m) => occluded.has(m.name) };
    const o = createOcclusion({ renderer, parent, hideAfter: 1 });
    o.setCells(cells);
    const proxies = parent.children[0].children;
    expect(proxies).toHaveLength(2);
    expect(
      proxies.every(
        (m) =>
          m.occlusionTest && !m.material.colorWrite && !m.material.depthWrite,
      ),
    ).toBe(true);
    const camera = new THREE.PerspectiveCamera();
    // (nothing drawn yet: nothing read)
    expect(o.update(camera)).toBe(false);
    for (const m of proxies) m.onBeforeRender(renderer);
    expect(o.update(camera)).toBe(true);
    expect([...o.hidden]).toEqual(["far"]);
    occluded.delete("occluder-proxy:far");
    for (const m of proxies) m.onBeforeRender(renderer);
    expect(o.update(camera)).toBe(true);
    expect(o.hidden.size).toBe(0);
    o.setCells(new Map([["near", cells.get("near")]]));
    expect(parent.children[0].children).toHaveLength(1);
    o.dispose();
  });
  it("does nothing on a renderer with no occlusion queries", () => {
    const parent = new THREE.Group();
    const o = createOcclusion({ renderer: {}, parent });
    o.setCells(cells);
    expect(parent.children).toHaveLength(0);
    expect(o.update(new THREE.PerspectiveCamera())).toBe(false);
    expect(o.stats().able).toBe(false);
  });
});
