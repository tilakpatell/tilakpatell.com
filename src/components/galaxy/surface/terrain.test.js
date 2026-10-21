import { describe, expect, it } from 'vitest';
import { HALF, gridBuild, heightGrid, makeHeight } from './terrain';

describe('the ground outside the walkable square', () => {
  // a land whose height is easy to know: rising 1 m every 10 m east
  let calls = 0;
  const g = heightGrid((x) => {
    calls++;
    return x / 10;
  });

  it('reads the drawn grid, not the land again', () => {
    calls = 0;
    // (on a grid line, the drawn height is the land's own)
    const x = g.lines[g.lines.length - 5];
    expect(g.heightAt(x, -4200)).toBeCloseTo(x / 10, 3);
    expect(g.heightAt(HALF + 300, 1500)).toBeCloseTo((HALF + 300) / 10, 1);
    expect(calls).toBe(0);
  });

  it('holds the edge past the end of the grid', () => {
    const edge = g.lines[g.lines.length - 1];
    expect(g.heightAt(edge + 5000, 0)).toBeCloseTo(edge / 10, 3);
  });
});

describe('the fine relief at ultra', () => {
  const ground = { seed: 4, layers: [{ type: 'swell', scale: 300, height: 8 }], flats: [{ at: [0, 0], r: 30 }, { at: [200, -120], r: 18, h: 3 }] };
  const plain = makeHeight(ground);
  const fine = makeHeight(ground, { relief: 1 });
  const pts = Array.from({ length: 400 }, (_, i) => [((i * 97) % 1200) - 600, ((i * 61) % 1200) - 600]);

  it('changes nothing when it is off', () => {
    const off = makeHeight(ground, { relief: 0 });
    for (const [x, z] of pts) expect(off(x, z)).toBe(plain(x, z));
  });

  it('adds under a metre of small hollows and rises off the flats', () => {
    let moved = 0;
    for (const [x, z] of pts) {
      const d = Math.abs(fine(x, z) - plain(x, z));
      expect(d).toBeLessThan(0.6);
      if (d > 0.02) moved++;
    }
    expect(moved).toBeGreaterThan(pts.length / 2);
  });

  it('leaves the flats level', () => {
    for (const f of ground.flats) {
      const c = fine(f.at[0], f.at[1]);
      for (let a = 0; a < 6.28; a += 0.5) expect(fine(f.at[0] + Math.cos(a) * f.r * 0.9, f.at[1] + Math.sin(a) * f.r * 0.9)).toBeCloseTo(c, 6);
    }
    expect(fine(200, -120)).toBeCloseTo(3, 6);
  });

  it('draws one surface across the edge of the walkable square at twice the grid', () => {
    const g = heightGrid(fine, { n: 512, grow: 1.04 });
    for (const z of [-300, 0, 410]) {
      const step = Math.abs(g.heightAt(HALF - 0.01, z) - g.heightAt(HALF + 0.01, z));
      expect(step).toBeLessThan(0.05);
    }
  });
});

describe('the grid laid somewhere else (the free roam’s, round you)', () => {
  const land = (x, z) => Math.sin(x / 37) * 4 + Math.cos(z / 29) * 3 + x * 0.002;

  it('reads the world’s height wherever it lies, as the origin’s grid reads its own', () => {
    const home = heightGrid(land, { n: 64, grow: 1.2 });
    const away = heightGrid(land, { n: 64, grow: 1.2, centre: [5000, -3000] });
    expect(away.centre).toEqual([5000, -3000]);
    expect(home.centre).toEqual([0, 0]);
    // (on its lines it is the land itself; between them, the triangles' read of it)
    const cell = (2 * HALF) / 64;
    expect(away.heightAt(5000 + cell * 3, -3000 - cell * 5)).toBeCloseTo(land(5000 + cell * 3, -3000 - cell * 5), 3);
    // (and anywhere, near or far, as a grid at the origin over the land moved there)
    const moved = heightGrid((x, z) => land(x + 5000, z - 3000), { n: 64, grow: 1.2 });
    for (const [x, z] of [[7.3, 11.1], [-400, 250], [3 * HALF, -2 * HALF], [9000, 9000]]) expect(away.heightAt(5000 + x, -3000 + z)).toBeCloseTo(moved.heightAt(x, z), 6);
    expect(home.heightAt(7.3, 11.1)).not.toBeCloseTo(away.heightAt(5007.3, -2988.9), 1);
  });

  it('builds a few rows at a time, the same grid at the end', () => {
    const build = gridBuild(land, { n: 64, grow: 1.2, centre: [800, 800] });
    expect(build.grid).toBeNull();
    let steps = 0;
    while (!build.step(0)) steps++;
    expect(steps).toBeGreaterThan(10);
    expect(build.progress).toBe(1);
    const whole = heightGrid(land, { n: 64, grow: 1.2, centre: [800, 800] });
    expect(Array.from(build.grid.heights)).toEqual(Array.from(whole.heights));
    expect(build.grid.heightAt(830, 790)).toBe(whole.heightAt(830, 790));
  });
});
