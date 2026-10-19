### Task 6: The marks, from the map's own data, and the chart's presets

**Files:**
- Create: `src/components/universe/chart/marks.js`
- Test: `src/components/universe/chart/marks.test.js`

**Interfaces:**
- Consumes: from `nav.js`, `DESTINATIONS` and `CHART_VIEWS`; from `layout.js`, `SUN`, `BELT`, `HOME_RADIUS`, `SECTORS` and `mapSectorOf` (in the Curve or not); from `universes.js`, `byId`; and Task 3's `createView`, `levelOf` and `CHART`.
- Produces:
  - `HAND_MARKS: Mark[]`, frozen and built once:
    - **Places.** One mark per `DESTINATIONS` entry whose `kind` is not `'system'`. The galaxy's systems stay in the list, as today (`NavMap.jsx:382`). Each keeps `nav.js`'s `name`, `at`, `color` and `reach`, with `pickable: true`.
    - **Kinds.** A destination keeps its kind (`station`, `world`, `wonder`), except a world whose `byId(id).kind === 'moon'`, which becomes `moon`.
    - **Levels.** `station` gets `['system']`, `moon` gets `['system', 'neighbourhood']`, and `world` and `wonder` get all three.
    - **Priorities.** World 60, wonder 50, moon 45, station 40, a portal 30.
    - **Shapes**, by `type`: `Nebula` is `cloud`, `Black hole` is `hole`, `Star` is `star`, `Portal` is `portal`, anything else is `dot`. That is today's set, `NavMap.jsx:321-331`.
    - **Three chart-only marks:**
      - `chart:sun`: at `SUN.at`, reach `SUN.r`, shape `sun`, name `''`, all levels.
      - `chart:home`: name `CHART_VIEWS.home.name`, at `[0, 0, 0]`, levels neighbourhood and universe, priority 90.
      - `chart:curve`: name `CHART_VIEWS.rickmorty.name`, at `SECTORS.rickmorty.origin`, level universe, priority 85.
      - All three are `pickable: false`. Their ids are prefixed because `home` is already a station's id.
  - `markById(id) → Mark | null`, over `HAND_MARKS`.
  - `REGIONS: [{ id, centre, radius, levels }]`:
    - `home` at `HOME_RADIUS`, neighbourhood and universe
    - `belt` at `(BELT.inner + BELT.outer) / 2`, system
    - `curve` at `SECTORS.rickmorty.edge` round its origin, system and neighbourhood
    - The main map's dashed `EDGE` circle (`NavMap.jsx:305`) is not one: there is no edge any more (spec A).
  - `liveMarks(now) → Mark[]`, from `where()`:
    - Pilots become `pilot:<id>`: kind and shape `pilot`, name `''` (unlabelled, as today), priority 70, levels system and neighbourhood.
    - Far fights become `fight:<id>`: kind and shape `fight`, name `f.label`, priority 35, the same levels.
    - `where()` gives neither a height, so both sit at `now.ship?.y ?? 0` with no stem.
    - Entries with a non-finite x or z are dropped. A null `now` gives `[]`.
    - All are `pickable: false`.
  - `presetView(id, ship) → View` for `'all' | 'home' | 'rickmorty'`: focus `CHART_VIEWS[id].origin` with its y set to `ship?.y ?? 0`, range `CHART_VIEWS[id].r`, follow `false`.
  - `presetOf(view) → 'all' | 'home' | 'rickmorty'`, by which part of space the chart is looking at:
    - `rickmorty` when the focus's x and z are within `SECTORS.rickmorty.edge` of its origin
    - `home` when within `2 × HOME_RADIUS` of the origin and the level is `system`
    - `all` otherwise
    - This keeps `scripts/sector-check.mjs:77` ("The Curve" pressed when opened there) and `navmap-check.mjs:161` (the second chip is Home system).
  - `openView(ship) → View`:
    - With no ship, `presetView('all')`.
    - Otherwise focus on the ship with `follow: true`. The range is `CHART_VIEWS.rickmorty.r` in the Curve, else `CHART.range.open`.

- [ ] **Step 1: Write the failing tests:**
```js
import { describe, expect, it } from 'vitest';
import { CHART_VIEWS, DESTINATIONS } from '../nav';
import { MOONS } from '../universes';
import { SECTORS } from '../layout';
import { CHART, levelOf } from './projection';
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
});
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/marks.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `marks.js`** to the Interfaces.
- [ ] **Step 4: Run them and see them pass.** Expected: PASS, 4 tests.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/marks.js src/components/universe/chart/marks.test.js
git commit -m "Chart marks from nav.js's places, the live pilots and fights, and the three presets"
```

---

