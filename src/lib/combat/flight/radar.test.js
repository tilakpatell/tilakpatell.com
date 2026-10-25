import { describe, expect, it } from 'vitest';
import { forward } from '../../flight/orient';
import { RANGE, createRadar, radarPoints, rangeFor, rangeFrom } from './radar';

const ship = { x: 0, y: 0, z: 0, heading: 0 };
// forward(h) is the ship's nose as [x, z]: ahead is where it points, whatever the convention
const [fx, fz] = forward(0);
const ahead = (d) => ({ x: fx * d, y: 0, z: fz * d });

describe('radar', () => {
  it('puts what is ahead at the top, on the centre line', () => {
    const [p] = radarPoints(ship, [{ id: 'a', kind: 'hostile', at: ahead(20) }], 40);
    expect(p.y).toBeCloseTo(0.5);
    expect(Math.abs(p.x)).toBeLessThan(1e-6);
    expect(p.rim).toBe(false);
  });
  it('pins what is out of range to the rim', () => {
    const [p] = radarPoints(ship, [{ id: 'a', kind: 'hostile', at: ahead(400) }], 40);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1);
    expect(p.rim).toBe(true);
  });
  it('says above or below', () => {
    const pts = radarPoints(
      ship,
      [
        { id: 'u', kind: 'ally', at: { ...ahead(10), y: 8 } },
        { id: 'd', kind: 'ally', at: [fx * 10, -8, fz * 10] },
        { id: 'l', kind: 'ally', at: [fx * 10, 1, fz * 10] },
      ],
      40,
    );
    expect(pts.map((p) => p.up)).toEqual([1, -1, 0]);
  });
  it('turns with the ship: what was ahead is behind after half a turn', () => {
    const [p] = radarPoints({ ...ship, heading: Math.PI }, [{ id: 'a', kind: 'hostile', at: ahead(20) }], 40);
    expect(p.y).toBeCloseTo(-0.5);
  });
  it('puts the ship’s right on the right', () => {
    // a quarter turn round from the nose, clockwise seen from above (the right of a ship whose up is +y)
    const right = { x: -fz * 10, y: 0, z: fx * 10 };
    const [r] = radarPoints(ship, [{ id: 'r', kind: 'hostile', at: right }], 40);
    expect(r.x).toBeCloseTo(0.25);
    expect(Math.abs(r.y)).toBeLessThan(1e-6);
    const [l] = radarPoints(ship, [{ id: 'l', kind: 'hostile', at: { x: fz * 10, y: 0, z: -fx * 10 } }], 40);
    expect(l.x).toBeCloseTo(-0.25);
  });
  it('closes in when a hostile is near', () => {
    expect(rangeFor(ship, [{ at: ahead(30) }])).toBe(RANGE.fight);
    expect(rangeFor(ship, [{ at: ahead(90) }])).toBe(RANGE.cruise);
    expect(rangeFor(ship, [])).toBe(RANGE.cruise);
  });
  it('keeps the dogfight range till the nearest hostile is well clear', () => {
    expect(rangeFor(ship, [{ at: ahead(50) }], RANGE.fight)).toBe(RANGE.fight);
    expect(rangeFor(ship, [{ at: ahead(50) }], RANGE.cruise)).toBe(RANGE.cruise);
    expect(rangeFor(ship, [{ at: ahead(60) }], RANGE.fight)).toBe(RANGE.cruise);
    expect(rangeFrom(55, RANGE.fight)).toBe(RANGE.fight);
    expect(rangeFrom(Infinity, RANGE.fight)).toBe(RANGE.cruise);
  });
  it('reuses its records tick to tick', () => {
    const radar = createRadar();
    radar.start(ship);
    radar.add('a', 'hostile', ahead(30));
    radar.add('b', 'ally', [fx * 10, 0, fz * 10]);
    const first = radar.points(radar.range);
    const rec = first[0];
    expect(first.n).toBe(2);
    expect(radar.range).toBe(RANGE.fight);
    radar.start(ship);
    radar.add('a', 'hostile', ahead(50));
    const second = radar.points(radar.range);
    expect(second).toBe(first);
    expect(second[0]).toBe(rec);
    expect(second.n).toBe(1);
    // (50 off, having been closer: still the dogfight's range)
    expect(radar.range).toBe(RANGE.fight);
    radar.start(ship);
    radar.add('a', 'hostile', ahead(70));
    expect(radar.range).toBe(RANGE.cruise);
  });
  it('is due at most 20 times a second, or at the rate given', () => {
    const radar = createRadar();
    const slow = createRadar();
    expect([0.03, 0.05, 0.09, 0.1].map((t) => radar.due(t))).toEqual([false, true, false, true]);
    expect([0.05, 0.1, 0.15].map((t) => slow.due(t, 10))).toEqual([false, true, false]);
  });
});
