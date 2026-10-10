import { describe, expect, it } from 'vitest';
import { postFor } from './engine';

describe('the surface’s post by its backend', () => {
  it('draws through the post its backend can run', () => {
    const glsl = () => 'glsl post';
    const nodes = () => 'node post';
    expect(postFor({ shading: 'glsl', glsl, nodes })).toBe('glsl post');
    expect(postFor({ shading: 'nodes', glsl, nodes })).toBe('node post');
  });
});
