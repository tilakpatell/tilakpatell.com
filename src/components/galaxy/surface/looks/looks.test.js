import { describe, expect, it } from 'vitest';
import * as nodes from './nodes';
import { looks } from './index';

describe('the surface’s looks', () => {
  it('the node set, on every renderer the surface is made on', () => {
    expect(looks()).toBe(nodes);
  });

  it('its own materials are node materials, with their uniforms where the parts set them', () => {
    expect(nodes.beamMaterial('#fff').isNodeMaterial).toBe(true);
    for (const make of ['columnMaterial', 'meterMaterial', 'wallMaterial']) {
      const material = nodes[make]('#fff', 1);
      expect(material.isNodeMaterial).toBe(true);
      expect(material.isShaderMaterial).toBeFalsy();
      expect(material.uniforms.uColor).toBeTruthy();
    }
  });
});
