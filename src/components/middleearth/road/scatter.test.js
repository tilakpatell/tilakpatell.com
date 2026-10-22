import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { roadOf } from './line';
import { FRAME_BACK, buildHeights, landFor } from './terrain';
import { CLEAR, VERGE, placements, rngOf, rowsFor } from './scatter';
import { trackOf } from './stages/tracks';
import { SCATTER } from './stages/tables';
import { STAGES } from './stages/index';
import { PACK } from './pack';

const road = roadOf([
  [0, 0, 0],
  [0, 0, 200],
]);
const flat = { ...buildHeights({ seed: 1, relief: [] }, { size: [512, 280], res: 4, road }), road };
const kitIndex = (pack) => JSON.parse(readFileSync(new URL(`../../../../public/kit/${pack}/index.json`, import.meta.url), 'utf8'));
const KITS = { naturemega: kitIndex('naturemega'), nature: kitIndex('nature') };
const kitOf = (r) => KITS[r.pack ?? 'naturemega'];
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

  it('a row given a band keeps to it, as densely as a row over the whole stage', () => {
    const corn = { model: 'Grass_Wheat', per100: 2, clump: 4, z: [0, 60], x: [10, 80] };
    const items = placements([corn], flat, road, rngOf(9));
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      expect(it.z).toBeGreaterThanOrEqual(0);
      expect(it.z).toBeLessThanOrEqual(60);
      expect(it.x).toBeGreaterThanOrEqual(10);
      expect(it.x).toBeLessThanOrEqual(80);
    }
    // (2 a hundred square metres over 60 × 70: some fall in clumps over the band’s edge)
    expect(items.length).toBeLessThanOrEqual(84);
    expect(items.length).toBeGreaterThan(84 * 0.7);
  });

  it('plants nothing in the land’s clear circles (a town, a garden)', () => {
    const town = { ...flat, clear: [{ at: [20, 100], r: 30 }] };
    const items = placements([{ ...tree, per100: 1 }], town, road, rngOf(13));
    expect(items.length).toBeGreaterThan(100);
    for (const it of items) expect(Math.hypot(it.x - 20, it.z - 100)).toBeGreaterThanOrEqual(30);
  });

  it('is the same for the same seed', () => {
    expect(placements([tree], flat, road, rngOf(11))).toEqual(placements([tree], flat, road, rngOf(11)));
  });

  it('plants a stage only over its own ground: never past its ends, where the neighbour’s is drawn', () => {
    for (const [i, st] of STAGES.entries()) {
      const land = landFor(st.id, { res: 8, wide: 256 });
      // (as lands.js: the first stage's ground runs on behind it, the last's ahead)
      const from = i === 0 ? -FRAME_BACK : 0;
      const to = i === STAGES.length - 1 ? land.end + FRAME_BACK : land.end;
      const items = placements(rowsFor(st.id), land, land.road, rngOf(1000 + i), { from, to });
      expect(items.length, st.id).toBeGreaterThan(0);
      for (const it of items) {
        expect(it.z, `${st.id} ${it.model}`).toBeGreaterThanOrEqual(from - 1e-6);
        expect(it.z, `${st.id} ${it.model}`).toBeLessThanOrEqual(to + 1e-6);
      }
    }
  });

  it('lines the road with a verge’s row, near to far off its middle, down its whole length', () => {
    const row = { model: 'Flower_3_Group', verge: [2.2, 4.2], per100: 4, clump: 2, spread: 0.7, scale: [0.2, 0.2] };
    const items = placements([row], flat, road, rngOf(9));
    // (2 m a side down 200 m, four a hundred square metres, less what the clumps spill past the band)
    expect(items.length).toBeGreaterThan(20);
    for (const it of items) {
      expect(Math.abs(it.x)).toBeGreaterThanOrEqual(2.2 - 1e-6);
      expect(Math.abs(it.x)).toBeLessThanOrEqual(4.2 + 1e-6);
    }
    // (both sides, and from one end to the other)
    expect(items.some((it) => it.x > 0) && items.some((it) => it.x < 0)).toBe(true);
    expect(Math.min(...items.map((it) => it.z))).toBeLessThan(40);
    expect(Math.max(...items.map((it) => it.z))).toBeGreaterThan(160);
  });

  it('grows every stage’s verge outside its track, and nothing nearer the road’s middle than VERGE', () => {
    for (const st of STAGES)
      for (const r of rowsFor(st.id).filter((r) => r.verge)) {
        expect(r.verge[0], `${st.id} ${r.model}`).toBeGreaterThanOrEqual(VERGE);
        // (clear of the track's broken edge: a pebble just past it, as low as the ribbon stands over the land, would be under it)
        const t = trackOf(st.id);
        if (t) expect(r.verge[0], `${st.id} ${r.model}`).toBeGreaterThanOrEqual(t.width / 2 + (/^Pebble/.test(r.model) ? 0.15 : 0.3));
        expect(r.verge[1]).toBeGreaterThan(r.verge[0]);
      }
  });

  it('stands a row with places of its own at those places alone, scaled by its own', () => {
    const land = { x0: -100, w: 200, z0: 0, d: 200, field: () => 2 };
    const out = placements([{ model: 'CommonTree_1', at: [[-22, 18, 1.1], [44, 150]], scale: [2, 2] }], land, roadOf([[0, 0, 0], [0, 0, 200]]), rngOf(3));
    expect(out.map((o) => [o.x, o.y, o.z, o.scale])).toEqual([
      [-22, 2, 18, 2.2],
      [44, 2, 150, 2],
    ]);
  });

  it('every stage has rows, each a model of its kit by its name', () => {
    for (const st of STAGES) {
      const rows = rowsFor(st.id);
      expect(Array.isArray(rows)).toBe(true);
      for (const r of rows) {
        expect(kitOf(r)?.models[r.model], `${r.pack ?? 'naturemega'}/${r.model}`).toBeTruthy();
        // (a density, or places of its own)
        if (r.at) expect(r.at.length).toBeGreaterThan(0);
        else expect(r.per100).toBeGreaterThan(0);
      }
    }
    expect(SCATTER.hobbiton.length).toBeGreaterThan(0);
  });

  it('every model the tables plant is in the Road’s pack', () => {
    for (const st of STAGES) for (const r of rowsFor(st.id)) expect(PACK.urls).toContain(`/kit/${r.pack ?? 'naturemega'}/${kitOf(r).models[r.model].file}`);
    for (const pack of Object.keys(KITS)) expect(PACK.urls).toContain(`/kit/${pack}/index.json`);
  });

  it('grass keeps near the road: a band of its own, never a stage’s whole width', () => {
    for (const st of STAGES)
      for (const r of rowsFor(st.id)) {
        // (a verge's row is a band of its own: a few metres either side of the road)
        if (r.kind !== 'grass' || r.verge) continue;
        expect(r.x, `${st.id}: ${r.model}`).toBeTruthy();
        expect(r.x[1] - r.x[0], `${st.id}: ${r.model}`).toBeLessThanOrEqual(240);
      }
  });

  it('a row of another kit keeps its kit on its items', () => {
    const items = placements([{ model: 'MapleTree_1', pack: 'nature', per100: 0.5, clump: 2 }], flat, road, rngOf(5));
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.pack).toBe('nature');
    for (const it of placements([tree], flat, road, rngOf(5))) expect('pack' in it).toBe(false);
  });
});
