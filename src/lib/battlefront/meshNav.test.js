import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import hoth from '../../data/bf2017/maps/hoth.json';
import { load } from './navmesh.js';
import { canUse } from './gates.js';
import { LIFT, attachMesh, doorway, gateStand, meshMove, meshNearest, meshPath, meshStand } from './meshNav.js';
import { lineClear } from './nav.js';

// (Hoth's playthrough mesh alone, cut from the bucket's navmesh.bin: scripts/bf2017-navmesh-cut.mjs)
const BIN = join(import.meta.dirname, '../../../scripts/fixtures/bf2017/navmesh/hoth-playthrough.bin');
const bytes = readFileSync(BIN);
// (a grid with no ground anywhere: the feet are the mesh's, less its lift, or the floor probe's)
const grid = () => ({ cols: 1, rows: 1, origin: [-1e6, -1e6], cell: 2e6, height: new Float32Array([-1000]) });
const navOf = (opts) => attachMesh(grid(), load(bytes, { mesh: 'playthrough' }), opts);
const soldier = (at) => ({ alive: true, at: [...at], vel: [0, 0, 0], moving: false });
const WEST = hoth.rows.gates.find((g) => g.id === 'FantasyBattle_Logic:91');

describe('the soldiers on Hoth’s navmesh', () => {
  it('walks the fuel room’s floor, under the mountain', () => {
    const nav = navOf();
    const s = soldier([209, 359.2, -1755]);
    let moved = 0;
    for (let i = 0; i < 20; i++) moved += meshMove(s, [0, -1], 1 / 20, nav, 3.8);
    // (2.3 m south to the room's wall, then held by it)
    expect(moved).toBeGreaterThan(2);
    expect(moved).toBeLessThan(3);
    expect(s.at[2]).toBeLessThan(-1757);
    // (the floor's height: the mesh's, less its lift, never the snow 77 m up)
    expect(s.at[1]).toBeGreaterThan(358.8);
    expect(s.at[1]).toBeLessThan(360);
  });

  it('takes the floor probe where it has one, the level’s own shapes', () => {
    const nav = navOf({ floor: () => 359.15 });
    const s = soldier([209, 359.2, -1755]);
    meshMove(s, [0, -1], 0.1, nav, 3.8);
    expect(s.at[1]).toBeCloseTo(359.15, 5);
  });

  it('stays on the mesh walking into a wall: it slides, it does not pass', () => {
    const nav = navOf();
    const s = soldier([209, 359.2, -1755]);
    for (let i = 0; i < 400; i++) meshMove(s, [1, 0.2], 1 / 20, nav, 3.8);
    const p = nav.mesh.toPack(s.at);
    expect(nav.mesh.locate(p[0], p[1] + LIFT, p[2], { above: 1.2, below: 1.5 })).toBeGreaterThanOrEqual(0);
  });

  it('is off the mesh nowhere near it: the grid’s step then', () => {
    expect(meshMove(soldier([5000, 0, 5000]), [1, 0], 0.1, navOf(), 3.8)).toBeNull();
  });

  it('stands a deploy on its own floor: a hangar’s, not the snow over it', () => {
    const at = meshStand(navOf(), [215, 359.2, -1650]);
    expect(at[1]).toBeGreaterThan(358.5);
    expect(at[1]).toBeLessThan(360);
  });

  it('finds no way into the base with its gates shut, and one by the west mouth once that gate opens', () => {
    const nav = navOf();
    expect(meshPath(nav, [47, -1000], [209, -1755], { fromY: 313.2, toY: 359.2 })).toBeNull();
    expect(doorway(nav, WEST)).toBeGreaterThanOrEqual(0);
    const path = meshPath(nav, [47, -1000], [209, -1755], { fromY: 313.2, toY: 359.2 });
    expect(path).toBeTruthy();
    expect(path.some(([x, z]) => x > 160 && x < 200 && z < -1555 && z > -1585)).toBe(true);
  });

  it('a goal without a height is on the floor nearest the walker’s own', () => {
    const nav = navOf();
    doorway(nav, WEST);
    // (from the west mouth at 357 m to the fuel room: under the mountain, not over it)
    const path = meshPath(nav, [178, -1545], [209, -1755], { fromY: 357 });
    expect(path).toBeTruthy();
    expect(meshNearest(nav, 209, -1755, 4, 359.2)).toEqual([expect.closeTo(209, 0), expect.closeTo(-1755, 0)]);
  });

  it('a goal on the ground 45 m up the field’s slope from the walker is on the floor it can reach, not in the air at its own height', () => {
    const nav = navOf();
    // (from the trench's end at 316 m to the west door's jamb at 359 m, a heightless goal: the commander's)
    const path = meshPath(nav, [25, -1091], [187.4, -1568.6], { fromY: 316 });
    expect(path?.length).toBeGreaterThan(20);
    expect(path.at(-1)).toEqual([expect.closeTo(187.4, 0), expect.closeTo(-1568.6, 0)]);
  });

  it('stands a gate’s holder on the field by the door’s jamb, the panel in reach, a way to it from the walkers’ start', () => {
    const nav = navOf();
    for (const g of hoth.rows.gates) {
      const at = gateStand(nav, g);
      expect(at).toBeTruthy();
      expect(canUse(g, at)).toBe(true);
      // (the field's side of the gate's line, not the base's floor behind the panel)
      expect(at[2]).toBeGreaterThan(g.at[2]);
      expect(meshPath(nav, [47, -1000], [at[0], at[2]], { fromY: 313.2, toY: at[1] })).toBeTruthy();
    }
    expect(gateStand(nav, WEST)).toEqual([expect.closeTo(187.4, 0), expect.anything(), expect.closeTo(-1568.6, 0)]);
  });

  it('walks a way through the west gate once it opens: over the doorway’s link, off the mesh’s walls, into the hangar', () => {
    const nav = navOf();
    doorway(nav, WEST);
    const path = meshPath(nav, [179.2, -1560], [179.2, -1593.2], { fromY: 359.2 });
    expect(path).toBeTruthy();
    const s = soldier([179.2, 359.2, -1560]);
    let wp = 1;
    for (let i = 0; i < 400 && wp < path.length; i++) {
      const p = path[wp];
      if (Math.hypot(s.at[0] - p[0], s.at[2] - p[1]) < 0.6) {
        wp++;
        continue;
      }
      meshMove(s, [p[0] - s.at[0], p[1] - s.at[2]], 1 / 20, nav, 3.8);
    }
    // (in the hangar behind the gate, on its floor)
    expect(s.at[2]).toBeLessThan(-1590);
    expect(s.at[1]).toBeGreaterThan(358.5);
    expect(s.at[1]).toBeLessThan(360);
    expect(s.link ?? null).toBeNull();
  });
  it('lands a walker over the east gate’s doorway on the base’s floor: the link’s inner end, 5 cm off it, snapped to the mesh', () => {
    const nav = navOf();
    const EAST = hoth.rows.gates.find((g) => g.id === 'FantasyBattle_Logic:307');
    doorway(nav, EAST);
    const path = meshPath(nav, [250.88, -1578], [252.9, -1600], { fromY: 359.2 });
    expect(path).toBeTruthy();
    const s = soldier([250.88, 359.2, -1578]);
    let wp = 1;
    for (let i = 0; i < 400 && wp < path.length; i++) {
      const p = path[wp];
      if (Math.hypot(s.at[0] - p[0], s.at[2] - p[1]) < 0.6) {
        wp++;
        continue;
      }
      expect(meshMove(s, [p[0] - s.at[0], p[1] - s.at[2]], 1 / 20, nav, 3.8)).not.toBeNull();
    }
    expect(s.at[2]).toBeLessThan(-1598);
    expect(s.link ?? null).toBeNull();
  });

  it('sees across Echo Base under the mountain where the mesh certifies the air, and not through what it leaves out', () => {
    // (a 2 m grid whose ground is the snow over the fuel rooms, 435 m, as the page's terrain is)
    const snow = () => ({ cols: 120, rows: 160, origin: [100, -1850], cell: 2, height: new Float32Array(120 * 160).fill(435), near: new Map() });
    const nav = attachMesh(snow(), load(bytes, { mesh: 'playthrough' }));
    expect(nav.mesh.height).toBeCloseTo(1.8, 5);
    const at = (x, z) => meshStand(nav, [x, 359.2, z], 3);
    const eye = (p) => [p[0], p[1] + 1.6, p[2]];
    const chest = (p) => [p[0], p[1] + 1.2, p[2]];
    const depot = at(208.75, -1761.88);
    // (the depot's keypad's stand and a soldier 4 m off it in the room; the hangar from side to side)
    expect(lineClear(nav, eye(depot), chest(at(205, -1760)))).toBe(true);
    expect(lineClear(nav, eye(at(215, -1650)), chest(at(240, -1650)))).toBe(true);
    expect(lineClear(snow(), eye(depot), chest(at(205, -1760)))).toBe(false);
    // (through the rock to the next fuel room, and up past the agent's 1.8 m: shut)
    expect(lineClear(nav, eye(depot), chest(at(143, -1771)))).toBe(false);
    expect(nav.open(depot[0], depot[1] + 1.2, depot[2])).toBe(true);
    expect(nav.open(depot[0], depot[1] + 3, depot[2])).toBe(false);
  });
});
