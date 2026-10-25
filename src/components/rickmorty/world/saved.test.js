import { describe, expect, it } from 'vitest';
import { POSTERS } from './town/plan';
import { MORTY_BEST } from './roy/rules';
import { DONE, POSTERS_READ, ROY, saved } from './saved';

// a store as lib/hooks.js's local is: get(key, fallback), set(key, value)
const store = (init = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return { get: (k, f = null) => (m.has(k) ? JSON.parse(m.get(k)) : f), set: (k, v) => m.set(k, JSON.stringify(v)), raw: m };
};
const ALL_POSTERS = POSTERS.map((p) => p.id);

describe('what C-137 keeps between visits', () => {
  it('reads the things done once each, the ones it knows', () => {
    expect(saved(store({ [DONE]: ['cable', 'cable', 'nope', 'butter'] })).readDone()).toEqual(['cable', 'butter']);
    expect(saved(store({ [DONE]: 'junk' })).readDone()).toEqual([]);
  });

  it('keeps a thing done over what another tab has kept since, not over this tab’s own copy', () => {
    const s = store({ [DONE]: ['cable', 'birdworld'] });
    // (this tab read ['cable'] when it opened; the other tab ticked Bird World since)
    expect(saved(s).addDone(['cable'], 'butter')).toEqual(['cable', 'birdworld', 'butter']);
    expect(s.get(DONE)).toEqual(['cable', 'birdworld', 'butter']);
    // (and with nothing new, what's kept and what's here, together)
    expect(saved(store({ [DONE]: ['wong'] })).addDone(['cable'])).toEqual(['wong', 'cable']);
  });

  it('starts with Roy’s and the posters’ caught up: a life lived, one past Morty’s 55, all five posters read', () => {
    const s = store({ [DONE]: ['cable'], [ROY]: { lives: 1, best: MORTY_BEST + 1 }, [POSTERS_READ]: ALL_POSTERS });
    expect(saved(s).startDone()).toEqual(['cable', 'roy', 'roy55', 'posters']);
    expect(s.get(DONE)).toEqual(['cable', 'roy', 'roy55', 'posters']);
    // (four posters read: not yet)
    expect(saved(store({ [POSTERS_READ]: ALL_POSTERS.slice(1) })).startDone()).toEqual([]);
  });

  it('reads the posters read, and Roy’s best', () => {
    expect(saved(store({ [POSTERS_READ]: [ALL_POSTERS[0], 'nope'] })).postersRead()).toEqual([ALL_POSTERS[0]]);
    expect(saved(store({ [ROY]: { best: 61.7 } })).readBest()).toBe(61);
    expect(saved(store()).readBest()).toBe(null);
  });
});
