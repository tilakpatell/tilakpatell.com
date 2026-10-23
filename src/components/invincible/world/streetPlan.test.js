import { describe, expect, it } from 'vitest';
import { GRID, blockKind, buildWorld, near } from './map';
import { KIT, TILE, furnitureIn, isTenement, roofUnits, tenementsFor, tenementTiles, tileOf, tilesNear } from './streetPlan';

const world = buildWorld();
// how far a point is from the nearest street's centre line, each way
const off = (v) => Math.abs((((v - GRID.cell / 2) % GRID.cell) + GRID.cell * 1.5) % GRID.cell - GRID.cell / 2);
const turn = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

describe('the streamed tiles', () => {
  it('names a point by its tile and lists the tiles round it', () => {
    expect(tileOf(10, 10)).toBe(tileOf(TILE - 1, TILE - 1));
    expect(tileOf(-1, 0)).not.toBe(tileOf(1, 0));
    const round = tilesNear(0, 0, TILE);
    expect(round).toContain(tileOf(0, 0));
    expect(round).toContain(tileOf(-TILE / 2, -TILE / 2));
    expect(new Set(round).size).toBe(round.length);
  });
});

describe('the street furniture', () => {
  const all = tilesNear(60, -80, 1200).map((k) => furnitureIn(world, k));
  const of = (kind) => all.flatMap((f) => f[kind]);

  it('stands the lamps on the pavements, every 30 m, off the crossings', () => {
    const lamps = of('lamps');
    expect(lamps.length).toBeGreaterThan(500);
    for (const l of lamps) {
      const dx = off(l.x);
      const dz = off(l.z);
      // (on a pavement: 7 to 10 m off one street's centre line, and well off the crossing street's)
      const along = Math.min(dx, dz);
      expect(along).toBeCloseTo(8.6, 5);
      expect(Math.max(dx, dz)).toBeGreaterThanOrEqual(15);
      expect(Math.abs(((dx < dz ? l.z : l.x) / 30) % 1)).toBeLessThan(1e-9);
    }
  });

  it('puts traffic lights at downtown corners and stop signs further out, none inside a block', () => {
    const lights = of('lights');
    const signs = of('stops');
    expect(lights.length).toBeGreaterThan(40);
    expect(signs.length).toBeGreaterThan(0);
    for (const t of [...lights, ...signs]) {
      expect(off(t.x)).toBeCloseTo(8.6, 5);
      expect(off(t.z)).toBeCloseTo(8.6, 5);
    }
    // each light's arm reaches over the road it stands at (its +z, turned by its yaw)
    for (const t of lights) {
      const [ax, az] = turn(0, 3, t.yaw);
      expect(Math.min(off(t.x + ax), off(t.z + az))).toBeLessThan(7);
    }
  });

  it('keeps the street trees and the manholes where the map has no box', () => {
    const near1 = [];
    for (const p of [...of('trees'), ...of('manholes')]) {
      near(world, p.x, p.z, 0.5, near1);
      expect(near1.some((b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && b.y0 <= 0.1)).toBe(false);
    }
    expect(of('trees').length).toBeGreaterThan(100);
  });

  it('rings the Guardians’ plaza with bollards and planters, its four ways in left open', () => {
    const round = tilesNear(0, 0, 40).map((k) => furnitureIn(world, k));
    const plaza = { bollards: round.flatMap((f) => f.bollards), planters: round.flatMap((f) => f.planters) };
    expect(plaza.bollards.length).toBeGreaterThan(40);
    expect(plaza.planters.length).toBeGreaterThan(4);
    for (const b of plaza.bollards) {
      expect(Math.max(Math.abs(b.x), Math.abs(b.z))).toBeCloseTo(29.4, 5);
      expect(Math.min(Math.abs(b.x), Math.abs(b.z))).toBeGreaterThan(5);
    }
  });

  it('is the same every time, and nothing outside the city', () => {
    expect(furnitureIn(world, tileOf(300, 300))).toEqual(furnitureIn(world, tileOf(300, 300)));
    const out = furnitureIn(world, tileOf(-2400, 300));
    expect(out.lamps.length + out.lights.length + out.trees.length).toBe(0);
  });
});

describe('the tenements', () => {
  const candidates = world.buildings.filter(isTenement);

  it('stand in for the outer city’s low brick blocks only', () => {
    expect(candidates.length).toBeGreaterThan(500);
    for (const b of candidates) {
      expect(b.kind).toBe('brick');
      expect(b.zone).not.toBe('core');
      expect(b.top).toBeNull();
      expect(blockKind(Math.round(b.x / GRID.cell), Math.round(b.z / GRID.cell))).toBe('built');
    }
  });

  it('fill each block’s box exactly round its edge, a corner building at each corner', () => {
    for (const b of candidates.slice(0, 200)) {
      const list = tenementsFor(b);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const t of list) {
        const m = KIT[t.model];
        // its footprint's four corners, in the world
        for (const [lx, lz] of [[m.x[0], 0], [m.x[1], 0], [m.x[0], -m.d], [m.x[1], -m.d]]) {
          const [wx, wz] = turn(lx * t.sx, lz * t.sz, t.yaw);
          x0 = Math.min(x0, t.x + wx);
          x1 = Math.max(x1, t.x + wx);
          z0 = Math.min(z0, t.z + wz);
          z1 = Math.max(z1, t.z + wz);
        }
        expect(t.sy * m.h).toBeCloseTo(b.h, 5);
        // (stretched no more than a building can take)
        expect(t.sx).toBeGreaterThan(0.6);
        expect(t.sx).toBeLessThan(1.7);
      }
      expect(x0).toBeCloseTo(b.x - b.w / 2, 4);
      expect(x1).toBeCloseTo(b.x + b.w / 2, 4);
      expect(z0).toBeCloseTo(b.z - b.d / 2, 4);
      expect(z1).toBeCloseTo(b.z + b.d / 2, 4);
      expect(list.filter((t) => t.model === 'small').length).toBe(4);
    }
  });

  it('puts every front on the street side', () => {
    const b = candidates.find((q) => q.w > 40);
    for (const t of tenementsFor(b)) {
      // its front's middle, 1 m out: outside the box
      const m = KIT[t.model];
      const [fx, fz] = turn(((m.x[0] + m.x[1]) / 2) * t.sx, 1, t.yaw);
      const px = t.x + fx;
      const pz = t.z + fz;
      expect(Math.abs(px - b.x) > b.w / 2 || Math.abs(pz - b.z) > b.d / 2).toBe(true);
    }
  });

  it('are listed by tile, and their roofs carry a few units', () => {
    const tiles = tenementTiles(world);
    const count = [...tiles.values()].reduce((s, l) => s + l.length, 0);
    expect(count).toBe(candidates.reduce((s, b) => s + tenementsFor(b).length, 0));
    const units = roofUnits(candidates[0]);
    expect(units.length).toBeGreaterThanOrEqual(2);
    for (const u of units) {
      expect(Math.abs(u.x - candidates[0].x)).toBeLessThan(candidates[0].w / 2);
      expect(u.y).toBe(candidates[0].h);
    }
  });
});
