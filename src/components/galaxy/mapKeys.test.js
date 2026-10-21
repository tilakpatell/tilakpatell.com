import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { courseOf, findSystems, mapKeyAction, pickAction, seedPick } from './mapKeys';

const k = (key, o = {}) => ({ key, meta: false, ctrl: false, alt: false, ...o });

describe('mapKeys', () => {
  it('closes on M and Escape, Escape even while typing', () => {
    expect(mapKeyAction(k('m'), { typing: false, canJump: false })).toBe('close');
    expect(mapKeyAction(k('M'), { typing: false, canJump: false })).toBe('close');
    expect(mapKeyAction(k('Escape'), { typing: true, canJump: false })).toBe('close');
    expect(mapKeyAction(k('m'), { typing: true, canJump: false })).toBeNull();
  });
  it('shuts the films panel first when it is open, and leaves the map', () => {
    expect(mapKeyAction(k('Escape'), { typing: false, filmsOpen: true })).toBe('closeFilms');
    expect(mapKeyAction(k('Escape'), { typing: true, filmsOpen: true })).toBe('closeFilms');
    expect(mapKeyAction(k('Escape'), { typing: false, filmsOpen: false })).toBe('close');
    // (only Escape shuts it: M still closes the map, the panel goes with it)
    expect(mapKeyAction(k('m'), { typing: false, filmsOpen: true })).toBe('close');
  });
  it('shuts the innermost open thing first: the find, the films, the key, the layers, then the map', () => {
    const open = { findOpen: true, filmsOpen: true, keyOpen: true, layersOpen: true };
    const esc = (o) => mapKeyAction(k('Escape'), { typing: false, ...o });
    expect(esc(open)).toBe('clearFind');
    expect(esc({ ...open, findOpen: false })).toBe('closeFilms');
    expect(esc({ ...open, findOpen: false, filmsOpen: false })).toBe('closeKey');
    expect(esc({ ...open, findOpen: false, filmsOpen: false, keyOpen: false })).toBe('closeLayers');
    expect(esc({})).toBe('close');
    // (from the find field too, typing or not)
    expect(mapKeyAction(k('Escape'), { typing: true, findOpen: true, keyOpen: true })).toBe('clearFind');
    expect(mapKeyAction(k('Escape'), { typing: true, keyOpen: true })).toBe('closeKey');
    expect(mapKeyAction(k('Escape'), { typing: true })).toBe('close');
    // (M still closes the map outright, whatever's open)
    expect(mapKeyAction(k('m'), { typing: false, ...open })).toBe('close');
  });
  it('picks a system, then jumps to it, and clears the pick of where you are', () => {
    expect(pickAction(null, 'endor', 'tatooine')).toBe('pick');
    expect(pickAction('hoth', 'endor', 'tatooine')).toBe('pick'); // (the second press of a double click, landing on another system)
    expect(pickAction('endor', 'endor', 'tatooine')).toBe('jump');
    expect(pickAction('tatooine', 'tatooine', 'tatooine')).toBe('clear');
    expect(pickAction(null, 'tatooine', 'tatooine')).toBe('pick');
  });
  it('has a course to a pick that is not where you are, and opens on the one the page kept', () => {
    expect(courseOf('endor', 'tatooine')).toBe('endor');
    expect(courseOf('tatooine', 'tatooine')).toBeNull();
    expect(courseOf(null, 'tatooine')).toBeNull();
    expect(seedPick('endor', 'tatooine', SYSTEMS)).toBe('endor');
    expect(seedPick(null, 'tatooine', SYSTEMS)).toBeNull();
    expect(seedPick(undefined, 'tatooine', SYSTEMS)).toBeNull();
    expect(seedPick('tatooine', 'tatooine', SYSTEMS)).toBeNull(); // (arrived: nothing to go to)
    expect(seedPick('nowhere', 'tatooine', SYSTEMS)).toBeNull();
  });
  it('jumps only with a course to jump to', () => {
    expect(mapKeyAction(k('j'), { typing: false, canJump: true })).toBe('jump');
    expect(mapKeyAction(k('j'), { typing: false, canJump: false })).toBeNull();
  });
  it('finds and zooms, and leaves modified keys alone', () => {
    expect(mapKeyAction(k('/'), { typing: false, canJump: false })).toBe('find');
    expect(mapKeyAction(k('+'), { typing: false })).toBe('zoomIn');
    expect(mapKeyAction(k('='), { typing: false })).toBe('zoomIn');
    expect(mapKeyAction(k('-'), { typing: false })).toBe('zoomOut');
    expect(mapKeyAction(k('0'), { typing: false })).toBe('fit');
    // (and Q and E turn the 3D map, unless it's a field being typed in)
    expect(mapKeyAction(k('q'), { typing: false })).toBe('turnLeft');
    expect(mapKeyAction(k('E'), { typing: false })).toBe('turnRight');
    expect(mapKeyAction(k('e'), { typing: true })).toBeNull();
    expect(mapKeyAction(k('m', { meta: true }), { typing: false })).toBeNull();
    expect(mapKeyAction(k('+'), { typing: true })).toBeNull();
  });
  it('leaves an event with no key (an autofill\'s) alone', () => {
    expect(mapKeyAction({ key: undefined, meta: false, ctrl: false, alt: false }, { typing: false })).toBeNull();
    expect(mapKeyAction({ key: null }, { typing: true })).toBeNull();
    expect(mapKeyAction({ key: 7 }, {})).toBeNull();
  });
  it('closes once for a held M: its repeats are nothing', () => {
    expect(mapKeyAction(k('m', { repeat: true }), { typing: false })).toBeNull();
    expect(mapKeyAction(k('M', { repeat: true }), { typing: false })).toBeNull();
    expect(mapKeyAction(k('m', { repeat: false }), { typing: false })).toBe('close');
    // (a held Escape or zoom key still acts: only M toggles)
    expect(mapKeyAction(k('Escape', { repeat: true }), { typing: false })).toBe('close');
    expect(mapKeyAction(k('+', { repeat: true }), { typing: false })).toBe('zoomIn');
  });
  it('finds systems by name, the ones that start with it first', () => {
    expect(findSystems('endo', SYSTEMS).map((s) => s.id)).toEqual(['endor']);
    expect(findSystems('  ', SYSTEMS)).toEqual([]);
    const ho = findSystems('o', SYSTEMS, 3);
    expect(ho.length).toBeLessThanOrEqual(3);
    const t = findSystems('t', SYSTEMS);
    const firstNonStart = t.findIndex((s) => !s.name.toLowerCase().startsWith('t'));
    const lastStart = t.map((s) => s.name.toLowerCase().startsWith('t')).lastIndexOf(true);
    if (firstNonStart !== -1) expect(lastStart).toBeLessThan(firstNonStart);
  });
});
