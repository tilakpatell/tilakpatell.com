import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createLevel, levelGround, levelPlaced, packOf, partOf, sunOf } from './index';
import { arrivals } from '../../../../runtime/arriving.js';

describe('the level’s entry', () => {
  it('leaves a ground without an image layer as it is (every world today)', async () => {
    const ground = { seed: 3, layers: [{ type: 'swell', scale: 600, height: 18 }] };
    expect(await levelGround(ground)).toBe(ground);
  });

  it('a pack that cannot be had leaves the image layer empty, not broken', async () => {
    const ground = { layers: [{ type: 'image', pack: 'nowhere' }], flats: [{ at: [0, 0], r: 26 }, { at: [90, 240], r: 32, game: true }] };
    const out = await levelGround(ground);
    expect(out.layers[0]).toEqual({ type: 'image', pack: 'nowhere' });
    // (the places' flats marked for the flight are left out on the game's ground)
    expect(out.flats).toEqual([{ at: [0, 0], r: 26 }]);
  });

  it('is nothing for a site with no level', () => {
    expect(createLevel({ scene: null, site: { id: 'tatooine' }, tier: 'high' })).toBe(null);
  });

  it('says the pack’s maps in its stats beside the rest, none before its loader is up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const level = createLevel({ scene: new THREE.Scene(), site: { id: 'x', level: 'nowhere' }, tier: 'high' });
      expect(level.stats()).toMatchObject({ tris: 0, calls: 0, instances: 0, lights: 0, probe: null, physics: null, maps: { asked: 0, loaded: 0, failed: 0, why: null } });
      // (the pack that cannot be had said, in development, before the spy goes)
      await packOf('nowhere').catch(() => {});
      await new Promise((r) => setTimeout(r, 0));
      level.dispose();
    } finally {
      warn.mockRestore();
    }
  });

  // (lane L1: the runtime's governor holds while a level is on its way)
  it('says it is arriving until it is ready, and not once its pack cannot be had or it is let go', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const level = createLevel({ scene: new THREE.Scene(), site: { id: 'x', level: 'nowhere' }, tier: 'high' });
      expect(arrivals.any()).toBe(true);
      await packOf('nowhere').catch(() => {});
      await new Promise((r) => setTimeout(r, 0));
      expect(arrivals.any()).toBe(false);
      level.dispose();
      const next = createLevel({ scene: new THREE.Scene(), site: { id: 'x', level: 'nowhere' }, tier: 'high' });
      expect(arrivals.any()).toBe(true);
      next.dispose();
      expect(arrivals.any()).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('places nothing of a map for a site with no level, and a pack without the part gives the empty one', async () => {
    expect(await levelPlaced({ id: 'tatooine' })).toEqual({ life: [], rides: [], things: [] });
    expect(await levelPlaced({ id: 'x', level: 'nowhere' })).toEqual({ life: [], rides: [], things: [] });
    expect(await partOf('nowhere', 'decals.json', { decals: [] })).toEqual({ decals: [] });
  });
});

describe('sunOf', () => {
  it('reads the scene’s sun (its first directional light) as a direction toward it and its colour', () => {
    const scene = new THREE.Scene();
    expect(sunOf(scene)).toBeNull();
    const sun = new THREE.DirectionalLight(0xff8000, 3);
    sun.position.set(0, 10, 10);
    sun.target.position.set(0, 0, 0);
    scene.add(sun, sun.target);
    const s = sunOf(scene);
    expect(s.direction.map((v) => Number(v.toFixed(4)))).toEqual([0, 0.7071, 0.7071]);
    expect(s.color.map((v) => Number(v.toFixed(3)))).toEqual([1, Number(new THREE.Color(0xff8000).g.toFixed(3)), 0]);
  });
});
