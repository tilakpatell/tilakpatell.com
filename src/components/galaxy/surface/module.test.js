import { describe, expect, it } from 'vitest';
import surface from './module';
import { pickBackend } from '../../../runtime/backend';

describe('the galaxy surface module', () => {
  // (the owner's ruling on lane T2: the Star Wars surfaces draw on WebGPU,
  // or on the node renderer over WebGL 2, at every level; no classic path)
  it('is a nodes module with no classic path, so it never gets the classic renderer', () => {
    expect(surface.shading).toBe('nodes');
    expect(surface).not.toHaveProperty('classic');
    for (const gpu of [true, false])
      for (const override of [null, 'webgl', 'webgpu'])
        for (const lost of [false, true]) expect(pickBackend({ gpu, shading: surface.shading, override, lost })).not.toBe('webgl');
  });
});
