# Lane 6a hand-off notes

For the coordinator to fold into `docs/superpowers/HANDOFF-universe.md`. This lane does not edit that file.

## Task 5: placing marks on a frame

What `src/components/universe/chart/place.js` and `declutter.js` do now, where it differs from the lane plan. Tasks 8 and 9 draw from this, not from the plan's text.

### Landed

- `placeMarks` and the rest of Task 5's exports, in `place.js` (commits 45ef77ce, 24c9ada1 and the review fixes after them).
- A pick's name is firm. It tries to keep off every dot. When no side does, it takes the first side that keeps off the ship, even if it covers another place's dot. It never leaves the frame or covers a name already down. If the ship blocks every side, the pick goes unnamed and its name shows on its `spare` side on a hover or a focus.
- A mark drawn past the rim slides down its own stem to the rim, so its stem stays upright and its height honest. This holds for a pick and for an unpicked mark in range alike (looking down, a high mark's stem is drawn at `stemFloor` of its height, which can take it past the rim). Only a mark whose foot is at the rim or past it (past `PIN`, 0.97 of a round frame's radius) loses its stem: its foot is then its own point. In the mini-map's box, the clamp does the same.
- `reveal` gives back the same view when nothing changes. A mark straight over or under the focus moves nothing, so a followed chart keeps the ship.

### Deviations from the plan

- `declutter(labels, { bounds, sides, dots, hard })` takes a `firm` flag on a label and a `hard` list beside `dots`. `placeMarks` passes the places' dots as `dots` and its `avoid` points (the ship) as `hard`. The plan put both in `dots`, so the pick's name could land on the ship.
- `declutter.js` exports `firstInside(label, { bounds, sides })`: the first side inside the frame, or null.
- `Placed` has a `spare` field the plan does not list: the side a name left off shows on, over the rest, on a hover or a focus. It is null for a mark with a side, no name, or no side inside the frame.
- `projection.js` (Task 3) exports `PIN`, the fraction of a round frame's radius a pinned point sits at, for `place.js` to slide a mark down its stem to it.
- `ringOn` returns `[]` for a centre or radius with no number, and takes at least three sides (64 when `n` has no number).
- `edge` on a `Placed` mark means it is drawn at the rim instead of its true place. That is now true for an unpicked mark in range too, not only for a pick.

### Left

- A pick whose foot is off the frame while its dot is inside draws its stem past the rim (the nav map's circle and the mini-map's box clip it). Nothing in Task 5 changes that.
- `reveal` does not zoom out for a mark straight over or under the focus past the range. A pick is kept and pinned anyway, so it is still on the chart.

## Task 7: hands and keys, the hook, the tools and their words

What `src/components/universe/chart/input.js`, `useChartView.js` and `ChartTools.jsx` and the glossary's `CHART_WORDS` give Tasks 8 and 9, where it differs from the lane plan.

### Landed

- `input.js`: `ZOOM_STEP`, `ORBIT`, `chartKey`, `wheelFactor`, `panFrom`, `gestureStep` and `ringStep`, to the plan, and `createClicks` (below).
- `useChartView(boxRef, { open, ship, frame, orbit })` gives `{ view, setView, level, zoomIn, zoomOut, back, flatten, show, handlers }`. `setView` takes a view or a function of one. `open` is read once. `back()` re-centres on the ship and keeps the zoom and tilt, or goes back to `open` with no ship. The hook sets no key listener: the nav map's capture listener and the mini-map's `onKeyDown` call `chartKey` and then `zoomIn`, `zoomOut` or `back`.
- `ChartTools` draws its buttons in the plan's order, each with `data-tool` (`in`, `out`, `ship`, `flat`, `fit`) for the checks. A button with nothing to do is `aria-disabled` and its click does nothing.
- `CHART_WORDS` in `src/components/universe/words.js`, with a test beside it for the sector's minus sign and the height's words.

### Deviations from the plan

- `chartKey` also reads a keyboard event's own `metaKey`, `ctrlKey` and `altKey`, so Task 8 can pass the event as it comes. With only the plan's `meta`, `ctrl` and `alt`, Ctrl and − (the browser's own zoom) would zoom the chart too.
- A drag's double click is swallowed as well as its click: `input.js`'s `createClicks()` and the hook's `handlers.onDoubleClickCapture`. A place's double click sends the ship, so a press on a name that nudged the chart must not count as one (Review Focus 1). Task 8 spreads `handlers` onto `.navmap-chart` whole, not handler by handler.
- `CHART_WORDS.tools` (“Chart tools”) names the tools' group for a screen reader. The plan's group had no name.
- A drag moves only the focus's x and z. The focus's height stays the live view's (the ship's, which `track` keeps up to date while the hand is down). The drag re-anchors if a key or the wheel zoomed, turned or tilted the chart mid-drag. The plan's "the view becomes `panFrom(anchor, total, frame)`" would have put back the anchor's height and zoom.
- `useChartView.test.js` runs the hook by hand under a mocked React, as `online/useOnline.test.js` does. It pins the drag's anchor, the swallowed clicks, the ship's tracking, `back`, the wheel and the Shift-drag. The plan had no unit test for the hook.
- `gestureStep(view, message, frame, opts)` keeps the plan's `frame` parameter, which it doesn't use: every message but a pan is in the box's own fractions.

### Left

- A pinch also turns and tilts by however much its fingers' angle and midpoint drift, with no dead zone. If a phone's pinch feels twitchy in Task 10, `gestureStep` is where a dead zone would go.
- The turn's direction is the plan's: a drag right turns the chart clockwise, so its far side follows the hand. The owner's eye in Task 10 is where to check that it feels right.
- The wheel's listener goes on `boxRef.current` at mount, so the box must be in the DOM from the first render. The nav map's chart is: on a phone in list mode, CSS hides it.
