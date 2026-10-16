// The ground's clutter as the kits' models where the planet names one
// (lib/land/flight/landmarkTables.js's clutterKitOf): a forest's trees, a
// rock world's boulders, drawn through lib/three/kit.js's keyed pools (one
// key a leaf, its LOD1 and its puff far off), in place of ./ground.js's
// code-built shapes for those kinds. Until a kind's model is in, and on low,
// and for a kind the planet has no model for, its rows stay with the
// code-built pools: nothing is ever missing while a file loads, and a model
// that won't load leaves its kind code-built for the flight, said once.
//
// Under the ground's root, in world metres (the root moves with the
// origin), so its pools sort by the ship's own place.
//
//   createKitClutter(root, { spec, tier, load, makePool }) → {
//     add(rows) → { key (null: none taken), rest (the rows it left), kitted },
//     free(key), update(ship), stats() → { ready (kinds in), items, drawn
//     ([full, LOD1, puff]) }, dispose() }
//   rows: the worker's [x, y, z, yaw, scale, kindIndex] each

import { createPool, loadKit } from '../../../lib/three/kitNodes';
import { CLUTTER_KINDS } from '../../../lib/land/flight/leafMesh';
import { clutterKitOf } from '../../../lib/land/flight/landmarkTables';

// [near, mid]: the full model within near, its LOD1 to mid, its puff to
// twice that; the clutter lives on the two finest leaves, within a few
// hundred metres of the ship, its puffs out to 1.8 km where the code-built shapes would still show
const BANDS = [150, 900];
const CAP = 256; // a pool's instances to start (it grows)

export function createKitClutter(root, { spec, tier = 'mid', load = loadKit, makePool = createPool, house = null } = {}) {
  const table = tier === 'low' ? {} : clutterKitOf(spec);
  const kits = new Map(); // pack → kit
  const kinds = new Map(); // kind index → { pool, size, ready }
  let gone = false;
  let warned = false;
  let next = 0;
  let last = null; // performance.now() at the last update

  for (const [kind, row] of Object.entries(table)) {
    const index = CLUTTER_KINDS.indexOf(kind);
    if (index < 0) continue;
    // (in the house's look from the start: the node renderer has no frame
    // guard to put it on as a pool first draws, lib/three/houseNodes)
    if (!kits.has(row.kit)) kits.set(row.kit, load(row.kit, house ? { house } : {}));
    const kit = kits.get(row.kit);
    const entry = { pool: null, size: row.size, ready: false };
    kinds.set(index, entry);
    Promise.resolve(kit.manifest)
      .then(() => {
        if (gone) return null;
        entry.pool = makePool(kit, row.name, { bands: BANDS, cap: CAP, shadows: false });
        root.add(entry.pool.group);
        return entry.pool.ready;
      })
      .then(() => {
        if (!gone && entry.pool) entry.ready = true;
      })
      .catch((e) => {
        if (warned || gone) return;
        warned = true;
        console.warn(`flight clutter: ${row.kit}/${row.name} won't load (${e?.message ?? e}); its kind stays code-built`);
      });
  }

  return {
    add(rows) {
      let kitted = 0;
      const by = new Map(); // kind index → items
      const rest = [];
      for (let r = 0; r < rows.length; r += 6) {
        const entry = kinds.get(rows[r + 5]);
        if (!entry?.ready) {
          for (let c = 0; c < 6; c++) rest.push(rows[r + c]);
          continue;
        }
        if (!by.has(rows[r + 5])) by.set(rows[r + 5], []);
        by.get(rows[r + 5]).push({ x: rows[r], y: rows[r + 1], z: rows[r + 2], yaw: rows[r + 3], scale: rows[r + 4] * entry.size });
        kitted++;
      }
      if (!kitted) return { key: null, rest: rows, kitted: 0 };
      const key = `leaf${next++}`;
      for (const [index, items] of by) kinds.get(index).pool.set(key, items);
      return { key, rest: Float32Array.from(rest), kitted };
    },
    free(key) {
      for (const e of kinds.values()) e.pool?.free(key);
    },
    update(ship) {
      if (gone) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      const camera = { position: { x: ship.x, y: ship.y ?? 0, z: ship.z } };
      for (const e of kinds.values()) e.pool?.update(camera, dt);
    },
    stats() {
      const out = { ready: 0, items: 0, drawn: [0, 0, 0] };
      for (const e of kinds.values()) {
        if (e.ready) out.ready++;
        out.items += e.pool?.stats?.total ?? 0;
        e.pool?.stats?.levels?.forEach((n, i) => (out.drawn[i] += n));
      }
      return out;
    },
    dispose() {
      gone = true;
      for (const e of kinds.values()) e.pool?.dispose();
      kinds.clear();
      for (const kit of kits.values()) kit.dispose?.();
      kits.clear();
    },
  };
}
