# Endless universe, lane 6a: the map, first half. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Since written (2026-10-20):** Task 4's `chart/declutter.js` is on `main`, with `over` in `SIDES`, a `round` option (the chart's disc) and a label's own `sides`. `NavMap.jsx` and `navmap.css` were redesigned at the owner's ask (the search and filters moved to the side panel, the drives into the place picked): the line numbers below into them are stale; read the files.

**Goal:** One pure chart projection, used by both the nav map and the no-3D mini-map. It is centred on the ship, zooms smoothly from a system out to the universe, pans, and tilts and turns into 3D with every mark on a stem. Labels thin out by priority, and the ship's marker, height and sector are always on the chart.

**Architecture:**
- A new folder `src/components/universe/chart/` holds the pure modules:
  - `projection.js`: the view and the maths
  - `declutter.js`: which labels show
  - `place.js`: marks onto a frame
  - `marks.js`: the data, read from `nav.js`'s fixed list
  - `input.js`: keys, wheel and gestures to view changes
- It also holds one hook, `useChartView.js`, and two drawing parts, `NavChart.jsx` and `ChartTools.jsx`.
- `NavMap.jsx` keeps its header, filters and side panel and draws its chart through `NavChart`. `MiniMap.jsx` is rebuilt on the same `marks.js`, `projection.js` and `place.js`.
- The galaxy's pure gesture reader moves to `src/lib/gesture.js` so both worlds share it, and it learns modifier-drag and two-finger turn and tilt.
- Lane 6b later feeds generated places, events and pilots in as more `Mark`s. The projection doesn't change.

**Tech Stack:** React 19, Vite, Vitest (`renderToStaticMarkup` for component tests, as `src/runtime/hud/parts.test.jsx` does), Playwright-driven `scripts/navmap-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`, section F (minus generated destinations), done-item 7. The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`. Its Task 0 (`src/lib/space/address.js`) must be on `main` before this lane branches.

## Global Constraints

**Process (`docs/superpowers/HANDOFF-universe.md`, "The owner's rules"):**
- Nothing a visitor can do is lost: every key, save, route, dev hook and test works after as before. No test is loosened, skipped or deleted. `nav.js`'s chart tests (`nav.test.js:172-196`, `:415-423`) stay as they are.
- Pure first. `src/lib/gesture.js` and `chart/{projection,declutter,place,marks,input}.js` import no React, no DOM and no three.js. Each has its Node test before its drawing half.
- A changed picture is on purpose. The before shots come from `main` first (Task 1); the after shots go beside them in the PR.
- One PR for the lane, CI green, a merge commit. Never force-push, never rebase anyone's branch. Bring `main` in with a merge.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and the smoke check on `/universe`.
- No new dependency. No model names in code, docs or commits.
- "The nav map's stylesheet is words only; its pilots' colour and ambers are the owner's call." New parts reuse the nav map's blue (`#9fd8ff`) and its existing classes (`.navmap-tool`, `.navmap-place`). Existing parts are not restyled.

