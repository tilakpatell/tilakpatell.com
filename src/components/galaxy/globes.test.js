import { describe, expect, it } from 'vitest';
import GLOBES from '../../data/galaxy/space/globes.json';
import SKINS from '../../data/planetSkins.json';
import { discOf, globeUrl } from './globes';
import { systemById } from './systems';

describe('the map’s globes', () => {
  it('gives the worlds the game drew a globe of that globe, and the rest none', () => {
    expect(globeUrl('hoth')).toMatch(/\/models\/galaxy\/space\/globes\/hoth\.webp$/);
    expect(globeUrl('alderaan')).toBe(null);
    for (const [id, g] of Object.entries(GLOBES)) {
      expect(systemById(id), id).toBeTruthy();
      expect(['picture', 'skin']).toContain(g.kind);
      if (g.kind === 'picture') expect(g.from).toMatch(/planetfronten|planetfrontend/);
      else expect(g.from).toMatch(/^textures\/galaxy\/planets\/[a-z]+\/color$/);
    }
  });
  it('renders a globe for every planet with a skin (lane S3), from the skin’s colour map', () => {
    for (const [id, skin] of Object.entries(SKINS)) {
      if (!skin.color || !systemById(id)) continue; // (Geonosis has rings only: its picture globe stands)
      expect(GLOBES[id]?.kind, id).toBe('skin');
      expect(GLOBES[id].from, id).toBe(skin.color);
      expect(globeUrl(id), id).toMatch(new RegExp(`/models/galaxy/space/globes/${id}\\.webp$`));
    }
    expect(globeUrl('naboo')).toMatch(/naboo\.webp$/);
  });
  it('gives HoloMap the disc’s image where there is a globe, and nothing for a procedural world’s dot', () => {
    const naboo = discOf('naboo');
    expect(naboo['data-globe']).toBe('');
    expect(naboo.style['--globe']).toMatch(/^url\(".*\/globes\/naboo\.webp"\)$/);
    expect(discOf('alderaan')).toEqual({});
  });
});
