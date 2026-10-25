import { describe, expect, it } from 'vitest';
import { clusterHeight } from './thumbs.js';

describe('the cluster’s height', () => {
  it('is the row, and the strip over it with the grid’s gap', () => {
    expect(clusterHeight({ offsetHeight: 120 }, null)).toBe(120);
    expect(clusterHeight({ offsetHeight: 120 }, { offsetHeight: 30 })).toBe(156);
    expect(clusterHeight(null, null)).toBe(0);
  });
});
