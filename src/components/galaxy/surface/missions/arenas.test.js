import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ARENA_AT, GROUNDS, groundFor, inside, pull, spawnFor } from './arenas';
import DATA from '../../../../data/bf2017/maps/arenas.json';
import { cut } from '../../../../../scripts/bf2017-arenas.mjs';
import { rng } from '../noise';

const rows = (w) => JSON.parse(readFileSync(new URL(`../../../../data/bf2017/maps/${w}.json`, import.meta.url), 'utf8')).rows;

describe('the hero arenas and the Blast grounds', () => {
  it('are the map rulebooks’ own, cut small (run scripts/bf2017-arenas.mjs when a map changes)', () => {
    for (const w of GROUNDS) {
      const r = rows(w);
      expect(r.modes, w).toEqual(expect.arrayContaining(['hvv', 'blast']));
      expect(DATA[w], w).toEqual(cut(w, r));
    }
  });

  it('give each side of each ground somewhere to start and come back, inside it', () => {
    for (const w of GROUNDS)
      for (const mode of ['hvv', 'blast']) {
        const g = groundFor(w, mode);
        expect(g.points.length, `${w} ${mode}`).toBeGreaterThanOrEqual(4);
        expect(inside(g.points, ...g.at), `${w} ${mode} middle`).toBe(true);
        for (const side of ['light', 'dark']) expect(g.spawns[side].length + g.spawns.any.length, `${w} ${mode} ${side}`).toBeGreaterThan(0);
        for (const s of [...g.spawns.light, ...g.spawns.dark, ...g.spawns.any]) expect(inside(g.points, s[0], s[1]), `${w} ${mode} ${s}`).toBe(true);
        // (the level's layout kept: its middle where ARENA_AT puts it)
        expect((g.bounds.min[0] + g.bounds.max[0]) / 2).toBeCloseTo(ARENA_AT[w][0], 0);
        expect((g.bounds.min[1] + g.bounds.max[1]) / 2).toBeCloseTo(ARENA_AT[w][1], 0);
      }
  });

  it('brings a point outside back in, and picks the quietest spawn to come back at', () => {
    const g = groundFor('hoth', 'hvv');
    const [x, z] = pull(g.points, g.at, g.bounds.max[0] + 50, g.at[1]);
    expect(inside(g.points, x, z)).toBe(true);
    const r = rng(1);
    expect(g.spawns.light).toContainEqual(spawnFor(g, 'light', r));
    const enemy = { x: g.spawns.any[0][0], z: g.spawns.any[0][1] };
    const back = spawnFor(g, 'light', r, [enemy]);
    expect(Math.hypot(back[0] - enemy.x, back[1] - enemy.z)).toBeGreaterThan(30);
  });
});
