import { describe, expect, it } from 'vitest';
import { NEEDS_GPU, needsGpu, WORLD_MB, WORLDS, wayOut, worldAt } from './worlds';

describe('the worlds', () => {
  it('each say how much they download, so a phone can be asked first', () => {
    for (const w of WORLDS) expect(WORLD_MB[w.to], w.to).toBeGreaterThan(0);
  });

  it('are found from any address inside them', () => {
    expect(worldAt('/avengers')?.to).toBe('/avengers');
    expect(worldAt('/middle-earth/moria')?.to).toBe('/middle-earth');
    expect(worldAt('/galaxy/hoth')?.to).toBe('/galaxy');
    expect(worldAt('/galaxy/hoth/mission')?.to).toBe('/galaxy');
    expect(worldAt('/universe/hoth')).toBeNull();
    expect(worldAt('/deathstar')?.to).toBe('/deathstar');
    expect(worldAt('/middle-earthling')).toBeNull();
    expect(worldAt('/home')).toBeNull();
    expect(worldAt('/')).toBeNull();
  });

  it('are the closest one when a world sits inside another’s address', () => {
    expect(worldAt('/dot-matrix/64').to).toBe('/dot-matrix/64');
    expect(worldAt('/dot-matrix/64/castle').to).toBe('/dot-matrix/64');
    expect(worldAt('/dot-matrix/minecraft').to).toBe('/dot-matrix/minecraft');
    expect(worldAt('/dot-matrix/tetris').to).toBe('/dot-matrix');
    expect(worldAt('/deathstar').to).toBe('/deathstar');
  });

  it('lead out by the view the visitor is in', () => {
    expect(wayOut('/invincible', 'universe')).toEqual({ label: 'Universe map', to: '/universe/invincible' });
    expect(wayOut('/invincible', null)).toEqual({ label: 'Universe map', to: '/universe/invincible' });
    expect(wayOut('/invincible', 'home')).toEqual({ label: 'Classic site', to: '/home' });
    expect(wayOut('/hogwarts', 'universe')).toEqual({ label: 'Universe map', to: '/universe/potter' });
  });

  // (the owner's word, 2026-10-13: the Star Wars worlds need a real GPU, their assets are so heavy)
  it('say which need a GPU: the galaxy and everything under it, Battlefront and the station inside', () => {
    expect(NEEDS_GPU).toEqual(['/galaxy', '/battlefront', '/deathstar/inside']);
    for (const p of ['/galaxy', '/galaxy/hoth', '/battlefront', '/battlefront/hoth/galacticAssault', '/deathstar/inside']) expect(needsGpu(p), p).toBe(true);
    for (const p of ['/', '/deathstar', '/avengers', '/galaxyish', '/middle-earth/moria']) expect(needsGpu(p), p).toBe(false);
  });
});
