import { describe, expect, it } from 'vitest';
import { EMBLEMS, EMBLEM_BOX, GAME_SIDES, emblemOf } from './emblems';
import { SIDES } from './sides';

describe('the sides’ crests', () => {
  it('has one for every side, and none for anyone else', () => {
    expect(Object.keys(EMBLEMS).sort()).toEqual(Object.keys(SIDES).sort());
  });
  it('draws each as SVG paths in its box', () => {
    expect(EMBLEM_BOX).toBe('0 0 24 24');
    for (const [id, shapes] of Object.entries(EMBLEMS)) {
      expect(shapes.length, id).toBeGreaterThan(0);
      for (const s of shapes) {
        expect(s.d, id).toMatch(/^M[\d\s.,MLHVCSQTAZmlhvcsqtaz-]+$/);
        // (every number inside the box)
        for (const n of s.d.match(/-?\d*\.?\d+/g)) expect(Math.abs(Number(n)), id).toBeLessThanOrEqual(24);
        if (s.evenodd !== undefined) expect(typeof s.evenodd).toBe('boolean');
      }
    }
  });
  it('tells every side apart: no two crests alike', () => {
    const drawn = Object.values(EMBLEMS).map((shapes) => shapes.map((s) => s.d).join('|'));
    expect(new Set(drawn).size).toBe(drawn.length);
  });
});

describe('the sides the 2017 game has wear its faction icons (lane S3)', () => {
  it('resolves the four to the game’s sprite, and the rest to the site’s crests', () => {
    expect(emblemOf('rebel')).toEqual({ sprite: '/ui/bf2017/factions.svg', href: '/ui/bf2017/factions.svg#factions-icon-rebelalliance' });
    expect(emblemOf('empire').href).toBe('/ui/bf2017/factions.svg#factions-icon-galacticempire');
    expect(emblemOf('republic').href).toBe('/ui/bf2017/factions.svg#factions-icon-galacticrepublic');
    expect(emblemOf('separatists').href).toBe('/ui/bf2017/factions.svg#factions-icon-separatists');
    for (const side of ['newrepublic', 'remnant', 'hutt']) expect(emblemOf(side), side).toEqual({ shapes: EMBLEMS[side] });
    expect(emblemOf('nobody')).toBe(null);
    expect(Object.keys(GAME_SIDES).sort()).toEqual(['empire', 'rebel', 'republic', 'separatists']);
  });
});
