### Task 2: The gesture reader moves to `src/lib`, and learns to turn and tilt

The galaxy's pure gesture reader (`src/components/galaxy/gesture.js`) is what this chart needs too. Two worlds need it, so it moves down to `src/lib` (RULES.md, "Worlds are islands").

**Files:**
- Move: `src/components/galaxy/gesture.js` → `src/lib/gesture.js`
- Move: `src/components/galaxy/gesture.test.js` → `src/lib/gesture.test.js`. Its `./gesture` import stays valid.
- Modify: `src/components/galaxy/useMapView.js:3`, the import becomes `'../../lib/gesture'`. Also update the header comment at `:5`.

**Interfaces:**
- Produces: `createGesture()` → `{ down(id, x, y, rect, opts = {}), move(id, x, y, rect), up(id), cancel(id), takeClick(), dragging, active }`. Unchanged for the galaxy, with three additions:
  - `down(…, { orbit: true })` on the first pointer makes that drag emit `{ orbit: [du, dw] }` instead of `{ pan: [du, dw] }`. It uses the same fractions of the box and the same DRAG threshold, and still swallows the click.
  - A two-finger move also returns `turn` and `tilt`:
    - `turn` is the radians the line from the first finger to the second turned since the last move, wrapped to (−π, π], positive clockwise on screen.
    - `tilt` is the fingers' midpoint's vertical move since the last move, as a fraction of the box's height, positive down.
  - The galaxy's `apply` (`useMapView.js:43-47`) ignores the new fields and never passes `orbit`, so its behaviour is unchanged.

- [ ] **Step 1: Move the files** with `git mv`, and fix the import. Run `npx vitest run src/lib/gesture.test.js src/components/galaxy`. Expected: PASS, the same counts as before the move.
- [ ] **Step 2: Write the failing tests** in `src/lib/gesture.test.js`, using its existing `R = { left: 0, top: 0, width: 600, height: 600 }`:
```js
it('a drag begun with the modifier turns the view instead of panning it', () => {
  const g = createGesture();
  g.down(1, 300, 300, R, { orbit: true });
  const m = g.move(1, 360, 270, R);
  expect(m.pan).toBeUndefined();
  expect(m.orbit[0]).toBeCloseTo(60 / 600);
  expect(m.orbit[1]).toBeCloseTo(-30 / 600);
  g.up(1);
  expect(g.takeClick()).toBe(true);
});
it('two fingers say how far the line between them turned and how far they moved up or down', () => {
  const g = createGesture();
  g.down(1, 200, 300, R);
  g.down(2, 400, 300, R);
  const m = g.move(2, 400, 500, R);
  expect(m.zoom).toBeCloseTo(Math.hypot(200, 200) / 200);
  expect(m.turn).toBeCloseTo(Math.PI / 4);
  expect(m.tilt).toBeCloseTo(100 / 600);
});
```
- [ ] **Step 3: Run them and see them fail.** Run `npx vitest run src/lib/gesture.test.js`. Expected: 2 FAIL (`m.pan` is defined; `m.turn` is undefined).
- [ ] **Step 4: Implement.**
  - `seed()` also keeps the pair's angle `a` (from `atan2(b.y − a.y, b.x − a.x)`) and the midpoint's `my`.
  - A two-finger move returns `{ zoom, u, w, turn, tilt }` and re-seeds `a` and `my`.
  - The press remembers `orbit` from `down`'s options; the drag message's key is `orbit` when it was set.
  - The header comment says it is shared: the galaxy map's `useMapView.js` and the universe chart's `useChartView.js`.
- [ ] **Step 5: Run them and see them pass.** Run `npx vitest run src/lib/gesture.test.js src/components/galaxy`. Expected: PASS.
- [ ] **Step 6: Run the galaxy map's browser check.** Start the lane's dev server on 5188, then run `BASE=http://127.0.0.1:5188 OUT=/tmp/gmap CHROME=… node scripts/galaxy-map-check.mjs`. Expected: `all ok`. Its wheel, drag and pinch checks are what a move could break.
- [ ] **Step 7: Commit.**
```bash
git add -A src/lib/gesture.js src/lib/gesture.test.js src/components/galaxy/gesture.js src/components/galaxy/gesture.test.js src/components/galaxy/useMapView.js
git commit -m "Move the map gesture reader to src/lib, shared by the galaxy and the universe; a modifier drag turns, two fingers turn and tilt"
```

---

