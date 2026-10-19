// What grows beside the road: a stage’s table (stages/tables.js) placed on
// its land by a pure rule, then drawn through the nature kits’ instanced
// pools (kitNodes), one pool a model for every built stage, each stage’s
// items under its own key. A row is the MegaKit’s (`naturemega`) unless it
// names another kit (`pack: 'nature'`: the older Stylized Nature Pack’s
// maples, birches and dead trees).
//
//   placements(rows, land, road, rng, { tier, reach }) → [{ model, x, y, z, yaw, scale, tint, pack? }]
//     (pure: density per 100 m², in clumps, never within CLEAR of the road,
//     off steep ground and out of the water, `reach` metres either side of
//     the road at most; low halves the counts and drops the grass, mid thins it;
//     a row with `z: [z0, z1]` or `x: [x0, x1]` keeps to that band of the stage;
//     nothing inside the land’s `clear` circles, [{ at: [x, z], r }]: a town, a garden)
//   rowsFor(id) → the stage’s rows
//   rngOf(seed) → () → 0…1, the same for the same seed
//   createScatter({ kitFor, tier }) → { group, set(key, items, dz), free(key), update(camera, dt), stats, dispose }
//     kitFor(tint, pack) → that kit in that tint (null: its own colours; no pack: the MegaKit)

import * as THREE from 'three';
import { createPool } from '../../../lib/three/kitNodes';
import { budget } from '../../../lib/budgets';
import { distanceTo } from '../../../lib/land/paths.js';
import { SCATTER } from './stages/tables';

export const CLEAR = 6; // m: nothing grows nearer the road’s middle than this
const SLOPE = 0.6; // the steepest ground a row stands on by default (rise over run)
const REACH = 300; // m either side of the road a stage is planted to

export const rowsFor = (id) => SCATTER[id] ?? [];

// mulberry32
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const share = (row, tier) => {
  if (row.kind === 'grass') return tier === 'low' ? 0 : tier === 'mid' ? 0.5 : 1;
  return tier === 'low' ? 0.5 : 1;
};

export function placements(rows, land, road, rng, { tier = 'high', reach = REACH } = {}) {
  const off = distanceTo(road, CLEAR);
  const field = land.field ?? land.heightAt;
  const x0 = Math.max(land.x0, -reach);
  const x1 = Math.min(land.x0 + land.w, reach);
  const z0 = land.z0;
  const z1 = land.z0 + land.d;
  const out = [];
  for (const row of rows) {
    // (a row’s own band, inside the stage’s: a field of corn, a wood)
    const bx0 = Math.max(x0, row.x?.[0] ?? x0);
    const bx1 = Math.min(x1, row.x?.[1] ?? x1);
    const bz0 = Math.max(z0, row.z?.[0] ?? z0);
    const bz1 = Math.min(z1, row.z?.[1] ?? z1);
    if (bx1 <= bx0 || bz1 <= bz0) continue;
    const area = (bx1 - bx0) * (bz1 - bz0);
    const count = Math.round((row.per100 * area * share(row, tier)) / 100);
    const clump = Math.max(1, row.clump ?? 1);
    const spread = row.spread ?? 4;
    const cap = row.slope ?? SLOPE;
    const [s0, s1] = row.scale ?? [1, 1];
    for (let n = 0; n < count; n += clump) {
      const cx = bx0 + rng() * (bx1 - bx0);
      const cz = bz0 + rng() * (bz1 - bz0);
      for (let k = 0; k < clump && n + k < count; k++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * spread;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        const yaw = rng() * Math.PI * 2;
        const scale = s0 + rng() * (s1 - s0);
        if (x < bx0 || x > bx1 || z < bz0 || z > bz1) continue;
        if (off(x, z) < CLEAR) continue;
        if (land.wet?.(x, z)) continue;
        if (land.clear?.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r)) continue;
        const sx = (field(x + 1, z) - field(x - 1, z)) / 2;
        const sz = (field(x, z + 1) - field(x, z - 1)) / 2;
        if (Math.hypot(sx, sz) > cap) continue;
        out.push({ model: row.model, x, y: field(x, z), z, yaw, scale, tint: row.tint ?? null, ...(row.pack ? { pack: row.pack } : {}) });
      }
    }
  }
  return out;
}

export function createScatter({ kitFor, tier = 'high' } = {}) {
  const level = budget(tier);
  const bands = [level.near, level.mid];
  const group = new THREE.Group();
  group.name = 'road:scatter';
  const pools = new Map(); // kit, tint and model → Promise<pool | null>
  const live = []; // the pools in, for the frame’s update
  const keys = new Map(); // key → the pools it has items in
  let gone = false;
  const idOf = (model, tint, pack) => `${pack ?? ''}|${tint ? JSON.stringify(tint) : ''}|${model}`;

  const poolFor = (model, tint, pack) => {
    const id = idOf(model, tint, pack);
    if (!pools.has(id)) {
      const kit = kitFor(tint, pack ?? null);
      const made = kit.manifest.then(() => {
        if (gone || !kit.info(model)) return null;
        const pool = createPool(kit, model, { bands, shadows: tier !== 'low' });
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
    // a stage’s items under its key, `dz` metres along +z (where its land stands)
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
