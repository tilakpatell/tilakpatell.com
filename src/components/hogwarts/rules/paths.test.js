import { describe, expect, it } from 'vitest';
import { EDGES, ROOM_FRAMES, SPOTS, fromRoom, indoorAt, pathOf, rideBetween, route, spotById, spotOfRoom, toRoom } from './paths';

describe('the castle’s ways', () => {
  it('has every spot once, each with a name, a place and a reach', () => {
    const ids = SPOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SPOTS) {
      expect(s.name.length).toBeGreaterThan(3);
      expect(Number.isFinite(s.at[0]) && Number.isFinite(s.at[1])).toBe(true);
      expect(s.r).toBeGreaterThan(0);
    }
  });

  it('joins only spots it knows, and every spot to every other', () => {
    for (const [a, b] of EDGES) {
      expect(spotById(a), a).not.toBeNull();
      expect(spotById(b), b).not.toBeNull();
    }
    for (const s of SPOTS) expect(route('entrance', s.id), s.id).not.toBeNull();
  });

  it('goes the short way and starts and ends where it was asked', () => {
    const r = route('gryffindor', 'potions');
    expect(r[0]).toBe('gryffindor');
    expect(r[r.length - 1]).toBe('potions');
    // (down the stairs from the Fat Lady, through the Entrance Hall, down to the dungeons)
    expect(r).toEqual(['gryffindor', 'fat-lady', 'staircase', 'entrance', 'below', 'dungeons', 'potions']);
    expect(route('hall', 'hall')).toEqual(['hall']);
    expect(route('hall', 'nowhere')).toBeNull();
  });

  it('rides the carriages’ road and walks the rest', () => {
    expect(rideBetween('road', 'station')).toBe(true);
    expect(rideBetween('station', 'road')).toBe(true);
    expect(rideBetween('entrance', 'hall')).toBe(false);
    const p = pathOf(route('entrance', 'broomsticks'));
    expect(p.rides.some(Boolean)).toBe(true);
    expect(p.rides[0]).toBe(false);
    expect(p.lengths[p.lengths.length - 1]).toBeCloseTo(p.length);
    // (the road runs over the viaduct, never across the ravine from the lawn)
    expect(route('lawn', 'station')).toContain('viaduct');
  });

  it('starts a path from a point between spots and can end at a figure’s own place', () => {
    const p = pathOf(['staircase', 'entrance'], [0, -10], 'courtyard-door', [36, 9]);
    expect(p.points[0]).toEqual([0, -10]);
    expect(p.points[p.points.length - 1]).toEqual([36, 9]);
    expect(p.names[0]).toBe('courtyard-door');
  });

  it('tells inside from out along a walk', () => {
    expect(indoorAt('hall', 'high-table', 0.5)).toBe('greatHall');
    expect(indoorAt('staircase', 'gryffindor', 0.5)).toBe('castle');
    expect(indoorAt('staircase', 'gryffindor', 0.1)).toBe('staircase');
    expect(indoorAt('great-doors', 'lawn', 0.5)).toBeNull();
    expect(indoorAt('entrance', 'great-doors', 0.1)).toBe('castle');
  });

  it('turns a room’s own frame to the Map’s and back', () => {
    for (const room of [...Object.keys(ROOM_FRAMES), 'library']) {
      const p = [3.5, -7.25];
      const [x, z] = toRoom(room, fromRoom(room, p));
      expect(x).toBeCloseTo(p[0]);
      expect(z).toBeCloseTo(p[1]);
    }
    expect(spotOfRoom('greatHall').id).toBe('hall');
    // (the hall’s doors, +z in its own frame, face the Entrance Hall, east)
    const doors = fromRoom('greatHall', [0, 30]);
    expect(doors[0]).toBeGreaterThan(spotById('hall').at[0] + 20);
  });
});
