// A whole level's navgrid and frame check (lane G2), run by
// scripts/bf2017-level.mjs --whole after the pack and its physics are
// written: the cells and the shapes read back from the pack, lane 1's grid
// built over its ground and its pieces' collision (scripts/lib/bf2017-nav.mjs),
// written as nav.bin with level.json's `nav`; then the rulebook's spawns
// (the map's gameplay records, as scripts/lib/bf2017-rulebook-map.mjs reads
// them) are held to the pack: each should stand within 2 m of a surface the
// pack has under it (the ground, a floor, a piece's top), which it does
// only if the pack is in the map's own frame. Both go into the README.
//
//   writeWholeNav({ out, cache, mapName, layer, extent, log }) → { nav, check }
//   node scripts/bf2017-level-nav.mjs <world>/game/<key> <map>: again, on a pack already built
//   frameCheck(spawns, { groundAt, boxes, floors, reach = 2 }) → { total, near, byMode, worst, marks } (pure)
//   navPicture(nav, marks) → { data, w, h }: the grid seen from above (pure): open ground grey by
//     height, a solid's cells red, too steep dark, cover slots yellow, each spawn a green dot (on
//     the pack's surfaces) or a magenta one (off them); written to
//     docs/superpowers/evidence/bfg-levels/<key>/nav.png

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYERS, imageLayerFrom } from '../src/lib/land/layers.js';
import { decodePng16 } from '../src/lib/level/png16.js';
import { toBin } from '../src/lib/battlefront/nav.js';
import { shapeReader } from '../src/lib/level/shapeSolids.js';
import { mapRow } from './lib/bf2017-rulebook-map.mjs';
import { floorHeight, levelSolids, navBounds, navOf } from './lib/bf2017-nav.mjs';
import { encodePngRgb } from './lib/png16.mjs';

const lastOf = (p) => String(p).split('/').pop();
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

// (a point inside a box or plate turned by yaw, as three turns a thing about y)
const over = (b, x, z) => {
  const c = Math.cos(b.yaw ?? 0);
  const s = Math.sin(b.yaw ?? 0);
  const dx = x - b.x;
  const dz = z - b.z;
  return Math.abs(dx * c - dz * s) <= b.hw && Math.abs(dx * s + dz * c) <= b.hd;
};

export function frameCheck(spawns, { groundAt = null, boxes = [], floors = [], reach = 2 }) {
  const byMode = {};
  let near = 0;
  let total = 0;
  const worst = [];
  const marks = [];
  for (const s of spawns) {
    if (!Array.isArray(s.at) || s.at.length < 3) continue;
    const [x, y, z] = s.at;
    const tops = [];
    const g = groundAt?.(x, z);
    if (Number.isFinite(g)) tops.push(g);
    for (const f of floors) if (over(f, x, z)) tops.push(f.y);
    for (const b of boxes) if (over(b, x, z)) tops.push(b.top);
    const d = tops.length ? Math.min(...tops.map((t) => Math.abs(y - t))) : Infinity;
    const m = (byMode[s.mode ?? 'none'] ??= { total: 0, near: 0 });
    m.total++;
    total++;
    marks.push({ x, z, ok: d <= reach });
    if (d <= reach) {
      m.near++;
      near++;
    } else worst.push({ id: s.id, d: Math.round(d * 10) / 10 });
  }
  worst.sort((a, b) => b.d - a.d);
  return { total, near, byMode, worst: worst.slice(0, 5), marks };
}

export function navPicture(nav, marks = []) {
  const { cols: w, rows: h } = nav;
  const data = new Uint8Array(w * h * 3);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < w * h; i++)
    if (nav.walk[i] && nav.height[i] > -999) {
      lo = Math.min(lo, nav.height[i]);
      hi = Math.max(hi, nav.height[i]);
    }
  const put = (c, r, rgb) => {
    if (c < 0 || r < 0 || c >= w || r >= h) return;
    // (north up: the grid's last row is the picture's first)
    data.set(rgb, ((h - 1 - r) * w + c) * 3);
  };
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const g = hi > lo ? Math.round(70 + (150 * (nav.height[i] - lo)) / (hi - lo)) : 140;
      put(c, r, nav.solid[i] ? [170, 40, 40] : nav.walk[i] ? [g, g, g] : [25, 25, 30]);
    }
  const cellOf = (x, z) => [Math.floor((x - nav.origin[0]) / nav.cell), Math.floor((z - nav.origin[1]) / nav.cell)];
  for (const s of nav.slots) put(...cellOf(s.at[0], s.at[2]), [235, 200, 40]);
  for (const m of marks) {
    const [c, r] = cellOf(m.x, m.z);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) put(c + dc, r + dr, m.ok ? [40, 210, 80] : [230, 40, 220]);
  }
  return { data, w, h };
}

