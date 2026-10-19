### Task 5: Placing marks on a frame

The one function both charts place through. It is tested here on fixture marks; the real data comes in Task 6.

**Files:**
- Create: `src/components/universe/chart/place.js`
- Test: `src/components/universe/chart/place.test.js`

**Interfaces:**
- Consumes: Task 3's `project`, `toFrame`, `levelOf`, `reachOn`, `createView`, `CHART` and `FRAMES`; Task 4's `declutter`; Task 0's `sectorAt`, `sectorCentre`, `sectorKey` and `SECTOR`.
- Produces:
  - **`Mark`, the input shape lane 6b feeds without changing anything here:**
    ```
    { id: string, kind: string, name: string, at: [x, y, z], priority: number, color: string,
      levels: Array<'system' | 'neighbourhood' | 'universe'>,
      shape?: 'dot' | 'cloud' | 'hole' | 'star' | 'portal' | 'sun' | 'pilot' | 'fight',
      reach?: number, pickable?: boolean }
    ```
    An empty `name` means no label. `id` is unique per chart.
  - `labelSize(name, fontPx) → [w, h]`, in px: `w = name.length × 0.58 × fontPx + 22` (the 16 px dot and its gap), `h = max(24, 1.6 × fontPx)`.
  - `placeMarks(view, marks, frame, opts) → Placed[]`, with `opts = { level = levelOf(view.range), keep = [], fontPx = 11, scale = 1, sides, avoid = [], levels = true }`.
    - `Placed = { id, mark, x, y, footX, footY, size, side, edge, depth }`, in frame units.
    - It drops a mark whose `levels` lacks `level` (unless `levels: false`) or that is not `inside`, unless its id is in `keep`.
    - Kept marks are pinned (`toFrame(…, { pin: true })`) and their priority counts as `Infinity`.
    - `size = reachOn(view, mark.at, mark.reach ?? 0) × frame.r`.
    - Labels go through `declutter` in px (`× scale`). Every placed mark's dot is a `dots` entry, and so is each `avoid` point (the ship).
    - The result is in the marks' order (the tab order). `depth` is there for the SVG to sort a copy far-first.
  - `placeShip(view, ship, frame) → { x, y, angle, edge }`.
    - It is always on the frame, pinned.
    - `angle`, in degrees clockwise from right, comes from the nose `(−sin h, −cos h)` (`ship.js`'s `forward`: heading 0 is −z). The nose is turned by the yaw, and its `b` is squashed by `cos(pitch)`.
  - `sectorGrid(view, n) → [{ key, points: [[u, v], …] }]`: each sector within `n` of `sectorAt(...view.focus)` on its layer, outlined at `y = focus[1]`, 12 points an edge with its corners included. `key` is `sectorKey`'s.
  - `ringOn(view, centre, radius, n = 64) → [[u, v], …]`: a closed ring at `centre[1]`.
  - `fitRange(focus, marks, pad = 1.05) → number`: the furthest mark's distance × pad, clamped to `CHART.range`.
  - `miniView(marks) → View`: focus `[0, 0, 0]`, range `fitRange`, pitch `CHART.miniPitch`, follow `false`.
  - `reveal(view, mark) → View`.
    - If the mark's levels lack the view's level, the range moves into the nearest allowed level: down to `upTo × 0.9`, or up to the level below's `upTo × 1.2`.
    - Then, if the mark is further than `0.9 × range` from the focus, the focus moves to its x and z (keeping `focus[1]`) and `follow` becomes `false`.
    - It returns the same object when nothing changes.

- [ ] **Step 1: Write the failing tests:**
```js
import { describe, expect, it } from 'vitest';
import { CHART, FRAMES, createView, levelOf, project } from './projection';
import { fitRange, miniView, placeMarks, placeShip, reveal, ringOn, sectorGrid } from './place';

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
  it('outlines the sectors round the focus, and rings a centre', () => {
    const grid = sectorGrid(createView({ range: 400000 }), 1);
    expect(grid).toHaveLength(9);
    expect(grid.map((g) => g.key)).toEqual(expect.arrayContaining(['E:0,0', 'E:1,-1', 'E:-1,1']));
    const corner = Math.max(...grid.find((g) => g.key === 'E:0,0').points.map(([u, v]) => Math.hypot(u, v)));
    expect(corner).toBeCloseTo(((60000 * Math.SQRT2) / 400000) ** 0.375, 9);
    for (const [u, v] of ringOn(createView({ range: 100000 }), [0, 0, 0], 5000)) expect(Math.hypot(u, v)).toBeCloseTo(0.05 ** 0.375, 9);
  });
});
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/place.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `place.js`.** Its header states the `Mark` shape and says lane 6b adds generated places as more marks with their own `levels`, through no other door.
- [ ] **Step 4: Run them and see them pass.** Expected: PASS, 8 tests.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/place.js src/components/universe/chart/place.test.js
git commit -m "Chart placement: marks by level, pinned picks, stems, the ship, sector outlines"
```

---

