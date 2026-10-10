import { describe, expect, it } from 'vitest';
import GLOBES from '../../data/galaxy/space/globes.json';
import { globeUrl } from './globes';
import { systemById } from './systems';

describe('the map’s globes', () => {
  it('gives the worlds the game drew a globe of that globe, and the rest none', () => {
    expect(globeUrl('hoth')).toMatch(/\/models\/galaxy\/space\/globes\/hoth\.webp$/);
    expect(globeUrl('naboo')).toBe(null);
    for (const [id, g] of Object.entries(GLOBES)) {
      expect(systemById(id), id).toBeTruthy();
      expect(g.from).toMatch(/planetfronten|planetfrontend/);
    }
  });
});
