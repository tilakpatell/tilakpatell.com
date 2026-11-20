import { describe, expect, it } from 'vitest';
import { fullSector, UNIVERSE } from '../../expanse/shared/gen';
import { liveMarks } from '../chart/marks';
import { GEN_MARKS, TAG_GLYPHS, generatedMarks } from './genMarks';
import { planetsAround } from './planetsAround';

const sector = fullSector(UNIVERSE, 2, 0, 1);
const sys = sector.systems[0];
const ship = { x: sys.at[0] + 500, y: sys.at[1], z: sys.at[2] };

describe('the generated planets on the nav map', () => {
  const rows = planetsAround([sector], ship, 0, { surveyed: new Set([sys.planets[0].id]) });

  it('lists the planets round the ship, nearest first, in their looks’ colours', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(GEN_MARKS.most);
    expect(rows.some((r) => r.id === sys.planets[0].id)).toBe(true);
    for (const r of rows) expect(r.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(rows.find((r) => r.id === sys.planets[0].id).tags[0]).toBe('surveyed');
  });

  it('makes them marks under every hand-made name, at the system and neighbourhood levels only', () => {
    const marks = generatedMarks(rows);
    for (const m of marks) {
      expect(m.priority).toBeLessThan(45);
      expect(m.levels).toEqual(['system', 'neighbourhood']);
      expect(m.pickable).toBe(true);
      for (const t of m.tags) expect(TAG_GLYPHS[t], t).toBeTruthy();
    }
  });

  it('come through liveMarks from where()’s `generated`, and none without it', () => {
    expect(liveMarks({ ship, generated: rows }).filter((m) => m.kind === 'world')).toHaveLength(rows.length);
    expect(liveMarks({ ship }).filter((m) => m.kind === 'world')).toHaveLength(0);
  });

  it('lists none far from every system, and none without a ship', () => {
    expect(planetsAround([sector], { x: 9e9, y: 0, z: 9e9 }, 0)).toEqual([]);
    expect(planetsAround([sector], null, 0)).toEqual([]);
  });
});
