import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSky } from '../galaxy/sky';
import { createMapSky } from './mapSky';

// one shared stub: the sky’s making is the galaxy’s own (galaxy/nodes/sky.test.js);
// here only what the map asks of it is pinned
const stub = { group: new THREE.Group(), setSystem: vi.fn(), setRatio: vi.fn(), prepare: () => Promise.resolve(), bake: vi.fn() };
vi.mock('../galaxy/sky', () => ({ createSky: vi.fn(() => stub) }));

describe('createMapSky', () => {
  beforeEach(() => vi.clearAllMocks());

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
    followDrawn();
    followDrawn();
    expect(stub.setRatio.mock.calls).toEqual([[1], [0.75]]);
  });
});
