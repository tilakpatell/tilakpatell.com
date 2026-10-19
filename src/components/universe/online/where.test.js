import { describe, expect, it } from 'vitest';
import { AWAY, UNIVERSE, cleanWhere, isFlight, ownCorner, placeName, whereOf } from './where';

describe('whereOf', () => {
  it('keeps Avengers HQ one place while a building’s game is open over it', () => {
    for (const p of ['/avengers', '/avengers/gate', '/avengers/nowhere']) expect(whereOf(p), p).toBe('/avengers');
    expect(whereOf('/avengersx')).toBe('/avengersx');
  });
  it('keeps one place for the map and the experience page', () => {
    expect(whereOf('/')).toBe(UNIVERSE);
    expect(whereOf('/universe/marvel')).toBe(UNIVERSE);
    expect(whereOf('/experience/aws')).toBe('/experience');
    expect(whereOf('/deathstar')).toBe('/deathstar');
  });
  it('keeps each of Middle-earth\'s chapters a place of its own, and the map another', () => {
    expect(whereOf('/middle-earth')).toBe('/middle-earth');
    expect(whereOf('/middle-earth/moria')).toBe('/middle-earth/moria');
    expect(whereOf('/middle-earth/bree/')).toBe('/middle-earth/bree');
    expect(whereOf('/middle-earth/bree/extra')).toBe('/middle-earth/bree');
  });
  it('keeps each of the galaxy\'s systems a place of its own', () => {
    expect(whereOf('/galaxy/hoth')).toBe('/galaxy/hoth');
    expect(whereOf('/galaxy')).toBe('/galaxy');
  });
});

describe('isFlight', () => {
  it('is the universe map and the galaxy\'s systems, not the pages', () => {
    expect(isFlight(UNIVERSE)).toBe(true);
    expect(isFlight('/galaxy')).toBe(true);
    expect(isFlight('/galaxy/endor')).toBe(true);
    expect(isFlight('/galaxy/endor/mission')).toBe(false);
    expect(isFlight('/deathstar')).toBe(false);
    expect(isFlight(null)).toBe(false);
  });
});

describe('ownCorner', () => {
  it('is where the page draws the roster itself: in flight, and down on a world in the galaxy', () => {
    expect(ownCorner(UNIVERSE)).toBe(true);
    expect(ownCorner('/galaxy/hoth')).toBe(true);
    expect(ownCorner('/galaxy/hoth/surface')).toBe(true);
    expect(ownCorner('/galaxy/hoth/mission')).toBe(false);
    expect(ownCorner('/middle-earth/bree')).toBe(false);
    expect(ownCorner(null)).toBe(false);
  });
});

describe('cleanWhere', () => {
  it('takes a page key and nothing else', () => {
    expect(cleanWhere('/c-137')).toBe('/c-137');
    expect(cleanWhere('/projects/gameboy-emulator')).toBe('/projects/gameboy-emulator');
    expect(cleanWhere('javascript:alert(1)')).toBeNull();
    expect(cleanWhere('/<b>')).toBeNull();
    expect(cleanWhere('/' + 'a'.repeat(80))).toBeNull();
    expect(cleanWhere(7)).toBeNull();
  });
});

describe('placeName', () => {
  it('names the worlds and pages', () => {
    expect(placeName(UNIVERSE)).toBe('the universe');
    expect(placeName('/middle-earth')).toBe('Middle-earth');
    expect(placeName('/deathstar')).toBe('the Death Star');
    expect(placeName('/home')).toBe('Home');
    expect(placeName('/projects/something-else')).toBe('a project');
    expect(placeName('/scranton')).toBeTruthy();
    expect(placeName(null)).toBe('somewhere');
    expect(placeName('/galaxy')).toBe('a galaxy far, far away');
    expect(placeName('/galaxy/mandalore')).toBe('Mandalore');
    expect(placeName('/galaxy/hoth/mission')).toBe('the Hoth briefing');
    expect(placeName('/galaxy/hoth/surface')).toBe('down on Hoth');
    expect(placeName('/galaxy/nowhere')).toBe('Galaxy');
  });
  it('names Middle-earth\'s chapters, the hidden ones too', () => {
    expect(placeName('/middle-earth/bree')).toBe('Bree');
    expect(placeName('/middle-earth/shire')).toBe('The Shire');
    expect(placeName('/middle-earth/orthanc')).toBe('Orthanc');
    expect(placeName('/middle-earth/nowhere')).toBe('Middle-earth');
  });
  it('names the Citadel', () => {
    expect(placeName('/c-137/citadel')).toBe('the Citadel');
  });
  it('names a Rick and Morty planet\'s world for the planet, not C-137', () => {
    expect(whereOf('/c-137/squanch')).toBe('/c-137/squanch');
    expect(placeName('/c-137/squanch')).toBe('Planet Squanch');
    expect(placeName('/c-137/purge')).toBe('the Purge Planet');
    expect(placeName('/c-137')).toBe('Dimension C-137');
  });
});

describe('a page on no map', () => {
  it('tells the other pilots only that you are somewhere else', () => {
    expect(whereOf('/dickansh')).toBe(AWAY);
    expect(placeName(AWAY)).toBe('somewhere else');
    expect(placeName(whereOf('/dickansh'))).not.toMatch(/dick/i);
  });
});
