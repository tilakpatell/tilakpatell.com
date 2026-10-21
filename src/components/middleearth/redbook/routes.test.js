import { describe, expect, it } from 'vitest';
import { PINS, bookPageFor, bookPageForStage, goFor, playTo, walkFor, walkTo } from './routes';
import { STAGES } from '../road/stages/index';
import { PAGES } from './pages';

describe('where the book and the stone go', () => {
  it('plays a chapter at its address, and walks the Road from a stage', () => {
    expect(playTo(PAGES.find((p) => p.id === 'bree'))).toBe('/middle-earth/bree');
    expect(walkTo(PAGES.find((p) => p.id === 'bree'))).toBe('/middle-earth/road?at=bree');
    expect(playTo(PAGES.find((p) => p.id === 'havens'))).toBeNull();
  });

  it('pins every page on the stone’s map, and the places without a page', () => {
    for (const p of PAGES) expect(PINS.some((x) => x.page === p.id)).toBe(true);
    expect(PINS.find((x) => x.id === 'orthanc')).toMatchObject({ page: null, to: '/middle-earth/orthanc' });
    expect(new Set(PINS.map((x) => x.id)).size).toBe(PINS.length);
    for (const x of PINS) expect(x.at).toHaveLength(2);
  });

  it('a pin with a page opens the book there; one without, its game', () => {
    expect(goFor(PINS.find((x) => x.page === 'moria'))).toEqual({ page: 'moria' });
    expect(goFor(PINS.find((x) => x.id === 'edoras'))).toEqual({ to: '/middle-earth/edoras' });
  });

  it('a chapter’s game goes back to its own page of the book, and its stage of the Road', () => {
    expect(bookPageFor('shire')).toBe('bag-end');
    expect(bookPageFor('weathertop')).toBe('weathertop');
    expect(bookPageFor('mordor')).toBe('doom');
    expect(walkFor('mordor')).toBe('gorgoroth');
    // (a game with no page opens the book at its start, and has no stage)
    expect(bookPageFor('orthanc')).toBe(PAGES[0].id);
    expect(walkFor('edoras')).toBeNull();
  });

  it('every stage of the Road goes back to a page of the book', () => {
    expect(bookPageForStage('bree')).toBe('bree');
    expect(bookPageForStage('gorgoroth')).toBe('doom');
    expect(bookPageForStage('ithilien')).toBe('marshes');
    const ids = new Set(PAGES.map((p) => p.id));
    for (const st of STAGES) expect(ids.has(bookPageForStage(st.id))).toBe(true);
  });
});
