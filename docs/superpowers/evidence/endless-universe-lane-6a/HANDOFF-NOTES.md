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
- No name goes under the way out, but a pick it or the ship blocks on every side (see Left). `NavChart` gives `placeMarks` `.navmap-out`'s box (`WAY_OUT`: 12 by 2 rem, centred, its foot 9% up the chart) as an `avoid` box, and `declutter` keeps every name off it, the pick's too where the pick has a side clear of it. `main`'s map kept the same box clear. A name left off shows on a hover on a side clear of the box and the ship where it has one (`firstInside` takes `hard`).
- The circle and its bar fit the body at any window. The circle is `--chart`, the body's height less the bar (3.25rem: a 44 px tool, or two lines of the readout, and the gap). The bar is one row, at least as wide as the circle and as wide as its words and tools want, up to the chart's column. The readout is held to two lines; on a phone, where the panel under the chart gives way, it shows every word. Measured in Chromium on a stand-in page (`lab/navchart/stand/`, not committed: the real `NavMap` with a fake `where()` and no scene). The stage is inside `.navmap-body` and the bar inside the frame at 844×390 and 640×360 with touch, 1280×500 and 900×600 with a mouse, and 1440×900, 1280×720, 390×844 and 360×640. Before, the stage ran 152 px past the body at 844×390 (a 181 px circle, the readout squeezed to 19 px, the bar 195 px tall), 34 px past at 1280×500, and at 640×360 it pushed the side panel off the screen. At 1440×900, 1280×720 and 390×844 the circle and the bar are where they were.
- The Curve folds into its own mark where its edge is drawn under 30 px round (`marks.js`'s `foldMarks` and `FOLD`, from `reachOn` at the page's scale). Its 13 places are left off, but the pick, and `chart:curve` stands in for them at every level, its name firm, a click opening the Curve's chart. Before, from a ship in the main sector at the opening zoom, the 13 piled up within about 25 units of each other, every name quiet, and a click picked whichever was on top. `NavChart.test.jsx` pins it from Middle-earth at 120,000: no two buttons within 8 units but the portal beside the Rick and Morty planet. On the Curve's own chart all 13 are there.
- Every button on the chart has an `aria-label`: Home system's, the Curve's and the front's too, so one whose name is quiet still has a name.
- The ruler (`place.js`'s `nameRuler`) measures each name once. A resize, or the page's fonts coming in, makes a new one, which measures afresh.
- `reveal` moves the focus only for a mark past 0.9 of the range across, as `inside` counts it, so a high place already on the chart keeps the ship.
- The names are measured at `NAME_REM` (0.7) of the root's font, whichever name comes first, and the regions' at `REGION_REM` (0.6). `NavChart.test.jsx` holds both to `navmap.css`, with the name's 14 px offset, an `under` name's place in its box, the circle's size and the bar's height.
- The list's rows are drawn again when the list, the ship or where it is change, not on every move of the chart, so a drag or a pinch redraws the chart alone.
- A browser smoke run (`lab/navchart/smoke.mjs`, not committed) passed after the review fixes: the ship in the middle, the readout, the Curve one named button with none of its places on the chart, the keys, a minus typed in the search, a drag, `0`, a Shift-drag, Look straight down, a drag from a name picking nothing, the Home system chip with all six stations, the way out, the wheel, the ship two sectors out, the Curve still one button zoomed out from there, and a click on it opening the Curve's chart with its 13 places. `navmap-check.mjs` after the same fixes: desktop 10 ok and the same five Citadel failures as on `main` (`lab/navmap/before.log`); phone all six ok; no page errors, the fonts served (a dev server allowed the main checkout's `node_modules`).

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
- The phone's circle (`--chart`) is `min(100%, calc(50svh − 3.25rem))`: today's rule is 50svh (the plan's 42svh isn't in the code), and the chart and its bar together are as tall as the chart was.
- Moons keep the worlds' bigger dot (`data-kind='moon'` joins the world dot's rule).
- `placeMarks`' `avoid` takes boxes (`{ x0, y0, x1, y1 }`, frame units) beside points, and `declutter`'s `hard` takes them in px. The plan has points only.
- A name starts 14 px past its dot's middle: the plan's `labelSize` (+22, the 16 px dot and a 6 px gap) is the box, and the stylesheet now draws to it.
- The ruler takes the names' size as `NAME_REM` of the root's font, not from the first `.navmap-name` (the plan's words): the first could be a region's, at 0.6rem.
- The plan's line numbers for `NavMap.jsx` and `navmap.css` (`UNDER`, the phone's wonder-name rule) are not in today's code. The names were laid out by `chartLabels.js`, which this replaces.
- `marks.js` exports `FOLD` and `foldMarks(view, marks, frame, { scale, keep })`, and a `Mark` may carry `firm` (its name is never left off for another place's dot, as the pick's isn't, but it is drawn only where it would be anyway). The plan has neither: its chart drew the Curve's places wherever they fell.
- `declutter.js`'s `firstInside` takes `hard`: a `spare` side keeps off the ship and the way out where it can.
- `place.js` exports `nameRuler(g, font)`, the ruler `NavChart` had inline, so a test can count its calls.

### Left

- A name left off for the way out shows on a hover on a side clear of it where it has one, and under the button where it has none.
- A pick that the way out or the ship blocks on every side has no side of its own (`data-quiet`), but `li[data-pick]` shows its name all the time, on glass over the rest, as `main`'s map did. Its spare side is then the first inside the circle, which runs under the button or over the ship. (Task 5's note says such a pick's name shows on a hover or a focus: the stylesheet shows it always.) Hiding a quiet pick's name till a hover would keep both clear, at the cost of the pick going unnamed on the chart; it is the owner's call in Task 10.
- With the Curve folded, a place there lit from the list (`hover`) has nothing on the chart to light; the Curve's button could light instead.
- On a phone (820 px wide or less) the readout isn't held to two lines. Beside the tools it wraps to three lines at 390 wide (60 px) and four at 360 (77 px). That is taller than the 44 px `--chart` takes off for the bar, and the side panel under the chart gives way (143 px of it left at 360×640). `navmap-check.mjs`'s phone run still finds the chart and the panel all on the screen.
- Task 10's landscape step (Review Focus 5) is where the real scene checks the fit. It should check at 844×390 with touch and at 1280×500 with a mouse that `.navmap-bar` is inside `.navmap-frame` and `.navmap-stage` inside `.navmap-body`. The stand-in measured both here; the real scene hasn't been measured at either size.
- `chartLabels.js` and its test have no other importer now (and `navmap-check.mjs`'s `namesClash` comment still names it). `nav.js`'s `chartAt`, `chartRadius`, `chartHeading` and `onChart` are used only by `nav.js` and `nav.test.js`. `nav.js` is not this lane's to edit; both are for a later clean-up.
- At the opening zoom (120,000 round the ship), the chart names fewer places than `main`'s whole-universe chart did (20 of the 27 it draws in the smoke run, with the Curve folded). The rest show on a hover. `labelSize`'s 24 px box height, against 18 px names, is the knob if Task 10's owner look wants more.
- `universe-war-check.mjs cruiser low` ran on the lane after the third review's fixes. The front, the battle's start, the seven war sectors on the map and "no page errors" pass. Three steps fail:
  - Two are the battle's, not the map's: under software GL the battle wasn't over within the check's 300 s wait after the reactor was hit.
  - The third, "the nav map's front button sends the autopilot there", fails on `main` too. With the jump ready (a fresh profile's drive: "Jump to the front"), `scene.js`'s `travel` sets `state.jump`, not `state.auto`. The check reads only `state.auto`.
  - A probe of that one step (the ship 1,200 from the front, the map open, not committed) ran on both. It found the front's button drawn, enabled and under nothing on both, and its click closed the map on both. On the lane, `state.jump.id` was then `front`, with no page errors.
  - The whole check on `main` didn't get that far: under the other runs' load the war hadn't loaded when the check asked for the front.
  - Task 10's step 7 runs it again; the check's last step should read `state.jump` too. `sector-check.mjs` wasn't run here; `marks.test.js` pins the Curve's chip.

## Task 9: the mini-map on the same projection and data

What the rebuilt `src/components/universe/MiniMap.jsx` and `FlatMap.jsx` do now, where they differ from the lane plan.

### Landed

- `MiniMap({ selected, onSelect, linkTo, kind, className, ship = null, view, boxRef, handlers, onKeyDown, onListKey, children })` draws the nav map's chart in its 600 × 300 box (`FRAMES.mini`). Its marks are `HAND_MARKS`' pickable ones and the sun, or with `kind="fandom"` (Home's teaser) the fandom worlds and the sun. Its view is `miniView` of them, through `placeMarks` and `placeShip`. Each place has an `li[data-id][data-kind][data-side][data-quiet]`, its style `left` then `top` in % of the box. A place's name is its universe's own label where it has one ("Marvel"), else `nav.js`'s, and every button or link has it as its `aria-label`, its name shown or not.
- The whole 3D-off map now has all 44 places: the six stations, the 13 worlds, the Curve's ten moons and the 15 wonders. Its orbit rings are gone; the sun and the belt (a `ringOn` ring) stay. Each place stands on a stem from the disc (`.minimap-stem[data-dir]`, the nav map's blue, dashed down). The ship, when given one, is `g.minimap-ship[data-edge]`, pinned to the box.
- `FlatMap({ selected, startAt, onSelect })` (`FlatMap.jsx`, the 3D-off map `UniverseMap.jsx` draws) gives the mini-map `useChartView(box, { open, frame: FRAMES.mini, orbit: false })`: a drag pans (a drag from a name picks nothing), the wheel and a pinch zoom, and `+`, `−` and `0` zoom or show it all again with the focus anywhere inside it. Its `ChartTools` row (zoom in, zoom out, show everything, `buttonClass="chip"`) is under the box, 36 px, 44 px on a coarse pointer. The root has `data-level` (and `data-live` on the 3D-off map). `MiniMap.jsx` only draws, so Home's teaser loads none of the hands, keys or tools.
- The arrows step through the places on the chart with `ringStep` (`FlatMap`'s `onListKey`, given the ids on the chart), so they reach the wonders and moons too.
- `MiniMap.test.jsx` (8 tests, 11 after the review, 17 after the second): the plan's four, and every place's name for a screen reader with the pick named, names under or beside their dots and never meeting, stems up and down, and the tools; then the stacking, the clip's id and `FlatMap`.
- Checked in Chromium on the lane's dev server (`lab/minimap9/check.mjs`, not committed): the 3D-off map at 1280 × 800 has all 44 places, no orbit rings and 19 names showing, none meeting; `+` zooms without picking, six reach the system level and `0` shows it all again; an arrow picks the next place and keeps the focus on it; a wonder clicked is pressed and the panel shows it, and the arrow goes on to the next wonder; a drag from a name picks nothing and moves the middle 120 px with the hand; the wheel zooms and "Show everything" puts it back; a quiet name shows on a hover. At 390 × 844 the map and its tools are on the screen. The teaser has the 13 worlds, every name showing, none meeting, each a link. No page errors.
- Home's lazy section grows from 24.70 kB to 55.22 kB (gzip 10.71 to 24.80): the evidence README has the table.
- After the review, a place's button stacks by its priority's tier (`--z` on its `li`, the list `isolation: isolate`), not by its place in the list, and a hover or a focus lifts it over them all (`--top` on the list). Before, a later wonder's or moon's 44 px button lay over an earlier world's dot: at 1280 × 800 a click on the Rick and Morty planet picked the portal, and at 390 × 844 nine worlds' dots were under a wonder's button. `MiniMap.test.jsx` checks every pair whose 44 px squares meet at 876 and 342 px, and a browser check (`lab/minimap9/fix.mjs`, not committed) found no dot under a lesser place's button at either size on the fix, and those on the commit before it.
- The place with the keys' focus is kept on the chart, as the pick is (`keep`), so a zoom or a drag never takes its button away and drops the focus to the page. `MiniMap.focus.test.jsx` runs the map by hand under a mocked React. In Chromium, with the focus on Harry Potter and `+` pressed to the system level, the focus stays on it, pinned to the box's edge, and `0` still works.
- The belt's clip has its own id on each map (`useId`), "Show everything" says its key in its title ("Show everything (0)": `ChartTools`' `fitKey`), and `UniverseMap.jsx` draws the 3D-off map through `FlatMap`, whose test pins a wonder from the link pressed and first in the focus group.
- After the second review, nothing lifts a place's button. The hover and focus lift of the first review raised the whole item, so a lesser place's button went back over the world's dot beside it: a pointer that crossed The Veil's on its way to The Office's dot, or The Veil with the focus, picked The Veil. Now the button is the 44 px round its dot (`left` and `top` −22 px, no `translate`), its tier on its `::before` (`z-index: var(--z)`), and the item and the button make no stack of their own. The name is in the button, so a click on it picks the place, but absolutely placed beside or under the round with `z-index: 0`, under every button. A hover on the round, or `:focus-visible`, lifts the name alone (`--top`) with `pointer-events: none`; a pointer on the name itself doesn't lift it, so the hover never flickers. `MiniMap.test.jsx` reads `universe.css` for it, and `navmap-check.mjs`'s `minimap` mode hovers The Veil, moves onto The Office's dot and clicks: it picks The Office (it picked The Veil on `d04e23c3`).
- Only the keys' focus is kept (`onFocus` reads `:focus-visible`). A press of the mouse focuses a button too, and a drag from Marvel's name zoomed in left Marvel pinned to the box's edge, named, until a blur. In Chromium after the fix the same drag takes Marvel off.
- The belt is as wide as the belt is where it's nearest the chart's focus (`reachOn` at the belt's point toward the focus, the same as before with the focus on the sun), not at `[mid, 0, 0]`: with the focus on the belt on the far side of the sun from there, it was under a fifth of the width near the focus (the test's view).
- `declutter` takes a `rank` on a label and a dot, and `placeMarks` a `ranked` option (each named mark's priority; the sun has none). Once every name clear of the dots is down, a ranked label still with no side may lie over a lesser rank's dot, never its equal's, a higher one's or the sun's, and never over a name already down. The mini-map passes it, since its names lie under every button. The phone's 3D-off map names four places at its opening zoom (The Office, Gaming, Travel, The Citadel; none before), the server's 600 px box 13 (11 before), and the desktop's 876 px box the same 19 as before. `navmap-check.mjs`'s phone shot checks that it names one. The nav map passes no ranks, so its names are as they were.
- Home's lazy section is 48.54 kB (gzip 21.73 kB) in 7 files, from 55.73 kB (gzip 25.02 kB) in 9 at `d04e23c3`: the evidence README's table.
- `navmap-check.mjs`'s `minimap` mode also shoots the flat map on a phone (`18-phone-minimap-flat`, 390 × 844). Its before shot from `main` is in the evidence, with what the phone names now.

### Deviations from the plan

- A name goes under its dot, or right or left of it (`sides: ['under', 'right', 'left']`), not under alone. Under alone named 7 of the 44 places in the map's 876 px box at 1280 × 800 (4 of the 13 worlds: a wonder's dot sits beside nearly every world) and 3 at the server's 600 px. With the two sides it names 19 there (12 of the 13 worlds). `universe.css` places a name beside its dot by `data-side`, past the dot's edge (`--dot`, its radius in px), and `measure` makes the box that much longer.
- `placeMarks` is given the box's px a unit (`scale`) and its names' size (`fontPx`), measured on a resize, the names' width in the mono face (`measure`) and the ship to keep off (`avoid`). The plan's call had none, so the names would have been thinned for a 600 px box at any size.
- The list is named `CHART_WORDS.places` ("Places"), new in the glossary, not "Universes": it has the wonders and moons now.
- `UniverseMap.jsx` passes `selected ?? startAt`. The page's `selected` is a universe's or a moon's id only; a wonder's is `startAt` (its link's). Without it a wonder picked on the flat map was never pressed, and the arrows went on from the first place.
- `ringStep` steps over the places on the chart (after a zoom, those in range and the pick), not every shown id, so the focus never goes to a place with no button.
- The build was measured with `npx vite build`, not `npm run build`, whose `prebuild` fetches GitHub.
- `ChartTools` takes `fitKey`, the key in "Show everything"'s title on a map with no ship tool. The plan's tools put a key on the ship's only.
- `FlatMap.jsx` holds `FlatMap({ selected, startAt, onSelect })`, the 3D-off map `UniverseMap.jsx` draws, with the hook, the keys and the tools, and `MiniMap.jsx` takes the view, the box's ref, the handlers and the keys from it. The plan had one `MiniMap` with `interactive`. A test can pin `selected ?? startAt` without loading the scene (importing `UniverseMap.jsx` takes about 5 s). `FlatMap` opens on the same marks' `miniView` as `MiniMap` draws, and a test holds them to each other.
- A place's name is not a box the button grows round: the button is the 44 px round alone, the name placed out from it, so a long name's box no longer takes a 44 px band beside the dot. The plan's labels hung under their dots in the button, as `main`'s did.

### Left

- On a phone (390 × 844) the whole 3D-off map names four places at its opening zoom, not all 13 worlds as `main` did (some over others there). With every dot let go, the names' own boxes (24 px tall, the nav map's) leave room for seven in the 342 px box. A name shows on a tap (the pick), a hover or zoomed in. The teaser on a phone hid its names before, and still does. A box nearer the names' own height (about 11 px of letters) is the knob if Task 10's look at the phone wants more.
- At 390 × 844 two worlds' 44 px rounds can cover each other's dots (Star Wars' dot is under Gaming's round, Marvel's under Harry Potter's). Of two the same tier, the later in the list is on top. A click on Star Wars' dot there picks Gaming; zoomed in, they part.
- A quiet name shown by a hover on its round hides again once the pointer moves off the round on to it: lifted, a click goes through it, so the pointer is on whatever is under it. A name always shown drops back under the buttons when the pointer is on it, and a click there picks its place. That is the price of lifting no button.
- The Curve's thirteen places sit in one clump at the top of the whole 3D-off map, about 30 px across at 1280 × 800, and a click there picks the one on top. The nav map folds them into one mark (`marks.js`'s `foldMarks`); the mini-map doesn't. Zooming in, a drag or the arrows reach each one.
- `declutter` keeps a name off another place's dot as the nav map's 16 px dot, and the mini-map's world dots are 35 px across at 1280 × 800 (12 of the box's units, 1.46 px a unit). There one name, Rick and Morty's, runs into The Lord of the Rings' dot. A world can also lose its name to a lesser place's dot while that place is named: Pirates of the Caribbean is unnamed and The Maw is named. The fix is for a later task: `declutter` takes each dot's radius (`dots: [{ x, y, r }]`), `MiniMap` passes `dot(id) × scale`, and `MiniMap.test.jsx`'s "never one over another" checks the names against the other places' dots too (today it checks names against names, at the server's scale).
- A name under its dot crosses the dot's foot, as before.
- Task 10's mini-map step ("`+` with the focus inside it changes its `data-level`"): from the opening range (73,202) one `+` is still the neighbourhood. It takes six. The check should press until it changes, at most six times.
- The `ship` prop isn't given to the hook, as the plan has it, so `0` goes back to the whole map and the stems are measured from the disc. When lane 4c passes a ship, giving it to `useChartView` as well would measure the stems from the ship's height, and `0` would re-centre on it.

## Task 10: `navmap-check` fixed and extended; the phone layout; the after shots

What `scripts/navmap-check.mjs` and the new `scripts/lib/navmap.mjs` check now, and what the after shots show. The evidence README (`docs/superpowers/evidence/endless-universe-6a-map/README.md`) has the shots side by side and every check's output.

### Landed

- `scripts/lib/navmap.mjs`, tested beside (`navmap.test.mjs`): `shipOnChart(page, { timeout }) → { drawn, inside, edge, readout }`, for lane 2's `universe-endless-check.mjs` to call after each of its steps. It presses M if the map is shut, waits for `.navmap-ship` on the screen, says whether its centre is inside `.navmap-chart`'s circle (+2 px) and whether it's pinned to the rim (`data-edge`), reads `.navmap-readout`, and shuts the map with Escape if it opened it. On a phone's list, where the chart is hidden, the marker reads as not drawn. Beside it, the check's own sums, worked out there and not read from the site so the check says what the chart should show: `shipSector`, `sectorWords` (“Sector 2, 0, −1 · ”), `levelOnOpen`, `jumpGoal`, `meet`, `within`, `insideCircle`, and `SECTOR`, `CURVE_EDGE`, `JUMP_GOALS`, `NEAR`.
- The jump goes to Ember, or Halcyon if the ship starts by Ember, read by name from `__universeDebug.wonders`, and the ship is there within its reach and 600. No coordinates are left in the check (the plan's grep finds none). The Citadel's five failures on `main` pass.
- The desktop chart steps: the ship in the chart's middle on open (0 px off), the level its sector opens on, the readout's sector; a Shift-drag tilting it and Look straight down; the wheel to a system (7 turns); a minus typed in the search that doesn't zoom; − back to the neighbourhood (1 press); a drag from a place's name that moves the ship with the hand (0 px off) and picks nothing; Back to the ship; and the map at 1280 × 500.
- The far mode: the ship two sectors out is on the chart, inside its circle, its readout “Sector 2, 0, 0 · …”; dragged 400 px off, it's pinned to the rim, still inside (`16-far-ship-pinned`).
- The phone mode, at 390 × 844 with the `(pointer: coarse)` rules turned on: the tools 44 × 44, inside the frame, clear of each other and of the readout; the readout shown; the side panel scrolling; a wonder's name with no room (Aurelia) hidden, then shown once picked from the list; zoom in by taps (7 to a system, `14-phone-zoomed`); and sideways at 844 × 390, the frame, the chart, the bar and the side panel's top on the screen (`17-phone-sideways`). It prints, not checks, how many of the chart's places are named.
- The minimap mode: the flat map has Aurelia, The Veil and Squanch and no `.minimap-orbit`; `+` with the focus in it zooms it a level (6 presses); Home's teaser has worlds only.
- The after shots, in `after/` beside `before/`, and the README's sections on them, the checks, the phone layout, the checks that read the nav map and the scene.
- The checks that read the nav map, run on the lane and, where a step failed, on `main`: the nav map's own steps pass on both (`sector-check`'s Curve chart, `universe-war-check`'s seven war sectors, `wonders-check`'s list and go button to Ember and Halcyon; `links-check` stops before its nav map steps on both, at the map button), and every step that fails on the lane fails on `main` too, but `universe-war-check`'s phase 2, a fixed 3 s wait for a battle step through files the lane doesn't change (it passed once on `main`, failed twice on the lane). The README's table has each.

### Deviations from the plan

- The Shift-drag comes first, at the zoom the map opens on, and is 240 px. After the wheel step the chart is at the neighbourhood's near end with two places on it, and a 120 px tilt (15°) didn't show in the shot.
- The minus is typed into the search at the system level the wheel left, before the − presses. In the plan's order it was typed at the neighbourhood, where one − stays in the neighbourhood, so the step couldn't fail. Here a − pressed outside the field, next, changes the level.
- The jump's wait is on its conditions, not 80 polls: the ship now comes round to face the wonder before it jumps (`state.jump.phase` `align`), and the site's jump is a chunk loaded when first asked for. In software GL the old wait ended before either. It now waits (six minutes at most) for the ship there and the jump seen, then for the jump to be gone, so the shots after it are of the map.
- The jump's timing reads the first finite `jump.at` (it's `Infinity` while the ship comes round, and the old `!== null` let the check pass on minus infinity) and each frame's `requestAnimationFrame` timestamp, not `performance.now()` in the log's callback: a software frame takes seconds to draw, and the log's time was past the flash in a frame the scene had stepped before it.
- “A wonder's name hidden until it's picked”: no phone rule hides the wonders' names any more (`main`'s went with `chartLabels.js`). The check takes a wonder whose name has no room on the phone's chart, picks it from the list, and checks its name shows.
- Zoom in is tapped, `+` pressed and the wheel turned until the level changes (at most 10, 8 and 12), not once.
- A 1280 × 500 fit check is added to the desktop mode, as Task 8's “Left” asked.
- `levelOnOpen` reads the Citadel's place from `__universeDebug.wonders` and the Curve's edge (`CURVE_EDGE`, 6000) from `layout.js`'s number, written in the lib.
- Step 7's `wonders-check` and `links-check` ask for `--use-gl=swiftshader`, which this Chromium doesn't have: as their headers have them the scene never starts, on the lane or `main`. They were run again through a wrapper round the browser that swaps it for ANGLE's SwiftShader (`lab/`, not committed), and `wonders-check` with three wonders (Ember, Halcyon, The Maw), not all fifteen. `main`'s runs of the checks that ask for port 5173 ran from copies with the port changed.

