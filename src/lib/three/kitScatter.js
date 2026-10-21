// Many kit models' placements under keys: one instanced pool a kit, tint
// and model (kitNodes' createPool), each key's items handed to the pools of
// the models it names and taken back when it goes. The Road's stages
// (middleearth/road/scatter.js) and a galaxy world's streamed tiles
// (galaxy/surface/living.js) both draw through it.
//
//   createKitScatter({ kitFor, tier, name, poolOptions }) → { group, set(key, items, dz),
//     free(key), update(camera, dt), stats: { pools, total }, ready (every
//     pool named so far drawn: its models in), dispose() }
//     kitFor(tint, pack) → that kit in that tint (null: its own colours; no
//       pack: the MegaKit's)
//     poolOptions(model, pack) → more of createPool's options for that
//       model's pool (its `reach`, its `dissolve`)
//     items  [{ model, x, y, z, yaw, scale, tint?, pack? }], `model` the
//       kit's own name; `dz` metres along +z for every item of the set
//   CASTS: the kit's kinds that cast the sun's shadow (trees, bushes, rocks),
//     and on low none

import * as THREE from 'three';
import { createPool } from './kitNodes';
import { budget } from '../budgets';

export const CASTS = new Set(['tree', 'bush', 'rock']);

export function createKitScatter({ kitFor, tier = 'high', name = 'kit:scatter', poolOptions = () => ({}) } = {}) {
  const level = budget(tier);
  const bands = [level.near, level.mid];
  const group = new THREE.Group();
  group.name = name;
  const pools = new Map(); // kit, tint and model → Promise<pool | null>
  const live = []; // the pools in, for the frame's update
  const keys = new Map(); // key → the pools it has items in
  let gone = false;
  const idOf = (model, tint, pack) => `${pack ?? ''}|${tint ? JSON.stringify(tint) : ''}|${model}`;

  const poolFor = (model, tint, pack) => {
    const id = idOf(model, tint, pack);
    if (!pools.has(id)) {
      const kit = kitFor(tint, pack ?? null);
      const made = kit.manifest.then(() => {
        const row = kit.info(model);
        if (gone || !row) return null;
        // (only what stands casts: trees, bushes, rocks; grass, flowers and
        // pebbles casting into four cascades were most of a stage's triangles)
        const pool = createPool(kit, model, { bands, shadows: tier !== 'low' && CASTS.has(row.kind), ...poolOptions(model, pack ?? null) });
        group.add(pool.group);
        live.push(pool);
        return pool;
      });
      made.catch(() => {});
      pools.set(id, made);
    }
    return pools.get(id);
  };
  const freeIn = async (id, key) => (await pools.get(id).catch(() => null))?.free(key);

  return {
    group,
    async set(key, items, dz = 0) {
      const byPool = new Map();
      for (const it of items) {
        const id = idOf(it.model, it.tint, it.pack);
        if (!byPool.has(id)) byPool.set(id, { model: it.model, tint: it.tint, pack: it.pack, list: [] });
        byPool.get(id).list.push({ x: it.x, y: it.y, z: it.z + dz, yaw: it.yaw, scale: it.scale });
      }
      const was = keys.get(key) ?? new Set();
      const now = new Set(byPool.keys());
      keys.set(key, now);
      for (const id of was) if (!now.has(id)) freeIn(id, key);
      await Promise.all(
        [...byPool.values()].map(async ({ model, tint, pack, list }) => {
          const pool = await poolFor(model, tint, pack).catch(() => null);
          // (a later set or a free for the key wins over this one)
          if (pool && keys.get(key) === now) pool.set(key, list);
        }),
      );
    },
    free(key) {
      for (const id of keys.get(key) ?? []) freeIn(id, key);
      keys.delete(key);
    },
    update(camera, dt) {
      for (const p of live) p.update(camera, dt);
    },
    get ready() {
      return Promise.all([...pools.values()].map((p) => p.then((pool) => pool?.ready).catch(() => null)));
    },
    get stats() {
      let total = 0;
      for (const p of live) total += p.stats.total;
      return { pools: live.length, total };
    },
    dispose() {
      gone = true;
      for (const p of live) p.dispose();
      live.length = 0;
      pools.clear();
      keys.clear();
    },
  };
}
