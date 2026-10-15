# The Middle-earth landing, remade: the design

Date: 2026-10-09. Lane: the Middle-earth landing (`#/middle-earth` with no place: the map hub, its opening and the map behind it). Rests on the shots in `docs/superpowers/shots/2026-10-09-me-hub-before-*.webp` (the hub as it is on 1440 × 900 and on a 390 × 844 phone, by day and by candle, the opening, a hover, and the flat map), on `docs/superpowers/handoff-middle-earth.md` (what the chapters hold) and on `docs/health/RULES.md` (the house UI). Follows `2026-10-08-one-feel-site-wide-design.md` (the look and the feel the folder already keeps).

## The brief

The owner: the landing page of Middle-earth should be tremendously better, from its features to its visuals to everything. Architected here; built by a fresh session a task at a time from the plan beside it.

What “the landing” is: the page a visitor sees at `#/middle-earth` before they pick a place. The map on its table, the opening that holds on it, the title, the pins, the route at the foot, the road so far, and what the map does while you look at it. The chapters (`/middle-earth/shire` and the rest), the bar over a chapter, the towns, the kitchens and the onward nav are not this lane’s; they stay as they are, and nothing here changes how a chapter opens or what it is given.

Assumptions the owner has not been asked (the session ran without them; each is reversible):

- The map stays the landing. The page’s own comment says Middle-earth is a map and opens on it as the films do, and the diorama, the cast and the walk are three days of work the owner has merged and shot. This lane makes the map the whole picture rather than replacing it.
- The copy keeps the owner’s voice and the lines already on the page; new lines are few and plain.
- Nothing is downloaded that is not downloaded today: `WORLD_MB['/middle-earth']` stays 1.

## What is there, and what is wrong

Read off the shots, each checked against the code.

| what the shot shows | why | shot |
| --- | --- | --- |
| **The opening is a blank page.** At 2.5 s the page is cream with the nav and nothing else: the sections are hidden under `data-opening` and the WebGL map is not up (its module, the font and its shaders are awaited before the canvas is shown), so the hold the opening keeps is a hold on nothing. On a fast chip it is a second; on a phone or a software renderer it is the whole 1.8 s. | `MapBackdrop.jsx` shows the canvas only once `ready` has run; `createFlat` is only the no-chip path | 01 |
| **The title lies across the Misty Mountains.** “WHERE WILL YOU GO?” at 4 rem of Cinzel Decorative, right-aligned, sits on the range and over Rivendell’s pin; its veil is a soft radial that does not read as glass. | `.me-hub-title` at `clamp(2.2rem, …, 4rem)`; `.me-hub-head::before` is a 46 rem radial at 0.82 | 02, 04 |
| **The pins say nothing until hovered.** Ten red dots; the names painted on the sheet under them are hidden by the dots and the cast (Bree under its pin and three figures). | `.me-pin-label { display: none }` until hover | 02, 03 |
| **The foot covers Gondor and Mordor.** The hint, two rows of route chips, a row of four buttons and the credit line: five rows and a third of the height. Mount Doom erupts under the chip for the Dead Marshes; Barad-dûr is out of frame at 16 : 10. | `.me-hub-foot` is a wrapping flex of 36 px chips; the whole-map framing is `[452, 322]` at zoom 3.05 | 02, 03 |
| **By candle the map is black.** In dark mode the relief shows and the sheet does not; the candle light is a point 9 units west of wherever the camera looks, at an ambient of 0.35, and nothing on the table shows where the light comes from. | `night.ambient` intensity `0.85 − 0.5`, the candle `700 + 500` at a `z²` that falls with the zoom | 04, 06 |
| **A phone sees a band of map.** The head takes the top third, the foot the bottom third: the Shire and Mordor are both off screen, and the three rows of 44 px chips are a page of their own. | `.me-hub` is `space-between` over `100svh` with the head and the foot both in flow | 05, 06 |
| **No first step.** Nothing says where to begin, and a returning visitor is not told where they got to: the road so far is behind a button. | `MapHub.jsx` has no primary action | 02, 05 |
| **The table is a plane.** A flat brown plane under the sheet, no edge to the paper, no candle, no room. | `MapBackdrop3D.js`: `table` and `shade` are two planes | 02, 04 |
| **The map does not know what you have done.** The road is faint ink from end to end whoever is looking; the seals are the only mark, and they are on the pins, not the map. | `mapPaint.js` inks the whole road once; `MapHub.jsx` reads `unlocked` for seals only | 02 |
| **Hover does nothing on the map.** A place under the pointer gets a label and a 4 % lean of the camera; the place itself does not stir. | `setView`’s `hover` moves `want.x` by `0.04` of the way | 03 |

