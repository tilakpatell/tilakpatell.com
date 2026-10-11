// What the level's walls hide (fidelity lane U): each block of the arena's
// cells that holds instances has a proxy, a box round them that writes nothing,
// drawn after everything opaque with an occlusion query on it
// (`occlusionTest`, the node renderer's `isOccluded`, three's
// webgpu_occlusion). A cell whose box drew no sample for `hideAfter` frames
// in a row is hidden: its instances in the batches are set invisible
// (levelScene.js), so the far draws behind the hangar's walls cost nothing
// past the proxy. A cell is shown again on the first frame its box draws a
// sample (the query reads a frame late, so a cell comes back one frame
// after it is seen: the price of reading without a stall). The cell the
// camera is in, and a box the camera is inside (its faces behind the near
// plane draw nothing), are never hidden. Nothing happens on the classic
// renderer, which has no `isOccluded`.
//
// A hidden instance casts no shadow either; the cells round the camera
// (`keepNear` m) are never hidden, so a shadow falls short only from a
// cell that far off and wholly behind a wall.
//
//   createOcclusion({ renderer, parent, hideAfter, keepNear }) → { setCells(bounds), update(camera) → changed,
//     hidden: Set<key>, stats() → { blocks, hidden, queries, able }, dispose() }
//   bounds: Map key → { min: [x, y, z], max: [x, y, z] }
//   occlusionState({ hideAfter }) → { read(key, occluded, keep) → changed, hidden, forget(key) }   (pure)
//   boundsOf(rows, keyOf = blockOf()) → Map key → { min, max }   (pure: rows' { cell, x, y, z, r })
//   blockOf(cells = BLOCK) → (row) → the key of the block of cells its cell is in
//
// A proxy is a draw and a query of its own, so the queries are per block of
// BLOCK × BLOCK cells, not per cell (Hoth: 155 cells, 55 blocks of 2 × 2,
// beside its 78 batched draws).

import * as THREE from "three";

// frames a cell's box must draw nothing before the cell is hidden
export const HIDE_AFTER = 2;
// m: cells whose box comes this near the camera are never hidden
export const KEEP_NEAR = 24;
// cells a block's side (the pack's cells are 128 m on Hoth: blocks of 256 m)
export const BLOCK = 2;

export const blockOf =
  (cells = BLOCK) =>
  (row) => {
    if (row.cell == null) return null;
    const [x, z] = row.cell.split(",").map(Number);
    return `${Math.floor(x / cells)},${Math.floor(z / cells)}`;
  };

export function occlusionState({ hideAfter = HIDE_AFTER } = {}) {
  const runs = new Map(); // key → frames in a row the box drew nothing
  const hidden = new Set();
  return {
    hidden,
    read(key, occluded, keep = false) {
      if (keep || !occluded) {
        runs.set(key, 0);
        return hidden.delete(key);
      }
      const n = (runs.get(key) ?? 0) + 1;
      runs.set(key, n);
      if (n >= hideAfter && !hidden.has(key)) {
        hidden.add(key);
        return true;
      }
      return false;
    },
    forget(key) {
      runs.delete(key);
      return hidden.delete(key);
    },
  };
}

export function boundsOf(rows, keyOf = blockOf()) {
  const out = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    if (key == null) continue;
    let b = out.get(key);
    if (!b)
      out.set(
        key,
        (b = {
          min: [Infinity, Infinity, Infinity],
          max: [-Infinity, -Infinity, -Infinity],
        }),
      );
    const at = [r.x, r.y ?? 0, r.z];
    for (let k = 0; k < 3; k++) {
      b.min[k] = Math.min(b.min[k], at[k] - r.r);
      b.max[k] = Math.max(b.max[k], at[k] + r.r);
    }
  }
  return out;
}

// how far a point is from a box (0 inside)
const distTo = (b, p) =>
  Math.hypot(
    ...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])),
  );

export function createOcclusion({
  renderer,
  parent,
  hideAfter = HIDE_AFTER,
  keepNear = KEEP_NEAR,
} = {}) {
  const able = typeof renderer?.isOccluded === "function";
  const state = occlusionState({ hideAfter });
  const group = new THREE.Group();
  group.name = "occlusion";
  if (able) parent.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  // (writes neither colour nor depth: only the query sees it)
  const material = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
  });
  const proxies = new Map(); // key → { mesh, bounds }
  const at = new THREE.Vector3();
  let queries = 0;

  return {
    hidden: state.hidden,
    setCells(bounds) {
      for (const [key, p] of proxies) {
        if (bounds.has(key)) continue;
        group.remove(p.mesh);
        proxies.delete(key);
        state.forget(key);
      }
      for (const [key, b] of bounds) {
        let p = proxies.get(key);
        if (!p) {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = `occluder-proxy:${key}`;
          mesh.occlusionTest = true;
          mesh.renderOrder = 1e6; // (after every wall it is tested against)
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          // (the renderer answers only while it draws: its current pass's
          // queries, last resolved; the scene pass's, the proxies casting no shadow)
          mesh.onBeforeRender = (r) => {
            const q = proxies.get(key);
            if (q) q.occluded = Boolean(r.isOccluded?.(mesh));
          };
          group.add(mesh);
          proxies.set(key, (p = { mesh, bounds: b }));
        }
        p.bounds = b;
        p.mesh.position.set(
          (b.min[0] + b.max[0]) / 2,
          (b.min[1] + b.max[1]) / 2,
          (b.min[2] + b.max[2]) / 2,
        );
        p.mesh.scale.set(
          Math.max(1e-3, b.max[0] - b.min[0]),
          Math.max(1e-3, b.max[1] - b.min[1]),
          Math.max(1e-3, b.max[2] - b.min[2]),
        );
        p.mesh.updateMatrixWorld();
      }
    },
    // after a frame is drawn: the queries read, the hidden set moved
    update(camera) {
      if (!able || !camera) return false;
      camera.getWorldPosition(at);
      const eye = [at.x, at.y, at.z];
      let changed = false;
      for (const [key, p] of proxies) {
        if (p.occluded === undefined) continue; // (not drawn yet)
        queries++;
        const keep = distTo(p.bounds, eye) <= keepNear;
        if (state.read(key, p.occluded, keep)) changed = true;
        p.occluded = undefined;
      }
      return changed;
    },
    stats: () => ({
      blocks: proxies.size,
      hidden: state.hidden.size,
      queries,
      able,
    }),
    dispose() {
      parent?.remove(group);
      group.clear();
      proxies.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
