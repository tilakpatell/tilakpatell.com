import { describe, expect, it } from 'vitest';
import { boxOf, placeLabels, textWidth } from './mapLabels';

const sheet = { w: 400, h: 300, margin: 10 };
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

describe('the names’ placer', () => {
  it('measures capitals wider than small letters, and a space narrow', () => {
    expect(textWidth('AAAA', 10)).toBeGreaterThan(textWidth('aaaa', 10));
    expect(textWidth('a a', 10)).toBeLessThan(textWidth('aaa', 10));
    expect(textWidth('ABC', 10, 5)).toBeCloseTo(textWidth('ABC', 10) + 10, 9);
  });

  it('puts a lone name at the upper right of its dot, Imhof’s first place', () => {
    const [p] = placeLabels([{ id: 'a', text: 'Bree', at: [100, 100], size: 8 }], [], sheet);
    expect(p.align).toBe('left');
    expect(p.x).toBeGreaterThan(100);
    expect(p.y).toBeLessThan(100);
  });

  it('moves a name round its dot when the first place is taken', () => {
    const block = [[100, 60, 200, 100]]; // all above and right of the dot
    const [p] = placeLabels([{ id: 'a', text: 'Bree', at: [100, 100], size: 8 }], block, sheet);
    expect(overlap(p.box, block[0])).toBe(false);
  });

  it('places the higher rank first and lets no two names touch', () => {
    const labels = [
      { id: 'minor', text: 'Osgiliath', at: [104, 102], size: 7, rank: 3 },
      { id: 'stop', text: 'Minas Tirith', at: [100, 100], size: 9, rank: 0 },
      { id: 'major', text: 'Minas Morgul', at: [108, 98], size: 8, rank: 1 },
    ];
    const out = placeLabels(labels, [], sheet);
    expect(out[0].id).toBe('stop');
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlap(out[i].box, out[j].box), `${out[i].id} ${out[j].id}`).toBe(false);
  });

  it('keeps a name off every other name’s dot', () => {
    const out = placeLabels(
      [
        { id: 'a', text: 'Edoras', at: [100, 100], size: 8, rank: 1 },
        { id: 'b', text: 'Dunharrow', at: [112, 94], size: 8, rank: 1 },
      ],
      [],
      sheet,
    );
    const a = out.find((p) => p.id === 'a');
    expect(overlap(a.box, [110, 92, 114, 96])).toBe(false);
  });

  it('drops a minor name with no room rather than pile it, but never a stop', () => {
    const walls = [
      [0, 0, 400, 95],
      [0, 105, 400, 300],
      [0, 0, 96, 300],
      [104, 0, 400, 300],
    ];
    const out = placeLabels(
      [
        { id: 'stop', text: 'Moria', at: [100, 100], size: 9, rank: 0 },
        { id: 'minor', text: 'Mirrormere', at: [100, 100], size: 7, rank: 3 },
      ],
      walls,
      sheet,
    );
    expect(out.map((p) => p.id)).toEqual(['stop']);
  });

  it('keeps names inside the sheet’s margin', () => {
    const out = placeLabels(
      [
        { id: 'w', text: 'Lindon', at: [12, 150], size: 8, rank: 1 },
        { id: 's', text: 'Umbar', at: [200, 288], size: 8, rank: 1 },
      ],
      [],
      sheet,
    );
    for (const p of out) {
      expect(p.box[0]).toBeGreaterThanOrEqual(sheet.margin);
      expect(p.box[2]).toBeLessThanOrEqual(sheet.w - sheet.margin);
      expect(p.box[3]).toBeLessThanOrEqual(sheet.h - sheet.margin);
    }
  });

  it('slides an area’s name about its middle to find open ground', () => {
    const forest = [[150, 130, 250, 170]];
    const [p] = placeLabels([{ id: 'r', text: 'ROHAN', at: [200, 150], size: 14, spacing: 5, rank: 2, area: 40 }], forest, sheet);
    expect(overlap(p.box, forest[0])).toBe(false);
    expect(Math.hypot(p.x - 200, p.y - 150)).toBeLessThanOrEqual(45);
  });

  it('gives each placed name its box, for the painters and the tests', () => {
    const [p] = placeLabels([{ id: 'a', text: 'Bree', at: [100, 100], size: 8 }], [], sheet);
    expect(p.box).toEqual(boxOf(p.text, p.x, p.y, p.align, 8));
  });
});
