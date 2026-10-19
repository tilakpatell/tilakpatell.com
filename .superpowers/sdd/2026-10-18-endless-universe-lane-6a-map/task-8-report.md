# Task 8 report: the nav map draws through the chart

Status: DONE_WITH_CONCERNS (all green; one fix outside the brief's files, flagged below)
Commit: `810fb564b` "Nav map on the shared chart: ship-centred, zoom, pan, tilt, stems, the ship always on it" (+ the two trailer lines)

## What I implemented

**`src/components/universe/chart/NavChart.jsx` (new, 339 lines)**, default export, the brief's props:
- DOM as the brief has it: `.navmap-stage > .navmap-chart[data-level][data-pitched] (canvas, svg, ul.navmap-places, .navmap-out) + .navmap-bar (p.navmap-readout, .navmap-tools)`.
  - `handlers` and `boxRef` go on `.navmap-chart`. All of `handlers` is spread, so R4's `onDoubleClickCapture` is there too.
  - `.navmap-chart` is always rendered, so the hook's wheel listener finds the box on mount.
- The SVG draws, in order:
  - `ringsFor` as `.navmap-ring` ellipses (`rx` from `warp`, `ry = rx·cos pitch`)
  - `sectorGrid` (n = 1 at neighbourhood, 2 at universe) as `.navmap-sector` polylines
  - `REGIONS` at their levels as `.navmap-region[data-region]`. The belt's stroke width is its band's projected width, averaged round the ring.
  - stems as `line.navmap-stem[data-dir]` when ≥ 1.5 long
  - the wonder and sun glyphs as before, far first by `depth`
  - the war, through `project`/`toFrame`, never filtered
  - the course to its pinned target
  - pilots and fights
  - `g.navmap-ship[data-edge]` from `placeShip`, whenever `ship` is set
- The places list:
  - one `li[data-id][data-kind][data-side][data-quiet][data-dim]` per placed pickable mark, region (`chart:home` with `navmap-homebtn` → `onRegion('home')`, `chart:curve` → `onRegion('rickmorty')`) or fight (labels only)
  - the style starts `left`, `top` at full precision
  - places keep `aria-pressed`, `aria-current`, `aria-label` (`name, type[, you’re here]`), `onClick → onChoose` and `onDoubleClick → onGo`
  - the `.navmap-frontbtn` li stays, with `disabled`/`title` through `frontOff`/`frontTitle`
- Measurement: a `ResizeObserver` on the box repaints the stars (`paintStars` moved here unchanged) and measures `scale` (width / 1000) and `fontPx` (a `.navmap-name`'s computed size). Before measuring, and in SSR, these are 1 and 11.
- The pick (and a star system's gate, its `via`) is kept, so it's pinned and always named.
- The ship's and the front's points go to `placeMarks` as `avoid`, so no name covers the ship marker.
- SVG geometry is rounded to 0.01 (comment says why); `li` positions are not.

**`NavMap.jsx` (548 → 396 lines):**
- Gone: `UNDER`, `fightsOn`, `paintStars`, `sizeOn`, the local `sectorAt`, the `view` state, `P`/`pct`/`shipAt`/`toward`/`homeR`, and the old chart block. It now renders `<NavChart>`.
- The view: `box = useRef(null)`; `open` comes from a `useState` initialiser (`openView(now?.ship)`, read once); `chart = useChartView(box, { open, ship, frame: FRAMES.nav })`.
- The marks: `marks = [...HAND_MARKS, ...liveMarks(now)]`. `dim` is the pickable marks the filter or search leaves out.
- The chips: `aria-pressed={presetOf(chart.view) === c.id}`; a click sets `presetView(c.id, ship)`.
- A list or search pick calls `chart.show(markById(d.via ?? d.id))`, guarded for a null mark.
- The course target: `destinationById(legOf(now.ship, course.id))?.at`, guarded, so no destination means no course line.
- `.navmap-out` shows on `home` and `rickmorty` with the same labels and actions as before. "Out" is `setView(presetView('all', ship))`.
- The readout: `CHART_WORDS.sector(sectorAt(...)) · CHART_WORDS.height(...)`, and none without a ship.
- The tools: `{ onZoomIn, onZoomOut, onShip: flying ? back : null, atShip: view.follow, onFlat: flatten, flat: !pitched }`.
- Keys, in the existing capture listener:
  - `typing = e.target instanceof Element && e.target.matches('input, textarea, [contenteditable="true"]')`
  - `chartKey({ key, meta, ctrl, alt }, { typing })`; on a hit, `preventDefault()` and the hook's `zoomIn`/`zoomOut`/`back` (read through a ref, so the listener isn't re-added four times a second)
  - Escape behaves as before (only a `return` added after it).
- The keys line appends `<kbd>+</kbd> <kbd>−</kbd> {CHART_WORDS.keys.zoom}, <kbd>0</kbd> {CHART_WORDS.keys.back}` (R3). No new `kbd` rule.

**`navmap.css`:**
- **Layout: deviates from the brief's literal values, on purpose.** The circle's size is a `--circle` custom property on `.navmap-stage`: `min(100%, calc(100cqh − 3.25rem))`, with the `64vh` fallback, and the phone's `42svh` moved to it. `.navmap-chart` uses it with `aspect-ratio: 1`. The bar may run wider than the circle (`min(100%, max(var(--circle), 30rem))`).
  - Why: at 844 × 390 the circle is 159 px. A bar as wide as the circle made the readout wrap word by word into a 205 px bar, off the screen. Now it is 43 px and fits.
  - The chart stays in flow (`position: relative`) rather than `absolute; inset: 0`, so the bar sits under it in flow on a phone too.
- `.navmap-chart`: `touch-action: none`, `user-select: none`, `cursor: grab`, `:active` grabbing.
- `.navmap-readout`: `--fs-xs` on `rgb(3 6 16 / 0.8)`, tabular numbers.
- Tools: 36 px, and 44 px under `(pointer: coarse)`. `aria-disabled` tools dim by colour (`--muted`).
- `.navmap-stem`: the blue at 0.45; `down` is dashed 2 3. `.navmap-sector`: the blue at 0.12, dashed 6 6.
- `.navmap-region[data-region=home|belt|curve]` take the old home-ring, belt and edge rules (those three classes had no other user).
- `li[data-quiet] .navmap-name { display: none }`. The world dot also covers `data-kind='moon'` (moons were `world` before).
- `li[data-kind='home']` → `li[data-kind='region']`, keeping the mono uppercase label. The home label stays amber; the translate is dropped so the declutter's sides apply.
- The phone rule hiding wonder names stays. Next to it, `--wonder-names: 0`: NavChart reads it and leaves hidden wonder names out of the label fitting (a picked wonder stays named). On the phone this took visible names from 3 to 5.
- No z-index.

**Guide and words test:**
- `pages.js`: the "On the nav map" group and the two-finger touch row, verbatim from the brief.
- `words.test.js` `FILES` gains `...list('components/universe/chart/', /\.jsx$/)`.

**Optional label (taken):** `ChartTools` takes an optional `label` → the group's `aria-label`, with `CHART_WORDS.tools = 'Chart tools'`. Tested in `ChartTools.test.jsx`.

**Outside the brief's files: a defect fix in `marks.js` `presetView`, with a test in `marks.test.js`.**
- The defect: the focus plane is the ship's height (`presetView` and `track`), and `placeMarks` culls by 3D distance. So with the ship more than about 250 units off the disc, the Home system chip (range 381) showed an empty chart: every station and the sun out of range.
- How common: the browser runs had ships at 505 below and 1,053 above, which is ordinary.
- The fix: a preset's range is `max(r, hypot(min(rim, r), ship.y − origin.y))`, where the rim is `HOME_RADIUS` for home, the Curve's edge for the Curve, and the range itself for the universe.
- Existing pins are unchanged: `presetView('home', { y: 77 }).range === CHART_VIEWS.home.r`, and every `marks.edge.test.js` case. The level stays `system`, so `presetOf` still says `home`.
- Seen in the browser (d4-home.png): the sun, the six stations and the belt, on dashed stems below a ship 3,300 ship-lengths above the disc.

## TDD evidence

RED, `npx vitest run src/components/universe/chart/NavChart.test.jsx` (the brief's test, verbatim):
```
FAIL  src/components/universe/chart/NavChart.test.jsx
Error: Cannot find module './NavChart' imported from …/NavChart.test.jsx
Test Files  1 failed (1)   Tests  no tests
```
GREEN after implementing: `Test Files 1 passed (1)  Tests 5 passed (5)`.

RED, ChartTools label (`npx vitest run src/components/universe/chart/ChartTools.test.jsx`):
```
AssertionError: expected '<div role="group"><button type="butto…' to contain 'role="group" aria-label="undefined"'
Tests 1 failed | 1 passed (2)
```
GREEN: `Tests 2 passed (2)`.

RED, the preset fix (`npx vitest run src/components/universe/chart/marks.test.js`):
```
× frames a preset’s region from the ship’s height: far above or below the disc, the home system is still in range
AssertionError: home from -505: expected false to be true
Tests 1 failed | 7 passed (8)
```
GREEN: `npx vitest run src/components/universe/chart src/components/universe/nav.test.js` → `Test Files 10 passed (10)  Tests 78 passed (78)`. nav.test.js is untouched.

The brief's run, `npx vitest run src/components/universe src/components/guide src/lib/words.test.js src/styles/tokens.test.js`:
- Result: 2072 passed, 7 failed.
- All 7 are `Test timed out in 5000ms`, in four files: `crews.test.js`, `foot.test.js`, `landings/landings.test.js` and `landings/physics.test.js`.
- None of the four touches the nav map or the chart (checked by grep).
- Run alone they pass: `Test Files 4 passed (4)  Tests 72 passed (72)`. Machine load from parallel lanes.
- Every chart, guide, words and tokens test passes. A focused run of chart + nav + guide + words + tokens gave 226/226.

The measurement (scale, fontPx, `--wonder-names`) is browser-only, as the brief's own scale/fontPx is, and is evidenced by the browser probe below rather than a unit test.

## Lint and health
- `npx eslint` on every changed file: clean.
- `npm run lint` (whole repo, after the CPU wait): exit 0, no problems.
- `node scripts/health.mjs --check --skip build`: "within budget", every metric ok, "ok 150 files on the island".

## Line counts
- `NavMap.jsx`: 396 (was 548)
- `NavChart.jsx`: 339

## Selector audit (every `.navmap*` in `scripts/*.mjs`)
All found in the new source (NavMap.jsx / NavChart.jsx / ChartTools.jsx):
- `.navmap`, `.navmap-back`, `.navmap-chart`, `.navmap-close`, `.navmap-drive[data-drive]`, `.navmap-drive-time`
- `.navmap-frame`, `.navmap-frontbtn`, `.navmap-go`, `.navmap-keys`, `.navmap-kinds button`, `.navmap-list button` / `li`
- `.navmap-name`, `.navmap-note`, `.navmap-place[aria-label]`, `.navmap-side`, `.navmap-status`
- `.navmap-tool` (the "Fly past" head tool, by text; the chart's tools share the class), `.navmap-views button` / `[aria-pressed="true"]`, `.navmap-war-sector`

Points about specific checks:
- `.navmap-views button` nth 1 is still "Home system".
- "The Curve" reads pressed on opening in the Curve: `openView` there gives `presetOf` = `rickmorty`.
- The war's seven `.navmap-war-sector` are drawn whenever `front` is set, at any view. An SSR probe gave 7 in all seven views tried, including a ship 10^12 out.
- `.navmap-frontbtn` is pinned to the rim when the front is beyond range, so it's always clickable.

## Browser probe (optional; the full check is Task 10's)
- Setup: dev server on 5266 (now stopped; port 5266 free), Playwright's Chrome. Throwaway probe and shots are in `.superpowers/scratch-task8/` (git-ignored).
- Result: every step ok, "no page errors".
- Desktop 1440 × 900:
  - The ship is at the circle's centre (0, 0 px), and no visible names overlap, at the opening view and zoomed in.
  - The readout reads e.g. "Sector 0, 0, 0 · 4,100 ship-lengths above the disc"; the tools are 36 × 36.
  - The wheel zooms to `system`, and `-` steps back out.
  - Typing `-0+` into the search goes into the field and doesn't zoom.
  - A drag of 120 px from a place's button moves the ship marker 120 px. It picks nothing and starts no trip; "Back to the ship" goes live and brings the ship back.
  - Shift-drag sets `data-pitched`; "Look straight down" clears it.
  - The Home system chip and "Out to the universe" work.
  - Picking Avengers HQ from the list draws the course. `0` re-centres; Escape closes.
- Phone 390 × 844: the frame, chart, bar and side panel are all on screen, the tools 44 × 44 (coarse), no overlaps.
- Sideways 844 × 390: everything on screen (bar 43 px tall), no overlaps.

## Self-review
- R2, R3 and R4 are followed. No model names; British spelling; curly quotes.
- New words: `CHART_WORDS.tools`. Every other string was moved, not new: "Places", "The front · ", "Back through the portal", "Pick a ship to fly to the front".
- Review Focus:
  1. Drag from a name: R4's handlers are spread and the drag was verified in the browser.
  2. Typing: `chartKey` with `typing`, verified in the browser.
  3. No ship: no marker, no readout, no "Back to the ship"; `openView(null)`. Tested in NavChart.test and an SSR probe.
  4. Degenerate numbers: no NaN or Infinity in the markup for a ship 10^12 out with a NaN heading, or a mark at the focus at range 300. Region rings wholly beyond 1.5× the range aren't drawn.
  5. Sideways phone: checked above.

## Concerns
1. **`marks.js` / `marks.test.js` edited** (Task 6's files) for the empty Home system preset. The edit is small, and every existing pin still holds, but it's outside the brief's file list. Please review.
2. **Layout deviates from the brief's literal CSS.** The stage isn't `width: …` with the chart `absolute; inset: 0`. The circle's size is `--circle`, the chart stays in flow, and the bar may be wider than the circle. Without this, the 844 × 390 bar ran off the screen.
3. **The far-fight label is always drawn under its burst** by the existing `li[data-kind='fight']` translate, while the declutter may have reserved a box to its right or left. Fights are rare, but an overlap is possible. A per-mark `sides` in `placeMarks` would fix it.
4. **Few names on small charts.** On the 159 px sideways circle no names fit, so the chart shows dots and the list carries the names. On the 348 px phone, 5 show. That is the declutter doing its job at that size, but worth an eye in Task 10's shots.
5. **The stars canvas still paints its warm centre glow** (moved verbatim). Centred on the ship now, it reads as a "you are here" vignette rather than the sun.
6. **An existing rule fades text below 0.55:** `.navmap-places > li[data-dim] { opacity: 0.22 }`. I didn't restyle it (existing part).

## Files changed
- `src/components/universe/chart/NavChart.jsx` (new)
- `src/components/universe/chart/NavChart.test.jsx` (new, the brief's verbatim)
- `src/components/universe/NavMap.jsx`
- `src/components/universe/navmap.css`
- `src/components/guide/pages.js`
- `src/lib/words.test.js`
- `src/components/universe/chart/ChartTools.jsx`, `ChartTools.test.jsx`, `src/components/universe/words.js` (optional label)
- `src/components/universe/chart/marks.js`, `marks.test.js` (the preset defect)

---

## Fix round 1

Commit: `731b42946` "Nav map: the followed ship drawn in the middle on every commit; names kept inside the round chart; the chart worked out only when its inputs change" (+ the two trailer lines). Task 9's files (MiniMap.jsx, universe.css, UniverseMap.jsx, words.test.js) are untouched.

**Important #1, the torn frame (`NavMap.jsx`).**
- The fix: `const view = useMemo(() => (now?.ship ? track(chart.view, now.ship) : chart.view), [chart.view, now?.ship])`. `track` returns the same object when nothing changed, and the memo keeps the view's identity across side-panel re-renders.
- That `view` goes to NavChart and is used for `presetOf`, `pitched` and the tools' `atShip`.
- The evidence is a browser check (`.superpowers/scratch-task8/torn.mjs`, git-ignored). It flies the ship on autopilot at super speed (900), opens the map, and records every commit's `g.navmap-ship` transform with a MutationObserver for 6 s.
  - RED, before the fix: `FAIL the ship drawn off the middle by up to 44.7 units over 42 commits`
  - GREEN, after: `ok the followed ship stays in the middle on every commit` (worst offset 0 units; only 4 transform changes, all heading-only rotations at `translate(500 500)`)

**Minor #2, names inside the circle (`place.js`, `declutter.js`).**
- `declutter`'s `bounds` may now be a circle `{ cx, cy, r }`: a box is inside it when all four corners are. The header says so.
- For `frame.shape === 'circle'`, `placeMarks` passes the circle the frame is clipped to: its box's inscribed circle, radius `min(w, h) / 2` (500 for the nav map) about `(cx, cy)`, times `scale`. The mini-map's box frame keeps its square bounds.
- **I used the clip circle (500), not the chart radius r (470).**
  - `.navmap-chart` is a square box with `border-radius: 50%`, so 500 is where a name is actually cut.
  - With 470, a picked place pinned at 0.97·r near 45° up and right fits no side at all, and would lose its name.
  - With 500, its right-hand box fits (far corner at 497.5).
- New tests (the brief's tests are unedited):
  - `place.test.js` "keeps a round frame’s names inside the circle it is clipped to, a pinned pick’s too": a near-rim mark at 45°, a pinned pick at 45°, and a mini-map corner mark that still gets `under`.
    - RED at `place.test.js:63`: `expected false to be true`. The diagonal's right-hand name left the circle.
  - `declutter.test.js` "keeps names inside round bounds…": `right` in square bounds, `left` in round ones, and none when no side fits.
    - RED: `expected null to be 'left'`.

**Minor #5, memoising (`NavChart.jsx`).**
- Memoised on their real inputs:
  - `shipAt` on `[view, ship]`
  - `frontAt` on `[view, front]`
  - the names map on `[marks]`
  - `placed` on `[view, marks, pick, fit, shipAt, frontAt]`, with `keep` and the wonder blanking inside it
  - the glyph order on `[placed]`
- The SVG's view-only geometry (rings, sector outlines, regions) is a memoised element on `[view]`, and the war on `[view, front, frontAt]`. React skips those subtrees when only the side panel changes (`dim`, the times, `copied`, the filters).

**Minor #7 (`ChartTools.jsx`).** `tool`'s parameter is renamed `label` → `name`, so the new `label` prop is no longer shadowed.

**Minor #8 (`NavChart.jsx`).** `fontPx` is measured from `.navmap-place[aria-label] .navmap-name`. Only a place's button carries an `aria-label`; regions, fights and the front don't. With none, it keeps the last value, 11 at first.

**Covering tests.**
- `npx vitest run src/components/universe/chart src/components/universe/MiniMap.test.jsx src/components/universe/nav.test.js` → `Test Files 10 passed (10)  Tests 83 passed (83)`
- `npx eslint` on the seven changed files → clean
- The full browser probe (`.superpowers/scratch-task8/probe.mjs`, desktop, 390 × 844, 844 × 390): every step `ok`, `no page errors`.
- The dev server (port 5266) is stopped; the port is free.
- Line counts: NavMap.jsx 399, NavChart.jsx 359.

**Still open:** the fight label (always drawn under its burst; concern 3 above) is unchanged.
