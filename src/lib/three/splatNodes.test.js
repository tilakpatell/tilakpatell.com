import { describe, expect, it } from 'vitest';
import * as glsl from './splat';
import * as nodes from './splatNodes';

describe('splatNodes, the twin of splat', () => {
  it('the same table and the same layers for a site', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.SPLAT).toEqual(glsl.SPLAT);
    for (const detail of ['sand', 'snow', 'grass', 'leaves', 'ash']) {
      const site = { ground: { detail } };
      expect(nodes.splatOf(site)).toEqual(glsl.splatOf(site));
    }
    const own = { ground: { detail: 'sand', splat: { macro: 'mud', steep: ['nothing', 'rock'], decal: 'gravel' } } };
    expect(nodes.splatOf(own)).toEqual(glsl.splatOf(own));
  });
});
