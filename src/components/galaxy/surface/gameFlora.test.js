import { describe, expect, it } from 'vitest';
import { floraRows } from './flora';
import { RECIPES, gameRows, recipeNames } from './gameFlora';

const site = (game, more = {}) => ({ ground: {}, flora: { biome: 'none', game }, ...more });
const book = (recipe, skip = []) => Object.fromEntries(recipeNames(recipe).filter((n) => !skip.includes(n)).map((n) => [n, { url: '/x.glb' }]));

describe('the drop’s own cover, by recipe', () => {
  it('writes a scatter row an object, its model the library’s', () => {
    const rows = gameRows(site('woods'), book('woods'));
    expect(rows).toHaveLength(RECIPES.woods.length);
    for (const r of rows) {
      expect(r.model).toMatch(/^game:objects\//);
      expect(r.n).toBeGreaterThan(0);
      expect(['cover', 'mid', 'trees']).toContain(r.band);
    }
  });

  it('skips an object not published (or a name the library lost), laying nothing for it (Review Focus 3)', () => {
    const [first] = recipeNames('badlands');
    const rows = gameRows(site('badlands'), book('badlands', [first]));
    expect(rows.map((r) => r.model)).not.toContain(first);
    expect(rows).toHaveLength(RECIPES.badlands.length - 1);
  });

  it('lays nothing for a world with no recipe, no ground, or a recipe that isn’t', () => {
    expect(gameRows(site(undefined))).toEqual([]);
    expect(gameRows(site('woods', { noGround: true }), book('woods'))).toEqual([]);
    expect(gameRows(site('nowhere'))).toEqual([]);
  });

  it('comes after the kit’s rows in a site’s flora, kept above its lava or water', () => {
    const rows = floraRows(site('badlands', { water: { level: 0 } }));
    for (const r of rows.filter((q) => q.model?.startsWith('game:'))) expect(r.above).toBeGreaterThan(0);
  });
});
