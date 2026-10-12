import { describe, expect, it } from 'vitest';
import { reticleLock, reticleShape } from './reticleFor';

describe('the surface’s reticle', () => {
  it('draws the game’s blaster crosshair for a gun, the kit’s ticks for a saber', () => {
    const han = reticleShape({ id: 'han' });
    expect(han.viewBox).toBe('-20 -20 40 40');
    expect(han.paths.length).toBe(6);
    expect(reticleShape({ id: 'trooper-empire-assault' })).toBe(han);
    expect(reticleShape({ id: 'luke' })).toBeNull();
    expect(reticleShape(null)).toBeNull();
  });
  it('rings the lock for a saber alone: a blaster fight has the game’s markers, no circle', () => {
    const lock = { name: 'stormtrooper', hp: 50, max: 100 };
    expect(reticleLock({ id: 'luke' }, { lock })).toBe(lock);
    expect(reticleLock({ id: 'han' }, { lock })).toBeNull();
    expect(reticleLock({ id: 'luke' }, null)).toBeNull();
  });
});
