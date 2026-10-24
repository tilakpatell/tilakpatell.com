import { describe, expect, it } from 'vitest';
import { SIDES, boxOf, declutter, firstInside } from './declutter';

const bounds = { x0: 0, y0: 0, x1: 1000, y1: 1000 };
const L = (id, x, y, priority, w = 120, h = 24) => ({ id, x, y, w, h, priority });
const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('declutter', () => {
  it('keeps the highest priority’s name, and no two kept names meet', () => {
    const pile = Array.from({ length: 8 }, (_, i) => L(`p${i}`, 500 + i, 500, i));
    const sides = declutter(pile, { bounds });
    expect(sides.get('p7')).toBe('right');
    expect([...sides.values()].filter((s) => s === null).length).toBeGreaterThan(0);
    const kept = pile.filter((l) => sides.get(l.id)).map((l) => boxOf(sides.get(l.id), l));
    for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) expect(meet(kept[i], kept[j])).toBe(false);
  });
  it('turns a name left at the frame’s right edge', () => {
    expect(declutter([L('edge', 950, 500, 1)], { bounds }).get('edge')).toBe('left');
  });
  it('keeps a name off another place’s dot', () => {
    expect(declutter([L('a', 500, 500, 1)], { bounds, dots: [{ x: 560, y: 500 }] }).get('a')).toBe('left');
  });
  it('can be held to one side, as the mini-map’s names hang under their dots', () => {
    const s = declutter([L('a', 300, 150, 2), L('b', 302, 150, 1)], { bounds, sides: ['under'] });
    expect([s.get('a'), s.get('b')]).toEqual(['under', null]);
  });
  it('draws a side’s box round the dot and its name: right, left or under it', () => {
    expect(SIDES).toEqual(['right', 'left', 'under']);
    const at = { x: 100, y: 100, w: 120, h: 24 };
    expect(boxOf('right', at)).toEqual({ x0: 92, y0: 88, x1: 212, y1: 112 });
    expect(boxOf('left', at)).toEqual({ x0: -12, y0: 88, x1: 108, y1: 112 });
    expect(boxOf('under', at)).toEqual({ x0: 40, y0: 92, x1: 160, y1: 132 });
  });
  it('never lets a place’s own dot, or one drawn on it, block its name', () => {
    expect(declutter([L('a', 500, 500, 1)], { bounds, dots: [{ x: 500, y: 500 }, { x: 506, y: 505 }] }).get('a')).toBe('right');
    expect(declutter([L('a', 500, 500, 1)], { bounds, dots: [{ x: 509, y: 500 }] }).get('a')).toBeNull();
  });
  it('breaks a tie by id, so the same names thin the same way in any order, kept places too', () => {
    for (const priority of [5, Infinity]) {
      const pair = [L('b', 500, 500, priority), L('a', 501, 500, priority)];
      for (const labels of [pair, [...pair].reverse()]) {
        const s = declutter(labels, { bounds });
        expect([s.get('a'), s.get('b')]).toEqual(['right', null]);
      }
    }
  });
  it('keeps a name inside a round frame, as the nav map’s circle cuts off the rest', () => {
    const circle = { cx: 500, cy: 500, r: 470 };
    const rim = L('rim', 822, 178, 1, 86); // (just inside the rim, up and to the right)
    expect(declutter([rim], { bounds }).get('rim')).toBe('right');
    expect(declutter([rim], { bounds: circle }).get('rim')).toBe('left');
    expect(declutter([L('lost', NaN, 500, 1)], { bounds: circle }).get('lost')).toBeNull();
  });
  it('gives no side to a name that can’t fit the frame, or has no number for its place', () => {
    const s = declutter([L('wide', 500, 500, 1, 2000), L('lost', NaN, 500, 2), L('fine', 200, 200, 0)], { bounds });
    expect([s.get('wide'), s.get('lost'), s.get('fine')]).toEqual([null, null, 'right']);
  });
  it('names a firm label (the pick’s) even ringed by dots, but off them where it can, inside the frame and off names already down', () => {
    const firm = (l) => ({ ...l, firm: true });
    const ringed = { bounds, dots: [{ x: 540, y: 500 }, { x: 460, y: 500 }, { x: 500, y: 530 }] };
    expect(declutter([L('a', 500, 500, 1)], ringed).get('a')).toBeNull();
    expect(declutter([firm(L('a', 500, 500, 1))], ringed).get('a')).toBe('right');
    expect(declutter([firm(L('a', 500, 500, 1))], { bounds, dots: [{ x: 560, y: 500 }] }).get('a')).toBe('left');
    expect(declutter([firm(L('a', 950, 500, 1))], { bounds, sides: ['right'] }).get('a')).toBeNull();
    const s = declutter([L('b', 500, 500, 2), firm(L('a', 501, 500, 1))], { bounds });
    expect([s.get('b'), s.get('a')]).toEqual(['right', null]);
  });
  it('keeps every name off a hard point (the ship), a firm one’s too, where it lets a place’s dot go', () => {
    const firm = (l) => ({ ...l, firm: true });
    const crowd = { bounds, dots: [{ x: 360, y: 500 }, { x: 400, y: 530 }], hard: [{ x: 440, y: 500 }] };
    expect(declutter([firm(L('pick', 400, 500, 1, 86))], crowd).get('pick')).toBe('left');
    expect(declutter([L('a', 500, 500, 1)], { bounds, hard: [{ x: 560, y: 500 }] }).get('a')).toBe('left');
    // a ship hard by the pick blocks every side: the pick goes unnamed rather than hide it
    expect(declutter([firm(L('pick', 400, 500, 1))], { bounds, hard: [{ x: 400, y: 510 }] }).get('pick')).toBeNull();
    // and one drawn on the pick's own dot blocks nothing
    expect(declutter([firm(L('pick', 400, 500, 1))], { bounds, hard: [{ x: 404, y: 504 }] }).get('pick')).toBe('right');
  });
  it('finds the first side inside the frame, for a name left off to show on', () => {
    expect(firstInside(L('a', 500, 500, 1), { bounds })).toBe('right');
    expect(firstInside(L('a', 950, 500, 1), { bounds })).toBe('left');
    expect(firstInside(L('a', 500, 500, 1), { bounds, sides: ['under'] })).toBe('under');
    expect(firstInside(L('a', 822, 178, 1, 86), { bounds: { cx: 500, cy: 500, r: 470 } })).toBe('left');
    expect(firstInside(L('wide', 500, 500, 1, 2000), { bounds })).toBeNull();
    expect(firstInside(L('lost', NaN, 500, 1), { bounds })).toBeNull();
  });
});
