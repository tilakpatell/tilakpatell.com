import { describe, expect, it } from 'vitest';
import { createGround, moundTop, paintFor, patchOver } from './ground';
import { landFor, roadFor } from './terrain';
import { createWind } from '../../../lib/three/windNodes';
import { soilOf } from './stages/soils';
import { STAGES } from './stages/index';

// a land that climbs a metre a metre along z, on Caradhras’ road
const land = { road: roadFor('caradhras'), heightAt: (x, z) => z / 4 };
const at = (paint, x, z) => {
  const out = [0, 0, 0];
  const grass = paint(x, z, out);
  return { out, grass };
};

describe('a stage’s ground paint', () => {
  it('grows no grass in a paved place, easing back into it at the edge', () => {
    const paved = { ...land, bare: [{ at: [60, 40], r: 5 }] };
    expect(at(paintFor(paved), 60, 40).grass).toBe(0);
    expect(at(paintFor(paved), 66.5, 40).grass).toBeGreaterThan(0);
    expect(at(paintFor(paved), 66.5, 40).grass).toBeLessThan(1);
    expect(at(paintFor(paved), 70, 40).grass).toBe(1);
  });
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

describe('a stage’s mounds', () => {
  it('a dome stood on the lowest of the ground round its foot, nothing off it', () => {
    const top = moundTop((x) => x / 10, { at: [0, 0], r: 10, squash: 0.5, sink: 0.3 });
    expect(top.low).toBeCloseTo(-1, 2);
    expect(top(0, 0)).toBeCloseTo(top.low - 0.3 + 5, 6);
    expect(top(6, 0)).toBeCloseTo(top.low - 0.3 + 4, 6);
    expect(top(11, 0)).toBe(-Infinity);
  });

  it('the blades grow over Hobbiton’s Hill too, shown and hidden with the field’s as one', () => {
    const land = landFor('hobbiton', { res: 8, wide: 256 });
    const mounds = STAGES[0].ground.mounds;
    const ground = createGround(land, { tier: 'mid', soil: soilOf('hobbiton'), mounds, wind: createWind(), from: 0, to: land.end });
    expect(ground.blades.mesh.isGroup).toBe(true);
    expect(ground.blades.mesh.children).toHaveLength(2);
    ground.update(30, 10);
    ground.dispose();
    // (no mounds: the field’s patch alone)
    const plain = createGround(land, { tier: 'mid', soil: soilOf('hobbiton'), wind: createWind(), from: 0, to: land.end });
    expect(plain.blades.mesh.isMesh).toBe(true);
    plain.dispose();
  }, 30000);
});

describe('patchOver', () => {
  it('a patch of blades `size` across round the camera lies over an area while their squares meet', () => {
    const hill = { x0: 14, z0: -14, w: 40, d: 40 };
    expect(patchOver(0, 0, 44, hill)).toBe(true);
    expect(patchOver(-7, 0, 44, hill)).toBe(true);
    expect(patchOver(-8.5, 0, 44, hill)).toBe(false);
    expect(patchOver(30, 48, 44, hill)).toBe(true);
    expect(patchOver(30, 49, 44, hill)).toBe(false);
  });
});
