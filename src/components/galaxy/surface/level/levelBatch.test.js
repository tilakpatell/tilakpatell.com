import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  attributeKey,
  batchable,
  createBatches,
  materialKey,
} from "./levelBatch";

const quad = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3),
  );
  g.setIndex([0, 1, 2, 2, 1, 3]);
  return g;
};
const at = (x) => new THREE.Matrix4().makeTranslation(x, 0, 0);
const roots = () => {
  const root = new THREE.Group();
  return { root, band: () => root };
};

describe("materialKey", () => {
  it("is one key for classic materials with the same maps and numbers, apart otherwise", () => {
    const map = new THREE.Texture();
    const a = new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
    const b = new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
    expect(materialKey(a)).toBe(materialKey(b));
    expect(
      materialKey(
        new THREE.MeshStandardMaterial({
          map: new THREE.Texture(),
          roughness: 0.7,
        }),
      ),
    ).not.toBe(materialKey(a));
    expect(
      materialKey(new THREE.MeshStandardMaterial({ map, roughness: 0.2 })),
    ).not.toBe(materialKey(a));
    expect(
      materialKey(
        new THREE.MeshStandardMaterial({
          map,
          roughness: 0.7,
          side: THREE.DoubleSide,
        }),
      ),
    ).not.toBe(materialKey(a));
  });
  it("keys a node material by itself unless it names a batch key", () => {
    const n1 = { isNodeMaterial: true, userData: {} };
    const n2 = { isNodeMaterial: true, userData: {} };
    expect(materialKey(n1)).toBe(materialKey(n1));
    expect(materialKey(n1)).not.toBe(materialKey(n2));
    expect(
      materialKey({
        isNodeMaterial: true,
        userData: { batchKey: "snow|tex/a" },
      }),
    ).toBe(
      materialKey({
        isNodeMaterial: true,
        userData: { batchKey: "snow|tex/a" },
      }),
    );
  });
  it("tells apart geometries a batch cannot share", () => {
    const g = quad();
    const n = quad();
    n.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(new Array(12).fill(0), 3),
    );
    expect(attributeKey(g)).not.toBe(attributeKey(n));
    expect(
      batchable({ geometry: g, material: [new THREE.MeshBasicMaterial()] }),
    ).toBe(false);
  });
});

describe("createBatches", () => {
  it("draws two LOD files of one material as one batch, and adds and removes instances without adding geometry again", () => {
    const { root, band } = roots();
    const batches = createBatches(band, { countOf: () => 4 });
    const material = new THREE.MeshStandardMaterial();
    const lod0 = { geometry: quad(), material, packMesh: 0 };
    const lod1 = { geometry: quad(), material: material.clone(), packMesh: 0 };
    expect(batches.set(lod0, [at(0), at(1)], "arena")).toBe(true);
    expect(batches.set(lod1, [at(5)], "arena")).toBe(true);
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0];
    expect(mesh.isBatchedMesh).toBe(true);
    expect(batches.stats()).toMatchObject({ calls: 1, instances: 3 });
    const geometries = mesh._geometryInfo.length;
    // (the table sorted: one instance moves from LOD0 to LOD1, one more comes)
    batches.set(lod0, [at(0)], "arena");
    batches.set(lod1, [at(5), at(1), at(9)], "arena");
    expect(mesh._geometryInfo.length).toBe(geometries);
    expect(batches.stats().instances).toBe(4);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(batches.idsOf(lod1, "arena")[2], m);
    expect(m.elements[12]).toBe(9);
    batches.clear(lod0);
    batches.set(lod1, [], "arena");
    expect(batches.stats()).toMatchObject({ calls: 0, instances: 0 });
    batches.dispose();
    expect(root.children).toHaveLength(0);
  });
  it("sizes a batch from the pack’s counts and grows past them", () => {
    const { root, band } = roots();
    const batches = createBatches(band, {
      countOf: (p) => (p.packMesh === 0 ? 10 : 3),
    });
    const material = new THREE.MeshStandardMaterial();
    batches.set({ geometry: quad(), material, packMesh: 0 }, [at(0)], "arena");
    expect(root.children[0].maxInstanceCount).toBe(10);
    batches.set({ geometry: quad(), material, packMesh: 1 }, [at(0)], "arena");
    expect(root.children[0].maxInstanceCount).toBe(13);
    // (more than counted: it grows)
    batches.set(
      { geometry: quad(), material, packMesh: 2 },
      Array.from({ length: 40 }, (_, i) => at(i)),
      "arena",
    );
    expect(root.children[0].instanceCount).toBe(42);
    // (geometry past the first room: the room doubles)
    const big = new THREE.BufferGeometry();
    big.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array(3 * 6000).fill(0), 3),
    );
    big.setIndex([...Array(6000).keys()]);
    batches.set({ geometry: big, material, packMesh: 3 }, [at(0)], "arena");
    expect(root.children[0].instanceCount).toBe(43);
  });
  it("keeps one batch per material per band", () => {
    const { root, band } = roots();
    const batches = createBatches(band);
    const material = new THREE.MeshStandardMaterial();
    const other = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    batches.set({ geometry: quad(), material }, [at(0)], "arena");
    batches.set({ geometry: quad(), material }, [at(0)], "horizon");
    batches.set({ geometry: quad(), material: other }, [at(0)], "arena");
    expect(batches.stats()).toMatchObject({
      calls: 3,
      bands: { arena: 2, horizon: 1 },
    });
    expect(root.children.map((m) => m.userData.band).sort()).toEqual([
      "arena",
      "arena",
      "horizon",
    ]);
  });
});
