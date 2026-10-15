import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_MODES, MODES, firstModeOf, menuRouteFor, routeFor, wayBack } from './index.js';

describe('the Battlefront world’s face', () => {
  it('names its route, with the way back a galaxy world gives it', () => {
    expect(routeFor()).toBe('/battlefront/hoth/galacticAssault');
    expect(routeFor('hoth', 'galacticAssault', { from: '/galaxy/hoth' })).toBe('/battlefront/hoth/galacticAssault?from=%2Fgalaxy%2Fhoth');
    expect(wayBack('?from=%2Fgalaxy%2Fhoth')).toEqual({ label: 'Back to Hoth', to: '/galaxy/hoth' });
    expect(wayBack('?from=/galaxy/endor&gpu=webgl')).toEqual({ label: 'Back to Endor', to: '/galaxy/endor' });
  });
  it('takes no way back but a galaxy world’s page', () => {
    expect(wayBack('')).toBeNull();
    expect(wayBack('?gpu=webgl')).toBeNull();
    expect(wayBack('?from=https://elsewhere.test/galaxy/hoth')).toBeNull();
    expect(wayBack('?from=/galaxy/hoth/surface?mission=assault')).toBeNull();
    expect(wayBack('?from=/universe')).toBeNull();
  });
  it('names the menu a level lands in, with the way back, and the level’s first mode', () => {
    expect(menuRouteFor()).toBe('/battlefront/hoth');
    expect(menuRouteFor('hoth', { from: '/galaxy/hoth' })).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
    expect(wayBack('?from=%2Fgalaxy%2Fhoth')).toEqual({ label: 'Back to Hoth', to: '/galaxy/hoth' });
    expect(wayBack('?from=%2Fgalaxy%2Fhoth%2Fsurface')).toBe(null);
    expect(firstModeOf('hoth')).toBe('galacticAssault');
    expect(firstModeOf('nowhere')).toBe(null);
  });
  it('plays every level in a mode the world runs', () => {
    for (const l of LEVELS) for (const m of LEVEL_MODES[l]) expect(MODES).toContain(m);
  });
});