And what is right, and stays: the sheet’s paint (`mapPaint.js`), the diorama (`mapDiorama.js`), the toy cast that greets Frodo, the walk, the fly-down into a chapter, the hidden places found by clicking them, the travellers online, the flat map for a browser with no chip, the keys (WASD, Enter, Esc), and the record (`record.js`).

## Goals

Measured on `high` at 1440 × 900 and on the phone size (390 × 844), with the lab script this lane keeps (`lab/me/shots.mjs`, the eight shots, and `lab/me/measure.mjs`, the numbers), before and after:

| what | today | target |
| --- | --- | --- |
| the first paint of the map after the route changes, with the opening on | nothing until the WebGL is up (1 to 3 s) | the painted sheet within 300 ms; the WebGL takes over without a cut |
| the map in frame at 1440 × 900, whole-map view | the Grey Havens to Mount Doom; Barad-dûr cut | the Grey Havens to Barad-dûr, Mordor and Gondor under no UI |
| the share of the viewport under the hub’s own UI (the head, the marks’ labels, the ribbon, the links, the credit), desktop | about 34 % | 22 % or under |
| the same, phone | about 58 % | 32 % or under; the map takes 55 % of the height or more |
| the sheet’s mean luminance in the candle’s pool, dark mode, whole-map view (a 300 × 200 px patch round the candle’s foot) | about 0.05 | 0.18 or over, the region names legible |
| draw calls at the whole-map view, `high` | the baseline the lane measures first | at most the baseline + 8 |
| triangles at the whole-map view, `high` | the baseline | at most the baseline + 60,000; `low` at the baseline (the new layers are off there) |
| `WORLD_MB['/middle-earth']` | 1 | 1 |
| pure rules without a test | 0 | 0 (every new rule in a tested file) |

And by eye, in the pull request: the eight shots before and after, side by side.

## Non-goals

- The chapters, the towns, the kitchens, the side games, the bar over a chapter and the onward nav.
- New models, textures, fonts or audio files; the Sketchfab places stay as they are.
- The flat map’s art (it gets the same UI and the inked road, nothing else).
- The universe map’s Middle-earth planet and the landing on it (`universe/landings/middleearth.js`).
- The cast’s lines and voices.
- WebGPU: everything here is GLSL on the classic renderer, as the folder is.

## Constraints (the standing rules that bite here)

- No new dependency. No runtime call to an asset service. Nothing downloaded that is not today.
- Game rules apart from drawing, in tested pure files: what the hub decides (the first step, the furthest stop, which labels show, when a hidden place gets its hint, the opening’s flight) is data and functions with tests; the scene files only draw.
- Every scene starts from `lib/device`’s tier and lowers itself: the new layers say what they do on `low`, `mid` and `high`.
- A file stays under 800 lines: `mapDiorama.js` (791) and `MapBackdrop3D.js` (329) take hooks only; new drawing goes in new files. `MapHub.jsx` (523) splits into a `hub/` folder.
- One look a folder: the folder keeps `look.js` as it is (`scanned`, tone `house`, the backdrop’s own ACES tone and its why). New materials are the diorama’s `MeshStandardMaterial` flat-shaded colours; no scan, no toon ramp, so `art-mix` does not move.
- The house UI (`RULES.md` section UI): tokens for every number, the 4 px grid, text over 3D on glass at 0.78 or more, dim by colour, 44 px controls on a coarse pointer, one drawing per concept (`.btn`, `.chip`, `.kbd`, `CloseButton`), British spelling, curly quotes, sentence case.
- The hub stays a page you scroll (the map room is `{ pointers: true }`); it does not become a world on the runtime.
- A change to the map changes no gameplay elsewhere: the dev hooks (`window.__ME__.map`), the walk, the tap, `travel`, `project` and `unproject` keep their signatures; the chapters are given the same `spot` and `zoom`.
- `docs/architecture.md`: the Middle-earth entry gains one sentence naming the new files. The guide’s tips and the tour’s brief for `/middle-earth` say what the page now does.

## The shape, in six pieces

### 1. The sheet comes first: the opening

Two canvases in `.me-atlas`, the painted sheet under the WebGL. `MapBackdrop.jsx` paints the sheet flat at once (`createFlat`, as the no-chip path does today, at 1024 wide for speed) the moment the component mounts, so the page has its map in the first frame it can draw; the WebGL canvas is laid over it and fades in (0.7 s) when its first frame is ready. The flat canvas keeps drawing until the WebGL is on, and the view it shows is the same view (`setView` goes to both), so the hand-over is a crossfade of one picture, not a cut. A browser with no chip keeps the flat canvas, as today.

