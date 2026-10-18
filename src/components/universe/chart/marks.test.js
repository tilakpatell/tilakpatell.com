import { describe, expect, it } from 'vitest';
import { CHART_VIEWS, DESTINATIONS } from '../nav';
import { MOONS } from '../universes';
import { SECTORS } from '../layout';
import { CHART, levelOf, project } from './projection';
import { HAND_MARKS, liveMarks, markById, openView, presetOf, presetView } from './marks';

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
  it('frames a preset’s region from the ship’s height: far above or below the disc, the home system is still in range', () => {
    for (const y of [-505, 1053, 4000]) {
      const v = presetView('home', { x: 5000, y, z: 3000 });
      expect([presetOf(v), levelOf(v.range)], String(y)).toEqual(['home', 'system']);
      for (const m of HAND_MARKS.filter((k) => k.kind === 'station' || k.id === 'chart:sun')) expect(project(v, m.at).inside, `${m.id} from ${y}`).toBe(true);
    }
  });
});

describe('the chart’s own bounds and odd input', () => {
  it('keeps every preset’s range finite and inside the chart’s limits', () => {
    for (const id of ['all', 'home', 'rickmorty']) {
      const { range } = presetView(id, null);
      expect(Number.isFinite(range)).toBe(true);
      expect(range).toBeGreaterThanOrEqual(CHART.range.min);
      expect(range).toBeLessThanOrEqual(CHART.range.max);
    }
  });
  it('is frozen, and has no mark for an unknown id', () => {
    expect(Object.isFrozen(HAND_MARKS)).toBe(true);
    expect(HAND_MARKS.every((m) => Object.isFrozen(m))).toBe(true);
    expect(markById('nowhere')).toBeNull();
  });
  it('tolerates a where() with no pilots or fights', () => {
    expect(liveMarks({ ship: null, pilots: 'no', farFights: {} })).toEqual([]);
    expect(liveMarks({})).toEqual([]);
  });
});
