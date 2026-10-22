import { describe, expect, it } from 'vitest';
import { ANCHORS, HERO, WATER, at, groundAt, inside, toModel, toWorld } from './hero';
import { FLOOR, GROUND } from './heroGround';
import { CASTLE_FLOOR, placeById } from '../../rules/places';

describe('where the hero castle stands', () => {
  it('stands its courts on the crag’s floor and its water line on the lake', () => {
    expect(toWorld([0, FLOOR, 0])[1]).toBeCloseTo(CASTLE_FLOOR, 6);
    expect(toWorld([0, WATER, 0])[1]).toBeCloseTo(0, 6);
    expect(HERO.scale).toBeGreaterThan(0.8);
    expect(HERO.scale).toBeLessThan(1);
  });

  it('puts its boathouse on the lake’s edge, south of the castle', () => {
    const [x, , z] = at('boathouse');
    expect(x).toBeCloseTo(-60, 6);
    expect(z).toBeCloseTo(36, 6);
    expect(z).toBeGreaterThan(at('greatHall')[2]);
  });

  it('reads a point back into the model’s frame', () => {
    const [x, , z] = toWorld([12, 0, -34]);
    const [mx, mz] = toModel(x, z);
    expect(mx).toBeCloseTo(12, 6);
    expect(mz).toBeCloseTo(-34, 6);
  });

  it('has the castle’s places where the castle has them', () => {
    const near = (id, anchor, d = 1) => {
      const p = placeById(id).at;
      const [x, , z] = at(anchor);
      expect(Math.hypot(p[0] - x, p[1] - z), id).toBeLessThan(d);
    };
    near('great-doors', 'greatDoors');
    near('great-hall', 'greatHall');
    near('staircase', 'staircase');
    near('courtyard', 'courtyard');
    near('courtyard-door', 'courtyardDoor');
    near('clock-tower', 'clockTower');
    near('astronomy-tower', 'astronomy');
    near('viaduct-gate', 'viaductFrom');
    near('bridge-gate', 'bridgeFrom');
    near('boathouse', 'boathouseDoor');
    near('owlery', 'owlery', 8);
    for (const k of Object.keys(ANCHORS)) expect(at(k).every(Number.isFinite), k).toBe(true);
  });

  it('stands its courts on ground of its own, and has none far from it', () => {
    const [x, , z] = at('courtyard');
    expect(inside(x, z)).toBe(true);
    expect(groundAt(x, z).y).toBeGreaterThan(CASTLE_FLOOR - 8);
    expect(groundAt(600, 600)).toBeNull();
    expect(GROUND.length).toBeGreaterThan(20);
  });
});
