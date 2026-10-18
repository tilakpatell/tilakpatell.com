import { describe, expect, it } from 'vitest';
import { boxOf, declutter } from './declutter';

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
});
