import { describe, expect, it } from 'vitest';
import { MODES, liveLine, missionForMode, modesFor, readAsk } from './modes';
import { LANDABLE } from './sites';
import { missionOf } from './missions';
import BOOK from '../../../data/bf2017/modes.json';
import { landLine } from './landLine';
import { systemById } from '../systems';
import { gameMenuFor } from '../gameLevels';
import { tilesFor } from '../../../lib/bf2017/films';

const card = (system, id, ctx) => modesFor(system, ctx).find((c) => c.id === id);

describe('the modes on a world', () => {
  it('every landable world has a menu, free roam always live and a story card', () => {
    for (const id of LANDABLE) {
      const cards = modesFor(id);
      // (the other modes' cards only where the game fights them)
      expect(cards.map((c) => c.id)).toEqual(MODES.filter((m) => !m.where || (BOOK.worlds[id]?.modes ?? []).includes(m.id)).map((m) => m.id));
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
  it('Hoth: bf2-web’s engine in the lead tile and free roam the rest, the site’s own missions there withheld', () => {
    // (Hoth's battle is the engine's, gameLevels.js: the 2026-10-29 decision)
    expect(card('hoth', 'galacticAssault')).toMatchObject({ state: 'live', name: 'Play Battlefront', to: gameMenuFor('hoth') });
    for (const id of ['story', 'hvv', 'blast', 'supremacy']) expect(card('hoth', id), id).toMatchObject({ state: 'none', why: expect.stringMatching(/^Free roam only/) });
    expect(card('hoth', 'free')).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mode=free' });
    // (no space level over Hoth)
    expect(card('hoth', 'starfighter').state).toBe('none');
    // (with no engine there, the site's own rows, as lane H made them; a mode the level has and no mission yet, coming)
    const own = { engine: {} };
    expect(card('hoth', 'story', own)).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mission=transport' });
    expect(card('hoth', 'hvv', own)).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mode=hvv', mission: 'hvv' });
    expect(card('hoth', 'blast', own)).toMatchObject({ state: 'live', to: '/galaxy/hoth/surface?mode=blast', mission: 'blast' });
    expect(card('hoth', 'hvv', { ...own, missions: { hoth: {} } })).toMatchObject({ state: 'soon' });
    expect(card('hoth', 'hvv', { ...own, missions: { hoth: {} } }).why).toMatch(/Hoth/);
    expect(card('endor', 'galacticAssault')).toMatchObject({ state: 'live', to: '/galaxy/endor/surface?mode=galacticAssault', mission: 'assault' });
  });
  it('Starfighter Assault: live over Endor and Kamino (lane A’s), coming where the game has the space level and the site has not flown it yet', () => {
    expect(card('endor', 'starfighter')).toMatchObject({ state: 'live', to: '/galaxy/endor?battle=starfighter' });
    expect(card('kamino', 'starfighter')).toMatchObject({ state: 'live', to: '/galaxy/kamino?battle=starfighter' });
    expect(card('kamino', 'starfighter', { starfighter: {} }).state).toBe('soon');
  });
  it('a world the game never had: nothing but the site’s own', () => {
    expect(card('dagobah', 'galacticAssault').state).toBe('none');
    expect(card('dagobah', 'story').state).toBe('live');
  });
  it('?mode= and ?mission= come to the same mission, and to none on a world the engine plays', () => {
    expect(missionForMode('endor', 'galacticAssault')).toBe('assault');
    expect(missionOf('endor', missionForMode('endor', 'galacticAssault'))).toBe(missionOf('endor', 'assault'));
    expect(missionOf('endor', 'assault')).toBeTruthy();
    expect(missionForMode('hoth', 'story')).toBe('transport');
    expect(missionOf('hoth', missionForMode('hoth', 'story'))).toBeNull();
    expect(missionOf('hoth', 'assault')).toBeNull();
    expect(missionForMode('hoth', 'free')).toBeNull();
    expect(missionForMode('hoth', 'nonsense')).toBeNull();
    expect(missionForMode('dagobah', 'galacticAssault')).toBeNull();
  });
  it('a mission of a new kind joins its mode’s card', () => {
    const missions = { endor: { arena: { id: 'arena', kind: 'hvv', name: 'Bright Tree arena' } } };
    expect(card('endor', 'hvv', { missions })).toMatchObject({ state: 'live', to: '/galaxy/endor/surface?mode=hvv' });
    expect(missionForMode('endor', 'hvv', missions)).toBe('arena');
  });
  it('the Land button’s line, and the ask kept', () => {
    expect(liveLine('hoth')).toBe('Play Battlefront');
    expect(liveLine('hoth', { engine: {} })).toBe('Galactic Assault · Heroes vs Villains · Blast · Story');
    expect(readAsk('never')).toBe('never');
    expect(readAsk(null)).toBe('ask');
  });
  it('the galaxy panel’s light line says what the menu would', () => {
    // (a world that lands in the game's menu has no menu of this kind: its line is its briefing's)
    for (const id of LANDABLE) if (!gameMenuFor(id)) expect(landLine(systemById(id)), id).toBe(liveLine(id));
    expect(landLine(systemById('hoth'))).toBe('Galactic Assault');
  });
});

describe('the other modes on the menus (lane 6)', () => {
  it('Strike, Extraction, Ewok Hunt and Supremacy in the game’s words, coming where a level holds them and no pack plays it yet', () => {
    expect(MODES.filter((m) => m.where).map((m) => [m.id, m.name])).toEqual([
      ['strike', BOOK.names.modes.strike.text],
      ['extraction', BOOK.names.modes.extraction.text],
      ['ewokHunt', BOOK.names.modes.ewokHunt.text],
      ['supremacy', BOOK.names.modes.supremacy.text],
    ]);
    expect(card('naboo', 'strike')).toMatchObject({ state: 'soon' });
    expect(card('naboo', 'strike').why).toMatch(/Naboo/);
    expect(card('kessel', 'extraction')?.state ?? 'not landable').not.toBe('live');
    expect(card('endor', 'ewokHunt')).toMatchObject({ state: 'soon' });
    expect(card('hoth', 'supremacy', { engine: {} })).toMatchObject({ state: 'soon' });
    // (and no card where the game has none: Hoth has no Strike)
    expect(card('hoth', 'strike')).toBe(undefined);
  });
  it('a mission of the mode on a world makes its card live', () => {
    const missions = { naboo: { strike: { id: 'strike', kind: 'strike', name: 'Strike' } } };
    expect(card('naboo', 'strike', { missions })).toMatchObject({ state: 'live', to: '/galaxy/naboo/surface?mode=strike', mission: 'strike' });
  });
});

describe('the Land button’s line (lane 6)', () => {
  it('names a briefing’s Strike, Extraction, Ewok Hunt or Supremacy in the menu’s order', () => {
    const sys = { id: 'fixture', game: { status: 'soon', also: [{ to: '/galaxy/fixture/surface?mission=supremacy' }, { to: '/galaxy/fixture/surface?mission=strike' }] } };
    expect(landLine(sys)).toBe('Strike · Supremacy');
  });
});

describe('the films on the cards (the menu’s tiles)', () => {
  it('each mode carries the game’s menu film for it, or null where the game has none', () => {
    const TILES = { galacticAssault: 'assault', hvv: 'heroes', blast: 'skirmish', supremacy: 'supremacy' };
    for (const m of MODES) {
      expect(m.film === null || (typeof m.film.url === 'string' && typeof m.film.poster === 'string'), m.id).toBe(true);
      expect(m.film, m.id).toEqual(TILES[m.id] ? (tilesFor(TILES[m.id])[0] ?? null) : null);
    }
    // (and a world's cards bring theirs)
    expect(card('hoth', 'galacticAssault').film).toEqual(MODES.find((m) => m.id === 'galacticAssault').film);
    expect(card('hoth', 'free').film).toBe(null);
  });
});
