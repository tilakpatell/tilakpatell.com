# SDD ledger — plan: docs/superpowers/plans/2026-10-18-endless-universe-lane-6a-map.md

Branch: claude/endless-universe-lane-6a-map, from origin/main ddb364bf3.
Spec: docs/superpowers/specs/2026-10-18-endless-universe-design.md (section F, done-item 7) — reachable.
Chrome on this machine: C:/Users/tilak/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe (no system Chrome).

## Pre-flight scan

### Task pairs sharing a file or interface
| Pair | Produces → consumes | Found |
|---|---|---|
| T1 ↔ T10 | navmap-check.mjs: T1 adds BASE, `run(m)`, minimap/far modes; T10 extends the same modes + jump goal | consistent (T10 builds on T1's modes) |
| T2 → T7 | createGesture down(...opts.orbit), move → {orbit}/{zoom,u,w,turn,tilt} → useChartView/gestureStep | consistent; T7 test's two-finger message has exactly T2's fields |
| T3 → T5,T6,T7,T8,T9 | CHART, View, createView, project, unproject, zoomBy, panBy, orbitBy, flatten, recentre, track, levelOf, reachOn, ringsFor, FRAMES, toFrame | consistent; names used identically in every consumer's test |
| T4 → T5 | declutter(labels,{bounds,sides,dots}), SIDES, boxOf | consistent (placeMarks passes `sides`, dots incl. avoid) |
| T5 → T6 | `Mark` shape defined in T5, produced in T6 | consistent (fields match: id, kind, name, at, priority, color, levels, shape, reach, pickable) |
| T5 → T7 | reveal → useChartView.show | consistent |
| T5 → T8,T9 | placeMarks, placeShip, sectorGrid, ringOn, miniView, fitRange | consistent; T9 test compares mini vs NavChart li positions via the same miniView |
| T6 → T8,T9 | HAND_MARKS, markById, liveMarks, REGIONS, openView, presetView, presetOf | consistent; presetOf keeps sector-check:77 and navmap-check:161 |
| T7 → T8,T9 | CHART_WORDS, useChartView, ChartTools, chartKey, ringStep, ZOOM_STEP | consistent except CHART_WORDS.keys rendering (ruling R3) |
| T8 ↔ T9 | both edit src/lib/words.test.js FILES (T8 adds chart/*.jsx, T9 adds MiniMap); T9's test imports T8's NavChart | sequential, consistent |
| T8 → T10 | DOM: .navmap-chart[data-level][data-pitched], .navmap-ship[data-edge], .navmap-readout, .navmap-bar, .navmap-tools button, li[data-quiet] | consistent |
| T9 → T10 | .minimap root data-level, li[data-id], no .minimap-orbit, tools row | consistent |
| T10 → T11 | shipOnChart(page) in scripts/lib/navmap.mjs → universe-endless-check.mjs (lane 2) | consistent; T11 conditional on lane 2 having merged |

### Each task against itself
| Task | Found |
|---|---|
| T1 | Step 1 wants a second worktree serving main on 5173; this worktree is byte-identical to main until T2 and other lanes may hold 5173 (ruling R1) |
| T2 | tests vs interfaces agree (orbit [60/600,−30/600]; turn π/4; tilt 100/600); files moved = files committed |
| T3 | 11 tests, each checked by hand against the formulas: rim at 1, 0.1^0.375, zoom monotone, unproject inverse on the focus plane, stems sign, orbit round trip, panBy odd (project(moved, oldFocus).u = 0.1 exactly), far pins, levels table, reachOn, ringsFor(120000)=[1e4,1e5], ringsFor(5000)=[100,1000]. Hazard: −0 at the focus (toEqual/toMatchObject) — told to implementer |
| T4 | 4 tests hand-checked (pile, edge→left, dot→left, under-only → [under, null]) |
| T5 | 8 tests hand-checked (['near','high']; kept far pinned + named; high stem up; thin; nose −90/0/0; reveal station → 7200 & focus [300,0,0]; fitRange 2100; 9 sectors, corner radius) |
| T6 | 4 tests hand-checked. CHART_VIEWS.all.r = ship.js EDGE (54,000), which lane 2 may lift (ruling R2) |
| T7 | 6 tests hand-checked (wheel clamp ±60; panFrom 0.047·1000/470 = 0.1; ringStep table). CHART_WORDS.keys contains "0" and T8 renders `<kbd>0</kbd>` before it too: "0" twice (ruling R3) |
| T8 | Review Focus 1 says a double click counts as a pick; T7's handler list has only onClickCapture (ruling R4). NavMap stays < 800 lines |
| T9 | "With interactive, it goes through useChartView": a hook can't be conditional (ruling R5) |
| T10 | port/Chrome path per R1; all waits on conditions |
| T11 | PR + merge done by the controller, not an implementer (ruling R6) |

## Rulings
- Ruling: R1 — Task 1's before shots are taken from this worktree's own dev server while the branch holds no source change (src/ byte-identical to origin/main ddb364bf3), not from a second `../tp-6a-main` worktree; the lane's dev server uses port 5266 with `--strictPort` (5188, the plan's, is already held by another session) (5173 may be held by a parallel lane), and every check passes `BASE=http://localhost:5266` and `CHROME=C:/Users/tilak/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe` — same pixels, no second npm ci, no port fight — cost if wrong: before shots would have to be retaken from a main worktree (minutes).
- Ruling: R2 — presetView/openView clamp their range into CHART.range [300, 3,000,000] — CHART_VIEWS.all.r is ship.js's EDGE, which lane 2 ("no ceilings") may lift to Infinity; a clamp keeps the chart finite and today's 54,000 passes through unchanged so the plan's tests hold — cost if wrong: none visible (a no-op at today's numbers).
- Ruling: R3 — CHART_WORDS.keys becomes `{ zoom: 'zoom in and out', back: 'back to the ship' }` and the keys line renders `<kbd>+</kbd> <kbd>−</kbd> {zoom}, <kbd>0</kbd> {back}` — the plan's string plus a `<kbd>0</kbd>` in front of it would print "0" twice ("+ − 0 zoom in and out, 0 back to the ship") — cost if wrong: a one-line word change.
- Ruling: R4 — useChartView's handlers also carry `onDoubleClickCapture`, swallowing a dblclick when either of its clicks was swallowed as a drag's end (a short window after the swallow) — Review Focus 1 says a double click counts too, and onClickCapture alone can't stop the place button's onDoubleClick — cost if wrong: one extra handler; a real double click on a name still goes.
- Ruling: R5 — MiniMap always calls useChartView (hooks can't be conditional); `interactive` gates the pointer handlers, the wheel, the keys and the tools row; non-interactive MiniMap draws at `miniView(shown)` exactly — the plan's intent, in React's rules — cost if wrong: none.
- Ruling: R6 — Task 11's PR, CI watch and merge are run by the controller (the brief's PR rules), the implementer does Steps 1–3 and the hand-off commit — PRs are a side effect outside the worktree that the brief puts on the controller — cost if wrong: none.

## Progress
Task 1: dispatched (base ddb364b, implementer ac391ab21bdf3445b, sonnet)
Task 1: implementer DONE a566da5bf; review dispatched (a0a91385e31025424, sonnet)
Task 1: review — spec ❌ (1 Important: README:69 says the far shot's panel reads "No ship"; the picture reads "Your ship · 820,500 ship-lengths from The Twins"). Fix round 1 queued until Task 2's implementer finishes (same worktree, avoid concurrent commits). Fold in the Minor straight apostrophes (README:29,36,47) since it's the same file.
Task 1: minor (deferred): navmap-check.mjs teaser loop scrolls from inside the waitForFunction predicate and doesn't await the hash change first
Task 1: minor (deferred): navmap-check.mjs minimap mode's `check(true, …)` is vacuous (failures only show as thrown timeouts)
Task 1: minor (deferred): open()'s pre-existing waitForTimeout(2000) could go now that it waits on .universe-navmap-btn
Task 2: dispatched (base a566da5bf, implementer a0566d6cecec2b590, sonnet)
Controller: CPU-quiet rule (D:/Custom BFEngine/.locks/cpu-quiet) sent to Task 2's implementer; every later dispatch that runs a browser check, full npm test or build carries it.
Task 2: implementer DONE_WITH_CONCERNS 5cd99a349 (gesture 11/11; galaxy-map-check can't get WebGL under its swiftshader flags here; a scratch run with --use-angle=d3d11 gave 9 label-placement FAILs, every wheel/drag/pinch/key check ok)
Ruling: R7 — Task 2's galaxy-map-check step is accepted on the scratch run's evidence: every wheel, drag, drag-from-a-name and key check passed; the 9 FAILs are label/dot placement (galaxy labelPlace.js), which imports nothing from gesture.js and is untouched by this diff, so they are this machine's fonts/GL, not the move — cost if wrong: a galaxy label regression would go unseen until CI or a later galaxy check (the diff can't reach that code, so the risk is near nil).
Task 1: fix round 1/5 implemented 8cd64c732 (README caption + apostrophes); re-review dispatched (a40f7956c52ebb4b6, haiku)
Task 2: review — spec ✅, quality Approved
Task 2: minor (deferred): gesture.js up() 2→1 re-press drops `orbit` (a modifier drag that gains and loses a second finger then pans)
Task 2: minor (deferred): gesture.test.js lacks ±π wrap / anticlockwise turn / per-move re-seed / 3→2 re-seed / orbit reset by next plain press tests
Task 2: minor (deferred): useMapView.js header line now over the file's width
Task 2: minor (deferred): gesture.js tilt divides by the move's rect.height while seed used the down rect's (same box in practice)
Task 2: complete (commits a566da5bf..5cd99a349, review clean)
Task 1: fix round 1/5 (2 addressed, 0 open — README far-shot caption; curly apostrophes; commits 5cd99a3..8cd64c7)
Task 1: minor (deferred): evidence README:50 says "250,000 out" without saying from where (x = 250,000 from the home sun)
Task 1: complete (commits ddb364b..8cd64c7 [a566da5, 8cd64c7], review clean after fix round 1)
Task 3: dispatched (base 8cd64c732, implementer aaf755de9bfc0d2bf, sonnet)
Task 3: implementer DONE 4e268719c (11/11, lint clean); review dispatched (a15f417f480f9c559, sonnet)
Task 4: dispatched (base 4e268719c, implementer a4969115ad166cbf9, sonnet)
Task 3: review — spec ✅, quality Approved
Task 3: minor (deferred): projection.js unproject/panBy give NaN for ±Infinity u,v (NaN is safe); Task 7 must pass finite deltas
Task 3: minor (deferred): projection.js recentre/track copy ship x/y/z unchecked (a NaN ship → NaN focus); createView sanitises, these don't
Task 3: minor (deferred): projection.js toFrame maps an infinite u/v to the centre (num(Infinity)=0) instead of the rim; only reachable past ~1e300
Task 3: minor (deferred): projection.js project with an infinite `at` gives NaN (callers pass finite positions)
Task 3: complete (commits 8cd64c7..4e26871, review clean)
Task 4: implementer DONE 727ef46a9 (4/4; eslint on its files clean)
Task 4: review — spec ✅, quality Approved
Task 4: minor (deferred): declutter.js:53 a NaN priority makes the comparator inconsistent
Task 4: minor (deferred): declutter.js:63 duplicate ids overwrite each other in the Map (callers must pass unique ids; undocumented)
Task 4: minor (deferred): declutter.test.js doesn't pin Infinity priority, order independence or the own-dot exclusion
Task 4: complete (commits 4e26871..727ef46, review clean)
Task 5: dispatched (base 727ef46a9, implementer ad905d5bdaa873bc7, sonnet)
Task 5: implementer DONE e69e30db6 (8/8; chart folder 23/23; removed one unused `project` import from the brief's test for lint); review dispatched (a52a2f6b3c8c775e2, sonnet)
Task 6: dispatched (base e69e30db6, implementer acd6261f90c8ff025, sonnet)
Task 5: review — spec ✅, quality Approved
Task 5: minor (deferred): place.js header should say `avoid` points are frame units (scaled to px inside)
Task 5: minor (deferred): place.js fitRange returns NaN (unclamped) if a mark's `at` is non-finite
Task 5: minor (deferred): place.js ringOn with n = 0 gives NaN (unreachable with the default)
Task 5: minor (deferred): place.js placeShip guards heading but not x/y/z (relies on project's NaN safety)
Task 5: complete (commits 727ef46..e69e30d, review clean)
Task 6: implementer DONE 88bd61362 (chart + nav.test 60/60; chart:sun priority 80, unlabelled; 3 extra tests)
Task 6: review dispatched (ab7ac906f55beba37, sonnet)
Task 7: dispatched (base 88bd61362, implementer a7d9601f658f49eae, sonnet; carries R3, R4)
Task 6: review — spec ✅, quality Needs fixes (1 Important: R2 clamp not pinned — the added test passes with the clamp deleted). Fix round 1 queued until Task 7's implementer finishes.
Task 6: minor (deferred): marks.js `within` duplicates createView's clampRange (NaN branch dead)
Task 6: minor (fold into fix round 1): marks.js shared ALL/NEAR level arrays not frozen; fight name `f.label ?? ''`
Task 7: implementer DONE_WITH_CONCERNS 0a41aede8 (chart + words 114/114; R3, R4 in; yaw snapped to 1e-12 in gestureStep to beat projection.wrap's float noise; pan anchor from a viewRef)
Task 6: fix round 1 dispatched (resumed acd6261f90c8ff025; FIX_BASE 0a41aede8 — Task 7's commit sits on top of Task 6's reviewed head 88bd613)
Task 7: review dispatched (a94737d2aa42f74db, sonnet)
Task 7: review — spec ✅, quality Needs fixes (1 Important: a pan's non-functional setView from the anchor overwrites a mid-drag wheel zoom and the ship-y track). Fix round 1 queued until Task 6's fix finishes.
Task 7: minor (fold into fix round 1): pan.current cleared on every onPointerDown; KEYS lookup via Map/hasOwn
Task 7: minor (deferred): yaw snapped to 1e-12 in gestureStep to beat projection.wrap's float noise (cleaner: wrap returns its input when already in range)
Task 7: minor (deferred): a real double click within 600 ms of a drag's swallowed click is swallowed too (R4's window; accepted)
Task 7: minor (deferred): ChartTools.test.jsx doesn't check titles with keys, idle clicks, or no-onShip rendering
Task 7: minor (deferred → Task 8): ChartTools role="group" has no aria-label (brief-verbatim)
Task 7: ⚠️ for Task 8/9: the wheel listener attaches once on [boxRef]: the box must be mounted with the hook (true for NavMap/MiniMap, which render it unconditionally) — check in Task 8/9; touch-action: none comes in Task 8's CSS
Task 6: fix round 1 implemented 7d41354ec (marks.edge.test.js mocks ../nav with all.r = Infinity; fails with the clamp removed; `within` kept: createView maps Infinity to the opening range, not the max); re-review dispatched (ac62da366e5495c57, haiku)
Task 7: fix round 1 dispatched (resumed a7d9601f658f49eae; FIX_BASE 7d41354ec)
Task 6: fix round 1/5 (3 addressed, 1 open — openView in the Curve not pinned for the clamp; commits 0a41aed..7d41354)
Task 6: fix round 2 dispatched (resumed acd6261f90c8ff025; FIX_BASE 87c00e9b1)
Task 7: fix round 1 implemented 87c00e9b1 (pan lays x/z on the latest view; wheel re-anchors; pointerdown clears; keys by Map); re-review dispatched (a1780fbc27d770860, sonnet)
Task 7: fix round 1/5 (4 addressed, 0 open — pan merge onto latest view; pointerdown clears; keys Map; wheel re-anchor; commits 7d41354..87c00e9)
Task 7: minor (deferred): useChartView wheel re-anchor reads viewRef.current (last render): two wheels before a render could drop a few pan steps
Task 7: minor (deferred): hook-level merge/re-anchor untested (Task 10's browser steps are the net)
Task 7: minor (deferred): a button/key zoom mid-drag isn't re-anchored (one-time focus jump; no range/y revert)
Task 7: complete (commits 88bd613..87c00e9 [0a41aed, 87c00e9], review clean after fix round 1)
Task 6: fix round 2/5 (2 addressed, 0 open — Curve opening clamp pinned with an Infinity mock; label-less fight pinned; commits 87c00e9..22fc203)
Task 6: minor (deferred): nav.test.js "across the sectors" (~35 s) timed out once under machine load; passed 30/30 alone (watch for flake)
Task 6: complete (commits e69e30d..22fc203 [88bd613, 7d41354, 22fc203], review clean after fix round 2)
Task 8: dispatched (base 22fc20358, implementer aee4db47c3281116d, opus; carries R2, R3, R4)
Task 8: implementer cut off by an API rate limit (429) with work uncommitted; resumed via SendMessage (same agent aee4db47c3281116d)
Task 8: implementer DONE_WITH_CONCERNS 810fb564b (NavChart 5/5; brief's suite 2072 pass, 7 load timeouts in unrelated files that pass alone; lint 0; health within budget; selector audit ok; NavMap 396 lines, NavChart 339; browser probe at desktop, 390×844 and 844×390 with no page errors)
Ruling: R9 — Task 8's edit to Task 6's presetView (range widened to reach the preset region's rim from the ship's height, `Math.max(v.r, hypot(rim, y − origin.y))`, plus a test) is accepted — the chart plane is the ship's height, so with the ship more than ~250 units off the disc the "Home system" chip drew an empty chart (every station out of the 3D range); spec F says the chart is 3D with stems, so the preset must still frame its region; the brief's pins all still hold — cost if wrong: a preset's zoom varies with the ship's height (Home system from 4,000 up opens at ~4,000 instead of 381).
Ruling: R10 — Task 8's layout CSS departs from the brief's literal Step 4 (the circle sized by a `--circle` variable and kept in flow, not `position: absolute; inset: 0`; the bar may be wider than the circle) — with the literal values the bar was 205 px tall and ran off the screen at 844 × 390, which breaks Review Focus 5 ("the frame, the chart, its bar and the side panel all stay on screen"); the brief's intent (bar under the circle, tools never over a name, 36/44 px) is kept — cost if wrong: a CSS rework of the stage.
Task 8: minor (deferred): a far fight's label is always drawn under its burst regardless of declutter's side (possible overlap)
Task 8: minor (deferred): an existing navmap.css rule fades dimmed names to opacity 0.22, below the 0.55 floor (pre-existing; "existing parts are not restyled")
Task 8: review dispatched (ab6fbb7823e92dd4e, opus)
Task 9: dispatched (base 810fb564b, implementer a6cafa183a10af676, sonnet; carries R5)
Task 8: review — spec ✅ (R2–R4, R9, R10 verified in code), quality Needs fixes (1 Important: each 250 ms tick commits a torn frame — NavChart draws the new ship against the old focus until track's effect re-commits). Fix round 1 queued until Task 9's implementer finishes; folding in Minors #2 (circle bounds for declutter when frame.shape is circle), #5 (memoise placed/geometry), #7 (ChartTools shadowed `label`), #8 (fontPx from a place's name).
Task 8: minor (deferred): fight label ignores its declutter side (navmap.css:364 translate)
Task 8: minor (deferred): Home preset from > ~8,000 off the disc passes system level (stations vanish, chip unpressed, "Out" gone) — needs a comment or cap
Task 8: minor (deferred): a focused place button can unmount on + − 0 (focus falls to body)
Task 9: implementer DONE 8de19602a (MiniMap 4/4; universe+interests+lib: 8 files timed out under load, 22 files pass alone; lint clean; health within budget; Interests chunk 7.41 kB / gzip 2.90 kB before and after)
Task 8: fix round 1 dispatched (resumed aee4db47c3281116d; FIX_BASE 8de19602a; Important #1 + Minors #2, #5, #7, #8)
Task 9: review dispatched (a2585fc2a0e254339, sonnet)
Task 9: review — spec ❌ / quality Needs fixes (1 Important: nothing clips the interactive mini-map, so the zoomed belt band and stems bleed past the 2:1 box). Fix round 1 queued until Task 8's fix round finishes.
Ruling: R11 — the mini-map's arrow keys step through the marks actually drawn (`placed`), not every shown mark — once zoomed in, an undrawn mark has no button to focus, and at the opening view (which fits every mark) the two lists are the same, so nothing today's keyStep reached is lost; the header says so — cost if wrong: a zoomed-in keyboard user can't arrow to an off-chart place without zooming out (0 does that).
Task 9: minor (deferred → Task 10): .minimap-tools (bottom right) may sit over lower-right marks and their under-labels
Task 9: minor (deferred): arrows work only with focus inside .minimap-labels (not from the tools row)
Task 8: fix round 1 implemented 731b42946 (view = track(chart.view, ship) in render; circle bounds (clip radius 500) in declutter/placeMarks with new tests; memoised placed/geometry; ChartTools rename; fontPx from a place's name; browser: torn frame 44.7 → 0 units); re-review dispatched (a597310725b58012c, sonnet)
Task 9: fix round 1 dispatched (resumed a6cafa183a10af676; FIX_BASE 731b42946; clip + R11 header note)
Task 8: fix round 1/5 (5 addressed, 0 open — torn frame; circle bounds; memoised; ChartTools rename; fontPx; commits 8de1960..731b429)
Task 8: complete (commits 22fc203..731b429 [810fb56, 731b429], review clean after fix round 1)
Task 9: fix round 1 implemented 287e9cd9c (interactive svg overflow hidden; R11 header note; browser shots at open, +6, +14)
Task 9: fix round 1/5 (2 addressed, 0 open — interactive svg clipped; R11 header; commits 731b429..287e9cd)
Task 9: minor (deferred → Task 10 check): the clip can cut a rim-pinned g.minimap-ship's glow at the box edge (lane 4c wires the ship later)
Task 9: complete (commits 810fb56..287e9cd [8de1960, 287e9cd], review clean after fix round 1)
Ruling: R12 — origin/main is merged into the lane at the start of Task 10, before the browser checks and after shots, not only in Task 11 — main has moved (lane 2's generator, the intro/cockpit and first-visit work touching universe.css, words.test.js, StartChoice and Universe.jsx), and the after shots and checks should run on what the PR will merge into; Task 11 merges again if main moves further — cost if wrong: one extra merge commit.
Task 10: dispatched (base 287e9cd9c, implementer ae029d3ed29c4bcb4, opus; Step 0 merges origin/main per R12)
Task 10: Step 0 merge committed deea85f04 (origin/main 721296c into the lane); implementer cut off by a 429 after it; resumed via SendMessage (same agent ae029d3ed29c4bcb4)
