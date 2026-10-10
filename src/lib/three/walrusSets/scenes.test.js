import { describe, expect, it } from 'vitest';
import { OUTROS, SCENES, introScene } from './scenes';

describe('the scenes the site plays', () => {
  it('has an entrance for each hero and the Rebels’ outro at Echo Base', () => {
    expect(introScene('luke')).toBe('intro-luke');
    expect(SCENES['intro-luke'].luke).toContain('Battle_Hero_Intro_Luke_MP');
    expect(introScene('stormtrooper')).toBe(null);
    expect(Object.keys(SCENES['hoth-outro'])).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(OUTROS.hoth).toEqual({ scene: 'hoth-outro', side: 'defend' });
  });
});
