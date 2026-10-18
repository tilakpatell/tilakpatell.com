import { describe, expect, it } from 'vitest';
import { CHART, FRAMES, createView, levelOf } from './projection';
import { fitRange, labelSize, miniView, placeMarks, placeShip, reveal, ringOn, sectorGrid } from './place';
import { boxOf } from './declutter';

const ALL = ['system', 'neighbourhood', 'universe'];
const M = (id, at, more = {}) => ({ id, kind: 'world', name: id.toUpperCase(), at, priority: 50, color: '#fff', levels: ALL, ...more });
const marks = [M('near', [2000, 0, 0]), M('station', [300, 0, 0], { kind: 'station', levels: ['system'] }), M('far', [900000, 0, 0]), M('high', [0, 3000, 4000])];
const view = createView({ range: 120000 });

describe('placing marks', () => {
  it('shows what the level shows and the range holds', () => {
    const ids = placeMarks(view, marks, FRAMES.nav).map((p) => p.id);
    expect(ids).toEqual(['near', 'high']);
  });
  it('keeps the picked place on, pinned to the rim and named', () => {
    const placed = placeMarks(view, marks, FRAMES.nav, { keep: ['far', 'station'] });
    const far = placed.find((p) => p.id === 'far');
    expect(far.edge).toBe(true);
    expect(far.side).not.toBeNull();
    expect(Math.hypot(far.x - 500, far.y - 500)).toBeLessThanOrEqual(470);
    expect(placed.some((p) => p.id === 'station')).toBe(true);
  });
  it('stands a place above the ship on a stem going up the frame', () => {
    const high = placeMarks(view, marks, FRAMES.nav).find((p) => p.id === 'high');
    expect(high.footY - high.y).toBeGreaterThan(0);
  });
  it('thins names by priority', () => {
    const pile = Array.from({ length: 8 }, (_, i) => M(`p${i}`, [5000 + i, 0, 0], { priority: i }));
    const placed = placeMarks(view, pile, FRAMES.nav);
    expect(placed.find((p) => p.id === 'p7').side).not.toBeNull();
    expect(placed.some((p) => p.side === null)).toBe(true);
  });
  it('points the ship’s nose the right way, turned with the chart, and keeps it on the frame', () => {
    expect(placeShip(view, { x: 0, y: 0, z: 0, heading: 0 }, FRAMES.nav).angle).toBeCloseTo(-90);
    expect(placeShip(view, { x: 0, y: 0, z: 0, heading: -Math.PI / 2 }, FRAMES.nav).angle).toBeCloseTo(0);
    expect(placeShip(createView({ range: 120000, yaw: Math.PI / 2 }), { x: 0, y: 0, z: 0, heading: 0 }, FRAMES.nav).angle).toBeCloseTo(0);
    const far = placeShip(view, { x: 1e12, y: 5e9, z: 0, heading: 1 }, FRAMES.nav);
    expect(far.edge).toBe(true);
    expect(Number.isFinite(far.angle)).toBe(true);
  });
  it('reveals a place: a station brings the system level and the focus to it', () => {
    const away = createView({ focus: [40000, 0, 0], range: 120000, follow: true });
    const shown = reveal(away, marks[1]);
    expect(levelOf(shown.range)).toBe('system');
    expect(shown).toMatchObject({ focus: [300, 0, 0], follow: false });
    expect(reveal(away, M('n', [41000, 0, 0]))).toBe(away);
  });
  it('fits the mini-map’s range round what it shows, at its old tilt', () => {
    expect(fitRange([0, 0, 0], marks.slice(0, 2))).toBeCloseTo(2100);
    expect(miniView(marks.slice(0, 2))).toMatchObject({ focus: [0, 0, 0], pitch: CHART.miniPitch, follow: false });
  });
  it('keeps a round frame’s names inside the circle it is clipped to, a pinned pick’s too', () => {
    // (the frame's box is clipped round: its inscribed circle, radius w / 2 about the middle)
    const inCircle = (p, fontPx = 11) => {
      const [w, h] = labelSize(p.mark.name, fontPx);
      const b = boxOf(p.side, { x: p.x, y: p.y, w, h });
      return [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => Math.hypot(x - 500, y - 500) <= 500);
    };
    const d = 0.99 * 120000 * Math.SQRT1_2; // (up and right, near the rim: its right-hand name fits the square, not the circle)
    const diag = placeMarks(view, [M('diag', [d, 0, -d])], FRAMES.nav)[0];
    expect(diag.side).not.toBeNull();
    expect(inCircle(diag)).toBe(true);
    const pinned = placeMarks(view, [M('pick', [9e6, 0, -9e6])], FRAMES.nav, { keep: ['pick'] })[0];
    expect(pinned.edge).toBe(true);
    expect(pinned.side).not.toBeNull();
    expect(inCircle(pinned)).toBe(true);
    // (the mini-map's box frame keeps its square bounds: a name in its corner still fits)
    const mini = placeMarks(createView({ range: 120000 }), [M('corner', [0.99 * 120000 * 0.8, 0, -0.99 * 120000 * 0.45])], FRAMES.mini, { levels: false, sides: ['under'] });
    expect(mini.every((p) => p.side === 'under' || p.edge)).toBe(true);
  });
  it('outlines the sectors round the focus, and rings a centre', () => {
    const grid = sectorGrid(createView({ range: 400000 }), 1);
    expect(grid).toHaveLength(9);
    expect(grid.map((g) => g.key)).toEqual(expect.arrayContaining(['E:0,0', 'E:1,-1', 'E:-1,1']));
    const corner = Math.max(...grid.find((g) => g.key === 'E:0,0').points.map(([u, v]) => Math.hypot(u, v)));
    expect(corner).toBeCloseTo(((60000 * Math.SQRT2) / 400000) ** 0.375, 9);
    for (const [u, v] of ringOn(createView({ range: 100000 }), [0, 0, 0], 5000)) expect(Math.hypot(u, v)).toBeCloseTo(0.05 ** 0.375, 9);
  });
});