**Boundaries (other lanes run in parallel):**
- `nav.js` is read, never edited. Lanes 3 and 6b own its destinations, resolver and travel. This lane reads `DESTINATIONS`, `destinationById`, `legOf`, `CHART_VIEWS` (the chips' names, middles and ranges) and `formatDistance`.
- `scene.js` is untouched. Only `where()` (`scene.js:6102-6119`) and `__universeDebug.wonders` (`scene.js:5802`) are read.
- `ship.js` and the generator are untouched.
- Sector maths only through Task 0's `src/lib/space/address.js`: `SECTOR`, `sectorAt`, `sectorCentre`, `sectorKey`.

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first.
- British spelling, sentence case, curly quotes, no Oxford comma.
- "3D view" is a retired phrase (`src/lib/words.js:52`). Say "tilt", "turn" and "Look straight down".
- Controls are 44 px on a coarse pointer and 36 px otherwise.
- Numbers come from `src/index.css` tokens where one exists (`--fs-xs`, `--t-fast`). Any other hard-coded value carries a comment saying why.
- No bare `z-index` of 10 or more: order by the DOM.
- Text over the chart sits on glass at alpha 0.78 or more.
- Dim by colour, never by fading text below 0.55.

**Numbers (my calls, pinned by tests so they can be tuned):**
- `CHART.power = 0.375` (the spec's family).
- `CHART.range`: min 300, opening 120,000, max 3,000,000.
- Levels by range: system below 8,000; neighbourhood below 250,000; universe beyond.
- `CHART.pitchMax = 1.35`, `CHART.stemFloor = 0.45`, `CHART.miniPitch = Math.acos(0.42)` (the mini-map's old tilt, `MiniMap.jsx:16`).

**Browser checks:**
- Dev server: `npx vite --port 5173`.
- On Windows, pass Chrome's path: `CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"`. `navmap-check.mjs`'s default is a Linux path (`navmap-check.mjs:16`).
- Every wait is on a condition, never a sleep that only guesses: software GL runs at a frame or two a second.
- Evidence goes in `docs/superpowers/evidence/endless-universe-6a-map/`. Each committed picture must be under 1 MB (use element shots, or `type: 'jpeg', quality: 80`). Anything bigger goes to the bucket (RULES.md, "Evidence is pictures on the bucket").

## Review Focus

1. **A drag that starts on a place's button.** Pressing a name and dragging moves the chart; it never picks the place or sends the ship (a double click counts too). Pinned by Task 2's swallow test and Task 10's drag-from-a-name step.
2. **Keys while typing in "Find a place…".** `+`, `-` and `0` go into the field and never zoom or re-centre. Pinned by Task 7's `chartKey` typing test and Task 10's typed-minus step.
3. **No ship.** In camera mode, or with 3D off, the chart opens on the universe with no ship marker, no readout and no "Back to the ship". Nothing throws. Pinned by Task 6 (`openView(null)`), Task 8 (NavChart with no ship) and Task 9 (MiniMap with no ship).
4. **Degenerate numbers.** A mark exactly at the focus, the ship 10^12 out, a wheel delta of NaN or 10^6, and a pinch factor of 0 or Infinity draw nothing NaN and keep the range clamped. Pinned by Task 3's degenerate test and Task 7's wheel test.
5. **A phone turned sideways (844 × 390) with the map open.** The frame, the chart, its bar and the side panel all stay on screen. Pinned by Task 10's landscape step.

---

### Task 1: Before shots on `main`, and the check's base URL

The pictures this lane will change, taken from `main` before any code changes. The lane's copy of `navmap-check.mjs` gains a base URL and two shot-only modes, then is run against a dev server serving `main`.

**Files:**
- Modify: `scripts/navmap-check.mjs:13-16` (the base URL), `:54` and `:170` (the mode dispatch)
- Create: `docs/superpowers/evidence/endless-universe-6a-map/README.md` and `before/*.png`

**Interfaces:**
- Produces:
  - `BASE` env, default `http://localhost:5173`. The URL becomes `${BASE}/?quality=low#/universe`.
  - Modes in `process.argv[2]`: `desktop`, `phone`, `minimap`, `far`, or none for all four. Dispatch is `const run = (m) => !only || only === m`.
  - Shot names: `minimap` writes `11-minimap-flat` and `12-minimap-teaser`; `far` writes `13-far-ship`.

- [ ] **Step 1: Serve `main` from a worktree.** Run `git worktree add ../tp-6a-main origin/main`, then `npm ci` in it, then `npx vite --port 5173` from it in the background.
- [ ] **Step 2: Add `BASE` and the dispatch** to `scripts/navmap-check.mjs`. Replace `only !== 'phone'` and `only !== 'desktop'` with `run('desktop')` and `run('phone')`.
- [ ] **Step 3: Add the `minimap` mode.** It has its own context and does not use `open()`, which waits on `__universe` and would time out with 3D off.
  - The flat map: an init script sets `localStorage['tp-3d'] = 'off'` (raw, not JSON: `src/lib/gpu.js:77`) plus `tp-intro`. Open `#/universe` at 1280 × 800, wait for `.universe-flat .minimap`, and take an element shot `11-minimap-flat`.
  - The teaser: open `#/home`, scroll `.minimap-teaser` into view (the section is lazy, `pages/Home.jsx:30`), wait for it, and take an element shot `12-minimap-teaser`.
- [ ] **Step 4: Add the `far` mode.**
  - Open as the desktop run does (`falcon`).
  - In the page, set `window.__universeDebug.state.ship = { ...s.ship, x: 250000, y: 1000, z: 0, speed: 0 }`.
  - Wait for `window.__universe().ship.x > 200000`, press `m`, wait for `.navmap`, and shoot `13-far-ship`. On `main` the ship marker is missing here, because `NavMap.jsx:193` and `:364` drop it.
- [ ] **Step 5: Take the before shots.** Run `OUT=docs/superpowers/evidence/endless-universe-6a-map/before CHROME=… node scripts/navmap-check.mjs` (all four modes). Expected:
  - The shots `1-navmap`, `2-picked`, `7-home-system`, `8`–`10` (phone), `11`, `12` and `13`.
  - On `main`, the Citadel jump checks fail (HANDOFF "Left": its stale 1755, −4660). Write down which ones fail.
- [ ] **Step 6: Write the evidence README.** It records the date, `main`'s commit, the command, the failing checks on `main`, and an empty "after" column.
- [ ] **Step 7: Commit.**
```bash
git add scripts/navmap-check.mjs docs/superpowers/evidence/endless-universe-6a-map
git commit -m "Nav map check: a base URL, the mini-map and far-ship shots, and the before shots from main"
```

---

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

### Task 3: The projection

**Files:**
- Create: `src/components/universe/chart/projection.js`
- Test: `src/components/universe/chart/projection.test.js`

**Interfaces:**
- Consumes: nothing. It imports nothing.
- Produces:
  - `CHART`:
    ```js
    {
      power: 0.375,
      range: { min: 300, open: 120000, max: 3000000 },
      pitchMax: 1.35,
      stemFloor: 0.45,
      miniPitch: Math.acos(0.42),
      levels: [
        { id: 'system', upTo: 8000 },
        { id: 'neighbourhood', upTo: 250000 },
        { id: 'universe', upTo: Infinity },
      ],
    }
    ```
  - `View = { focus: [x, y, z], range, yaw, pitch, follow }`. `yaw` is wrapped to [−π, π). `pitch` is in [0, pitchMax].
  - `createView(partial = {}) → View`. Defaults: focus `[0, 0, 0]`, range `CHART.range.open`, yaw 0, pitch 0, follow `false`.
  - `warp(d: [dx, dy, dz], range) → [wx, wy, wz]`. Same direction as `d`, with length `(|d| / range) ** CHART.power`. It is `[0, 0, 0]` at 0.
  - `project(view, at) → { u, v, foot: [u, vFoot], depth, inside }`, in chart units where the rim is radius 1.
    - The yaw turns the warped point: `a = wx·cosψ − wz·sinψ`, `b = wx·sinψ + wz·cosψ`.
    - The foot is `vFoot = b·cos(pitch)`, and `v = vFoot − wy·max(sin(pitch), stemFloor)`. Looking straight down, height still shows as a short oblique stem.
    - `depth = b·sin(pitch) + wy·cos(pitch)`: bigger is nearer.
    - `inside = |d| ≤ range`.
  - `unproject(view, [u, v]) → [x, y, z]`: the point on the plane `y = focus[1]` drawn at `(u, v)`.
  - Moving the view:
    - `zoomBy(view, factor) → View`: range ÷ factor, clamped. A factor that is not finite or is ≤ 0 returns the same view.
    - `panBy(view, [du, dv]) → View`: in chart units. The new focus is the point on the focus plane drawn at `(−du, −dv)`: `unproject`'s x and z, keeping `focus[1]`. So the old middle is drawn at exactly `(du, dv)`, and the ship under the middle moves with the hand. A linear pan would race it away, because the 0.375 scale is steepest at the middle. The inverse map is odd, so `panBy(panBy(v, d), −d)` returns `v`'s focus. Sets `follow: false`. The hook anchors a whole drag on its first view (Task 7's `panFrom`), never step by step: the steps of a drag would barely move a fisheye.
    - `orbitBy(view, [dyaw, dpitch]) → View`: yaw wrapped, pitch clamped.
    - `flatten(view) → View`: yaw 0, pitch 0.
  - Following the ship:
    - `recentre(view, ship) → View`: focus `[ship.x, ship.y, ship.z]` and `follow: true`.
    - `track(view, ship) → View`, called on every `where()` tick. When following, the focus becomes the ship. Otherwise only `focus[1]` becomes `ship.y`, so stems stay measured from the ship's height. It returns the same object when nothing changed.
  - `levelOf(range) → 'system' | 'neighbourhood' | 'universe'`: the first level with `range < upTo`.
  - `reachOn(view, at, reach) → number`, in chart units: `(ρ(dist + reach) − ρ(max(0, dist − reach))) / 2`, where `ρ(r) = (r / range) ** power`.
  - `ringsFor(range) → number[]`: the powers of ten with `range / 100 ≤ 10^k < range`, ascending.
  - `FRAMES`:
    ```js
    {
      nav: { w: 1000, h: 1000, cx: 500, cy: 500, r: 470, shape: 'circle' },
      mini: { w: 600, h: 300, cx: 300, cy: 142, r: 266, shape: 'box', pad: 8 },
    }
    ```
    These are `NavMap.jsx`'s `V`, `nav.js`'s `MARGIN 0.47`, and `MiniMap.jsx:14-19`'s `W`, `H`, `K` and centre.
  - `toFrame(frame, [u, v], { pin = false } = {}) → { x, y, edge }`.
    - `x = cx + u·r` and `y = cy + v·r`.
    - `edge` is true when the point is outside the circle (radius `r`) or outside the box (inset by `pad`).
    - With `pin`, an outside point is brought back: onto the circle at `0.97 r`, or clamped into the box.

- [ ] **Step 1: Write the failing tests:**
```js
import { describe, expect, it } from 'vitest';
import { CHART, FRAMES, createView, flatten, levelOf, orbitBy, panBy, project, reachOn, recentre, ringsFor, toFrame, track, unproject, warp, zoomBy } from './projection';

const pts = [[1200, 0, -300], [-5000, 800, 2500], [40000, -3000, 1000], [3, 0, 4], [0, 0, -90000]];
const rad = (p) => Math.hypot(p.u, p.v);

describe('the chart’s projection', () => {
  it('centres on the focus, and follows the ship', () => {
    expect(project(createView({ focus: [5000, 120, -800] }), [5000, 120, -800])).toMatchObject({ u: 0, v: 0 });
    const ship = { x: -2000, y: 40, z: 9000 };
    const followed = track(createView({ follow: true }), ship);
    expect(followed.focus).toEqual([-2000, 40, 9000]);
    expect(track(followed, ship)).toBe(followed);
    expect(track(createView({ focus: [10, 0, 10] }), ship).focus).toEqual([10, 40, 10]);
  });
  it('puts the range at the rim on the 0.375-power scale', () => {
    const view = createView({ range: 54000 });
    expect(rad(project(view, [54000, 0, 0]))).toBeCloseTo(1, 12);
    expect(rad(project(view, [0, 0, 5400]))).toBeCloseTo(0.1 ** 0.375, 12);
    expect(warp([0, 0, 0], 1000)).toEqual([0, 0, 0]);
  });
  it('zooms monotonically and back again, clamped', () => {
    const view = createView({ focus: [100, 0, 100] });
    const zin = zoomBy(view, 1.5);
    for (const p of pts) expect(rad(project(zin, p))).toBeGreaterThan(rad(project(view, p)));
    expect(zoomBy(zin, 1 / 1.5).range).toBeCloseTo(view.range, 6);
    expect(zoomBy(view, 1e9).range).toBe(CHART.range.min);
    expect(zoomBy(view, 1e-9).range).toBe(CHART.range.max);
  });
  it('unprojects what it projects on the focus plane, at any zoom, turn and tilt', () => {
    for (const view of [createView({ focus: [700, 50, -300], range: 9000 }), orbitBy(createView({ focus: [700, 50, -300], range: 300000 }), [0.8, 0.6])]) {
      for (const [x, , z] of pts) {
        const p = project(view, [x, 50, z]);
        unproject(view, [p.u, p.v]).forEach((c, i) => expect(c).toBeCloseTo([x, 50, z][i], 4));
      }
    }
  });
  it('stands every mark on a stem: up for above the ship, down for below, none for level', () => {
    const flat = createView({ focus: [0, 100, 0], range: 50000 });
    for (const view of [flat, orbitBy(flat, [0.4, 0.9])]) {
      const above = project(view, [3000, 1100, 2000]);
      const below = project(view, [3000, -900, 2000]);
      const level = project(view, [3000, 100, 2000]);
      expect(above.v).toBeLessThan(above.foot[1]);
      expect(below.v).toBeGreaterThan(below.foot[1]);
      expect(level.v).toBe(level.foot[1]);
      expect(above.foot).toEqual(below.foot);
    }
  });
  it('tilts and turns, and comes back the same way or with one flatten', () => {
    const view = createView({ focus: [200, 0, -100], range: 70000 });
    for (const back of [orbitBy(orbitBy(view, [0.7, 0.5]), [-0.7, -0.5]), flatten(orbitBy(view, [2.1, 1.0]))]) {
      for (const p of pts) {
        expect(project(back, p).u).toBeCloseTo(project(view, p).u, 12);
        expect(project(back, p).v).toBeCloseTo(project(view, p).v, 12);
      }
    }
    expect(orbitBy(view, [0, 9]).pitch).toBe(CHART.pitchMax);
    expect(orbitBy(view, [0, -9]).pitch).toBe(0);
    const tilted = orbitBy(view, [0, 0.8]);
    expect(project(tilted, [0, 0, 20000]).depth).toBeGreaterThan(project(tilted, [0, 0, -20000]).depth);
  });
  it('pans with the hand: the old middle goes where the drag went, a drag back undoes it, and it re-centres on the ship', () => {
    const view = createView({ focus: [1000, 0, 2000], range: 10000, follow: true });
    const moved = panBy(view, [0.1, 0]);
    expect(moved.follow).toBe(false);
    expect(moved.focus[0]).toBeLessThan(1000);
    expect(moved.focus[2]).toBeCloseTo(2000, 9);
    expect(project(moved, view.focus).u).toBeCloseTo(0.1, 12);
    expect(project(moved, view.focus).v).toBeCloseTo(0, 12);
    const turned = orbitBy(view, [1.1, 0.7]);
    panBy(panBy(turned, [0.23, -0.17]), [-0.23, 0.17]).focus.forEach((f, i) => expect(f).toBeCloseTo(turned.focus[i], 9));
    expect(recentre(moved, { x: 9, y: 8, z: 7 })).toMatchObject({ focus: [9, 8, 7], follow: true });
  });
  it('keeps a far ship on the chart, pinned to its rim', () => {
    const view = createView({ range: CHART.range.min });
    for (const far of [[1e9, 4e8, -1e9], [-1e12, 0, 3], [0, -1e9, 0]]) {
      const p = project(view, far);
      const nav = toFrame(FRAMES.nav, [p.u, p.v], { pin: true });
      expect(nav.edge).toBe(true);
      expect(Math.hypot(nav.x - 500, nav.y - 500)).toBeLessThanOrEqual(470);
      const mini = toFrame(FRAMES.mini, [p.u, p.v], { pin: true });
      expect(mini.x).toBeGreaterThanOrEqual(8);
      expect(mini.x).toBeLessThanOrEqual(592);
      expect(mini.y).toBeGreaterThanOrEqual(8);
      expect(mini.y).toBeLessThanOrEqual(292);
    }
  });
  it('never goes NaN at the focus or on a bad zoom', () => {
    const view = createView({ focus: [1, 2, 3] });
    expect(Object.values(project(view, [1, 2, 3])).flat().every((n) => typeof n !== 'number' || Number.isFinite(n))).toBe(true);
    expect(unproject(view, [0, 0])).toEqual([1, 2, 3]);
    for (const f of [NaN, 0, -2, Infinity]) expect(zoomBy(view, f)).toBe(view);
  });
  it('names the level by the zoom', () => {
    expect([CHART.range.min, 7999, 8000, CHART.range.open, 249999, 250000, CHART.range.max].map(levelOf)).toEqual(['system', 'system', 'neighbourhood', 'neighbourhood', 'neighbourhood', 'universe', 'universe']);
  });
  it('sizes a body by its reach, and rings the ship in powers of ten', () => {
    expect(reachOn(createView({ range: 100000 }), [0, 0, 50000], 1000)).toBeCloseTo((0.51 ** 0.375 - 0.49 ** 0.375) / 2, 12);
    expect(ringsFor(120000)).toEqual([10000, 100000]);
    expect(ringsFor(5000)).toEqual([100, 1000]);
  });
});
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/projection.test.js`. Expected: FAIL (`./projection` can't be resolved).
- [ ] **Step 3: Implement `projection.js`** to the Interfaces above. Its header comment, in the repo's voice, lists the exports (as `expanse/gen/grid.js` does) and says why the stems have a floor: looking straight down, a true projection would hide every height.
- [ ] **Step 4: Run them and see them pass.** Run the same command. Expected: PASS, 11 tests.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/projection.js src/components/universe/chart/projection.test.js
git commit -m "Chart projection: centred on the ship, 0.375-power zoom, pan, tilt and turn, stems"
```

---

### Task 4: Labels thin out by priority

**Files:**
- Create: `src/components/universe/chart/declutter.js`
- Test: `src/components/universe/chart/declutter.test.js`

**Interfaces:**
- Produces:
  - `SIDES = ['right', 'left', 'under']`. These are `navmap.css`'s `data-side` values: none for right, `left` and `under` at `:162-163`.
  - `boxOf(side, { x, y, w, h }) → { x0, y0, x1, y1 }`, in px, matching the CSS's `translate`s:
    - `right` is `[x − 8, y − h/2, x − 8 + w, y + h/2]`
    - `left` is `[x + 8 − w, y − h/2, x + 8, y + h/2]`
    - `under` is `[x − w/2, y − 8, x + w/2, y + 8 + h]`
  - `declutter(labels, { bounds, sides = SIDES, dots = [] }) → Map<id, side | null>`.
    - `labels` is `[{ id, x, y, w, h, priority }]`.
    - `bounds` is the frame's box in px.
    - `dots` are `{ x, y }` points whose 16 × 16 px box no label may cover. A dot within 8 px of the label's own point never blocks it: it is its own dot, or one drawn on top of it.
    - The algorithm is greedy, in priority order (ties by id, so it is stable). Each label takes the first side that stays inside `bounds` and meets no kept label box and no dot. If none fits, it gets `null`: dot only, no name.

- [ ] **Step 1: Write the failing tests:**
```js
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
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/declutter.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `declutter.js`.** Its header names the galaxy's `labelPlace.js` as the model. It is not imported, because worlds are islands, and the universe hides a name where the galaxy moves it.
- [ ] **Step 4: Run them and see them pass.** Expected: PASS, 4 tests.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/declutter.js src/components/universe/chart/declutter.test.js
git commit -m "Chart labels thin out by priority, never over each other or a dot"
```

---

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

### Task 7: Hands and keys, the hook, the tools and their words

**Files:**
- Create: `src/components/universe/chart/input.js`, test `input.test.js`
- Create: `src/components/universe/chart/useChartView.js` (no unit test: it is DOM wiring over tested parts, as `galaxy/useMapView.js` is; Task 10 checks it in the browser)
- Create: `src/components/universe/chart/ChartTools.jsx`, test `ChartTools.test.jsx`
- Modify: `src/components/universe/words.js` (append `CHART`)

**Interfaces:**
- Consumes: Task 2's `createGesture`; Task 3's view functions and `FRAMES`; Task 5's `reveal`.
- Produces:
  - `words.js` (named `CHART_WORDS` because `projection.js` already exports `CHART`):
    ```js
    export const CHART_WORDS = {
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      toShip: 'Back to the ship',
      flat: 'Look straight down',
      fit: 'Show everything',
      sector: ([sx, sy, sz]) => `Sector ${[sx, sy, sz].map((n) => String(n).replace('-', '−')).join(', ')}`,
      height: (far, side) => (side === 0 ? 'Level with the disc' : `${far} ${side > 0 ? 'above' : 'below'} the disc`),
      keys: 'zoom in and out, 0 back to the ship',
    };
    ```
  - In `input.js`:
    - `ZOOM_STEP = 1.5` (a button's or a key's zoom, the galaxy's).
    - `ORBIT = { yaw: Math.PI, pitch: Math.PI / 2 }`: radians for a drag across the whole box.
  - `chartKey({ key, meta, ctrl, alt }, { typing = false } = {}) → 'zoomIn' | 'zoomOut' | 'back' | null`:
    - `+` and `=` zoom in.
    - `-` and `_` zoom out.
    - `0` goes back.
    - Anything while typing or with a modifier gives null.
  - `wheelFactor(deltaY, deltaMode) → number`: `exp(−clamp(dy, ±60) × 0.0068)`. Lines count ×16 and pages ×120, as `useMapView.js:8`. A non-finite delta gives 1.
  - `panFrom(anchor, total, frame) → View`: `panBy(anchor, [total[0] × frame.w / frame.r, total[1] × frame.h / frame.r])`. `total` is the drag's summed `pan` fractions since its first move, and `anchor` is the view at that first move.
  - `gestureStep(view, message, frame, { orbit = true } = {}) → View`, for everything but `pan`:
    - `orbit` becomes `orbitBy([o[0] × ORBIT.yaw, −o[1] × ORBIT.pitch])`.
    - Two fingers become `zoomBy(zoom)`, then `orbitBy([turn, −tilt × ORBIT.pitch])`.
    - With `orbit: false`, orbit, turn and tilt are ignored (the mini-map).
    - A `pan` message, or one that applied nothing, returns the same view.
  - `ringStep(ids, key, id) → string | undefined`: the arrows step and wrap, Home and End jump to the ends, and an id not in `ids` starts from the end the key points away from.
  - `useChartView(boxRef, { open, ship = null, frame, orbit = true }) → { view, setView, level, zoomIn, zoomOut, back, flatten, show(mark), handlers }`:
    - `view` starts as `open`. An effect on `ship`'s x, y and z calls `track`.
    - The wheel is a non-passive listener on `boxRef`, as `useMapView.js:28-39` is.
    - `handlers` are `onPointerDown`, `Move`, `Up`, `Cancel` and `onClickCapture`, as `useMapView.js:49-71`. `down` gets `{ orbit: orbit && e.shiftKey }`.
    - A drag's `pan` messages sum into a ref `{ anchor, total }` set at its first move and cleared on up, cancel or a second finger. The view becomes `panFrom(anchor, total, frame)`. Every other message goes through `gestureStep`.
    - `back()` re-centres on the ship, or returns to `open` when there is none.
    - `show(mark)` sets the view to `reveal(view, mark)`.
  - `ChartTools({ className, buttonClass, onZoomIn, onZoomOut, onShip = null, atShip = true, onFlat = null, flat = true, onFit = null })`:
    - It renders `<div className={className} role="group">` with buttons in order: zoom in (`+`), zoom out (`−`), back to the ship (`RiFocus3Line`), look straight down (`RiArrowDownCircleLine`), show everything (`RiFullscreenExitLine`, the galaxy's).
    - Each button's `aria-label` and `title` come from `CHART_WORDS`, with the key in the title (for example "Zoom in (+)").
    - A button with nothing to do (`atShip`, `flat`) is `aria-disabled="true"`, not `disabled`, so it keeps the focus (the galaxy's way). Buttons without a handler aren't drawn.

- [ ] **Step 1: Write the failing tests.** `input.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { FRAMES, createView, project } from './projection';
import { ORBIT, chartKey, gestureStep, panFrom, ringStep, wheelFactor } from './input';

describe('the chart’s hands and keys', () => {
  it('reads + − 0, never while typing or with a modifier', () => {
    expect(['+', '=', '-', '_', '0', 'm'].map((key) => chartKey({ key }))).toEqual(['zoomIn', 'zoomIn', 'zoomOut', 'zoomOut', 'back', null]);
    expect(chartKey({ key: '-' }, { typing: true })).toBeNull();
    expect(chartKey({ key: '0' }, { typing: true })).toBeNull();
    expect(chartKey({ key: '+', ctrl: true })).toBeNull();
  });
  it('turns a wheel into a zoom, lines and floods and NaN included', () => {
    expect(wheelFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0)).toBeLessThan(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48, 0));
    expect(wheelFactor(NaN, 0)).toBe(1);
    expect(wheelFactor(-1e6, 0)).toBeCloseTo(Math.exp(60 * 0.0068));
  });
  it('pans a whole drag from where it began: the middle goes where the hand went', () => {
    const v = createView({ range: 10000 });
    const p = project(panFrom(v, [0.047, 0], FRAMES.nav), v.focus); // (47 of the frame's 1000, over its radius 470: 0.1)
    expect(p.u).toBeCloseTo(0.1, 9);
    expect(p.v).toBeCloseTo(0, 9);
  });
  it('applies the other gestures to the view', () => {
    const v = createView({ range: 10000 });
    expect(gestureStep(v, { pan: [0.047, 0] }, FRAMES.nav)).toBe(v);
    expect(gestureStep(v, { orbit: [0.5, 0] }, FRAMES.nav).yaw).toBeCloseTo(0.5 * ORBIT.yaw);
    expect(gestureStep(v, { orbit: [0.5, 0] }, FRAMES.mini, { orbit: false })).toBe(v);
    const two = { zoom: 2, u: 0.5, w: 0.5, turn: 0.3, tilt: -0.1 };
    expect(gestureStep(v, two, FRAMES.nav)).toMatchObject({ range: 5000, yaw: 0.3, pitch: expect.closeTo(0.1 * ORBIT.pitch, 9) });
    expect(gestureStep(v, two, FRAMES.mini, { orbit: false })).toMatchObject({ range: 5000, yaw: 0, pitch: 0 });
    expect(gestureStep(v, { zoom: 0, u: 0, w: 0, turn: 0, tilt: 0 }, FRAMES.nav).range).toBe(10000);
  });
  it('steps through the places with the arrows, Home and End', () => {
    const ids = ['a', 'b', 'c'];
    expect([['ArrowRight', 'c'], ['ArrowLeft', 'a'], ['ArrowDown', 'a'], ['Home', 'b'], ['End', 'a'], ['ArrowRight', null], ['ArrowLeft', null], ['x', 'a']].map(([k, id]) => ringStep(ids, k, id))).toEqual(['a', 'c', 'b', 'a', 'c', 'a', 'c', undefined]);
  });
});
```
`ChartTools.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChartTools from './ChartTools';
import { CHART_WORDS as W } from '../words';

const f = () => {};
const button = (html, label) => html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? null;

describe('the chart’s tools', () => {
  it('says each in the glossary’s words, marking the ones with nothing to do', () => {
    const html = renderToStaticMarkup(<ChartTools buttonClass="navmap-tool" onZoomIn={f} onZoomOut={f} onShip={f} atShip onFlat={f} flat={false} />);
    for (const w of [W.zoomIn, W.zoomOut, W.toShip, W.flat]) expect(button(html, w), w).not.toBeNull();
    expect(button(html, W.toShip)).toContain('aria-disabled="true"');
    expect(button(html, W.flat)).not.toContain('aria-disabled');
    expect(button(html, W.fit)).toBeNull();
  });
});
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/input.test.js src/components/universe/chart/ChartTools.test.jsx`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `CHART_WORDS` in `words.js`, then `input.js`, `ChartTools.jsx` and `useChartView.js` to the Interfaces.
- [ ] **Step 4: Run them and see them pass.** Expected: PASS, 6 tests. Then run `npx vitest run src/lib/words.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/input.js src/components/universe/chart/input.test.js src/components/universe/chart/useChartView.js src/components/universe/chart/ChartTools.jsx src/components/universe/chart/ChartTools.test.jsx src/components/universe/words.js
git commit -m "Chart hands and keys: wheel, drag, Shift-drag, two fingers, + − 0; its tools and words"
```

---

### Task 8: The nav map draws through the chart

**Files:**
- Create: `src/components/universe/chart/NavChart.jsx`, test `NavChart.test.jsx`
- Modify: `src/components/universe/NavMap.jsx`:
  - `:33-43` (`UNDER`, `fightsOn`) and `:73-78` (`sizeOn`, `sectorAt`) go
  - `:45-71` (`paintStars`) moves to NavChart
  - `:82` (the `view` state) and `:92-98` and `:191-197` (`P`, `shipAt`, `toward`, `homeR`) are replaced
  - `:122-132` gains the chart's keys
  - `:283-431` becomes `<NavChart>`
  - `:538-540` gains the zoom keys
- Modify: `src/components/universe/navmap.css` (`:102-118` and `:284-288`, plus new rules)
- Modify: `src/components/guide/pages.js:106-108` (the universe's keys)
- Modify: `src/lib/words.test.js:23-24` (read the new JSX)

**Interfaces:**
- Consumes: Tasks 3 to 7, and `nav.js`'s `legOf`, `destinationById` and `formatDistance`. `LENGTH` comes from `scale.js`; `sectorAt` from Task 0.
- Produces: `NavChart` (default export). Props:
  - `view`, `marks`
  - `ship` (`{ x, y, z, heading } | null`)
  - `course` (`{ to: [x, y, z], drive } | null`)
  - `front` (`where().front | null`), `onFront`, `frontTitle`, `frontOff`
  - `pick`, `here`, `dim` (a Set of ids)
  - `onChoose(id)`, `onGo(id)`, `onRegion(presetId)`
  - `out` (`{ label, onClick } | null`), `tools` (ChartTools' props)
  - `readout` (`string | null`), `handlers`, `boxRef`
- The DOM:
  ```
  .navmap-stage
    .navmap-chart[data-level][data-pitched]  ← handlers, boxRef: the circle
      canvas, svg, ul.navmap-places, .navmap-out
    .navmap-bar
      p.navmap-readout
      .navmap-tools
  ```
  The bar sits under the circle, so the tools never cover a name and the circle's clip never cuts a 44 px button.
- What the SVG draws (viewBox 1000), in this order:
  - `ringsFor` as `.navmap-ring` ellipses (`ry` = `rx × cos pitch`)
  - `sectorGrid` at neighbourhood (n = 1) and universe (n = 2) as `.navmap-sector` polylines
  - `REGIONS` at their levels as `.navmap-region[data-region]` polylines
  - each mark's stem as `line.navmap-stem[data-dir=up|down]`, where its length is at least 1.5
  - the wonder and sun glyphs as today (`NavMap.jsx:314-333`, `r = max(6, size)`), sorted far first by `depth`
  - the war (`:336-345`, through `project`, never filtered, so `universe-war-check.mjs:165`'s seven stay)
  - the course to `toFrame(…, { pin: true })` of its target
  - pilots and fights
  - the ship: `g.navmap-ship[data-edge]` from `placeShip`, always drawn when `ship` is set
- The places list: one `li[data-id][data-kind][data-side][data-quiet][data-dim]` per placed mark that is pickable, a region (`chart:home`, `chart:curve`) or a fight. The sun and pilots are SVG only.
  - Each `li`'s style starts with `left` then `top`, in % of the frame. The tests read them in that order.
  - Names are hidden when `data-quiet` is set.
  - `chart:home` and `chart:curve` call `onRegion('home' | 'rickmorty')`.
  - Fights are labels only, as today.
  - It measures its px width and a `.navmap-name`'s font size on resize, for `scale` and `fontPx`. In SSR, `scale` is 1 and `fontPx` is 11.
- The chart's attributes:
  - `data-level` is `levelOf(view.range)`.
  - `data-pitched` is present when `view.pitch > 0 || view.yaw !== 0`.
- In NavMap:
  - `const box = useRef(null); const chart = useChartView(box, { open: openView(now?.ship), ship: now?.ship, frame: FRAMES.nav })`. `open` is read once, on mount. `box` is passed down as `boxRef`.
  - The marks are `[...HAND_MARKS, ...liveMarks(now)]`.
  - A chip is `aria-pressed={presetOf(chart.view) === c.id}` and its click is `chart.setView(presetView(c.id, now?.ship))`.
  - A list or search pick calls `chart.show(markById(d.via ?? d.id))`, replacing `:275-276` and `:519-521`.
  - The course target is `destinationById(legOf(now.ship, id)).at`.
  - `.navmap-out` shows when `presetOf` is `home` or `rickmorty`, with today's labels and actions (`:420-430`), and the "out" action becomes `setView(presetView('all', ship))`.
  - The readout is `` `${CHART_WORDS.sector(sectorAt(x, y, z))} · ${CHART_WORDS.height(formatDistance(Math.abs(y)), Math.abs(y) < LENGTH ? 0 : Math.sign(y))}` ``, and none without a ship.
  - The keys go through `chartKey(e, { typing: e.target.matches('input, textarea') })`, in the existing capture listener: `zoomIn`, `zoomOut` or `back` on the hook.
  - The tools are `{ onZoomIn, onZoomOut, onShip: ship ? back : null, atShip: view.follow, onFlat: flatten, flat: !pitched }`.

- [ ] **Step 1: Write the failing test** `NavChart.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NavChart from './NavChart';
import { FRAMES, createView, project, toFrame } from './projection';
import { HAND_MARKS, markById } from './marks';

const view = createView({ range: 120000 });
const li = (html, id) => html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))?.[0] ?? '';
const at = (html, id) => {
  const m = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id));
  return m && [Number(m[1]), Number(m[2])];
};
const tags = (html, cls) => html.match(new RegExp(`<[a-z]+[^>]*class="${cls}"[^>]*>`, 'g')) ?? [];
const draw = (props) => renderToStaticMarkup(<NavChart view={view} marks={HAND_MARKS} {...props} />);