### Left

- From 7 of the 32 starts, the cruise to Avengers HQ is past `tripTime`'s 150 s and reads “—”, so `navmap-check`'s “a trip time for every drive” fails by the start, on `main` too (`nav.js` and `ship.js` are unchanged). The after-shots run started at Dot Matrix (the Gaming world) and failed it. Lane 6b's formula for long trips mends it.
- The phone's chart names few places: 5 to 8 of 27 in the runs, against 17 on `main`'s phone chart with Earth picked. On the stand-in, from the home system's edge: 5 at 390 × 844, 10 at 820 wide, 22 at 1440. The names keep off every other dot in a 24 px box; more on a phone is the owner's call (`labelSize`'s box, Task 8's “Left”).
- At 844 × 390 the map is the desktop's two columns: the chart is 165 px across, and the way out covers a good part of it on the Home system's chart. All of it is on the screen.
- At the system level on a phone (`14-phone-zoomed`) the six stations sit together with no names.
- `universe-endless-check.mjs` isn't on this branch (lane 2's): calling `shipOnChart` from it is Task 11's.
- Home's “Find me online” asks GitHub's API, which refused this container (403, rate limit) in two runs: a page error that's the network's.
- Checks that wait a fixed time for something software GL does slowly, on `main` as on the lane: `links-check` clicks the map button 2 s after the scene starts (it comes once the shaders are in); `universe-war-check` reads the front 2.5 s after the scene starts (twice it hadn't loaded) and the battle's phase 3 s after the generators are hit; `sector-check`'s flights through the portal. `wonders-check` and `links-check` ask for `--use-gl=swiftshader`. `universe-war-check`'s front button step reads `state.auto` where the jump sets `state.jump` (Task 8's note). `wonders-check`'s The Maw parks at the edge of its pull, past the check's reach and 80.
- `scripts/lib/guest-clips.test.mjs`'s Rick test failed once in a run of all of `scripts/lib` while a browser check ran beside it, and passed alone (43 of 43).

## Task 11: the gates, the hand-off and the PR

The lane's last task. The coordinator merges every lane into one branch and opens one pull request, so this task brings no `main` in and opens no PR. It runs the gates on the lane, writes below what `HANDOFF-universe.md` should say, and sets down what the PR's body needs.

### For `HANDOFF-universe.md`, “Landed”

In **The nav map and the drives**, two sentences change: the chips are the chart's presets now, and `chartLabels.js` no longer lays out the chart's names.

- “Two charts plus the sector’s, filter chips, search, …” becomes “The chart’s three presets (Universe, Home system, the Curve), filter chips, search, …”.
- “The chart’s names are laid out by `chartLabels.js` (pure, tested): each on the first clear side of its dot, inside the circle, or left off till it’s hovered, picked or lit from the list.” becomes “The chart is the shared one, below.”

A new bullet after it:

- **The chart.** One pure projection, drawn by the nav map and the 3D-off map alike, in `src/components/universe/chart/`. `projection.js` centres it on a focus, the ship by default, on the 0.375-power scale re-centred there. It zooms from a system (a range of 300) out to the universe (3,000,000), pans, and tilts and turns into 3D, every mark on a stem from the plane at the focus’s height. Its levels go by range: a system under 8,000, the neighbourhood under 250,000, the universe past it. `declutter.js` thins the names by priority, none over another name or a dot. `place.js` puts the marks on a frame: a pick always named, the ship always on it, pinned to the rim when it’s off. `marks.js` reads the marks from `nav.js`’s places and `where()`’s pilots and far fights, and folds the Curve into one mark where it’s small. `input.js` turns the keys, the wheel, a drag, a Shift-drag and two fingers into changes of view; `useChartView.js` holds the view; `NavChart.jsx` and `ChartTools.jsx` draw it. The bar under the chart says the ship’s sector and height (“Sector 2, 0, 0 · 3,800 ship-lengths above the disc”), beside Zoom in, Zoom out, Back to the ship and Look straight down. `NavMap.jsx` keeps its header, filters and side panel and draws its chart through `NavChart` (442 lines, from 667). `FlatMap.jsx` (the 3D-off map) and `MiniMap.jsx` (it and Home’s teaser) draw on the same marks, projection and placing, with the wonders and the moons and no orbit rings. The gesture reader is `src/lib/gesture.js`, shared with the galaxy map’s `useMapView.js`. `scripts/navmap-check.mjs` jumps to a wonder it picks by name, and checks the zoom, the pan, the tilt, the far ship and the phone; `scripts/lib/navmap.mjs`’s `shipOnChart(page)` is the ship’s-marker step for any other check. The evidence is `evidence/endless-universe-6a-map/`.

### For `HANDOFF-universe.md`, “Left”

Out:

- In **The checks that fail on `main`**, its last sentence: “`scripts/navmap-check.mjs` still jumps to the Citadel at its old place (1755, −4660); pick a main-sector wonder by name and read its position from `__universeDebug.wonders`.” The check picks Ember, or Halcyon, by name now, and the Citadel's five failing steps pass.
- The phone layout, “tightened in CSS and never seen in a browser”, the plan's other item, isn't in today's “Left”: it went with `ae0a9ecd2` (“a phone opens on the list”). It has been seen now, at 390 × 844 and turned sideways (the evidence README's “The phone layout”), so there's nothing to take out for it.

In, a new bullet:

- **The map, its second half** (lane 6b’s, and lane 4c’s for the mini-map’s ship).
  - `nav.js`’s `chartAt`, `chartRadius`, `chartHeading`, `onChart` and `viewFor` are used by no component now: only `nav.js`, `nav.test.js` and `chartLabels.test.js` use them. `chartLabels.js` has its test alone. Lane 6b, which owns `nav.js`, can retire them with their tests.
  - `where()`’s pilots and far fights carry no height, so they sit level with the ship (`marks.js`’s `liveMarks`). Lane 6b adds `y`.
  - The System level’s traffic, and the Neighbourhood and Universe levels’ generated places, events and visited systems, are lane 6b’s, fed in as `Mark`s through `marks.js`. The projection doesn’t change.
  - The mini-map’s `ship` prop waits for lane 4c’s saved position: with 3D off there is none today. When it comes, `FlatMap.jsx` gives it to `useChartView` too, so the stems are measured from the ship and `0` re-centres on it.
  - `scripts/universe-endless-check.mjs` (lane 2’s) isn’t on `main` (at `0e7a77f6`) or on lane 2’s branch yet. Its ship’s-marker step is left for it: after each of its steps, `shipOnChart(page)` from `scripts/lib/navmap.mjs`, asserting `drawn && inside`.
  - From 7 of `ship.js`’s 32 starts the cruise to Avengers HQ is past `tripTime`’s 150 s, so `navmap-check`’s “a trip time for every drive” reads “—” and fails, on `main` too. Lane 6b’s formula for long trips mends it.
  - The phone’s chart names few places at its opening zoom (5 to 8 of 27 in the runs, against 17 on `main`’s with Earth picked), and the 3D-off map on a phone names four. Each name keeps off every other place’s dot in a 24 px box. More names on a phone is the owner’s call (`labelSize`’s box).
  - A pinch turns and tilts by however far the fingers drift, with no dead zone, and a drag right turns the chart clockwise. Both want the owner’s hand on a real phone.
  - Checks that read the nav map and wait a fixed time for software GL fail on `main` as on the lane: `links-check`’s map button, `universe-war-check`’s front and its phase 2, `sector-check`’s flights through the portal. `wonders-check` and `links-check` ask for `--use-gl=swiftshader`, which today’s Chromium doesn’t have. `universe-war-check`’s front button step reads `state.auto`, where the jump sets `state.jump`.

The tasks' own “Left” lists above have the finer points.

### For the PR

- **Before and after:** the table in `docs/superpowers/evidence/endless-universe-6a-map/README.md` (“Before and after”): 15 shots, 11 of them from `main` at `cc5e2eaf`, 4 new.
- **The gates**, run on the lane at `eb946d0f` (Task 10's commit: this task adds only these notes):

  | Gate | Result |
  | --- | --- |
  | `npm run lint` | clean |
  | `npm test` | 1,963 files passed and 1 skipped; 21,404 tests passed and 8 skipped |
  | `npm run build` | built. Its `prebuild` had the profile and the repositories refused by GitHub's API (401) and kept them from the last snapshot; the fresh contributions it wrote to `public/github.json` were put back, not being the lane's |
  | `node scripts/health.mjs --check --skip build` | within budget, every metric as on `main`: `big-files` 22 (none of the lane's; `NavMap.jsx` 442 lines, the biggest new file `NavChart.jsx` 348), `kbd-styles` 68 |
  | `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe` | everything green: the nine core pages and `/universe` |
  | `navmap-check.mjs`, all four modes (Task 10's run, at `b5c1feb5`) | 50 of 51, no page errors; the one is the trip time from the start (above), on `main` too |

- **Home’s lazy section (`Interests`)**, built on Task 8’s commit (`5c76fb0b`, the mini-map as on `main`) and on the lane: the `Interests` chunk 7.41 kB (gzip 2.90 kB) both times; the `MiniMap` chunk 2.62 kB (gzip 1.30 kB) to 4.24 kB (gzip 2.16 kB); the whole section 24.70 kB (gzip 10.71 kB, 4 files) to 48.54 kB (gzip 21.73 kB, 7 files). The mini-map now reads `nav.js`, the marks, the projection and the placing; the teaser loads none of the hands, keys or tools.
- **The gesture reader:** `src/components/galaxy/gesture.js` moved to `src/lib/gesture.js` with its test (`git mv`). The galaxy map’s `useMapView.js` changed its import (and its comment) alone. It passes no modifier, so a drag there says `pan` as before, and its `apply` reads a pinch’s `zoom`, `u` and `w` and not the new `turn` and `tilt`.
  - `galaxy-map-check` can't say “all ok” in this container, on `main` or on the lane. Its `settle` is a fixed 550 ms after a key, a wheel or a press, and in software GL a zoom's easing takes longer, so it reads the zoom before. Two wheel notches land at 1.00, 1.50 or 2.26, run to run and size to size, and the names' checks after them pass or fail with where the zoom stopped.
  - Run alone, the lane first and then `main` (`cc5e2eaf`, from its own checkout, on the same server config), each made all its 456 checks. The lane: 406 ok, 50 FAIL. `main`: 400 ok, 56 FAIL. 45 of the FAILs are on both.
  - Each FAIL on one side alone is a zoom read straight after a key or the wheel (`-` zooms out a step, `0` shows the whole galaxy, two wheel notches, `+` twice in the 3D map), a name's place read after such a zoom, or Escape in the 3D map at 768 × 1024. The lane's five are of these kinds, and the zoom ones passed on the lane in another run.
  - The phone's whole-map names fail on both, in every run that reached them: Bespin's name meets Mustafar's and lies 5.5 to 6.1 px into Hoth's dot (the check allows 5), at 390, 375 and 360 wide.
  - The steps the gesture reader drives pass on both at every size, 25 ok on each: a drag from a system's dot pans and picks nothing, a long drag released over a system picks neither, and a double click's second press picks the system it lands on and starts no jump.
- **The scene:** `scene.js`, `ship.js`, `nav.js` and the generator are as on `main`, so the draw calls and triangles are as before.
