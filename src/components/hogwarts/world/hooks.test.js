import { describe, expect, it } from 'vitest';
import { BLOOM } from '../../../lib/three/bloom';
import { chainFor } from './hooks';

describe('the post chain', () => {
  it('is the house bloom on every tier, tone-mapped out at the end', () => {
    for (const tier of ['low', 'mid', 'high', 'ultra']) {
      const kinds = chainFor(tier, 'webgpu').map((p) => p.kind);
      expect(kinds[0]).toBe('render');
      expect(kinds.at(-1)).toBe('output');
      expect(chainFor(tier, 'webgpu').find((p) => p.kind === 'bloom')).toMatchObject({ threshold: BLOOM.threshold, strength: BLOOM.strength, radius: BLOOM.radius });
    }
  });

  it('smooths edges from mid up, SMAA standing in for TRAA where the backend can’t build it', () => {
    expect(chainFor('low', 'webgpu').map((p) => p.kind)).not.toContain('smaa');
    expect(chainFor('mid', 'webgpu').map((p) => p.kind)).toContain('smaa');
    expect(chainFor('high', 'webgpu').map((p) => p.kind)).toContain('traa');
    expect(chainFor('high', 'nodes-webgl').map((p) => p.kind)).toEqual(['render', 'bloom', 'smaa', 'output']);
  });
});
