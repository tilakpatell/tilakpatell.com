import { describe, expect, it } from 'vitest';
import * as levels from './levels';
import * as own from '../scene/levels';
import * as giants from '../scene/giants';

describe('expanse/shared/levels', () => {
  it('lends exactly its names, as they are', () => {
    const names = ['FADE', 'FAR', 'discPx', 'levelWeights', 'GIANT', 'giantK'];
    expect(Object.keys(levels).sort()).toEqual([...names].sort());
    for (const n of names) expect(levels[n]).toBe(own[n] ?? giants[n]);
  });
});
