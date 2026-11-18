import { describe, expect, it } from 'vitest';
import { extentOf } from './extent';

// (its imports, none, are pinned with the light face's in shared/gen.test.js)
describe('a planet’s extent', () => {
  it('measures a planet out to its furthest moon, not its last', () => {
    const moon = (orbit, radius) => ({ orbit, radius });
    expect(extentOf({ radius: 10, ringBand: null, moonList: [moon(40, 9), moon(45, 3)] })).toBe(49);
    expect(extentOf({ radius: 10, ringBand: { inner: 13, outer: 30 }, moonList: [] })).toBe(30);
    expect(extentOf({ radius: 10, ringBand: null, moonList: [] })).toBe(10);
  });
});
