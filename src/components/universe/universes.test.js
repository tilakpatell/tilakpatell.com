import { readFileSync } from 'node:fs';
import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { projectById } from '../../data/projects';
import { WORLDS } from '../worlds/worlds';
import { PLANETS } from '../rickmorty/world/dimensions/destinations';
import { MOONS, MOON_IDS, UNIVERSES, byPath, contrast } from './universes';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const ROUTES = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');

describe('the universes', () => {
  it('are the site’s six pages and thirteen fandoms, each with its own id', () => {
    expect(UNIVERSES.filter((u) => u.kind === 'core').map((u) => u.to)).toEqual(['/home', '/experience', '/projects', '/resume', '/contact', '/terminal']);
    expect(UNIVERSES.filter((u) => u.kind === 'fandom')).toHaveLength(13);
    expect(new Set(UNIVERSES.map((u) => u.id)).size).toBe(19);
    for (const u of UNIVERSES) expect(u.place, u.id).toBeTruthy();
  });

  it('each go somewhere real', () => {
    for (const u of UNIVERSES) expect(ROUTES.some((p) => matchPath(p, u.to)), u.to).toBe(true);
    // (the Game Boy's world links to its project page)
    expect(byPath('/dot-matrix')?.id).toBe('gaming');
    expect(projectById('gameboy-emulator')).toBeTruthy();
  });

  it('have accents that read on the deep-space page', () => {
    for (const u of UNIVERSES) expect(contrast(u.accent, '#03040a'), u.id).toBeGreaterThanOrEqual(4.5);
  });

  it('give the world pages their list, in map order', () => {
    expect(WORLDS.map((w) => w.to)).toEqual([
      ...['/galaxy', '/deathstar', '/deathstar/inside'],
      '/fly', // planet flight (scripts/flight-island.mjs removes this row)
      ...['/music', '/middle-earth', '/middle-earth/road', '/cybertron', '/avengers', '/albuquerque', '/scranton', '/c-137', '/dot-matrix', '/dot-matrix/64', '/dot-matrix/minecraft', '/earth', '/caribbean', '/invincible', '/hogwarts'],
    ]);
    expect(WORLDS[0]).toMatchObject({ to: '/galaxy', label: 'A galaxy far, far away', from: 'Star Wars' });
    expect(WORLDS[1]).toMatchObject({ to: '/deathstar', label: 'Death Star', from: 'Star Wars' });
    expect(WORLDS[2]).toMatchObject({ to: '/deathstar/inside', label: 'Aboard the Death Star', from: 'Star Wars' });
  });

  it('know the pages inside them', () => {
    expect(byPath('/galaxy')?.id).toBe('starwars');
    expect(byPath('/deathstar')?.id).toBe('starwars');
    expect(byPath('/deathstar/inside')?.id).toBe('starwars');
    expect(byPath('/dot-matrix/64')?.id).toBe('gaming');
    expect(byPath('/dot-matrix/minecraft')?.id).toBe('gaming');
    expect(byPath('/fly')?.id).toBe('starwars'); // planet flight
    for (const u of UNIVERSES) for (const p of u.pages ?? []) expect(ROUTES.some((r) => matchPath(r, p.to)), p.to).toBe(true);
  });
});

describe('the Rick and Morty sector’s planets', () => {
  it('each go straight into their own world, a planet of the C-137 game’s', () => {
    // (the game's planets are the map's moons, in the same order)
    expect(PLANETS).toEqual(MOON_IDS);
    for (const m of MOONS) {
      expect(m.to, m.id).toBe(`/c-137/${m.id}`);
      expect(ROUTES.some((p) => matchPath(p, m.to)), m.to).toBe(true);
      expect(PLANETS, m.id).toContain(m.id);
      // (the Citadel has a page of its own there)
      expect(m.id).not.toBe('citadel');
    }
  });

  it('know their worlds’ pages, and C-137 its own', () => {
    for (const m of MOONS) expect(byPath(m.to)?.id, m.to).toBe(m.id);
    expect(byPath('/c-137')?.id).toBe('rickmorty');
    expect(byPath('/c-137/nope')).toBeUndefined();
  });
});

describe('the air round the fandoms’ planets', () => {
  it('every fandom planet says what its air is, or that it has none', () => {
    for (const u of UNIVERSES.filter((x) => x.kind === 'fandom' && !x.portal)) {
      expect(u, u.id).toHaveProperty('air');
      if (u.air) {
        expect(u.air.colour, u.id).toMatch(/^#[0-9a-f]{6}$/i);
        expect(u.air.density, u.id).toBeGreaterThan(0);
        expect(u.air.top, u.id).toBeGreaterThan(1);
        expect(u.air.top, u.id).toBeLessThan(1.1);
      }
    }
    // (a Game Boy's screen has no air; Scranton's country has its own)
    expect(UNIVERSES.find((u) => u.id === 'office').air.colour).toMatch(/^#[0-9a-f]{6}$/i);
    expect(UNIVERSES.find((u) => u.id === 'gaming').air).toBeNull();
  });
});
