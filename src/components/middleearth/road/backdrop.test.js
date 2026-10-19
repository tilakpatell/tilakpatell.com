import { describe, expect, it } from 'vitest';
import { depthOf, rangeGeometry, stageGeometry } from './backdrop';
import { RANGES, rangesOf } from './stages/ranges';
import { STAGES } from './stages/index';

const FAR = 4500; // module.js’s camera
const snowy = (g) => {
  const c = g.attributes.color.array;
  let n = 0;
  for (let i = 0; i < c.length; i += 3) if (c[i] > 0.75 && c[i + 1] > 0.75 && c[i + 2] > 0.8) n++;
  return n;
};

describe('the mountains on the horizon', () => {
  it('a row of ranges for every stage, each inside the camera’s reach', () => {
    expect(Object.keys(RANGES).sort()).toEqual(STAGES.map((s) => s.id).sort());
    expect(rangesOf('nowhere')).toEqual([]);
    for (const [id, rows] of Object.entries(RANGES))
      for (const r of rows) {
        expect(r.width, id).toBeGreaterThan(0);
        expect(r.width, id).toBeLessThanOrEqual(180);
        expect(r.height, id).toBeGreaterThan(0);
        // (its far foot and its top, from the camera)
        const depth = depthOf(r);
        expect(Math.hypot(r.dist + depth / 2, r.height), id).toBeLessThan(FAR);
        expect(r.dist - depth / 2, id).toBeGreaterThan(400);
        // (no range taller in the sky than a mountain looms: under a fifth of the way up, seen from its foot)
        expect(Math.atan2(r.height, r.dist) * (180 / Math.PI), id).toBeLessThan(20);
      }
  });

  it('a range is a band of ground on its bearing, its peaks no higher than it says', () => {
    const r = { az: 30, width: 60, dist: 2000, height: 900, jag: 0.8, snow: 0.5, seed: 4 };
    const g = rangeGeometry(r, { segments: 40, rows: 8 });
    expect(g.attributes.position.count).toBe(41 * 8);
    g.computeBoundingBox();
    expect(g.boundingBox.max.y).toBeLessThanOrEqual(900);
    expect(g.boundingBox.max.y).toBeGreaterThan(900 * 0.5);
    // (all of it on the bearing’s side: 0 to 60 degrees, to the left and ahead)
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      expect(p[i]).toBeGreaterThan(-1e-6);
      expect(p[i + 2]).toBeGreaterThan(0);
    }
    for (const h of g.attributes.aHaze.array) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('snow only where a range has a snow line, and the far ones hazier', () => {
    const base = { az: 0, width: 60, dist: 2000, height: 1000, jag: 0.9, seed: 3 };
    expect(snowy(rangeGeometry({ ...base, snow: 0.4 }, { segments: 60, rows: 12 }))).toBeGreaterThan(0);
    expect(snowy(rangeGeometry({ ...base, snow: null }, { segments: 60, rows: 12 }))).toBe(0);
    const near = rangeGeometry({ ...base, dist: 1200 }, { segments: 8, rows: 4 }).attributes.aHaze.array[0];
    const far = rangeGeometry({ ...base, dist: 2600 }, { segments: 8, rows: 4 }).attributes.aHaze.array[0];
    expect(far).toBeGreaterThan(near);
  });

  it('a volcano is one peak on its bearing', () => {
    const g = rangeGeometry({ az: 0, width: 26, dist: 2200, height: 1100, cone: true, seed: 38 }, { segments: 60, rows: 30 });
    const p = g.attributes.position.array;
    let top = 0;
    for (let i = 0; i < p.length; i += 3) if (p[i + 1] > p[top + 1]) top = i;
    expect(Math.abs(p[top])).toBeLessThan(150);
    expect(Math.abs(p[top + 2] - 2200)).toBeLessThan(250);
  });

  it('a stage’s ranges in one geometry; none for a stage without', () => {
    const g = stageGeometry('caradhras', { segments: 20, rows: 6 });
    expect(g.attributes.position.count).toBe(rangesOf('caradhras').length * 21 * 6);
    expect(stageGeometry('nowhere')).toBeNull();
  });
});
