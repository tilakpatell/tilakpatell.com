import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { landsOnSurface } from '../components/galaxy/gameLevels';
import { GUIDES } from '../components/guide/routes';
import { SHELL_KEYS } from '../lib/visited';
import { THING_AUDIENCES, THINGS_TO_DO, isDone, todoFor } from './todo';

const src = join(import.meta.dirname, '..');

// The routes App.jsx declares, read as text so the test needn't load every
// page, and matched with the router's own matchPath, as the site matches them.
const patterns = () =>
  [...readFileSync(join(src, 'App.jsx'), 'utf8').matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');
const routed = (pats, to) => {
  const path = to.split(/[?#]/)[0];
  return pats.some((p) => matchPath({ path: p, end: true }, path));
};

// The achievement ids, read from the map's text: Achievements.jsx brings
// React, the theme and the universe's outfitting with it.
const achievementIds = () => {
  const text = readFileSync(join(src, 'components', 'Achievements.jsx'), 'utf8');
  const map = text.slice(text.indexOf('export const ACHIEVEMENTS = {'), text.indexOf('\n};', text.indexOf('export const ACHIEVEMENTS = {')));
  return new Set([...map.matchAll(/^ {2}(?:'([\w-]+)'|(\w+)): \{ name:/gm)].map((m) => m[1] ?? m[2]));
};

const KINDS = ['page', 'section', 'world', 'game', 'mission', 'mini-game', 'multiplayer', 'easter-egg', 'tool'];
const visitedOf = (t) => (t.done && 'visited' in t.done ? [].concat(t.done.visited) : []);
const DONE_KINDS = ['["achievement"]', '["visited"]', '["key"]', '["is","key"]'];

describe('the things to do', () => {
  it('has about sixty, each with an id of its own', () => {
    expect(THINGS_TO_DO.length).toBeGreaterThanOrEqual(50);
    expect(THINGS_TO_DO.length).toBeLessThanOrEqual(75);
    expect(new Set(THINGS_TO_DO.map((t) => t.id)).size).toBe(THINGS_TO_DO.length);
  });

  it('goes somewhere the site has a route for, matched as the router matches', () => {
    const pats = patterns();
    expect(pats.length).toBeGreaterThan(20);
    for (const t of THINGS_TO_DO) expect(routed(pats, t.to), `${t.id}: ${t.to}`).toBe(true);
  });

  it('never sends anyone to a surface that is no place any more: a game world’s ground is the game’s own menu', () => {
    for (const t of THINGS_TO_DO)
      for (const to of [t.to, ...visitedOf(t)]) {
        const system = /^\/galaxy\/([^/?]+)\/surface/.exec(to)?.[1];
        if (system) expect(landsOnSurface(system), `${t.id}: ${to}`).toBe(true);
      }
    expect(THINGS_TO_DO.find((t) => t.id === 'galactic-assault')).toMatchObject({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', done: { visited: '/battlefront/hoth' } });
  });

  it('never goes by a hash, nor counts one as visited', () => {
    for (const t of THINGS_TO_DO) {
      expect(t.to, t.id).not.toContain('#');
      for (const v of visitedOf(t)) expect(v, t.id).not.toMatch(/[#?]/);
    }
  });

  it('keeps out of the private page', () => {
    for (const t of THINGS_TO_DO) {
      expect(t.to.split(/[?#]/)[0], t.id).not.toMatch(/^\/dickansh(\/|$)/);
      for (const v of visitedOf(t)) expect(v, t.id).not.toMatch(/^\/dickansh(\/|$)/);
    }
  });

  it('groups under one of the guide’s pages', () => {
    for (const t of THINGS_TO_DO) expect(GUIDES[t.area], `${t.id}: ${t.area}`).toBeTruthy();
  });

  it('is ticked by a real achievement, a route, one of the shell’s keys, or nothing', () => {
    const ids = achievementIds();
    expect(ids.size).toBeGreaterThan(200);
    const pats = patterns();
    for (const t of THINGS_TO_DO) {
      expect('done' in t, t.id).toBe(true);
      if (t.done === null) continue;
      const kind = JSON.stringify(Object.keys(t.done).sort());
      expect(DONE_KINDS, `${t.id}: ${kind}`).toContain(kind);
      if ('achievement' in t.done) expect(ids.has(t.done.achievement), `${t.id}: ${t.done.achievement}`).toBe(true);
      if ('visited' in t.done) {
        const list = [].concat(t.done.visited);
        expect(list.length, t.id).toBeGreaterThan(0);
        for (const v of list) {
          expect(typeof v, t.id).toBe('string');
          expect(routed(pats, v), `${t.id}: ${v}`).toBe(true);
        }
      }
      if ('key' in t.done) {
        expect(SHELL_KEYS, `${t.id}: ${t.done.key}`).toContain(t.done.key);
        if ('is' in t.done) expect(typeof t.done.is, t.id).toBe('string');
      }
    }
  });

  it('gives the example its route and the home Game Boy its high score', () => {
    expect(THINGS_TO_DO.find((t) => t.id === 'gameboy-emulator').done).toEqual({ visited: '/projects/gameboy-emulator' });
    expect(THINGS_TO_DO.filter((t) => t.done?.achievement === 'player').map((t) => t.id)).toEqual(['gameboy-home']);
  });

  it('asks for no password and no ROM', () => {
    for (const t of THINGS_TO_DO) for (const s of [t.title, t.blurb]) expect(s, t.id).not.toMatch(/\b(ROM|password)s?\b/i);
  });

  it('says who it’s for, what it is, how long it takes and whether a phone will do', () => {
    for (const t of THINGS_TO_DO) {
      expect(THING_AUDIENCES, t.id).toContain(t.audience);
      expect(KINDS, t.id).toContain(t.kind);
      expect(typeof t.seconds === 'number' && t.seconds > 0, t.id).toBe(true);
      expect(typeof t.phone, t.id).toBe('boolean');
      expect(t.title, t.id).toBeTruthy();
    }
  });

  it('keeps its copy short and its quotes curly', () => {
    for (const t of THINGS_TO_DO) {
      expect(t.blurb.length, t.id).toBeLessThan(140);
      for (const s of [t.title, t.blurb]) expect(s, t.id).not.toMatch(/['"]/);
    }
  });
});

describe('todoFor', () => {
  it('leaves the games out for a recruiter and the work out for a player', () => {
    const hire = todoFor('recruiter');
    expect(hire.length).toBeGreaterThan(10);
    expect(hire.every((t) => t.audience !== 'player')).toBe(true);
    expect(todoFor('player').every((t) => t.audience !== 'recruiter')).toBe(true);
  });

  it('gives everything to a mixed audience, or one it doesn’t know', () => {
    expect(todoFor('mixed')).toEqual(THINGS_TO_DO);
    expect(todoFor('nobody')).toEqual(THINGS_TO_DO);
  });
});

describe('isDone', () => {
  const ach = { done: { achievement: 'deathstar' } };
  const page = { done: { visited: '/projects/gameboy-emulator' } };
  const section = { done: { visited: '/experience' } };
  const key = { done: { key: 'tp-eggs' } };
  const keyIs = { done: { key: 'tp-mode', is: 'dark' } };
  const store = (values) => (k) => values[k] ?? null;

  it('ticks an achievement row once it is unlocked', () => {
    expect(isDone(ach, { unlocked: ['deathstar'] })).toBe(true);
    expect(isDone(ach, { unlocked: ['trench'], visited: ['/deathstar'] })).toBe(false);
  });

  it('ticks a visited row on the path itself or deeper, not a sibling', () => {
    expect(isDone(page, { visited: ['/projects/gameboy-emulator'] })).toBe(true);
    expect(isDone(section, { visited: ['/experience/aws'] })).toBe(true);
    expect(isDone(section, { visited: ['/experiences'] })).toBe(false);
    expect(isDone(page, { visited: ['/projects'] })).toBe(false);
  });

  it('ticks from a guide key the shell kept beside the path', () => {
    expect(isDone({ done: { visited: '/galaxy' } }, { visited: ['/galaxy/surface'] })).toBe(true);
    expect(isDone({ done: { visited: '/middle-earth' } }, { visited: ['/middle-earth/place'] })).toBe(true);
  });

  it('ticks a row with several pages once every one has been seen', () => {
    const both = { done: { visited: ['/home', '/universe'] } };
    expect(isDone(both, { visited: ['/universe/marvel'] })).toBe(false);
    expect(isDone(both, { visited: ['/universe/marvel', '/home'] })).toBe(true);
    expect(isDone({ done: { visited: [] } }, { visited: ['/home'] })).toBe(false);
  });

  it('ticks a key row once the key is set', () => {
    expect(isDone(key, { stored: store({ 'tp-eggs': ['oneup'] }) })).toBe(true);
    expect(isDone(key, { stored: store({ 'tp-eggs': 'saul' }) })).toBe(true);
    expect(isDone(key, { stored: store({}) })).toBe(false);
    expect(isDone(key, { stored: store({ 'tp-eggs': [] }) })).toBe(false);
    expect(isDone(key, { stored: store({ 'tp-eggs': '' }) })).toBe(false);
  });

  it('ticks a key row with `is` on that value, or on a list that holds it', () => {
    expect(isDone(keyIs, { stored: store({ 'tp-mode': 'dark' }) })).toBe(true);
    expect(isDone(keyIs, { stored: store({ 'tp-mode': 'light' }) })).toBe(false);
    expect(isDone(keyIs, { stored: store({ 'tp-mode': ['light', 'dark'] }) })).toBe(true);
    expect(isDone(keyIs, { stored: store({ 'tp-mode': ['light'] }) })).toBe(false);
    expect(isDone(keyIs, { stored: store({}) })).toBe(false);
  });

  it('never ticks a row with nothing to tick it by', () => {
    expect(isDone({ done: null }, { unlocked: ['deathstar'], visited: ['/home'], stored: () => 'x' })).toBe(false);
    expect(isDone({}, { visited: ['/home'] })).toBe(false);
  });

  it('ticks nothing from what it can’t read, without throwing', () => {
    for (const visited of [null, 'x', 7, [null, 3], {}]) expect(isDone(page, { visited }), String(visited)).toBe(false);
    for (const unlocked of [null, 'deathstar', 7, {}]) expect(isDone(ach, { unlocked }), String(unlocked)).toBe(false);
    for (const stored of [null, 'x', 7, {}]) expect(isDone(key, { stored }), String(stored)).toBe(false);
    const broken = () => {
      throw new Error('no storage');
    };
    expect(isDone(key, { stored: broken })).toBe(false);
    for (const done of [7, 'x', [], { achievement: 7 }, { visited: 7 }, { visited: [7] }, { key: 7 }, { key: 'tp-eggs', is: 7 }])
      expect(isDone({ done }, { unlocked: [7], visited: ['/home'], stored: () => 7 }), JSON.stringify(done)).toBe(false);
    for (const row of [null, undefined, 7, 'x']) expect(isDone(row), String(row)).toBe(false);
    expect(isDone(ach, null)).toBe(false);
  });

  it('ticks nothing with nothing done', () => {
    expect(isDone(ach, {})).toBe(false);
    expect(isDone(page, {})).toBe(false);
    expect(isDone(key, {})).toBe(false);
    expect(isDone(ach)).toBe(false);
  });
});
