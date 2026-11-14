import { describe, expect, it } from 'vitest';
import { drawnAt, keepTurn } from './battleDrawn';

const ship = (over = {}) => ({ alive: true, prev: { x: 0, y: 0, z: 0 }, pos: { x: 0, y: 0, z: 1 }, seen: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 1 }, bank: 0, ...over });

describe('battleDrawn', () => {
  it('draws a ship between its last two steps, by how far the frame is into the next', () => {
    const o = ship();
    keepTurn(o);
    o.pos = { x: 0, y: 0, z: 2 };
    drawnAt(o, 0.25);
    expect(o.seen).toEqual({ x: 0, y: 0, z: 0.5 });
    drawnAt(o, 1);
    expect(o.seen).toEqual({ x: 0, y: 0, z: 2 });
  });

  it('turns its nose and its bank as far, so a turn is drawn whole rather than snapping round at every step', () => {
    const o = ship();
    keepTurn(o);
    o.fwd = { x: 1, y: 0, z: 0 };
    o.bank = 1;
    drawnAt(o, 0.5);
    expect(o.look.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(o.look.z).toBeCloseTo(Math.SQRT1_2, 9);
    expect(o.lookBank).toBeCloseTo(0.5, 9);
  });

  it('draws one put somewhere new in the step (launched, back from the dead) where it is, turned as it is', () => {
    const o = ship({ pos: { x: 5, y: 5, z: 5 }, prev: { x: 5, y: 5, z: 5 } });
    keepTurn(o);
    o.fwd = { x: 0, y: 1, z: 0 };
    o.bank = 0.7;
    drawnAt(o, 0.5);
    expect(o.seen).toEqual({ x: 5, y: 5, z: 5 });
    expect(o.look).toEqual({ x: 0, y: 1, z: 0 });
    expect(o.lookBank).toBe(0.7);
  });

  it('keeps no turn for a ship that is down', () => {
    const o = ship({ alive: false });
    keepTurn(o);
    expect(o.fwd0).toBeUndefined();
  });
});
