import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cellAt, fromBin, toBin, walkable } from '../../src/lib/battlefront/nav.js';
import { arenaOf, buildPack, readMap } from './bf2017-level.mjs';
import { WHOLE_ROWS, wholeArena, wholeCull, wholeExtent } from './bf2017-level-whole.mjs';
import { floorHeight, levelSolids, navBounds, navOf } from './bf2017-nav.mjs';

const FIX = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'web');
const json = JSON.parse(readFileSync(join(FIX, 'maps', 'fixture_01', 'fixture_01.json'), 'utf8'));
const bin = readFileSync(join(FIX, 'maps', 'fixture_01', 'fixture_01.bin'));

// the fixture's three pieces, whole: a rock, a 40 m hangar, a crate
const meshes = [
  { name: 'rock', lods: [8], bounds: [-1, 0, -1, 1, 1, 1], mats: 1 },
  { name: 'hangar', lods: [900], bounds: [-5, 0, -5, 5, 10, 5], mats: 2 },
  { name: 'crate', lods: [12], bounds: [-0.5, 0, -0.5, 0.5, 1, 0.5], mats: 1 },
  { name: 'tauntaun', lods: [500], bounds: [-1, 0, -1, 1, 2, 1], mats: 1 },
  { name: 'proxy', lods: [10], bounds: [-2, 0, -2, 2, 1, 2], mats: 1 },
];
const map = readMap(json, bin);
const subs = ['fixture_01', 'content'];
const idx = arenaOf(map, { subs });
const extent = wholeExtent(map, idx, { trim: 0, pad: 30 });
const pack = buildPack({ world: 'f/game/f', mapName: 'm', map, spot: [0, 0], groundY: 0, meshes, arena: wholeArena(map, idx), rows: WHOLE_ROWS, subs, whole: { extent, cull: wholeCull(Object.keys(WHOLE_ROWS)), modeOnly: {} } });
const cells = new Map(Object.entries(pack.json.cells).map(([k, c]) => [k, pack.files.get(c.bin)]));

describe('the pack’s navgrid', () => {
  it('stands the pieces up as solids from their bounds where they have no game shapes', () => {
    const { boxes, floors } = levelSolids(pack.json, cells, {});
    // (the hangar's box, scaled twice, and the crate; the rock, a metre high and two wide, is a floor)
    expect(boxes.length).toBe(2);
    const hangar = boxes.find((b) => b.hw === 10);
    expect(hangar.top - hangar.base).toBeCloseTo(20, 3);
    expect(floors).toEqual([expect.objectContaining({ x: 110, z: 210, y: 6 })]);
  });

  it('blocks the cells a solid stands in and reads back from nav.bin as built', () => {
    const { boxes } = levelSolids(pack.json, cells, {});
    // (the fixture's ground is 5 m up: a solid blocks where it stands on the ground)
    const nav = navOf({ heightAt: () => 5, bounds: navBounds(null, extent), boxes });
    const hangar = boxes.find((b) => b.hw === 10);
    expect(walkable(nav, hangar.x, hangar.z)).toBe(false);
    expect(walkable(nav, hangar.x - 14, hangar.z)).toBe(true);
    expect(cellAt(nav, extent.min[0] + 1, extent.min[1] + 1)).toEqual([0, 0]);
    const back = fromBin(toBin(nav));
    expect(Array.from(back.solid)).toEqual(Array.from(nav.solid));
    expect(back.slots.length).toBe(nav.slots.length);
  });

  it('leaves out a box too big to be a wall: a building’s shell taken whole', () => {
    const big = { x: 0, z: 0, hw: 50, hd: 50, yaw: 0, top: 20, base: 0 };
    const nav = navOf({ heightAt: () => 0, bounds: { min: [-60, -60], max: [60, 60] }, boxes: [big, { ...big, x: 55, hw: 2, hd: 2 }] });
    expect(nav.boxes.length).toBe(1);
    expect(walkable(nav, 0, 0)).toBe(true);
    // (nor one wholly under the ground: a hall under the glacier)
    expect(navOf({ heightAt: () => 30, bounds: { min: [-10, -10], max: [10, 10] }, boxes: [{ x: 0, z: 0, hw: 2, hd: 2, yaw: 0, top: 20, base: 10 }] }).boxes.length).toBe(0);
  });

  it('takes the gameplay records’ bounds where they have them', () => {
    expect(navBounds({ bounds: { min: [-10, -20], max: [10, 20], _source: 'x' } }, extent)).toEqual({ min: [-10, -20], max: [10, 20] });
    expect(navBounds({}, { min: [1, 2], max: [3, 4] })).toEqual({ min: [1, 2], max: [3, 4] });
  });

  it('stands a level with no terrain on its floors, and a cell with none is a drop', () => {
    const at = floorHeight([{ x: 10, z: 10, hw: 4, hd: 4, yaw: 0, y: 3 }, { x: 10, z: 10, hw: 1, hd: 1, yaw: 0, y: 5 }]);
    expect(at(6.5, 6.5)).toBe(3);
    expect(at(10.5, 10.5)).toBe(5);
    expect(at(40, 40)).toBe(-1000);
  });
});
