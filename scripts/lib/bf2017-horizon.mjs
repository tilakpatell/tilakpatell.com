// The coarse horizon grid (the GPU-first design's lane N4, World Partition's
// second grid): a level pack's instances regrouped into 512 m cells, each
// cell one merged proxy of its things' last LODs, and the kit's repeated
// props drawn as octahedral impostors instead. The grid downloads before
// anything else, so the horizon is whole in the first seconds and the fine
// path (the far table and its LOD files) sharpens it. Pure: the CLI
// (scripts/bf2017-horizon.mjs) fetches the meshes, merges and writes.
//
//   impostorsOf(pack, opts) → mesh indices drawn as impostors (by count and size)
//   horizonCells(pack, { horizon }, opts) → { key: { proxies, impostors, tris, ratio, bytes, count } }
//     (ratio: what the merged proxy is simplified by, to CELL_TRIS)
//   coarseKey(x, z, cell), lastFile(mesh) → its last shipped LOD file
//
// The far table's draws carry each instance's 128 m cell (`cells`), so the
// arena is grouped from level.json alone; the horizon's few instances (no
// cells) are placed from horizon.bin, read by the caller.

import { CELL, cellKey, readInstances } from '../../src/lib/level/instances.js';

// _source: the design's §4 N4 ("a 512 m grid", World Partition's HLOD grid
// over 128 m cells: four fine cells a side) and its "under 400 KB a cell"
export const COARSE = 512;
export const CELL_KB = 400;

// What a cell's proxy keeps: things whose biggest side reads at the grid's
// distance. _source: at 1080p and a 60° field a pixel 512 m off is 0.55 m
// (2 × 512 × tan 30° ÷ 1,080), so a 1.5 m radius is five pixels across;
// smaller things (Hoth's floorboards, flasks, crates) are the fine path's.
export const PROXY_MIN_RADIUS = 1.5;

// A merged, meshopt-compressed proxy's bytes a triangle: measured on Hoth's
// first build (positions quantised to 14 bits, normals 8, the UVs left as
// floats since many run outside 0 to 1; 3,110,912 bytes over 278,130
// triangles in its 65 cells). _source: docs/superpowers/evidence/gpu-first/n4/README.md
export const BYTES_PER_TRI = 11;

// An impostor's instance in the cell: position, a yaw and a size (16 bytes),
// written into index.json beside the proxy. _source: the record's layout below.
export const IMPOSTOR_BYTES = 16;

// Which meshes the grid draws as impostors rather than merged geometry: the
// kit's repeated, compact props, where a camera-facing card of baked views
// saves the most triangles. _source: agargaro's forest (the research note:
// impostors for repeated trees and rocks beyond 15–100 units), held to a
// few atlases a level since each is a 2,048² map (the boot slice's bytes).
// (and only a mesh of 100 triangles or more at its last LOD: a card is two,
// and a flat board of 32 gains nothing by one)
export const IMPOSTOR = Object.freeze({
  count: 40,
  tris: 20000,
  lastTris: 100,
  minR: 1,
  maxR: 8,
  most: 4,
});

// A cell's proxy is simplified to this many triangles at most (HLOD's
// "Simplified" proxy: merged, then cut). _source: the low row's 0.8M
// triangles (src/lib/budgets.js): Hoth's 16 arena cells at 12,000 are
// 192,000, a quarter of it, while the coarse and the fine both draw at the
// swap; at BYTES_PER_TRI that is 72 KB a cell, well under CELL_KB.
export const CELL_TRIS = 12000;

// The small tiers' cut of a cell (`.lo`, as a model's light cut is named:
// src/lib/budgets.js's `cut`), a third of it. _source: low's boot slice
// (3 MB, the design's §4 N4) less the far list and the near cells: Hoth's
// grid at 12,000 a cell is 3.1 MB, at 4,000 about a megabyte.
export const CELL_TRIS_LO = 4000;
// which tiers draw the light cut _source: the budget rows' own (low and mid swap a kit model to its LOD1)
export const LO_TIERS = Object.freeze(['low', 'mid']);

export const coarseKey = (x, z, cell = COARSE) => cellKey(Math.floor(x / cell), Math.floor(z / cell));

// a mesh's coarsest shipped file and its triangles (null: none shipped)
export function lastFile(mesh) {
  for (let k = (mesh?.glb?.length ?? 0) - 1; k >= 0; k--) if (mesh.glb[k]) return { glb: mesh.glb[k], lod: k, tris: mesh.lods?.[k] ?? 0 };
  return null;
}

