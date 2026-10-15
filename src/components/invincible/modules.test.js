import { describe, expect, it } from 'vitest';
import { validateModule } from '../../runtime/module';
import { WORLD_MB } from '../worlds/worlds';
import city from './world/module';
import game from './thinkmark/module';
import viewer from './viewer/module';

// Invincible's three HQ games as world modules (avengers/hq/module.js, through avengers/shared)
describe('Invincible’s modules', () => {
  it.each([
    ['the city', city, 'invincible-world'],
    ['Think, Mark!', game, 'invincible-thinkmark'],
    ['the cast viewer', viewer, 'invincible-viewer'],
  ])('%s is a classic module with the page’s download', (_, mod, id) => {
    expect(validateModule(mod)).toMatchObject({ id, shading: 'glsl', mb: WORLD_MB['/invincible'], calibrate: false });
    expect(typeof mod.warm).toBe('function');
  });
});
