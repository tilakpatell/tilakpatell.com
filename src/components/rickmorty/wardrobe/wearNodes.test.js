import { describe, expect, it } from 'vitest';
import * as glsl from './wear';
import * as nodes from './wearNodes';

describe('wearNodes, the twin of wear', () => {
  it('has wear’s exports, the same bodies in a cast’s table', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    const a = glsl.withWardrobe();
    const n = nodes.withWardrobe();
    expect(Object.keys(n.kinds)).toEqual(Object.keys(a.kinds));
    expect([...n.rigged]).toEqual([...a.rigged]);
    const look = { body: 'rick', colors: {} };
    expect(nodes.bodyKind(look)).toBe(glsl.bodyKind(look));
    expect(nodes.bodyAsset(look)).toBe(glsl.bodyAsset(look));
  });

  it('leaves a figure of shapes as it is', () => {
    const off = nodes.dress({ group: null }, { body: 'rick' });
    expect(typeof off).toBe('function');
    off();
  });
});
