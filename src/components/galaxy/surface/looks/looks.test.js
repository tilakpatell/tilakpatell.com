import { describe, expect, it } from 'vitest';
import * as classic from './classic';
import * as nodes from './nodes';
import { looks, pickLooks } from './index';

describe('the surface’s looks', () => {
  it('the classic set and the node set have the same names', () => {
    expect(Object.keys(classic).sort()).toEqual(Object.keys(nodes).sort());
    expect(classic.name).toBe('classic');
    expect(nodes.name).toBe('nodes');
  });

  it('the node set until a scene picks, and the one it picks after', () => {
    pickLooks(null);
    expect(looks().name).toBe('nodes');
    expect(pickLooks(classic).name).toBe('classic');
    expect(looks()).toBe(classic);
    pickLooks(null);
  });

  it('each set’s own materials: GLSL on the classic, nodes on the node', () => {
    expect(classic.beamMaterial('#fff').isShaderMaterial).toBe(true);
    expect(nodes.beamMaterial('#fff').isNodeMaterial).toBe(true);
    for (const make of ['columnMaterial', 'meterMaterial', 'wallMaterial']) {
      expect(classic[make]('#fff', 1).uniforms.uColor).toBeTruthy();
      expect(nodes[make]('#fff', 1).uniforms.uColor).toBeTruthy();
    }
  });
});
