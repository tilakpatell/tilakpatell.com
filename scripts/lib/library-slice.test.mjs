import { describe, expect, it } from 'vitest';
import { sliceFor } from './library-slice.mjs';

const urlFor = (name, cut = null) => `/models/galaxy/surface/game/${name.split('/').pop()}${cut ? `.${cut}` : ''}.glb`;

const published = {
  'models/galaxy/surface/game/crate.glb': { hash: 'a', bytes: 1 },
  'models/galaxy/surface/game/crate.far.glb': { hash: 'b', bytes: 1 },
  'models/galaxy/surface/game/barrel.glb': { hash: 'c', bytes: 1 },
  'models/galaxy/bf2017/levels/hoth/cells/0_0.bin': { hash: 'd', bytes: 1, tier: 'pack' },
};

describe('sliceFor', () => {
  it('keeps the published cuts of the objects in use and nothing else', () => {
    const used = { 'objects/props/crate': { as: 'a crate' }, 'objects/props/lamp': { as: 'a lamp' } };
    expect(sliceFor(published, used, { urlFor })).toEqual({
      'models/galaxy/surface/game/crate.glb': true,
      'models/galaxy/surface/game/crate.far.glb': true,
    });
  });

  it('is empty when nothing is in use', () => {
    expect(sliceFor(published, {}, { urlFor })).toEqual({});
  });

  it('never carries a pack row, whatever the manifest holds', () => {
    const used = { 'objects/props/barrel': {} };
    const out = sliceFor(published, used, { urlFor });
    expect(Object.keys(out).some((k) => k.includes('/levels/'))).toBe(false);
    expect(out).toEqual({ 'models/galaxy/surface/game/barrel.glb': true });
  });
});
