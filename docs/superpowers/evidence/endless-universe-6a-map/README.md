# Endless universe lane 6a: the map, evidence

The nav map and the mini-maps, before and after lane 6a. The “before” pictures are `main`’s own code. The “after” pictures are the lane’s, which has the maps redesign merged in (#1127’s branch, `claude/nav-map-redesign`: one declutter, the calmer frame, the search and filters in the side panel, the drives with a place picked), so they show both.

## Before

- Date taken: 2026-10-18
- `main` commit: `ddb364bf3`
- Browser: Playwright’s Chromium, headless, software GL, `?quality=low`

### Command

A dev server on `main`’s code, then the check against it:

```
npx vite --port 5266 --strictPort
BASE=http://localhost:5266 OUT=docs/superpowers/evidence/endless-universe-6a-map/before CHROME=<chromium> node scripts/navmap-check.mjs
```

A single mode (`desktop`, `phone`, `minimap` or `far`) takes just its own shots.

### What fails on `main`

The Citadel jump checks, whose coordinates (1755, −4660) are stale (`docs/superpowers/HANDOFF-universe.md`, “Left”). Four checks print FAIL:

- the go button reads “Jump to The Citadel”
- the ship’s out at The Citadel on the first frame past the flash
- with the drive charging, it says so and goes at super speed
- still on its way out to Aurelia with the selection cleared (it reads `rmportal-back`)

Every other check prints ok, and there are no page errors. The Citadel shots (`3`–`6`) are not kept, since they show the broken jump.

## After

- Date taken: 2026-10-21
- The lane at `82538bf55` (with `main` at `616201b11` merged in, and #1127’s branch), plus this commit’s check
- Browser: Playwright’s Chromium, headless, software GL, `?quality=low`

### Command

```
npx vite --port 5266 --strictPort
BASE=http://localhost:5266 OUT=docs/superpowers/evidence/endless-universe-6a-map/after CHROME=<chromium> node scripts/navmap-check.mjs
```

Every check prints ok, and there are no page errors (`all ok`, the whole output below). The jump goes to a main-sector wonder picked by name, the first of Ember and Halcyon the ship didn’t start by, at its place in `__universeDebug.wonders`: no coordinates are left in the check.

### Checks rewritten, and why

- **The drives’ trip times.** Was “a trip time for every drive”; now “a trip time for every drive `nav.js` can time, the jump and super speed always”, and “—” exactly where it has none. `nav.js`’s `tripTime` flies a trip on the ship’s physics for at most 150 s and has no time past that, which the drive shows as “—”. A new ship starts at one of 31 spots (`ship.js`’s `STARTS`); from 9 of them (Gaming, the Caribbean, Invincible, Glacia, Ember, the Cradle, the Twins, the Maw’s and the Cradle’s beacons) the 1× cruise to Avengers HQ takes longer. Measured from every start on `main` (`c34b4e927`) and on the lane: the same 9, and the jump (2.5 s) and super speed (3 to 74 s) timed from all 31. So the old check failed from those starts on `main` too. Long trips’ times are lane 6b’s, with `nav.js`.
- **The phone’s wonder names.** Was “no wonder’s name shows till it’s picked”; now #1127’s rule, the chart’s one declutter (`docs/decisions/2026-10-20-maps-show-only-the-names-with-room.md`): a wonder with room may show its name; a quiet one (`li[data-quiet]`, no room) shows none till it’s picked from the list, then its name shows and no other quiet one’s; and no two names on the phone’s chart meet. Were none quiet at 390 × 844, the check would say so in a note and pin that last rule alone.
- **The far ship’s arrow.** Measured by `.navmap-ship-mark`, not the marker group’s first path, which is the view cone: light on the chart that fades out at its tip.
- **The jump’s due time.** The first finite one in the frame log: while the ship comes round onto the jump its `at` is `Infinity`, which made the timing pass whenever the ship got there.
- **The flat map and the teaser.** `check(true, …)` became a check that each drew, at a size and with places on it.
- **Waits.** Every `waitForTimeout` is now a wait on what it was waiting for (the chart drawn, the go button’s words, the drive pressed, the map shut, the flash over). A page’s first load waits up to five minutes: a cold dev server transforms the universe’s modules on the first ask.

The far mode moves the ship 250,000 out by writing `__universeDebug.state.ship` between frames, as the before shot did. It holds: each frame steps from `state.ship` (`scene.js`’s `step(state.ship, …)`), and there is no wall at the edge. The chart opened there has no place near enough to draw, so the check waits for the ship’s marker and the bar’s words, not for a place’s button.

## Shots

| Shot | What it shows | Before | After |
| --- | --- | --- | --- |
| `1-navmap` | The map open on the desktop. Before: centred on the home system, two names on each other (the Portal, Dimension C-137). After: centred on the ship, its sector and height under the circle, the tools beside them | `before/1-navmap.png` | `after/1-navmap.png` |
| `2-picked` | A world picked (Avengers HQ) | `before/2-picked.png` | `after/2-picked.png` |
| `3-jumping` | The jump to Ember starting, the ship coming round onto it | (not kept: the broken Citadel jump) | `after/3-jumping.jpg` |
| `4-after-jump` | Out at Ember | (not kept) | `after/4-after-jump.jpg` |
| `5-charging` | The map again straight after, the drive charging | (not kept) | `after/5-charging.png` |
| `6-super-to-aurelia` | On the way to Aurelia at super speed | (not kept) | `after/6-super-to-aurelia.jpg` |
| `7-home-system` | The home system view: after, its stations on stems and the course to Aurelia | `before/7-home-system.png` | `after/7-home-system.png` |
| `8-phone-map` | The phone, before the map opens | `before/8-phone-map.png` | `after/8-phone-map.png` |
| `9-phone-navmap` | The phone map | `before/9-phone-navmap.png` | `after/9-phone-navmap.png` |
| `10-phone-picked` | The phone, a place picked | `before/10-phone-picked.png` | `after/10-phone-picked.png` |
| `11-minimap-flat` | The mini-map on the flat (3D off) page: after, on the chart’s projection, with the wonders and moons and no orbit rings | `before/11-minimap-flat.png` | `after/11-minimap-flat.png` |
| `12-minimap-teaser` | The mini-map teaser on the home page, the worlds alone | `before/12-minimap-teaser.png` | `after/12-minimap-teaser.png` |
| `13-far-ship` | The ship 250,000 out from the home sun. Before: the ship marker is missing from the chart, while the panel reads “Your ship · 820,500 ship-lengths from The Twins”. After: the ship in the middle, “Sector 2, 0, 0” under the circle | `before/13-far-ship.png` | `after/13-far-ship.png` |
| `14-phone-zoomed` | The phone’s chart zoomed in by its + tool, Aurelia picked and pinned to the rim | | `after/14-phone-zoomed.png` |
| `15-tilted` | The chart tilted by a Shift-drag of 120 px up | | `after/15-tilted.png` |
| `16-far-ship-pinned` | The far ship dragged off the chart: its marker pinned to the rim, inside the circle | | `after/16-far-ship-pinned.png` |
| `17-phone-sideways` | The phone on its side (844 × 390), the map still open | | `after/17-phone-sideways.png` |

The scene’s pictures (`3`, `4` and `6`) are JPEG at 80, the rest PNG; all are under 1 MB.

## The phone, against the hand-off’s “Left”

The hand-off asked for the phone layout (390 × 844) to be seen. What the check pins now:

| Asked | The check, after |
| --- | --- |
| The chart over the side panel | ok: on a phone the chart sits over the list, all on the screen |
| The panel’s scroll | ok: the side panel scrolls (4,382 px in 284, scrolled to 200) |
| Wonder names hidden unless picked | ok: 15 wonders on the chart, 4 named where there’s room and 11 quiet with no name; picked from the list, Aurelia’s name shows, and no other quiet wonder’s; no two of the 8 names meet |
| The map button clear of the Multiplayer pill | ok: the map button fits on a phone, clear of the settings, the hangar and the pilots |
| The chart’s tools | ok: each at least 44 × 44 on a touch screen, inside the frame, clear of each other and of the readout, which shows |
| Turned sideways (844 × 390) | ok: the frame, the chart, its bar and the side panel’s top are on the screen |

Seen in `17-phone-sideways`: with the circle that small, the name of the place picked (Aurelia, pinned to the rim) sits over the name of where you are (Albuquerque). The chart always shows both, on glass over their neighbours, so the declutter doesn’t part them. No check covers it yet.

## Sizes and the scene

- The `Interests` chunk (the home page’s lazy section, with the teaser): 7.41 kB, gzip 2.90 kB, before and after the mini-map moved onto the chart (Task 9’s two builds).
- The scene is unchanged: the lane doesn’t touch `scene.js`, `ship.js` or `nav.js`, so draw calls and triangles are as before.

## The check’s output, after

```
ok   The Maw’s name clear of The Caribbean’s
ok   Glacia’s name clear of the galaxy gate’s
ok   the place list doesn’t run under the key hints
ok   the chart opens on the ship, in its middle (0.0 px off)
ok   it opens on the neighbourhood level (neighbourhood)
ok   the bar says the ship’s sector (“Sector 0, 0, 0 · 570 ship-lengths below the disc”, for Sector 0, 0, 0 ·)
ok   no two of the 16 names on the chart meet
ok   the wheel zooms in to a system (7 turns, system)
ok   typed into “Find a place…”, − and 0 go into the field (“-0”)
ok   typing − and 0 doesn’t zoom (system → system)
ok   typing 0 doesn’t move the ship on the chart
ok   − zooms back out to the neighbourhood (1 presses, neighbourhood)
ok   a place’s name to drag from (caribbean)
ok   a drag of 120 px from caribbean’s name takes the ship 120 px right with the hand (0.0 px off)
ok   the drag doesn’t pick caribbean or send the ship (pressed false, trip -/-)
ok   a double press dragged from caribbean’s name doesn’t pick it or send the ship (trip -/-)
ok   “Back to the ship” is on once the chart’s been moved
ok   “Back to the ship” puts it back in the middle (0.0 px off)
ok   a Shift-drag of 120 px up tilts the chart, and “Look straight down” is on
ok   “Look straight down” lays it flat
ok   the go button reads “Race to Avengers HQ”
ok   a trip time for every drive nav.js can time, the jump and super speed always (2.5 s, 53 s, 2 min 29 s)
ok   the go button reads “Jump to Ember”
ok   the site’s jump plays over the map
ok   the ship’s out at Ember on the first frame past the flash ({"late":0.4364999999999952,"frame":0.40229999995231225,"before":0.03420000004768298})
ok   the world’s card is cleared from the panel (#/universe)
ok   the panel’s back to the map’s own
ok   the map says where you are and that the drive's charging (Your shipJump: charging, 65 sAt EmberHolding still)
ok   with the drive charging, it says so and goes at super speed
ok   still on its way out to Aurelia with the selection cleared (aurelia)
ok   Escape closes the map
ok   the map button fits on a phone, clear of the settings, the hangar and the pilots
ok   on a phone the chart sits over the list, all on the screen ({"frame":true,"chart":true,"side":true})
ok   each chart tool is at least 44 × 44 on a touch screen (44×44 44×44 44×44 44×44; 1 coarse rules)
ok   the tools are inside the frame, clear of each other and of the readout ({"inside":true,"apart":true,"clear":true})
ok   the readout shows under the chart (“Sector 0, 0, 0 · 1,800 ship-lengths above the disc”)
ok   the side panel scrolls (4382 px in 284, scrolled to 200)
ok   the phone’s chart has 15 wonders, 4 named where there’s room and 11 quiet, with no name showing
ok   every name on the phone’s chart has its room: no two of the 8 meet
ok   picked from the list, Aurelia’s name shows, and no other quiet wonder’s (none; 5 with room named)
ok   tapping zoom in changes the chart’s level (neighbourhood → system, 7 taps)
ok   on its side (844 × 390) the frame, the chart, its bar and the side panel’s top are on the screen (.navmap-frame 12,12,832,378; .navmap-chart 182,146,344,306; .navmap-bar 31,314,496,359; .navmap-side 513,146,813,359)
ok   the flat map has Aurelia, the Veil and the Squanch moon, and no orbit rings (aurelia, veil, squanch; 0 rings)
note the flat map’s tools row (bottom right) is over no place
ok   + with the focus in the flat map zooms it (neighbourhood → system, 6 presses)
ok   the flat mini-map (808 × 404) and the home teaser (1054 × 527, 12 places) both drew
ok   the teaser has only worlds (12)
ok   the ship far out is on the chart, inside its circle ({"drawn":true,"inside":true})
ok   the bar says its sector (“Sector 2, 0, 0 · 3,800 ship-lengths above the disc”)
ok   dragged away, the ship’s marker is pinned to the rim, inside the circle (334 of 366 px out)
ok   the pinned marker’s arrow and halo are wholly in the circle (345 and 359 of 366 px)
no page errors
all ok
```