export async function writeWholeNav({ out, cache, mapName, layer = null, extent, log = console.log }) {
  const json = JSON.parse(await readFile(join(out, 'level.json'), 'utf8'));
  const cells = new Map();
  for (const [key, c] of Object.entries(json.cells)) {
    const b = await readFile(join(out, c.bin));
    cells.set(key, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  const read = shapeReader(json, async (file) => {
    const b = await readFile(join(out, file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  });
  const shapes = Object.fromEntries(await Promise.all(Object.keys(json.physics?.meshes ?? {}).map(async (m) => [m, await read(m)])));
  const { boxes, floors } = levelSolids(json, cells, shapes);
  // (the ground: the pack's heightmaps; a level with none stands on its floors)
  const groundAt = layer ? (x, z) => LAYERS.image(x, z, layer) : floorHeight(floors);
  let rows = null;
  try {
    rows = mapRow(cache, lastOf(mapName));
  } catch (e) {
    log(`no gameplay records for ${mapName} (${e.message}): the nav covers the pieces' extent, no frame check`);
  }
  const bounds = navBounds(rows, extent);
  const ai = JSON.parse(await readFile(join(import.meta.dirname, '..', 'src', 'data', 'bf2017', 'ai.json'), 'utf8'));
  const nav = navOf({ heightAt: groundAt, bounds, boxes, cover: ai.rows.cover?.constants ?? {} });
  const bin = Buffer.from(toBin(nav));
  await writeFile(join(out, 'nav.bin'), bin);
  let open = 0;
  let blocked = 0;
  for (let i = 0; i < nav.walk.length; i++) {
    if (nav.solid[i]) blocked++;
    else if (nav.walk[i]) open++;
  }
  json.nav = { file: 'nav.bin', cell: nav.cell, w: nav.cols, h: nav.rows, origin: nav.origin, bytes: bin.length, open, blocked, solids: nav.boxes.length, slots: nav.slots.length, bounds: rows?.bounds ? 'the gameplay records' : 'the pieces' };
  const check = rows ? frameCheck([...(rows.spawns ?? [])], { groundAt, boxes, floors }) : null;
  json.frame = check ? { spawns: check.total, within2m: check.near } : null;
  await writeFile(join(out, 'level.json'), `${JSON.stringify(json)}\n`);
  // (the grid from above, the spawns on it: the frame seen)
  const pic = navPicture(nav, check?.marks ?? []);
  const shots = join(import.meta.dirname, '..', 'docs', 'superpowers', 'evidence', 'bfg-levels', lastOf(out));
  await mkdir(shots, { recursive: true });
  await writeFile(join(shots, 'nav.png'), encodePngRgb(pic.data, pic.w, pic.h));
  const lines = [
    '',
    '## The navgrid and the frame check (lane G2)',
    '',
    `- nav.bin: ${nav.cols} × ${nav.rows} cells of ${nav.cell} m over ${json.nav.bounds} (${bounds.min.join(', ')} to ${bounds.max.join(', ')}), ${open} open, ${blocked} blocked by ${nav.boxes.length} solids, ${nav.slots.length} cover slots, ${mb(bin.length)}`,
    check
      ? `- the frame: ${check.near} of ${check.total} spawns stand within 2 m of the pack's ground, a floor or a piece's top (${Object.entries(check.byMode)
          .map(([m, v]) => `${m} ${v.near}/${v.total}`)
          .join(', ')})${check.worst.length ? `; the farthest: ${check.worst.map((w) => `${w.id} ${w.d} m`).join(', ')}` : ''}`
      : '- the frame: no gameplay records to check against',
    '',
  ];
  const readme = await readFile(join(out, 'README.md'), 'utf8');
  const head = readme.split('\n## The navgrid and the frame check')[0].replace(/\n*$/, '\n');
  await writeFile(join(out, 'README.md'), `${head}${lines.join('\n')}`);
  for (const l of lines.slice(3)) if (l) log(l);
  return { nav: json.nav, check };
}

// Alone, on a pack already built (the nav and the check again, nothing else):
//   node scripts/bf2017-level-nav.mjs <world>/game/<key> <map>
async function cli([packId, mapName]) {
  const ROOT = join(import.meta.dirname, '..');
  const out = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'levels', ...String(packId).split('/'));
  const json = JSON.parse(await readFile(join(out, 'level.json'), 'utf8'));
  let layer = null;
  if (json.terrain) {
    const [near, far] = await Promise.all([decodePng16(await readFile(join(out, json.terrain.near.png))), decodePng16(await readFile(join(out, json.terrain.far.png)))]);
    const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
    layer = imageLayerFrom({ heightScale: json.terrain.scale, heightOffset: json.terrain.offset, holePixels: json.terrain.hole === null ? 0 : 1 }, frame(json.terrain.near, near), frame(json.terrain.far, far));
  }
  const ex = json.extent ?? { min: [-json.arena, -json.arena], max: [json.arena, json.arena] };
  await writeWholeNav({ out, cache: join(ROOT, 'lab', 'assets', 'bf2017'), mapName, layer, extent: ex });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 4) {
    console.error('usage: node scripts/bf2017-level-nav.mjs <world>/game/<key> <map>');
    process.exit(1);
  }
  await cli(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