describe('the nav map’s chart', () => {
  it('puts each place where the projection says', () => {
    const html = draw({});
    for (const id of ['marvel', 'aurelia', 'veil']) {
      const p = project(view, markById(id).at);
      const { x, y } = toFrame(FRAMES.nav, [p.u, p.v]);
      expect(at(html, id)[0]).toBeCloseTo((x / 1000) * 100, 6);
      expect(at(html, id)[1]).toBeCloseTo((y / 1000) * 100, 6);
    }
  });
  it('always draws the ship: in the middle, or pinned to the rim when it is far', () => {
    expect(tags(draw({ ship: { x: 0, y: 0, z: 0, heading: 0 } }), 'navmap-ship')[0]).toContain('translate(500 500)');
    expect(tags(draw({ ship: { x: 9e6, y: 2e5, z: 0, heading: 0 } }), 'navmap-ship')[0]).toContain('data-edge');
  });
  it('draws no ship and no readout with no ship', () => {
    const html = draw({ ship: null, readout: null });
    expect(html).not.toContain('navmap-ship');
    expect(html).not.toContain('navmap-readout');
  });
  it('stands places on stems up and down', () => {
    const marks = [{ id: 'up', kind: 'world', name: 'Up', at: [3000, 2500, 0], priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true }, { id: 'down', kind: 'world', name: 'Down', at: [-3000, -2500, 0], priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true }];
    const stems = tags(renderToStaticMarkup(<NavChart view={view} marks={marks} />), 'navmap-stem');
    expect(stems.some((t) => t.includes('data-dir="up"'))).toBe(true);
    expect(stems.some((t) => t.includes('data-dir="down"'))).toBe(true);
  });
  it('hides colliding names but never the picked one’s, and shows the readout', () => {
    const pile = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, kind: 'world', name: `Place ${i}`, at: [5000 + i, 0, 0], priority: 10 - i, color: '#fff', levels: ['neighbourhood'], pickable: true }));
    const html = renderToStaticMarkup(<NavChart view={view} marks={pile} pick="p5" readout="Sector 2, 0, 0 · 3,800 ship-lengths above the disc" />);
    expect(li(html, 'p5')).not.toContain('data-quiet');
    expect(pile.some((m) => li(html, m.id).includes('data-quiet'))).toBe(true);
    expect(html).toContain('Sector 2, 0, 0 · 3,800 ship-lengths above the disc');
  });
});
```
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/chart/NavChart.test.jsx`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `NavChart.jsx`, then rewire `NavMap.jsx`** as above. NavMap stays under 800 lines and keeps every class and text the checks read:
  - `.navmap-views button`, `.navmap-place[aria-label]`, `.navmap-name`, `.navmap-list button`, `.navmap-go`
  - `.navmap-drive[data-drive]`, `.navmap-status`, `.navmap-note`, `.navmap-back`, `.navmap-keys`
  - `.navmap-frontbtn`, `.navmap-war-sector`, `.navmap-tool`, `.navmap-frame`, `.navmap-chart`, `.navmap-side`
  - The keys line appends `<kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd> {CHART_WORDS.keys}`, with no new `kbd` rule.
