import { describe, expect, it } from 'vitest';
import { SIDES, boxAt, placeLabels } from './chartLabels';
import { CHART_VIEWS, DESTINATIONS, chartAt, onChart } from './nav';

// a name's width, near enough the chart's 11 px type
const measure = (t) => t.length * 6.3 + 10;
const H = 18;
const box = (it, p) => ({ x0: it.x + p.dx, y0: it.y + p.dy, x1: it.x + p.dx + p.w, y1: it.y + p.dy + p.h });
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b, size) => [b.x0, b.x1].every((x) => [b.y0, b.y1].every((y) => Math.hypot(x - size / 2, y - size / 2) <= size / 2));

// the places on a chart as NavMap.jsx lays them out: worlds, then stations, then wonders
const RANK = { world: 0, station: 1, wonder: 2 };
function chartItems(viewId, size) {
  const view = CHART_VIEWS[viewId];
  return DESTINATIONS.filter((d) => d.kind !== 'system' && d.sector === view.sector && !(viewId === 'all' && d.kind === 'station'))
    .map((d) => {
      const [u, v] = chartAt(d.at[0], d.at[2], view);
      return { id: d.id, x: u * size, y: v * size, text: d.name, kind: d.kind };
    })
    .filter((it) => onChart([it.x / size, it.y / size]))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

describe('boxAt', () => {
  it('puts a name on its side of the dot, clear of it', () => {
    const [w, h, r, g] = [40, 18, 6, 3];
    for (const side of SIDES) {
      const [dx, dy] = boxAt(side, w, h, r, g);
      const b = { x0: dx, y0: dy, x1: dx + w, y1: dy + h };
      const near = Math.hypot(Math.max(b.x0, Math.min(0, b.x1)), Math.max(b.y0, Math.min(0, b.y1)));
      expect(near, side).toBeGreaterThanOrEqual(r - 1e-9);
    }
    expect(boxAt('right', w, h, r, g)).toEqual([9, -9]);
    expect(boxAt('left', w, h, r, g)).toEqual([-49, -9]);
  });
});

describe('placeLabels', () => {
  it('puts a name to the right of its dot when nothing’s in the way', () => {
    const p = placeLabels([{ id: 'a', x: 200, y: 200, text: 'Earth' }], { size: 400, measure, height: H }).get('a');
    expect(p).toMatchObject({ side: 'right', off: false });
  });

  it('turns a name near the circle’s edge inward, never clipped', () => {
    const p = placeLabels([{ id: 'a', x: 380, y: 200, text: 'The Caribbean' }], { size: 400, measure, height: H }).get('a');
    expect(p.side).toBe('left');
    expect(inside(box({ x: 380, y: 200 }, p), 400)).toBe(true);
  });

  it('moves the second of two names that would sit on each other', () => {
    const items = [
      { id: 'a', x: 200, y: 200, text: 'Dimension C-137' },
      { id: 'b', x: 204, y: 203, text: 'The Portal' },
    ];
    const at = placeLabels(items, { size: 400, measure, height: H });
    expect(at.get('a').off).toBe(false);
    expect(at.get('b').off).toBe(false);
    expect(overlaps(box(items[0], at.get('a')), box(items[1], at.get('b')))).toBe(false);
  });

  it('keeps every name off the chart’s own buttons', () => {
    const block = { x0: 150, y0: 190, x1: 400, y1: 210 };
    const p = placeLabels([{ id: 'a', x: 140, y: 200, text: 'Music room' }], { size: 400, measure, height: H, obstacles: [block] }).get('a');
    expect(p.off).toBe(false);
    expect(overlaps(box({ x: 140, y: 200 }, p), block)).toBe(false);
  });

  it('leaves a name off when no side is clear, with a spot inside the circle for its hover', () => {
    // a dot boxed in by neighbours on every side
    const ring = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, x: 200 + Math.cos((i / 12) * Math.PI * 2) * 14, y: 200 + Math.sin((i / 12) * Math.PI * 2) * 14, text: 'x' }));
    const at = placeLabels([...ring, { id: 'a', x: 200, y: 200, text: 'Boxed in' }], { size: 400, measure, height: H });
    const p = at.get('a');
    expect(p.off).toBe(true);
    expect(inside(box({ x: 200, y: 200 }, p), 400)).toBe(true);
  });

  it('never places a name filtered out, and its dot still pushes the others aside', () => {
    const items = [
      { id: 'a', x: 200, y: 200, text: 'Shown' },
      { id: 'b', x: 245, y: 200, text: 'Filtered', label: false },
    ];
    const at = placeLabels(items, { size: 400, measure, height: H });
    expect(at.get('b').off).toBe(true);
    expect(at.get('a').side).not.toBe('right'); // (right would cover b's dot)
  });

  for (const [view, size] of [['all', 760], ['all', 366], ['home', 760], ['rickmorty', 760], ['rickmorty', 366]]) {
    it(`on the ${view} chart at ${size} px: no two names meet, none covers a dot, none is clipped`, () => {
      const items = chartItems(view, size);
      const at = placeLabels(items, { size, measure, height: H });
      const shown = items.filter((it) => !at.get(it.id).off);
      const boxes = shown.map((it) => box(it, at.get(it.id)));
      for (let i = 0; i < boxes.length; i++) {
        expect(inside(boxes[i], size), shown[i].id).toBe(true);
        for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j]), `${shown[i].id} on ${shown[j].id}`).toBe(false);
        for (const o of items) if (o !== shown[i]) expect(Math.hypot(o.x - Math.max(boxes[i].x0, Math.min(o.x, boxes[i].x1)), o.y - Math.max(boxes[i].y0, Math.min(o.y, boxes[i].y1))) >= 6, `${shown[i].id} on ${o.id}’s dot`).toBe(true);
      }
    });
  }

  it('names every world and wonder on the universe chart at a desktop’s size', () => {
    const items = chartItems('all', 760);
    const at = placeLabels(items, { size: 760, measure, height: H });
    expect(items.filter((it) => at.get(it.id).off).map((it) => it.id)).toEqual([]);
  });
});
