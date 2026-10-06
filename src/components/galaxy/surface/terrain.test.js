import { describe, expect, it } from 'vitest';
import { HALF, heightGrid } from './terrain';

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