const countsOf = (pack) => {
  const n = new Map();
  for (const d of [...(pack.far?.draws ?? []), ...(pack.horizon?.draws ?? [])]) n.set(d.mesh, (n.get(d.mesh) ?? 0) + d.count);
  return n;
};

export function impostorsOf(pack, opts = {}) {
  const o = { ...IMPOSTOR, ...opts };
  const out = [];
  for (const [mesh, count] of countsOf(pack)) {
    const m = pack.meshes[mesh];
    const f = lastFile(m);
    if (!f || count < o.count || f.tris < o.lastTris || count * f.tris < o.tris) continue;
    if (!(m.radius >= o.minR && m.radius <= o.maxR)) continue;
    out.push({ mesh, weight: count * f.tris });
  }
  return out
    .sort((a, b) => b.weight - a.weight || a.mesh - b.mesh)
    .slice(0, o.most)
    .map((e) => e.mesh);
}

// The arena's instances by coarse cell, from the draws' fine cells (a
// 128 m cell lies in one 512 m cell: 512 is a whole number of them)
function arenaRefs(pack, fine, cell) {
  const k = cell / fine;
  const out = [];
  for (const d of pack.far?.draws ?? []) {
    for (const [key, [first, count]] of Object.entries(d.cells ?? {})) {
      const [cx, cz] = key.split(',').map(Number);
      const coarse = cellKey(Math.floor(cx / k), Math.floor(cz / k));
      for (let i = first; i < first + count; i++)
        out.push({
          table: 'far',
          index: d.offset + i,
          mesh: d.mesh,
          mirrored: d.mirrored,
          key: coarse,
        });
    }
  }
  return out;
}

function horizonRefs(pack, inst, cell) {
  if (!inst) return [];
  const out = [];
  for (const d of pack.horizon?.draws ?? []) {
    for (let i = d.offset; i < d.offset + d.count; i++)
      out.push({
        table: 'horizon',
        index: i,
        mesh: d.mesh,
        mirrored: d.mirrored,
        key: coarseKey(inst.position[i * 3], inst.position[i * 3 + 2], cell),
      });
  }
  return out;
}

export function horizonCells(pack, { horizon = null } = {}, { cell = COARSE, kb = CELL_KB, cellTris = CELL_TRIS, minRadius = PROXY_MIN_RADIUS, bytesPerTri = BYTES_PER_TRI, impostors = impostorsOf(pack) } = {}) {
  const fine = pack.cell ?? CELL;
  if (cell % fine) throw new Error(`horizonCells: a ${cell} m cell is not whole ${fine} m cells`);
  const inst = horizon && !(horizon.position instanceof Float32Array) ? readInstances(horizon) : horizon;
  const imp = new Set(impostors);
  const dropped = new Set(pack.cull?.high?.dropped ?? []);
  const cells = {};
  for (const ref of [...arenaRefs(pack, fine, cell), ...horizonRefs(pack, inst, cell)]) {
    if (dropped.has(ref.mesh)) continue;
    const mesh = pack.meshes[ref.mesh];
    const f = lastFile(mesh);
    if (!f) continue;
    const c = (cells[ref.key] ??= {
      proxies: [],
      impostors: [],
      bytes: 0,
      count: 0,
    });
    if (imp.has(ref.mesh)) c.impostors.push(ref);
    else if ((mesh.radius ?? 0) >= minRadius) c.proxies.push({ ...ref, glb: f.glb, tris: f.tris, r: mesh.radius });
  }
  const cap = kb * 1000;
  for (const [key, c] of Object.entries(cells)) {
    // (over the cap: the smallest things go first, to the fine path)
    c.proxies.sort((a, b) => b.r - a.r || a.mesh - b.mesh || a.index - b.index);
    // (the impostors' records first, a few bytes each, then the proxies,
    // their merge simplified to cellTris; past the cap even so, the
    // smallest things go to the fine path)
    c.impostors = c.impostors.slice(0, Math.floor(cap / IMPOSTOR_BYTES));
    const fixed = c.impostors.length * IMPOSTOR_BYTES;
    const sum = c.proxies.reduce((s, p) => s + p.tris, 0);
    const ratio = sum > cellTris ? cellTris / sum : 1;
    let bytes = fixed;
    const kept = [];
    for (const p of c.proxies) {
      const add = p.tris * ratio * bytesPerTri;
      if (bytes + add > cap) continue;
      bytes += add;
      kept.push(p);
    }
    c.tris = Math.round(kept.reduce((s, p) => s + p.tris, 0) * ratio);
    c.ratio = ratio;
    c.proxies = kept;
    c.bytes = Math.round(bytes);
    c.count = kept.length + c.impostors.length;
    if (!c.count) delete cells[key];
  }
  return cells;
}
