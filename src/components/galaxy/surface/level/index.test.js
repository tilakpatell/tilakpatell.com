import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { countedBytes, createLevel, levelGround, levelPlaced, packBytes, packOf, partOf, sunOf } from './index';

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

describe('packBytes', () => {
  const answer = (status, type) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': type }), arrayBuffer: async () => new ArrayBuffer(8) });
  it('gives a file’s bytes', async () => {
    expect((await packBytes(answer(200, 'application/octet-stream'), 'cells/0_0.bin')).byteLength).toBe(8);
  });
  it('throws a 404, and a page in a file’s place (a dev server’s index.html for a cell’s bin it lacks)', () => {
    expect(() => packBytes(answer(404, 'text/plain'), 'cells/0_0.bin')).toThrow(/404/);
    expect(() => packBytes(answer(200, 'text/html; charset=utf-8'), 'cells/0_0.bin')).toThrow(/page/);
  });
});

describe('countedBytes', () => {
  it('counts the pack files that failed and says the first, so a hollow level is never a pass', async () => {
    const said = [];
    let live = true;
    const load = countedBytes((p) => (p.startsWith('ok') ? Promise.resolve(p) : Promise.reject(new Error('404'))), { live: () => live, onFirst: (p) => said.push(p) });
    expect(await load('ok.bin')).toBe('ok.bin');
    await expect(load('cells/0_0.bin')).rejects.toThrow('404');
    await expect(load('cells/0_1.bin')).rejects.toThrow('404');
    expect(load.skipped()).toBe(2);
    expect(said).toEqual(['cells/0_0.bin']);
    // (an abort, or a failure after the level is gone, is no hole in it)
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(countedBytes(() => Promise.reject(abort))('x')).rejects.toBe(abort);
    live = false;
    await expect(load('cells/0_2.bin')).rejects.toThrow('404');
    expect(load.skipped()).toBe(2);
  });
});
