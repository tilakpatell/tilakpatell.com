# Task 9 report: the mini-map on the chart's projection and marks

## Implemented
- `MiniMap.jsx` rewritten on `HAND_MARKS`, `placeMarks` (levels:false, sides ['under'], keep [selected]), `placeShip`, `miniView`, `ringOn`, `FRAMES.mini`. Gone: its own scale, `ORBITS`, the orbit rings, the portal special case.
- `li` carries `data-id` then `left`/`top` at full precision; the hit is `li[data-id] .minimap-hit` (no `data-id` on the hit; nothing in scripts/ or src/ read it; `navmap-check.mjs` uses class names only).
- Always calls `useChartView`; non-interactive gets a null ref, no handlers, no tools, draws `miniView(shown)` exactly. Interactive: wheel, drag pan, `chartKey` zoom/`0` to open (never while typing, modifiers ignored), `ChartTools` row (zoom in/out, show everything) with `buttonClass="chip"`, `data-level` on the root.
- Keys: `ringStep` over the placed pickable ids (equals the shown ids unless zoomed so some are off the chart, so focus never goes to an undrawn button).
- Labels `byId(id)?.label ?? mark.name`; hidden names keep `aria-label`; dots 5 + min(7, size*0.2) (universe/moon), 5 (wonder); stems; sun and belt in the SVG in both modes.
- `ship` prop drawn pinned as `g.minimap-ship[data-edge]`; documented in the header comment for lane 4c.
- CSS: `.minimap-orbit` removed; stems, ship, quiet names, tools row (36 px, 44 px coarse, glass 0.82), no z-index. `UniverseMap.jsx:459` gets `interactive`. `words.test.js` lists `MiniMap`.

## TDD
- RED: `npx vitest run src/components/universe/MiniMap.test.jsx` -> 3 failed, 1 passed (no ids on `li`; ship absent).
- GREEN: same command -> 4 passed.
- `npx vitest run src/components/universe src/components/interests src/lib`: 8 files failed under load (battle, battleTactics, crews, foot, hunterRules, landings, traffic, nostr); re-run alone: 22 files, 365 tests all pass (load timeouts, unrelated).

## Bundle (Interests chunk, `npm run build`)
- Before (Task 8, 810fb564b): `Interests-DQYXCfRn.js` 7.41 kB, gzip 2.90 kB.
- After: `Interests-7sfI3CXZ.js` 7.41 kB, gzip 2.90 kB (unchanged to the report's precision; nav.js, ship.js and the chart modules were already in shared chunks).

## Lint and health
- `npx eslint` on the four files + test: clean.
- `node scripts/health.mjs --check --skip build`: "within budget", all rows ok.
- `public/github.json` is rewritten by the build; I restored it, not committed.

## Files
src/components/universe/MiniMap.jsx, MiniMap.test.jsx, universe.css, UniverseMap.jsx, src/lib/words.test.js.

## Self-review / concerns
- No browser run (not asked; the CPU lock was held a long time). Visual check of tools row placement (bottom right over the map) and label crowding is left to Task 10.
- The `0` key goes to `open` (the miniView), not a ship (no ship here).
- Interactive without `onSelect`: arrows do nothing, as before.

## Fix round 1
- Important 1: `.minimap[data-interactive] .minimap-svg { overflow: hidden; }` in universe.css. Only the SVG is clipped (belt band, stems); the labels are HTML in the `ul`, so the under-labels are not cut, and the selected ring has the frame's 8 unit pad. The teaser (not interactive) keeps `overflow: visible`.
- R11: MiniMap's header comment now says the arrows step through the places drawn (every place at the opening view; once zoomed, an undrawn place has no button).
- Browser (Chrome, 1280 x 800, tp-3d off, tp-intro 1, vite on 5266, stopped after): computed svg overflow `hidden`; opening view shows all dots, names hanging under their dots, selected ring and tools row intact; after 6 and 14 `+` presses (level `system`, 6 places) the belt band stays inside the box, no page errors. Shots in the scratchpad: flat-open.png, flat-zoomed.png, flat-zoomed-max.png. I did not shoot the teaser (its CSS is unchanged).
- Tests: `npx vitest run src/components/universe/MiniMap.test.jsx` -> 4 passed; eslint on MiniMap.jsx clean. No new test (a CSS-only clip; the check is the browser run).
