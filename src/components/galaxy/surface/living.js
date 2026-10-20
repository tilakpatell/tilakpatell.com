// The living ground: a world's cover, bushes and trees (flora.js's
// livingRows) streamed round you a tile at a time (lib/land/cover.js), so
// wherever you walk the ground is as thick as by the landing, at the Road's
// and the Shire's densities. Each tile's items go under its key into the
// kit's pools (lib/three/kitScatter: the full model near, its LOD1 further,
// a puff to the band's reach), its trunks solid while it's in; a tile goes
// as you leave it. (docs/superpowers/specs/2026-10-20-galaxy-living-free-roam-
// design.md, 1)
//
//   SIZE: { near, cover, mid, trees } metres a side of a band's tile
//   reachOf(level) → { near, cover, mid, trees }: metres a band is laid out
//     to, and drawn to, from the level's row (lib/budgets): the thick cover
//     round you (the Shire's) within most of the kit's full band, fading
//     into the rest of the cover a little past it, the bushes as far as their far stand-ins
//     go, the trees to `far`, the edge of what you can see across a world.
//     Each shrinks away over the end of its reach (the pools' dissolve: the
//     cover's longer), so no ring is seen, and a tile laid at the edge is
//     laid where nothing of it shows yet
//   shareOf(level) → (row) → the share of a row's count the level lays (its
//     `props`; on low no grass clumps, the blades being its grass)
//   keepOf({ site, heightAt, solids, avoid, clearings, busy, wade }) →
//     keep(x, z, row): nothing on a place's flat or by the landing (`avoid`,
//     the scene's), in the water, in a wall or past the ground's edge; a
//     row's `clear` metres kept off a flat (a tree's 25). The trees take no
//     notice of the walls or of `clearings` (where your ship came down,
//     read each call), so the ground map's shade under them is laid before
//     either is known; a ship lands clear of a trunk, which is solid
//   shadeOf(rows, { level, seed, height, keep, half }) → [{ at, r }]: the
//     streamed trees' crowns over the ground map's square (groundPaint.js
//     shades the grass under them, as under a tree row's)
//   createLiving({ rows, kitFor, level, seed, height, keep, cover, solids })
//     → { group, update(x, z, camera, dt), fill(x, z), refresh(), ready,
//       stats: { tiles, queued, pools, total }, dispose() }
//     kitFor(pack) the placer's (the world's tint and wind); cover(x, z)
//     the ground's grass, 0…1 (null: every row on any ground); fill lays
//     every tile round (x, z) at once (the landing's, before you see it);
//     refresh lays every tile in again (once the walls are in)

import { budget } from '../../../lib/budgets';
import { TILE, coverTile, tilesAround } from '../../../lib/land/cover';
import { createKitScatter } from '../../../lib/three/kitScatter';
import { HALF } from './terrain';
import { pushOut } from './walker';

export const SIZE = { near: TILE / 2, cover: TILE, mid: 2 * TILE, trees: 4 * TILE };
// the share of a band's reach its items shrink away over (kitNodes' dissolve):
// the near band's half of it, into the cover's
const DISSOLVE = { near: 0.5, cover: 0.4, mid: 0.25, trees: 0.2 };
const BUSHES = 600; // metres the bushes are drawn to at most (ultra keeps its full meshes to 400)
const BANDS = ['near', 'cover', 'mid', 'trees'];
// (each band's rows from their own numbers: a bush never stands on a tuft's clump)
const SEEDS = { near: 3001, cover: 0, mid: 1009, trees: 2003 };
const STEP = 6; // metres you go before the ring's looked at again
const SPEND = 2; // ms a frame laying tiles, at most
const UNDER = 12; // metres: a tile this near is laid this frame, whatever it costs
const EDGE = 12; // metres inside the ground's square nothing is laid past
const WALL = 0.6; // metres a bush or a tuft keeps from a wall

export function reachOf(level) {
  const { near, mid, far } = budget(level);
  return { near: Math.round(near * 0.6), cover: near + 40, mid: Math.min(2 * mid, BUSHES), trees: far };
}

export function shareOf(level) {
  const { props } = budget(level);
  return (row) => (level === 'low' && row.kind === 'grassclump' ? 0 : props);
}

export function keepOf({ site, heightAt, solids = null, avoid, clearings = [], busy = () => false, wade = null }) {
  const edge = HALF - EDGE;
  const bound = (site.reach ?? HALF) + 40;
  return (x, z, row) => {
    if (Math.abs(x) > edge || Math.abs(z) > edge || Math.hypot(x, z) > bound) return false;
    const pad = row.clear ?? 4;
    for (const v of avoid) if (Math.hypot(x - v.at[0], z - v.at[1]) < v.r + pad) return false;
    if (wade != null && heightAt(x, z) < wade + (row.above ?? 0.2)) return false;
    if (row.band === 'trees') return true;
    for (const v of clearings) if (Math.hypot(x - v.at[0], z - v.at[1]) < v.r + pad) return false;
    if (busy(x, z)) return false;
    for (const s of solids?.near(x, z, WALL) ?? []) if (pushOut(s, x, z, WALL)) return false;
    return true;
  };
}

