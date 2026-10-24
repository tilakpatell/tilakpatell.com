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

## Task 8: the nav map draws through the chart

What `src/components/universe/chart/NavChart.jsx` and the rewired `NavMap.jsx` do now, where it differs from the lane plan.

### Landed

- `NavChart` (default export of `chart/NavChart.jsx`) draws the nav map's chart: `.navmap-stage` holds the circle (`.navmap-chart[data-level][data-pitched]`, with the canvas of stars, the SVG, `ul.navmap-places` and `.navmap-out`) and the bar under it (`p.navmap-readout`, then the tools). Props: `view`, `marks`, `ship`, `course`, `front`, `onFront`, `frontTitle`, `frontOff`, `pick`, `here`, `hover`, `dim`, `onChoose`, `onGo`, `onRegion`, `out`, `tools`, `readout`, `handlers`, `boxRef`.
- `NavMap.jsx` keeps its header, filters and side panel, and its view in `useChartView`. It opens on `openView(ship)`, a chip is pressed when `presetOf(view)` is its id, a list or search pick reveals the place (its gate for a star system), the course goes to `legOf`'s leg, and the capture listener sends `+`, `−` and `0` through `chartKey` (never while typing in the search). It is 442 lines, from 667.
- The guide has an "On the nav map" group and a touch row for two fingers. `words.test.js` reads `chart/*.jsx`.
- No name goes under the way out. `NavChart` gives `placeMarks` `.navmap-out`'s box (`WAY_OUT`: 12 by 2 rem, centred, its foot 9% up the chart) as an `avoid` box, and `declutter` keeps every name off it, the pick's too. `main`'s map kept the same box clear.
- `reveal` moves the focus only for a mark past 0.9 of the range across, as `inside` counts it, so a high place already on the chart keeps the ship.
- The names are measured at `NAME_REM` (0.7) of the root's font, whichever name comes first, and the regions' at `REGION_REM` (0.6). `NavChart.test.jsx` holds both, the name's 14 px offset and the stage's widths to `navmap.css`.
- The list's rows are drawn again when the list, the ship or where it is change, not on every move of the chart, so a drag or a pinch redraws the chart alone.
- A browser smoke run (`lab/navchart/smoke.mjs`, not committed) passed: the ship in the middle, the readout, the keys, a minus typed in the search, a drag, `0`, a Shift-drag, Look straight down, a drag from a name picking nothing, the Home system chip with all six stations, the way out, the wheel, and the ship two sectors out. `navmap-check.mjs` desktop: 16 ok, the same five Citadel failures as on `main`; phone: all ok; no page errors, the fonts served.

### Deviations from the plan

- `NavChart` takes a `hover` prop the plan doesn't list: the place lit from the list (`data-hover`), as the nav map does today.
- A `Mark` may carry `type` (nav.js's words for what it is), and `marks.js` copies it, so a place's button still says "Ember, Star".
- `placeMarks` takes `measure(mark)`, a name's width in px. The nav map measures its names with a canvas in the page's own font, as today's map did; without it (server-side, the tests) it uses `labelSize`'s estimate.
- `project`'s `inside` is within the range across (x and z), not in 3D. With the ship 600 below the disc, the Home system chip (a range of 381) showed none of the stations. A height never takes a place off the chart now; its stem says how far it is.
- `CHART_WORDS.keys` is `{ zoom, back }`, so the keys line draws the 0 as a cap: "+ − zoom in and out, 0 back to the ship".
- The front is a mark `NavChart` makes from `where().front` (id `front`, all levels, priority 47, after the wonders as before), so its name thins with the rest. The war's SVG is never left off.
- Home system's and the Curve's marks are `button.navmap-place.navmap-homebtn`, a name and no dot, in today's Home system look (mono capitals at 0.6rem) in each one's colour, with its amber on a hover over the hover's glass.
- A place the filter dims has no name of its own (today's `label: false`); it shows on a hover. A dimmed pick keeps its name.
- `.navmap-chart` keeps `position: relative` with `aspect-ratio: 1` inside the stage (a flex column), not `position: absolute; inset: 0`, so the circle never takes the bar's height. It also gets `user-select: none`: a drag across the names selected them.
- The phone's stage is `min(100%, calc(50svh − 3.25rem))`: today's rule is 50svh (the plan's 42svh isn't in the code), and the chart and its bar together are as tall as the chart was.
- Moons keep the worlds' bigger dot (`data-kind='moon'` joins the world dot's rule).
- `placeMarks`' `avoid` takes boxes (`{ x0, y0, x1, y1 }`, frame units) beside points, and `declutter`'s `hard` takes them in px. The plan has points only.
- A name starts 14 px past its dot's middle: the plan's `labelSize` (+22, the 16 px dot and a 6 px gap) is the box, and the stylesheet now draws to it.
- The ruler takes the names' size as `NAME_REM` of the root's font, not from the first `.navmap-name` (the plan's words): the first could be a region's, at 0.6rem.
- The plan's line numbers for `NavMap.jsx` and `navmap.css` (`UNDER`, the phone's wonder-name rule) are not in today's code. The names were laid out by `chartLabels.js`, which this replaces.

### Left

- A name left off for the way out still shows on its spare side on a hover, under the button if that is where it falls.
- `chartLabels.js` and its test have no other importer now (and `navmap-check.mjs`'s `namesClash` comment still names it). `nav.js`'s `chartAt`, `chartRadius`, `chartHeading` and `onChart` are used only by `nav.js` and `nav.test.js`. `nav.js` is not this lane's to edit; both are for a later clean-up.
- At the opening zoom (120,000 round the ship), the chart names fewer places than `main`'s whole-universe chart did (18 of 39 in the smoke run). The rest show on a hover. `labelSize`'s 24 px box height, against 18 px names, is the knob if Task 10's owner look wants more.
- `universe-war-check.mjs` and `sector-check.mjs` were not run in a browser here; `NavChart.test.jsx` pins the seven war sectors and the front's button, and `marks.test.js` pins The Curve's chip.
