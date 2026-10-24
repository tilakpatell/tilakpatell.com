import { describe, expect, it } from 'vitest';
import { CHART_VIEWS, DESTINATIONS } from '../nav';
import { MOONS } from '../universes';
import { BELT, HOME_RADIUS, SECTORS, SUN } from '../layout';
import { CHART, FRAMES, levelOf } from './projection';
import { placeMarks } from './place';
import { HAND_MARKS, REGIONS, liveMarks, markById, openView, presetOf, presetView } from './marks';

const places = DESTINATIONS.filter((d) => d.kind !== 'system');

describe('the chart’s marks', () => {
  it('has one for every place on the nav map but the galaxy’s systems, as nav.js has it', () => {
    for (const d of places) expect(markById(d.id), d.id).toMatchObject({ name: d.name, at: d.at, color: d.color, pickable: true });
    expect(HAND_MARKS.filter((m) => m.pickable)).toHaveLength(places.length);
  });
  it('knows the moons, the stations and the wonders’ shapes, and its own three', () => {
    for (const m of MOONS) expect(markById(m.id).kind).toBe('moon');
    expect(markById('experience')).toMatchObject({ kind: 'station', levels: ['system'] });
    expect(['veil', 'maw', 'ember', 'rmportal', 'aurelia'].map((id) => markById(id).shape)).toEqual(['cloud', 'hole', 'star', 'portal', 'dot']);
    expect(markById('chart:home')).toMatchObject({ name: CHART_VIEWS.home.name, pickable: false, levels: ['neighbourhood', 'universe'] });
    expect(markById('chart:curve')).toMatchObject({ name: CHART_VIEWS.rickmorty.name, at: SECTORS.rickmorty.origin, levels: ['universe'] });
    expect(markById('home').kind).toBe('station');
  });
  it('makes the live marks from where(): pilots and far fights, level with the ship', () => {
    const now = { ship: { x: 0, y: 250, z: 0 }, pilots: [{ id: 'a1', name: 'Ace', x: 10, z: 20 }], farFights: [{ id: 'f1', x: 500, z: -500, label: 'Fighting near Ember' }, { id: 'bad', x: NaN, z: 0, label: 'x' }] };
    expect(liveMarks(now)).toEqual([
      expect.objectContaining({ id: 'pilot:a1', kind: 'pilot', name: '', at: [10, 250, 20], pickable: false }),
      expect.objectContaining({ id: 'fight:f1', kind: 'fight', name: 'Fighting near Ember', at: [500, 250, -500] }),
    ]);
    expect(liveMarks(null)).toEqual([]);
  });
  it('opens on the ship, or the universe without one, and says which part it’s looking at', () => {
    expect(openView(null)).toMatchObject({ focus: [0, 0, 0], range: CHART_VIEWS.all.r, follow: false });
    const [x, y, z] = markById('marvel').at;
    const open = openView({ x, y, z });
    expect(open).toMatchObject({ focus: [x, y, z], range: CHART.range.open, follow: true });
    expect(presetOf(open)).toBe('all');
    const o = SECTORS.rickmorty.origin;
    const curve = openView({ x: o[0] + 900, y: 0, z: o[2] });
    expect([curve.range, presetOf(curve)]).toEqual([CHART_VIEWS.rickmorty.r, 'rickmorty']);
    const home = presetView('home', { x: 5, y: 77, z: 5 });
    expect(home).toMatchObject({ focus: [0, 77, 0], range: CHART_VIEWS.home.r, follow: false });
    expect([presetOf(home), levelOf(home.range)]).toEqual(['home', 'system']);
  });

  // (and the numbers and the odd cases the four above leave open)
  it('ranks and levels the places by kind, a portal last, and draws the sun unnamed', () => {
    expect(['marvel', 'aurelia', 'gazorpazorp', 'resume', 'rmportal', 'rmportal-back'].map((id) => markById(id).priority)).toEqual([60, 50, 45, 40, 30, 30]);
    const all = ['system', 'neighbourhood', 'universe'];
    expect([markById('marvel').levels, markById('maw').levels, markById('squanch').levels]).toEqual([all, all, ['system', 'neighbourhood']]);
    expect(markById('chart:sun')).toMatchObject({ name: '', at: SUN.at, reach: SUN.r, shape: 'sun', levels: all, pickable: false });
    expect(markById('chart:curve').priority).toBeLessThan(markById('chart:home').priority);
    expect(HAND_MARKS.filter((m) => m.id.startsWith('sys:'))).toEqual([]);
    expect(new Set(HAND_MARKS.map((m) => m.id)).size).toBe(HAND_MARKS.length);
    expect([markById('nowhere'), markById('__proto__'), markById(undefined)]).toEqual([null, null, null]);
  });
  it('is frozen, and freezes none of nav.js’s own arrays', () => {
    expect(Object.isFrozen(HAND_MARKS)).toBe(true);
    for (const m of HAND_MARKS) expect(Object.isFrozen(m) && Object.isFrozen(m.at) && Object.isFrozen(m.levels), m.id).toBe(true);
    expect(markById('marvel').at).not.toBe(destinationAt('marvel'));
    expect(Object.isFrozen(destinationAt('marvel'))).toBe(false);
    expect(Object.isFrozen(SECTORS.rickmorty.origin)).toBe(false);
  });
  it('rings the home system, the belt and the Curve, and no edge round the map', () => {
    expect(REGIONS).toEqual([
      { id: 'home', centre: [0, 0, 0], radius: HOME_RADIUS, levels: ['neighbourhood', 'universe'] },
      { id: 'belt', centre: [0, 0, 0], radius: (BELT.inner + BELT.outer) / 2, levels: ['system'] },
      { id: 'curve', centre: SECTORS.rickmorty.origin, radius: SECTORS.rickmorty.edge, levels: ['system', 'neighbourhood'] },
    ]);
  });
  it('drops the live marks it can’t place, and keeps them level with a ship that has no number', () => {
    expect(liveMarks({ ship: null, pilots: 'x', farFights: [null, { id: 'f2', x: 1, z: Infinity }] })).toEqual([]);
    const now = { ship: { x: 0, y: NaN, z: 0 }, pilots: [{ id: 'b', x: 1, z: 2 }, { id: 'b', x: 3, z: 4 }, { x: 5, z: 6 }], farFights: [{ id: 'f3', x: 7, z: 8, label: 9 }] };
    expect(liveMarks(now).map((m) => [m.id, m.at, m.name])).toEqual([
      ['pilot:b', [1, 0, 2], ''],
      ['fight:f3', [7, 0, 8], ''],
    ]);
    expect(liveMarks({ pilots: [{ id: 'c', x: 1, z: 1 }] }).map((m) => m.levels)).toEqual([['system', 'neighbourhood']]);
  });
  it('places on the nav map from every preset with a number for everything, the stations only in the home system', () => {
    const shown = (view) => placeMarks(view, [...HAND_MARKS, ...liveMarks({ ship: { x: 0, y: 0, z: 140 }, pilots: [{ id: 'p', x: 300, z: 0 }] })], FRAMES.nav);
    for (const view of [openView(null), presetView('home', null), presetView('rickmorty', null), openView({ x: 0, y: 0, z: 140 }), presetView('all', null)]) {
      const placed = shown(view);
      expect(placed.length).toBeGreaterThan(0);
      for (const p of placed) expect([p.x, p.y, p.footX, p.footY, p.size].every(Number.isFinite), p.id).toBe(true);
    }
    expect(shown(presetView('home', null)).map((p) => p.id)).toEqual(expect.arrayContaining(['home', 'resume', 'chart:sun', 'pilot:p']));
    const all = shown(openView(null));
    expect(all.map((p) => p.id)).toEqual(expect.arrayContaining(['chart:home', 'chart:sun', 'marvel', 'aurelia']));
    expect(all.some((p) => p.mark.kind === 'station')).toBe(false);
  });
  it('takes an unknown preset as the universe, and a far focus as no preset', () => {
    expect(presetView('constructor', null)).toEqual(presetView('all', null));
    expect(presetOf(presetView('all', null))).toBe('all');
    expect(presetOf(presetView('rickmorty', { x: 0, y: -40, z: 0 }))).toBe('rickmorty');
    expect(presetOf({ ...presetView('home', null), range: 20000 })).toBe('all'); // (the home system at a neighbourhood's range)
    expect(openView({ x: NaN, y: 0, z: 0 })).toEqual(openView(null));
  });
});

function destinationAt(id) {
  return DESTINATIONS.find((d) => d.id === id).at;
}
