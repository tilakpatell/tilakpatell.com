import { describe, expect, it } from 'vitest';
import { POSES, STAGE, stageFor } from './heroStage.js';
import { heroSpec } from '../heroes';

const luke = heroSpec({ id: 'luke' });

describe('the hero-select stage behind the loadout', () => {
  it('stands a hero on the game’s skeleton on the Frontend’s stage, under its light, in its idle', () => {
    const s = stageFor({ level: 'high', hero: luke });
    expect(s.kit.url).toBe('/models/galaxy/kits/frontendstage.glb');
    expect(Object.keys(s.kit.pieces).sort()).toEqual(Object.keys(STAGE).sort());
    expect(s.light.source).toEqual(['Levels/Frontend/Lighting/VE_FrostEnd']);
    expect(s.pose).toEqual(POSES);
    expect(POSES.at(-1)).toBe('idle');
    expect(stageFor({ level: 'mid', hero: luke })).not.toBeNull();
  });

  it('keeps the flat backdrop on low, and for a hero not on the game’s skeleton', () => {
    expect(stageFor({ level: 'low', hero: luke })).toBeNull();
    expect(stageFor({ level: 'high', hero: heroSpec({ id: 'rick' }) })).toBeNull();
    expect(stageFor({ level: 'high', hero: null })).toBeNull();
  });
});
