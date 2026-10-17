import { describe, expect, it } from 'vitest';
import { KINDS, RENDERER_NAMES, pickBackend, readOverride, rendererReport } from './backend';

describe('pickBackend', () => {
  it('a glsl module always gets the classic renderer', () => {
    expect(pickBackend({ gpu: true, shading: 'glsl' })).toBe('webgl');
    expect(pickBackend({ gpu: true })).toBe('webgl'); // glsl is the default
    expect(pickBackend({ gpu: true, shading: 'glsl', override: 'webgpu' })).toBe('webgl'); // it can’t run there
    expect(pickBackend({ gpu: false, shading: 'glsl', lost: true })).toBe('webgl');
  });

  it('a nodes module gets webgpu with a gpu, nodes-webgl everywhere else', () => {
    expect(pickBackend({ gpu: true, shading: 'nodes' })).toBe('webgpu');
    expect(pickBackend({ gpu: false, shading: 'nodes' })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', lost: true })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgl' })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgpu', lost: true })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: false, shading: 'nodes', override: 'webgpu' })).toBe('nodes-webgl'); // no gpu to force
  });
});

describe('readOverride', () => {
  it('reads the override from the address, the hash or storage', () => {
    expect(readOverride('?gpu=webgl', '', null)).toBe('webgl');
    expect(readOverride('', '#/earth?gpu=webgpu', null)).toBe('webgpu');
    expect(readOverride('', '', 'webgl')).toBe('webgl');
    expect(readOverride('?gpu=nope', '', 'x')).toBe(null);
    expect(readOverride('', '', null)).toBe(null);
  });

  it('never names the runtime’s own kind', () => {
    expect(readOverride('?gpu=nodes-webgl', '', null)).toBe(null);
    expect(readOverride('', '', 'nodes-webgl')).toBe(null);
  });
});

// The Star Wars worlds are 'nodes' modules: whatever the quality level, the
// device or the address asks, one never draws on the classic renderer (the
// owner's ruling on lane T2, and main's rule of 2026-10-13: every world on
// WebGPU or on the node renderer over WebGL 2).
describe('a nodes module at every quality level', () => {
  const LEVELS = ['low', 'mid', 'high', 'ultra'];
  const OVERRIDES = [null, 'webgl', 'webgpu', 'classic'];

  it('WebGPU where the browser has it, the node renderer over WebGL 2 everywhere else: never the classic renderer', () => {
    const cells = [];
    for (const tier of LEVELS)
      for (const gpu of [true, false])
        for (const override of OVERRIDES)
          for (const lost of [false, true]) {
            // (a module that still says it brings a classic path, and the level it is drawn at: neither picks the renderer)
            const kind = pickBackend({ shading: 'nodes', classic: true, tier, gpu, override, lost });
            const want = gpu && !lost && override !== 'webgl' ? 'webgpu' : 'nodes-webgl';
            if (kind !== want) cells.push(`${tier}, ${gpu ? 'WebGPU' : 'no WebGPU'}, ?gpu=${override ?? 'unset'}${lost ? ', lost once' : ''}: ${kind}`);
          }
    expect(cells).toEqual([]);
  });

  it('?gpu=classic is no renderer a visitor can ask for', () => {
    expect(readOverride('?gpu=classic', '', null)).toBe(null);
    expect(readOverride('', '#/galaxy?gpu=classic', null)).toBe(null);
    expect(readOverride('', '', 'classic')).toBe(null);
  });

  it('a glsl module is classic at every level, as ever', () => {
    for (const tier of LEVELS) expect(pickBackend({ shading: 'glsl', tier, gpu: true })).toBe('webgl');
  });

  it('names every kind for the settings panel', () => {
    for (const k of KINDS) expect(RENDERER_NAMES[k]).toBeTruthy();
  });
});

describe('rendererReport', () => {
  it('WebGPU is the best; a glsl world’s classic renderer is its best, its only one', () => {
    expect(rendererReport({ backend: 'webgpu' })).toMatchObject({ name: 'WebGPU', best: true });
    expect(rendererReport({ backend: 'webgl' })).toMatchObject({ name: 'classic', best: true });
  });

  it('the node renderer over WebGL 2 says why it is not WebGPU, and what would give it', () => {
    expect(rendererReport({ backend: 'nodes-webgl', gpu: false })).toMatchObject({ best: false, note: expect.stringContaining('no WebGPU') });
    expect(rendererReport({ backend: 'nodes-webgl', gpu: false }).note).toContain('Chrome, Edge or Safari 26');
    expect(rendererReport({ backend: 'nodes-webgl', gpu: true })).toMatchObject({ best: false, note: expect.stringContaining('didn’t start') });
    expect(rendererReport({})).toBe(null);
  });
});
