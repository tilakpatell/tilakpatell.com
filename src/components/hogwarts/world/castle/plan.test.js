import { describe, expect, it } from 'vitest';
import { BRIDGES, CLOCK, DOORS, PLAN, floorAt, floors, footprints, partById } from './plan';
import { at } from './hero';
import { CASTLE_FLOOR, placeById } from '../../rules/places';
import { heightAt } from '../terrain';

describe('the castle’s plan', () => {
  it('names the castle’s parts, each with an id of its own, where the hero castle has them', () => {
    const ids = PLAN.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLAN) for (const v of [...(p.at ?? []), ...(p.from ?? []), ...(p.to ?? [])]) expect(Number.isFinite(v), p.id).toBe(true);
    const [hx, , hz] = at('greatHall');
    expect(partById('great-hall').at).toEqual([hx, hz]);
  });

  it('stands the Astronomy Tower highest of all, a hundred metres over the courts', () => {
    expect(partById('astronomy').top - CASTLE_FLOOR).toBeGreaterThan(90);
  });

  it('keeps the clock tower where its courtyard is', () => {
    expect(Math.hypot(CLOCK.at[0] - placeById('clock-tower').at[0], CLOCK.at[1] - placeById('clock-tower').at[1])).toBeLessThan(1);
  });

  it('runs the bridges from the castle over their gorges to the far side, ending on the land there', () => {
    for (const { to } of Object.values(BRIDGES)) {
      const ground = heightAt(to[0], to[2]);
      expect(ground).toBeLessThanOrEqual(to[1] + 0.5);
      expect(ground).toBeGreaterThan(to[1] - 4);
    }
    // (the gorge well under the viaduct’s middle: a viaduct, not a causeway)
    const [vx, vy, vz] = BRIDGES.viaduct.from;
    const [wx, , wz] = BRIDGES.viaduct.to;
    expect(heightAt((vx + wx) / 2, (vz + wz) / 2)).toBeLessThan(vy - 15);
  });

  it('puts each door at its named place', () => {
    for (const d of DOORS) {
      const place = placeById(d.place);
      expect(place, d.id).not.toBeNull();
      expect(Math.hypot(d.at[0] - place.at[0], d.at[1] - place.at[1]), d.id).toBeLessThan(place.r + 2);
      expect(d.name).toBe(place.door);
      expect(['room', 'gate']).toContain(d.kind);
      if (d.kind === 'room') expect(typeof d.room).toBe('string');
    }
  });

  it('gives the walk the castle’s halls and walls to go round, its doors clear, and a floor for every deck and stair', () => {
    const boxes = footprints();
    expect(boxes.length).toBeGreaterThan(50);
    for (const b of boxes) expect(b.w * b.d).toBeGreaterThan(0);
    for (const d of DOORS) expect(boxes.some((b) => Math.hypot(b.at[0] - d.at[0], b.at[1] - d.at[1]) < 2), d.id).toBe(false);
    expect(floors().map((f) => f.id)).toEqual(expect.arrayContaining(['viaduct', 'boathouse-stair', 'covered-bridge']));
  });

  it('stands you on the viaduct’s deck at its height, and under it in the gorge', () => {
    const decks = floors();
    const { from, to } = BRIDGES.viaduct;
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    expect(floorAt(decks, mid[0], mid[2], mid[1])).toBeCloseTo(mid[1], 3);
    expect(floorAt(decks, mid[0], mid[2], heightAt(mid[0], mid[2]))).toBeNull();
    expect(floorAt(decks, mid[0] + 30, mid[2], mid[1])).toBeNull();
  });

  it('climbs the boathouse stair from the water to the gatehouse', () => {
    const stair = partById('boathouse-stair').points;
    expect(stair[0][1]).toBeLessThan(5);
    expect(stair.at(-1)[1]).toBeCloseTo(at('stairTop')[1], 3);
    for (let i = 1; i < stair.length; i++) expect(stair[i][1]).toBeGreaterThan(stair[i - 1][1]);
  });
});
