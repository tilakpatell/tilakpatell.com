// The free roam with no edge (docs/superpowers/specs/2026-10-20-galaxy-
// living-free-roam-design.md, 3): on a world of its own ground, with no
// mission running, you can walk and ride on as far as you like. The ground's
// grid and its map lie round you and move with you: once you are MOVE metres
// from the grid's middle, a new grid round you is sampled a few rows a frame
// (terrain.js's gridBuild), the ground map painted round it the same way
// (groundmap's moveTo), and both are put in on one frame (`onMove`, the
// scene's: the mesh, the walker's ground, the ground look's square). Past the
// world's mountain ring the land breaks into ranges with lowlands between
// (layers.js's mountains `ranges`), so there is somewhere to go.
//
//   roamOn(site, mission) → whether the free roam has no edge here
//   roamGround(ground) → the site's ground with its rings breaking into ranges
//   areaAt([x, z]) → the ground map's square round (x, z)
//   createRoam({ height, grid, gridOpts, map, build, onGrid, onMove, spend }) →
//     (onGrid(next): the new grid sampled, before the map is painted from it;
//     build(next) → { step(ms) → done }: more made from it over frames, the
//     ground's mesh, handed to onMove(next, made) as the ground goes in)
//     { update(x, z, budget?) → whether the ground moved this frame, centre, moving,
//       stats: { moves, frames, swap: ms the last move's own frame took } }

import { HALF, gridBuild } from './terrain';

export const MOVE = 240; // metres from the grid's middle before a new one is begun (the fine square is ±640)
const SNAP = 16; // cells of the fine grid: a new middle on its lattice, so the fine ground's samples land where they were
const SPEND = 3; // ms a frame on the new ground, at most
const RANGES = 4200; // metres across a range and the lowland beside it

export const roamOn = (site, mission) => !mission && !site.level && !site.noGround;

export const roamGround = (ground) => ({ ...ground, layers: (ground.layers ?? []).map((l) => (l.type === 'mountains' && l.to !== undefined && !l.ranges ? { ...l, ranges: RANGES } : l)) });

export const areaAt = ([x, z]) => ({ x0: x - HALF, z0: z - HALF, w: 2 * HALF, d: 2 * HALF });

export function createRoam({ height, grid, gridOpts = {}, map = null, build = null, onGrid, onMove, spend = SPEND }) {
  let current = grid;
  let job = null;
  const stats = { moves: 0, frames: 0, swap: 0 };
  return {
    get centre() {
      return current.centre;
    },
    get moving() {
      return Boolean(job);
    },
    stats,
    // (`budget`: ms of work this frame; Infinity moves the ground at once, as
    // the shots' dev hook does under a software GL's few frames a second)
    update(x, z, budget = spend) {
      if (!job) {
        const [cx, cz] = current.centre;
        if (Math.hypot(x - cx, z - cz) < MOVE) return false;
        const snap = current.cell * SNAP;
        const centre = [Math.round(x / snap) * snap, Math.round(z / snap) * snap];
        if (centre[0] === cx && centre[1] === cz) return false;
        job = { centre, grid: gridBuild(height, { ...gridOpts, centre }), map: null, made: null, gridDone: false };
      }
      stats.frames++;
      // (the grid first, then what's built from it, then the map, a frame's
      // share each: the map's own swap and the grid's on one frame, the frame
      // the map's last rows go in)
      if (!job.gridDone) {
        job.gridDone = job.grid.step(budget);
        if (job.gridDone) {
          onGrid?.(job.grid.grid);
          job.map = map?.moveTo(areaAt(job.centre)) ?? null;
          job.made = build?.(job.grid.grid) ?? null;
        }
        return false;
      }
      if (job.made && !job.madeDone) {
        job.madeDone = job.made.step(budget);
        return false;
      }
      if (job.map && !job.map.step(budget)) return false;
      const made = job.made;
      current = job.grid.grid;
      job = null;
      stats.moves++;
      // (the frame the new ground goes in: its cost, the one hitch a move has)
      const t0 = performance.now();
      onMove?.(current, made);
      stats.swap = Math.round((performance.now() - t0) * 10) / 10;
      return true;
    },
  };
}
