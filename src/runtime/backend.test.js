import { describe, expect, it } from 'vitest';
import { KINDS, LEVELS, RENDERER_NAMES, pickBackend, readOverride } from './backend';

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

describe('pickBackend by the quality level (a nodes module with a classic path)', () => {
  // tier × gpu × override, every cell: [tier, gpu, override, lost, kind]
  const TABLE = [
    ['low', true, null, false, 'webgl'],
    ['low', true, 'webgpu', false, 'webgl'],
    ['low', true, 'webgl', false, 'webgl'],
    ['low', false, null, false, 'webgl'],
    ['low', false, 'webgpu', false, 'webgl'],
    ['low', false, 'webgl', false, 'webgl'],
    ['mid', true, null, false, 'webgpu'],
    ['mid', true, 'webgpu', false, 'webgpu'],
    ['mid', true, 'webgl', false, 'webgl'],
    ['mid', true, null, true, 'webgl'],
    ['mid', false, null, false, 'webgl'],
    ['mid', false, 'webgpu', false, 'webgl'],
    ['mid', false, 'webgl', false, 'webgl'],
    ['high', true, null, false, 'webgpu'],
    ['high', true, 'webgpu', false, 'webgpu'],
    ['high', true, 'webgl', false, 'nodes-webgl'],
    ['high', true, null, true, 'nodes-webgl'],
    ['high', false, null, false, 'nodes-webgl'],
    ['high', false, 'webgpu', false, 'nodes-webgl'],
    ['high', false, 'webgl', false, 'nodes-webgl'],
    ['ultra', true, null, false, 'webgpu'],
    ['ultra', true, 'webgpu', false, 'webgpu'],
    ['ultra', true, 'webgl', false, 'nodes-webgl'],
    ['ultra', true, null, true, 'nodes-webgl'],
    ['ultra', false, null, false, 'nodes-webgl'],
    ['ultra', false, 'webgpu', false, 'nodes-webgl'],
    ['ultra', false, 'webgl', false, 'nodes-webgl'],
  ];
  for (const [tier, gpu, override, lost, kind] of TABLE) {
    it(`${tier}, ${gpu ? 'WebGPU' : 'no WebGPU'}, ?gpu=${override ?? 'unset'}${lost ? ', lost once' : ''} → ${kind}`, () => {
      expect(pickBackend({ shading: 'nodes', classic: true, tier, gpu, override, lost })).toBe(kind);
    });
  }

  it('covers every level', () => {
    expect(new Set(TABLE.map((r) => r[0]))).toEqual(new Set(LEVELS));
  });

  it('a nodes module without a classic path keeps the node renderer at every level', () => {
    for (const tier of LEVELS) {
      expect(pickBackend({ shading: 'nodes', tier, gpu: true })).toBe('webgpu');
      expect(pickBackend({ shading: 'nodes', tier, gpu: false })).toBe('nodes-webgl');
    }
  });

  it('a glsl module is classic at every level, whatever it says of a classic path', () => {
    for (const tier of LEVELS) expect(pickBackend({ shading: 'glsl', classic: true, tier, gpu: true })).toBe('webgl');
  });

  it('names every kind for the settings panel', () => {
    for (const k of KINDS) expect(RENDERER_NAMES[k]).toBeTruthy();
  });
});
