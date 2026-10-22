import { describe, expect, it } from 'vitest';
import { CASTLE_FLOOR, GROUND, HALF, PLACES, nearest, placeAt, placeById, placesOf } from './places';
import { heightAt } from '../world/terrain';

const KINDS = ['castle', 'door', 'grounds', 'lake', 'forest', 'wild', 'village'];

describe('the places', () => {
  it('each have an id of their own, a name, a kind and a reach, on the ground', () => {
    const ids = new Set();
    for (const p of PLACES) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.name.length).toBeGreaterThan(2);
      expect(KINDS).toContain(p.kind);
      expect(p.r).toBeGreaterThan(0);
      expect(Math.abs(p.at[0])).toBeLessThanOrEqual(HALF);
      expect(Math.abs(p.at[1])).toBeLessThanOrEqual(HALF);
    }
    expect(GROUND).toBe(2 * HALF);
  });

  it('name their doors key-first-ready, and say which way they face', () => {
    for (const d of placesOf('door')) {
      expect(typeof d.door).toBe('string');
      expect(Number.isFinite(d.faces)).toBe(true);
    }
    expect(placeById('great-doors')).toMatchObject({ door: 'The Great Hall', room: 'greatHall' });
  });

  it('stand on dry land, but for the lake’s own', () => {
    for (const p of PLACES) {
      if (p.kind === 'lake' && p.id !== 'boathouse' && p.id !== 'shore') continue;
      expect(heightAt(p.at[0], p.at[1])).toBeGreaterThan(0);
    }
    expect(heightAt(...placeById('lake').at)).toBeLessThan(-5);
  });

  it('put the castle’s doors on its floor, and the castle on its crag', () => {
    expect(heightAt(...placeById('castle').at)).toBeCloseTo(CASTLE_FLOOR, 0);
    for (const id of ['great-hall', 'staircase', 'courtyard', 'clock-tower', 'astronomy-tower']) expect(heightAt(...placeById(id).at)).toBeCloseTo(CASTLE_FLOOR, 0);
  });

  it('finds the place you stand in, the smallest first, and the nearest of a kind', () => {
    const [x, z] = placeById('great-doors').at;
    expect(placeAt(x, z).id).toBe('great-doors');
    expect(placeAt(0, -40).id).toBe('castle');
    expect(placeAt(9999, 9999)).toBeNull();
    expect(nearest(x + 2, z, { kind: 'door' }).id).toBe('great-doors');
    expect(nearest(x + 200, z + 200, { kind: 'door' })).toBeNull();
    expect(nearest(x + 200, z + 200, { kind: 'door', within: 1000 })).not.toBeNull();
    expect(placeById('nowhere')).toBeNull();
  });
});
