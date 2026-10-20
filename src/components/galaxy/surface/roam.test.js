import { describe, expect, it } from 'vitest';
import { HALF, heightGrid } from './terrain';
import { MOVE, areaAt, createRoam, roamGround, roamOn } from './roam';

const land = (x, z) => Math.sin(x / 50) * 3 + Math.cos(z / 40) * 2;
const OPTS = { n: 128, grow: 1.3 };
// (frames till the ground has moved round (x, z))
const settle = (roam, x, z) => {
  let frames = 0;
  while (!roam.update(x, z)) frames++;
  return frames;
};

describe('roamOn and roamGround', () => {
  it('has no edge in free roam on ground of its own, and keeps it on a mission or the game’s level', () => {
    expect(roamOn({}, null)).toBe(true);
    expect(roamOn({}, { id: 'assault' })).toBe(false);
    expect(roamOn({ level: 'endor' }, null)).toBe(false);
    expect(roamOn({ noGround: true }, null)).toBe(false);
  });

  it('breaks a world’s mountain rings into ranges past them, and leaves its other layers and its ranges everywhere alone', () => {
    const ground = { seed: 3, layers: [{ type: 'hills', scale: 100, height: 5 }, { type: 'mountains', from: 700, to: 3000, height: 300, scale: 1100 }, { type: 'mountains', from: 0, height: 80, scale: 900 }] };
    const roam = roamGround(ground);
    expect(roam.layers[0]).toBe(ground.layers[0]);
    expect(roam.layers[1]).toEqual({ ...ground.layers[1], ranges: 4200 });
    expect(roam.layers[2]).toBe(ground.layers[2]);
    expect(ground.layers[1].ranges).toBeUndefined();
  });

  it('lays the map’s square round a point', () => {
    expect(areaAt([1000, -64])).toEqual({ x0: 1000 - HALF, z0: -64 - HALF, w: 2 * HALF, d: 2 * HALF });
  });
});

describe('createRoam', () => {
  const roamOf = (more = {}) => {
    const moved = [];
    const roam = createRoam({ height: land, grid: heightGrid(land, OPTS), gridOpts: OPTS, onMove: (g) => moved.push(g), spend: 0, ...more });
    return { roam, moved };
  };

  it('stays put till you are MOVE metres from the grid’s middle', () => {
    const { roam, moved } = roamOf();
    expect(roam.update(MOVE - 1, 0)).toBe(false);
    expect(roam.moving).toBe(false);
    expect(moved).toEqual([]);
    expect(roam.centre).toEqual([0, 0]);
  });

  it('lays its new middle on the fine grid’s lattice, so the fine ground’s samples land where they were', () => {
    const fine = heightGrid(land, { n: 256, grow: 1.08 });
    const { roam, moved } = roamOf({ grid: fine, gridOpts: { n: 256, grow: 1.08 } });
    settle(roam, 301, -77);
    expect(roam.centre).toEqual([320, -80]);
    for (const [x, z] of [[300, -70], [100, 40], [-200, 200]]) expect(moved[0].heightAt(x, z)).toBeCloseTo(fine.heightAt(x, z), 9);
  });

  it('builds a grid round you over frames, then moves the ground there on one', () => {
    const { roam, moved } = roamOf();
    expect(settle(roam, MOVE + 30, 10)).toBeGreaterThan(5);
    expect(moved).toHaveLength(1);
    // (on the fine grid's lattice, 16 cells: 160 m at 128 lines over ±640)
    expect(roam.centre).toEqual([320, 0]);
    expect(moved[0].centre).toEqual([320, 0]);
    expect(moved[0].heightAt(300, 20)).toBeCloseTo(heightGrid(land, { ...OPTS, centre: [320, 0] }).heightAt(300, 20), 6);
    // (and then stays, round its new middle)
    expect(roam.update(MOVE + 30, 10)).toBe(false);
    expect(roam.stats.moves).toBe(1);
  });

  it('paints the map’s new square from the new grid, and puts it in on the frame the grid goes in, not before', () => {
    let painted = 0;
    let swapped = null;
    let sampled = null;
    const map = { moveTo: (area) => (expect(sampled?.centre).toEqual([-320, 0]), { step: () => (++painted >= 3 ? ((swapped = area), true) : false) }) };
    const { roam, moved } = roamOf({ map, onGrid: (g) => (sampled = g) });
    while (!roam.update(-MOVE - 100, 0)) expect(moved).toEqual([]);
    expect(swapped).toEqual(areaAt([-320, 0]));
    expect(painted).toBe(3);
    expect(moved).toHaveLength(1);
  });

  it('moves at once, on a budget with no end', () => {
    const { roam, moved } = roamOf({ spend: 3 });
    let calls = 1;
    while (!roam.update(MOVE + 30, 10, Infinity)) calls++;
    expect(calls).toBe(2);
    expect(moved).toHaveLength(1);
    expect(roam.stats.swap).toBeGreaterThanOrEqual(0);
  });

  it('makes what is built from the new grid over frames, and hands it over as the ground goes in', () => {
    let steps = 0;
    const handed = [];
    const build = (g) => ({ step: () => ++steps >= 4, of: g });
    const { roam } = roamOf({ build, onMove: (g, made) => handed.push([g, made]) });
    settle(roam, MOVE + 30, 10);
    expect(steps).toBe(4);
    expect(handed).toHaveLength(1);
    expect(handed[0][1].of).toBe(handed[0][0]);
  });

  it('goes on as far as you go', () => {
    const { roam, moved } = roamOf();
    for (const x of [500, 1000, 1500, 20000]) settle(roam, x, -x);
    expect(moved).toHaveLength(4);
    expect(roam.centre).toEqual([20000, -20000]);
  });
});
