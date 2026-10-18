import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { roadOf } from './line';
import { buildHeights } from './terrain';
import { CLEAR, placements, rngOf, rowsFor } from './scatter';
import { SCATTER } from './stages/tables';
import { STAGES } from './stages/index';
import { PACK } from './pack';

const road = roadOf([
  [0, 0, 0],
  [0, 0, 200],
]);
const flat = { ...buildHeights({ seed: 1, relief: [] }, { size: [512, 280], res: 4, road }), road };
const KIT = JSON.parse(readFileSync(new URL('../../../../public/kit/naturemega/index.json', import.meta.url), 'utf8'));
const tree = { model: 'CommonTree_1', per100: 0.2, clump: 3 };

describe('the scatter’s placements', () => {
  it('never within CLEAR of the road', () => {
    const items = placements([{ ...tree, per100: 1 }], flat, road, rngOf(3));
    expect(items.length).toBeGreaterThan(100);
    // (the road runs z 0 to 200 along x = 0: past its ends, the distance is to the end)
    for (const it of items) expect(Math.hypot(it.x, it.z < 0 ? it.z : Math.max(0, it.z - 200))).toBeGreaterThanOrEqual(CLEAR);
    expect(CLEAR).toBe(6);
  });

  it('counts scale with per100', () => {
    const a = placements([tree], flat, road, rngOf(5)).length;
    const b = placements([{ ...tree, per100: 0.4 }], flat, road, rngOf(5)).length;
    expect(b / a).toBeGreaterThan(1.8);
    expect(b / a).toBeLessThan(2.2);
  });

  it('low halves them and drops the grass; mid thins the grass', () => {
    const grass = { model: 'Grass_Common_Short', per100: 0.5, kind: 'grass' };
    const high = placements([tree, grass], flat, road, rngOf(7));
    const low = placements([tree, grass], flat, road, rngOf(7), { tier: 'low' });
    const mid = placements([tree, grass], flat, road, rngOf(7), { tier: 'mid' });
    const n = (list, m) => list.filter((it) => it.model === m).length;
    expect(n(low, 'Grass_Common_Short')).toBe(0);
    expect(n(low, 'CommonTree_1') / n(high, 'CommonTree_1')).toBeCloseTo(0.5, 1);
    expect(n(mid, 'Grass_Common_Short') / n(high, 'Grass_Common_Short')).toBeCloseTo(0.5, 1);
    expect(n(mid, 'CommonTree_1')).toBe(n(high, 'CommonTree_1'));
  });

  it('stands each on the land, turned and sized within the row’s range', () => {
    const hills = { ...buildHeights({ seed: 4, relief: [{ type: 'hills', scale: 40, height: 10 }] }, { size: [512, 280], res: 4, road }), road };
    for (const it of placements([{ ...tree, scale: [0.8, 1.2] }], hills, road, rngOf(9))) {
      expect(it.y).toBeCloseTo(hills.field(it.x, it.z), 6);
      expect(it.scale).toBeGreaterThanOrEqual(0.8);
      expect(it.scale).toBeLessThanOrEqual(1.2);
      expect(it.yaw).toBeGreaterThanOrEqual(0);
      expect(it.yaw).toBeLessThan(Math.PI * 2);
    }
  });

  it('keeps off a slope steeper than the row’s cap, and out of the water', () => {
    const steep = { ...buildHeights({ seed: 1, relief: [] }, { size: [512, 280], res: 4, road }), road, field: (x) => x * 2 };
    expect(placements([{ ...tree, per100: 1, slope: 0.5 }], steep, road, rngOf(1))).toHaveLength(0);
    const wet = { ...flat, wet: (x) => x > 0 };
    for (const it of placements([{ ...tree, per100: 1 }], wet, road, rngOf(2))) expect(it.x).toBeLessThan(0);
  });

  it('is the same for the same seed', () => {
    expect(placements([tree], flat, road, rngOf(11))).toEqual(placements([tree], flat, road, rngOf(11)));
  });

  it('every stage has rows, each a model of the nature kit by its name', () => {
    for (const st of STAGES) {
      const rows = rowsFor(st.id);
      expect(Array.isArray(rows)).toBe(true);
      for (const r of rows) {
        expect(KIT.models[r.model], r.model).toBeTruthy();
        expect(r.per100).toBeGreaterThan(0);
      }
    }
    expect(SCATTER.hobbiton.length).toBeGreaterThan(0);
  });

  it('every model the tables plant is in the Road’s pack', () => {
    for (const st of STAGES) for (const r of rowsFor(st.id)) expect(PACK.urls).toContain(`/kit/naturemega/${KIT.models[r.model].file}`);
    expect(PACK.urls).toContain('/kit/naturemega/index.json');
  });
});
