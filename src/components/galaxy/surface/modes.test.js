import { describe, expect, it } from 'vitest';
import { MODES, liveLine, missionForMode, modesFor, readAsk } from './modes';
import { LANDABLE } from './sites';
import { missionOf } from './missions';
import BOOK from '../../../data/bf2017/modes.json';
import { landLine } from './landLine';
import { systemById } from '../systems';

const card = (system, id, ctx) => modesFor(system, ctx).find((c) => c.id === id);

describe('the modes on a world', () => {
  it('every landable world has a menu, free roam always live and a story card', () => {
    for (const id of LANDABLE) {
      const cards = modesFor(id);
      expect(cards.map((c) => c.id)).toEqual(MODES.map((m) => m.id));
      expect(card(id, 'free').state).toBe('live');
      expect(card(id, 'story')).toBeTruthy();
      // (anything not live says why)
      for (const c of cards) if (c.state !== 'live') expect(c.why, `${id} ${c.id}`).toMatch(/\S/);
    }
  });
  it('names the modes in the game’s own words', () => {
    expect(MODES.find((m) => m.id === 'galacticAssault').name).toBe(BOOK.names.modes.galacticAssault.text);
    expect(MODES.find((m) => m.id === 'hvv').name).toBe('Heroes vs Villains');
  });
  it('Hoth: Galactic Assault live, its story live, Heroes vs Villains on the game’s level but not made yet', () => {
    expect(card('hoth', 'galacticAssault')).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mode=galacticAssault' });
    expect(card('hoth', 'story')).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mission=transport' });
    expect(card('hoth', 'hvv')).toMatchObject({ state: 'soon' });
    expect(card('hoth', 'hvv').why).toMatch(/Hoth/);
    // (no space level over Hoth)
    expect(card('hoth', 'starfighter').state).toBe('none');
  });
  it('Starfighter Assault: live over Endor (lane A’s), coming over Kamino, whose space level the game has', () => {
    expect(card('endor', 'starfighter')).toMatchObject({ state: 'live', to: '/galaxy/endor?battle=starfighter' });
    expect(card('kamino', 'starfighter').state).toBe('soon');
    expect(card('kamino', 'starfighter', { starfighter: { kamino: '/galaxy/kamino?battle=starfighter' } })).toMatchObject({ state: 'live', to: '/galaxy/kamino?battle=starfighter' });
  });
  it('a world the game never had: nothing but the site’s own', () => {
    expect(card('dagobah', 'galacticAssault').state).toBe('none');
    expect(card('dagobah', 'story').state).toBe('live');
  });
  it('?mode= and ?mission= come to the same mission', () => {
    expect(missionForMode('hoth', 'galacticAssault')).toBe('assault');
    expect(missionOf('hoth', missionForMode('hoth', 'galacticAssault'))).toBe(missionOf('hoth', 'assault'));
    expect(missionForMode('hoth', 'story')).toBe('transport');
    expect(missionForMode('hoth', 'free')).toBeNull();
    expect(missionForMode('hoth', 'nonsense')).toBeNull();
    expect(missionForMode('dagobah', 'galacticAssault')).toBeNull();
  });
  it('a mission of a new kind joins its mode’s card', () => {
    const missions = { hoth: { arena: { id: 'arena', kind: 'hvv', name: 'Echo Base arena' } } };
    expect(card('hoth', 'hvv', { missions })).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mode=hvv' });
    expect(missionForMode('hoth', 'hvv', missions)).toBe('arena');
  });
  it('the Land button’s line, and the ask kept', () => {
    expect(liveLine('hoth')).toBe('Galactic Assault · Story');
    expect(readAsk('never')).toBe('never');
    expect(readAsk(null)).toBe('ask');
  });
  it('the galaxy panel’s light line says what the menu would', () => {
    for (const id of LANDABLE) expect(landLine(systemById(id)), id).toBe(liveLine(id));
  });
});
