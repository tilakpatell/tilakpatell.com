import { describe, expect, it } from 'vitest';
import { FILMS, briefingFor, filmFor, logo, mayPlay, tilesFor, tutorials } from './films';

const ROWS = [
  { slug: 'planet-hoth-01', kind: 'planet', system: 'hoth', path: 'films/bf2017/planet-hoth-01.webm', poster: 'films/bf2017/planet-hoth-01.webp', loop: true, seconds: 10 },
  { slug: 'planet-vardos-alive-01', kind: 'planet', system: 'vardos', path: 'films/bf2017/a.webm', poster: 'films/bf2017/a.webp', loop: true },
  { slug: 'planet-vardos-dead-01', kind: 'planet', system: 'vardos', variant: 'dead', path: 'films/bf2017/d.webm', poster: 'films/bf2017/d.webp', loop: true },
  { slug: 'a1-m1end-ds02-s0400-fmv', kind: 'campaign', level: 'endor', act: 1, scene: 20400, path: 'films/bf2017/e2.webm', poster: 'films/bf2017/e2.webp', captions: 'films/bf2017/e2.vtt', loop: false },
  { slug: 'a1-m1end-ds01-s0100-fmv', kind: 'campaign', level: 'endor', act: 1, scene: 10100, path: 'films/bf2017/e1.webm', poster: 'films/bf2017/e1.webp', loop: false },
  { slug: 'tile-skirmish', kind: 'tile', tile: 'skirmish', path: 'films/bf2017/t.webm', poster: 'films/bf2017/t.webp', loop: true },
  { slug: 'precombat', kind: 'tutorial', path: 'films/bf2017/p.webm', poster: 'films/bf2017/p.webp', loop: false },
  { slug: 'logos-start-01', kind: 'logo', path: 'films/bf2017/l.webm', poster: 'films/bf2017/l.webp', loop: false },
  { slug: 'mt-volcano2', kind: 'fx', fx: 'volcano', path: 'films/bf2017/v.webm', poster: 'films/bf2017/v.webp', loop: true, flipped: true },
];

describe('the 2017 game’s films', () => {
  it('gives a system its loading film, with its poster, looping', () => {
    const f = filmFor({ system: 'hoth' }, { films: ROWS });
    expect(f).toMatchObject({ slug: 'planet-hoth-01', poster: '/films/bf2017/planet-hoth-01.webp', loop: true });
    expect(f.url).toMatch(/films\/bf2017\/planet-hoth-01\.webm$/);
  });

  it('gives a system with no film nothing, so its card keeps its still', () => {
    expect(filmFor({ system: 'nevarro' }, { films: ROWS })).toBeNull();
    expect(filmFor({ mission: 'nevarro' }, { films: ROWS })).toBeNull();
    expect(filmFor({}, { films: ROWS })).toBeNull();
    expect(filmFor({ tile: 'nothing' }, { films: ROWS })).toBeNull();
  });

  it('picks the look asked for, else the planet’s own', () => {
    expect(filmFor({ system: 'vardos' }, { films: ROWS }).slug).toBe('planet-vardos-alive-01');
    expect(filmFor({ system: 'vardos' }, { films: ROWS, variant: 'dead' }).slug).toBe('planet-vardos-dead-01');
  });

  it('gives a world its campaign films as its briefing, in scene order, with captions', () => {
    const b = briefingFor('endor', ROWS);
    expect(b.map((f) => f.slug)).toEqual(['a1-m1end-ds01-s0100-fmv', 'a1-m1end-ds02-s0400-fmv']);
    expect(b[1].captions).toBe('/films/bf2017/e2.vtt');
    expect(b[0].loop).toBe(false);
    expect(filmFor({ mission: 'endor' }, { films: ROWS }).slug).toBe('a1-m1end-ds01-s0100-fmv');
  });

  it('gives the menu’s tiles, the tutorials, the logo and the lava', () => {
    expect(tilesFor('skirmish', ROWS).map((f) => f.slug)).toEqual(['tile-skirmish']);
    expect(tilesFor('nonsense', ROWS)).toEqual([]);
    expect(tutorials(ROWS).map((f) => f.slug)).toEqual(['precombat']);
    expect(logo(ROWS).slug).toBe('logos-start-01');
    expect(filmFor({ fx: 'volcano' }, { films: ROWS })).toMatchObject({ slug: 'mt-volcano2', flipped: true });
  });

  it('plays nothing with reduced motion or on a saver connection', () => {
    expect(mayPlay({})).toBe(true);
    expect(mayPlay({ reduced: true })).toBe(false);
    expect(mayPlay({ saveData: true })).toBe(false);
  });

  it('lists only films there are, none of the sequel era', () => {
    for (const f of FILMS) {
      expect(f.path).toMatch(/^films\/bf2017\/[a-z0-9-]+\.webm$/);
      expect(f.poster).toMatch(/\.webp$/);
      expect(f.slug).not.toMatch(/jakku|crait|takodana|starkiller|dqar|resurgent|paintball|m1tak|m4jak|m5sta|^a3-/);
    }
  });
});
