import { describe, expect, it } from 'vitest';
import { BRIDGES, CLOCK, DOORS, PLAN, floorAt, floors, footprints, partById } from './plan';
import { PARTS } from './parts';
import { CASTLE_FLOOR, placeById } from '../../rules/places';
import { heightAt } from '../terrain';

const topOf = (p) => (p.base ?? CASTLE_FLOOR) + (p.h ?? 0) + (p.cone?.h ?? p.spire ?? 0);

describe('the castle’s plan', () => {
  it('is made of the kit’s parts, each with an id of its own', () => {
    const ids = new Set();
    for (const p of PLAN) {
      expect(typeof PARTS[p.kind]).toBe('function');
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
    expect(partById('great-hall').kind).toBe('hall');
    expect(partById('nothing')).toBeNull();
  });

  it('stands the Astronomy Tower highest of all, the Great Hall long along the cliff', () => {
    const astronomy = topOf(partById('astronomy'));
    for (const p of PLAN) if (p.id !== 'astronomy') expect(topOf(p)).toBeLessThan(astronomy);
    const hall = partById('great-hall');
    expect(hall.len).toBeGreaterThan(3 * hall.w);
    // (its south wall within reach of the cliff’s edge: the lake under its windows)
    expect(heightAt(hall.at[0], hall.at[1] + hall.w / 2 + 30)).toBeLessThan(CASTLE_FLOOR - 10);
  });

  it('builds every standing part on the crag’s top, none buried', () => {
    for (const p of PLAN) {
      if (!['tower', 'square', 'hall'].includes(p.kind) || p.base != null) continue;
      expect(heightAt(p.at[0], p.at[1])).toBeLessThanOrEqual(CASTLE_FLOOR + 0.01);
      expect(heightAt(p.at[0], p.at[1])).toBeGreaterThan(CASTLE_FLOOR - 12);
    }
    const owlery = partById('owlery');
    expect(heightAt(...owlery.at)).toBeCloseTo(owlery.base, 0);
  });

  it('keeps a clock tower with its faces and its pendulum’s bay below them', () => {
    expect(partById('clock-tower')).toMatchObject({ clock: CLOCK.face, bay: CLOCK.bay });
    expect(CLOCK.bay.y + CLOCK.bay.h).toBeLessThan(CLOCK.face.y - CLOCK.face.r);
  });

  it('runs the bridges from their gates to the far side, ending on the land there', () => {
    for (const { from, to } of Object.values(BRIDGES)) {
      expect(from[1]).toBe(CASTLE_FLOOR);
      expect(Math.abs(heightAt(to[0], to[2]) - to[1])).toBeLessThan(3);
    }
    const [vx, , vz] = BRIDGES.viaduct.from;
    const [wx, , wz] = BRIDGES.viaduct.to;
    // (the ravine well under its middle: a viaduct, not a causeway)
    expect(heightAt((vx + wx) / 2, (vz + wz) / 2)).toBeLessThan(CASTLE_FLOOR - 15);
  });

  it('puts each door at its named place, facing out of the castle', () => {
    for (const d of DOORS) {
      const place = placeById(d.place);
      expect(place).not.toBeNull();
      expect(Math.hypot(d.at[0] - place.at[0], d.at[1] - place.at[1])).toBeLessThan(place.r + 2);
      expect(d.name).toBe(place.door);
      expect(['room', 'gate']).toContain(d.kind);
      if (d.kind === 'room') expect(typeof d.room).toBe('string');
    }
  });

  it('gives the walk an outline for every standing part and a floor for every deck and stair', () => {
    const outlines = footprints();
    for (const f of outlines) {
      if (f.kind === 'circle') expect(f.r).toBeGreaterThan(0);
      else expect(f.w * f.d).toBeGreaterThan(0);
    }
    expect(outlines.filter((f) => f.id === 'great-hall')).toHaveLength(1);
    const decks = floors();
    expect(decks.map((f) => f.id)).toEqual(expect.arrayContaining(['viaduct', 'boathouse-stair', 'covered-bridge']));
  });

  it('stands you on the viaduct’s deck at its height, and under it in the ravine', () => {
    const decks = floors();
    const { from, to } = BRIDGES.viaduct;
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    expect(floorAt(decks, mid[0], mid[2], mid[1])).toBeCloseTo(mid[1], 3);
    expect(floorAt(decks, mid[0], mid[2], heightAt(mid[0], mid[2]))).toBeNull();
    expect(floorAt(decks, mid[0] + 30, mid[2], mid[1])).toBeNull();
  });
});