The opening becomes a flight. `mapFlight.js` (pure, tested) holds the keyframes: the camera starts low over Hobbiton (`at: [186, 196]`, zoom 1.1), rises and runs east along the road (over Bree, Rivendell, Moria, Lórien, past Amon Hen to Mount Doom) and pulls back to the whole-map framing, 5.5 s in all, eased in and out between keys; `flightAt(t)` gives `{ at, zoom }` for a time, and the test holds that it starts at Hobbiton, visits the road’s stops in order, and ends on the hub’s framing (`[452, 322]`, zoom 3.05). `MapBackdrop3D`’s `render` takes the flight over `want` while `opening` is on. The title card comes in at 1.5 s and goes at 4.5 s (CSS, from the same numbers). Any key, click, tap or scroll ends it, as today, and the camera eases to the hub from wherever it was. Under reduced motion: no flight, the whole map at once, the title card for 1.5 s. `shouldOpen` is unchanged: once a session, from the top of the page.

### 2. The map on a desk: the room and the light

`mapRoom.js` builds what is round the sheet, in the map’s own colours, flat-shaded, static parts merged by material (`mergeGeometries`), at most 14 draw calls together:

- **The desk**: dark planked wood (a canvas texture from `lib/paint`’s noise, 512², no download) in place of the flat plane; it reaches past the sheet on every side, so a zoomed-out or tall view shows a desk, not a void.
- **The sheet’s edge**: the sheet plane gets a torn, foxed edge (`paintMap` draws an alpha mask, the material takes it as `alphaMap` with `alphaTest`), and its four corners lift a little (the plane’s corner vertices displaced up by 0.15 units), so it is paper lying on wood.
- **Two brass weights** at the south corners, **an inkwell and a quill** at the south-west, **a pipe** by the Shire’s edge, and **a closed red book** at the north-west edge: four small merged props.
- **The candle** in a brass holder at the north-west corner, where the point light already is in spirit: a flame of two crossed additive planes with the kit’s `FIRE` ramp, flickering with the light. The light is pinned to the candle (it no longer follows the camera). By day the window light is the key and the candle is unlit; at night (dark mode) the candle lights, and the ambient floor comes up so the sheet reads: `night.ambient` intensity to 0.5 (from 0.35), the candle to decay 1.6 and an intensity that puts the pool’s mean luminance at 0.18 or over at the whole-map view, found by the lab measure and written down in the file.

`mapWeather.js` adds what moves over the sheet, each a plane just above it with a canvas alpha that scrolls, `depthWrite` off, two draw calls at most each:

- **Cloud shadows** by day: a broad fbm alpha in the sheet’s shade colour, drifting east at 0.25 units a second; fading out at night.
- **Mordor’s pall**: a dark haze over Mordor (the sheet’s 600 to 800 by 340 to 520), soft-edged, turning slowly, deepening with the Mordor lean (`m`).
- **The marsh mist**: a pale breathing patch over the Dead Marshes.

On `low`, and under reduced motion, the weather is still (no scroll); on `low` the pall and mist draw and the cloud shadows do not.

`mapTerrain.js` makes the ranges stand: the sheet’s plane is subdivided (160 × 112 on `high`, 80 × 56 on `mid`, 1 × 1 on `low`) and its vertices raised by the relief the painter already makes (`paintRelief`), to at most 0.6 units at a peak; the relief is zero within 15 sheet units of every stop on the road and every chapter, so the walkers, the places and the pins sit on flat ground as today. `heightAt(x, y)` reads the same relief, for anything that wants the height. The ranges then catch the low light and shadow the valleys east of them.

### 3. The places answer: attention and the wake

`hub/attention.js` (pure, tested): a state of ten values, one a chapter, stepped each frame from what the hub knows (`{ hover, near, flying }`): a hovered or flying place rises to 1 over 0.4 s, the place Frodo stands at to 0.6, and any other falls to 0 over 0.8 s. The hub steps it in its frame callback and hands the values to the backdrop (`api.attention(values)`), which hands them to the wake.

`mapWake.js` draws what each place does as it wakes, reading its value each frame, at most two draw calls a place, instanced or merged, emitters from the kit’s pools:

