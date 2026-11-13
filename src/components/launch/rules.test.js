import { describe, expect, it } from 'vitest';
import { ARRIVE_GRACE, FIRST_DRAW_WAIT, after, arrival, covers, escapeWay, readyLine, routeOf, visitOf, wayLabel, waysIn } from './rules';
import { FLY_BRIEF, cardsFor } from './cards';
import { ASKED } from '../tour/brief';

describe('the launch', () => {
  it('reads index.html’s verdict on the visit', () => {
    expect(visitOf('1')).toBe('first');
    expect(visitOf('back')).toBe('back');
    expect(visitOf(undefined)).toBe(null);
    expect(visitOf('')).toBe(null);
  });

  it('offers a first visit the intro, and a return the view it last picked', () => {
    expect(waysIn({ visit: 'first', start: null })).toEqual({ main: 'intro', second: 'universe', alt: 'classic' });
    // (a first visit is a first visit, whatever a link left behind)
    expect(waysIn({ visit: 'first', start: 'home' }).main).toBe('intro');
    expect(waysIn({ visit: 'back', start: 'universe' })).toEqual({ main: 'universe', second: 'intro', alt: 'classic' });
    expect(waysIn({ visit: 'back', start: null }).main).toBe('universe');
    expect(waysIn({ visit: 'back', start: 'home' })).toEqual({ main: 'classic', second: 'universe', alt: 'intro' });
  });

  it('names every way in, for both visits', () => {
    for (const visit of ['first', 'back'])
      for (const way of ['intro', 'universe', 'classic']) expect(wayLabel(visit, way)).toMatch(/^[A-Z]/);
    expect(wayLabel('back', 'universe')).toBe('Enter the universe');
    expect(wayLabel('first', 'universe')).toBe('Skip to the universe');
  });

  it('lets Esc skip a first visit to the universe, and take a return’s main way in', () => {
    expect(escapeWay('first', waysIn({ visit: 'first' }))).toBe('universe');
    expect(escapeWay('back', waysIn({ visit: 'back', start: 'home' }))).toBe('classic');
    expect(escapeWay('back', waysIn({ visit: 'back', start: 'universe' }))).toBe('universe');
  });

  it('goes welcome, tour, crawl, cockpit, arrival; with reduced motion the tour ends in the universe', () => {
    const run = [];
    for (let s = 'welcome'; s; s = after(s)) run.push(s);
    expect(run).toEqual(['welcome', 'tour', 'crawl', 'cockpit', 'arrive']);
    expect(after('tour', { reduced: true })).toBe('arrive');
    expect(after('arrive')).toBe(null);
    expect(run.every(covers)).toBe(true);
    expect(covers(null)).toBe(false);
  });

  it('uncovers the map once it is made, and lets go once its first frame is drawn', () => {
    const since = 1000;
    const at = (state, now, uncoveredAt = null, onMap = true) => arrival({ map: { state }, since, now, uncoveredAt, onMap });
    expect(at('loading', since + 60000)).toBe('wait');
    expect(at('ready', since)).toBe('uncover');
    expect(at('drawing', since)).toBe('uncover');
    // (no map at all: given a while to come, then uncovered)
    expect(at('none', since + ARRIVE_GRACE - 1)).toBe('wait');
    expect(at('none', since + ARRIVE_GRACE)).toBe('uncover');
    // uncovered: the card stays over the first frame, a while at most
    expect(at('ready', 5000, 5000)).toBe('uncover');
    expect(at('drawing', 5000, 5000)).toBe('done');
    expect(at('none', 5000, 5000)).toBe('done');
    expect(at('ready', 5000 + FIRST_DRAW_WAIT, 5000)).toBe('done');
    // off the map: nothing to wait for
    expect(at('loading', since, null, false)).toBe('done');
  });

  it('says how the universe is getting on', () => {
    expect(readyLine({ state: 'loading', value: 0.424 })).toBe('Getting the universe ready · 42%');
    expect(readyLine({ state: 'loading', value: Number.NaN })).toBe('Getting the universe ready · 0%');
    expect(readyLine({ state: 'ready', value: 1 })).toBe('The universe is ready');
    expect(readyLine({ state: 'drawing', value: 1 })).toBe('The universe is ready');
    expect(readyLine({ state: 'none' })).toBe('');
  });

  it('lists the intro’s parts, and only the tour and the universe with reduced motion', () => {
    expect(routeOf().map((r) => r.id)).toEqual(['tour', 'crawl', 'cockpit', 'universe']);
    expect(routeOf({ reduced: true }).map((r) => r.id)).toEqual(['tour', 'universe']);
  });
});

describe('the quick tour’s cards', () => {
  const cards = cardsFor({ key: '⌘K' });

  it('are five, each with a title and something to read on any screen', () => {
    expect(cards).toHaveLength(5);
    for (const c of cards) {
      expect(c.title).toBeTruthy();
      expect(c.text || (c.rows?.length && c.touch)).toBeTruthy();
    }
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('read in about half a minute, on a keyboard or a touch screen', () => {
    const count = (touch) =>
      cards
        .flatMap((c) => [c.title, c.text, c.after, ...(touch && c.touch ? [c.touch] : (c.rows ?? []).map((r) => r.text))])
        .filter(Boolean)
        .join(' ')
        .split(/\s+/).length;
    // (a reader's 200 to 250 a minute: under 45 s at the slower)
    expect(count(false)).toBeLessThan(150);
    expect(count(true)).toBeLessThan(150);
  });

  it('give the palette’s own shortcut', () => {
    expect(cards.find((c) => c.id === 'help').rows.some((r) => r.keys.includes('⌘K'))).toBe(true);
  });

  it('stand in for the map’s first-flight brief', () => {
    expect(ASKED.has(FLY_BRIEF)).toBe(true);
  });
});