- [ ] **Step 4: Rework `navmap.css`:**
  - `.navmap-stage` takes the chart's old size: `width: min(100%, calc(100cqh − 3.25rem))` and `aspect-ratio` on the circle, with the phone's `42svh` at `:285` moved to it.
  - `.navmap-chart` becomes `position: absolute; inset: 0`, keeps its circle, adds `touch-action: none` and `cursor: grab`, and `grabbing` while dragging.
  - `.navmap-bar` is a flex row with the readout on the left and the tools on the right.
  - `.navmap-readout` uses `font-size: var(--fs-xs)` on `rgb(3 6 16 / 0.8)` glass.
  - The tools are 36 px, and 44 px under `@media (pointer: coarse)`.
  - `.navmap-stem`: the blue at 0.45 alpha; `[data-dir='down']` is dashed `2 3`.
  - `.navmap-sector`: the blue at 0.12 alpha, dashed `6 6`.
  - `.navmap-region[data-region='home']`, `belt` and `curve` reuse today's home-ring, belt and edge looks (`:127-129`).
  - `li[data-quiet] .navmap-name { display: none }`.
  - The phone rule at `:287-288` (wonder names hidden unless picked) stays. No z-index.
- [ ] **Step 5: Add the guide's rows and the words test's files.**
  - `pages.js` gets a group after "On foot": `{ label: 'On the nav map', rows: [['+ − 0', 'Zoom in, out, back to the ship'], ['Drag', 'Move the chart'], ['Shift and drag', 'Tilt and turn it; Look straight down puts it back']] }`.
  - Its touch list gets `['Two fingers on the nav map', 'Pinch to zoom; turn or slide them to turn and tilt it']`.
  - `words.test.js`'s `FILES` gains `...list('components/universe/chart/', /\.jsx$/)`.
