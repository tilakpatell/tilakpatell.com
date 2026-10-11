import { describe, expect, it } from 'vitest';
import { CLIPS } from '../../lib/clips';
import { CREWS, crewById, linesFor } from '../universe/crews';
import { CRAWLS } from './crawls';
import { GALAXY_LINES, galaxyCrew } from './lines';
import { FILMS, SYSTEMS } from './systems';

const EVENTS = ['jump', 'course', 'tractor', 'boarded', 'ion', 'superlaser', 'shield-down', 'shield-up', 'scarif-shield', 'escaped', 'destroyer', 'wellclear', 'gcw-shieldgen', 'gcw-superlaser', 'gcw-run', 'gcw-reactor', 'gcw-ds2', 'gcw-executor', 'gcw-hangar', 'gcw-isd', 'gcw-ram', 'gcw-gate', 'gcw-evacuated', 'find'];
const HUNTED = ['separatists', 'remnant', 'weequay', 'rebellion', 'rebelnavy', 'newrepublic', 'republic', 'republicnavy', 'escort']; // (what every crew has a galaxy line for)
const OUTLAWS = ['navy', 'fett', 'ig88', 'bossk', 'dengar', 'weequay']; // roamRules.js's: a line each, the crew's own or the galaxy's
const KILLS = ['vulture', 'trifighter'];
const sorted = (a) => [...a].sort();
const words = (p) => p.split(/\s+/).filter(Boolean).length;

// every exchange a crew has in the galaxy, named for the test's messages
// (the war's battle lines are battleLines.js's, by side: tested there)
const exchanges = (id) => [
  ...['arrive', 'events', 'hunted', 'kill'].flatMap((group) =>
    Object.entries(GALAXY_LINES[id][group]).flatMap(([key, ex]) => (Array.isArray(ex) ? [[`${id} ${group} ${key}`, ex]] : Object.entries(ex).map(([sub, e]) => [`${id} ${group} ${key} ${sub}`, e]))),
  ),
  [`${id} interdicted`, GALAXY_LINES[id].interdicted],
];

