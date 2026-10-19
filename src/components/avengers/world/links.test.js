import { readFileSync } from 'node:fs';
import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HQ_HOME, LINKS, backTarget, gameOf, hqState, inHq, linkOf, placeOf } from './links';
import { PLACES } from './rules';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('the compound’s addresses', () => {
  it('names each building by its place, as the spec’s table does, in the compound’s order', () => {
    expect(HQ_HOME).toBe('/avengers');
    expect(Object.fromEntries(LINKS.map((l) => [l.slug, l.id]))).toEqual({ workshop: 'stark', lawn: 'thor', training: 'cap', range: 'hawkeye', operations: 'widow', lab: 'banner', gate: 'spidey', hangar: 'vault' });
    expect(LINKS.map((l) => l.id)).toEqual(PLACES.map((p) => p.id));
  });

  it('goes both ways', () => {
    for (const p of PLACES) {
      const to = linkOf(p.id);
      expect(to, p.id).toMatch(/^\/avengers\/[a-z]+$/);
      expect(placeOf(to.slice('/avengers/'.length)), p.id).toBe(p.id);
    }
    expect(linkOf('spidey')).toBe('/avengers/gate');
    expect(placeOf('hangar')).toBe('vault');
  });

  it('knows no other slug or place', () => {
    for (const s of ['nowhere', 'stark', 'Gate', 'gate/', ' gate', '', undefined, null, 7]) expect(placeOf(s), String(s)).toBe(null);
    for (const id of ['nobody', 'gate', '', undefined, null]) expect(linkOf(id), String(id)).toBe(null);
  });

  it('names each game as its own title screen does', () => {
    expect(LINKS.map((l) => l.game)).toEqual(['Repulsor Range', 'Hold the Lawn', 'Ricochet', 'Trick Shot', 'Infiltration', 'Smash Run', 'Thwip!', 'Tesseract Run']);
    expect(gameOf('cap')).toBe('Ricochet');
    expect(gameOf('nobody')).toBe(null);
  });

  it('tells the compound’s addresses from the rest, as the router matches them', () => {
    for (const p of ['/avengers', '/avengers/', '/avengers/gate', '/avengers/gate/', '/avengers/nowhere', '/Avengers/Gate']) expect(inHq(p), p).toBe(true);
    for (const p of ['/', '/avengersx', '/avengers/gate/deeper', '/middle-earth/moria', '', undefined, null]) expect(inHq(p), String(p)).toBe(false);
  });

  it('goes back in the page only from a door the page opened, else puts the compound in its place', () => {
    expect(hqState).toEqual({ hq: true });
    expect(backTarget({ state: hqState, key: 'k1' })).toBe(-1);
    expect(backTarget({ state: { hq: true }, key: 'k1' })).toBe(-1); // reloaded: the entry keeps its state and key
    expect(backTarget({ state: null, key: 'k1' })).toBe(HQ_HOME); // the palette, the checklist, the tour
    expect(backTarget({ state: null, key: 'default' })).toBe('/avengers'); // a shared link, the first entry
    expect(backTarget({ state: hqState, key: 'default' })).toBe('/avengers');
    expect(backTarget({ state: { feed: true }, key: 'k1' })).toBe('/avengers');
    expect(backTarget(undefined)).toBe('/avengers');
  });

  it('is one route App.jsx declares, matched as the router matches, on one page', () => {
    const app = read('../../../App.jsx');
    const pats = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*'); // (the not-found page matches anything)
    expect(pats).toContain('/avengers/:place?');
    expect(pats).not.toContain('/avengers');
    for (const to of [HQ_HOME, ...LINKS.map((l) => linkOf(l.id))]) expect(pats.filter((p) => matchPath({ path: p, end: true }, to)), to).toEqual(['/avengers/:place?']);
    expect(app).toMatch(/inHq\(pathname\)\s*\?\s*'\/avengers'/); // pageKey: one page for every address
  });
});
