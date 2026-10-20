// How much each quality level draws: one row a level, and every number a
// scene reads about *how much* (triangles, draw calls, props, grass, terrain,
// water, which cut of a made model, how far a kit model keeps its detail,
// how many leaves fall, how far a wood is drawn) comes from here through
// `budget(level)`.
// lib/device decides the level (Auto, or the visitor's pick in the settings
// panel); lib/detail still decides how *fine* (texture sizes, segments).
// Pure and free of three.js, so the QA scripts read the same table in Node
// (scripts/galaxy-check.mjs holds every world to its level's row).
//
//   level  triangles  calls  models MB  props  LOD1  grass  terrain  gen3d cut  water  boot MB  visit MB  near  mid  leaves  far
//   low    0.8M       350    20         0.5    yes   0.25   0.5      .lo        0.5    3        40        30    90   0       500
//   mid    1.5M       500    40         0.75   yes   0.5    0.75     (plain)    0.75   6        120       45    140  256     650
//   high   3M         700    60         1      yes   1      1        .hq        1      12       400       70    220  1024    900
//   ultra  none       1500   240        1.5    no    2      2        .ultra     2      12       1200      110   400  2048    1200
//
// Ultra has no triangle ceiling (Infinity) and keeps the full model at every
// distance (no LOD1 swap); its gate is the draw calls, the download and, on
// a real graphics chip, the frame time. The design:
// docs/superpowers/specs/2026-10-07-quality-modes-design.md §2.
//
// `bootMB` and `visitMB` are a level's bytes (lane N4, the stream that
// feels like one): what its boot slice may pull before the world is
// walkable (the coarse grid, your cell and its eight neighbours, every map
// at its first row), and the most a visit may pull before its finer rows
// and LODs wait (levelStream.js says it paused; a higher level raises it).
// _source: the GPU-first design's §4 N4 (under 12 MB on high, 6 on mid;
// low 3 by the same halving) and the research note's egress arithmetic
// (Supabase Pro's 250 GB cached a month: a 400 MB visit is 625 visits,
// 1,200 MB on ultra about 210). docs/superpowers/specs/2026-10-11-gpu-
// first-renderer-design.md.
//
// `near` and `mid` are a kit model's bands in metres (lib/three/kit's
// pools): its full mesh within `near`, its LOD1 to `mid`, its far stand-in
// (the puff) to twice `mid`, nothing beyond (ultra, with no LOD1, keeps the
// full mesh in the LOD1 band). `leaves` is how many leaves fall at once.
// `far` is how far a streamed wood's trees are drawn, as their far
// stand-ins (a galaxy world's living ground, galaxy/surface/living.js): to
// the edge of what you can see across a world, so no ring of trees is seen
// coming and going (docs/superpowers/specs/2026-10-20-galaxy-living-free-
// roam-design.md, 1).
// docs/superpowers/specs/2026-10-08-kit-worlds-design.md §2, §3.

export const COLUMNS = ['tris', 'calls', 'modelsMB', 'props', 'lod1', 'grass', 'terrain', 'cut', 'water', 'bootMB', 'visitMB', 'near', 'mid', 'leaves', 'far'];

const row = (tris, calls, modelsMB, props, lod1, grass, terrain, cut, water, bootMB, visitMB, near, mid, leaves, far) =>
  Object.freeze({ tris, calls, modelsMB, props, lod1, grass, terrain, cut, water, bootMB, visitMB, near, mid, leaves, far });

export const BUDGET_ROWS = Object.freeze({
  low: row(0.8e6, 350, 20, 0.5, true, 0.25, 0.5, '.lo', 0.5, 3, 40, 30, 90, 0, 500),
  mid: row(1.5e6, 500, 40, 0.75, true, 0.5, 0.75, '', 0.75, 6, 120, 45, 140, 256, 650),
  high: row(3e6, 700, 60, 1, true, 1, 1, '.hq', 1, 12, 400, 70, 220, 1024, 900),
  ultra: row(Infinity, 1500, 240, 1.5, false, 2, 2, '.ultra', 2, 12, 1200, 110, 400, 2048, 1200),
});

// A level's row; anything else (a typo, nothing) reads as high's.
export const budget = (level) => BUDGET_ROWS[level] ?? BUDGET_ROWS.high;
