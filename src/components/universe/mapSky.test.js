import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSky } from '../galaxy/sky';
import { createMapSky } from './mapSky';

// the galaxy's sky as far as the map uses it: one shared stub, its options read back
const stub = vi.hoisted(() => ({}));
vi.mock('../galaxy/sky', async () => {
  const { Group } = await import('three');
  Object.assign(stub, { group: new Group() });
  return {
    createSky: vi.fn(() => {
      Object.assign(stub, { setSystem: vi.fn(), setRatio: vi.fn(), prepare: vi.fn(() => Promise.resolve()), bake: vi.fn() });
      return stub;
    }),
  };
});
// (the bake waits a frame; here, none)
vi.mock('./prepFrame', () => ({ prepFrame: () => Promise.resolve() }));

beforeEach(() => vi.clearAllMocks());

describe('the map’s sky', () => {
  it('bakes the universe’s sky as Kashyyyk’s, without its suns, beacons or clouds', () => {
    const parent = new THREE.Group();
    createMapSky(parent, { renderer: null, small: true, level: 'low', post: { ratio: 1 } });
    expect(createSky).toHaveBeenCalledWith({ small: true, level: 'low', renderer: null, beacons: false, clouds: false });
    expect(stub.setSystem).toHaveBeenCalledWith(expect.objectContaining({ id: 'kashyyyk', suns: [] }));
    expect(parent.children).toContain(stub.group);
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

  it('bakes once its shaders are ready, after a frame of its own', async () => {
    const renderer = {};
    const { sky } = createMapSky(new THREE.Group(), { renderer, post: { ratio: 1 } });
    expect(sky).toBe(stub);
    expect(stub.prepare).toHaveBeenCalledWith(renderer);
    await vi.waitFor(() => expect(stub.bake).toHaveBeenCalledWith(renderer));
  });
});
