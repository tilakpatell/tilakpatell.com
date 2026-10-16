// The line of fire's fixture from a level pack (src/lib/battlefront/fixtures/
// hothGround.js reads it): the page's navgrid over a rectangle of the map
// (battle.js's createBattle: the pack's heights at each cell's middle, its
// nav.bin), and for seeded pairs of standing places there what a ray cast
// says on the game's own shapes (the pack's physics, as bf2017-nav.mjs loads
// them for the mask) and its heightmap at its own metre, each end seated on
// that heightmap at the chest's height. The navgrid stands in for nothing in
// the answers: they are what the level itself leaves clear.
//
//   groundFixture({ load, dir, map, area, pairs }) → { json, stats }
//     load   Vite's ssrLoadModule (the physics engine comes up through the site's own shim)
//     dir    the pack: level.json, terrain/*.png, nav.bin, physics/*.bin, cells/*.bin
//     area   [x0, z0, x1, z1] in the export's frame, grown to whole cells
//     pairs  { seed, count, near, far }

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { join } from 'node:path';

const hashOf = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
// m the heightmap is marched at, and under it a line is in the ground (nav.js's own 0.05)
const MARCH = 0.25;
const SLACK = 0.05;

export async function groundFixture({ load, dir, map = 'hoth', area, pairs }) {
  const { buildNav } = await load('/src/lib/battlefront/nav.js');
  const { decodeMask } = await load('/src/lib/battlefront/navMask.js');
  const { decodePng16 } = await load('/src/lib/level/png16.js');
  const { LAYERS, imageLayerFrom } = await load('/src/lib/land/layers.js');
  const { loadBodies } = await load('/scripts/lib/bf2017-nav.mjs');
  const { createPhysics } = await load('/src/lib/physics/world.js');
  const { navOf, pack: packBytes, pairsOf } = await load('/src/lib/battlefront/fixtures/hothGround.js');
  const { chestOf } = await load('/src/lib/battlefront/soldier.js');

  const read = (file) => readFile(join(dir, file));
  const packJson = await read('level.json');
  const pack = JSON.parse(packJson.toString('utf8'));
  const rows = JSON.parse(await readFile(new URL(`../../src/data/bf2017/maps/${map}.json`, import.meta.url), 'utf8')).rows;
  const t = pack.terrain;
  const [nearBytes, farBytes, navBytes] = await Promise.all([read(t.near.png), read(t.far.png), read('nav.bin')]);
  const [near, far] = await Promise.all([decodePng16(nearBytes), decodePng16(farBytes)]);
  const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
  const layer = imageLayerFrom({ heightScale: t.scale, heightOffset: t.offset, holePixels: t.hole === null ? 0 : 1 }, frame(t.near, near), frame(t.far, far));
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  // the ground as the world reads it (map/level.js's heightAt)
  const ground = (x, z) => LAYERS.image((x - ox) * c + (z - oz) * s, -(x - ox) * s + (z - oz) * c, layer) + oy;

  // the page's grid, whole, then the rectangle's cells of it
  const whole = decodeMask(inflateSync(navBytes));
  const full = buildNav({ heightAt: ground, bounds: { min: rows.bounds.min, max: rows.bounds.max }, cell: whole.cell, mask: whole });
  if (!full.mask) throw new Error('the pack’s nav.bin is not this map’s grid');
  const cell = full.cell;
  const c0 = Math.max(0, Math.floor((area[0] - full.origin[0]) / cell));
  const r0 = Math.max(0, Math.floor((area[1] - full.origin[1]) / cell));
  const c1 = Math.min(full.cols, Math.ceil((area[2] - full.origin[0]) / cell));
  const r1 = Math.min(full.rows, Math.ceil((area[3] - full.origin[1]) / cell));
  const cols = c1 - c0;
  const nrows = r1 - r0;
  const origin = [full.origin[0] + c0 * cell, full.origin[1] + r0 * cell];
  const heights = new Float32Array(cols * nrows);
  const top = new Uint8Array(cols * nrows);
  for (let r = 0; r < nrows; r++)
    for (let k = 0; k < cols; k++) {
      heights[r * cols + k] = full.height[(r0 + r) * full.cols + c0 + k];
      top[r * cols + k] = whole.top[(r0 + r) * full.cols + c0 + k];
    }
  const f = whole.fine;
  const per = Math.round(cell / f.cell);
  const fine = { cell: f.cell, cols: cols * per, rows: nrows * per, bits: new Uint8Array(Math.ceil((cols * per * nrows * per) / 8)) };
  for (let r = 0; r < fine.rows; r++)
    for (let k = 0; k < fine.cols; k++) {
      const j = (r0 * per + r) * f.cols + c0 * per + k;
      if (!(f.bits[j >> 3] & (1 << (j & 7)))) continue;
      const i = r * fine.cols + k;
      fine.bits[i >> 3] |= 1 << (i & 7);
    }
  const mask = { version: whole.version, cell, cols, rows: nrows, origin, capsule: whole.capsule, meta: { ...whole.meta, cut: [c0, r0, cols, nrows] }, blocked: top.map((v) => (v ? 1 : 0)), top, fine };
  const { nav } = navOf({ mask, heights });

  // the game's shapes, and a segment against them and against the heightmap
  const physics = await createPhysics({ gravity: 0, onError: null });
  try {
    const { RAPIER, world } = physics;
    const loadBin = async (file) => {
      const b = await read(file);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    };
    const bodies = await loadBodies(physics, pack, loadBin);
    const toPack = (p) => ({ x: (p[0] - ox) * c + (p[2] - oz) * s, y: p[1] - oy, z: -(p[0] - ox) * s + (p[2] - oz) * c });
    const clearOf = (a, b) => {
      const p = toPack(a);
      const q = toPack(b);
      const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
      const L = Math.hypot(d.x, d.y, d.z);
      if (world.castRay(new RAPIER.Ray(p, { x: d.x / L, y: d.y / L, z: d.z / L }), L, true)) return false;
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / MARCH));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        if (a[1] + (b[1] - a[1]) * u < ground(a[0] + (b[0] - a[0]) * u, a[2] + (b[2] - a[2]) * u) - SLACK) return false;
      }
      return true;
    };
    const seat = (p) => chestOf({ at: [p[0], ground(p[0], p[2]), p[2]], stance: 'stand' });
    const list = pairsOf(nav, pairs);
    const clear = new Uint8Array(Math.ceil(list.length / 8));
    let open = 0;
    list.forEach(([a, b], i) => {
      if (!clearOf(seat(a), seat(b))) return;
      clear[i >> 3] |= 1 << (i & 7);
      open++;
    });
    const data = deflateSync(Buffer.from(packBytes({ mask, heights, clear })), { level: 9 });
    const json = {
      _source: `scripts/bf2017-nav-fixture.mjs <pack> --area ${area.join(',')}: the page's navgrid over those cells of ${pack.map}, and for each seeded pair (fixtures/hothGround.js's pairsOf) whether a ray cast on the pack's ${bodies.bodies} shapes and its heightmap leaves the line clear`,
      sources: {
        'level.json': { hash: hashOf(packJson), bytes: packJson.length },
        'nav.bin': { hash: hashOf(navBytes), bytes: navBytes.length },
        [t.near.png]: { hash: hashOf(nearBytes), bytes: nearBytes.length },
        [t.far.png]: { hash: hashOf(farBytes), bytes: farBytes.length },
        physics: { meshes: Object.keys(pack.physics?.meshes ?? {}).length, bodies: bodies.bodies, refused: bodies.refused },
      },
      cell,
      cols,
      rows: nrows,
      origin,
      pairs,
      data: data.toString('base64'),
    };
    return { json, stats: { cols, rows: nrows, pairs: list.length, clear: open, bytes: data.length, bodies: bodies.bodies } };
  } finally {
    physics.dispose();
  }
}
