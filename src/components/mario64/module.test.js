import { describe, expect, it } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import m64 from './module';

describe('Mario 64, the world module', () => {
  // (on the node renderer since lane P1: every shader it reaches a TSL twin, shading.test holds its closure to it)
  it('is a world module on the node renderer, and says what it downloads as the worlds list does', () => {
    expect(m64).toMatchObject({ id: 'mario64', shading: 'nodes', mb: WORLD_MB['/dot-matrix/64'] });
    expect(typeof m64.create).toBe('function');
  });
});
