# Endless universe, lane 6a: the map, first half. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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
