import { describe, expect, it } from 'vitest';
import { placeById } from './places';
import { AREAS, BOUNDS, CASTLE, LABELS, LOCH, ROOMS, corridors, inLake, lakeOutline, project, trees, unproject, village } from './atlas';
import { SPOTS } from './paths';

describe('the Map’s ink', () => {
  it('turns the grounds to the page and back, north up', () => {
    const v = { cx: 10, cz: -20, scale: 2, w: 400, h: 300 };
    expect(project(v, 10, -20)).toEqual([200, 150]);
    const [x, y] = project(v, 30, -40);
    expect(x).toBeGreaterThan(200); // (east is right)
    expect(y).toBeLessThan(150); // (north is up)
    const back = unproject(v, x, y);
    expect(back[0]).toBeCloseTo(30);
    expect(back[1]).toBeCloseTo(-40);
  });

  it('draws the lake all the way round, the castle’s rock out of it and the shore across from it in it', () => {
    const o = lakeOutline();
    expect(o.length).toBeGreaterThan(60);
    expect(inLake(0, 248)).toBe(true);
    expect(inLake(-6, -40)).toBe(false);
    expect(inLake(30, 520)).toBe(false);
    expect(inLake(LOCH[5][0], LOCH[5][1])).toBe(true);
  });

  it('plants the forest west of the hut and never on the water', () => {
    const t = trees();
    expect(t.length).toBeGreaterThan(300);
    expect(t).toBe(trees());
    for (const [x, z] of t) {
      expect(inLake(x, z)).toBe(false);
      expect(x).toBeLessThan(-180);
    }
  });

  it('stands every part of the castle on its rock, and every spot inside the Map', () => {
    const [cx, cz] = placeById('castle').at;
    for (const p of CASTLE) {
      const at = p.at ?? p.from;
      expect(Math.hypot(at[0] - cx, at[1] - cz), JSON.stringify(p)).toBeLessThan(240);
    }
    for (const s of SPOTS) {
      expect(s.at[0]).toBeGreaterThan(BOUNDS[0]);
      expect(s.at[0]).toBeLessThan(BOUNDS[2]);
      expect(s.at[1]).toBeGreaterThan(BOUNDS[1]);
      expect(s.at[1]).toBeLessThan(BOUNDS[3]);
    }
  });

  it('names the places, the rooms and the wider grounds', () => {
    expect(LABELS.map((l) => l.text)).toContain('The Whomping Willow');
    for (const l of LABELS) expect(l.zoom[0]).toBeLessThan(l.zoom[1]);
    expect(ROOMS.filter((r) => r.below).map((r) => r.text)).toContain('Potions');
    expect(AREAS.find((a) => a.name === 'The south shore')).toBeTruthy();
  });

  it('draws the castle’s passages from the walkers’ own ways, and the village from its street', () => {
    const c = corridors();
    expect(c.length).toBeGreaterThan(20);
    expect(c.some((x) => x.below)).toBe(true);
    const v = village();
    expect(v.buildings).toHaveLength(12);
    expect(v.street).toHaveLength(2);
  });
});
