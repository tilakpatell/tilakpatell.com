import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// the cache's store stood in for: it hands back a mask for any key, and notes the keys asked for
const keys = [];
vi.mock('./bakeCache', async (original) => ({
  // (the real key, from groundworld's stand-in root of what the bake draws)
  bakeKey: (await original()).bakeKey,
  getBake: async (key) => {
    keys.push(key);
    const { BAKE_TIERS } = await import('./grounding-bake');
    const n = BAKE_TIERS.mid.size;
    return { width: n, height: n, data: new Uint8Array(n * n * 4) };
  },
  putBake: async () => true,
}));
const { groundWorld } = await import('./groundwork');

const renderer = { shadowMap: { enabled: true }, extensions: { has: () => true } };

function world(walkerAt, houseAt = 0, houseShown = true) {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial());
  const house = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial());
  house.position.x = houseAt;
  house.visible = houseShown;
  const walker = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshStandardMaterial());
  walker.position.set(walkerAt, 1, 4);
  const rain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  rain.position.y = walkerAt * 3;
  scene.add(sun, sun.target, floor, house, walker, rain);
  return { scene, sun, floor, walker, rain };
}

const bakeIn = async (w) => {
  const g = groundWorld({ renderer, scene: w.scene, floor: [w.floor], area: { x0: -20, z0: -20, w: 40, d: 40 }, sun: w.sun, skip: [w.rain], movers: [{ object: w.walker }], cache: { world: 'test', place: 'here' } });
  expect(await g.bake()).toBe(true);
  expect(g.stats.passes).toBe(0); // (read back, not baked)
  return keys.at(-1);
};

describe('a floor bake kept between visits', () => {
  it("is keyed by what the bake draws: what moves and what's skipped aren't in the key", async () => {
    const a = await bakeIn(world(3));
    const b = await bakeIn(world(-7));
    expect(b).toBe(a);
  });

  it('a static thing moved is another key', async () => {
    const a = await bakeIn(world(3, 0));
    const b = await bakeIn(world(3, 5));
    expect(b).not.toBe(a);
  });

  it('a static thing hidden when the bake is made is another key', async () => {
    const a = await bakeIn(world(3, 0, true));
    const b = await bakeIn(world(3, 0, false));
    expect(b).not.toBe(a);
  });
});
