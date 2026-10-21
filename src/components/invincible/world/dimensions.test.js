import { describe, expect, it } from 'vitest';
import { DIMENSIONS, DIM_IDS, PORTAL_R, dimensionOf, enter, mirrorX, savesHere, worldFor } from './dimensions';
import { WATER_Y, buildWorld, near } from './map';
import { newHero, surfaceAt } from './flight';
import { newFoes, spawnFoes } from './foes';

const W = buildWorld();

describe('the four dimensions', () => {
  it('are home, the burnt, the drowned and the mirror city, with their numbers', () => {
    expect(DIM_IDS).toEqual(['home', 'burnt', 'drowned', 'mirror']);
    expect(DIMENSIONS.burnt).toMatchObject({ look: 'night', ruins: 0.7, crowd: 'none', embers: true });
    expect(DIMENSIONS.drowned.water).toBe(12);
    expect(DIMENSIONS.mirror).toMatchObject({ mirror: true, crowd: 'backwards' });
    expect(DIMENSIONS.home.water).toBe(WATER_Y);
    for (const id of DIM_IDS) expect(dimensionOf(id).tint === null || dimensionOf(id).tint.length === 3).toBe(true);
    expect(dimensionOf('nowhere')).toBe(DIMENSIONS.home);
    expect(PORTAL_R).toBe(22);
  });
  it('only home saves what the city keeps', () => {
    expect(savesHere('home')).toBe(true);
    for (const id of ['burnt', 'drowned', 'mirror']) expect(savesHere(id)).toBe(false);
  });
  it('entering keeps his place and speed and clears the foes', () => {
    const h = { ...newHero({ x: 100, y: 50, z: -20, face: 1 }), v: [30, 0, 0], spd: 30, mode: 'air' };
    const f = spawnFoes(newFoes(), 'mauler', 2, [100, 0, 0]);
    const r = enter('burnt', h, f);
    expect(r.dim).toBe('burnt');
    expect(r.h.p).toEqual([100, 50, -20]);
    expect(r.h.v).toEqual([30, 0, 0]);
    expect(r.foes.foes).toEqual([]);
    expect(r.foes.on).toBe(false);
  });
});

describe('a dimension’s world', () => {
  it('is the map’s own at home, and a view of it elsewhere with its water and its mirror', () => {
    expect(worldFor(W, 'home')).toBe(W);
    const d = worldFor(W, 'drowned');
    expect(d.water).toBe(12);
    expect(d.grid).toBe(W.grid);
    // (on the plaza's open ground, east of the hall)
    expect(surfaceAt(d, 24, 27, 1000).y).toBeGreaterThanOrEqual(12);
    expect(surfaceAt(d, 24, 27, 1000).water).toBe(true);
    expect(surfaceAt(W, 24, 27, 1000).water).toBe(false);
  });
  it('the mirror maps x to −x in near', () => {
    const m = worldFor(W, 'mirror');
    // a tower's box well off the axis: found at the reflected place, reflected
    const b = W.boxes.find((q) => Math.abs(q.x0 + q.x1) / 2 > 300 && q.y1 > 60);
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    expect(near(W, cx, cz, 5, []).includes(b)).toBe(true);
    const there = near(m, -cx, cz, 5, []);
    const r = there.find((q) => q.id === b.id);
    expect(r).toBeTruthy();
    expect(r.x0).toBeCloseTo(-b.x1, 6);
    expect(r.x1).toBeCloseTo(-b.x0, 6);
    expect(r.z0).toBe(b.z0);
    // (never the map's own box: a reflected copy, the home world untouched)
    expect(there.includes(b)).toBe(false);
    expect(mirrorX([3, 4, 5])).toEqual([-3, 4, 5]);
    // and the same reflected box comes back as the same object next time
    expect(near(m, -cx, cz, 5, []).find((q) => q.id === b.id)).toBe(r);
  });
});
