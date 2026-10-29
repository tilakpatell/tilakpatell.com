import { describe, expect, it } from 'vitest';
import { LEVELS, ROUTE, menuRouteFor, wayBack } from './index.js';

describe('Battlefront’s face', () => {
  it('names a level’s way into the engine, with the way back a galaxy world gives it', () => {
    expect(ROUTE).toBe('/battlefront');
    expect(LEVELS).toEqual(['hoth']);
    expect(menuRouteFor()).toBe('/battlefront/hoth');
    expect(menuRouteFor('hoth', { from: '/galaxy/hoth' })).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
    expect(wayBack('?from=%2Fgalaxy%2Fhoth')).toEqual({ label: 'Back to Hoth', to: '/galaxy/hoth' });
    expect(wayBack('?from=/galaxy/endor&gpu=webgl')).toEqual({ label: 'Back to Endor', to: '/galaxy/endor' });
  });

  it('takes no way back but a galaxy world’s page', () => {
    expect(wayBack('')).toBeNull();
    expect(wayBack('?gpu=webgl')).toBeNull();
    expect(wayBack('?from=https://elsewhere.test/galaxy/hoth')).toBeNull();
    expect(wayBack('?from=/galaxy/hoth/surface?mission=assault')).toBeNull();
    expect(wayBack('?from=%2Fgalaxy%2Fhoth%2Fsurface')).toBeNull();
    expect(wayBack('?from=/universe')).toBeNull();
  });
});
