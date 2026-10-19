# Task 7 report

Implemented: input.js (ZOOM_STEP, ORBIT, chartKey, wheelFactor, panFrom, gestureStep, ringStep), useChartView.js (with R4 onDoubleClickCapture, 600 ms DBLCLICK_WINDOW), ChartTools.jsx, CHART_WORDS in words.js (R3: keys is { zoom, back }).

TDD: RED first run of `npx vitest run src/components/universe/chart/input.test.js src/components/universe/chart/ChartTools.test.jsx`: 2 files failed, no tests (modules not found). GREEN: `npx vitest run src/components/universe/chart src/lib/words.test.js`: 7 files, 114 tests passed. One test initially failed (yaw 0.3000000000000007 from projection's wrap); fixed by snapping yaw to 1e-12 in gestureStep.

Lint: `npx eslint` on the six files: clean.

Concerns: the yaw snap works round projection.wrap's float noise (projection.js untouched); a cleaner fix is wrap returning its input when already in range. pan anchor reads the last rendered view (viewRef).

## Fix round 1

- Pan now lays only its x and z (from `panFrom(anchor, total)`) onto the latest view; y, range and the rest stay as other changes left them.
- A wheel zoom mid-drag re-anchors the drag (anchor := the zoomed current view, total := 0), a few lines, so hand and map do not drift. Button or key zooms mid-drag are not re-anchored (a mouse is busy dragging; rare).
- `onPointerDown` clears the pan unconditionally.
- `chartKey` uses a `Map`; test added: `chartKey({ key: 'constructor' })` is null.
- `npx vitest run src/components/universe/chart src/lib/words.test.js`: 8 files, 116 tests passed. eslint clean.