// a row's kit and model, from its 'kit:<pack>/<Name>'
const refOf = (row) => {
  const [, pack, name] = /^kit:([^/]+)\/(.+)$/.exec(row.model) ?? [];
  return { pack, name };
};

export function shadeOf(rows, { level, seed, height, keep, half = HALF }) {
  const share = shareOf(level);
  const n = Math.ceil(half / SIZE.trees);
  const out = [];
  for (let tx = -n; tx < n; tx++)
    for (let tz = -n; tz < n; tz++)
      for (const it of coverTile(rows, tx, tz, { size: SIZE.trees, seed: seed + SEEDS.trees, height, keep, share })) {
        const canopy = rows[it.row].canopy;
        if (canopy) out.push({ at: [it.x, it.z], r: canopy * it.scale });
      }
  return out;
}

export function createLiving({ rows, kitFor, level = 'high', seed = 1, height, keep, cover = null, solids = null }) {
  const reach = reachOf(level);
  const share = shareOf(level);
  const refs = Object.fromEntries(BANDS.map((b) => [b, (rows[b] ?? []).map(refOf)]));
  // (each model's pool drawn to its band's reach, shrinking away at its end)
  const bandOf = new Map(BANDS.flatMap((b) => refs[b].map((r) => [`${r.pack}|${r.name}`, b])));
  const poolOptions = (model, pack) => {
    const band = bandOf.get(`${pack}|${model}`) ?? 'cover';
    return { reach: reach[band], dissolve: DISSOLVE[band] };
  };
  const scatter = createKitScatter({ kitFor: (tint, pack) => kitFor(pack ?? 'naturemega'), tier: level, name: 'galaxy:living', poolOptions });
  const tiles = new Map(); // key → { band, tx, tz, trunks }
  let queue = []; // [band, tx, tz, d], nearest first
  let last = null; // where the ring was last looked at
  const keyOf = (band, tx, tz) => `${band}:${tx},${tz}`;

  const lay = (band, tx, tz) => {
    const key = keyOf(band, tx, tz);
    const was = tiles.get(key);
    for (const s of was?.trunks ?? []) solids?.remove(s);
    const items = coverTile(rows[band], tx, tz, { size: SIZE[band], seed: seed + SEEDS[band], height, keep, cover, share });
    const trunks = [];
    const list = items.map((it) => {
      const row = rows[band][it.row];
      if (solids && row.solid) trunks.push(solids.circle(it.x, it.z, row.solid * it.scale));
      const { pack, name } = refs[band][it.row];
      return { model: name, pack, x: it.x, y: it.y, z: it.z, yaw: it.yaw, scale: it.scale };
    });
    tiles.set(key, { band, tx, tz, trunks });
    scatter.set(key, list);
  };
  const drop = (key) => {
    for (const s of tiles.get(key)?.trunks ?? []) solids?.remove(s);
    tiles.delete(key);
    scatter.free(key);
  };
  // the ring round (x, z): tiles past a band's reach (and a tile's slack) go,
  // new ones within it queue, nearest first
  const look = (x, z) => {
    last = { x, z };
    const want = [];
    for (const band of BANDS) {
      if (!rows[band]?.length) continue;
      const size = SIZE[band];
      for (const [key, t] of tiles) {
        if (t.band !== band) continue;
        const nx = Math.max(t.tx * size, Math.min(x, (t.tx + 1) * size));
        const nz = Math.max(t.tz * size, Math.min(z, (t.tz + 1) * size));
        if (Math.hypot(nx - x, nz - z) > reach[band] + size) drop(key);
      }
      for (const [tx, tz, d] of tilesAround(x, z, reach[band], size)) if (!tiles.has(keyOf(band, tx, tz))) want.push([band, tx, tz, d]);
    }
    queue = want.sort((a, b) => a[3] - b[3]);
  };

  return {
    group: scatter.group,
    update(x, z, camera, dt) {
      if (!last || Math.hypot(x - last.x, z - last.z) > STEP) look(x, z);
      const t0 = performance.now();
      // (the tiles under you and beside you at once, after a jump; the rest a few a frame)
      while (queue.length && (queue[0][3] < UNDER || performance.now() - t0 < SPEND)) {
        const [band, tx, tz] = queue.shift();
        if (!tiles.has(keyOf(band, tx, tz))) lay(band, tx, tz);
      }
      scatter.update(camera, dt);
    },
    fill(x, z) {
      look(x, z);
      for (const [band, tx, tz] of queue) lay(band, tx, tz);
      queue = [];
    },
    refresh() {
      for (const t of [...tiles.values()]) lay(t.band, t.tx, t.tz);
    },
    // (every model laid so far drawn)
    get ready() {
      return scatter.ready;
    },
    get stats() {
      return { tiles: tiles.size, queued: queue.length, ...scatter.stats };
    },
    dispose() {
      for (const key of [...tiles.keys()]) drop(key);
      scatter.dispose();
    },
  };
}