describe('the crews in the galaxy', () => {
  it('are the four crews of the universe map', () => {
    expect(sorted(Object.keys(GALAXY_LINES))).toEqual(sorted(CREWS.map((c) => c.id)));
  });

  it('have something to say the first time they reach every system', () => {
    for (const crew of CREWS) expect(sorted(Object.keys(GALAXY_LINES[crew.id].arrive)), crew.id).toEqual(sorted(SYSTEMS.map((s) => s.id)));
  });

  it('have a word for every set piece, every hunter and every kill', () => {
    for (const crew of CREWS) {
      const g = GALAXY_LINES[crew.id];
      expect(sorted(Object.keys(g.events)), crew.id).toEqual(sorted(EVENTS));
      expect(Object.keys(g.hunted), crew.id).toEqual(expect.arrayContaining(HUNTED));
      for (const who of OUTLAWS) expect(linesFor(galaxyCrew(crew), 'hunted', who), `${crew.id} hunted ${who}`).toBeTruthy();
      expect(sorted(Object.keys(g.kill)), crew.id).toEqual(sorted(KILLS));
      // and for the Interdictor pulling them out of hyperspace
      expect(Array.isArray(g.interdicted), crew.id).toBe(true);
    }
  });

  it('say every line in their own voices, or on the comms, in a breath', () => {
    for (const crew of CREWS) {
      for (const [what, exchange] of exchanges(crew.id)) {
        expect(Array.isArray(exchange) && exchange.length, what).toBeGreaterThan(0);
        expect(exchange.length, what).toBeLessThanOrEqual(4);
        for (const line of exchange) {
          expect(Array.isArray(line) && line.length >= 2 && line.length <= 3, `${what}: ${line}`).toBe(true);
          const [who, text] = line;
          expect(who === 'comms' || Boolean(crew.speakers[who]), `${what}: ${who}`).toBe(true);
          expect(typeof text, what).toBe('string');
          expect(text.length, what).toBeGreaterThan(2);
          expect(text.length, `${what}: ${text}`).toBeLessThanOrEqual(120);
          // typographic apostrophes and quotes, as the crews' own lines have them
          expect(text, what).not.toMatch(/['"]/);
          // Artoo and Chewie don't speak Basic: they say what they mean, in brackets
          if (who === 'r2' || who === 'chewie') expect(text, what).toMatch(/^\[.+\]$/);
        }
      }
    }
  });

  it('only play clips the site has, and say them word for word', () => {
    for (const crew of CREWS) {
      for (const [what, exchange] of exchanges(crew.id)) {
        for (const [who, text, clip] of exchange) {
          if (clip === undefined) continue;
          expect(CLIPS[clip], `${what}: ${clip}`).toBeTruthy();
          // a recorded line is said as it was recorded; a sound (a roar, a whistle) goes under a bracketed line
          if (CLIPS[clip].line) expect(text, `${what}: ${clip}`).toBe(CLIPS[clip].line);
          else expect(text, `${what}: ${clip} (${who})`).toMatch(/^\[.+\]$/);
        }
      }
    }
  });
});

describe('galaxyCrew', () => {
  it('lays the galaxy’s lines over a crew’s own', () => {
    for (const crew of CREWS) {
      const g = GALAXY_LINES[crew.id];
      const flying = galaxyCrew(crew);
      // the same crew, ship and voices
      for (const k of ['id', 'ship', 'label', 'speakers', 'launch', 'boost', 'bump', 'crash', 'hit', 'shields', 'destroyed', 'escaped', 'cleared']) expect(flying[k], `${crew.id}.${k}`).toBe(crew[k]);
      // the galaxy's systems instead of the universe map's places
      expect(flying.arrive).toBe(g.arrive);
      expect(linesFor(flying, 'arrive', 'home')).toBeNull();
      for (const s of SYSTEMS) expect(linesFor(flying, 'arrive', s.id), `${crew.id} ${s.id}`).toBe(g.arrive[s.id]);
      // the galaxy's events, hunters and kills, over the crew's own
      for (const id of EVENTS) expect(linesFor(flying, 'event', id), `${crew.id} ${id}`).toBe(g.events[id]);
      for (const id of Object.keys(crew.events ?? {})) if (!EVENTS.includes(id)) expect(linesFor(flying, 'event', id), `${crew.id} ${id}`).toBe(linesFor(crew, 'event', id)); // (what the crew would say: an event's lines may be keyed by what came)
      for (const id of HUNTED) expect(linesFor(flying, 'hunted', id)).toBe(g.hunted[id]);
      for (const [id, ex] of Object.entries(crew.hunted)) expect(linesFor(flying, 'hunted', id), `${crew.id} hunted ${id}`).toBe(g.hunted[id] ?? ex); // (the galaxy's own words for a hunter where it has them)
      for (const id of KILLS) expect(linesFor(flying, 'kill', id)).toBe(g.kill[id]);
      expect(linesFor(flying, 'kill', 'any')).toBe(crew.kill.any);
      // and the Interdictor's own words over the universe map's
      expect(linesFor(flying, 'interdicted')).toBe(g.interdicted);
      expect(crew.interdicted).not.toBe(g.interdicted);
      expect(linesFor(flying, 'kill', 'nothing-like-it')).toBe(crew.kill.any);
    }
  });

  it('leaves the crews themselves as they were', () => {
    const falcon = crewById('falcon');
    const before = { arrive: falcon.arrive, events: { ...falcon.events }, hunted: { ...falcon.hunted }, kill: { ...falcon.kill } };
    galaxyCrew(falcon);
    expect(falcon.arrive).toBe(before.arrive);
    expect(falcon.events).toEqual(before.events);
    expect(falcon.hunted).toEqual(before.hunted);
    expect(falcon.kill).toEqual(before.kill);
    expect(falcon.events.jump).toBeUndefined();
  });

  it('takes no crew, or one it doesn’t know, as it comes', () => {
    expect(galaxyCrew(null)).toBeNull();
    expect(galaxyCrew(undefined)).toBeNull();
    const stranger = { id: 'stranger', arrive: {} };
    expect(galaxyCrew(stranger)).toBe(stranger);
  });
});

describe('the crawls', () => {
  it('brief every system’s mission', () => {
    expect(sorted(Object.keys(CRAWLS))).toEqual(sorted(SYSTEMS.map((s) => s.id)));
  });

  it('open the way the films do', () => {
    for (const s of SYSTEMS) {
      const c = CRAWLS[s.id];
      const film = FILMS[s.game.film];
      // (a show's: its title and the chapter)
      if (film.show) expect(c.episode, s.id).toMatch(new RegExp(`^${film.title}, (Chapter|Part) [A-Z0-9]`));
      // (the 2017 game's campaign, lane E5's worlds: its own title)
      else if (film.game) expect(c.episode, s.id).toBe(film.title);
      else expect(c.episode, s.id).toBe(film.episode ? `Episode ${film.episode}` : 'A Star Wars Story');
      expect(c.title, s.id).toBe(s.game.title);
      expect(c.paragraphs, s.id).toHaveLength(3);
      for (const p of c.paragraphs) {
        expect(words(p), `${s.id}: ${p}`).toBeGreaterThanOrEqual(25);
        expect(words(p), `${s.id}: ${p}`).toBeLessThanOrEqual(55);
        expect(p, s.id).not.toMatch(/['"]/);
      }
      expect(c.paragraphs[2].endsWith('…'), s.id).toBe(true);
      for (const p of c.paragraphs.slice(0, 2)) expect(p.endsWith('…'), s.id).toBe(false);
    }
  });
});
