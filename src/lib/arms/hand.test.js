import { describe, expect, it } from 'vitest';
import { PICKABLE, SHOW_KILLS, UNIQUE_HAND, WEAPONS, pickableWith } from './hand';

describe('the guns in the hand, one table', () => {
  it('has the skill tree’s four, each with its node, and none of them anyone’s to pick without it', () => {
    expect(Object.keys(UNIQUE_HAND)).toEqual(['amban', 'particle', 'm60', 'gauntlet']);
    for (const [id, node] of Object.entries(UNIQUE_HAND)) {
      expect(WEAPONS[id]?.unique, id).toBe(true);
      expect(node).toBe(`u-${id}`);
      expect(PICKABLE).not.toContain(id);
    }
  });
  it('adds a unique gun to what may be picked only once it’s opened', () => {
    expect(pickableWith([])).toEqual(PICKABLE);
    expect(pickableWith(undefined)).toEqual(PICKABLE);
    expect(pickableWith(['amban', 'seismic'])).toEqual([...PICKABLE, 'amban']);
  });
  it('gives each its one trick: the beam held, the stream past the floor with its climb, the charge', () => {
    expect(WEAPONS.particle.beam).toBe(true);
    expect(WEAPONS.particle.every).toBeCloseTo(0.1);
    expect(WEAPONS.m60.stream && WEAPONS.m60.climb > 0).toBe(true);
    expect(WEAPONS.gauntlet.charge).toBeGreaterThan(0);
    expect(WEAPONS.amban.zoom).toBeGreaterThan(WEAPONS.sniper.zoom);
    for (const id of ['amban', 'particle', 'gauntlet']) expect(SHOW_KILLS).toContain(id);
  });
});