| place | awake |
| --- | --- |
| The Shire | a firework bursts over the Party Tree every 1.2 s (the diorama’s `bombs` pool, small), the round doors’ lights warm |
| Bree | rain falls over the Pony (a small particle sheet), its window glows |
| Weathertop | five black riders on the summit (instanced cone and sphere), a red glow under the ruin |
| Rivendell | the falls brighten, the lamps warm |
| Moria | the West-gate’s lines flare to full (`moriaGlow` to opacity 1, hotter) |
| Lothlórien | the motes double, the mallorn’s gold brightens |
| Amon Hen | two small boats drift on the Anduin below the hill |
| The Dead Marshes | the candles treble |
| Cirith Ungol | Minas Morgul’s green glow, and a line of orange torches up the stair |
| Mordor | the Eye turns to the pointer’s place on the sheet (and the beam with it), the pall deepens |

A place with a value of 0 draws nothing extra (its instances are hidden, its emitters idle), so a still map costs what it costs today.

### 4. The hub’s face

`MapHub.jsx` becomes the composer of a `hub/` folder; its pointer, key and frame logic stays in it, the pieces move out. Styles in `src/styles/lazy/middleearth-hub.css` (the hub’s own; `middleearth.css` keeps the chapters’). The tokens `--me-veil`, `--me-ink`, `--me-ink-soft`, `--me-wax` stay, by day and by night as today.

- **The head** (`hub/Head.jsx`): small, top-left, on glass (`--me-veil` at 0.86 and a blur of 6 px, the house radius). The eyebrow “Middle-earth · The Third Age”, the title “Where will you go?” at `--fs-display-3` (not display-1), the lead in one sentence, and **the first step**: one `.btn-primary` that `hub/hubState.js` (pure, tested) chooses: for a visitor with no seal at all, “Begin at the Shire” (Frodo walks to Hobbiton and the Shire opens: `onGo('shire')`); for a returning visitor, “Carry on · <the first chapter in road order not yet won>”; when every chapter is won, “The road again” (the Shire). The hint line (“Drag to look about …”) sits under it in `--fs-xs` muted. As today the head steps aside once the visitor roams (`data-roam`).
- **The marks** (`hub/Marks.jsx`, in place of the pins): each place is a wax dot with its name beside it, always, on glass, in Cinzel at `--fs-xs`; under the name, its seals as tiny dots (filled as won); a won place gets the seal. `hub/labels.js` (pure, tested) decides which names show each frame: in road order, a name is hidden when its anchor is within 72 px of a shown one’s, so a crowded zoom shows dots and the clear ones’ names. Hover, focus, or Frodo standing there opens **the card** (`hub/Card.jsx`), one at a time: the title, the blurb, the seals, the kitchen’s stars and the side game’s star from `record.js`, and “Enter <place>” with its key cap; it anchors to the mark and flips to stay in the viewport; on a coarse pointer it is a bottom sheet at `--z-sheet`. Enter enters, Esc closes.
- **The ribbon** (`hub/Ribbon.jsx`, in place of `.me-route`): one row along the bottom, the ten stops as dots on an inked line, filled to the furthest won stop, the next unfinished one pulsing; a name shows on hover and for the next; each dot a 44 px button. On a phone the ribbon is the same row, the names off but the next’s.
- **The links**: “Find Frodo”, the travellers’ button or count, “The road so far” (opens the journal) and “Back to the site”, as `.btn-ghost btn-sm` in one row at the bottom right; on a phone, icons with their text as labels, one row.
- **The credit** (`ModelCredits`): one line at `--fs-xs` muted at the very bottom, under the ribbon, one line on a phone too (ellipsised, the full line in the journal’s foot).
- **The journal** (`hub/Journal.jsx`, the road so far): a drawer from the right, 22 rem on desktop, the full width on a phone, on glass at 0.9, `--z-sheet`: the four totals at the top as small stat rows, then each chapter as today (seals, side, kitchen) with its stop’s one line from `road.js` and a “Go” button, the places off the road last, the credit line at the foot, `CloseButton` and Esc. Its open state is kept as today (`tp-me-record`).

Keys: as today, plus Esc closes the card or the journal (the card first). Tab order: the first step, the marks in road order, the ribbon, the links.

### 5. The map remembers: the inked road and the hints

`mapRoad.js` draws the road the visitor has walked: an ember-red thread (a flat ribbon of quads along the road’s stops, 0.03 above the sheet, about 1,400 triangles) from Hobbiton to the furthest stop whose chapter has any seal, its tip glowing; `record.js` gains `roadInked(unlocked)` (pure, tested: the stop index of the furthest chapter in road order with a seal, 0 with none). The hub passes `unlocked`; the backdrop takes `api.inked(stop)`. The flat map draws the same thread over its sheet (`createFlat.setRoad(stop)`).

