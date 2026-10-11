import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSolids, pushOut } from '../../components/galaxy/surface/walker';
import { deckFloor, shapeReader, shapeSolids } from './shapeSolids';

const PACK = new URL('../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
const pack = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

async function shapesFor(draws) {
  const read = shapeReader(pack, loadBin);
  const out = {};
  for (const d of draws) out[d.mesh] = await read(d.mesh);
  return out;
}

describe('shapeSolids', () => {
  it('makes a cell’s hulls the walker’s boxes: a point in the turned pile is pushed out, one beside it isn’t', async () => {
    const { draws } = pack.cells['0,0'];
    const { boxes, floors, without } = shapeSolids(draws, await loadBin('cells/0_0.bin'), await shapesFor(draws));
    expect(without).toEqual([]);
    expect(floors).toEqual([]);
    expect(boxes).toHaveLength(3);
    const solids = createSolids();
    for (const b of boxes) solids.box(b.x, b.z, b.hw, b.hd, b.yaw, { top: b.top, base: b.base });
    // (the second pile, at (20, 10), turned 90°: its 5 m run along −z)
    const turned = solids.near(20, 8, 1).find((s) => Math.abs(s.x - 20) < 1.5);
    expect(pushOut(turned, 20, 8, 0.38)).not.toBeNull();
    expect(pushOut(turned, 23, 8, 0.38)).toBeNull();
    expect(turned.top).toBeCloseTo(0.903, 2);
    // (the mirrored one lies the other way along x)
    const mirrored = boxes[2];
    expect(mirrored.x).toBeLessThan(30);
  });

  it('gives a thin wide hull as a floor, and the meshes without shapes back', async () => {
    const draws = [...pack.cells['-1,0'].draws, ...pack.cells['1,0'].draws.filter((d) => d.mesh === 4)];
    const bin = await loadBin('cells/-1_0.bin');
    const { floors } = shapeSolids(draws.slice(0, 1), bin, await shapesFor(draws));
    // (the decal plane at twice its size: two flat hulls, each wider than 2 m)
    expect(floors.length).toBeGreaterThan(0);
    expect(floors[0].y).toBeCloseTo(0, 1);
    expect(shapeSolids(draws.slice(1), bin, await shapesFor(draws)).without).toEqual(draws.slice(1));
  });

  it('gives a broad thick hull a floor at its top as well as its box: a landing platform you are set down on', () => {
    // (Cloud City's great platform: 61 m across, 3.4 m deep; the walker stands on floors when it is put somewhere)
    expect(deckFloor({ x: 1, z: 2, hw: 30.7, hd: 30.7, yaw: 0.5, top: 0.17, base: -3.2 })).toEqual({ x: 1, z: 2, hw: 30.7, hd: 30.7, yaw: 0.5, y: 0.17 });
    // (a crate, a pillar, a wall is no floor)
    expect(deckFloor({ x: 0, z: 0, hw: 0.6, hd: 0.6, yaw: 0, top: 1.2, base: 0 })).toBeNull();
    expect(deckFloor({ x: 0, z: 0, hw: 6, hd: 0.2, yaw: 0, top: 5, base: 0 })).toBeNull();
  });
});
