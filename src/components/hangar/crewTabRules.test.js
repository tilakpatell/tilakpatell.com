import { describe, expect, it } from 'vitest';
import { cardOf, crewOf } from './crewTabRules';

describe('the Hangar’s crew', () => {
  it('is each ship’s own two', () => {
    expect(crewOf('cruiser')).toEqual(['rick', 'morty']);
    expect(crewOf('rv')).toEqual(['walt', 'jesse']);
    expect(crewOf('xwing')).toEqual(['luke', 'artoo']);
    expect(crewOf('falcon')).toEqual(['han', 'chewie']);
    expect(crewOf('nope')).toEqual([]);
  });
  it('cards a Jedi with the blade in his style', () => {
    const c = cardOf('luke', { saber: { color: 'green', hilt: 'luke' } });
    expect(c.name).toBe('Luke Skywalker');
    expect(c.blade).toEqual({ hex: '#5cff6a', color: 'Green', hilt: 'Luke’s own' });
    expect(c.gun).toBe(null);
  });
  it('cards a gunman with his gun, his own when nothing’s picked', () => {
    expect(cardOf('han', {}).gun).toBe('DL-44');
    expect(cardOf('han', { gun: 'rifle' }).gun).toBe('E-11');
    expect(cardOf('han', { gun: 'nope' }).gun).toBe('DL-44');
    expect(cardOf('han', {}).blade).toBe(null);
  });
  it('cards Artoo with nothing to wear or carry', () => {
    const c = cardOf('artoo', {});
    expect(c.name).toBe('R2-D2');
    expect(c.outfit).toBe(null);
    expect(c.blade).toBe(null);
    expect(c.gun).toBe(null);
    expect(c.line.length).toBeGreaterThan(10);
  });
});