Hidden places get a hint once the visitor has a seal in every chapter: `record.js` gains `hiddenHints(unlocked)` (pure, tested: the ids of the places off the road not yet found, when every chapter has a seal; else none), and `mapRoad.js` draws a faint inked “?” on the sheet by each (a small plane with a canvas glyph, in the sheet’s ink). Finding one removes its hint.

### 6. The flat map and reduced motion

The flat map (no chip) takes the same head, marks, card, ribbon, links and journal, and the inked road; no room, no weather, no wake (there is no diorama to wake). Under reduced motion there is no flight, no cloud drift and no pulse on the ribbon, and a place wakes at once rather than over 0.4 s.

## Copy

All in the owner’s voice: British spelling, curly quotes, sentence case, no exclamation marks.

- Eyebrow: “Middle-earth · The Third Age”. Title: “Where will you go?”. Lead: “The map of the Ring’s road. Pick a place on it, and go there.”
- The first step: “Begin at the Shire” / “Carry on · Bree” / “The road again”.
- The card’s button: “Enter Bree” with the key cap ⏎ on a fine pointer.
- The ribbon: `aria-label` “The road”; a dot’s label “Bree: won” or “Bree: 2 of 5 seals”.
- The journal: “The road so far”; its totals “3 of 50 seals”, “1 of 10 on the side”, “4 of 30 kitchen stars”, “0 of 3 off the road”.
- The opening’s card as today: “The Third Age”, “Middle-earth”, “A map, a road, and a ring”.

## Performance

Measured by `lab/me/measure.mjs` (dev only, git-ignored with the rest of `lab/`): it opens the hub with `tp-map3d` forced, waits for the WebGL, reads `window.__ME__.map.info()` (a new dev hook returning `renderer.info.render`), the UI’s share of the viewport (the union of the bounding boxes of `.me-hub-head`, `.me-mark-label`, `.me-ribbon`, `.me-hub-links` and `.me-credit`, as a fraction of the viewport), and the pool’s mean luminance in dark mode (the canvas read back with `preserveDrawingBuffer`, the patch round the candle’s projected foot). The baseline is measured before the first scene change and written into the plan’s handoff row; each scene task reports its numbers against it.

- The room is cheap and draws on every tier; the terrain subdivides by tier; the weather scrolls on `mid` and `high`; the wake draws only what is awake.
- Canvases: the desk 512², each weather alpha 256², the road and the hints none (vertex colour and a 64² glyph). The relief reuses `paintRelief(1024)`.
- The flat sheet at 1024 wide is painted in under 150 ms (`paintMap(2048)` takes about 400 ms in Chromium today; the WebGL still paints its own at 2048).

## Testing

- Pure, beside their files: `hub/attention.test.js`, `hub/hubState.test.js`, `hub/labels.test.js`, `mapFlight.test.js`, and `record.test.js` grown for `roadInked` and `hiddenHints`. Each under a second, no canvas.
- Browser: `lab/me/shots.mjs` (the eight shots) and `lab/me/measure.mjs` (the numbers), run before the first change and after the last; `node scripts/autopilot-check.mjs --routes /middle-earth,/middle-earth/shire --shots <id>` and the same with `--phone`, so the ship’s log has its pictures.
- The gates every change keeps: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Files

New: `src/components/middleearth/hub/{Head,Marks,Card,Ribbon,Journal}.jsx`, `hub/{attention,hubState,labels}.js` with tests, `src/components/middleearth/{mapFlight,mapRoom,mapWeather,mapTerrain,mapWake,mapRoad}.js`, `mapFlight.test.js`, `src/styles/lazy/middleearth-hub.css`, `lab/me/{shots,measure}.mjs`.

Changed: `MapHub.jsx` (the composer), `MapBackdrop.jsx` (two canvases, the crossfade), `MapBackdrop3D.js` (hooks: the room, the terrain, the weather, the wake, the road, the flight, `info()`), `mapPaint.js` (the edge mask, the 1024 paint), `record.js`, `src/styles/lazy/middleearth.css` (the hub’s rules move out), `docs/architecture.md`, `src/components/guide/pages.js`, `src/components/tour/briefs.js`, `docs/superpowers/HANDOFF-worlds.md` (new, the lane’s rows).

## Decisions

- The title stays the owner’s and shrinks to `--fs-display-3`: the map is the picture; the title is its caption.
- A first step over a tour: one button that knows where you are beats a guide.
- Marks with names always on, culled by distance, over labels on hover: a map you can read without moving the pointer is a map.
- A drawer for the journal over a panel in the foot: the foot is the map’s south; the journal is read, not glanced at.
- The candle pinned to the desk over following the camera: a light you can see is a light you believe.
- Relief at most 0.6 units: enough to catch light, not enough to move a pin.
