import { describe, expect, it } from 'vitest';
import { HALL, PLINTHS, atDoor, clampToRoom, enterHall, inRoom, leaveHall, meet, nearBoard, nearDoor, nearPlinth, plinthAt, plinthFace } from './hallRules';
import { newHero } from './flight';

describe('the room', () => {
  it('is a disc of radius 28 with eight plinths and the door at (0, 21)', () => {
    expect(HALL.r).toBe(28);
    expect(HALL.door).toEqual([0, 21]);
    expect(PLINTHS).toHaveLength(8);
    for (const p of PLINTHS) expect(Math.hypot(p[0], p[2])).toBeCloseTo(HALL.plinthR, 6);
    // none in the doorway or before the board: every plinth is well off the room's z axis
    for (const p of PLINTHS) expect(Math.abs(p[0])).toBeGreaterThan(5);
    expect(plinthAt(0)).toEqual(PLINTHS[0]);
  });
  it('faces every plinth at the middle', () => {
    PLINTHS.forEach((p, i) => {
      const f = plinthFace(i);
      // a step along its face goes toward the centre
      expect(Math.hypot(p[0] + Math.sin(f), p[2] + Math.cos(f))).toBeLessThan(Math.hypot(p[0], p[2]));
    });
  });
  it('keeps him inside: the walls and the dome', () => {
    expect(clampToRoom([0, 1, 0])).toEqual([0, 1, 0]);
    const out = clampToRoom([40, 1, 0]);
    expect(Math.hypot(out[0], out[2])).toBeLessThanOrEqual(HALL.r);
    expect(clampToRoom([0, 30, 0])[1]).toBeLessThan(HALL.high);
    expect(clampToRoom([0, -3, 0])[1]).toBe(0);
    expect(inRoom([10, 2, 10])).toBe(true);
    expect(inRoom([30, 2, 0])).toBe(false);
  });
  it('says what he is near: a plinth, the board, the door', () => {
    const p = PLINTHS[3];
    expect(nearPlinth([p[0], 0, p[2]])).toBe(3);
    expect(nearPlinth([0, 0, 0])).toBe(-1);
    expect(nearBoard([0, 0, -18])).toBe(true);
    expect(nearBoard([0, 0, 0])).toBe(false);
    expect(nearDoor([1, 0, 20])).toBe(true);
    expect(nearDoor([0, 0, 0])).toBe(false);
  });
  it('is gone into from the plaza at its door, on the ground', () => {
    expect(atDoor([1, 0, 23])).toBe(true);
    expect(atDoor([1, 40, 23])).toBe(false);
    expect(atDoor([30, 0, 23])).toBe(false);
  });
});

describe('in and out', () => {
  it('going in sets the zone hall and keeps where he was; out restores the street', () => {
    const h0 = { ...newHero({ x: 3, y: 0, z: 25, face: 1.2 }), v: [4, 0, 0], spd: 4 };
    const { h, inside } = enterHall(h0);
    expect(h.zone).toBe('hall');
    expect(h.mode).toBe('ground');
    expect(h.v).toEqual([0, 0, 0]);
    expect(inRoom(h.p)).toBe(true);
    expect(inside.from).toEqual({ p: [3, 0, 25], face: 1.2 });
    expect(inside.met).toEqual([]);
    const out = leaveHall(h);
    expect(out.zone).toBe('city');
    expect(out.p).toEqual(HALL.out.p);
    expect(out.face).toBe(HALL.out.face);
  });
  it('the eight met once is the achievement', () => {
    let s = enterHall(newHero({ x: 0, y: 0, z: 25, face: 0 })).inside;
    let all = false;
    for (let i = 0; i < 8; i++) {
      const r = meet(s, i);
      s = r.inside;
      all = r.all;
      expect(all).toBe(i === 7);
    }
    expect(meet(s, 2)).toEqual({ inside: s, all: false });
  });
});
