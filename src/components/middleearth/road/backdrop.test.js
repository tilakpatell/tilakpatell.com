import { describe, expect, it } from 'vitest';
import { EYE_AT, createBackdrop, depthOf, foothills, rangeGeometry, stageGeometry, towerGeometry } from './backdrop';
import { LANDMARKS, RANGES, landmarksOf, rangesOf } from './stages/ranges';
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

  it('foothills before a big range, nearer, lower and green; none before a small one or a volcano', () => {
    const big = { az: 10, width: 60, dist: 3000, height: 800, colour: 0x6e7280, seed: 4 };
    const f = foothills(big);
    expect(f.dist).toBeLessThan(big.dist);
    expect(f.dist - depthOf(f) / 2).toBeGreaterThan(400);
    expect(f.height).toBeLessThan(big.height / 3);
    expect(f.snow).toBeNull();
    expect(foothills({ ...big, height: 200 })).toBeNull();
    expect(foothills({ ...big, cone: true })).toBeNull();
    for (const [id, rows] of Object.entries(RANGES)) for (const r of rows) if (foothills(r)) expect(foothills(r).dist - depthOf(foothills(r)) / 2, id).toBeGreaterThan(400);
  });

  it('a stage’s ranges and their foothills in one geometry; none for a stage without', () => {
    const g = stageGeometry('caradhras', { segments: 20, rows: 6 });
    const n = rangesOf('caradhras').flatMap((r) => [r, foothills(r)].filter(Boolean)).length;
    expect(g.attributes.position.count).toBe(n * 21 * 6);
    expect(stageGeometry('nowhere')).toBeNull();
  });

  it('a volcano spans its own foot, whatever its row says, and burns at its lip', () => {
    const g = rangeGeometry({ az: 0, width: 4, dist: 3000, height: 760, cone: true, seed: 38 }, { segments: 60, rows: 30 });
    g.computeBoundingBox();
    // (its foot about 1 km round, so far wider than four degrees at 3 km)
    expect(g.boundingBox.max.x - g.boundingBox.min.x).toBeGreaterThan(1500);
    expect(Math.max(...g.attributes.aGlow.array)).toBeGreaterThan(0.9);
    expect(Math.max(...rangeGeometry({ az: 0, width: 40, dist: 3000, height: 760, seed: 2 }, { segments: 20, rows: 6 }).attributes.aGlow.array)).toBe(0);
  });

  it('the landmarks: Barad-dûr as tall as it says with its Eye near the top, inside the camera’s reach', () => {
    for (const [id, rows] of Object.entries(LANDMARKS)) {
      expect(STAGES.map((s) => s.id), id).toContain(id);
      for (const l of rows) expect(Math.hypot(l.dist, l.height), id).toBeLessThan(FAR);
    }
    expect(landmarksOf('nowhere')).toEqual([]);
    const t = towerGeometry({ height: 500 });
    t.computeBoundingBox();
    expect(t.boundingBox.max.y).toBeGreaterThan(500);
    expect(t.boundingBox.max.y).toBeLessThan(500 * 1.15);
    expect(EYE_AT).toBeLessThan(1);
    // (made on its stage, kept off the others)
    const b = createBackdrop();
    b.at('gorgoroth');
    expect(b.mesh.children.length).toBe(2);
    b.at('hobbiton');
    expect(b.mesh.children.length).toBe(2);
    expect(b.mesh.children[1].children.length).toBe(0);
    b.dispose();
  });
});