- [ ] **Step 6: Run the tests.** Run `npx vitest run src/components/universe src/components/guide src/lib/words.test.js src/styles/tokens.test.js`. Expected: PASS, with `nav.test.js` untouched and green.
- [ ] **Step 7: Lint.** Run `npm run lint`. Expected: no new problems.
- [ ] **Step 8: Commit.**
```bash
git add src/components/universe/chart/NavChart.jsx src/components/universe/chart/NavChart.test.jsx src/components/universe/NavMap.jsx src/components/universe/navmap.css src/components/guide/pages.js src/lib/words.test.js
git commit -m "Nav map on the shared chart: ship-centred, zoom, pan, tilt, stems, the ship always on it"
```

---

### Task 9: The mini-map on the same projection and data

**Files:**
- Modify: `src/components/universe/MiniMap.jsx`, rewritten. Gone: `:14-34` (its own square-root scale and `ORBITS`), `:54-56` (the orbit rings that match nothing) and `:60-64` (the portal's special case, now a wonder mark).
- Modify: `src/components/universe/universe.css:5-38` (`.minimap-orbit` goes; stems, ship and tools added)
- Modify: `src/components/universe/UniverseMap.jsx:459` (`<MiniMap … interactive />`)
- Modify: `src/lib/words.test.js:23` (add `'MiniMap'`)
- Test: `src/components/universe/MiniMap.test.jsx`

**Interfaces:**
- Consumes: `HAND_MARKS`, `placeMarks`, `placeShip`, `miniView`, `FRAMES.mini`, `useChartView`, `ChartTools`, `ringStep`.
- Produces: `MiniMap({ selected, onSelect, linkTo, kind, className, interactive = false, ship = null })`:
  - **Which marks.** Exactly `HAND_MARKS.filter((m) => m.pickable || m.id === 'chart:sun')`, or with `kind="fandom"` (the teaser, `Interests.jsx:22`) the worlds whose `byId(id).kind === 'fandom'` plus `chart:sun`. The sun and the `belt` region are drawn in the SVG in both modes, as today (`:58-59`); every other shown mark gets an `li`.
  - **The view.** `miniView(shown)`.
    - With `interactive`, it goes through `useChartView(box, { open, frame: FRAMES.mini, orbit: false })`.
    - A `ChartTools` row (zoom in, zoom out, show everything) uses `buttonClass="chip"`.
    - `chartKey` on its `onKeyDown` (the focus inside it) zooms, and `0` goes back to `open`.
    - The root carries `data-level`.
  - **Placing.** Through `placeMarks(view, shown, FRAMES.mini, { levels: false, sides: ['under'], keep: [selected] })`. The labels hang under their dots, as `.minimap-hit` does (`universe.css:10-25`).
  - **Labels.** A label's text is `byId(id)?.label ?? mark.name`, so the teaser still reads "Marvel", not the world's name. A hidden name keeps the button's `aria-label`.
  - **The ship.** Drawn pinned when given (`.minimap-ship[data-edge]`). Nothing passes one yet: with 3D off there is no position until lane 4c saves one.
  - **Keys.** `ringStep` over the shown ids replaces `keyStep` (`:42-49`), so the arrows reach the wonders and moons too.

- [ ] **Step 1: Write the failing test** `MiniMap.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MiniMap from './MiniMap';
import NavChart from './chart/NavChart';
import { DESTINATIONS } from './nav';
import { byId } from './universes';
import { FRAMES } from './chart/projection';
import { HAND_MARKS } from './chart/marks';
import { miniView } from './chart/place';

const ids = (html) => [...html.matchAll(/<li[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
const uv = (html, id, f) => {
  const tag = html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))[0];
  const [, l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(tag);
  return [((l / 100) * f.w - f.cx) / f.r, ((t / 100) * f.h - f.cy) / f.r];
};

describe('the mini-map', () => {
  it('shows every hand-made place, wonder and moon, and no orbit rings', () => {
    const html = renderToStaticMarkup(<MiniMap onSelect={() => {}} />);
    expect(ids(html)).toEqual(expect.arrayContaining(DESTINATIONS.filter((d) => d.kind !== 'system').map((d) => d.id)));
    expect(html).not.toContain('minimap-orbit');
    expect(html).not.toContain('minimap-ship');
  });
  it('keeps the teaser to the worlds, by their own labels', () => {
    const html = renderToStaticMarkup(<MemoryRouter><MiniMap kind="fandom" linkTo={(id) => `/universe/${id}`} /></MemoryRouter>);
    expect(ids(html).every((id) => byId(id)?.kind === 'fandom')).toBe(true);
    expect(html).toContain(byId('marvel').label);
  });
  it('places each mark where the nav map would on the same view: one projection', () => {
    const mini = renderToStaticMarkup(<MiniMap onSelect={() => {}} />);
    const shown = HAND_MARKS.filter((m) => m.pickable || m.id === 'chart:sun');
    const nav = renderToStaticMarkup(<NavChart view={miniView(shown)} marks={shown} />);
    const both = ids(mini).filter((id) => ids(nav).includes(id));
    expect(both.length).toBeGreaterThan(10);
    for (const id of both) {
      const a = uv(mini, id, FRAMES.mini);
      const b = uv(nav, id, FRAMES.nav);
      expect(a[0]).toBeCloseTo(b[0], 9);
      expect(a[1]).toBeCloseTo(b[1], 9);
    }
  });
  it('keeps a far ship on the map when it is given one', () => {
    const html = renderToStaticMarkup(<MiniMap onSelect={() => {}} ship={{ x: 5e6, y: 0, z: 0, heading: 0 }} />);
    expect(html.match(/<g[^>]*class="minimap-ship"[^>]*>/)?.[0]).toContain('data-edge');
  });
});
```
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/MiniMap.test.jsx`. Expected: FAIL (no wonders or moons; `minimap-orbit` present; no `data-id` on the `li`).
- [ ] **Step 3: Rewrite `MiniMap.jsx`; edit `universe.css` and `UniverseMap.jsx:459`.**
  - The `li` carries `data-id` and the `left`/`top` style, in that order.
  - Dots stay `5 + min(7, size × 0.2)` for a universe or moon (`:32`) and 5 for a wonder.
- [ ] **Step 4: Run it and see it pass.** Then run `npx vitest run src/components src/lib`. Expected: PASS.
- [ ] **Step 5: Measure the bundle.** Run `npm run build` on this commit and on Task 8's, and note the `Interests` chunk's size from Vite's report both times. The mini-map now reads `nav.js` (the same data, as the spec asks), which brings `ship.js` into the home page's lazy section. The two numbers go in the evidence README.
- [ ] **Step 6: Commit.**
```bash
git add src/components/universe/MiniMap.jsx src/components/universe/MiniMap.test.jsx src/components/universe/universe.css src/components/universe/UniverseMap.jsx src/lib/words.test.js
git commit -m "Mini-map on the chart's projection and marks: wonders and moons on it, no orbit rings"
```

---

### Task 10: `navmap-check` fixed and extended; the phone layout; the after shots

**Files:**
- Modify: `scripts/navmap-check.mjs:86-100` (the jump's goal), plus new steps in the desktop, phone, minimap and far modes
- Create: `scripts/lib/navmap.mjs`
- Modify: `docs/superpowers/evidence/endless-universe-6a-map/README.md`, and add `after/*.png`

**Interfaces:**
- Produces: `shipOnChart(page) → { drawn, inside, edge, readout }` in `scripts/lib/navmap.mjs`.
  - It presses `m` if `.navmap` isn't open and waits for `.navmap-ship`.
  - `inside` means the marker's centre is within the `.navmap-chart` circle (+2 px).
  - It closes with Escape if it opened the map.
  - Lane 2's `universe-endless-check.mjs` calls it at every step.

- [ ] **Step 1: Pick the jump's wonder by name** (HANDOFF "Left").
  - Read `window.__universeDebug.wonders` (`scene.js:5802`: `{ id, name, at, reach }`).
  - Take the first of `['Ember', 'Halcyon']`, both main-sector, whose `at` is further than `reach + 600` from the start.
  - `gx` and `gz` come from its `at`, and the arrival test (`:109`, `:121`, `:129`) is `< reach + 600` in place of `< 800`.
  - No coordinates are left in the file. Check with `grep -nE '[0-9]{4}, ?-?[0-9]{4}' scripts/navmap-check.mjs`: expected, no match.
- [ ] **Step 2: Add the desktop chart steps** after the first shot. Each is a `check(…)` waiting on a condition, never a sleep:
  - **On open.** `.navmap-ship` is within 3 px of `.navmap-chart`'s centre.
    - The expected values come from `__universe().ship`, because a start can be by the Citadel (`:88`).
    - `data-level` is `system` in the Curve and `neighbourhood` elsewhere.
    - `.navmap-readout` starts with `Sector ${sx}, ${sy}, ${sz} · `, by `Math.round(v / 120000) + 0` per axis, with a minus written `−`.
  - **No overlaps.** No two visible `.navmap-name` boxes (width over 0) meet.
  - **Wheel zoom.** `page.mouse.wheel(0, -400)` over the centre, until `data-level` is `system` (at most 12 turns). Then `-` until it is `neighbourhood` again.
  - **Typing doesn't zoom.** Type `-` into `.navmap-search input`: `data-level` is unchanged. Clear the field.
  - **A drag pans with the hand.** A drag of 120 px right in 8 steps, starting on a `.navmap-place` button:
    - The ship marker ends within 6 px of 120 px right of the centre: the middle moves with the hand, `panFrom`.
    - The button's `aria-pressed` is unchanged, and no trip starts (`__universe().auto` unchanged).
    - "Back to the ship" loses `aria-disabled`. Click it: the ship is back within 3 px.
  - **Shift-drag tilts.** A Shift-drag of 120 px up: `data-pitched` appears and "Look straight down" loses `aria-disabled`. Click it: `data-pitched` is gone. Shoot `15-tilted` before the click.
- [ ] **Step 3: Extend the `far` mode.**
  - After the shot, `shipOnChart` gives `drawn` and `inside`. The readout's sector, computed from the ship as above, has `sx ≥ 2`.
  - Drag 400 px left, up to three times, until `.navmap-ship[data-edge]` appears. It must sit inside the circle. Shoot `16-far-ship-pinned`.
- [ ] **Step 4: Extend the phone mode** (390 × 844, `hasTouch`). Force the `(pointer: coarse)` rules on, as `scripts/galaxy-map-check/lib.mjs:241-258`'s `asTouch` does: Chromium won't emulate the pointer. Then check:
  - Each `.navmap-tools button` is at least 44 × 44, inside the frame, clear of the others and of `.navmap-readout`.
  - The readout is visible.
  - `.navmap-side` scrolls: when `scrollHeight > clientHeight`, setting `scrollTop = 200` reads back more than 0.
  - A wonder's `.navmap-name` is hidden until it is picked from the list.
  - Tapping zoom in changes `data-level`. Shoot `14-phone-zoomed`.
  - Turned sideways (844 × 390): the frame, the chart, the bar and the side panel's top are all inside the viewport. Shoot `17-phone-sideways`.
- [ ] **Step 5: Extend the `minimap` mode.**
  - The flat map has a `[data-id]` for `aurelia`, `veil` and one moon (`squanch`), and no `.minimap-orbit`.
  - `+` with the focus inside it changes its `data-level`.
  - The teaser has no `[data-id]` that isn't a world.
- [ ] **Step 6: Run the whole check on the lane's dev server.** Run `OUT=docs/superpowers/evidence/endless-universe-6a-map/after CHROME=… node scripts/navmap-check.mjs`. Expected: `all ok` and `no page errors`.
- [ ] **Step 7: Run the checks that read the nav map** on the lane's server, each per its header. Expected: each passes as on `main`.
  - `scripts/sector-check.mjs` ("The Curve" pressed)
  - `scripts/universe-war-check.mjs` (seven war sectors, the front button)
  - `scripts/wonders-check.mjs`
  - `scripts/links-check.mjs`
  - Any that fails on `main` too is noted, not fixed here.
- [ ] **Step 8: Fill in the evidence README.** Before and after side by side, the checks' outputs, the Interests chunk's two sizes from Task 9, and the statement that the scene is unchanged, so draw calls and triangles are as before. The phone layout's rows answer HANDOFF "Left": the chart over the panel, the panel's scroll, wonder names hidden unless picked, and the map button clear of the Multiplayer pill (`:173-179`, kept).
- [ ] **Step 9: Commit.**
```bash
git add scripts/navmap-check.mjs scripts/lib/navmap.mjs docs/superpowers/evidence/endless-universe-6a-map
git commit -m "Nav map check: a wonder picked by name, the chart's zoom, pan, tilt, far ship and phone layout; after shots"
```

---

### Task 11: Gates, the hand-off and the PR

**Files:**
- Modify: `docs/superpowers/HANDOFF-universe.md` ("Landed", "Left")
- Modify, only if it exists on `main` by now: `scripts/universe-endless-check.mjs`

- [ ] **Step 1: Bring `main` in with a merge** (never a rebase): `git fetch origin && git merge origin/main`.
  - If `scripts/universe-endless-check.mjs` has arrived (lane 2), call `shipOnChart(page)` after each of its steps and assert `drawn && inside`.
  - If it hasn't, the hand-off says so (Step 3).
- [ ] **Step 2: Run the gates.** Expected: all green, `health` within budget (`big-files`: `NavMap.jsx` and each new file under 800 lines; `kbd-styles` not up).
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `node scripts/health.mjs --check --skip build`
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`
- [ ] **Step 3: Update `HANDOFF-universe.md`.**
  - **"Landed"** gets a line for the chart: `src/components/universe/chart/`, `src/lib/gesture.js`, the nav map and mini-map on it, and `scripts/lib/navmap.mjs`.
  - **"Left"** loses the two map items this lane closed (the Citadel coordinates; the phone layout seen) and gains:
    - `nav.js`'s `chartAt`, `chartRadius`, `onChart` and `viewFor` are now unused by any component. Lane 6b, which owns `nav.js`, can retire them with their tests.
    - `where()`'s pilots and far fights carry no height, so they sit level with the ship. Lane 6b adds `y`.
    - The System level's traffic, and the Neighbourhood and Universe levels' generated places, events and visited systems, are lane 6b's, fed in as `Mark`s through `marks.js`.
    - The mini-map's `ship` prop waits for lane 4c's saved position (there is none with 3D off today).
    - `universe-endless-check.mjs`'s ship-marker step, if Step 1 couldn't add it.
- [ ] **Step 4: Commit and open the PR.**
  - The commit message is "Hand-off: the map's first half".
  - The PR body has the before and after table from the evidence README, the gates' results, the Interests chunk numbers, and the note that `galaxy/gesture.js` moved to `src/lib` with its test and no change for the galaxy (`galaxy-map-check` all ok).
  - Merge with a merge commit once CI is green.

---

## Self-review

- **Spec F coverage:**
  - The projection is pure and shared (Tasks 3 and 5, used in 8 and 9).
  - It is focus-centred with the ship by default (3, 6), on the 0.375 family re-centred (3).
  - Zoom by scroll, pinch and keys (2, 7, 10). Pan and re-centre (3, 7, 10).
  - 3D: looking down by default, stems with their sign, modifier and two-finger tilt and turn, one button back (2, 3, 7, 8, 10).
  - The ship's height and sector always on the chart (8, 10).
  - Levels, and labels thinned by priority (3, 4, 5, 6).
  - The ship's marker everywhere (3, 5, 8, 10).
  - Other pilots drawn (6, 8; at their x and z, level, until 6b).
  - The mini-map on the same projection and data, with wonders and moons and without the rings (9).
  - `navmap-check` picks by name (10). The phone layout is seen at 390 × 844 (10). The before shots come first (1).
  - Generated destinations, search, long trips and "nothing you can't go to" for generated places are lane 6b's, by the index plan.
- **Types:**
  - `Mark` is defined in Task 5 and produced in Task 6.
  - `View` is defined in Task 3.
  - `FRAMES.nav` and `FRAMES.mini` are used in Tasks 3, 5, 7, 8 and 9 under the same names.
  - `chartKey`'s actions (`zoomIn`, `zoomOut`, `back`) match the hook's `zoomIn`, `zoomOut` and `back`.
  - The `declutter` sides (`right`, `left`, `under`) match `navmap.css`'s `data-side`.
- **Review Focus:** each line's test is in its owning task: drag from a name (2, 10); typing (7, 10); no ship (6, 8, 9); degenerate numbers (3, 7); sideways phone (10).
