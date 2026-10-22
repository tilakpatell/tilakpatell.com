import { describe, expect, it } from 'vitest';
import MEGAKIT from '../../../../public/kit/naturemega/index.json';
import { CLEAR, ROWS, placementsFor, rngOf } from './scatter';
import { bakeLand } from './land';
import { LAKE } from './terrain';

// (a coarse bake: the rule is the same, the test a tenth of a second)
const land = bakeLand({ step: 20 });

describe('what grows on the grounds', () => {
  it('names only the kit’s models, and tints only its materials', () => {
    for (const row of ROWS) {
      expect(MEGAKIT.models[row.model]).toBeDefined();
      for (const name of Object.keys(row.tint ?? {})) expect(MEGAKIT.materials[name]).toBeDefined();
    }
  });

  it('places a cell the same way every time', () => {
    expect(placementsFor(land, 2, 3)).toEqual(placementsFor(land, 2, 3));
    const a = rngOf(5);
    const b = rngOf(5);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('keeps out of the water, off the worn ways and out of the castle and the buildings', () => {
    for (const [i, j] of [[3, 3], [2, 3], [1, 2], [4, 3], [0, 1], [5, 1]]) {
      for (const it of placementsFor(land, i, j)) {
        expect(land.heightAt(it.x, it.z)).toBeGreaterThan(LAKE);
        const row = ROWS.find((r) => r.model === it.model);
        if (row.on === 'strand' || row.on === 'steep') continue;
        expect(land.pathAt(it.x, it.z)).toBeGreaterThan(0);
        for (const c of CLEAR.filter((c) => c.r)) if (c.at) expect(Math.hypot(it.x - c.at[0], it.z - c.at[1])).toBeGreaterThan(c.r - 1e-6);
      }
    }
  });

  it('grows the forest thick and the lawn open, and thins it on low', () => {
    const forest = placementsFor(land, 1, 1).filter((it) => it.model.includes('Pine')).length;
    const lawn = placementsFor(land, 4, 3).filter((it) => it.model.includes('Pine')).length;
    expect(forest).toBeGreaterThan(lawn * 5);
    expect(placementsFor(land, 1, 1, { tier: 'low' }).length).toBeLessThan(placementsFor(land, 1, 1).length);
  });
});
