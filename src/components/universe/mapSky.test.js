import * as THREE from 'three';
import { beforeEach, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({ setSystem: vi.fn(), setRatio: vi.fn(), prepare: vi.fn(() => Promise.resolve()), bake: vi.fn() }));
vi.mock('../galaxy/sky', () => ({ createSky: vi.fn(() => stub) }));
const { createSky } = await import('../galaxy/sky');
const { createMapSky } = await import('./mapSky');

beforeEach(() => {
  vi.clearAllMocks();
  stub.group = new THREE.Group();
});

it('bakes the universe’s sky as Kashyyyk’s, without its suns, beacons or clouds', async () => {
  const parent = new THREE.Group();
  const prepFrame = vi.fn(() => Promise.resolve());
  createMapSky(parent, { renderer: null, small: true, level: 'low', post: { ratio: 1 }, prepFrame });
  expect(createSky).toHaveBeenCalledWith({ small: true, level: 'low', renderer: null, beacons: false, clouds: false });
  expect(stub.setSystem).toHaveBeenCalledWith(expect.objectContaining({ id: 'kashyyyk', suns: [] }));
  expect(parent.children).toContain(stub.group);
  await new Promise((r) => setTimeout(r, 0));
  expect(prepFrame).toHaveBeenCalled();
  expect(stub.bake).toHaveBeenCalledWith(null);
});

it('tells the sky the post’s ratio once a change', () => {
  const post = { ratio: 1 };
  const { followDrawn } = createMapSky(new THREE.Group(), { renderer: null, post });
  followDrawn();
  post.ratio = 0.75;
  expect(followDrawn()).toBe(0.75);
  followDrawn();
  expect(stub.setRatio.mock.calls).toEqual([[1], [0.75]]);
});
