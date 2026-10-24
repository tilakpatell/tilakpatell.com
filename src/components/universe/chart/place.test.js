import { describe, expect, it } from 'vitest';
import { CHART, FRAMES, createView, levelOf, orbitBy, project, reachOn, unproject } from './projection';
import { fitRange, labelSize, miniView, placeMarks, placeShip, reveal, ringOn, sectorGrid } from './place';

const ALL = ['system', 'neighbourhood', 'universe'];
const M = (id, at, more = {}) => ({ id, kind: 'world', name: id.toUpperCase(), at, priority: 50, color: '#fff', levels: ALL, ...more });
const marks = [M('near', [2000, 0, 0]), M('station', [300, 0, 0], { kind: 'station', levels: ['system'] }), M('far', [900000, 0, 0]), M('high', [0, 3000, 4000])];
const view = createView({ range: 120000 });
// the point on the ship's plane that the nav map draws at (x, y)
const drawnAt = (x, y) => unproject(view, [(x - 500) / 470, (y - 500) / 470]);

describe('placing marks', () => {
  it('shows what the level shows and the range holds', () => {
    const ids = placeMarks(view, marks, FRAMES.nav).map((p) => p.id);
    expect(ids).toEqual(['near', 'high']);
    expect(placeMarks(view, marks, FRAMES.nav, { level: 'system' }).map((p) => p.id)).toEqual(['near', 'station', 'high']);
  });
  it('keeps the picked place on, pinned to the rim and named', () => {
    const placed = placeMarks(view, marks, FRAMES.nav, { keep: ['far', 'station'] });
    const far = placed.find((p) => p.id === 'far');
    expect(far.edge).toBe(true);
    expect(far.side).not.toBeNull();
    expect(Math.hypot(far.x - 500, far.y - 500)).toBeLessThanOrEqual(470);
    expect(placed.some((p) => p.id === 'station')).toBe(true);
  });
  it('names the pick even ringed by other places’ dots, and gives a name left off a side to show on', () => {
    const ring = [M('pick', [0, 0, 0]), ...[[540, 500], [460, 500], [500, 530]].map(([x, y], i) => M(`dot${i}`, drawnAt(x, y), { name: '' }))];
    const loose = placeMarks(view, ring, FRAMES.nav)[0];
    expect([loose.side, loose.spare]).toEqual([null, 'right']);
    const picked = placeMarks(view, ring, FRAMES.nav, { keep: ['pick'] })[0];
    expect([picked.side, picked.spare]).toEqual(['right', null]);
    expect(placeMarks(view, ring, FRAMES.nav)[1].spare).toBeNull(); // (no name, nothing to show)
  });
  it('stands a pick past the rim on its stem: the dot slides down it to the rim, and the foot stays put', () => {
    const close = createView({ range: 7200 });
    const below = M('below', [0, -120000, 0]);
    const [down] = placeMarks(close, [below], FRAMES.nav, { keep: ['below'] });
    expect(down).toMatchObject({ edge: true, x: 500, footX: 500, footY: 500 });
    expect(down.y).toBeCloseTo(500 + 0.97 * 470, 9);
    // off to one side and high above: the stem stays upright, the dot on the rim
    const [up] = placeMarks(view, [M('up', [60000, 1.2e6, 0])], FRAMES.nav, { keep: ['up'] });
    expect(up).toMatchObject({ edge: true, footY: 500 });
    expect(up.x).toBe(up.footX);
    expect(up.footX).toBeGreaterThan(500);
    expect(up.y).toBeLessThan(up.footY);
    expect(Math.hypot(up.x - 500, up.y - 500)).toBeCloseTo(0.97 * 470, 9);
    // the mini-map's box holds it at its padded edge, under its foot
    const [mini] = placeMarks(close, [below], FRAMES.mini, { keep: ['below'] });
    expect(mini).toMatchObject({ edge: true, x: 300, y: 292, footX: 300, footY: 142 });
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
  it('outlines the sectors round the focus, and rings a centre', () => {
    const grid = sectorGrid(createView({ range: 400000 }), 1);
    expect(grid).toHaveLength(9);
    expect(grid.map((g) => g.key)).toEqual(expect.arrayContaining(['E:0,0', 'E:1,-1', 'E:-1,1']));
    const corner = Math.max(...grid.find((g) => g.key === 'E:0,0').points.map(([u, v]) => Math.hypot(u, v)));
    expect(corner).toBeCloseTo(((60000 * Math.SQRT2) / 400000) ** 0.375, 9);
    for (const [u, v] of ringOn(createView({ range: 100000 }), [0, 0, 0], 5000)) expect(Math.hypot(u, v)).toBeCloseTo(0.05 ** 0.375, 9);
  });
  it('puts a mark where the projection says, sized by its reach, and closes its outlines', () => {
    const tilted = orbitBy(createView({ range: 120000 }), [0.6, 0.7]);
    const m = M('body', [-9000, 2500, 14000], { reach: 4000 });
    const [placed] = placeMarks(tilted, [m], FRAMES.nav);
    const p = project(tilted, m.at);
    expect(placed).toMatchObject({ id: 'body', mark: m, edge: false, depth: p.depth });
    expect([placed.x, placed.y, placed.footX, placed.footY]).toEqual([500 + p.u * 470, 500 + p.v * 470, 500 + p.foot[0] * 470, 500 + p.foot[1] * 470]);
    expect(placed.size).toBeCloseTo(reachOn(tilted, m.at, 4000) * 470, 12);
    expect(placeMarks(tilted, [M('levels', [300, 0, 0], { levels: ['system'] })], FRAMES.nav, { levels: false })).toHaveLength(1);
    const ring = ringOn(tilted, [1000, 0, 0], 5000, 16);
    expect(ring).toHaveLength(17);
    expect(ring.at(-1)).toEqual(ring[0]);
    const outline = sectorGrid(tilted, 0)[0].points;
    expect(outline).toHaveLength(4 * 11 + 1);
    expect(outline.at(-1)).toEqual(outline[0]);
  });
  it('sizes names in pixels, puts the pick’s down first, and keeps them off the ship and inside the circle', () => {
    expect(labelSize('Ember', 11)).toEqual([5 * 0.58 * 11 + 22, 24]);
    expect(labelSize('', 20)).toEqual([22, 32]);
    const [alone] = placeMarks(view, [M('alone', drawnAt(400, 500))], FRAMES.nav);
    expect(alone.side).toBe('right');
    expect(placeMarks(view, [M('alone', drawnAt(400, 500))], FRAMES.nav, { avoid: [{ x: alone.x + 30, y: alone.y }] })[0].side).toBe('left');
    // a pick far off up and to the right is pinned at the rim's diagonal, where a name on its right would be cut off
    const [out] = placeMarks(view, [M('out', [1e7, 0, -1e7], { name: 'A long way out' })], FRAMES.nav, { keep: ['out'] });
    expect([out.edge, out.side]).toEqual([true, 'left']);
    expect([out.footX, out.footY]).toEqual([out.x, out.y]); // (pinned, it has no stem: its foot is off the chart too)
    const pile = Array.from({ length: 8 }, (_, i) => M(`p${i}`, [5000 + i, 0, 0], { priority: i }));
    expect(placeMarks(view, pile, FRAMES.nav, { keep: ['p0'] }).find((p) => p.id === 'p0').side).toBe('right');
    const pair = [M('a', drawnAt(400, 500), { name: 'Aa' }), M('b', drawnAt(460, 500), { name: 'Bb' })];
    expect(placeMarks(view, pair, FRAMES.nav).map((p) => p.side)).toEqual(['right', 'right']);
    expect(placeMarks(view, pair, FRAMES.nav, { scale: 0.5 }).map((p) => p.side)).toEqual(['left', 'right']);
    expect(placeMarks(view, pair, FRAMES.nav, { sides: ['under'] }).map((p) => p.side)).toEqual(['under', 'under']);
  });
  it('reveals a place at the nearest level that shows it, by the least zoom', () => {
    const both = M('both', [1000, 0, 0], { levels: ['system', 'universe'] });
    expect(reveal(createView({ range: 9000 }), both).range).toBeCloseTo(7200, 6);
    expect(reveal(createView({ range: 240000 }), both).range).toBeCloseTo(300000, 6);
    expect(reveal(createView({ range: 2e6 }), M('moon', [1000, 0, 0], { levels: ['system', 'neighbourhood'] })).range).toBeCloseTo(225000, 6);
  });
  it('leans the ship’s nose with the chart’s tilt', () => {
    const tilted = createView({ range: 120000, pitch: 1 });
    expect(placeShip(tilted, { x: 0, y: 0, z: 0, heading: -Math.PI / 4 }, FRAMES.nav).angle).toBeCloseTo((Math.atan2(-Math.cos(1), 1) * 180) / Math.PI, 9);
  });
  it('draws nothing NaN: a place with no number is dropped even when picked, and a missing ship is placed nowhere', () => {
    const placed = placeMarks(view, [M('lost', [NaN, 0, 0]), M('here', [0, 0, 0], { reach: 500, name: '' })], FRAMES.nav, { keep: ['lost', 'here'], avoid: [null, placeShip(view, null, FRAMES.nav), { x: NaN, y: 500 }] });
    expect(placed.map((p) => p.id)).toEqual(['here']);
    expect(placed[0]).toMatchObject({ x: 500, y: 500, footX: 500, footY: 500, side: null, edge: false });
    expect(Number.isFinite(placed[0].size)).toBe(true);
    for (const ship of [null, undefined, { x: NaN, y: 0, z: 0 }]) expect(placeShip(view, ship, FRAMES.nav)).toBeNull();
    const still = placeShip(view, { x: 0, y: 0, z: 0 }, FRAMES.nav); // (no heading: it faces 0, up the chart)
    expect(still).toMatchObject({ x: 500, y: 500, edge: false });
    expect(still.angle).toBeCloseTo(-90);
    expect([fitRange([0, 0, 0], []), fitRange([0, 0, 0], [M('x', [1e12, 0, 0]), M('y', [NaN, 0, 0])])]).toEqual([CHART.range.min, CHART.range.max]);
    expect(reveal(view, null)).toBe(view);
    expect(ringOn(view, [0, 0, 0], 5000, 0)).toHaveLength(4); // (a ring has at least three sides)
    expect(ringOn(view, [0, 0, 0], 5000, 7.6)).toHaveLength(8);
    expect(ringOn(view, [0, 0, 0], 5000, NaN)).toHaveLength(65);
    for (const ring of [ringOn(view, [0, 0, 0], 5000, 0), ringOn(view, [0, 0, 0], 5000, Infinity)]) for (const pt of ring) expect(pt.every(Number.isFinite)).toBe(true);
    expect([ringOn(view, [0, 0, 0], NaN), ringOn(view, [NaN, 0, 0], 5000), ringOn(view, null, 5000)]).toEqual([[], [], []]);
  });
});
