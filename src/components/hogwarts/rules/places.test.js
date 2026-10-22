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

  it('put the castle’s places on its ground, its courtyard on its floor', () => {
    // (a hall has no floor of the castle’s own: its ground is its walls’ feet, a few metres down)
    for (const id of ['castle', 'great-hall', 'staircase', 'courtyard', 'clock-tower', 'astronomy-tower', 'great-doors']) {
      const h = heightAt(...placeById(id).at);
      expect(h, id).toBeGreaterThan(CASTLE_FLOOR - 9);
      expect(h, id).toBeLessThan(CASTLE_FLOOR + 1);
    }
    expect(Math.abs(heightAt(...placeById('courtyard').at) - CASTLE_FLOOR)).toBeLessThan(0.5);
  });

  it('finds the place you stand in, the smallest first, and the nearest of a kind', () => {
    const [x, z] = placeById('great-doors').at;
    expect(placeAt(x, z).id).toBe('great-doors');
    // (inside the castle, clear of its smaller places: its middle, out north)
    const [cx, cz] = placeById('castle').at;
    expect(placeAt(cx, cz - 48).id).toBe('castle');
    expect(placeAt(9999, 9999)).toBeNull();
    expect(nearest(x + 2, z, { kind: 'door' }).id).toBe('great-doors');
    expect(nearest(x + 200, z + 200, { kind: 'door' })).toBeNull();
    expect(nearest(x + 200, z + 200, { kind: 'door', within: 1000 })).not.toBeNull();
    expect(placeById('nowhere')).toBeNull();
  });
});
