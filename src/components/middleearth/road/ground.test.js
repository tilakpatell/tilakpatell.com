import { describe, expect, it } from 'vitest';
import { paintFor } from './ground';
import { roadFor } from './terrain';

// a land that climbs a metre a metre along z, on Caradhras’ road
const land = { road: roadFor('caradhras'), heightAt: (x, z) => z / 4 };
const at = (paint, x, z) => {
  const out = [0, 0, 0];
  const grass = paint(x, z, out);
  return { out, grass };
};

describe('a stage’s ground paint', () => {
  it('is the default greens with no paint of its own', () => {
    const { out, grass } = at(paintFor(land), 60, 40);
    expect(out[1]).toBeGreaterThan(out[0]);
    expect(grass).toBe(1);
  });

  it('takes its own greens and dirt, as hex', () => {
    const { out } = at(paintFor(land, { greens: [0x804020, 0x804020, 0x804020] }), 60, 40);
    expect(out[0]).toBeGreaterThan(out[1]);
  });

  it('lies under snow above its line, whole above the top, none below the foot, and grows no grass in it', () => {
    const paint = paintFor(land, { snow: [10, 14] });
    const low = at(paint, 60, 0);
    const high = at(paint, 60, 400);
    expect(low.out[1]).toBeGreaterThan(low.out[2]);
    for (const c of high.out) expect(c).toBeGreaterThan(0.8);
    expect(high.grass).toBe(0);
    expect(low.grass).toBe(1);
  });

  it('shows grey rock through the snow where the land is too steep to hold it', () => {
    const steep = { road: land.road, heightAt: (x) => 100 + x * 2 };
    const { out } = at(paintFor(steep, { snow: [10, 14] }), 60, 40);
    expect(Math.max(...out)).toBeLessThan(0.5);
  });
});
